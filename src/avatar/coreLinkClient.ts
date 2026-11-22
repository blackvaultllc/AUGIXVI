/**
 * CORE LINK CLIENT — the live wiring of coreLink.ts to the core's
 * operator-gated endpoints (Part 30).
 *
 * The transport speaks to whichever server served this page. On the
 * phone that is the Parrot (Tailscale/LAN address — the phone loads the
 * app FROM the core, so the core is the origin, never localhost on the
 * phone). The operator token comes from the signed-in Supabase session,
 * the same pattern the gate log window uses; without a session there is
 * no transport, and the status honestly stays NOT CONFIGURED.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import { appendCoreExchange, getCoreStatus, listCoreFacts, recallCore } from "./coreMemory.server";
import type { CoreRecord } from "./coreMemory";
import { createCoreLink, type CoreLink, type CoreTransport } from "./coreLink";

async function loadAuthClient(): Promise<SupabaseClient | null> {
  let url = import.meta.env["VITE_SUPABASE_URL"]?.trim();
  let publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
  if (!url || !publishableKey) {
    const config = (await getSupabaseClientConfig().catch(() => null)) ?? null;
    url = config?.url?.trim();
    publishableKey = config?.publishableKey?.trim();
  }
  if (!url || !publishableKey) return null;
  return createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

async function operatorToken(): Promise<string | null> {
  const client = await loadAuthClient();
  if (!client) return null;
  const session = (await client.auth.getSession()).data.session;
  return session?.access_token ?? null;
}

export function createCoreTransport(): CoreTransport {
  return {
    async status() {
      const accessToken = await operatorToken();
      if (!accessToken) return null;
      const view = await getCoreStatus({ data: { accessToken } });
      if (!view.authorized) return null;
      return view.available;
    },
    async append(item) {
      const accessToken = await operatorToken();
      if (!accessToken) return "unavailable";
      const view = await appendCoreExchange({
        data: {
          accessToken,
          question: item.question,
          answer: item.answer,
          provider: item.provider,
          surface: item.surface,
          exchangeId: item.exchangeId,
        },
      });
      if (!view.authorized || !view.available) return "unavailable";
      return view.written ? "written" : "duplicate";
    },
  };
}

let sharedLink: CoreLink | null = null;

/** The stage's one core link — created once, shared by every recorder. */
export function getCoreLink(onStatus?: (status: import("./coreLink").CoreStatus) => void): CoreLink {
  sharedLink ??= createCoreLink({
    transport: createCoreTransport(),
    ...(onStatus ? { onStatus } : {}),
  });
  return sharedLink;
}

/** Recall against the core store; null when there is no session or no store. */
export async function recallFromCore(query: string): Promise<CoreRecord[] | null> {
  const accessToken = await operatorToken();
  if (!accessToken) return null;
  const view = await recallCore({ data: { accessToken, query } });
  if (!view.authorized || !view.available) return null;
  return view.records;
}

/** Facts held by the core — the sync-down source for a fresh surface. */
export async function fetchCoreFacts(): Promise<
  { category: import("./operatorMemory").OperatorFactCategory; content: string; at: string }[] | null
> {
  const accessToken = await operatorToken();
  if (!accessToken) return null;
  const view = await listCoreFacts({ data: { accessToken } });
  if (!view.authorized || !view.available) return null;
  return view.facts;
}
