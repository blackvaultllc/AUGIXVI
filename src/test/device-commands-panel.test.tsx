import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceCommandsPanel } from "@/avatar/devices/DeviceCommandsPanel";
import { saveBinding } from "@/avatar/devices/commandModule";
import { WEPWAWET_DOG_PROFILE } from "@/avatar/devices/commandProfiles";
import { WEPWAWET_REMOTE_IDS } from "@/avatar/devices/wepwawetRemote";
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

  it("frame authoring: a new broadcast device is onboarded in-system and its frame sends", async () => {
    // Plan item C (2026-11-24): a dog-class device the system has
    // never seen — named, given a sender under ~/augie-tools/, and
    // one authored FRAME command — entirely through the setup form.
    const calls: { url: string; body: { deviceId?: string; hex: string; holdMs: number; live: boolean } }[] = [];
    globalThis.fetch = vi.fn(async (url: unknown, init?: { body?: string }) => {
      calls.push({
        url: String(url),
        body: JSON.parse(init?.body ?? "{}") as (typeof calls)[number]["body"],
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, mode: "dry", output: "printed" }),
      };
    }) as unknown as typeof fetch;
    render(<DeviceCommandsPanel device={device()} />);
    fireEvent.click(screen.getByRole("button", { name: /Set up commands for this device/ }));
    fireEvent.change(screen.getByLabelText(/Step 1 — How does Augie reach it/), {
      target: { value: "bluetooth-broadcast" },
    });
    fireEvent.change(screen.getByLabelText(/Step 2 — Which command set fits it/), {
      target: { value: "custom" },
    });
    fireEvent.change(screen.getByLabelText(/Name for his command set/), {
      target: { value: "Porch bot set" },
    });
    fireEvent.change(screen.getByLabelText(/Sender script/), {
      target: { value: "porchbot/porchbot-send.py" },
    });
    fireEvent.change(screen.getByLabelText(/Step 3 — Its address/), {
      target: { value: "B0B5CA11" },
    });
    fireEvent.change(screen.getByLabelText(/Command name/), { target: { value: "Wave" } });
    fireEvent.change(screen.getByLabelText(/The frame it sends/), {
      target: { value: "E0 00 00 00 00 07 500" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add this command/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save command setup" }));
    expect(screen.getByText(/Command set: Porch bot set/)).toBeTruthy();
    const waveItem = screen.getByText("Wave").closest("li");
    if (!waveItem) throw new Error("Wave command not rendered");
    const sendButton = waveItem.querySelector("button");
    if (!sendButton) throw new Error("no send button for Wave");
    fireEvent.click(sendButton);
    await waitFor(() => {
      expect(calls.length).toBe(2); // the command frame, then the zero frame
    });
    expect(calls[0]!.url).toBe("/api/devices/bridge");
    expect(calls[0]!.body.deviceId).toBe("device-panel");
    expect(calls[0]!.body.live).toBe(false);
    const { framesForBroadcastCommand, payloadHex } = await import(
      "@/avatar/devices/wepwawetFrame"
    );
    const expected = framesForBroadcastCommand(
      { cmd: 0xe0, data: [0, 0, 0, 0, 7], holdMs: 500 },
      [0xb0, 0xb5, 0xca, 0x11],
    );
    expect(calls[0]!.body.hex).toBe(payloadHex(expected[0]!.payload).replace(/ /g, ""));
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

describe("Device commands panel — Wepwawet's card", () => {
  const SENDER_WORDS =
    "DRY RUN — nothing transmitted. The bridge frame would air: [frame] 500 ms: 00 0c d0";
  let fetchCalls: {
    url: string;
    body: { deviceId?: string; hex: string; holdMs: number; live: boolean };
  }[] = [];

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    fetchCalls = [];
    globalThis.fetch = vi.fn(async (url: unknown, init?: { body?: string }) => {
      fetchCalls.push({
        url: String(url),
        body: JSON.parse(init?.body ?? "{}") as { hex: string; holdMs: number; live: boolean },
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, mode: "dry", output: SENDER_WORDS }),
      };
    }) as unknown as typeof fetch;
    saveBinding({
      deviceId: "device-dog",
      profileId: "wepwawet-ble-broadcast",
      address: "A947C15E",
    });
  });

  const dogDevice = () => device({ id: "device-dog", displayName: "Wepwawet" });

  const sendButtonFor = (name: string) => {
    // The remote repeats the command names on its own buttons; the
    // Send button lives in the grouped list's <li>, so pick the
    // match that stands inside a list item.
    const matches = screen.getAllByText(name, { exact: true });
    const el = matches.find((m) => m.closest("li"));
    const item = el?.closest("li");
    if (!item) throw new Error(`${name} command not rendered`);
    const button = item.querySelector("button");
    if (!button) throw new Error(`no send button for ${name}`);
    return button;
  };

  it("shows the full function set grouped in plain words, instructions, and the practice switch", () => {
    render(<DeviceCommandsPanel device={dogDevice()} />);
    for (const group of [
      "Stop & connect",
      "Move",
      "Tricks & poses",
      "Feeding — the eight pictured items",
      "Sounds — everything he can say",
      "Light & modes",
      "Program",
    ]) {
      expect(screen.getByText(group)).toBeTruthy();
    }
    for (const name of [
      "Stop",
      "Forward",
      "Dance",
      "Feed 8",
      "Song",
      "Music step",
      "Program — execute",
    ]) {
      // Names stand on the grouped list AND on the remote — both
      // surfaces carry them; presence is what this check pins.
      expect(screen.getAllByText(name, { exact: true }).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("How to control Wepwawet")).toBeTruthy();
    expect(screen.getByText(/press-and-hold the switch under the dog/)).toBeTruthy();
    expect(screen.getByText(/speaks only his own built-in sounds and songs/)).toBeTruthy();
    expect(screen.getByText(/your eyes confirm he obeyed/)).toBeTruthy();
    const liveSwitch = screen.getByRole("switch", { name: "Live fire switch" });
    expect(liveSwitch.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/Practice — nothing goes on air/)).toBeTruthy();
  });

  it("a practice send walks the bridge in dry mode — frames printed, live flag false", async () => {
    render(<DeviceCommandsPanel device={dogDevice()} />);
    fireEvent.click(sendButtonFor("Stop"));
    await waitFor(() => {
      expect(screen.getAllByText(/Practice run/).length).toBeGreaterThan(0);
    });
    // Stop airs its burst then the zero frame: two bridge calls.
    // Since the device-setup build (2026-11-24) the dog goes through
    // the GENERAL bridge under his own device id — the frames are
    // the same bytes the dog-only door carried.
    expect(fetchCalls.length).toBe(2);
    for (const call of fetchCalls) {
      expect(call.url).toBe("/api/devices/bridge");
      expect(call.body.deviceId).toBe("device-dog");
      expect(call.body.live).toBe(false);
      expect(call.body.hex).toMatch(/^[0-9a-f]{46}$/);
    }
    // The sender's own printed words land on the card as the receipt.
    expect(screen.getByText("The Parrot sender printed")).toBeTruthy();
    expect(screen.getAllByText(new RegExp(SENDER_WORDS.slice(0, 24))).length).toBeGreaterThan(0);
  });

  it("the sound pick list states its limit and a Never use pick switches that Send off", () => {
    render(<DeviceCommandsPanel device={dogDevice()} />);
    expect(screen.getByText(/These are all the sounds he has/)).toBeTruthy();
    expect(screen.getByText(/the dog picks the track himself/)).toBeTruthy();
    for (const name of ["Dance", "Song", "Learn / story", "AI content", "Music step"]) {
      expect(
        screen.getByRole("switch", { name: `Sound pick for ${name}` }),
      ).toBeTruthy();
    }
    const songSend = sendButtonFor("Song");
    expect((songSend as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("switch", { name: "Sound pick for Song" }));
    expect(screen.getByText(/never use this sound/)).toBeTruthy();
    expect((sendButtonFor("Song") as HTMLButtonElement).disabled).toBe(true);
    // The pick persists across a remount — it is his standing choice.
    fireEvent.click(screen.getByRole("switch", { name: "Sound pick for Song" }));
    expect((sendButtonFor("Song") as HTMLButtonElement).disabled).toBe(false);
  });

  it("the light carries no colour promise and the Light test note stands on the card", () => {
    render(<DeviceCommandsPanel device={dogDevice()} />);
    expect(screen.getAllByText(/no colour code/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Light test — still an open question/)).toBeTruthy();
    expect(screen.getByText(/until a steady red is found or proven absent/)).toBeTruthy();
  });

  it("the battery test log starts empty and records a watched run", () => {
    render(<DeviceCommandsPanel device={dogDevice()} />);
    expect(screen.getByText(/Battery test — measure him, because he cannot report/)).toBeTruthy();
    expect(screen.getByText(/No runs logged yet/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("e.g. 47"), { target: { value: "47" } });
    fireEvent.click(screen.getByRole("button", { name: /Add run/ }));
    expect(screen.getByText(/Idle — awake, no commands · 47 min/)).toBeTruthy();
    expect(screen.queryByText(/No runs logged yet/)).toBeNull();
  });

  it("flipping the switch makes the same tap a LIVE send with the proven 3000 ms movement hold", async () => {
    render(<DeviceCommandsPanel device={dogDevice()} />);
    fireEvent.click(screen.getByRole("switch", { name: "Live fire switch" }));
    expect(screen.getByText(/LIVE — taps move the dog/)).toBeTruthy();
    fireEvent.click(sendButtonFor("Forward"));
    await waitFor(() => {
      expect(screen.getAllByText(/Broadcast on air/).length).toBeGreaterThan(0);
    });
    expect(fetchCalls.length).toBe(2);
    expect(fetchCalls[0]!.body.live).toBe(true);
    expect(fetchCalls[0]!.body.holdMs).toBe(3000);
    expect(fetchCalls[1]!.body.holdMs).toBe(500);
  });

  const remote = () => screen.getByRole("region", { name: "Wepwawet remote control" });

  it("the remote layout names only commands the dog profile really has", () => {
    const profileIds = new Set(WEPWAWET_DOG_PROFILE.commands.map((c) => c.id));
    expect(new Set(WEPWAWET_REMOTE_IDS).size).toBe(WEPWAWET_REMOTE_IDS.length);
    for (const id of WEPWAWET_REMOTE_IDS) {
      expect(profileIds.has(id)).toBe(true);
    }
  });

  it("the remote renders a labelled pad, the actions, and the Feed row — no icon-only buttons", () => {
    render(<DeviceCommandsPanel device={dogDevice()} />);
    const r = within(remote());
    expect(r.getByText(/Remote control — click to drive him/)).toBeTruthy();
    expect(r.getByText(/No talking needed/)).toBeTruthy();
    for (const name of [
      "Forward",
      "Back",
      "Turn left",
      "Turn right",
      "Stop",
      "Greet",
      "Sit",
      "Lie down",
      "Dance",
      "Kung fu",
      "Swim",
      "Bless",
      "Act cute",
      "Handstand",
      "Push-ups",
      "Patrol",
      "Pee",
      "Light",
      "Song",
      "Learn / story",
      "AI content",
      "Feed 1",
      "Feed 8",
    ]) {
      expect(r.getByRole("button", { name })).toBeTruthy();
    }
    // Every button on the remote carries words a person can read.
    for (const button of r.getAllByRole("button")) {
      expect(button.textContent?.trim().length).toBeGreaterThan(0);
    }
    expect(r.getByText(/Remote is in Practice/)).toBeTruthy();
  });

  it("a remote click in Practice walks the same bridge, dry — frames printed, live flag false", async () => {
    render(<DeviceCommandsPanel device={dogDevice()} />);
    fireEvent.click(within(remote()).getByRole("button", { name: "Forward" }));
    await waitFor(() => {
      expect(screen.getAllByText(/Practice run/).length).toBeGreaterThan(0);
    });
    expect(fetchCalls.length).toBe(2);
    for (const call of fetchCalls) {
      expect(call.url).toBe("/api/devices/bridge");
      expect(call.body.deviceId).toBe("device-dog");
      expect(call.body.live).toBe(false);
    }
    expect(fetchCalls[0]!.body.holdMs).toBe(3000);
    // The remote reports its own click's outcome under itself.
    expect(within(remote()).getByText(/Remote — Forward:/)).toBeTruthy();
  });

  it("the LIVE switch governs the remote exactly as it governs the card", async () => {
    render(<DeviceCommandsPanel device={dogDevice()} />);
    fireEvent.click(screen.getByRole("switch", { name: "Live fire switch" }));
    expect(within(remote()).getByText(/Remote is LIVE/)).toBeTruthy();
    fireEvent.click(within(remote()).getByRole("button", { name: "Back" }));
    await waitFor(() => {
      expect(screen.getAllByText(/Broadcast on air/).length).toBeGreaterThan(0);
    });
    expect(fetchCalls.length).toBe(2);
    expect(fetchCalls[0]!.body.live).toBe(true);
    expect(fetchCalls[0]!.body.holdMs).toBe(3000);
  });

  it("a Never use sound pick disables that button on the remote too", () => {
    render(<DeviceCommandsPanel device={dogDevice()} />);
    const r = within(remote());
    expect(
      (r.getByRole("button", { name: "Song" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole("switch", { name: "Sound pick for Song" }));
    expect(
      (r.getByRole("button", { name: /Song — set to Never use/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("without the control grant every remote button is disabled", () => {
    render(
      <DeviceCommandsPanel
        device={device({ id: "device-dog", displayName: "Wepwawet", controlGranted: false })}
      />,
    );
    for (const button of within(remote()).getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("the RETIRED dog's card: the SOLD banner stands, the switch and remote are gone, every Send is dead", () => {
    render(
      <DeviceCommandsPanel
        device={device({
          id: "device-dog",
          displayName: "Wepwawet",
          retired: {
            at: Date.parse("2026-11-24T20:42:00-06:00"),
            note: "Sold on 2026-11-24 — retired the same day.",
          },
        })}
      />,
    );
    // The retired state, plainly, with the date.
    expect(screen.getByText(/SOLD — retired 2026-11-24/)).toBeTruthy();
    // No Practice / LIVE switch for this device — not hidden, gone.
    expect(screen.queryByRole("switch", { name: "Live fire switch" })).toBeNull();
    // No remote to drive a dog that is not his anymore.
    expect(screen.queryByRole("region", { name: "Wepwawet remote control" })).toBeNull();
    // The command list stays as the record — with every Send dead.
    expect((sendButtonFor("Stop") as HTMLButtonElement).disabled).toBe(true);
    expect((sendButtonFor("Forward") as HTMLButtonElement).disabled).toBe(true);
  });
});
