/**
 * GRID-DOWN EXCHANGE RUNTIME — node-only, server-side.
 *
 * The machine facts the Exchange window shows, each read from
 * the machine itself at the moment it is asked:
 *   · the addresses to give out — this machine's own network
 *     interfaces (its LAN address, and its tailnet address
 *     when it has one), labeled by where each came from;
 *   · whether the exchange service is actually listening on
 *     the door's port right now (a real TCP knock on
 *     127.0.0.1, not a hope);
 *   · the Outbox and Inbox folder listings, from the folders
 *     themselves;
 *   · the connection log — lines the exchange service itself
 *     wrote (the daemon setup keeps them in connections.log
 *     beside the store), parsed into entries. No file, no
 *     entries: the window says the service has not run yet.
 *
 * Nothing here invents a fact: an address that is not on this
 * machine is not shown, and a service that is not listening
 * is reported as not listening.
 */
import { connect } from "node:net";
import { networkInterfaces } from "node:os";
import { daemonLogEntry, type ExchangeLogEntry } from "./exchange";

export interface ExchangeAddress {
  address: string;
  /** Where this address came from, in plain words. */
  source: string;
}

/** This machine's outward IPv4 addresses: LAN first, then the tailnet (100.64.0.0/10). */
export function machineExchangeAddresses(): ExchangeAddress[] {
  const out: ExchangeAddress[] = [];
  const ifaces = networkInterfaces();
  for (const [name, list] of Object.entries(ifaces)) {
    for (const iface of list ?? []) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      const [a = 0, b = 0] = iface.address.split(".").map((n) => Number(n));
      const isTailnet = a === 100 && b >= 64 && b <= 127;
      out.push({
        address: iface.address,
        source: isTailnet
          ? `Tailnet address (interface ${name})`
          : `Local network address (interface ${name})`,
      });
    }
  }
  out.sort((x, y) => Number(x.source.startsWith("Tailnet")) - Number(y.source.startsWith("Tailnet")));
  return out;
}

/** A real knock: is anything listening on this port on this machine right now? */
export function exchangeServiceListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port, timeout: 800 });
    const done = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export interface ExchangeFolderFile {
  /** The file's own name (last path segment). */
  name: string;
  /** Its path inside the folder — for the Inbox, "login-name/file" for a person's arrivals. */
  path: string;
  size: number;
  modifiedAt: number;
  /** Inbox only: the login name whose subfolder the file sits in, or "" for the top level. */
  fromUser: string;
}

/** One folder's real listing — files only, newest first. A missing folder reads empty. */
export async function listExchangeFolder(directory: string): Promise<ExchangeFolderFile[]> {
  try {
    const fs = await import("node:fs/promises");
    const names = await fs.readdir(directory);
    const files: ExchangeFolderFile[] = [];
    for (const name of names) {
      if (name.startsWith(".")) continue;
      try {
        const stat = await fs.stat(`${directory}/${name}`);
        if (stat.isFile()) {
          files.push({ name, path: name, size: stat.size, modifiedAt: Math.floor(stat.mtimeMs), fromUser: "" });
        }
      } catch {
        // A file that vanished mid-listing is simply not listed.
      }
    }
    files.sort((a, b) => b.modifiedAt - a.modifiedAt);
    return files;
  } catch {
    return [];
  }
}

/**
 * The Inbox listing: top-level files plus each person's
 * subfolder (named by their login), so the Captain sees who
 * left what. One level deep — that is the daemon's layout.
 */
export async function listExchangeInbox(directory: string): Promise<ExchangeFolderFile[]> {
  const files = await listExchangeFolder(directory);
  try {
    const fs = await import("node:fs/promises");
    const names = await fs.readdir(directory);
    for (const name of names) {
      if (name.startsWith(".")) continue;
      try {
        const stat = await fs.stat(`${directory}/${name}`);
        if (!stat.isDirectory()) continue;
        const inner = await listExchangeFolder(`${directory}/${name}`);
        for (const f of inner) {
          files.push({ ...f, path: `${name}/${f.name}`, fromUser: name });
        }
      } catch {
        // A folder that vanished mid-listing is simply not listed.
      }
    }
  } catch {
    // No inbox folder yet — the flat listing (empty) stands.
  }
  files.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return files;
}

/**
 * The service's own connection lines, parsed into entries.
 * The daemon setup (parrot-exchange-sync.sh) refreshes
 * connections.log beside the store from the service's journal.
 * Returns null when the file does not exist — the service has
 * not run on this machine yet, and the window says exactly that.
 */
export async function readDaemonLogEntries(
  storeDirectory: string,
  knownUsernames: ReadonlySet<string>,
): Promise<ExchangeLogEntry[] | null> {
  try {
    const fs = await import("node:fs/promises");
    const text = await fs.readFile(`${storeDirectory}/connections.log`, "utf8");
    const entries: ExchangeLogEntry[] = [];
    const lines = text.split("\n").slice(-400);
    for (const line of lines) {
      const entry = daemonLogEntry(line, knownUsernames, 0);
      if (entry) entries.push(entry);
    }
    return entries.slice(-60);
  } catch {
    return null;
  }
}
