/**
 * WEPWAWET CARD STATE — the Captain's own records on the dog's
 * card (owner orders 2026-11-24): his sound picks and his
 * battery-test log. Both live in the browser's local storage on
 * the machine Augie is open on — they are his notebook, not
 * telemetry; nothing here is sent anywhere.
 *
 * SOUND PICKS: every sound/content trigger on the card carries a
 * Use / Never use pick. Never use disables that trigger's Send —
 * his standing choice about which of the dog's sounds may be
 * used. Default is Use for everything.
 *
 * BATTERY LOG: the dog reports nothing back (protocol §8 — no
 * battery characteristic exists), so his endurance can only be
 * MEASURED: full charge, one mode, a timer, until he turns
 * himself off. The log holds only runs he actually watched and
 * timed — no figure is ever invented or pre-filled.
 */

export const WEPWAWET_SOUND_OFF_KEY = "augie.wepwawet.soundOff.v1";
export const WEPWAWET_BATTERY_LOG_KEY = "augie.wepwawet.batteryLog.v1";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/* ------------------------------ sound picks ------------------------------ */

/** Map of command id → true for every trigger he set to Never use. */
export function loadSoundOff(storage?: Storage | null): Record<string, true> {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(WEPWAWET_SOUND_OFF_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const out: Record<string, true> = {};
    for (const [id, v] of Object.entries(parsed)) {
      if (v === true && id.trim()) out[id] = true;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveSoundOff(off: Record<string, true>, storage?: Storage | null): void {
  try {
    (storage ?? globalThis.localStorage)?.setItem(WEPWAWET_SOUND_OFF_KEY, JSON.stringify(off));
  } catch {
    /* storage unavailable — the picks live for this session only */
  }
}

/* ------------------------------ battery log ------------------------------ */

export const BATTERY_MODES = [
  { id: "idle", label: "Idle — awake, no commands" },
  { id: "patrol", label: "Walking patrol" },
  { id: "lights", label: "Lights on" },
] as const;

export type BatteryModeId = (typeof BATTERY_MODES)[number]["id"];

export type BatteryLogEntry = {
  id: string;
  /** ISO date (yyyy-mm-dd) the run was watched. */
  at: string;
  mode: BatteryModeId;
  /** Minutes from switch-on (full charge) to his own auto-off. */
  minutes: number;
  note?: string;
};

const BATTERY_MODE_IDS = new Set<string>(BATTERY_MODES.map((m) => m.id));
const MAX_BATTERY_ENTRIES = 60;

function sanitizeBatteryEntry(v: unknown): BatteryLogEntry | null {
  if (!isRecord(v)) return null;
  const id = typeof v["id"] === "string" && v["id"].trim() ? v["id"].slice(0, 64) : null;
  const at = typeof v["at"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v["at"]) ? v["at"] : null;
  const mode =
    typeof v["mode"] === "string" && BATTERY_MODE_IDS.has(v["mode"])
      ? (v["mode"] as BatteryModeId)
      : null;
  const minutes =
    typeof v["minutes"] === "number" && Number.isFinite(v["minutes"]) && v["minutes"] > 0
      ? Math.min(Math.round(v["minutes"] * 10) / 10, 100_000)
      : null;
  if (!id || !at || !mode || minutes === null) return null;
  const note =
    typeof v["note"] === "string" && v["note"].trim() ? v["note"].trim().slice(0, 200) : undefined;
  return { id, at, mode, minutes, ...(note ? { note } : {}) };
}

export function loadBatteryLog(storage?: Storage | null): BatteryLogEntry[] {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(WEPWAWET_BATTERY_LOG_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeBatteryEntry)
      .filter((e): e is BatteryLogEntry => e !== null)
      .slice(-MAX_BATTERY_ENTRIES);
  } catch {
    return [];
  }
}

export function saveBatteryLog(entries: BatteryLogEntry[], storage?: Storage | null): void {
  try {
    (storage ?? globalThis.localStorage)?.setItem(
      WEPWAWET_BATTERY_LOG_KEY,
      JSON.stringify(entries.slice(-MAX_BATTERY_ENTRIES)),
    );
  } catch {
    /* storage unavailable — the log lives for this session only */
  }
}

export function addBatteryEntry(
  draft: { at: string; mode: BatteryModeId; minutes: number; note?: string | undefined },
  storage?: Storage | null,
): BatteryLogEntry[] {
  const entry = sanitizeBatteryEntry({
    id: `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    ...draft,
  });
  if (!entry) return loadBatteryLog(storage);
  const next = [...loadBatteryLog(storage), entry];
  saveBatteryLog(next, storage);
  return loadBatteryLog(storage);
}

export function removeBatteryEntry(id: string, storage?: Storage | null): BatteryLogEntry[] {
  const next = loadBatteryLog(storage).filter((e) => e.id !== id);
  saveBatteryLog(next, storage);
  return next;
}

export function batteryModeLabel(mode: BatteryModeId): string {
  return BATTERY_MODES.find((m) => m.id === mode)?.label ?? mode;
}
