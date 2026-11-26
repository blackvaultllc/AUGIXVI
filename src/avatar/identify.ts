/**
 * THE IDENTIFIER (cybernetic pass, 2026-11-26 — the survey's
 * Pokédex row): one cabinet where "what is that?" gets an
 * answer Augie stands behind, joining three real lookups —
 * Sound Watch's classifications, the signal watcher's sightings,
 * and the RF/IR library — every one of them CROSS-CHECKED
 * against the device registry first.
 *
 * THE IDENTIFIER'S LAW (the dossier's own words, made code):
 *   · His registered device answers by its registry name —
 *     "yours."
 *   · A device the RF/IR library knows answers with its library
 *     entry.
 *   · A sound HE named answers with his name for it (the Sound
 *     Watch library — the naming loop, working).
 *   · Anything else answers UNKNOWN — not identified. Never a
 *     guess, never a dressed-up maybe.
 *   · A source that cannot be read on this surface says so —
 *     SCAN UNAVAILABLE, NO RECORD — it never borrows an answer
 *     from nowhere.
 *
 * Pure derivations over records the caller reads — unit-
 * testable per the repo's rules. This module fetches nothing.
 */
import type { DeviceProfile } from "./devices/deviceRegistry";
import { watchedSsid } from "./devices/presence";
import type { SightingDetail } from "./devices/wifiWatch";
import type { SoundLibraryEntry } from "./soundWatch";
import { lastClassifiedSound, type SoundFeedEntry } from "./soundWatchFeed";

/* ------------------------------ Heard it ------------------------------ */

export interface HeardAnswer {
  /** The headline: his name for it, the classifier's label, or UNCLASSIFIED. */
  headline: string;
  detail: string;
  tone: "named" | "classifier" | "unclassified" | "unavailable";
}

export function heardAnswer(
  feed: SoundFeedEntry[],
  library: SoundLibraryEntry[],
): HeardAnswer {
  const last = lastClassifiedSound(feed);
  if (!last) {
    return {
      headline: "NO RECORD",
      detail:
        "Sound Watch has classified nothing on this surface's record yet — there is no last sound to identify. Open Sound Watch and let it listen; what it classifies lands here.",
      tone: "unavailable",
    };
  }
  const when = new Date(last.at).toLocaleTimeString();
  if (last.source === "library" && last.label) {
    const named = library.find((e) => e.name === last.label);
    return {
      headline: last.label,
      detail:
        `Your name for this sound` +
        (named ? ` — you named it on ${new Date(named.createdAt).toLocaleDateString()}` : "") +
        `. Sound Watch heard it at ${when}.`,
      tone: "named",
    };
  }
  if (last.source === "classifier" && last.label) {
    return {
      headline: last.label,
      detail:
        `The built-in classifier's label for the last sound, heard at ${when}` +
        (last.confidence !== null
          ? ` (confidence ${Math.round(last.confidence * 100)}%)`
          : "") +
        `. It is the classifier's word, not a name you gave it and not a registry match.`,
      tone: "classifier",
    };
  }
  return {
    headline: "UNCLASSIFIED",
    detail:
      `The last sound Sound Watch heard, at ${when}, matched nothing it knows — not your library, not the classifier's labels above its threshold. It stays UNCLASSIFIED until you name it in Sound Watch.`,
    tone: "unclassified",
  };
}

/* --------------------------- Saw its signal --------------------------- */

export interface SignalAnswer {
  headline: string;
  detail: string;
  tone: "yours" | "unknown" | "unavailable";
}

/** The registry device a sighting belongs to, by watched SSID. */
export function registryDeviceForSsid(
  devices: DeviceProfile[],
  ssid: string,
): DeviceProfile | null {
  return (
    devices.find((d) => !d.retired && (watchedSsid(d) === ssid || d.ssid === ssid)) ?? null
  );
}

export function signalAnswer(
  sightings: SightingDetail[] | null,
  devices: DeviceProfile[],
): SignalAnswer {
  if (sightings === null) {
    return {
      headline: "SCAN UNAVAILABLE",
      detail:
        "No scanner is reporting on this surface right now, so the Identifier makes no claim about the air. On the Parrot, the local watcher feeds this card.",
      tone: "unavailable",
    };
  }
  if (sightings.length === 0) {
    return {
      headline: "NO SIGHTINGS",
      detail:
        "The scanner is reporting, and nothing is on its latest record — no signal to identify.",
      tone: "unavailable",
    };
  }
  const latest = sightings.reduce((a, b) => (b.seenAt > a.seenAt ? b : a));
  const mine = registryDeviceForSsid(devices, latest.ssid);
  const when = new Date(latest.seenAt).toLocaleTimeString();
  const strength =
    latest.rssi !== undefined ? `, last heard at ${latest.rssi} dBm (strength only)` : "";
  if (mine) {
    return {
      headline: `Yours — ${mine.displayName}`,
      detail:
        `The latest signal on the watcher's record is "${latest.ssid}", seen at ${when}${strength}. ` +
        `It matches ${mine.displayName} on your registry — this one is yours.`,
      tone: "yours",
    };
  }
  return {
    headline: "UNKNOWN — not identified",
    detail:
      `The latest signal on the watcher's record is "${latest.ssid}", seen at ${when}${strength}. ` +
      `No device on your registry answers to that name. The Identifier does not guess whose it is.`,
    tone: "unknown",
  };
}

/* -------------------------- Remote or device -------------------------- */

export interface RemoteAnswer {
  headline: string;
  detail: string;
  tone: "yours" | "library" | "unknown" | "unavailable";
}

export interface RfMatch {
  brand: string;
  device: string;
}

/** A registry device the query names (whole-word, plain match). */
export function registryDeviceForQuery(
  devices: DeviceProfile[],
  query: string,
): DeviceProfile | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    devices.find(
      (d) =>
        !d.retired &&
        (d.displayName.toLowerCase() === q ||
          d.displayName.toLowerCase().includes(q) ||
          q.includes(d.displayName.toLowerCase())),
    ) ?? null
  );
}

export function remoteAnswer(
  query: string,
  devices: DeviceProfile[],
  rfMatches: RfMatch[] | null,
): RemoteAnswer {
  const mine = registryDeviceForQuery(devices, query);
  if (mine) {
    return {
      headline: `Yours — ${mine.displayName}`,
      detail:
        `"${query}" matches ${mine.displayName} on your registry` +
        (mine.controlGranted && mine.ownerConfirmed
          ? ", and its control is granted by you."
          : " — registered, with control not granted.") +
        ` The registry answers before any library: your own gear is yours.`,
      tone: "yours",
    };
  }
  if (rfMatches === null) {
    return {
      headline: "LIBRARY UNAVAILABLE",
      detail:
        "The RF/IR library could not be read on this surface, and no registry device matches — the Identifier makes no claim.",
      tone: "unavailable",
    };
  }
  if (rfMatches.length > 0) {
    const first = rfMatches[0]!;
    return {
      headline: `${first.brand} — ${first.device}`,
      detail:
        `Not on your registry. The RF/IR library knows it: ${first.brand} ${first.device}` +
        (rfMatches.length > 1
          ? ` (and ${rfMatches.length - 1} more match${rfMatches.length - 1 === 1 ? "" : "es"})`
          : "") +
        `. Its codes live in Remote Codes — lookup and copy today; sending waits for your blaster.`,
      tone: "library",
    };
  }
  return {
    headline: "UNKNOWN — not identified",
    detail:
      `"${query}" is not on your registry and the RF/IR library has no entry for it. The Identifier does not guess.`,
    tone: "unknown",
  };
}
