import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DevicesWindow } from "@/avatar/DevicesWindow";
import { saveRegistry, type DeviceProfile } from "@/avatar/devices/deviceRegistry";

/**
 * DEVICES WINDOW (2026-11-21) — the device-understanding sector UI.
 * jsdom has no Web Bluetooth, which pins the honest UNAVAILABLE state;
 * the real-hardware profiling path cannot be exercised here and is
 * BUILT, NOT YET VERIFIED on hardware. These tests pin the registry
 * list, the manual/probe entry flow, and the capability report card.
 */
function seeded(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
  return {
    id: "device-seed",
    displayName: "Cube Node One",
    kind: "cube-node",
    transport: "ble",
    externalId: "SN-001",
    source: "ble-profile",
    declaredServices: [
      {
        uuid: "0000180f-0000-1000-8000-00805f9b34fb",
        name: "Battery",
        known: true,
        characteristics: [],
      },
      {
        uuid: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
        name: "Nordic UART (vendor)",
        known: true,
        characteristics: [],
      },
      {
        uuid: "f000aa45-0451-4000-b000-000000000000",
        name: null,
        known: false,
        characteristics: [],
      },
    ],
    capabilities: [
      "battery level readable",
      "serial data channel (Nordic UART) — can send and receive raw data",
    ],
    limitations: [
      "1 custom service found — capabilities need mapping before Augie can claim anything about them.",
    ],
    batteryLevel: 88,
    measured: {},
    presence: "unknown",
    presenceEvents: [],
    firstSeen: 1000,
    lastSeen: 2000,
    ...overrides,
  };
}

describe("Devices window", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("states plainly that Bluetooth profiling is UNAVAILABLE without Web Bluetooth", () => {
    render(<DevicesWindow onClose={vi.fn()} />);
    expect(screen.getByText(/Bluetooth profiling is UNAVAILABLE in this browser/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Profile a Bluetooth device/ })).toBeNull();
  });

  it("labels the Wi-Fi presence watch UNAVAILABLE in the web app — never faked", () => {
    render(<DevicesWindow onClose={vi.fn()} />);
    expect(screen.getByText(/Wi-Fi presence watch is UNAVAILABLE in this web app/)).toBeTruthy();
    expect(screen.getByText(/instead of faking a scan/)).toBeTruthy();
  });

  it("shows the heartbeat rhythm line with the last real check time", async () => {
    render(<DevicesWindow onClose={vi.fn()} />);
    // The check on open lands in the shared watch state; the rhythm
    // line surfaces its real time instead of inventing a schedule.
    expect(
      await screen.findByText(/Presence check rides Augie's heartbeat — last check/),
    ).toBeTruthy();
  });

  it("the Check Wi-Fi signals action reports the unavailable scan honestly", async () => {
    render(<DevicesWindow onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Check Wi-Fi signals/ }));
    expect(await screen.findByText(/cannot scan Wi-Fi networks/)).toBeTruthy();
  });

  it("marking the wand present flips it ACTIVE and surfaces the greeting", () => {
    saveRegistry([
      seeded({
        id: "wand-ui",
        displayName: "Magic Wand",
        kind: "camera",
        transport: "wifi-ap",
        ssid: "SOFTISH-1851",
        activationSsid: "SOFTISH-1851",
        beaconRole: true,
      }),
    ]);
    const onActivated = vi.fn();
    render(<DevicesWindow onClose={vi.fn()} onActivated={onActivated} />);
    expect(screen.getByText(/Status: Unknown — no sighting recorded yet/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Signal strength for this sighting/), {
      target: { value: "-49" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark present" }));
    expect(screen.getByText(/Status: ACTIVE — present and on/)).toBeTruthy();
    expect(screen.getByText(/Magic Wand appeared — Augie is active/)).toBeTruthy();
    expect(screen.getByText(/Sir, do you need any help or anything like that/)).toBeTruthy();
    expect(onActivated).toHaveBeenCalledWith("Magic Wand");
    expect(screen.getByText(/Last signal: -49 dBm/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark gone" }));
    expect(screen.getByText(/Status: GONE — off or out of range/)).toBeTruthy();
  });

  it("shows the empty registry honestly", () => {
    render(<DevicesWindow onClose={vi.fn()} />);
    expect(screen.getByText(/No devices registered yet/)).toBeTruthy();
  });

  it("manual entry registers a probed device and shows its report card", () => {
    render(<DevicesWindow onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Register a device by hand/ }));
    fireEvent.change(screen.getByLabelText(/Device name/), { target: { value: "Magic Wand" } });
    fireEvent.change(screen.getByLabelText(/Transport/), { target: { value: "wifi-ap" } });
    fireEvent.change(screen.getByLabelText(/Wi-Fi SSID/), { target: { value: "SOFTISH-1851" } });
    fireEvent.change(screen.getByLabelText(/Placement \/ role/), {
      target: { value: "glasses-mounted" },
    });
    fireEvent.change(screen.getByLabelText(/Role detail/), { target: { value: "forward eye" } });
    fireEvent.change(screen.getByLabelText(/Signal at last sighting/), {
      target: { value: "-52" },
    });
    fireEvent.click(screen.getByLabelText(/Beacon \/ wand role/));
    fireEvent.change(screen.getByLabelText(/Stream type/), {
      target: { value: "MJPEG over its own Wi-Fi hotspot" },
    });
    fireEvent.change(screen.getByLabelText(/Latency ms/), { target: { value: "210" } });
    fireEvent.change(screen.getByLabelText(/Capabilities \(one per line/), {
      target: { value: "can show a macro close-up view" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save device" }));

    expect(screen.getByRole("article", { name: /Capability report for Magic Wand/ })).toBeTruthy();
    expect(screen.getByText("can show a macro close-up view")).toBeTruthy();
    expect(screen.getByText(/Latency: 210 ms/)).toBeTruthy();
    expect(screen.getByText(/Stream: MJPEG over its own Wi-Fi hotspot/)).toBeTruthy();
    expect(screen.getByText(/Broadcasts Wi-Fi SSID: SOFTISH-1851/)).toBeTruthy();
    expect(screen.getByText(/Placement \/ role: Glasses-mounted — forward eye/)).toBeTruthy();
    expect(screen.getByText(/Activation SSID: SOFTISH-1851/)).toBeTruthy();
    expect(
      screen.getByText(/Beacon \/ wand role: this device's presence activates Augie/),
    ).toBeTruthy();
    expect(screen.getByText(/Signal at last sighting: -52 dBm/)).toBeTruthy();
    expect(screen.getAllByText(/Wi-Fi access point \(its own hotspot\)/).length).toBeGreaterThan(0);
    // Unmeasured numbers stay unclaimed.
    expect(screen.queryByText(/fps/)).toBeNull();
  });

  it("renders a seeded report card with the honest custom-service bucket", () => {
    saveRegistry([seeded()]);
    render(<DevicesWindow onClose={vi.fn()} />);
    expect(
      screen.getByRole("article", { name: /Capability report for Cube Node One/ }),
    ).toBeTruthy();
    expect(screen.getByText("battery level readable")).toBeTruthy();
    expect(screen.getByText(/Battery reported by the device: 88%/)).toBeTruthy();
    expect(screen.getByText(/Custom service — capabilities need mapping/)).toBeTruthy();
    expect(screen.getByText(/ID: SN-001/)).toBeTruthy();
  });

  it("removes a device from the registry", () => {
    saveRegistry([seeded()]);
    render(<DevicesWindow onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByText(/No devices registered yet/)).toBeTruthy();
  });

  it("edits a device in place — pre-filled form, no delete-and-recreate", () => {
    saveRegistry([
      seeded({
        id: "wand-edit",
        displayName: "Magic Wand",
        kind: "camera",
        transport: "wifi-ap",
        ssid: "SOFTISH-1851",
        activationSsid: "SOFTISH-1851",
        beaconRole: true,
        placement: "handheld",
        placementNote: "in my hand",
        presence: "active",
        presenceEvents: [{ kind: "appeared", at: 3000, rssi: -49, via: "manual" }],
      }),
    ]);
    render(<DevicesWindow onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    // The form opens pre-filled with the device's current values.
    expect((screen.getByLabelText(/Device name/) as HTMLInputElement).value).toBe("Magic Wand");
    expect((screen.getByLabelText(/Wi-Fi SSID/) as HTMLInputElement).value).toBe("SOFTISH-1851");
    expect((screen.getByLabelText(/Role detail/) as HTMLInputElement).value).toBe("in my hand");
    fireEvent.change(screen.getByLabelText(/Role detail/), {
      target: { value: "taped to my glasses — forward eye" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    // Same single device, updated in place; presence history survives.
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen.getByText(/Placement \/ role: Handheld — taped to my glasses — forward eye/),
    ).toBeTruthy();
    expect(screen.getByText(/Status: ACTIVE — present and on/)).toBeTruthy();
    expect(screen.getByText(/Appeared · .* · recorded by hand/)).toBeTruthy();
  });
});
