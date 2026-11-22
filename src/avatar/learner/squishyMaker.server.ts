import { homedir } from "node:os";
import { join } from "node:path";

/**
 * SQUISHY MAKER — the server half of her game, inside Augie.
 *
 * Her Squishy Maker (the Muse artifact, v4) is a client bundle plus
 * six server actions backed by the space runtime's database:
 * listSquishies, saveSquishy, updateSquishy, deleteSquishy,
 * getPrizeMoney, earnPrize. The client speaks a small JSON protocol —
 * POST {action, args} to ./actions, read {data} (or {error}) back —
 * and invalidates its own queries after every mutation, so the game
 * runs unchanged from Augie's own origin as long as something honest
 * answers that endpoint with the same shapes.
 *
 * This module is that something: the same six actions with the same
 * request/response shapes and the same rules (a squishy is a name plus
 * design choices; prize money is pretend, starts at $0, and earnPrize
 * adds exactly $10). Her creations live in a JSON file on this machine
 * (~/.local/share/augie/squishy-maker.json, AUGIE_SQUISHY_STORE_PATH
 * overrides it) — written atomically, one write at a time, in the same
 * style as the local operator registry. Her artifact-side collection
 * was empty when this was built (checked through the artifact's own
 * actions on 2026-11-21), so both sides start from the same $0 / no
 * squishies; from here they are two shelves, and this one is the one
 * inside her Augie.
 */

export type SquishyRecord = {
  id: number;
  name: string;
  baseType: string;
  color: string;
  eyeStyle: string;
  eyeColor: string;
  face: string;
  materials: string[];
  extras: string[];
  glitterColor: string;
  glitterAmount: number;
  size: string;
  scent: string;
  cut: boolean;
  created_at: string;
};

type SquishyStore = {
  nextId: number;
  squishies: SquishyRecord[];
  prizeMoney: number;
};

const EMPTY_STORE: SquishyStore = { nextId: 1, squishies: [], prizeMoney: 0 };

export function squishyStorePath(env: Record<string, string | undefined> = process.env): string {
  const override = env["AUGIE_SQUISHY_STORE_PATH"]?.trim();
  if (override) return override;
  return join(homedir(), ".local", "share", "augie", "squishy-maker.json");
}

type FsLike = typeof import("node:fs/promises");

let writeTail: Promise<void> = Promise.resolve();

async function loadStore(fs: FsLike, path: string): Promise<SquishyStore> {
  try {
    const parsed = JSON.parse(await fs.readFile(path, "utf8")) as Partial<SquishyStore>;
    return {
      nextId: typeof parsed.nextId === "number" && parsed.nextId > 0 ? parsed.nextId : 1,
      squishies: Array.isArray(parsed.squishies) ? (parsed.squishies as SquishyRecord[]) : [],
      prizeMoney: typeof parsed.prizeMoney === "number" ? parsed.prizeMoney : 0,
    };
  } catch {
    return { ...EMPTY_STORE, squishies: [] };
  }
}

async function persistStore(fs: FsLike, path: string, store: SquishyStore): Promise<void> {
  const dir = path.slice(0, path.lastIndexOf("/"));
  if (dir) await fs.mkdir(dir, { recursive: true });
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.rename(tmp, path);
}

/** Run one store mutation serialized against every other, then persist. */
async function withStore<T>(
  mutate: (store: SquishyStore) => T,
  path: string = squishyStorePath(),
): Promise<T> {
  const fs = await import("node:fs/promises");
  let result!: T;
  const run = writeTail.then(async () => {
    const store = await loadStore(fs, path);
    result = mutate(store);
    await persistStore(fs, path, store);
  });
  writeTail = run.catch(() => {});
  await run;
  return result;
}

async function readStore(path: string = squishyStorePath()): Promise<SquishyStore> {
  const fs = await import("node:fs/promises");
  return loadStore(fs, path);
}

/* -------- the six actions, same shapes as the artifact's -------- */

type DesignArgs = {
  name: string;
  baseType: string;
  color: string;
  eyeStyle: string;
  eyeColor: string;
  face: string;
  materials: string[];
  extras: string[];
  glitterColor: string;
  glitterAmount: number;
  size: string;
  scent: string;
  cut: boolean;
};

function readDesign(args: Record<string, unknown>): DesignArgs {
  const name = typeof args["name"] === "string" ? args["name"] : "";
  if (name.trim().length < 1 || name.length > 40) {
    throw new Error("A squishy needs a name (1–40 characters).");
  }
  const str = (key: string) => (typeof args[key] === "string" ? (args[key] as string) : "");
  const strList = (key: string) =>
    Array.isArray(args[key]) ? (args[key] as unknown[]).filter((x) => typeof x === "string") : [];
  const glitter = args["glitterAmount"];
  if (typeof glitter !== "number" || !Number.isInteger(glitter) || glitter < 0 || glitter > 3) {
    throw new Error("glitterAmount must be a whole number from 0 to 3.");
  }
  return {
    name,
    baseType: str("baseType"),
    color: str("color"),
    eyeStyle: str("eyeStyle"),
    eyeColor: str("eyeColor"),
    face: str("face"),
    materials: strList("materials") as string[],
    extras: strList("extras") as string[],
    glitterColor: str("glitterColor"),
    glitterAmount: glitter,
    size: str("size"),
    scent: str("scent"),
    cut: args["cut"] === true,
  };
}

export async function runSquishyAction(
  action: string,
  args: Record<string, unknown>,
  storePath: string = squishyStorePath(),
): Promise<unknown> {
  switch (action) {
    case "listSquishies": {
      const store = await readStore(storePath);
      return { squishies: [...store.squishies].sort((a, b) => b.id - a.id) };
    }
    case "saveSquishy": {
      const design = readDesign(args);
      return withStore((store) => {
        const record: SquishyRecord = {
          ...design,
          id: store.nextId,
          created_at: new Date().toISOString(),
        };
        store.nextId += 1;
        store.squishies.push(record);
        return { id: record.id };
      }, storePath);
    }
    case "updateSquishy": {
      const design = readDesign(args);
      const id = args["id"];
      if (typeof id !== "number") throw new Error("updateSquishy needs the squishy's id.");
      return withStore((store) => {
        const at = store.squishies.findIndex((s) => s.id === id);
        if (at >= 0) {
          store.squishies[at] = { ...store.squishies[at]!, ...design };
        }
        return { ok: true as const };
      }, storePath);
    }
    case "deleteSquishy": {
      const id = args["id"];
      if (typeof id !== "number") throw new Error("deleteSquishy needs the squishy's id.");
      return withStore((store) => {
        store.squishies = store.squishies.filter((s) => s.id !== id);
        return { ok: true as const };
      }, storePath);
    }
    case "getPrizeMoney": {
      const store = await readStore(storePath);
      return { total: store.prizeMoney };
    }
    case "earnPrize": {
      return withStore((store) => {
        store.prizeMoney += 10;
        return { total: store.prizeMoney };
      }, storePath);
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/** POST /games/squishy-maker/actions — the game's doorway. */
export async function handleSquishyActionsRequest(request: Request): Promise<Response> {
  let body: { action?: unknown; args?: unknown };
  try {
    body = (await request.json()) as { action?: unknown; args?: unknown };
  } catch {
    return Response.json({ error: "That was not JSON." }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";
  const args =
    body.args && typeof body.args === "object" ? (body.args as Record<string, unknown>) : {};
  if (!action) {
    return Response.json({ error: "No action was named." }, { status: 400 });
  }
  try {
    const data = await runSquishyAction(action, args);
    return Response.json({ data });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The game hit a problem." },
      { status: 400 },
    );
  }
}
