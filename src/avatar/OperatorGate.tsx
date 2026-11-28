import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  getOperatorBootstrapStatus,
  getSupabaseClientConfig,
  verifySupabaseOperatorSession,
} from "./operatorAuth.server";
import { AvatarStage } from "./AvatarStage";
import { LOGIN_DISCLAIMER } from "./loginDisclaimer";
import { GateCheckPanel } from "./GateCheckPanel";
import { MatrixWall } from "./MatrixWall";
import { MummyGuardianDeterrent } from "./MummyGuardian";
import { LearnerHeartDoor } from "./learner/LearnerHeartDoor";
import { CAPTAIN_GATE_NAME, type GateAttemptResult, type GateVoiceOutcome } from "./loginGate";
import { postGateAttemptRecord } from "./loginGateClient";
import { godKeyDoorPath, resolveGodKey, type GodKeyMatch } from "./loginDoor";
import {
  clearDoorStrikesForSession,
  getDoorStatus,
  recordDoorStrike,
} from "./doorSecurity.server";
import { CubeStrike } from "./CubeStrike";
import {
  browserStorage,
  clearSavedLogin,
  currentDeviceInfo,
  readSavedLogin,
  writeSavedLogin,
  type SavedLogin,
} from "./savedLogin";
import { confirmThisDevice, fetchDeviceStatus } from "./trustedDevice";

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

/**
 * THE DOOR FRAME (owner order 2026-11-27 ~23:18 CST): every
 * surface before authorization stands on the Matrix Wall —
 * the landing is the wall itself, and the secure screen the
 * god-name key opens stands over the same rain. Montu's
 * medallion front has retired by this order; the verification
 * machinery behind the door is unchanged. `weave` is the front
 * cover only: the landing rain carries the authorization
 * message in its bytes and runs at the landing pace; inside
 * the door the wall is the plain gold rain.
 */
function DoorFrame({ weave = false, children }: { weave?: boolean; children?: ReactNode }) {
  return (
    <main className="login-door">
      <MatrixWall role="owner" variant="page" weave={weave} />
      <div className="login-door__overlay">{children}</div>
      {/* Khadija's heart door lives on the app footer (her order/his
          order 2026-11-21): reachable with no sign-in, leads only to
          her education side, and grants nothing operator-side. The
          heart is a glyph, not words — it stands on the landing
          without breaking the landing's law. */}
      <LearnerHeartDoor />
    </main>
  );
}

export function OperatorGate() {
  const [initialClient] = useState(createAuthClientSync);
  const [client, setClient] = useState<SupabaseClient | null>(initialClient ?? null);
  // "Settled" means the client question is fully answered: either the
  // build-time env produced a client synchronously, or the server runtime
  // config lookup has finished (with a client or with none). The gate may
  // only declare itself unconfigured once settled — while the server lookup
  // is still in flight the client is merely unknown, not absent. (Online
  // builds carry no build-time env, so without this distinction the gate
  // latched "unconfigured" before the server config ever arrived.)
  const [clientSettled, setClientSettled] = useState(initialClient !== undefined);
  useEffect(() => {
    if (initialClient !== undefined) return; // resolved synchronously
    let cancelled = false;
    void loadAuthClientFromServer().then((resolved) => {
      if (!cancelled) {
        setClient(resolved);
        setClientSettled(true);
      }
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
  // A DENIED attempt at this gate (failed sign-in, an account the
  // registry refuses, a rejected verification code) raises the
  // mummy guardian deterrent on the denial surface (owner order
  // 2026-11-22). Display only — the sign-in flow itself is unchanged.
  const [denied, setDenied] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [operatorFullName, setOperatorFullName] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<{ trusted: boolean; ip: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // THE LOGIN GATE (owner order 2026-11-26): Montu's gate check runs
  // before the credentials. "passed" means the voice layer is
  // satisfied — his voice matched, or the check gave no verdict and
  // credentials carry the entry (never locked out of his own house).
  // A plain voice no-match leaves the gate shut for that attempt;
  // the attempt itself is already recorded by the panel.
  const [gatePass, setGatePass] = useState<"pending" | "passed" | "refused">("pending");
  // THE VERIFICATION LANDING (owner order 2026-11-27): the legal
  // text stands cascaded behind ONE button, and the register
  // question carries its turn-away answer — neither is printed on
  // the landing surface.
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [registerNotice, setRegisterNotice] = useState(false);
  // THE FRONT DOOR (owner order 2026-11-27 ~23:18 CST): the
  // landing is the bare Matrix Wall; a click opens a plain box;
  // the name of the visitor's god is the key. doorMatch is the
  // passed door — null, nothing but rain stands. A saved login
  // on this device passes the door on return (see below).
  const [doorMatch, setDoorMatch] = useState<GodKeyMatch | null>(null);
  const [boxOpen, setBoxOpen] = useState(false);
  const [godNameInput, setGodNameInput] = useState("");
  const [savedLogin, setSavedLogin] = useState<SavedLogin | null>(null);
  // THE CUBE IS THE SECURITY (owner order 2026-11-28 ~00:50
  // CST): wrong names at this door are counted per address on
  // the server (doorStrikes.ts). The box does not open until
  // this address's standing is known, and a restricted address
  // never sees the box at all — the cube stands in its place.
  // The count itself is never shown here: strikes one and two
  // look exactly like the silence that has always answered a
  // wrong name.
  const [doorChecked, setDoorChecked] = useState(false);
  const [doorStruck, setDoorStruck] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDoorStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.restricted) setDoorStruck(true);
        setDoorChecked(true);
      })
      .catch(() => {
        if (!cancelled) setDoorChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A saved login on this device passes the name door on
  // return — straight in, unless they signed out (signing out
  // clears the record; see signOut and the SIGNED_OUT branch).
  // The record passes the NAME door only: the session and the
  // credentials still decide the entry, as they always have.
  useEffect(() => {
    const storage = browserStorage();
    if (!storage) return;
    const saved = readSavedLogin(storage);
    if (!saved) return;
    setSavedLogin(saved);
    const match = resolveGodKey(saved.godName);
    if (match && match.door === "operator" && match.seat === saved.seat) {
      setDoorMatch(match);
    }
  }, []);

  // The box's answer. A right name for another door crosses to
  // that door (a full-page crossing, like the heart door — no
  // operator state rides along). A wrong name is met with
  // silence: the box closes, the rain stands, nothing is said
  // that could teach anyone anything. The wrong name is still
  // COUNTED — on the server, per address (doorStrikes.ts) —
  // and the third one raises the cube. The counting changes
  // nothing the visitor sees on strikes one and two.
  const submitGodName = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const match = resolveGodKey(godNameInput);
      setGodNameInput("");
      if (!match) {
        setBoxOpen(false);
        void recordDoorStrike()
          .then((status) => {
            if (status.restricted) setDoorStruck(true);
          })
          .catch(() => undefined);
        return;
      }
      if (match.door === "operator") {
        setDoorMatch(match);
        setBoxOpen(false);
        return;
      }
      const path = godKeyDoorPath(match.door);
      if (path) window.location.assign(path);
    },
    [godNameInput],
  );

  const saveLoginOnThisDevice = useCallback(() => {
    if (!doorMatch) return;
    const storage = browserStorage();
    if (!storage) return;
    const record: SavedLogin = {
      seat: doorMatch.seat,
      godName: doorMatch.godName,
      personName: doorMatch.personName,
      savedAt: new Date().toISOString(),
      device: currentDeviceInfo(),
    };
    writeSavedLogin(storage, record);
    setSavedLogin(record);
  }, [doorMatch]);

  const forgetThisDevice = useCallback(() => {
    const storage = browserStorage();
    if (storage) clearSavedLogin(storage);
    setSavedLogin(null);
  }, []);

  const gateOutcomeRef = useRef<GateVoiceOutcome | null>(null);
  const gatePhotoRef = useRef<Blob | null>(null);
  const gateArmedRef = useRef(false);
  const gateRecordedRef = useRef(false);

  const handleGateOutcome = useCallback((outcome: GateVoiceOutcome) => {
    gateOutcomeRef.current = outcome;
    gateArmedRef.current = true;
    setGatePass(outcome === "no-match" ? "refused" : "passed");
  }, []);

  // The attempt's concluding record — success or failure — written
  // once per gate flow, with the gate's snapshot attached. Only a
  // flow that actually ran the gate check records one; a returning
  // session (no fresh attempt) records nothing.
  const recordGateConclusion = useCallback((result: GateAttemptResult) => {
    if (!gateArmedRef.current || gateRecordedRef.current) return;
    gateRecordedRef.current = true;
    void postGateAttemptRecord({
      door: "operator",
      result,
      namedAs: result === "voice-match" ? CAPTAIN_GATE_NAME : null,
      note:
        result === "voice-match"
          ? "His voice and his words matched at the gate check."
          : result === "credentials-fallback"
            ? "The voice check gave no verdict; credentials carried the entry."
            : "The sign-in was refused after the gate check.",
      photo: gatePhotoRef.current,
    });
  }, []);
  const activeAccessTokenRef = useRef("");
  const verifiedTokenRef = useRef("");
  const verifyingTokenRef = useRef("");
  const transitionTimeoutRef = useRef<number | null>(null);

  // Part 8: ask (once) whether this device + IP is already confirmed,
  // so the sign-in card can say so honestly. Grants nothing by itself.
  useEffect(() => {
    let cancelled = false;
    void fetchDeviceStatus().then((status) => {
      if (!cancelled) setDeviceStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
          recordGateConclusion("sign-in-failed");
          await client.auth.signOut();
          setOperatorName(null);
          setOperatorFullName(null);
          setOperatorClaimed(true);
          setState("signed-out");
          setDenied(true);
          setMessage("This account is not authorized for operator access.");
          return;
        }
        recordGateConclusion(
          gateOutcomeRef.current === "match" ? "voice-match" : "credentials-fallback",
        );
        setOperatorName(result.operatorName ?? null);
        setOperatorFullName(result.operatorFullName ?? null);
        setOperatorClaimed(true);
        // Part 8: a FULLY verified sign-in (password + MFA + registry)
        // confirms this device + IP for next time. Best-effort — the
        // confirmation layer never blocks entry.
        void confirmThisDevice(accessToken);
        // The same full verification clears this address's door
        // strikes (doorStrikes.ts): the cube guards the door
        // against strangers, never against its verified keeper.
        // Best-effort, like the device confirmation above.
        void clearDoorStrikesForSession({ data: { accessToken } }).catch(() => undefined);
        setDoorStruck(false);
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
    [beginMfa, client, recordGateConclusion],
  );

  useEffect(() => {
    if (!client) {
      // No client yet: only a settled lookup means sign-in is genuinely
      // unconfigured. While the server config is still loading, stay on the
      // "checking" state instead of latching the unconfigured screen.
      if (clientSettled) setState("unconfigured");
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
        // A real sign-out ends the saved login on this device —
        // "unless they sign out" (owner order 2026-11-27). A
        // mere empty session at load is not a sign-out and
        // clears nothing.
        if (event === "SIGNED_OUT") {
          const storage = browserStorage();
          if (storage) clearSavedLogin(storage);
          setSavedLogin(null);
          setDoorMatch(null);
        }
        gateOutcomeRef.current = null;
        gatePhotoRef.current = null;
        gateArmedRef.current = false;
        gateRecordedRef.current = false;
        setGatePass("pending");
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
  }, [client, clientSettled, refreshBootstrapStatus, verifySession]);

  // NO BUTTONS FOR THE UNVERIFIED (owner order 2026-11-28
  // ~00:50 CST): a session that got past the name but cannot
  // complete the verification does not keep a screen of
  // sign-in buttons to poke at. A concluded failure shuts the
  // door: the rain stands, nothing is presented, and the way
  // back in is the door itself — the god-name, which is never
  // a strike when it is right. The owner is never locked out:
  // his name opens the door again, as it always has.
  const returnToRain = useCallback(() => {
    gateOutcomeRef.current = null;
    gatePhotoRef.current = null;
    gateArmedRef.current = false;
    gateRecordedRef.current = false;
    setGatePass("pending");
    setDenied(false);
    setMessage("");
    setEmail("");
    setPassword("");
    setCode("");
    setDoorMatch(null);
    setBoxOpen(false);
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    setDenied(false);
    setSignOutError("");
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setPassword("");
      if (error || !data.session) {
        recordGateConclusion("sign-in-failed");
        // A failed sign-in is a concluded verification failure:
        // the door shuts and the rain stands (see returnToRain).
        returnToRain();
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
    setDenied(false);
    try {
      const { data, error } = await client.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code,
      });
      if (error || !data.access_token) {
        // A rejected code is a concluded verification failure:
        // the door shuts and the rain stands (see returnToRain).
        // The half-session is left unverified and authorizes
        // nothing; the next sign-in runs the full gate again.
        returnToRain();
        setState("signed-out");
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
      // Signing out ends the saved login on this device and
      // shuts the name door behind him — the next visit starts
      // at the rain, like any other.
      forgetThisDevice();
      setDoorMatch(null);
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

  // THE CUBE STRIKE (owner order 2026-11-28 ~00:50 CST): a
  // restricted address gets the cube and the black — never the
  // door, never the secure screen, not even by a saved login's
  // name tag. A session already authorized is past all this
  // (it returned above), and one mid-MFA stands inside the
  // door until its verification concludes, as it always has.
  if (doorStruck && state !== "mfa") {
    return (
      <main className="login-door">
        <CubeStrike />
      </main>
    );
  }

  // THE LANDING (owner order 2026-11-27 ~23:18 CST): until the
  // god-name key passes, the screen is the Matrix Wall and
  // nothing else — black and gold rain at the landing pace, the
  // authorization message woven into its bytes, no words, no
  // names, no company information anywhere on it. A session
  // still resolving behind the door changes nothing the
  // visitor sees; a session that verifies never sees the box
  // at all. An MFA challenge already in flight means a live
  // session is mid-verification — that stands inside the door,
  // not at the rain.
  if (!doorMatch && state !== "mfa") {
    return (
      <DoorFrame weave>
        <div
          className="login-door__hit"
          data-testid="login-wall"
          role="button"
          tabIndex={0}
          aria-label="At the door"
          onClick={() => {
            // The box opens only once this address's standing
            // is known clear (doorStrikes.ts) — a restricted
            // address never sees it, not even for a moment.
            if (doorChecked && !doorStruck) setBoxOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (doorChecked && !doorStruck) setBoxOpen(true);
            }
          }}
        >
          {boxOpen && (
            <form
              className="login-door__box"
              onSubmit={submitGodName}
              onClick={(event) => event.stopPropagation()}
            >
              {/* A PLAIN BOX — no label text, no placeholder, no
                  hint. The accessible name is for screen readers
                  only; nothing is printed on the door. */}
              <input
                aria-label="The name of your god"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                autoFocus
                value={godNameInput}
                onChange={(event) => setGodNameInput(event.target.value)}
              />
            </form>
          )}
        </div>
      </DoorFrame>
    );
  }

  if (state === "checking" || state === "verifying") {
    return (
      <DoorFrame>
        <section className="operator-auth__card" aria-live="polite">
          <p>
            {state === "checking" ? "Checking operator session…" : "Verifying operator access…"}
          </p>
        </section>
      </DoorFrame>
    );
  }

  if (state === "unconfigured") {
    return (
      <DoorFrame>
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
      </DoorFrame>
    );
  }

  if (state === "mfa") {
    return (
      <DoorFrame>
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
          {deviceStatus?.trusted && (
            <p className="operator-auth__device">
              This device is confirmed — your code is the last step.
            </p>
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
            {denied && <MummyGuardianDeterrent />}
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
      </DoorFrame>
    );
  }

  // HIDDEN FIELDS (owner order 2026-11-27): on the secure screen
  // behind the god-name door, the credential fields do not exist
  // until Montu's gate check passes. Registration (the one-time
  // first-account setup) keeps its own form, as before — the
  // owner is never locked out.
  const showCredentials = registrationMode || gatePass === "passed";

  return (
    <DoorFrame>
      <section className="operator-auth__card" aria-labelledby="operator-auth-title">
        <h1 id="operator-auth-title">
          {registrationMode ? "Set up operator account" : "Operator sign-in"}
        </h1>
        <p>
          {registrationMode
            ? "Create the first operator account for this installation."
            : "Sign in to continue."}
        </p>
        {!registrationMode && (
          <GateCheckPanel
            door="operator"
            onSnapshot={(photo) => {
              gatePhotoRef.current = photo;
            }}
            onOperatorOutcome={handleGateOutcome}
          />
        )}
        {/* A refused voice keeps the fields hidden; the refusal
            stands here, on the landing, where the visitor reads it. */}
        {!registrationMode && gatePass === "refused" && (
          <p className="operator-auth__error" role="alert">
            The gate refused that voice. Run the gate check again to sign in.
          </p>
        )}
        {!showCredentials && message && (
          <p className="operator-auth__error" role="alert">
            {message}
          </p>
        )}
        {showCredentials && (
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
            {denied && !registrationMode && <MummyGuardianDeterrent />}
            {message && (
              <p className="operator-auth__error" role="alert">
                {message}
              </p>
            )}
            <button type="submit" disabled={busy || (!registrationMode && gatePass !== "passed")}>
              {busy
                ? registrationMode
                  ? "Setting up…"
                  : "Signing in…"
                : registrationMode
                  ? "Create operator account"
                  : "Sign in"}
            </button>
          </form>
        )}
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
        {/* THE REGISTER TURN-AWAY (owner order 2026-11-27): a
            stranger who comes looking to register meets this
            answer and turns around. */}
        {!registrationMode && (
          <div className="operator-auth__register">
            <button
              className="operator-auth__mode"
              type="button"
              aria-expanded={registerNotice}
              onClick={() => setRegisterNotice((current) => !current)}
            >
              Do you need to register?
            </button>
            {registerNotice && (
              <p className="operator-auth__device" role="status">
                Registrations are down until further notice.
              </p>
            )}
          </div>
        )}
        {/* THE LOGIN DISCLAIMER, CASCADED (Captain's order
            2026-11-26 for the words; owner order 2026-11-27 for
            the cascade): authorized access only, camera and
            microphone on attempt, a photograph recorded with the
            time, entry or not, attempts logged and preserved —
            plus the device-confirmation words. All of it stands
            behind ONE button, never printed on the landing. The
            text lives in ONE constant (LOGIN_DISCLAIMER,
            loginDisclaimer.ts). */}
        <div className="operator-auth__disclaimer">
          <button
            className="operator-auth__disclaimer-toggle"
            type="button"
            aria-expanded={disclaimerOpen}
            onClick={() => setDisclaimerOpen((current) => !current)}
          >
            Disclaimer and legal notice
          </button>
          {disclaimerOpen && (
            <aside aria-label="Login disclaimer">
              {!registrationMode && deviceStatus && (
                <p className="operator-auth__device">
                  {deviceStatus.trusted
                    ? `This device is confirmed (IP ${deviceStatus.ip}). Welcome back — email and password, then your authenticator code. No extra steps, no checkbox.`
                    : "This device or network is not confirmed yet, so full verification applies. After a successful sign-in this device is confirmed automatically — there is no checkbox and nothing extra to click."}
                </p>
              )}
              <h2>{LOGIN_DISCLAIMER.title}</h2>
              {LOGIN_DISCLAIMER.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </aside>
          )}
        </div>
        {/* Violet's door: the Financial Advisor has her own login
            and her own side (Captain's order 2026-11-26). A plain
            link — her side lives at /violet, behind her own
            credential, and grants nothing operator-side. */}
        <p className="operator-auth__violet-door">
          <a href="/violet">Financial Advisor sign-in — Violet's door</a>
        </p>
        {/* SAVE MY LOGIN ON THIS DEVICE (owner order 2026-11-27
            ~23:18 CST): the button that makes a return visit
            straight. It records this device and its information
            beside the person whose god-name opened the door;
            the record passes the NAME door on return — the
            session and credentials still decide the entry —
            and signing out forgets the device. */}
        {!registrationMode && doorMatch && (
          <div className="operator-auth__saved-login">
            {savedLogin && savedLogin.seat === doorMatch.seat ? (
              <>
                <p className="operator-auth__device">
                  Your login is saved on this device — next time, the door stands open for you
                  here. Signing out forgets this device.
                </p>
                <button className="operator-auth__mode" type="button" onClick={forgetThisDevice}>
                  Forget this device
                </button>
              </>
            ) : (
              <button className="operator-auth__mode" type="button" onClick={saveLoginOnThisDevice}>
                Save my login on this device
              </button>
            )}
          </div>
        )}
      </section>
    </DoorFrame>
  );
}
