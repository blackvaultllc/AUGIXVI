/**
 * DADDY INBOX CLIENT — the operator stage's wiring to Khadija's
 * inbox (owner order 2026-11-24). Same shape as the core link
 * client: the operator token comes from the signed-in Supabase
 * session; without a session there is no transport and the inbox
 * simply stays unpolled — nothing is faked.
 *
 * The stage polls listDaddyInbox while the Captain is at his Augie.
 * Each poll also stamps his presence server-side, which is what her
 * side reads as "Daddy is online" — earned by the round trip.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClientConfig } from "../operatorAuth.server";
import { listDaddyInbox, type DaddyInboxView } from "./daddyInbox.server";

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

export async function operatorAccessToken(): Promise<string | null> {
  const client = await loadAuthClient();
  if (!client) return null;
  const session = (await client.auth.getSession()).data.session;
  return session?.access_token ?? null;
}

/** One inbox round trip for the stage poller; null when there is no
 *  operator session or the inbox does not exist on this surface. */
export async function fetchDaddyInboxView(): Promise<DaddyInboxView | null> {
  const accessToken = await operatorAccessToken();
  if (!accessToken) return null;
  const view = await listDaddyInbox({ data: { accessToken } }).catch(() => null);
  if (!view || !view.authorized || !view.available) return null;
  return view;
}
