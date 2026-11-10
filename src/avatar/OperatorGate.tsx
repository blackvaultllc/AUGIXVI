import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { AvatarStage } from "./AvatarStage";

type GateState = "checking" | "unconfigured" | "signed-out" | "verifying" | "authorized";
const AUTH_CLIENT_SLOT = "__augixviOperatorAuthClient";
type AuthWindow = Window & { [AUTH_CLIENT_SLOT]?: SupabaseClient | null };

function createAuthClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const authWindow = window as AuthWindow;
  if (AUTH_CLIENT_SLOT in authWindow) return authWindow[AUTH_CLIENT_SLOT] ?? null;

  const url = import.meta.env["VITE_SUPABASE_URL"]?.trim();
  const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
  if (!url || !publishableKey) {
    authWindow[AUTH_CLIENT_SLOT] = null;
    return null;
  }

  const client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  authWindow[AUTH_CLIENT_SLOT] = client;
  return client;
}

export function OperatorGate() {
  const [client] = useState(createAuthClient);
  const [state, setState] = useState<GateState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [operatorFullName, setOperatorFullName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeAccessTokenRef = useRef("");
  const verifiedTokenRef = useRef("");
  const verifyingTokenRef = useRef("");

  const verifySession = useCallback(
    async (accessToken: string) => {
      if (
        !client ||
        activeAccessTokenRef.current !== accessToken ||
        verifiedTokenRef.current === accessToken ||
        verifyingTokenRef.current === accessToken
      ) {
        return;
      }
      verifyingTokenRef.current = accessToken;
      setState("verifying");
      setMessage("");
      try {
        const result = await verifySupabaseOperatorSession({ data: { accessToken } });
        if (activeAccessTokenRef.current !== accessToken) return;
        if (!result.configured) {
          await client.auth.signOut();
          setState("unconfigured");
          return;
        }
        if (!result.authorized) {
          await client.auth.signOut();
          setOperatorName(null);
          setOperatorFullName(null);
          setState("signed-out");
          setMessage("This account is not authorized for operator access.");
          return;
        }
        setOperatorName(result.operatorName);
        setOperatorFullName(result.operatorFullName);
        verifiedTokenRef.current = accessToken;
        setState("authorized");
      } catch {
        if (activeAccessTokenRef.current === accessToken) {
          setState("signed-out");
          setMessage("Unable to verify the operator session. Please try again.");
        }
      } finally {
        if (verifyingTokenRef.current === accessToken) verifyingTokenRef.current = "";
      }
    },
    [client],
  );

  useEffect(() => {
    if (!client) {
      setState("unconfigured");
      return;
    }
    let active = true;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT" || !session) {
        activeAccessTokenRef.current = "";
        verifiedTokenRef.current = "";
        verifyingTokenRef.current = "";
        setOperatorName(null);
        setOperatorFullName(null);
        setState("signed-out");
        return;
      }
      activeAccessTokenRef.current = session.access_token;
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        window.setTimeout(() => {
          if (active && activeAccessTokenRef.current === session.access_token) {
            void verifySession(session.access_token);
          }
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client, verifySession]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    setSignOutError("");
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setPassword("");
      if (error || !data.session) {
        setMessage("Sign-in failed. Check the email and password and try again.");
        return;
      }
      activeAccessTokenRef.current = data.session.access_token;
      await verifySession(data.session.access_token);
    } catch {
      setMessage("Sign-in is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!client) return;
    setSignOutError("");
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      activeAccessTokenRef.current = "";
      verifiedTokenRef.current = "";
      verifyingTokenRef.current = "";
      setOperatorName(null);
      setOperatorFullName(null);
      setState("signed-out");
    } catch {
      setSignOutError("Sign-out failed. The current session is still active.");
    }
  }

  if (state === "authorized") {
    return (
      <AvatarStage
        onSignOut={signOut}
        operatorFullName={operatorFullName}
        operatorName={operatorName}
        signOutError={signOutError}
      />
    );
  }

  if (state === "checking" || state === "verifying") {
    return (
      <main className="operator-auth" aria-live="polite">
        <p>{state === "checking" ? "Checking operator session…" : "Verifying operator access…"}</p>
      </main>
    );
  }

  if (state === "unconfigured") {
    return (
      <main className="operator-auth" aria-labelledby="operator-auth-title">
        <section className="operator-auth__card">
          <h1 id="operator-auth-title">Sign-in not configured</h1>
          <p>
            Operator sign-in is unavailable until Supabase Auth and its operator allowlist are
            configured.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="operator-auth" aria-labelledby="operator-auth-title">
      <section className="operator-auth__card">
        <h1 id="operator-auth-title">Operator sign-in</h1>
        <p>Sign in to continue.</p>
        <form className="operator-auth__form" onSubmit={(event) => void signIn(event)}>
          <label>
            Email
            <input
              autoComplete="username"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {message && (
            <p className="operator-auth__error" role="alert">
              {message}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
