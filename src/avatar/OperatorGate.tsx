import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  getOperatorBootstrapStatus,
  getSupabaseClientConfig,
  verifySupabaseOperatorSession,
} from "./operatorAuth.server";
import { AvatarStage } from "./AvatarStage";
import { SpaceView } from "./SpaceView";

type GateState =
  "checking" | "unconfigured" | "signed-out" | "verifying" | "mfa" | "transitioning" | "authorized";
const AUTH_CLIENT_SLOT = "__augixviOperatorAuthClient";
type AuthWindow = Window & { [AUTH_CLIENT_SLOT]?: SupabaseClient | null };
type MfaEnrollment = { qrCode: string; secret: string };

// Credentials come from the build-time import.meta.env values baked by Vite
// when present, and otherwise from the Worker's runtime env via a server
// function (dashboard variables are not baked into the deployed bundle).
function createAuthClientSync(): SupabaseClient | null | undefined {
  if (typeof window === "undefined") return null;
  const authWindow = window as AuthWindow;
  if (AUTH_CLIENT_SLOT in authWindow) return authWindow[AUTH_CLIENT_SLOT] ?? null;

  const url = import.meta.env["VITE_SUPABASE_URL"]?.trim();
  const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
  if (!url || !publishableKey) return undefined; // try the server runtime env

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

async function loadAuthClientFromServer(): Promise<SupabaseClient | null> {
  const authWindow = window as AuthWindow;
  let config: { url: string; publishableKey: string } | null = null;
  try {
    config = (await getSupabaseClientConfig()) ?? null;
  } catch {
    config = null;
  }
  const url = config?.url?.trim();
  const publishableKey = config?.publishableKey?.trim();
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

function OperatorLanding({ children }: { children: ReactNode }) {
  return (
    <SpaceView isLanding isEnteringLiveMode={false} isReturningToSpace={false}>
      {children}
    </SpaceView>
  );
}

export function OperatorGate() {
  const [initialClient] = useState(createAuthClientSync);
  const [client, setClient] = useState<SupabaseClient | null>(initialClient ?? null);
  useEffect(() => {
    if (initialClient !== undefined) return; // resolved synchronously
    let cancelled = false;
    void loadAuthClientFromServer().then((resolved) => {
      if (!cancelled) setClient(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [initialClient]);
  const [state, setState] = useState<GateState>("checking");
  const [operatorClaimed, setOperatorClaimed] = useState<boolean | null>(null);
  const [registrationMode, setRegistrationMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaEnrollment, setMfaEnrollment] = useState<MfaEnrollment | null>(null);
  const [message, setMessage] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [operatorFullName, setOperatorFullName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeAccessTokenRef = useRef("");
  const verifiedTokenRef = useRef("");
  const verifyingTokenRef = useRef("");
  const transitionTimeoutRef = useRef<number | null>(null);

  const refreshBootstrapStatus = useCallback(async () => {
    try {
      const result = await getOperatorBootstrapStatus();
      if (!result.configured) {
        setOperatorClaimed(null);
        setState("unconfigured");
        return false;
      }
      setOperatorClaimed(result.claimed);
      return true;
    } catch {
      setOperatorClaimed(null);
      setState("unconfigured");
      setMessage("Operator sign-in is unavailable. Please try again later.");
      return false;
    }
  }, []);

  const beginMfa = useCallback(
    async (accessToken: string) => {
      if (
        !client ||
        activeAccessTokenRef.current !== accessToken ||
        verifyingTokenRef.current === accessToken
      ) {
        return;
      }
      verifyingTokenRef.current = accessToken;
      try {
        const { data, error } = await client.auth.mfa.listFactors();
        if (error) throw error;

        const verifiedFactor = data.totp[0];
        if (verifiedFactor) {
          setMfaFactorId(verifiedFactor.id);
          setMfaEnrollment(null);
          setCode("");
          setState("mfa");
          return;
        }

        const pendingFactor = data.all.find(
          (factor) => factor.factor_type === "totp" && factor.status === "unverified",
        );
        if (pendingFactor) {
          const { error: unenrollError } = await client.auth.mfa.unenroll({
            factorId: pendingFactor.id,
          });
          if (unenrollError) throw unenrollError;
        }

        const { data: enrollment, error: enrollError } = await client.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Operator device",
        });
        if (enrollError) throw enrollError;
        setMfaFactorId(enrollment.id);
        setMfaEnrollment({
          qrCode: enrollment.totp.qr_code,
          secret: enrollment.totp.secret,
        });
        setCode("");
        setState("mfa");
      } catch {
        setState("signed-out");
        setMessage("Multi-factor setup is unavailable. Please sign in and try again.");
      } finally {
        if (verifyingTokenRef.current === accessToken) verifyingTokenRef.current = "";
      }
    },
    [client],
  );

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
          setOperatorClaimed(null);
          return;
        }
        if (result.requiresMfa) {
          verifyingTokenRef.current = "";
          await beginMfa(accessToken);
          return;
        }
        if (!result.authorized) {
          await client.auth.signOut();
          setOperatorName(null);
          setOperatorFullName(null);
          setOperatorClaimed(true);
          setState("signed-out");
          setMessage("This account is not authorized for operator access.");
          return;
        }
        setOperatorName(result.operatorName ?? null);
        setOperatorFullName(result.operatorFullName ?? null);
        setOperatorClaimed(true);
        verifiedTokenRef.current = accessToken;
        setState("transitioning");
        transitionTimeoutRef.current = window.setTimeout(() => {
          if (activeAccessTokenRef.current === accessToken) setState("authorized");
        }, 900);
      } catch {
        if (activeAccessTokenRef.current === accessToken) {
          setState("signed-out");
          setMessage("Unable to verify the operator session. Please try again.");
        }
      } finally {
        if (verifyingTokenRef.current === accessToken) verifyingTokenRef.current = "";
      }
    },
    [beginMfa, client],
  );

  useEffect(() => {
    if (!client) {
      setState("unconfigured");
      return;
    }
    let active = true;
    void refreshBootstrapStatus();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT" || !session) {
        activeAccessTokenRef.current = "";
        verifiedTokenRef.current = "";
        verifyingTokenRef.current = "";
        if (transitionTimeoutRef.current !== null) {
          window.clearTimeout(transitionTimeoutRef.current);
          transitionTimeoutRef.current = null;
        }
        setOperatorName(null);
        setOperatorFullName(null);
        setMfaFactorId("");
        setMfaEnrollment(null);
        setState((current) => (current === "unconfigured" ? current : "signed-out"));
        return;
      }
      activeAccessTokenRef.current = session.access_token;
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "MFA_CHALLENGE_VERIFIED"
      ) {
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
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [client, refreshBootstrapStatus, verifySession]);

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

  async function createOperatorAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy || operatorClaimed !== false) return;
    setBusy(true);
    setMessage("");
    try {
      const bootstrapStatus = await getOperatorBootstrapStatus();
      if (!bootstrapStatus.configured) {
        setOperatorClaimed(null);
        setState("unconfigured");
        return;
      }
      if (bootstrapStatus.claimed) {
        setOperatorClaimed(true);
        setRegistrationMode(false);
        setMessage("The operator account is already set up. Sign in to continue.");
        return;
      }
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
      });
      setPassword("");
      if (error) {
        setMessage("Operator account setup failed. Check the details and try again.");
        return;
      }
      if (!data.session) {
        setRegistrationMode(false);
        setMessage("Check the confirmation email, then sign in to finish setup.");
        return;
      }
      activeAccessTokenRef.current = data.session.access_token;
      await verifySession(data.session.access_token);
    } catch {
      setMessage("Operator account setup is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy || !mfaFactorId) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await client.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code,
      });
      if (error || !data.access_token) {
        setMessage("Verification code was not accepted. Try again.");
        return;
      }
      setCode("");
      activeAccessTokenRef.current = data.access_token;
      await verifySession(data.access_token);
    } catch {
      setMessage("Multi-factor verification failed. Check the code and try again.");
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

  if (state === "transitioning") {
    return <main className="operator-auth-transition" aria-label="Opening operator interface" />;
  }

  if (state === "checking" || state === "verifying") {
    return (
      <OperatorLanding>
        <section className="operator-auth__card" aria-live="polite">
          <p>
            {state === "checking" ? "Checking operator session…" : "Verifying operator access…"}
          </p>
        </section>
      </OperatorLanding>
    );
  }

  if (state === "unconfigured") {
    return (
      <OperatorLanding>
        <section className="operator-auth__card" aria-labelledby="operator-auth-title">
          <h1 id="operator-auth-title">Sign-in not configured</h1>
          <p>
            Operator sign-in is unavailable until Supabase Auth and the operator registry are
            configured.
          </p>
          {message && (
            <p className="operator-auth__error" role="alert">
              {message}
            </p>
          )}
        </section>
      </OperatorLanding>
    );
  }

  if (state === "mfa") {
    return (
      <OperatorLanding>
        <section className="operator-auth__card" aria-labelledby="operator-auth-title">
          <h1 id="operator-auth-title">Two-step verification</h1>
          {mfaEnrollment ? (
            <div className="operator-auth__enrollment">
              <p>Scan this code with an authenticator app, or enter the setup key manually.</p>
              <img src={mfaEnrollment.qrCode} alt="Authenticator setup QR code" />
              <code>{mfaEnrollment.secret}</code>
            </div>
          ) : (
            <p>Enter the current code from your authenticator app.</p>
          )}
          <form className="operator-auth__form" onSubmit={(event) => void verifyMfa(event)}>
            <label>
              Verification code
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={8}
                pattern="[0-9]{6,8}"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                required
              />
            </label>
            {message && (
              <p className="operator-auth__error" role="alert">
                {message}
              </p>
            )}
            <button type="submit" disabled={busy || code.length < 6}>
              {busy ? "Verifying…" : "Verify"}
            </button>
          </form>
        </section>
      </OperatorLanding>
    );
  }

  return (
    <OperatorLanding>
      <section className="operator-auth__card" aria-labelledby="operator-auth-title">
        <h1 id="operator-auth-title">
          {registrationMode ? "Set up operator account" : "Operator sign-in"}
        </h1>
        <p>
          {registrationMode
            ? "Create the first operator account for this installation."
            : "Sign in to continue."}
        </p>
        <form
          className="operator-auth__form"
          onSubmit={(event) =>
            void (registrationMode ? createOperatorAccount(event) : signIn(event))
          }
        >
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
              autoComplete={registrationMode ? "new-password" : "current-password"}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          {message && (
            <p className="operator-auth__error" role="alert">
              {message}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy
              ? registrationMode
                ? "Setting up…"
                : "Signing in…"
              : registrationMode
                ? "Create operator account"
                : "Sign in"}
          </button>
        </form>
        {operatorClaimed === false && (
          <button
            className="operator-auth__mode"
            type="button"
            onClick={() => {
              setRegistrationMode((current) => !current);
              setMessage("");
            }}
          >
            {registrationMode ? "Back to sign in" : "Set up first operator account"}
          </button>
        )}
      </section>
    </OperatorLanding>
  );
}
