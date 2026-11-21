/**
 * GATE LOG STORE — node-only, server-side.
 *
 * The honeypot's memory: every knock on a trap path (see gateLog.ts) is
 * appended IMMEDIATELY to an append-only JSONL file kept with the
 * operator's other protected local state (~/.local/share/augie/, the
 * same directory and pattern as the local operator registry). Appends
 * are single appendFile calls serialized on a promise chain — no
 * read-modify-write, so concurrent knocks cannot interleave or lose a
 * line, and a crash can tear at most the final line (the parser skips
 * malformed lines). The file is capped at 1 MiB: past the cap it
 * rotates to gate-log.1.jsonl (one generation kept) and starts fresh.
 *
 * This is a LOCAL desktop server feature. Where there is no node
 * filesystem (the Cloudflare Worker build), the store is unavailable,
 * trap requests fall through to the app's normal handling, and nothing
 * is recorded — the public site is a different surface.
 */
import {
  GATE_LOG_MAX_BYTES,
  isTrapPath,
  parseGateLog,
  planAppend,
  serializeKnock,
  type GateKnock,
} from "./gateLog";

type GateLogFs = typeof import("node:fs/promises");

export interface GateLogStore {
  record(knock: GateKnock): Promise<void>;
  read(): Promise<{ entries: GateKnock[]; total: number }>;
}

/** Newest entries the operator view ever receives in one read. */
const READ_ENTRY_CAP = 500;

class FileGateLogStore implements GateLogStore {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly fs: GateLogFs,
    private readonly filePath: string,
    private readonly rotatedPath: string,
  ) {}

  private async appendNow(knock: GateKnock): Promise<void> {
    const line = serializeKnock(knock);
    const lineBytes = Buffer.byteLength(line, "utf8");
    let currentBytes = 0;
    try {
      currentBytes = (await this.fs.stat(this.filePath)).size;
    } catch {
      // No file yet: first knock creates it.
    }
    if (planAppend(currentBytes, lineBytes, GATE_LOG_MAX_BYTES) === "rotate") {
      await this.fs.rename(this.filePath, this.rotatedPath).catch(() => undefined);
    }
    await this.fs.appendFile(this.filePath, line, "utf8");
  }

  record(knock: GateKnock): Promise<void> {
    // Serialized: rotation + append are one atomic step per knock, so
    // two knocks landing together can never race the rename.
    const result = this.tail.then(() => this.appendNow(knock));
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async read(): Promise<{ entries: GateKnock[]; total: number }> {
    const readFile = async (path: string): Promise<GateKnock[]> => {
      try {
        return parseGateLog(await this.fs.readFile(path, "utf8"));
      } catch {
        return [];
      }
    };
    // Rotated file holds the older knocks; the live file the newer.
    const knocks = [...(await readFile(this.rotatedPath)), ...(await readFile(this.filePath))];
    return { entries: knocks.slice(-READ_ENTRY_CAP).reverse(), total: knocks.length };
  }
}

export async function createGateLogStore(directory: string): Promise<GateLogStore | null> {
  try {
    const fs = await import("node:fs/promises");
    await fs.mkdir(directory, { recursive: true });
    return new FileGateLogStore(fs, `${directory}/gate-log.jsonl`, `${directory}/gate-log.1.jsonl`);
  } catch {
    return null;
  }
}

let gateLogStorePromise: Promise<GateLogStore | null> | null = null;

function getGateLogStore(): Promise<GateLogStore | null> {
  gateLogStorePromise ??= (() => {
    const home = process.env["HOME"]?.trim();
    if (!home) return Promise.resolve(null);
    return createGateLogStore(`${home}/.local/share/augie`);
  })();
  return gateLogStorePromise;
}

/** Append one knock to the gate log. No-op where the store is unavailable. */
export async function recordGateKnock(knock: GateKnock): Promise<void> {
  const store = await getGateLogStore();
  if (!store) return;
  await store.record(knock);
}

/** Read the gate log for the operator view. */
export async function readGateLog(): Promise<{
  available: boolean;
  entries: GateKnock[];
  total: number;
}> {
  const store = await getGateLogStore();
  if (!store) return { available: false, entries: [], total: 0 };
  const { entries, total } = await store.read();
  return { available: true, entries, total };
}

type RequestWithIp = Request & {
  ip?: unknown;
  runtime?: { node?: { req?: { socket?: { remoteAddress?: unknown } } } };
};

/**
 * The source address the server actually saw. On the local node
 * server this is the TCP peer of the connection (srvx exposes it as
 * request.ip / runtime.node.req.socket): a request from this machine
 * reads 127.0.0.1, from the LAN the machine's LAN address, over
 * Tailscale the tailnet address. Only when no socket address exists
 * (e.g. behind a proxy that terminates the connection) do the
 * forwarding headers count, and then the address is the proxy's claim,
 * not a socket fact.
 */
export function clientIpFromRequest(request: Request): string {
  const candidate = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.replace(/^::ffff:/i, "");
  };
  const withIp = request as RequestWithIp;
  const socketIp =
    candidate(withIp.ip) ?? candidate(withIp.runtime?.node?.req?.socket?.remoteAddress);
  if (socketIp) return socketIp;
  const forwarded =
    candidate(request.headers.get("cf-connecting-ip")) ??
    candidate(request.headers.get("x-forwarded-for")?.split(",")[0]) ??
    candidate(request.headers.get("x-real-ip"));
  return forwarded ?? "unknown";
}

/**
 * Honeypot interception, called by the server entry before the app
 * handler. Returns a bland 404 Response for a trap path (recording the
 * knock first), or null when the path is not a trap — the caller then
 * continues untouched, so real routes pay only one pathname check.
 * The response body is the plain text any bare server returns; the
 * word "honeypot" appears nowhere in it.
 */
export async function handleTrapRequest(request: Request): Promise<Response | null> {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return null;
  }
  if (!isTrapPath(pathname)) return null;
  const store = await getGateLogStore();
  if (!store) return null;
  const knock: GateKnock = {
    ts: new Date().toISOString(),
    ip: clientIpFromRequest(request),
    method: request.method || "GET",
    path: pathname.slice(0, 512),
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 512),
  };
  try {
    await store.record(knock);
  } catch {
    // A failed write never changes the answer a probe gets.
  }
  return new Response("404 Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
