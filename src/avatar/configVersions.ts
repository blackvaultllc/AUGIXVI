/**
 * CONFIG VERSIONS (Part 17, owner order 2026-11-21) — "I want this
 * version right here": the FULL avatar configuration (the same
 * settings system as Part 14 — src/avatar/settings.ts) saved under a
 * name, restorable in one click. Versions live in this browser's
 * localStorage beside the settings themselves; restoring writes
 * through the same persist path as any settings change, so a restored
 * version sticks exactly like a hand-set one. Nothing here touches
 * keys, credentials, or server state — those are NOT settings and are
 * deliberately left out of Anatomy (see AnatomyWindow).
 */
import type { AvatarSettings } from "./settings";

export const CONFIG_VERSIONS_KEY = "augi.config-versions.v1";
export const MAX_CONFIG_VERSIONS = 20;

export interface ConfigVersion {
  name: string;
  savedAt: number;
  settings: AvatarSettings;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadConfigVersions(): ConfigVersion[] {
  const store = storage();
  if (!store) return [];
  try {
    const parsed: unknown = JSON.parse(store.getItem(CONFIG_VERSIONS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is ConfigVersion =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as ConfigVersion).name === "string" &&
        typeof (v as ConfigVersion).savedAt === "number" &&
        typeof (v as ConfigVersion).settings === "object" &&
        (v as ConfigVersion).settings !== null,
    );
  } catch {
    return [];
  }
}

function persist(versions: ConfigVersion[]) {
  storage()?.setItem(CONFIG_VERSIONS_KEY, JSON.stringify(versions.slice(0, MAX_CONFIG_VERSIONS)));
}

/** Save the current configuration under a name (same name overwrites
 *  that version — it is a new save of the same named slot). */
export function saveConfigVersion(name: string, settings: AvatarSettings, at = Date.now()): ConfigVersion[] {
  const clean = name.trim();
  if (!clean) return loadConfigVersions();
  const rest = loadConfigVersions().filter((v) => v.name !== clean);
  const versions = [{ name: clean, savedAt: at, settings: { ...settings } }, ...rest];
  persist(versions);
  return versions;
}

export function deleteConfigVersion(name: string): ConfigVersion[] {
  const versions = loadConfigVersions().filter((v) => v.name !== name);
  persist(versions);
  return versions;
}

export function findConfigVersion(name: string): ConfigVersion | undefined {
  return loadConfigVersions().find((v) => v.name === name);
}
