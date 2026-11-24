/**
 * THE DADDY INBOX — the operator's side (owner order 2026-11-24:
 * Khadija must always be able to reach her daddy).
 *
 * Every endpoint re-verifies the operator session exactly like the
 * core memory does (verifySupabaseOperatorSession) before a single
 * record moves — this is his daughter's line to him, and it opens
 * for him alone.
 *
 * The list call doubles as his presence heartbeat: his stage polls
 * it while he is at his Augie, and each poll stamps daddySeenAt in
 * the store. That stamp — earned by the round trip — is what her
 * side reads as "Daddy is online", so her call rings him when he is
 * truly there and becomes a message in his inbox when he is not.
 *
 * Reading the inbox for display does NOT consume the unread flags
 * the stage poller notifies on: listDaddyInbox peeks (and stamps),
 * markDaddyInboxRead is the deliberate "he has seen them" step his
 * Logs window takes when it shows him the thread.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "../operatorAuth.server";
import {
  answerDaddyCall,
  endDaddyCall,
  readDaddyInbox,
  replyFromDaddy,
  stampDaddySeen,
  unreadForDaddy,
  activeDaddyCall,
  type DaddyCall,
  type DaddyMessage,
} from "./daddyStore.server";

type TokenInput = { accessToken: string };

function isTokenInput(input: unknown): input is TokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "accessToken" in input &&
    typeof (input as TokenInput).accessToken === "string" &&
    (input as TokenInput).accessToken.length > 0 &&
    (input as TokenInput).accessToken.length <= 16_384
  );
}

async function authorize(accessToken: string): Promise<{ configured: boolean; authorized: boolean }> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return { configured: verification.configured, authorized: verification.authorized };
}

export interface DaddyInboxView {
  configured: boolean;
  authorized: boolean;
  /** False where the core store does not exist (e.g. the Worker). */
  available: boolean;
  messages: DaddyMessage[];
  /** Her messages he has not been shown yet — the poller notifies on these. */
  unread: DaddyMessage[];
  call: DaddyCall | null;
}

const DENIED: DaddyInboxView = {
  configured: false,
  authorized: false,
  available: false,
  messages: [],
  unread: [],
  call: null,
};

export const listDaddyInbox = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid daddy inbox request.");
    return input;
  })
  .handler(async ({ data }): Promise<DaddyInboxView> => {
    const auth = await authorize(data.accessToken);
    if (!auth.authorized) return { ...DENIED, configured: auth.configured };
    // His stage asking IS his presence — stamp it before reading.
    await stampDaddySeen();
    const { available, inbox } = await readDaddyInbox();
    if (!available) return { ...DENIED, configured: true, authorized: true };
    return {
      configured: true,
      authorized: true,
      available: true,
      messages: inbox.messages.slice(-30),
      unread: unreadForDaddy(inbox),
      call: activeDaddyCall(inbox),
    };
  });

export const markDaddyInboxRead = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid daddy inbox request.");
    return input;
  })
  .handler(async ({ data }): Promise<{ configured: boolean; authorized: boolean; available: boolean }> => {
    const auth = await authorize(data.accessToken);
    if (!auth.authorized) return { ...auth, available: false };
    const { readInboxForDaddy } = await import("./daddyStore.server");
    const view = await readInboxForDaddy();
    return { configured: true, authorized: true, available: view.available };
  });

type ReplyInput = TokenInput & { text: string };

function isReplyInput(input: unknown): input is ReplyInput {
  if (!isTokenInput(input)) return false;
  const text = (input as ReplyInput).text;
  return typeof text === "string" && text.trim().length > 0 && text.length <= 2_000;
}

export const replyToKhadija = createServerFn({ method: "POST" })
  .validator((input: unknown): ReplyInput => {
    if (!isReplyInput(input)) throw new Error("Invalid reply to Khadija.");
    return input;
  })
  .handler(
    async ({
      data,
    }): Promise<{ configured: boolean; authorized: boolean; available: boolean; sent: boolean }> => {
      const auth = await authorize(data.accessToken);
      if (!auth.authorized) return { ...auth, available: false, sent: false };
      const stored = await replyFromDaddy(data.text);
      return { configured: true, authorized: true, available: stored !== null, sent: stored !== null };
    },
  );

export const answerKhadijaCall = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid daddy inbox request.");
    return input;
  })
  .handler(
    async ({
      data,
    }): Promise<{ configured: boolean; authorized: boolean; available: boolean; call: DaddyCall | null }> => {
      const auth = await authorize(data.accessToken);
      if (!auth.authorized) return { ...auth, available: false, call: null };
      const call = await answerDaddyCall();
      return { configured: true, authorized: true, available: call !== null, call };
    },
  );

export const endKhadijaCall = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid daddy inbox request.");
    return input;
  })
  .handler(
    async ({
      data,
    }): Promise<{ configured: boolean; authorized: boolean; available: boolean; call: DaddyCall | null }> => {
      const auth = await authorize(data.accessToken);
      if (!auth.authorized) return { ...auth, available: false, call: null };
      const call = await endDaddyCall();
      return { configured: true, authorized: true, available: call !== null, call };
    },
  );
