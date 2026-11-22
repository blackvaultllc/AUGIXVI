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
 * COMMAND STRUCTURE: AMUN-RA is over the Captain — the top seat of
 * the system, over the whole stage. Captain Infinity is at the top
 * of the command he runs. ANUBIS is in overall command — the
 * medallion face the Captain talks with day to day. MONTU, the
 * falcon war god, is commander of the army under Anubis — cyber
 * security defense, the avatar the Captain sends out. OSIRIS is
 * the AUGI construct core — the movable sand-code figure — under
 * Anubis's command.
 *
 * CAPTAIN'S PORTRAIT: registered here as the owner's medallion asset
 * and copied byte-for-byte into the app. PLACEMENT (his call, made
 * 2026-11-22): it stands at center stage as the Black Hatter — the
 * default presence of the whole stage (see BLACK_HATTER_BINDING
 * below and BlackHatterPresence.tsx).
 */
export const ANUBIS_PORTRAIT_SRC = "/anubis-presence/face.webp";
export const CAPTAIN_INFINITY_PORTRAIT_SRC = "/owner-presence/captain-infinity.webp";
export const MONTU_PORTRAIT_SRC = "/montu-presence/face.webp";
/**
 * Amun-Ra's portrait, by the same convention as every other
 * medallion: the Captain's pick (2026-11-22, option 3 — "the most
 * ancient of the ancient": ram horns with the sun disc between
 * them, a weathered ancient face), copied byte-for-byte into the
 * app. His seat is a record in the presence layer, not a station
 * on the stage — the face completes the binding; it does not put
 * him in the perspective rotation.
 */
export const AMUN_RA_PORTRAIT_SRC = "/amun-ra-presence/face.webp";

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
  /** No body artwork yet — head perspective only (presenceView.ts). */
  body: undefined,
} as const;

/**
 * ANUBIS — IN OVERALL COMMAND. The command face the Captain talks
 * with day to day; Khadija chose his portrait (antique gold, the
 * broad blue-and-gold collar, on black). His binding sits in the
 * same registry as every other medallion — the roster the pantheon
 * joins, one named binding at a time.
 */
export const ANUBIS_BINDING = {
  id: "anubis",
  name: "Anubis",
  /** In overall command of the stage, under Amun-Ra and the Captain. */
  role: "command — in overall command",
  roleLabel: "Command",
  portrait: ANUBIS_PORTRAIT_SRC,
  /** No body artwork yet — head perspective only (presenceView.ts). */
  body: undefined,
} as const;

/**
 * MONTU — COMMANDER OF THE ARMY (owner pick 2026-11-22).
 *
 * Montu, the falcon war god, is the avatar Domenick SENDS OUT:
 * defense operations, the Bluetooth and Wi-Fi work — the smartest
 * in that department. He commands the army of cyber security
 * defense, and he operates UNDER Anubis, who remains in overall
 * command of the stage.
 *
 * The binding is permanent (picture↔name, house law): the falcon
 * portrait the Captain picked is Montu's face — registered here and
 * copied byte-for-byte into the app at /montu-presence/face.webp.
 * No other face may be substituted for it.
 */
export const MONTU_BINDING = {
  id: "montu",
  name: "Montu",
  /** Commander of the army — cyber security defense, under Anubis. */
  role: "commander of the army — cyber security defense",
  roleLabel: "Commander",
  portrait: MONTU_PORTRAIT_SRC,
  /** No body artwork yet — head perspective only (presenceView.ts). */
  body: undefined,
} as const;

/**
 * AMUN-RA — THE TOP SEAT (owner doctrine 2026-11-22).
 *
 * Amun-Ra, god of the sun — god of raw existence between night and
 * day — is OVER THE CAPTAIN in the system. His seat is the top of
 * the presence hierarchy, above the operator/owner: he is not a
 * station the Captain opens and closes like the others; he is over
 * the whole stage. (See TOP_SEAT in stagePerspective.ts.)
 *
 * HIS DOMAIN IS PROTECTION: god of all protection — legal
 * protection, disclaimers, everything protected. THE RULE, which
 * every protection feature in this app inherits: every protection
 * carries a reason; without good reason there is no protection at
 * all.
 *
 * The binding is permanent (picture↔name, house law): the ram-horn
 * portrait the Captain picked — option 3, "the most ancient of the
 * ancient," the sun disc between the horns over a weathered ancient
 * face — is Amun-Ra's face, copied byte-for-byte into the app at
 * AMUN_RA_PORTRAIT_SRC. The binding is complete with its face.
 */
export const AMUN_RA_BINDING = {
  id: "amun-ra",
  name: "Amun-Ra",
  /** God of the sun — god of raw existence between night and day. */
  role: "god of the sun — god of raw existence between night and day",
  roleLabel: "God of the Sun",
  /** His domain: protection in every form the system offers it. */
  domain: "protection — god of all protection: legal protection, disclaimers, everything protected",
  /**
   * THE PROTECTION RULE: every protection carries a reason; without
   * good reason there is no protection at all. Any future protection
   * feature in this app inherits this rule from this record.
   */
  protectionRule:
    "Every protection carries a reason; without good reason there is no protection at all.",
  portrait: AMUN_RA_PORTRAIT_SRC,
  /** Picked 2026-11-22 (option 3) and copied into the app — bound. */
  portraitStatus: "bound",
  /** No body artwork yet — head perspective only (presenceView.ts). */
  body: undefined,
} as const;

/**
 * THE MUMMY GUARDIAN — SECURITY, THE INTRUDER DETERRENT (owner
 * order 2026-11-22). Not a stage medallion and not a god of the
 * pantheon: the mummy guardians stand at the OPERATOR GATE. When an
 * unauthorized attempt hits the gate — a failed sign-in, an account
 * the registry denies, a verification code refused — the denial
 * surface shows the guardian: the scare face for intruders, serious,
 * never playful. The principle behind it is the maze: they get
 * lost, they don't get in.
 *
 * The slot lives on the gate's denial surface only (OperatorGate +
 * MummyGuardian.tsx); the sign-in flow itself is untouched. THE SET
 * (owner confirmation 2026-11-22): three guardian portraits, copied
 * byte-for-byte into the app, shown as a ROTATING deterrent set —
 * each denial raises the next guardian in the rotation.
 */
export const MUMMY_GUARDIAN_PORTRAIT_SRC = "/mummy-guardian-presence/guardian-1.webp";

/** The rotating deterrent set, in rotation order. */
export const MUMMY_GUARDIAN_SET = [
  "/mummy-guardian-presence/guardian-1.webp",
  "/mummy-guardian-presence/guardian-2.webp",
  "/mummy-guardian-presence/guardian-3.webp",
] as const;

export const MUMMY_GUARDIAN_BINDING = {
  id: "mummy-guardian",
  name: "Mummy Guardian",
  /** Security — the intruder deterrent at the operator gate. */
  role: "security — intruder deterrent at the operator gate",
  roleLabel: "Guardian",
  /** Where it stands: the gate's denial surface, nowhere else. */
  domain: "the operator gate denial surface — the maze principle: intruders get lost, they don't get in",
  portrait: MUMMY_GUARDIAN_PORTRAIT_SRC,
  /** The rotating set of three guardian faces. */
  guardians: MUMMY_GUARDIAN_SET,
  /** All three portraits supplied 2026-11-22 and copied in — bound. */
  portraitStatus: "bound",
  /** A deterrent face, not an avatar — no body perspective. */
  body: undefined,
} as const;
