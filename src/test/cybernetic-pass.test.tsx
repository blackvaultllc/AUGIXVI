import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PresenceRing } from "@/avatar/PresenceRing";
import { CalledGodPopUp } from "@/avatar/CalledGodPopUp";
import { AnnotatedAnalysis } from "@/avatar/AnnotatedAnalysis";
import { CameraAnalysisBlock } from "@/avatar/cameras/CameraAnalysisBlock";
import { DevicesWindow } from "@/avatar/DevicesWindow";
import { SoundWatchWindow } from "@/avatar/SoundWatchWindow";
import { saveRegistry, type DeviceProfile } from "@/avatar/devices/deviceRegistry";
import {
  publishSoundEntry,
  resetSoundFeedForTest,
  unacknowledgedSoundAlerts,
  currentSoundFeed,
} from "@/avatar/soundWatchFeed";
import { ALL_STOP_STORAGE_KEY } from "@/avatar/devices/deviceStoreCore";
import type { SoundEventEntry } from "@/avatar/soundWatch";

/**
 * THE CYBERNETIC PASS (2026-11-26) — the component-layer pins:
 * the ring wears ALERT only when the signal says so; Second
 * Look stamps render on both analyzer surfaces (NOT CONFIRMED
 * dimmed, never deleted; an unrun pass says FIRST PASS ONLY);
 * the Devices window carries the Captain's All-Stop, the Law
 * in Force, and the Earned Maps shelf; the Sound Watch window
 * is where an alert is acknowledged.
 */

describe("PresenceRing — the ALERT state on the metal", () => {
  it("renders data-ring-state=alert with every segment in the alert tone", () => {
    const { container } = render(
      <PresenceRing ready speaking={false} listening={false} acting={false} alert />,
    );
    const ring = container.querySelector(".presence-ring");
    expect(ring?.getAttribute("data-ring-state")).toBe("alert");
    expect(container.querySelectorAll(".presence-ring__seg--alert")).toHaveLength(24);
  });

  it("without the alert signal the ring keeps its ordinary states", () => {
    const { container } = render(
      <PresenceRing ready speaking listening={false} acting={false} />,
    );
    expect(container.querySelector(".presence-ring")?.getAttribute("data-ring-state")).toBe(
      "speaking",
    );
    expect(container.querySelectorAll(".presence-ring__seg--alert")).toHaveLength(0);
  });
});

describe("the Call Card — name, real role, state word; nothing invented", () => {
  it("stands beside Montu's circle while he holds the call", () => {
    const { container } = render(
      <CalledGodPopUp god="montu" speaking onSelect={vi.fn()} />,
    );
    const card = container.querySelector(".called-god-popup__card");
    expect(card?.textContent).toContain("Montu");
    expect(card?.textContent).toContain("commander of the army — cyber security defense");
    expect(card?.textContent).toContain("Speaking");
    // No stats, no levels: the card carries no digits at all.
    expect(card?.textContent ?? "").not.toMatch(/\d/);
  });

  it("the state word follows the pop-up's real states", () => {
    const { container, rerender } = render(
      <CalledGodPopUp god="montu" speaking={false} onSelect={vi.fn()} />,
    );
    expect(container.querySelector(".called-god-popup__state")?.textContent).toBe("On the call");
    rerender(<CalledGodPopUp god="montu" speaking={false} bowing onSelect={vi.fn()} />);
    expect(container.querySelector(".called-god-popup__state")?.textContent).toBe(
      "Taking his leave",
    );
  });

  it("Anubis has no pop-up and no card — the center is his place", () => {
    const { container } = render(
      <CalledGodPopUp god="anubis" speaking={false} onSelect={vi.fn()} />,
    );
    expect(container.querySelector(".called-god-popup__card")).toBeNull();
  });
});

describe("Second Look — the stamps on the picture analyzer", () => {
  const items = [
    { text: "a red door", point: { x: 200, y: 300 } },
    { text: "a cat on the sill", point: null },
  ];

  it("VERIFIED stands plain; NOT CONFIRMED stands dimmed and stays on the record", () => {
    const { container } = render(
      <AnnotatedAnalysis
        src="data:image/png;base64,AAAA"
        alt="a room"
        items={items}
        marksMode="placed"
        verdicts={[
          { text: "a red door", verdict: "verified" },
          { text: "a cat on the sill", verdict: "not-confirmed" },
        ]}
      />,
    );
    expect(container.textContent).toContain("VERIFIED");
    expect(container.textContent).toContain("NOT CONFIRMED");
    // The unconfirmed finding is still listed — dimmed, not deleted.
    expect(container.textContent).toContain("a cat on the sill");
    const rows = container.querySelectorAll(".analyzer-findings__item");
    expect(rows[1]?.className).toContain("analyzer-findings__item--not-confirmed");
    expect(rows[0]?.className).not.toContain("analyzer-findings__item--not-confirmed");
  });

  it("an unrun second look says FIRST PASS ONLY and stamps nothing", () => {
    const { container } = render(
      <AnnotatedAnalysis
        src="data:image/png;base64,AAAA"
        alt="a room"
        items={items}
        marksMode="placed"
        secondLookNote="FIRST PASS ONLY — the second look could not run (the vision model is not answering), so none of these findings is verified."
      />,
    );
    expect(container.textContent).toContain("FIRST PASS ONLY");
    expect(container.textContent).not.toContain("VERIFIED");
  });
});

describe("Second Look — the stamps on the camera analysis", () => {
  it("stamps the findings and dims the unconfirmed one", () => {
    const { container } = render(
      <CameraAnalysisBlock
        state={{
          kind: "done",
          reading: {
            text: "A porch.",
            findings: ["a door", "a person"],
            model: "llava:7b",
          },
          at: Date.now(),
          secondLook: {
            status: "done",
            verdicts: [
              { text: "a door", verdict: "verified" },
              { text: "a person", verdict: "not-confirmed" },
            ],
          },
        }}
      />,
    );
    expect(container.textContent).toContain("VERIFIED");
    expect(container.textContent).toContain("NOT CONFIRMED");
    const rows = container.querySelectorAll(".window-cameras__findings li");
    expect(rows[1]?.className).toContain("is-not-confirmed");
    expect(rows[0]?.className).not.toContain("is-not-confirmed");
  });

  it("an unavailable second look labels the reading FIRST PASS ONLY", () => {
    const { container } = render(
      <CameraAnalysisBlock
        state={{
          kind: "done",
          reading: { text: "A porch.", findings: ["a door"], model: "llava:7b" },
          at: Date.now(),
          secondLook: { status: "unavailable", reason: "the vision model is not answering" },
        }}
      />,
    );
    expect(container.textContent).toContain("FIRST PASS ONLY");
    expect(container.textContent).not.toContain("VERIFIED");
  });
});

function seededDevice(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
  return {
    id: "device-seed",
    displayName: "Cube Node One",
    kind: "cube-node",
    transport: "ble",
    externalId: "SN-001",
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

describe("Devices window — the All-Stop, the Law in Force, Earned Maps", () => {
  beforeEach(() => {
    localStorage.clear();
    saveRegistry([seededDevice()]);
  });

  it("shows the stop LIVE, the law counted from the registry, and the empty shelf honestly", () => {
    render(<DevicesWindow onClose={vi.fn()} />);
    expect(screen.getByText("The All-Stop")).toBeTruthy();
    expect(screen.getByText(/Live\./)).toBeTruthy();
    expect(screen.getByText(/1 device registered/)).toBeTruthy();
    expect(screen.getByText(/1 with control granted/)).toBeTruthy();
    expect(screen.getByText("Earned Maps")).toBeTruthy();
    expect(screen.getByText("No control maps earned yet.")).toBeTruthy();
  });

  it("the Captain's button engages the stop — and the state is written to the cache", () => {
    render(<DevicesWindow onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Engage the ALL-STOP/i }));
    expect(screen.getByText(/STOPPED\./)).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem(ALL_STOP_STORAGE_KEY)!) as {
      active: boolean;
    };
    expect(stored.active).toBe(true);
    // And his hand releases it again.
    fireEvent.click(screen.getByRole("button", { name: /Release the ALL-STOP/i }));
    expect(screen.getByText(/Live\./)).toBeTruthy();
  });
});

describe("Sound Watch window — acknowledgment lives in the owning surface", () => {
  beforeEach(() => {
    resetSoundFeedForTest();
    localStorage.clear();
  });

  it("a standing feed alert shows here, and Acknowledge clears it on the record", () => {
    const entry: SoundEventEntry = {
      id: "sound-alert-1",
      at: Date.now(),
      label: "glass breaking",
      source: "library",
      confidence: null,
      peakDb: -10,
      distanceBand: "NEAR",
      distanceIsEstimate: true,
      durationMs: 700,
      character: "peak -10 dB",
      fingerprint: [1, 2],
      alert: true,
    };
    publishSoundEntry(entry);
    expect(unacknowledgedSoundAlerts(currentSoundFeed())).toHaveLength(1);
    render(<SoundWatchWindow onClose={vi.fn()} />);
    const button = screen.getByRole("button", { name: /^Acknowledge$/ });
    fireEvent.click(button);
    expect(unacknowledgedSoundAlerts(currentSoundFeed())).toHaveLength(0);
    expect(screen.getByText(/Acknowledged/)).toBeTruthy();
  });
});
