/**
 * MEDALLION PORTRAITS — the stage's portrait standard and command
 * structure (owner orders 2026-11-22).
 *
 * PORTRAIT STANDARD: AI faces on this page use circular medallion
 * portraits — gold and deep blue on black, front-facing — with the
 * same living, talking-portrait treatment later extended to game
 * characters. Each face keeps its own portrait; one face is never
 * substituted for another.
 *
 * COMMAND STRUCTURE: Captain Infinity is at the top. ANUBIS is the
 * commander — the medallion face the Captain talks with day to day.
 * OSIRIS is the AUGI construct core — the movable sand-code figure —
 * under Anubis's command.
 *
 * CAPTAIN'S PORTRAIT: registered here as the owner's medallion asset
 * and copied byte-for-byte into the app. PLACEMENT (his call, made
 * 2026-11-22): it stands at center stage as the Black Hatter — the
 * default presence of the whole stage (see BLACK_HATTER_BINDING
 * below and BlackHatterPresence.tsx).
 */
export const ANUBIS_PORTRAIT_SRC = "/anubis-presence/face.webp";
export const CAPTAIN_INFINITY_PORTRAIT_SRC = "/owner-presence/captain-infinity.webp";

/**
 * THE BLACK HATTER — THE OWNER'S BINDING (owner order 2026-11-22).
 *
 * The Black Hatter is Domenick himself inside the system: the face
 * he speaks with, and the face every station — Anubis, Osiris, the
 * Egyptian gods on the other pages — recognizes as HIM: the boss,
 * the owner. If ownership ever has to be identified, this face is
 * the identification.
 *
 * The binding is permanent (picture↔name, house law): the Black
 * Hatter's face is the Captain's registered portrait above — the one
 * face asset created for him and already bound to his name in this
 * registry. No other face may be substituted for it, and it is never
 * used for any other being (it is not IEM's emblem and not Anubis's
 * portrait).
 */
export const BLACK_HATTER_BINDING = {
  id: "black-hatter",
  name: "The Black Hatter",
  /** The role every presence in the system reads him by. */
  role: "operator/owner",
  roleLabel: "Owner",
  /** The man himself — the name the face is bound to. */
  person: "Domenick Arlon Hall",
  portrait: CAPTAIN_INFINITY_PORTRAIT_SRC,
} as const;
