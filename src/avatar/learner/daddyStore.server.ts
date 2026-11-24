/**
 * THE DADDY INBOX — the core-side store behind Khadija's one
 * always-open door (owner order 2026-11-24 ~17:13 CST: "at any means
 * necessary if she says she wants to call daddy... she should be able
 * to send me a message or if I'm online a call can come through on
 * her side to my side for her to reach me — get that fixed right
 * away").
 *
 * What lives here, on the core and nowhere else (one-core law):
 *  - her messages to Daddy, and his replies to her;
 *  - her calls: ringing → answered / missed / ended;
 *  - Daddy's presence stamp: his stage stamps it every time it polls
 *    his inbox, so "Daddy is at his Augie" is earned by a real round
 *    trip, never painted on.
 *
 * Her diary stays hers alone — nothing in this store touches it.
 * This store is ONLY the daddy path: the one contact her education
 * wall opens for, by her father's own order.
 *
 * Where the filesystem does not exist (the public Worker) every read
 * says available:false and every write returns null — the honest
 * NOT CONFIGURED shape, never a faked delivery.
 */
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { appendAugieEvent } from "../eventsLog.server";

export const DADDY_FULL_NAME = "Domenick Arlon Hall";
export const DADDY_CALL_NAME = "Daddy";
export const LEARNER_FULL_NAME_FOR_DADDY = "Khadija Leila Hall";

/** His stage polls about every 25–30s; two missed polls = away. */
export const DADDY_ONLINE_WINDOW_MS = 75_000;
/** A call rings for three minutes, then it honestly becomes missed. */
export const DADDY_RING_TIMEOUT_MS = 180_000;

const MAX_MESSAGES = 200;
const MAX_CALLS = 50;
export const DADDY_TEXT_MAX = 500;

export type DaddyMessage = {
  id: string;
  at: string;
  from: "khadija" | "daddy";
  text: string;
  readByDaddy: boolean;
  readByKhadija: boolean;
};

export type DaddyCallState = "ringing" | "answered" | "missed" | "ended";

export type DaddyCall = {
  id: string;
  at: string;
  state: DaddyCallState;
  answeredAt: string | null;
  endedAt: string | null;
};

export type DaddyInbox = {
  messages: DaddyMessage[];
  calls: DaddyCall[];
  daddySeenAt: string | null;
};

const EMPTY_INBOX: DaddyInbox = { messages: [], calls: [], daddySeenAt: null };

export function daddyInboxPath(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env["AUGIE_DADDY_INBOX_PATH"] ??
    join(homedir(), ".local", "share", "augie", "daddy-inbox.json")
  );
}

function isMessage(value: unknown): value is DaddyMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<DaddyMessage>;
  return (
    typeof m.id === "string" &&
    typeof m.at === "string" &&
    (m.from === "khadija" || m.from === "daddy") &&
    typeof m.text === "string" &&
    typeof m.readByDaddy === "boolean" &&
    typeof m.readByKhadija === "boolean"
  );
}

function isCall(value: unknown): value is DaddyCall {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<DaddyCall>;
  return (
    typeof c.id === "string" &&
    typeof c.at === "string" &&
    (c.state === "ringing" || c.state === "answered" || c.state === "missed" || c.state === "ended") &&
    (typeof c.answeredAt === "string" || c.answeredAt === null) &&
    (typeof c.endedAt === "string" || c.endedAt === null)
  );
}

export async function readDaddyInbox(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ available: boolean; inbox: DaddyInbox }> {
  try {
    const raw = await fs.readFile(daddyInboxPath(env), "utf8");
    const parsed = JSON.parse(raw) as Partial<DaddyInbox>;
    return {
      available: true,
      inbox: {
        messages: Array.isArray(parsed.messages) ? parsed.messages.filter(isMessage) : [],
        calls: Array.isArray(parsed.calls) ? parsed.calls.filter(isCall) : [],
        daddySeenAt: typeof parsed.daddySeenAt === "string" ? parsed.daddySeenAt : null,
      },
    };
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "ENOENT") {
      // The store has not been born yet on this core — an empty
      // inbox, not a missing one: the first write creates the file.
      // (Without this, her very first call — before any message had
      // ever created the file — would have been refused.)
      return { available: true, inbox: EMPTY_INBOX };
    }
    return { available: false, inbox: EMPTY_INBOX };
  }
}

let writeChain: Promise<void> = Promise.resolve();

async function updateDaddyInbox(
  env: NodeJS.ProcessEnv,
  mutate: (inbox: DaddyInbox) => DaddyInbox,
): Promise<DaddyInbox | null> {
  let result: DaddyInbox | null = null;
  const step = async () => {
    const { inbox } = await readDaddyInbox(env);
    const next = mutate({
      messages: [...inbox.messages],
      calls: [...inbox.calls],
      daddySeenAt: inbox.daddySeenAt,
    });
    next.messages = next.messages.slice(-MAX_MESSAGES);
    next.calls = next.calls.slice(-MAX_CALLS);
    try {
      const path = daddyInboxPath(env);
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, JSON.stringify(next, null, 2), "utf8");
      result = next;
    } catch {
      result = null;
    }
  };
  writeChain = writeChain.then(step, step);
  await writeChain;
  return result;
}

function newId(prefix: string, now: Date): string {
  return `${prefix}-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, DADDY_TEXT_MAX);
}

async function noteEvent(
  summary: string,
  detail: string | undefined,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  // The event log is how his Logs window sees it too; a surface with
  // no filesystem simply skips the note — the inbox write already
  // told the truth about delivery.
  const event =
    detail === undefined
      ? { type: "note" as const, summary }
      : { type: "note" as const, summary, detail };
  await appendAugieEvent(event, env).catch(() => undefined);
}

/** Her message to Daddy. Returns the stored message, or null where
 *  the core store does not exist on this surface. */
export async function postDaddyMessage(
  text: string,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Promise<DaddyMessage | null> {
  const clean = cleanText(text);
  if (!clean) return null;
  const message: DaddyMessage = {
    id: newId("msg", now),
    at: now.toISOString(),
    from: "khadija",
    text: clean,
    readByDaddy: false,
    readByKhadija: true,
  };
  const inbox = await updateDaddyInbox(env, (current) => ({
    ...current,
    messages: [...current.messages, message],
  }));
  if (!inbox) return null;
  await noteEvent("Message from Khadija for Daddy", clean, env);
  return message;
}

/** His reply to her — written from his side (operator-gated caller). */
export async function replyFromDaddy(
  text: string,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Promise<DaddyMessage | null> {
  const clean = cleanText(text);
  if (!clean) return null;
  const message: DaddyMessage = {
    id: newId("msg", now),
    at: now.toISOString(),
    from: "daddy",
    text: clean,
    readByDaddy: true,
    readByKhadija: false,
  };
  const inbox = await updateDaddyInbox(env, (current) => ({
    ...current,
    messages: [...current.messages, message],
  }));
  if (!inbox) return null;
  await noteEvent("Daddy replied to Khadija", clean, env);
  return message;
}

/** The call's honest state at a moment: a ring that nobody answered
 *  inside the ring window has become a missed call. */
export function effectiveCallState(call: DaddyCall, now: Date = new Date()): DaddyCallState {
  if (call.state === "ringing" && now.getTime() - new Date(call.at).getTime() > DADDY_RING_TIMEOUT_MS) {
    return "missed";
  }
  return call.state;
}

/** The live call, if one is ringing or answered right now. */
export function activeDaddyCall(inbox: DaddyInbox, now: Date = new Date()): DaddyCall | null {
  for (let i = inbox.calls.length - 1; i >= 0; i -= 1) {
    const call = inbox.calls[i]!;
    const state = effectiveCallState(call, now);
    if (state === "ringing" || state === "answered") return { ...call, state };
  }
  return null;
}

/** She calls Daddy. An already-live call is returned as-is — one
 *  ring at a time, never a pile of duplicate calls. */
export async function startDaddyCall(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Promise<{ call: DaddyCall; daddyOnline: boolean } | null> {
  const { available, inbox } = await readDaddyInbox(env);
  if (!available) return null;
  const live = activeDaddyCall(inbox, now);
  if (live) return { call: live, daddyOnline: daddyOnline(inbox, now) };
  const call: DaddyCall = {
    id: newId("call", now),
    at: now.toISOString(),
    state: "ringing",
    answeredAt: null,
    endedAt: null,
  };
  const next = await updateDaddyInbox(env, (current) => ({
    ...current,
    calls: [...current.calls, call],
  }));
  if (!next) return null;
  await noteEvent("Khadija is calling Daddy", "Her AUGI placed a call to Daddy from her learning page.", env);
  return { call, daddyOnline: daddyOnline(next, now) };
}

/** He answers from his side. */
export async function answerDaddyCall(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Promise<DaddyCall | null> {
  let answered: DaddyCall | null = null;
  const next = await updateDaddyInbox(env, (current) => {
    const calls = current.calls.map((call) => {
      if (effectiveCallState(call, now) === "ringing") {
        answered = { ...call, state: "answered" as const, answeredAt: now.toISOString() };
        return answered;
      }
      return call;
    });
    return { ...current, calls };
  });
  if (!next || !answered) return null;
  await noteEvent("Daddy answered Khadija's call", undefined, env);
  return answered;
}

/** Either side ends the live call; a ring that timed out is missed. */
export async function endDaddyCall(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Promise<DaddyCall | null> {
  let ended: DaddyCall | null = null;
  const next = await updateDaddyInbox(env, (current) => {
    const calls = current.calls.map((call) => {
      // A stored ring — live or already past its ring window — ends
      // as missed: the call did not happen, and the record must say
      // so instead of ringing forever. An answered call ends ended.
      if (call.state === "ringing" || call.state === "answered") {
        ended = {
          ...call,
          state: call.state === "answered" ? ("ended" as const) : ("missed" as const),
          endedAt: now.toISOString(),
        };
        return ended;
      }
      return call;
    });
    return { ...current, calls };
  });
  if (!next || !ended) return null;
  await noteEvent("Khadija's call to Daddy ended", `Final state: ${(ended as DaddyCall).state}.`, env);
  return ended;
}

/** His stage stamps this every time it polls his inbox — his being
 *  at his Augie is what "online" means, earned by the round trip. */
export async function stampDaddySeen(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Promise<void> {
  await updateDaddyInbox(env, (current) => ({ ...current, daddySeenAt: now.toISOString() }));
}

export function daddyOnline(inbox: DaddyInbox, now: Date = new Date()): boolean {
  if (!inbox.daddySeenAt) return false;
  return now.getTime() - new Date(inbox.daddySeenAt).getTime() <= DADDY_ONLINE_WINDOW_MS;
}

/** What her side sees when it polls: is Daddy there, is a call live,
 *  and the shared message thread (both directions). Polling marks
 *  his replies as read by her — she is looking at them. */
export async function pollForKhadija(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Promise<{ available: boolean; daddyOnline: boolean; call: DaddyCall | null; messages: DaddyMessage[] }> {
  const { available, inbox } = await readDaddyInbox(env);
  if (!available) return { available: false, daddyOnline: false, call: null, messages: [] };
  const hasUnreadForHer = inbox.messages.some((m) => m.from === "daddy" && !m.readByKhadija);
  if (hasUnreadForHer) {
    await updateDaddyInbox(env, (current) => ({
      ...current,
      messages: current.messages.map((m) =>
        m.from === "daddy" ? { ...m, readByKhadija: true } : m,
      ),
    }));
  }
  const view = await readDaddyInbox(env);
  return {
    available: true,
    daddyOnline: daddyOnline(view.inbox, now),
    call: activeDaddyCall(view.inbox, now),
    messages: view.inbox.messages.slice(-30),
  };
}

/** What his side sees: her unread messages wait at the front of the
 *  list; reading the inbox marks them read by him. */
export async function readInboxForDaddy(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Promise<{ available: boolean; messages: DaddyMessage[]; call: DaddyCall | null }> {
  const { available, inbox } = await readDaddyInbox(env);
  if (!available) return { available: false, messages: [], call: null };
  const unread = inbox.messages.filter((m) => m.from === "khadija" && !m.readByDaddy);
  if (unread.length) {
    await updateDaddyInbox(env, (current) => ({
      ...current,
      messages: current.messages.map((m) =>
        m.from === "khadija" ? { ...m, readByDaddy: true } : m,
      ),
    }));
  }
  const view = await readDaddyInbox(env);
  return {
    available: true,
    messages: view.inbox.messages.slice(-30),
    call: activeDaddyCall(view.inbox, now),
  };
}

/** The unread count his poller checks before stamping reads — a
 *  notification must fire for messages nobody has shown him yet. */
export function unreadForDaddy(inbox: DaddyInbox): DaddyMessage[] {
  return inbox.messages.filter((m) => m.from === "khadija" && !m.readByDaddy);
}
