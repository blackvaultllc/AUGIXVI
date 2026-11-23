import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceCommandsPanel } from "@/avatar/devices/DeviceCommandsPanel";
import { saveBinding } from "@/avatar/devices/commandModule";
import type { DeviceProfile } from "@/avatar/devices/deviceRegistry";

/**
 * DEVICE COMMANDS PANEL — the setup flow as the Captain walks it,
 * the Permission Law refusal standing in words on the card, and one
 * real send through the generic HTTP profile against a stubbed
 * network (the device itself is not present; the stub stands where
 * the fetch channel would meet it, and the outcome text says what
 * the stub answered — nothing here claims a hardware success).
 */
function device(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
  return {
    id: "device-panel",
    displayName: "Porch Plug",
    kind: "other",
    transport: "wifi",
    externalId: "",
    source: "manual",
    declaredServices: [],
    capabilities: [],
    limitations: [],
    batteryLevel: null,
    measured: {},
    presence: "unknown",
    presenceEvents: [],
    firstSeen: 1000,
    lastSeen: 2000,
    ownerConfirmed: true,
    controlGranted: true,
    ...overrides,
  };
}

describe("Device commands panel", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("a device with no command setup offers the setup flow, in steps with help", () => {
    render(<DeviceCommandsPanel device={device()} />);
    expect(screen.getByText(/No command setup yet for this device/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Set up commands for this device/ }));
    expect(screen.getByText(/Step 1 — How does Augie reach it\?/)).toBeTruthy();
    expect(screen.getByText(/Step 2 — Which command set fits it\?/)).toBeTruthy();
    expect(screen.getByText(/Step 3 — Its address/)).toBeTruthy();
    expect(screen.getByText(/Help: the wire the commands travel/)).toBeTruthy();
  });

  it("walking the setup saves the binding and the profile's commands appear", () => {
    render(<DeviceCommandsPanel device={device()} />);
    fireEvent.click(screen.getByRole("button", { name: /Set up commands for this device/ }));
    fireEvent.change(screen.getByLabelText(/Step 1 — How does Augie reach it/), {
      target: { value: "network-http" },
    });
    fireEvent.change(screen.getByLabelText(/Step 3 — Its address/), {
      target: { value: "http://192.168.1.50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save command setup" }));
    expect(screen.getByText(/Command set: Network device \(web requests\)/)).toBeTruthy();
    expect(screen.getByText("Status check")).toBeTruthy();
    expect(screen.getByText("Custom request")).toBeTruthy();
  });

  it("his own command can be added during setup and shows in the list", () => {
    render(<DeviceCommandsPanel device={device()} />);
    fireEvent.click(screen.getByRole("button", { name: /Set up commands for this device/ }));
    fireEvent.change(screen.getByLabelText(/Step 1 — How does Augie reach it/), {
      target: { value: "network-http" },
    });
    fireEvent.change(screen.getByLabelText(/Command name/), { target: { value: "Move left" } });
    fireEvent.change(screen.getByLabelText(/What it sends/), {
      target: { value: "/ptz?move=left" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add this command/ }));
    fireEvent.change(screen.getByLabelText(/Step 3 — Its address/), {
      target: { value: "http://192.168.1.60" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save command setup" }));
    expect(screen.getByText("Move left")).toBeTruthy();
  });

  it("control not granted: the refusal stands in words and every Send is closed", () => {
    saveBinding({
      deviceId: "device-panel",
      profileId: "network-http-generic",
      address: "http://192.168.1.50",
    });
    render(<DeviceCommandsPanel device={device({ controlGranted: undefined })} />);
    expect(screen.getByText(/Control is not granted for this device — commands cannot be sent/)).toBeTruthy();
    for (const button of screen.getAllByRole("button", { name: /Send/ })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("a granted HTTP send reports the device's answer and lands in the command record", async () => {
    globalThis.fetch = vi.fn(async () => ({
      status: 200,
      text: async () => "plug is on",
    })) as unknown as typeof fetch;
    saveBinding({
      deviceId: "device-panel",
      profileId: "network-http-generic",
      address: "http://192.168.1.50",
    });
    render(<DeviceCommandsPanel device={device()} />);
    const statusItem = screen.getByText("Status check").closest("li");
    if (!statusItem) throw new Error("status command not rendered");
    const sendButton = statusItem.querySelector("button");
    if (!sendButton) throw new Error("no send button");
    fireEvent.click(sendButton);
    await waitFor(() => {
      expect(screen.getAllByText(/The device answered HTTP 200/).length).toBeGreaterThan(0);
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://192.168.1.50/",
      expect.objectContaining({ method: "GET" }),
    );
    expect(screen.getByText(/Command record for this device/)).toBeTruthy();
    expect(screen.getByText(/Status check · sent/)).toBeTruthy();
  });
});
