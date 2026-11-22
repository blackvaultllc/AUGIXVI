/**
 * WATCH VITALS STORE (Part 20) — readings that came from his actual
 * watch, kept LOCAL-ONLY in the data core, operator-only. A reading
 * is written only when the phone bridge received it from the watch's
 * BLE heart-rate service; nothing here generates or interpolates a
 * number.
 */
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import type { WatchReading } from "./watchBle";

export function watchVitalsPath(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env["AUGIE_WATCH_VITALS_PATH"] ??
    join(homedir(), ".local", "share", "augie", "watch-vitals.jsonl")
  );
}

let writeChain: Promise<void> = Promise.resolve();

export async function appendWatchReading(
  reading: WatchReading,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const path = watchVitalsPath(env);
  writeChain = writeChain.then(async () => {
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.appendFile(path, `${JSON.stringify(reading)}\n`, "utf8");
  });
  await writeChain;
}

export async function readWatchReadings(
  limit = 60,
  env: NodeJS.ProcessEnv = process.env,
): Promise<WatchReading[]> {
  try {
    const text = await fs.readFile(watchVitalsPath(env), "utf8");
    const readings: WatchReading[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as WatchReading;
        if (parsed && typeof parsed.bpm === "number") readings.push(parsed);
      } catch {
        // torn line skipped
      }
    }
    return readings.slice(-limit).reverse();
  } catch {
    return [];
  }
}

async function requireOperator(accessToken: string): Promise<boolean> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return verification.authorized;
}

export const saveWatchReading = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; reading: WatchReading }) => input)
  .handler(async ({ data }): Promise<{ saved: boolean }> => {
    if (!(await requireOperator(data.accessToken))) return { saved: false };
    const { bpm, at } = data.reading;
    if (!Number.isFinite(bpm) || bpm <= 0 || bpm > 250) return { saved: false };
    await appendWatchReading({ at, bpm, source: "ble-heart-rate-service" });
    return { saved: true };
  });

export const listWatchReadings = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(async ({ data }): Promise<{ authorized: boolean; readings: WatchReading[] }> => {
    if (!(await requireOperator(data.accessToken))) return { authorized: false, readings: [] };
    return { authorized: true, readings: await readWatchReadings() };
  });
