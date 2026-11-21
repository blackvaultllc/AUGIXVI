/**
 * ROOM GATE — operator-only wrapper for the full-page rooms (AR Cube,
 * Picture Analysis). It does NOT reimplement sign-in: it reads the
 * Supabase session this browser already holds from signing in on the
 * main page, and asks the server to verify it with the exact same
 * check the main gate uses (verifySupabaseOperatorSession — registry
 * ownership plus MFA assurance). Only an "authorized" answer renders
 * the room; anything else points the operator back to the main page to
 * sign in there. No auth code is duplicated or changed.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { getSupabaseClientConfig, verifySupabaseOperatorSession } from "./operatorAuth.server";

type RoomGateState = "checking" | "authorized" | "signed-out" | "mfa" | "unconfigured" | "error";

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

const MESSAGES: Record<Exclude<RoomGateState, "authorized" | "checking">, string> = {
  "signed-out":
    "This room is operator-only and no verified operator session was found in this browser. Sign in on the main page first, then come back.",
  mfa: "Your sign-in still needs its MFA step. Finish signing in on the main page, then come back.",
  unconfigured: "Operator sign-in is not configured on the server, so this room cannot verify you.",
  error: "Your operator session could not be checked. Try the main page, then come back.",
};

export function RoomGate({ roomName, children }: { roomName: string; children: ReactNode }) {
  const [state, setState] = useState<RoomGateState>("checking");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const client = await loadAuthClient();
        if (!client) {
          if (!cancelled) setState("unconfigured");
          return;
        }
        const { data } = await client.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          if (!cancelled) setState("signed-out");
          return;
        }
        const result = await verifySupabaseOperatorSession({ data: { accessToken } });
        if (cancelled) return;
        if (result.authorized) setState("authorized");
        else if (result.requiresMfa) setState("mfa");
        else if (!result.configured) setState("unconfigured");
        else setState("signed-out");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "authorized") return <>{children}</>;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0b0e14",
        color: "#eef2f7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{ maxWidth: "30rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "20px", margin: "0 0 10px" }}>{roomName}</h1>
        <p style={{ color: "#9fb0c9", lineHeight: 1.5, margin: "0 0 16px" }}>
          {state === "checking" ? "Checking your operator session…" : MESSAGES[state]}
        </p>
        {state !== "checking" && (
          <Link
            to="/avatar"
            style={{
              color: "#141414",
              background: "#d4af37",
              textDecoration: "none",
              fontWeight: 700,
              padding: "10px 16px",
              borderRadius: "9px",
              display: "inline-block",
            }}
          >
            Go to Augie — sign in
          </Link>
        )}
      </div>
    </div>
  );
}
