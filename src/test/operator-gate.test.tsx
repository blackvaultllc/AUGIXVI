import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperatorGate } from "@/avatar/OperatorGate";
import { readSavedLogin } from "@/avatar/savedLogin";

/**
 * THE FRONT DOOR (owner order 2026-11-27 ~23:18 CST): before
 * anything else, the landing is the bare Matrix Wall — a click
 * opens a plain box, and the name of the visitor's god is the
 * key. This helper walks a test through the Captain's door:
 * click the rain, type "Anubis", and the secure screen opens.
 */
async function passDoor(name = "Anubis") {
  fireEvent.click(await screen.findByTestId("login-wall"));
  const input = await screen.findByLabelText("The name of your god");
  fireEvent.change(input, { target: { value: name } });
  fireEvent.submit(input.closest("form")!);
}

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  bootstrapStatus: vi.fn(),
  verifySession: vi.fn(),
  clientConfig: vi.fn(),
  doorStatus: vi.fn(),
  doorStrike: vi.fn(),
  clearStrikes: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/avatar/operatorAuth.server", () => ({
  getOperatorBootstrapStatus: mocks.bootstrapStatus,
  verifySupabaseOperatorSession: mocks.verifySession,
  getSupabaseClientConfig: mocks.clientConfig,
}));

vi.mock("@/avatar/doorSecurity.server", () => ({
  getDoorStatus: mocks.doorStatus,
  recordDoorStrike: mocks.doorStrike,
  clearDoorStrikesForSession: mocks.clearStrikes,
}));

vi.mock("@/avatar/AvatarStage", () => ({
  AvatarStage: ({
    onSignOut,
    operatorName,
    operatorFullName,
  }: {
    onSignOut: () => void;
    operatorName: string | null;
    operatorFullName: string | null;
  }) => (
    <div
      data-testid="avatar-stage"
      data-operator-name={operatorName}
      data-operator-full-name={operatorFullName}
    >
      <button type="button" onClick={onSignOut}>
        Test sign out
      </button>
    </div>
  ),
}));

function createAuthMock() {
  let initialSession: { access_token: string } | null = null;
  const auth = {
    onAuthStateChange: vi.fn(
      (listener: (event: string, session: { access_token: string } | null) => void) => {
        queueMicrotask(() => listener("INITIAL_SESSION", initialSession));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    ),
    signInWithPassword: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn(),
    mfa: {
      listFactors: vi.fn(),
      unenroll: vi.fn(),
      enroll: vi.fn(),
      challengeAndVerify: vi.fn(),
    },
  };
  return {
    ...auth,
    setInitialSession(session: { access_token: string } | null) {
      initialSession = session;
    },
  };
}

describe("operator sign-in gate", () => {
  let auth: ReturnType<typeof createAuthMock>;

  beforeEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(window, "__augixviOperatorAuthClient");
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.invalid");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-placeholder");
    auth = createAuthMock();
    auth.mfa.listFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null });
    auth.mfa.unenroll.mockResolvedValue({ data: {}, error: null });
    auth.mfa.enroll.mockResolvedValue({
      data: { id: "factor", totp: { qr_code: "data:image/svg+xml,test", secret: "setup-secret" } },
      error: null,
    });
    auth.mfa.challengeAndVerify.mockResolvedValue({
      data: { access_token: "aal2-session" },
      error: null,
    });
    mocks.createClient.mockReset().mockReturnValue({ auth });
    mocks.bootstrapStatus.mockReset().mockResolvedValue({ configured: true, claimed: false });
    mocks.verifySession.mockReset();
    mocks.clientConfig.mockReset().mockResolvedValue({
      url: "https://project.invalid",
      publishableKey: "public-placeholder",
    });
    mocks.doorStatus
      .mockReset()
      .mockResolvedValue({ available: true, strikes: 0, restricted: false });
    mocks.doorStrike
      .mockReset()
      .mockResolvedValue({ available: true, strikes: 1, restricted: false });
    mocks.clearStrikes.mockReset().mockResolvedValue({ authorized: true, cleared: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders safely before the browser hydrates", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
    try {
      const html = renderToString(<OperatorGate />);
      // The landing is the bare Matrix Wall: the wall and its
      // tap surface render, and NO words stand on it — no
      // heading, no status line, no medallion name.
      expect(html).toContain("login-wall");
      expect(html).toContain("matrix-wall");
      expect(html).not.toContain("Operator sign-in");
      expect(html).not.toContain("Checking operator session");
      expect(html).not.toContain("MONTU");
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    }
  });

  it("the landing is the bare matrix — a wrong name opens nothing, in silence", async () => {
    const { container } = render(<OperatorGate />);

    const wall = await screen.findByTestId("login-wall");
    // The woven cover stands on the front rain, and the front
    // carries no visible words at all.
    expect(container.querySelector("[data-weave='true']")).not.toBeNull();
    expect(container.textContent?.trim()).toBe("");
    expect(screen.queryByRole("heading")).toBeNull();

    fireEvent.click(wall);
    const input = await screen.findByLabelText("The name of your god");
    fireEvent.change(input, { target: { value: "Zeus" } });
    fireEvent.submit(input.closest("form")!);

    // Silence: the box is gone, the rain stands, nothing opened
    // and nothing was said that could teach anyone anything.
    expect(screen.queryByLabelText("The name of your god")).toBeNull();
    expect(await screen.findByTestId("login-wall")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(container.textContent?.trim()).toBe("");
  });

  it("the Captain's god-name opens the secure screen; the medallion front is retired", async () => {
    const { container } = render(<OperatorGate />);
    await passDoor();
    expect(await screen.findByRole("heading", { name: "Operator sign-in" })).toBeInTheDocument();
    // Inside the door the wall is the plain rain — the weave is
    // the front cover only — and Montu's medallion front is gone.
    expect(container.querySelector("[data-weave='true']")).toBeNull();
    expect(container.querySelector("[data-testid='montu-guard']")).toBeNull();
  });

  it("fails closed and explains when Supabase Auth is not configured", async () => {
    mocks.clientConfig.mockResolvedValue(null);
    vi.stubEnv("VITE_SUPABASE_URL", "");
    const { container } = render(<OperatorGate />);

    // The explanation stands behind the door, like everything
    // else: the name passes first, then the unconfigured card.
    await passDoor();
    expect(
      await screen.findByRole("heading", { name: "Sign-in not configured" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("avatar-stage")).not.toBeInTheDocument();
    expect(container.querySelector("input")).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("reaches the sign-in form when only the server runtime config is available", async () => {
    // The deployed online bundle has no build-time Supabase env baked in;
    // the gate must recover through getSupabaseClientConfig and must not
    // latch the unconfigured screen while that lookup is still in flight.
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    mocks.bootstrapStatus.mockResolvedValue({ configured: true, claimed: true });

    render(<OperatorGate />);
    await passDoor();

    expect(await screen.findByRole("heading", { name: "Operator sign-in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign-in not configured" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Set up first operator account" })).toBeNull();
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://project.invalid",
      "public-placeholder",
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: true, autoRefreshToken: true }),
      }),
    );
  });

  it("shows only the sign-in form before authorization", async () => {
    render(<OperatorGate />);
    await passDoor();

    expect(await screen.findByRole("heading", { name: "Operator sign-in" })).toBeInTheDocument();
    // Hidden fields (2026-11-27): the Sign in button renders only
    // once the gate check reports. In jsdom the panel cannot run —
    // and it no longer reports a no-verdict by itself (that was the
    // automatic bypass): the fields stay hidden until the visitor
    // presses the gate's continue button, which records the
    // attempt first.
    expect(screen.queryByLabelText("Email")).toBeNull();
    fireEvent.click(
      await screen.findByRole("button", { name: "Continue with email and password" }),
    );
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set up first operator account" }),
    ).toBeInTheDocument();
    // The ONE link allowed on this door (Captain's order 2026-11-26):
    // the Financial Advisor's own door to her own side. No other link
    // stands here before authorization — nothing into the stage.
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/violet");
    expect(screen.queryByTestId("avatar-stage")).not.toBeInTheDocument();
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://project.invalid",
      "public-placeholder",
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: true, autoRefreshToken: true }),
      }),
    );
  });

  it("hides the credential fields until Montu's gate check passes", async () => {
    // A browser that CAN open camera and microphone: the gate check
    // sits idle until it is run, so no outcome is reported and the
    // credential fields must not exist yet (owner order 2026-11-27 —
    // the landing is a verification page, fields hidden until pass).
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return false;
        }
      },
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    try {
      render(<OperatorGate />);
      await passDoor();

      expect(await screen.findByRole("heading", { name: "Operator sign-in" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Run the gate check" })).toBeInTheDocument();
      expect(screen.queryByLabelText("Email")).toBeNull();
      expect(screen.queryByLabelText("Password")).toBeNull();
      expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
      // The disclaimer stands cascaded behind its one button — its
      // words are not printed on the landing surface.
      expect(screen.queryByText("Authorized access only")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Disclaimer and legal notice" }));
      expect(screen.getByText("Authorized access only")).toBeInTheDocument();
      // The register turn-away answers exactly as ordered.
      fireEvent.click(screen.getByRole("button", { name: "Do you need to register?" }));
      expect(
        screen.getByText("Registrations are down until further notice."),
      ).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, "mediaDevices");
    }
  });

  it("offers badge scan and ID upload at the gate before any sign-in field", async () => {
    // The three verification paths (owner order 2026-11-27): picture,
    // badge QR scan, ID upload — all before the credential fields.
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return false;
        }
      },
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    try {
      render(<OperatorGate />);
      await passDoor();

      expect(await screen.findByRole("heading", { name: "Operator sign-in" })).toBeInTheDocument();
      // Badge path: jsdom has no BarcodeDetector, so the gate says so
      // plainly and the fields stay hidden — no fake scan, no pass.
      fireEvent.click(screen.getByRole("button", { name: "Scan my badge" }));
      fireEvent.click(screen.getByRole("button", { name: "Start the badge scan" }));
      expect(screen.getByText(/cannot read QR codes live/)).toBeInTheDocument();
      expect(screen.queryByLabelText("Email")).toBeNull();
      // Upload path: an ID picture is received, logged, and only then
      // do the credential fields appear.
      fireEvent.click(screen.getByRole("button", { name: "Upload my ID" }));
      const fileInput = screen.getByLabelText("Upload a picture of your ID or badge");
      fireEvent.change(fileInput, {
        target: { files: [new File(["badge"], "badge.png", { type: "image/png" })] },
      });
      expect(await screen.findByText(/Picture received/)).toBeInTheDocument();
      expect(await screen.findByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, "mediaDevices");
    }
  });

  it("mounts the avatar only after the server authorizes a restored session", async () => {
    auth.setInitialSession({ access_token: "session" });
    mocks.verifySession.mockResolvedValue({
      configured: true,
      authorized: true,
      operatorName: "Configured operator",
      operatorFullName: "Configured full name",
    });

    render(<OperatorGate />);

    expect(await screen.findByTestId("avatar-stage", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId("avatar-stage")).toHaveAttribute(
      "data-operator-name",
      "Configured operator",
    );
    expect(screen.getByTestId("avatar-stage")).toHaveAttribute(
      "data-operator-full-name",
      "Configured full name",
    );
    expect(mocks.verifySession).toHaveBeenCalledWith({ data: { accessToken: "session" } });
  });

  it("authenticates with password, verifies operator identity, and supports sign-out", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "session" } },
      error: null,
    });
    mocks.verifySession.mockResolvedValue({
      configured: true,
      authorized: true,
      operatorName: null,
      operatorFullName: null,
    });
    render(<OperatorGate />);
    await passDoor();
    // jsdom cannot run the gate check: the visitor continues by the
    // gate's button (which records the attempt), then signs in.
    fireEvent.click(
      await screen.findByRole("button", { name: "Continue with email and password" }),
    );
    const signInButton = await screen.findByRole("button", { name: "Sign in" });

    fireEvent.submit(signInButton.closest("form")!);

    expect(await screen.findByTestId("avatar-stage", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(auth.signInWithPassword).toHaveBeenCalledOnce();
    expect(mocks.verifySession).toHaveBeenCalledWith({ data: { accessToken: "session" } });

    fireEvent.click(screen.getByRole("button", { name: "Test sign out" }));

    // Signing out shuts the door behind him: the rain stands
    // again, and the secure screen waits for the name once more.
    expect(await screen.findByTestId("login-wall")).toBeInTheDocument();
    expect(auth.signOut).toHaveBeenCalledOnce();
    await passDoor();
    expect(await screen.findByRole("heading", { name: "Operator sign-in" })).toBeInTheDocument();
  });

  it("signs out an authenticated but non-operator account and keeps the avatar hidden", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "session" } },
      error: null,
    });
    mocks.verifySession.mockResolvedValue({
      configured: true,
      authorized: false,
      operatorName: null,
      operatorFullName: null,
    });
    render(<OperatorGate />);
    await passDoor();
    fireEvent.click(
      await screen.findByRole("button", { name: "Continue with email and password" }),
    );
    const form = await screen.findByRole("button", { name: "Sign in" });

    fireEvent.submit(form.closest("form")!);

    expect(
      await screen.findByText("This account is not authorized for operator access."),
    ).toBeInTheDocument();
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
    expect(screen.queryByTestId("avatar-stage")).not.toBeInTheDocument();
  });

  it("does not unlock when the server reports missing allowlist configuration", async () => {
    auth.setInitialSession({ access_token: "session" });
    mocks.verifySession.mockResolvedValue({
      configured: false,
      authorized: false,
      operatorName: null,
      operatorFullName: null,
    });

    render(<OperatorGate />);
    await passDoor();

    expect(
      await screen.findByRole("heading", { name: "Sign-in not configured" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("avatar-stage")).not.toBeInTheDocument();
  });

  it("hides first-account setup once an operator has claimed the registry", async () => {
    mocks.bootstrapStatus.mockResolvedValue({ configured: true, claimed: true });

    render(<OperatorGate />);
    await passDoor();

    expect(await screen.findByRole("heading", { name: "Operator sign-in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set up first operator account" })).toBeNull();
  });

  it("requires TOTP verification before authorizing the operator session", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "aal1-session" } },
      error: null,
    });
    mocks.verifySession
      .mockResolvedValueOnce({
        configured: true,
        authorized: false,
        requiresMfa: true,
      })
      .mockResolvedValueOnce({
        configured: true,
        authorized: true,
        operatorName: null,
        operatorFullName: null,
      });

    render(<OperatorGate />);
    await passDoor();
    fireEvent.click(
      await screen.findByRole("button", { name: "Continue with email and password" }),
    );
    const signInButton = await screen.findByRole("button", { name: "Sign in" });
    fireEvent.submit(signInButton.closest("form")!);

    expect(await screen.findByAltText("Authenticator setup QR code")).toBeInTheDocument();
    expect(auth.mfa.enroll).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("avatar-stage")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Verify" }).closest("form")!);

    expect(await screen.findByTestId("avatar-stage", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: "factor",
      code: "123456",
    });
  });

  it("allows first-account setup only while the registry is unclaimed", async () => {
    const password = crypto.randomUUID();
    const email = ["operator", "example.invalid"].join(String.fromCharCode(64));
    auth.signUp.mockResolvedValue({
      data: { session: { access_token: "first-session" } },
      error: null,
    });
    mocks.verifySession.mockResolvedValue({
      configured: true,
      authorized: false,
      requiresMfa: true,
    });

    render(<OperatorGate />);
    await passDoor();
    fireEvent.click(await screen.findByRole("button", { name: "Set up first operator account" }));

    expect(screen.getByRole("heading", { name: "Set up operator account" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Create operator account" }).closest("form")!,
    );

    expect(await screen.findByAltText("Authenticator setup QR code")).toBeInTheDocument();
    expect(auth.signUp).toHaveBeenCalledWith({ email, password });
  });

  it("a saved login on this device passes the name door on return", async () => {
    // The device record stands from a previous visit: the
    // secure screen opens without the box ever being touched.
    localStorage.setItem(
      "augi.saved-login.v1",
      JSON.stringify({
        seat: 0,
        godName: "Anubis",
        personName: "Domenick Arlon Hall",
        savedAt: "2026-11-28T05:30:00.000Z",
        device: { userAgent: "Test Browser", platform: "TestOS", language: "en-US" },
      }),
    );
    render(<OperatorGate />);
    expect(await screen.findByRole("heading", { name: "Operator sign-in" })).toBeInTheDocument();
    expect(screen.queryByTestId("login-wall")).toBeNull();
    // And the screen says the device is remembered, with the
    // way to forget it standing right there.
    expect(screen.getByText(/Your login is saved on this device/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forget this device" })).toBeInTheDocument();
  });

  it("saves the login on this device, and signing out forgets the device", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "session" } },
      error: null,
    });
    mocks.verifySession.mockResolvedValue({
      configured: true,
      authorized: true,
      operatorName: null,
      operatorFullName: null,
    });
    render(<OperatorGate />);
    await passDoor();

    fireEvent.click(await screen.findByRole("button", { name: "Save my login on this device" }));
    const saved = readSavedLogin(localStorage);
    expect(saved?.seat).toBe(0);
    expect(saved?.godName).toBe("Anubis");
    expect(saved?.personName).toBe("Domenick Arlon Hall");
    expect(saved?.device.userAgent.length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: "Forget this device" })).toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole("button", { name: "Continue with email and password" }),
    );
    const signInButton = await screen.findByRole("button", { name: "Sign in" });
    fireEvent.submit(signInButton.closest("form")!);
    expect(await screen.findByTestId("avatar-stage", {}, { timeout: 3000 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Test sign out" }));
    expect(await screen.findByTestId("login-wall")).toBeInTheDocument();
    expect(readSavedLogin(localStorage)).toBeNull();
  });

  it("counts a wrong name on the server — and still says nothing", async () => {
    const { container } = render(<OperatorGate />);
    const wall = await screen.findByTestId("login-wall");
    fireEvent.click(wall);
    const input = await screen.findByLabelText("The name of your god");
    fireEvent.change(input, { target: { value: "Montu" } });
    fireEvent.submit(input.closest("form")!);

    // The strike is recorded server-side; the screen's answer
    // is the same silence as ever — no counter, no warning.
    await waitFor(() => expect(mocks.doorStrike).toHaveBeenCalledOnce());
    expect(screen.queryByLabelText("The name of your god")).toBeNull();
    expect(await screen.findByTestId("login-wall")).toBeInTheDocument();
    expect(container.textContent?.trim()).toBe("");
  });

  it("the third wrong name raises the cube — the door is gone", async () => {
    mocks.doorStrike.mockResolvedValue({ available: true, strikes: 3, restricted: true });
    render(<OperatorGate />);
    const wall = await screen.findByTestId("login-wall");
    fireEvent.click(wall);
    const input = await screen.findByLabelText("The name of your god");
    fireEvent.change(input, { target: { value: "Zeus" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByTestId("cube-strike")).toBeInTheDocument();
    expect(screen.queryByTestId("login-wall")).toBeNull();
    expect(screen.queryByLabelText("The name of your god")).toBeNull();
  });

  it("a restricted address gets the cube on arrival — never the door, not even by a saved login", async () => {
    mocks.doorStatus.mockResolvedValue({ available: true, strikes: 3, restricted: true });
    localStorage.setItem(
      "augi.saved-login.v1",
      JSON.stringify({
        seat: 0,
        godName: "Anubis",
        personName: "Domenick Arlon Hall",
        savedAt: "2026-11-28T05:30:00.000Z",
        device: { userAgent: "Test Browser", platform: "TestOS", language: "en-US" },
      }),
    );
    render(<OperatorGate />);

    expect(await screen.findByTestId("cube-strike")).toBeInTheDocument();
    expect(screen.queryByTestId("login-wall")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Operator sign-in" })).toBeNull();
  });

  it("a failed sign-in shuts the door — back to the rain, nothing presented", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });
    render(<OperatorGate />);
    await passDoor();
    fireEvent.click(
      await screen.findByRole("button", { name: "Continue with email and password" }),
    );
    const signInButton = await screen.findByRole("button", { name: "Sign in" });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "operator@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.submit(signInButton.closest("form")!);

    // No persistent form for an unverified session: the rain
    // stands, the fields and buttons are gone, and the way
    // back is the door itself.
    expect(await screen.findByTestId("login-wall")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(auth.signInWithPassword).toHaveBeenCalledOnce();
  });

  it("a rejected verification code shuts the door the same way", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "aal1-session" } },
      error: null,
    });
    auth.mfa.challengeAndVerify.mockResolvedValue({
      data: { access_token: null },
      error: { message: "Invalid TOTP code" },
    });
    mocks.verifySession.mockResolvedValue({
      configured: true,
      authorized: false,
      requiresMfa: true,
      operatorName: null,
      operatorFullName: null,
    });
    render(<OperatorGate />);
    await passDoor();
    fireEvent.click(
      await screen.findByRole("button", { name: "Continue with email and password" }),
    );
    const signInButton = await screen.findByRole("button", { name: "Sign in" });
    fireEvent.submit(signInButton.closest("form")!);

    expect(await screen.findByAltText("Authenticator setup QR code")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "000000" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Verify" }).closest("form")!);

    expect(await screen.findByTestId("login-wall")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verify" })).toBeNull();
    expect(screen.queryByTestId("avatar-stage")).not.toBeInTheDocument();
  });
});
