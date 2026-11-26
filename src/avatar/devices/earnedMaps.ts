/**
 * EARNED MAPS (cybernetic pass, 2026-11-26 — the survey's Mega
 * Man row, kept honest): every control map in this system was
 * EARNED from a real device — a profile bound to a card, or a
 * map generated from a card's own control entries — the way the
 * dog's map was earned from the dog. This shelf reads the
 * registry and the profiles AS THEY STAND and shows one card
 * per earned class:
 *
 *   · the class name (the profile's own deviceClass words),
 *   · the device it was earned from,
 *   · when it was earned (that device's first-seen record),
 *   · its standing: ACTIVE (a live device carries it) or
 *     TEMPLATE (every device that carried it is retired — the
 *     map stays as the worked example for the next device of
 *     its class; the sold dog's profile reads exactly this).
 *
 * A class with no device behind it does not appear — a map
 * nobody earned is not on the shelf. Nothing here is stored;
 * the shelf is re-derived from the records on every read, so
 * it can never claim a map the registry doesn't hold.
 */
import { resolveStateProfile, type DeviceCoreState } from "./deviceStoreCore";

export interface EarnedMap {
  profileId: string;
  /** The profile's name ("Wepwawet — BLE broadcast dog"). */
  profileName: string;
  /** The class of device, in the profile's plain words. */
  className: string;
  /** The device this map was earned from (the earliest carrier). */
  earnedFrom: string;
  /** When it was earned — the carrier device's first-seen time. */
  earnedAt: number;
  standing: "active" | "template";
  /** For a TEMPLATE: when its last carrier was retired. */
  retiredAt?: number | undefined;
}

export function earnedMaps(state: DeviceCoreState): EarnedMap[] {
  const byProfile = new Map<
    string,
    {
      profileName: string;
      className: string;
      earnedFrom: string;
      earnedAt: number;
      anyLive: boolean;
      lastRetiredAt: number | undefined;
    }
  >();
  for (const device of state.registry) {
    const resolved = resolveStateProfile(state, device);
    if (!resolved) continue;
    const { profile } = resolved;
    const existing = byProfile.get(profile.id);
    const retiredAt = device.retired?.at;
    if (!existing) {
      byProfile.set(profile.id, {
        profileName: profile.name,
        className: profile.deviceClass,
        earnedFrom: device.displayName,
        earnedAt: device.firstSeen,
        anyLive: !device.retired,
        lastRetiredAt: retiredAt,
      });
      continue;
    }
    if (device.firstSeen < existing.earnedAt) {
      existing.earnedAt = device.firstSeen;
      existing.earnedFrom = device.displayName;
    }
    if (!device.retired) existing.anyLive = true;
    if (retiredAt !== undefined) {
      existing.lastRetiredAt = Math.max(existing.lastRetiredAt ?? 0, retiredAt);
    }
  }
  const maps: EarnedMap[] = [...byProfile.entries()].map(([profileId, m]) => ({
    profileId,
    profileName: m.profileName,
    className: m.className,
    earnedFrom: m.earnedFrom,
    earnedAt: m.earnedAt,
    standing: m.anyLive ? "active" : "template",
    retiredAt: m.anyLive ? undefined : m.lastRetiredAt,
  }));
  // Active maps first (the living shelf), then by earning date.
  return maps.sort((a, b) =>
    a.standing !== b.standing
      ? a.standing === "active"
        ? -1
        : 1
      : a.earnedAt - b.earnedAt,
  );
}

/** The shelf's counts line, counted from the same derivation. */
export function earnedMapsLine(maps: EarnedMap[]): string {
  const active = maps.filter((m) => m.standing === "active").length;
  const templates = maps.length - active;
  if (maps.length === 0) return "No control maps earned yet.";
  return (
    `${maps.length} control map${maps.length === 1 ? "" : "s"} earned` +
    ` — ${active} active, ${templates} template${templates === 1 ? "" : "s"}`
  );
}
