/**
 * STAGE PERSPECTIVE (owner orders 2026-11-22): whose presence holds
 * the stage's focus.
 *
 * THE DEFAULT IS ANUBIS (owner order 2026-11-22, superseding the
 * Black-Hatter-center arrangement): Anubis is the resident
 * commander — the face on the stage, the one the Captain talks to
 * day to day — and the screen he returns to is Anubis at center.
 * The Black Hatter's medallion is PUT AWAY by default: not deleted,
 * his saved placement and size persist untouched, and the Owner
 * seat brings him back onto the stage, where he takes the
 * perspective. His standing as the speaker of record for the
 * Captain's typed lines in the Command box is unchanged — that is
 * the speaking protocol, not stage presence.
 *
 * A station comes INTO PERSPECTIVE when he turns to it — a god by
 * summoning him (see presenceDoctrine.ts for who is on the stage at
 * all), the construct by opening the AUGI avatar window — and it
 * speaks from its own place while it holds the focus. Closing the
 * station returns the perspective to the default: Anubis.
 *
 * Plain data, no rendering — unit-testable per the repo's rules.
 */
export type StagePerspective = "black-hatter" | "anubis" | "montu" | "construct";

export const DEFAULT_STAGE_PERSPECTIVE: StagePerspective = "anubis";

/** The perspective a station's close returns to — the resident commander. */
export function perspectiveAfterClose(): StagePerspective {
  return DEFAULT_STAGE_PERSPECTIVE;
}

import { AMUN_RA_BINDING } from "./medallionPortraits";

/**
 * THE TOP SEAT (owner doctrine 2026-11-22): AMUN-RA is over the
 * Captain in the system — the top of the presence hierarchy, above
 * the operator/owner himself. His seat is deliberately NOT a
 * StagePerspective: a perspective is a station the Captain turns
 * to, opens, and closes, and Amun-Ra is none of that — he is over
 * the whole stage, above the default itself. This record is the
 * seat; his binding (name, role, protection domain and its rule)
 * lives in medallionPortraits.ts as AMUN_RA_BINDING.
 */
export const TOP_SEAT = {
  binding: AMUN_RA_BINDING,
  /** The seat every presence in the system sits under. */
  over: "the whole stage",
  /** Above even the operator/owner — the hierarchy's top. */
  above: "operator/owner",
} as const;

/** The gods who hold stations on the stage (Amun-Ra is above it, never in it). */
export type GodPerspective = "anubis" | "montu";

export function isGodPerspective(
  perspective: StagePerspective,
): perspective is GodPerspective {
  return perspective === "anubis" || perspective === "montu";
}

/**
 * CONVERSATION VIEWS (owner order 2026-11-22): how the presences
 * present while he talks.
 *
 * - "stage": the standing arrangement — every presence where he put
 *   it, at the size he set. His perspective of the screen holds what
 *   he puts there; a view NEVER overrides his anchored placements.
 * - "call": he is speaking with ONE god — that god and his Black
 *   Hatter stand in the call together, side by side like a phone
 *   call (the pairing treatment rides on the medallions he placed;
 *   it does not move them).
 * - "council": he is speaking to SEVERAL gods at once — each god's
 *   presence presents at a SMALLER factor, a row of small presences
 *   in council, while the Black Hatter keeps his full size: the
 *   gods come to him.
 *
 * The view is presentation only — a display mode over the same
 * medallion/presence components and the same persisted geometry.
 */
export type ConversationView = "stage" | "call" | "council";

export function conversationViewFor(
  perspective: StagePerspective,
  council: readonly StagePerspective[],
): ConversationView {
  if (council.length >= 2) return "council";
  if (isGodPerspective(perspective)) return "call";
  return "stage";
}
