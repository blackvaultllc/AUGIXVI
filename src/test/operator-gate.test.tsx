import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperatorGate } from "@/avatar/OperatorGate";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  bootstrapStatus: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/avatar/operatorAuth.server", () => ({
  getOperatorBootstrapStatus: mocks.bootstrapStatus,
  verifySupabaseOperatorSession: mocks.verifySession,
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

  it("fails closed and explains when Supabase Auth is not configured", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    const { container } = render(<OperatorGate />);

    expect(screen.getByRole("heading", { name: "Sign-in not configured" })).toBeInTheDocument();
    expect(screen.queryByTestId("avatar-stage")).not.toBeInTheDocument();
    expect(container.querySelector("input")).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("shows only the sign-in form before authorization", async () => {
    render(<OperatorGate />);

    expect(await screen.findByRole("heading", { name: "Operator sign-in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set up first operator account" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByTestId("avatar-stage")).not.toBeInTheDocument();
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://project.invalid",
      "public-placeholder",
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: true, autoRefreshToken: true }),
      }),
    );
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
