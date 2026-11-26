/**
 * VIOLET'S DOOR — the server functions for her side of the
 * system (Captain's orders 2026-11-26).
 *
 * Two keys guard this door, and they never mix:
 *   · HER session token — opens her side only: her profile,
 *     her notepad, her calculator's records (none — it is
 *     pure), the finance records she reads, her outbox, her
 *     request button. It opens NOTHING operator-side.
 *   · The OPERATOR session — the Captain's key, for the two
 *     operator acts on her side: reading her welcome packet
 *     (the draft + whether her starting password still
 *     stands) and placing finance records on the core for
 *     her to read.
 *
 * What crosses the wire to her side never includes a password,
 * a hash, or a session secret — the view is her tools and her
 * records, and the honest state of each.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "../operatorAuth.server";
import { fileSectionRequest } from "../sectionRequestsStore.server";
import {
  getVioletStore,
  violetChangePassword,
  violetNewId,
  violetSessionValid,
  violetSignIn,
  violetSignOut,
} from "./violetStore.server";
import { sendViaSmtp } from "./violetMailTransport.server";
import {
  ledgerTotals,
  VIOLET_PROFILE,
  type FinanceRecord,
  type VioletMail,
  type VioletMailbox,
} from "./violetSide";

/* ------------------------------ inputs ------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanToken(v: unknown): string {
  return typeof v === "string" && v.length > 0 && v.length <= 128 ? v : "";
}

function cleanText(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/* --------------------------- her session view --------------------------- */

export interface VioletView {
  available: boolean;
  signedIn: boolean;
  profile: typeof VIOLET_PROFILE | null;
  usingDefaultPassword: boolean;
  notepad: string;
  financeRecords: FinanceRecord[];
  financeTotals: ReturnType<typeof ledgerTotals> | null;
  mailbox: VioletMailbox | null;
  outbox: VioletMail[];
  loginLog: { at: number; ok: boolean }[];
}

const SIGNED_OUT: VioletView = {
  available: false,
  signedIn: false,
  profile: null,
  usingDefaultPassword: false,
  notepad: "",
  financeRecords: [],
  financeTotals: null,
  mailbox: null,
  outbox: [],
  loginLog: [],
};

async function viewFor(token: string): Promise<VioletView> {
  const store = await getVioletStore();
  if (!store) return SIGNED_OUT;
  if (!(await violetSessionValid(token))) return { ...SIGNED_OUT, available: true };
  const file = await store.read();
  return {
    available: true,
    signedIn: true,
    profile: VIOLET_PROFILE,
    usingDefaultPassword: file.credential.usingDefault,
    notepad: file.notepad,
    financeRecords: file.financeRecords,
    financeTotals: ledgerTotals(file.financeRecords),
    mailbox: file.mailbox,
    outbox: file.outbox,
    loginLog: file.loginLog.slice(0, 10),
  };
}

/* ------------------------------ her door ------------------------------ */

type SignInInput = { email: string; password: string };

export const violetSignInFn = createServerFn({ method: "POST" })
  .validator((input: unknown): SignInInput => {
    if (!isRecord(input)) throw new Error("Invalid sign-in request.");
    const email = cleanText(input["email"], 160);
    const password = cleanText(input["password"], 200);
    if (!email || !password) throw new Error("Invalid sign-in request.");
    return { email, password };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; token: string; note: string }> => {
    const token = await violetSignIn(data.email, data.password);
    if (!token) {
      return {
        ok: false,
        token: "",
        note: "That email and password did not open the door. Check them and try again.",
      };
    }
    return { ok: true, token, note: "Welcome in." };
  });

type TokenInput = { token: string };

function tokenValidator(input: unknown): TokenInput {
  if (!isRecord(input)) throw new Error("Invalid request.");
  const token = cleanToken(input["token"]);
  if (!token) throw new Error("Invalid request.");
  return { token };
}

export const getVioletView = createServerFn({ method: "POST" })
  .validator(tokenValidator)
  .handler(async ({ data }): Promise<VioletView> => viewFor(data.token));

export const violetSignOutFn = createServerFn({ method: "POST" })
  .validator(tokenValidator)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await violetSignOut(data.token);
    return { ok: true };
  });

type ChangePasswordInput = { token: string; current: string; next: string };

export const violetChangePasswordFn = createServerFn({ method: "POST" })
  .validator((input: unknown): ChangePasswordInput => {
    if (!isRecord(input)) throw new Error("Invalid password request.");
    const token = cleanToken(input["token"]);
    const current = cleanText(input["current"], 200);
    const next = cleanText(input["next"], 200);
    if (!token || !current || !next) throw new Error("Invalid password request.");
    return { token, current, next };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; note: string }> => {
    const result = await violetChangePassword(data.token, data.current, data.next);
    return { ok: result.ok, note: result.reason };
  });

type NotepadInput = { token: string; text: string };

export const violetSaveNotepad = createServerFn({ method: "POST" })
  .validator((input: unknown): NotepadInput => {
    if (!isRecord(input)) throw new Error("Invalid notepad request.");
    const token = cleanToken(input["token"]);
    if (!token) throw new Error("Invalid notepad request.");
    return { token, text: cleanText(input["text"], 20_000) };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; note: string }> => {
    if (!(await violetSessionValid(data.token))) {
      return { ok: false, note: "Your session has ended — sign in again." };
    }
    const store = await getVioletStore();
    if (!store) return { ok: false, note: "Your side lives on the core machine — it is not here." };
    await store.update((file) => ({ ...file, notepad: data.text }));
    return { ok: true, note: "Saved. It will be here when you come back." };
  });

type RequestInput = { token: string; text: string };

/** Her request button's door — the same path Khadija's takes, into his notifications. */
export const violetSubmitRequest = createServerFn({ method: "POST" })
  .validator((input: unknown): RequestInput => {
    if (!isRecord(input)) throw new Error("Invalid request.");
    const token = cleanToken(input["token"]);
    const text = cleanText(input["text"], 900);
    if (!token || !text.trim()) throw new Error("Invalid request.");
    return { token, text };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; note: string }> => {
    if (!(await violetSessionValid(data.token))) {
      return { ok: false, note: "Your session has ended — sign in again, then send it." };
    }
    const stored = await fileSectionRequest({
      from: "violet",
      fromName: VIOLET_PROFILE.fullName,
      text: data.text,
    });
    return stored
      ? { ok: true, note: "Sent to the Captain — it stands in his notifications now." }
      : { ok: false, note: "The record could not be reached from here. Your words are not lost — try again in a moment." };
  });

/* ------------------------------ her email ------------------------------ */

type MailInput = { token: string; to: string; subject: string; body: string };

function mailValidator(input: unknown): MailInput {
  if (!isRecord(input)) throw new Error("Invalid mail request.");
  const token = cleanToken(input["token"]);
  const to = cleanText(input["to"], 160).trim();
  const subject = cleanText(input["subject"], 200).trim();
  const body = cleanText(input["body"], 8000);
  if (!token || !to || !subject || !body.trim()) throw new Error("Invalid mail request.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error("Invalid mail request.");
  return { token, to, subject, body };
}

/**
 * Her send — at HER word, the way his sends wait for his. The
 * message is written into her outbox first; then:
 *   · mailbox connected → the transport carries it, and the
 *     record is marked sent ONLY on the server's acceptance;
 *   · mailbox not connected → the record stands as a ready
 *     draft ("waiting-mailbox") and she is told plainly.
 * A message is never marked sent that was not accepted.
 */
export const violetSendMail = createServerFn({ method: "POST" })
  .validator(mailValidator)
  .handler(async ({ data }): Promise<{ ok: boolean; sent: boolean; note: string }> => {
    if (!(await violetSessionValid(data.token))) {
      return { ok: false, sent: false, note: "Your session has ended — sign in again." };
    }
    const store = await getVioletStore();
    if (!store) return { ok: false, sent: false, note: "Your side lives on the core machine — it is not here." };
    const mail: VioletMail = {
      id: violetNewId("mail"),
      at: Date.now(),
      to: data.to,
      subject: data.subject,
      body: data.body,
      status: "draft",
      sentAt: null,
    };
    await store.update((file) => ({ ...file, outbox: [mail, ...file.outbox].slice(0, 200) }));
    const file = await store.read();
    if (!file.mailbox.connected || !file.mailboxTransport) {
      await store.update((f) => ({
        ...f,
        outbox: f.outbox.map((m) => (m.id === mail.id ? { ...m, status: "waiting-mailbox" as const } : m)),
      }));
      return {
        ok: true,
        sent: false,
        note: "Your mailbox is not connected on your side yet, so this was NOT sent. It is saved in your outbox as a ready draft — the moment the connection stands, it can go.",
      };
    }
    const result = await sendViaSmtp(file.mailboxTransport, file.mailbox.address, mail);
    if (!result.ok) {
      return {
        ok: true,
        sent: false,
        note: `The mail server did not take it, so it was NOT sent: ${result.error ?? "unknown error"} Your message stays in your outbox as a draft.`,
      };
    }
    await store.update((f) => ({
      ...f,
      outbox: f.outbox.map((m) =>
        m.id === mail.id ? { ...m, status: "sent" as const, sentAt: Date.now() } : m,
      ),
    }));
    return { ok: true, sent: true, note: `Sent to ${mail.to}.` };
  });

/* --------------------------- the Captain's acts --------------------------- */

type OperatorInput = { accessToken: string };

function operatorValidator(input: unknown): OperatorInput {
  if (!isRecord(input)) throw new Error("Invalid operator request.");
  const accessToken = cleanText(input["accessToken"], 16_384);
  if (!accessToken) throw new Error("Invalid operator request.");
  return { accessToken };
}

async function operatorAuthorized(accessToken: string): Promise<boolean> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return verification.authorized;
}

export interface VioletWelcomePacket {
  authorized: boolean;
  available: boolean;
  email: string;
  /** True while her starting password still stands (she has not changed it). */
  usingDefaultPassword: boolean;
  /** The draft exactly as stored — UNSENT. He approves the words before anything travels. */
  draft: string;
  sent: boolean;
}

/**
 * The welcome packet, for the Captain's eyes only: the draft
 * welcome message exactly as stored, and whether the starting
 * password in it still stands. NOTHING is sent by this door —
 * it exists so he can approve the exact words in the main chat.
 */
export const getVioletWelcomePacket = createServerFn({ method: "POST" })
  .validator(operatorValidator)
  .handler(async ({ data }): Promise<VioletWelcomePacket> => {
    const denied: VioletWelcomePacket = {
      authorized: false,
      available: false,
      email: "",
      usingDefaultPassword: false,
      draft: "",
      sent: false,
    };
    if (!(await operatorAuthorized(data.accessToken))) return denied;
    const store = await getVioletStore();
    if (!store) return { ...denied, authorized: true };
    const file = await store.read();
    return {
      authorized: true,
      available: true,
      email: file.credential.email,
      usingDefaultPassword: file.credential.usingDefault,
      draft: file.welcomeDraft,
      sent: false,
    };
  });

type FinanceInput = OperatorInput & {
  date: string;
  kind: "invoice" | "payment";
  label: string;
  amountCents: number;
  status: FinanceRecord["status"];
};

/** Place a finance record on the core for her to read (operator key). */
export const addVioletFinanceRecord = createServerFn({ method: "POST" })
  .validator((input: unknown): FinanceInput => {
    if (!isRecord(input)) throw new Error("Invalid finance record.");
    const { accessToken } = operatorValidator(input);
    const date = cleanText(input["date"], 10);
    const label = cleanText(input["label"], 160).trim();
    const amountCents = typeof input["amountCents"] === "number" ? Math.round(input["amountCents"]) : NaN;
    const kind = input["kind"];
    const status = input["status"];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !label || !Number.isFinite(amountCents)) {
      throw new Error("Invalid finance record.");
    }
    if (kind !== "invoice" && kind !== "payment") throw new Error("Invalid finance record.");
    if (status !== "open" && status !== "paid" && status !== "in-transit" && status !== "landed") {
      throw new Error("Invalid finance record.");
    }
    return { accessToken, date, kind, label, amountCents, status };
  })
  .handler(async ({ data }): Promise<{ authorized: boolean; ok: boolean; note: string }> => {
    if (!(await operatorAuthorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const store = await getVioletStore();
    if (!store) return { authorized: true, ok: false, note: "Her side lives on the core machine — no store here." };
    const record: FinanceRecord = {
      id: violetNewId("fin"),
      date: data.date,
      kind: data.kind,
      label: data.label,
      amountCents: data.amountCents,
      status: data.status,
    };
    await store.update((file) => ({
      ...file,
      financeRecords: [...file.financeRecords, record].slice(0, 500),
    }));
    return { authorized: true, ok: true, note: "On the record — Violet can read it on her side." };
  });
