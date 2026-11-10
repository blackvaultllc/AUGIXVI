import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CubePanel } from "@/avatar/CubePanel";
import { verifyOperatorAccess } from "@/avatar/operatorAuth.server";

vi.mock("@/avatar/operatorAuth.server", () => ({
  verifyOperatorAccess: vi.fn(),
}));

describe("hidden cube reference panel", () => {
  beforeEach(() => {
    vi.mocked(verifyOperatorAccess).mockReset();
  });

  it("keeps the cube locked when server operator access is not configured", async () => {
    vi.mocked(verifyOperatorAccess).mockResolvedValue({ configured: false, authorized: false });
    render(<CubePanel onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Operator token"), { target: { value: "private" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText(/not configured on the server/)).toBeInTheDocument();
    expect(screen.queryByText("Surface layer")).not.toBeInTheDocument();
  });

  it("shows conversions only after server verification succeeds", async () => {
    vi.mocked(verifyOperatorAccess).mockResolvedValue({ configured: true, authorized: true });
    render(<CubePanel onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Operator token"), { target: { value: "private" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Surface layer")).toBeInTheDocument();
    expect(screen.getByText("101010")).toBeInTheDocument();
    expect(screen.getByText("0x2A")).toBeInTheDocument();
    expect(screen.getByText("Corner 7")).toBeInTheDocument();
    expect(screen.getByText("1010₂ = 0xA = 10₁₀")).toBeInTheDocument();
    expect(screen.getByText(/does not execute code or commands/)).toBeInTheDocument();
    expect(vi.mocked(verifyOperatorAccess).mock.calls[0]?.[0]).toEqual({
      data: { token: "private" },
    });
  });

  it("denies invalid tokens without showing cube contents", async () => {
    vi.mocked(verifyOperatorAccess).mockResolvedValue({ configured: true, authorized: false });
    render(<CubePanel onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Operator token"), { target: { value: "private" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not verified");
    expect(screen.queryByText("Surface layer")).not.toBeInTheDocument();
  });

  it("supports changing the input base and closing after unlock", async () => {
    vi.mocked(verifyOperatorAccess).mockResolvedValue({ configured: true, authorized: true });
    const onClose = vi.fn();
    render(<CubePanel onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Operator token"), { target: { value: "private" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(screen.getByLabelText("Input base")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Input base"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "1111" } });
    expect(screen.getByText("0xF")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes with Escape", () => {
    const onClose = vi.fn();
    render(<CubePanel onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
