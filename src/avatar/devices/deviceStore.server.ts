/**
 * DEVICE CORE STORE — the server half (node-only). The device
 * system's state of record: registry, bindings, profiles, command
 * log, and Permission Law flag requests, in one JSON file with the
 * operator's other protected local state
 * (~/.local/share/augie/devices-core.json).
 *
 * First birth: when no file exists yet, the store is born as the
 * SEED (deviceStoreCore.seedDeviceCoreState) — Wepwawet, device #1,
 * RETIRED since the Captain sold the dog on 2026-11-24, its grant
 * ended — and the seed is persisted on the first write. A browser
 * cache that already holds his real cards merges over the seed on
 * first sync (mergeLocalIntoCore): his data wins, nothing he set
 * up is lost — and the sold dog lands retired on every road, so a
 * stale cache can never resurrect its live grant.
 *
 * Writes are serialized on a promise chain — no read-modify-write
 * races between the window's sync and a construct send. Where
 * there is no node filesystem (the hosted Worker build), reads say
 * available:false and writes return null — honest, never faked.
 */
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  sanitizeDeviceCoreState,
  seedDeviceCoreState,
  type DeviceCoreState,
} from "./deviceStoreCore";

export function deviceCorePath(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env["AUGIE_DEVICES_CORE_PATH"] ??
    join(homedir(), ".local", "share", "augie", "devices-core.json")
  );
}

export async function readDeviceCore(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ available: boolean; state: DeviceCoreState }> {
  try {
    const raw = await fs.readFile(deviceCorePath(env), "utf8");
    return { available: true, state: sanitizeDeviceCoreState(JSON.parse(raw)) };
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "ENOENT") {
      // Not born yet on this core — the seed is the honest first
      // state (the dog's retired card is a matter of record, not
      // a guess).
      return { available: true, state: seedDeviceCoreState() };
    }
    return { available: false, state: seedDeviceCoreState() };
  }
}

let writeChain: Promise<void> = Promise.resolve();

/** Replace the whole core state. Returns the stored state, or null
 *  where the store cannot be written on this surface. */
export async function writeDeviceCore(
  state: DeviceCoreState,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DeviceCoreState | null> {
  let result: DeviceCoreState | null = null;
  const step = async () => {
    try {
      const path = deviceCorePath(env);
      await fs.mkdir(dirname(path), { recursive: true });
      const clean = sanitizeDeviceCoreState(state);
      await fs.writeFile(path, JSON.stringify(clean, null, 2), "utf8");
      result = clean;
    } catch {
      result = null;
    }
  };
  writeChain = writeChain.then(step, step);
  await writeChain;
  return result;
}

/** Read-modify-write under the same chain — the construct tools'
 *  road, so a send and a sync can never tear each other's state. */
export async function mutateDeviceCore(
  mutate: (state: DeviceCoreState) => DeviceCoreState,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DeviceCoreState | null> {
  let result: DeviceCoreState | null = null;
  const outer = async () => {
    const { available, state } = await readDeviceCore(env);
    if (!available) {
      result = null;
      return;
    }
    const next = sanitizeDeviceCoreState(mutate(state));
    try {
      const path = deviceCorePath(env);
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, JSON.stringify(next, null, 2), "utf8");
      result = next;
    } catch {
      result = null;
    }
  };
  const inner = writeChain.then(outer, outer);
  writeChain = inner;
  await inner;
  return result;
}
