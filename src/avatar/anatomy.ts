/**
 * AUGI ANATOMY (Part 17, operator order 2026-11-21) — the map of
 * Augie's own systems and the versioning of his configuration.
 *
 * The map is STRUCTURE: the systems Augie is built from and how
 * they connect. Live status is probed separately (AnatomyWindow) —
 * a box on the map claims only that the system exists in the build,
 * never that it is up.
 *
 * Config versions: named snapshots of the operator's settings,
 * saved and restored through the same persistence the settings
 * themselves use (Part 14) — restoring a version writes it as the
 * current settings, so it sticks exactly like any other save.
 */
import {
  loadAvatarSettings,
  sanitizeAvatarSettings,
  saveAvatarSettings,
  type AvatarSettings,
} from "./settings";

export type AnatomyNode = {
  id: string;
  label: string;
  detail: string;
  x: number;
  y: number;
};

export type AnatomyLink = { from: string; to: string };

/** The core's systems, laid out for the map (viewBox 640×400). */
export const ANATOMY_NODES: AnatomyNode[] = [
  { id: "brain", label: "Brain", detail: "Ollama — local models, SENTINEL", x: 270, y: 24 },
  { id: "vision", label: "Vision", detail: "llava:7b — picture + room analysis", x: 60, y: 24 },
  { id: "ear", label: "Ear", detail: "faster-whisper, on this machine", x: 480, y: 24 },
  { id: "voice-gate", label: "Voice Gate", detail: "WeSpeaker — his voice only", x: 480, y: 130 },
  { id: "core", label: "OSIRIS CORE", detail: "one core, one memory, one command", x: 270, y: 130 },
  { id: "providers", label: "Provider Failover", detail: "Groq → Gemini → OpenRouter → Ollama", x: 60, y: 130 },
  { id: "watcher", label: "Watcher", detail: "Wi-Fi sightings — wand, phone, Parrot radio", x: 60, y: 250 },
  { id: "library", label: "Library", detail: "offline books on this machine", x: 270, y: 250 },
  { id: "devices", label: "Devices", detail: "registry — mapped ≠ controlled", x: 480, y: 250 },
];

export const ANATOMY_LINKS: AnatomyLink[] = [
  { from: "vision", to: "core" },
  { from: "brain", to: "core" },
  { from: "ear", to: "voice-gate" },
  { from: "voice-gate", to: "core" },
  { from: "providers", to: "core" },
  { from: "watcher", to: "core" },
  { from: "library", to: "core" },
  { from: "devices", to: "core" },
  { from: "watcher", to: "devices" },
];

export type ConfigVersion = {
  name: string;
  at: number;
  settings: AvatarSettings;
};

export const CONFIG_VERSIONS_KEY = "augi.anatomy.versions.v1";
const MAX_VERSIONS = 24;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function store(storage?: StorageLike): StorageLike | null {
  try {
    return storage ?? globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadConfigVersions(storage?: StorageLike): ConfigVersion[] {
  const s = store(storage);
  if (!s) return [];
  try {
    const raw = s.getItem(CONFIG_VERSIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (v): v is ConfigVersion =>
          typeof v === "object" &&
          v !== null &&
          typeof (v as ConfigVersion).name === "string" &&
          typeof (v as ConfigVersion).at === "number" &&
          typeof (v as ConfigVersion).settings === "object",
      )
      .map((v) => ({ name: v.name, at: v.at, settings: sanitizeAvatarSettings(v.settings) }));
  } catch {
    return [];
  }
}

export function saveConfigVersion(
  name: string,
  settings: AvatarSettings,
  now: number,
  storage?: StorageLike,
): ConfigVersion[] {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return loadConfigVersions(storage);
  const versions = loadConfigVersions(storage).filter((v) => v.name !== trimmed);
  versions.unshift({ name: trimmed, at: now, settings: sanitizeAvatarSettings(settings) });
  const capped = versions.slice(0, MAX_VERSIONS);
  const s = store(storage);
  try {
    s?.setItem(CONFIG_VERSIONS_KEY, JSON.stringify(capped));
  } catch {
    // A failed save never blocks the operator.
  }
  return capped;
}

/** Restore a saved version as the current settings. False if absent. */
export function restoreConfigVersion(name: string, storage?: StorageLike): boolean {
  const version = loadConfigVersions(storage).find((v) => v.name === name);
  if (!version) return false;
  return saveAvatarSettings(version.settings, storage);
}

/** Snapshot the CURRENT settings under a name. */
export function snapshotCurrentAs(name: string, now: number, storage?: StorageLike): ConfigVersion[] {
  return saveConfigVersion(name, loadAvatarSettings(storage), now, storage);
}
