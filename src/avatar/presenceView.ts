/**
 * HEAD OR BODY (owner order 2026-11-22): every avatar carries two
 * perspectives — HEAD and BODY — switchable, the way the construct
 * already holds a full-body mode (ConstructControls' body hold).
 * The presence/binding model carries it as a view field plus an
 * OPTIONAL body asset per binding:
 *
 * - A binding WITH a body asset offers both views; the switch works.
 * - A binding WITHOUT one is HEAD ONLY — no switch is offered, and
 *   a saved "body" choice falls back to head. Body artwork is a
 *   separate production line; no body is ever invented in code.
 *
 * As of this wiring, none of the medallion bindings (the Black
 * Hatter, Anubis, Montu, Amun-Ra) has a body asset in the repo —
 * all are head-only, pending body artwork. The construct (Osiris)
 * holds the one working body perspective, in his own system.
 *
 * Plain data + persistence, unit-testable per the repo's rules.
 */
export type PresenceView = "head" | "body";

/** The shape of a binding as far as views are concerned. */
export interface ViewableBinding {
  id: string;
  /** Full-body artwork, when the avatar has any. Absent = head only. */
  body?: string | undefined;
}

export function presenceViewStorageKey(id: string): string {
  return `augi.avatar.presence-view.${id}.v1`;
}

/** The views an avatar actually offers — body only with a body asset. */
export function availablePresenceViews(binding: ViewableBinding): PresenceView[] {
  return binding.body ? ["head", "body"] : ["head"];
}

/** The view that can really be shown: body requires the body asset. */
export function effectivePresenceView(
  binding: ViewableBinding,
  requested: PresenceView,
): PresenceView {
  return requested === "body" && binding.body ? "body" : "head";
}

export function loadPresenceView(id: string): PresenceView {
  try {
    return globalThis.localStorage?.getItem(presenceViewStorageKey(id)) === "body"
      ? "body"
      : "head";
  } catch {
    return "head";
  }
}

export function savePresenceView(id: string, view: PresenceView) {
  try {
    globalThis.localStorage?.setItem(presenceViewStorageKey(id), view);
  } catch {
    // best effort only
  }
}
