/**
 * DETECTIVE VIEW — the flags (phone fix pass, owner order
 * 2026-11-27, from his Top 100 list #53): the Battle Room's
 * named view over a lens's live picture — thermal-look and
 * night-vision display layers, and the FLAGS: the real Sector
 * Watch events standing against that camera, read off the
 * sector record and nothing else.
 *
 * The truth law governs the flags absolutely: a flag exists
 * only where a Sector Watch event exists (an event itself
 * stands only where a second look confirmed the first — see
 * sectorWatch.ts). A weapon event raises the WEAPON FLAG; a
 * no-access person event raises the NEW FACE flag (a person
 * the household enrollment does not clear — until faces are
 * enrolled the record says so plainly, and this module never
 * calls anyone recognized who is not). No event, no flag.
 *
 * The display layers are labeled for what they are: this
 * camera has no thermal sensor, so "thermal" here is a
 * false-color treatment of the visible picture — a viewing
 * aid, never a heat reading. The component says so on its
 * face; this module names the modes so the words stay exact.
 *
 * Plain data — unit-testable per the repo's rules.
 */
import type { SectorEvent } from "./sectorWatch";

export type DetectiveMode = "off" | "night" | "thermal";

export const DETECTIVE_MODES: readonly { id: DetectiveMode; label: string; truth: string }[] = [
  { id: "off", label: "Plain view", truth: "The camera's picture as it comes." },
  {
    id: "night",
    label: "Night vision",
    truth: "A brightened green view of the same visible picture — a display treatment, not a new sensor.",
  },
  {
    id: "thermal",
    label: "Thermal-look",
    truth:
      "False color over the visible picture. This camera has NO thermal sensor — this is not a heat reading and never claims one.",
  },
];

export interface DetectiveFlag {
  /** The sector event this flag stands on — the record itself. */
  eventId: string;
  kind: "weapon" | "new-face" | "threat" | "vehicle";
  label: string;
  at: number;
  /** Unacknowledged flags lead — they are the ones still asking for his eyes. */
  acknowledged: boolean;
  summary: string;
}

/**
 * The flags standing against one camera, newest first,
 * unacknowledged ahead of acknowledged. Kind mapping, from
 * the sector record's own kinds:
 * - "weapon" → WEAPON FLAG (top tier, as ever)
 * - "bedroom-no-access" → NEW FACE — a person the enrollment
 *   does not clear
 * - "front-threat" → THREAT
 * - "front-truck" → VEHICLE AT THE TRUCK
 */
export function detectiveFlagsForCamera(events: SectorEvent[], cameraId: string): DetectiveFlag[] {
  const flags: DetectiveFlag[] = [];
  for (const event of events) {
    if (event.cameraId !== cameraId) continue;
    switch (event.kind) {
      case "weapon":
        flags.push({ eventId: event.id, kind: "weapon", label: "WEAPON FLAG", at: event.at, acknowledged: event.acknowledged, summary: event.summary });
        break;
      case "bedroom-no-access":
        flags.push({ eventId: event.id, kind: "new-face", label: "NEW FACE — NOT ENROLLED", at: event.at, acknowledged: event.acknowledged, summary: event.summary });
        break;
      case "front-threat":
        flags.push({ eventId: event.id, kind: "threat", label: "THREAT FLAG", at: event.at, acknowledged: event.acknowledged, summary: event.summary });
        break;
      case "front-truck":
        flags.push({ eventId: event.id, kind: "vehicle", label: "VEHICLE AT THE TRUCK", at: event.at, acknowledged: event.acknowledged, summary: event.summary });
        break;
    }
  }
  flags.sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    return b.at - a.at;
  });
  return flags;
}
