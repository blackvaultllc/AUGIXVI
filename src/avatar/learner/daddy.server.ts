/**
 * THE DADDY DOORWAY — Khadija's side of the call/message path
 * (owner order 2026-11-24 ~17:13 CST). POST /api/learner/daddy with
 * {action: "message" | "call" | "poll"}.
 *
 * This doorway is on her allowlist BY DESIGN: reaching her father is
 * the one contact her education wall always opens for. It reaches
 * nobody else — every action lands in the core's Daddy Inbox
 * (daddyStore.server.ts), addressed to Domenick Arlon Hall, her
 * daddy, and to no one else.
 *
 * The name law on her side: "Daddy", "Dad", "Domenick", and
 * "Domenick Arlon Hall" are the same man — her father, Captain
 * Infinity, the one who made Augie. The intent matchers below are
 * how her AUGI knows it when she says it, in her ask box or with
 * the Daddy card's buttons.
 */
import {
  activeDaddyCall,
  daddyOnline,
  endDaddyCall,
  pollForKhadija,
  postDaddyMessage,
  readDaddyInbox,
  startDaddyCall,
  DADDY_FULL_NAME,
} from "./daddyStore.server";

const DADDY_NAME_RE = /\b(daddy|dad|domenick(?:\s+arlon\s+hall)?|my\s+father|father)\b/i;
const CALL_RE = /\b(call|phone|ring|talk\s+to|talk\s+with|speak\s+to|speak\s+with)\b/i;
const MESSAGE_RE = /\b(message|text|tell|send|write|say)\b/i;

export function mentionsDaddy(text: string): boolean {
  return DADDY_NAME_RE.test(text);
}

export function isDaddyCallIntent(text: string): boolean {
  return mentionsDaddy(text) && CALL_RE.test(text) && !/\bmessage\b/i.test(text);
}

export function isDaddyMessageIntent(text: string): boolean {
  return mentionsDaddy(text) && MESSAGE_RE.test(text) && !isDaddyCallIntent(text);
}

/**
 * The words she wants Daddy to get, when she said them in the same
 * breath: "tell daddy I finished my homework" → "I finished my
 * homework". Returns null when she named the wish but not the words
 * — then the Flower asks her for the words.
 */
export function extractDaddyMessageText(text: string): string | null {
  const trimmed = text.trim().replace(/[.!?\s]+$/, "");
  const patterns = [
    /\b(?:tell|message|text|write\s+to|send\s+(?:a\s+message\s+to|word\s+to))\s+(?:daddy|dad|domenick(?:\s+arlon\s+hall)?|my\s+father|father)\s+(?:that\s+)?(.+)$/i,
    /\b(?:say|send)\s+(.+?)\s+to\s+(?:daddy|dad|domenick(?:\s+arlon\s+hall)?|my\s+father|father)$/i,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    const words = match?.[1]?.trim();
    if (words && words.length >= 2) return words.slice(0, 500);
  }
  return null;
}

/** "Who is Domenick Arlon Hall?" / "Who is my daddy?" / "Who made
 *  you?" — her AUGI knows its maker, and knows he is her daddy. */
export function isDaddyIdentityQuestion(text: string): boolean {
  if (/\bwho\s+(made|created|built)\s+(you|augie|this|my\s+flower)\b/i.test(text)) return true;
  if (/\bwho\s+is\s+(domenick(?:\s+arlon\s+hall)?|daddy|dad|my\s+(?:daddy|dad|father))\b/i.test(text)) return true;
  if (/\bwho\s+is\s+your\s+(?:maker|creator|daddy|dad)\b/i.test(text)) return true;
  return false;
}

export const DADDY_IDENTITY_ANSWER =
  `${DADDY_FULL_NAME} is your daddy — Captain Infinity. ` +
  "He is the man who made Augie and built this whole learning world for you. " +
  "If you want to talk to him, tap the Daddy heart on your page, or tell me: say “Call Daddy”, or “Tell Daddy” and then your words.";

export type DaddyIntent =
  | { kind: "identity" }
  | { kind: "call" }
  | { kind: "message"; words: string | null }
  | null;

export function daddyIntentFor(text: string): DaddyIntent {
  if (isDaddyIdentityQuestion(text)) return { kind: "identity" };
  if (isDaddyCallIntent(text)) return { kind: "call" };
  if (isDaddyMessageIntent(text)) {
    return { kind: "message", words: extractDaddyMessageText(text) };
  }
  return null;
}

export type DaddyActionResult =
  | { ok: true; kind: "message"; daddyOnline: boolean }
  | { ok: true; kind: "call"; daddyOnline: boolean; callState: string }
  | { ok: false; reason: string };

/** Carry out a daddy wish from her ask box. Used by the Flower. */
export async function carryOutDaddyIntent(
  intent: NonNullable<DaddyIntent>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DaddyActionResult> {
  if (intent.kind === "message") {
    if (!intent.words) return { ok: false, reason: "no-words" };
    const stored = await postDaddyMessage(intent.words, env);
    if (!stored) return { ok: false, reason: "store-unavailable" };
    const { inbox } = await readDaddyInbox(env);
    return { ok: true, kind: "message", daddyOnline: daddyOnline(inbox) };
  }
  if (intent.kind === "call") {
    const started = await startDaddyCall(env);
    if (!started) return { ok: false, reason: "store-unavailable" };
    return { ok: true, kind: "call", daddyOnline: started.daddyOnline, callState: started.call.state };
  }
  return { ok: false, reason: "identity" };
}

/** POST /api/learner/daddy — her card's doorway (buttons + poll). */
export async function handleLearnerDaddyRequest(request: Request): Promise<Response> {
  let body: { action?: unknown; text?: unknown };
  try {
    body = (await request.json()) as { action?: unknown; text?: unknown };
  } catch {
    return Response.json({ error: "That was not JSON." }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "poll") {
    const view = await pollForKhadija();
    if (!view.available) {
      return Response.json(
        { ok: false, reason: "Daddy's inbox is not on this surface — the core is not connected here." },
        { status: 503 },
      );
    }
    return Response.json({
      ok: true,
      daddyOnline: view.daddyOnline,
      call: view.call,
      messages: view.messages,
    });
  }

  if (action === "message") {
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return Response.json({ error: "No words were written for Daddy." }, { status: 400 });
    }
    const stored = await postDaddyMessage(text);
    if (!stored) {
      return Response.json(
        { ok: false, reason: "Your words could not reach the core from here — Daddy's inbox is not connected on this surface." },
        { status: 503 },
      );
    }
    const { inbox } = await readDaddyInbox();
    return Response.json({ ok: true, daddyOnline: daddyOnline(inbox), message: stored });
  }

  if (action === "call") {
    const started = await startDaddyCall();
    if (!started) {
      return Response.json(
        { ok: false, reason: "The call could not reach the core from here — Daddy's inbox is not connected on this surface." },
        { status: 503 },
      );
    }
    return Response.json({ ok: true, daddyOnline: started.daddyOnline, call: started.call });
  }

  if (action === "end-call") {
    const ended = await endDaddyCall();
    return Response.json({ ok: true, call: ended });
  }

  return Response.json({ error: "Unknown daddy action." }, { status: 400 });
}

/** The live call on her side, for the Flower's status words. */
export async function currentCallForHer(env: NodeJS.ProcessEnv = process.env) {
  const { available, inbox } = await readDaddyInbox(env);
  if (!available) return null;
  return activeDaddyCall(inbox);
}
