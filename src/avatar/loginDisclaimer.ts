/**
 * THE LOGIN DISCLAIMER — the plain words standing on the login
 * page (Captain's order, main chat 2026-11-26 ~14:25 CST; the
 * substance was approved by him in the main chat).
 *
 * The text lives in ONE named constant — LOGIN_DISCLAIMER — so
 * an exact-text swap later is a one-line change. The gate build
 * (Montu at the gate, mic + camera, the attempt snapshot)
 * renders these same words; there is no second copy to drift.
 *
 * Plain TS, no I/O.
 */

export interface LoginDisclaimer {
  title: string;
  lines: string[];
}

export const LOGIN_DISCLAIMER: LoginDisclaimer = {
  title: "Authorized access only",
  lines: [
    "This system is private. Only the people its owner has authorized may sign in here.",
    "By attempting to sign in, you agree that your camera and microphone will be turned on, and that a photograph of you will be recorded with the time of the attempt — whether you get in or not.",
    "Every attempt to enter — authorized or not — is logged and preserved on the record.",
    "If you are not authorized to be here, leave now.",
  ],
};

/** The disclaimer as one flat text block, for logs and plain-text surfaces. */
export const LOGIN_DISCLAIMER_TEXT: string = [
  LOGIN_DISCLAIMER.title,
  ...LOGIN_DISCLAIMER.lines,
].join("\n");
