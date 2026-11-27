import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperatorGate } from "@/avatar/OperatorGate";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  bootstrapStatus: vi.fn(),
  verifySession: vi.fn(),
  clientConfig: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/avatar/operatorAuth.server", () => ({
  getOperatorBootstrapStatus: mocks.bootstrapStatus,
  verifySupabaseOperatorSession: mocks.verifySession,
  getSupabaseClientConfig: mocks.clientConfig,
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
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders safely before the browser hydrates", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
    try {
      expect(renderToString(<OperatorGate />)).toContain("Checking operator session");
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    }
  });

  it("fails closed and explains when Supabase Auth is not configured", async () => {
    mocks.clientConfig.mockResolvedValue(null);
    vi.stubEnv("VITE_SUPABASE_URL", "");
    const { container } = render(<OperatorGate />);

    // The gate now waits for the server config lookup to settle before
    // declaring itself unconfigured, so the heading arrives asynchronously.
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

    expect(await screen.findByRole("heading", { name: "Operator sign-in" })).toBeInTheDocument();
    expect(auth.signOut).toHaveBeenCalledOnce();
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

    expect(
      await screen.findByRole("heading", { name: "Sign-in not configured" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("avatar-stage")).not.toBeInTheDocument();
  });

  it("hides first-account setup once an operator has claimed the registry", async () => {
    mocks.bootstrapStatus.mockResolvedValue({ configured: true, claimed: true });

    render(<OperatorGate />);

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
});
