/**
 * SPEAKER SEPARATION (Part 13, owner order 2026-11-21) — the
 * analytical side of the conversation is kept APART per voice:
 *
 * - The OPERATOR's voiceprint lives in the voice-calibration system
 *   (WeSpeaker, on this machine's speech service). It stays his alone.
 * - Any OTHER voice is stored by the service in its own separate
 *   store — labeled "Speaker 2", "Speaker 3" — one label per distinct
 *   voice (embedding-clustered in the service).
 * - NO identity claims: no names guessed, no facial recognition, and
 *   another speaker's data is NEVER merged into the operator profile.
 * - What the service keeps for other voices is embeddings and
 *   transcripts only — raw audio is never retained. When no voiceprint
 *   is enrolled, separation cannot run and the service says so
 *   (state "not-enrolled") rather than guessing speakers.
 *
 * This module is the app-side contract for the service's
 * /speakers/others endpoint: the shapes, the parser, and the summary
 * math the panel renders. The embedding math runs in the speech
 * service (speaker.py / listening.py on the Parrot); what lands here
 * is labels, scores and transcripts, kept apart by construction.
 */

export interface OtherVoiceEntry {
  /** ISO timestamp from the service. */
  timestamp: string | null;
  label: string;
  /** Cosine similarity vs the operator's voiceprint (below the gate
   *  threshold by construction — that is why the line landed here). */
  similarity: number | null;
  transcript: string;
  durationS: number | null;
}

export interface OtherSpeakerSummary {
  label: string;
  utterances: number;
  firstHeard: string | null;
  lastHeard: string | null;
}

export type SeparationState = "ready" | "not-enrolled" | "unavailable";

export interface OtherVoicesView {
  enrolled: boolean;
  separationAvailable: boolean;
  state: SeparationState;
  /** The service's own words on what it keeps. */
  kept: string;
  entries: OtherVoiceEntry[];
  speakers: OtherSpeakerSummary[];
}

export const OPERATOR_LABEL = "Operator";

/** A label the other-voices store may carry — the operator's label is
 *  never one of them. */
export function isOtherSpeakerLabel(label: string): boolean {
  return /^Speaker \d+$/.test(label);
}

/** Parse the service's /speakers/others payload; null on a shape the
 *  contract does not promise. Entries without a valid other-speaker
 *  label are dropped — operator speech never renders in this store. */
export function parseOtherVoices(payload: unknown): OtherVoicesView | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const state: SeparationState =
    p["state"] === "ready" || p["state"] === "not-enrolled" || p["state"] === "unavailable"
      ? p["state"]
      : p["enrolled"] === true
        ? "ready"
        : "not-enrolled";
  const entries: OtherVoiceEntry[] = [];
  for (const raw of Array.isArray(p["entries"]) ? p["entries"] : []) {
    if (typeof raw !== "object" || raw === null) continue;
    const e = raw as Record<string, unknown>;
    if (typeof e["label"] !== "string" || !isOtherSpeakerLabel(e["label"])) continue;
    entries.push({
      timestamp: typeof e["timestamp"] === "string" ? e["timestamp"] : null,
      label: e["label"],
      similarity: typeof e["similarity"] === "number" ? e["similarity"] : null,
      transcript: typeof e["transcript"] === "string" ? e["transcript"] : "",
      durationS: typeof e["duration_s"] === "number" ? e["duration_s"] : null,
    });
  }
  const speakers: OtherSpeakerSummary[] = [];
  for (const raw of Array.isArray(p["speakers"]) ? p["speakers"] : []) {
    if (typeof raw !== "object" || raw === null) continue;
    const s = raw as Record<string, unknown>;
    if (typeof s["label"] !== "string" || !isOtherSpeakerLabel(s["label"])) continue;
    speakers.push({
      label: s["label"],
      utterances: typeof s["utterances"] === "number" ? s["utterances"] : 0,
      firstHeard: typeof s["firstHeard"] === "string" ? s["firstHeard"] : null,
      lastHeard: typeof s["lastHeard"] === "string" ? s["lastHeard"] : null,
    });
  }
  return {
    enrolled: p["enrolled"] === true,
    separationAvailable: p["separationAvailable"] === true,
    state,
    kept:
      typeof p["kept"] === "string"
        ? p["kept"]
        : "embeddings and transcripts only — raw audio is never retained",
    entries,
    speakers,
  };
}

/** Per-label summary derived from entries alone — used when a view
 *  carries entries but no service summary, and unit-tested as the
 *  counting rule: one label, its utterance count, first and last. */
export function summarizeOtherVoices(entries: readonly OtherVoiceEntry[]): OtherSpeakerSummary[] {
  const byLabel = new Map<string, OtherSpeakerSummary>();
  for (const entry of entries) {
    if (!isOtherSpeakerLabel(entry.label)) continue;
    const found = byLabel.get(entry.label);
    if (found) {
      found.utterances += 1;
      found.lastHeard = entry.timestamp ?? found.lastHeard;
    } else {
      byLabel.set(entry.label, {
        label: entry.label,
        utterances: 1,
        firstHeard: entry.timestamp,
        lastHeard: entry.timestamp,
      });
    }
  }
  return [...byLabel.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
}

/** The honest panel line for each separation state. */
export function separationStateText(view: OtherVoicesView): string {
  if (view.state === "not-enrolled") {
    return "Speaker separation is not running: no operator voiceprint is enrolled, so voices are not being told apart or stored. Enroll your voice in Voice Calibration first.";
  }
  if (view.state === "unavailable") {
    return "Speaker separation is unavailable: the speech service's speaker model did not answer.";
  }
  return "Separation is running: voices that are not the operator's are kept in their own labeled stores below.";
}
