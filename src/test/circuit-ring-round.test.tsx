import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnubisPresence } from "@/avatar/AnubisPresence";
import { PresenceRing } from "@/avatar/PresenceRing";
import {
  RING_SEGMENT_COUNT,
  ringPresenceState,
  ringPresenceStateForBridge,
  ringSegments,
} from "@/avatar/presenceRing";
import { stageViewAfterSwipe, swipeDirection } from "@/avatar/stageSwipe";

/**
 * THE CIRCUIT-RING ROUND (owner orders 2026-11-26): his main
 * theme — the circuit field and frame, the presence ring around
 * Anubis's medallion, the recede-and-return, and the phone
 * swipe. These tests pin the laws the round stands on:
 * - the ring reads ONLY the god's real state (the truth law);
 * - the ring stands OUTSIDE the face (the face stays the pure
 *   portrait — the standing pin from anubis-presence.test.tsx);
 * - the recede is wired to the stage's real window state;
 * - the swipe steps the stage's real perspective view, clamped;
 * - the chat dock's clearance survives the theme intact.
 */

const fixCss = readFileSync(
  resolve(process.cwd(), "src/avatar/stage-fix-round.css"),
  "utf8",
);
const stageSource = readFileSync(
  resolve(process.cwd(), "src/avatar/AvatarStage.tsx"),
  "utf8",
);

describe("the presence ring's readings — real state only", () => {
  it("derives its state from the signals in the medallion's own priority", () => {
    // Connecting outranks everything: before the first frame he
    // is not in any state a reading could honestly name.
    expect(
      ringPresenceState({ ready: false, speaking: true, listening: true, acting: true }),
    ).toBe("connecting");
    expect(ringPresenceState({ ready: true, speaking: true, listening: true, acting: true })).toBe(
      "speaking",
    );
    expect(
      ringPresenceState({ ready: true, speaking: false, listening: true, acting: true }),
    ).toBe("listening");
    expect(
      ringPresenceState({ ready: true, speaking: false, listening: false, acting: true }),
    ).toBe("thinking");
    expect(
      ringPresenceState({ ready: true, speaking: false, listening: false, acting: false }),
    ).toBe("idle");
  });

  it("reads the same states off the bridge's state word", () => {
    expect(ringPresenceStateForBridge("SPEAKING", true)).toBe("speaking");
    expect(ringPresenceStateForBridge("LISTENING", true)).toBe("listening");
    expect(ringPresenceStateForBridge("THINKING", true)).toBe("thinking");
    expect(ringPresenceStateForBridge("IDLE", true)).toBe("idle");
    expect(ringPresenceStateForBridge("SPEAKING", false)).toBe("connecting");
  });

  it("lights exactly the segments each state owns — and no others", () => {
    const lit = (state: Parameters<typeof ringSegments>[0], tone: string) =>
      ringSegments(state).filter((s) => s.tone === tone).length;
    expect(ringSegments("speaking")).toHaveLength(RING_SEGMENT_COUNT);
    // THE GOLD ORDERS (2026-11-26): rest is gold, ACTIVE is
    // gold-red, connecting is deep gold — and no state, ever,
    // reads blue. The counts are the same gauges as before;
    // only the colors moved, on his word.
    expect(lit("speaking", "goldred")).toBe(24);
    expect(lit("thinking", "goldred")).toBe(12);
    expect(lit("listening", "goldred")).toBe(8);
    expect(lit("idle", "gold")).toBe(4);
    // REST IS GOLD (phone fix pass 2026-11-27, item 7): the
    // connecting state is a rest state — its four points burn
    // gold now, never the amber that read orange at rest.
    expect(lit("connecting", "gold")).toBe(4);
    expect(lit("connecting", "amber")).toBe(0);
    for (const state of ["speaking", "listening", "thinking", "idle", "connecting", "alert"] as const) {
      expect(lit(state, "cyan")).toBe(0);
    }
    // Every segment is accounted for in every state — lit or dim,
    // never missing, never double-read.
    for (const state of ["speaking", "listening", "thinking", "idle", "connecting"] as const) {
      const segments = ringSegments(state);
      expect(segments).toHaveLength(RING_SEGMENT_COUNT);
      expect(new Set(segments.map((s) => s.index)).size).toBe(RING_SEGMENT_COUNT);
    }
  });
});

describe("PresenceRing", () => {
  it("renders the state's segments and names the state it read", () => {
    const { container } = render(
      <PresenceRing ready speaking listening={false} acting={false} />,
    );
    const ring = container.querySelector(".presence-ring")!;
    expect(ring.getAttribute("data-ring-state")).toBe("speaking");
    expect(ring.querySelectorAll(".presence-ring__seg")).toHaveLength(RING_SEGMENT_COUNT);
    expect(ring.querySelectorAll('.presence-ring__seg[data-tone="goldred"]')).toHaveLength(24);
  });

  it("dims to the idle reading at rest — four gold points, the rest dim", () => {
    const { container } = render(
      <PresenceRing ready speaking={false} listening={false} acting={false} />,
    );
    const ring = container.querySelector(".presence-ring")!;
    expect(ring.getAttribute("data-ring-state")).toBe("idle");
    expect(ring.querySelectorAll('.presence-ring__seg[data-tone="gold"]')).toHaveLength(4);
    expect(ring.querySelectorAll('.presence-ring__seg[data-tone="dim"]')).toHaveLength(20);
  });
});

describe("Anubis wears the ring — outside his face", () => {
  it("the ring stands around the medallion and the face itself carries no SVG", () => {
    const { container } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} />,
    );
    const halo = container.querySelector(".anubis-presence__halo");
    expect(halo).not.toBeNull();
    expect(halo!.querySelector(".presence-ring")).not.toBeNull();
    expect(halo!.querySelector(".anubis-presence__face")).not.toBeNull();
    // The standing pin: the FACE is the raster portrait, never an
    // SVG substitute — the ring is its sibling, not its content.
    expect(container.querySelector(".anubis-presence__face svg")).toBeNull();
    expect(container.querySelector(".anubis-presence__face .presence-ring")).toBeNull();
  });

  it("the recede class follows the receded signal — and only it", () => {
    const { container, rerender } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} />,
    );
    const root = () => container.querySelector(".anubis-presence")!;
    expect(root().classList.contains("anubis-presence--receded")).toBe(false);
    rerender(<AnubisPresence ready speaking={false} listening={false} acting={false} receded />);
    expect(root().classList.contains("anubis-presence--receded")).toBe(true);
  });
});

describe("the phone swipe — the stage's real view, stepped and clamped", () => {
  it("reads only a mostly-horizontal slide past the minimum travel", () => {
    expect(swipeDirection(-60, 5)).toBe("left");
    expect(swipeDirection(60, -5)).toBe("right");
    expect(swipeDirection(-20, 0)).toBeNull();
    expect(swipeDirection(0, 90)).toBeNull();
    // A diagonal drag is not a swipe: the sideways travel must
    // clearly dominate the vertical.
    expect(swipeDirection(-60, 55)).toBeNull();
    expect(swipeDirection(-90, 40)).toBe("left");
  });

  it("steps the perspective one stop per swipe and holds at the ends", () => {
    expect(stageViewAfterSwipe("front", "left")).toBe("right");
    expect(stageViewAfterSwipe("left", "left")).toBe("front");
    expect(stageViewAfterSwipe("front", "right")).toBe("left");
    expect(stageViewAfterSwipe("right", "right")).toBe("front");
    // Clamped, never wrapped, never a view the stage does not have.
    expect(stageViewAfterSwipe("right", "left")).toBe("right");
    expect(stageViewAfterSwipe("left", "right")).toBe("left");
  });
});

describe("the stage wiring — recede, swipe, frame, and the dock intact", () => {
  it("derives the recede from the stage's real window states and passes it to Anubis", () => {
    expect(stageSource).toContain("const stageScreenOpen =");
    for (const state of ["devicesOpen", "libraryOpen", "hexoOpen", "emulatorOpen", "constructOpen", "builderOpen"]) {
      expect(stageSource).toContain(state);
    }
    expect(stageSource).toContain("receded={stageScreenOpen}");
  });

  it("wires the swipe to the stage view through the swipe module", () => {
    expect(stageSource).toContain("onTouchStart={onStageTouchStart}");
    expect(stageSource).toContain("onTouchEnd={onStageTouchEnd}");
    expect(stageSource).toContain("stageViewAfterSwipe(stageViewRef.current, direction)");
    expect(stageSource).toContain("COMMAND_BOX_PHONE_BREAKPOINT");
  });

  it("renders the circuit field and the circuit frame as stage dress", () => {
    expect(stageSource).toContain('className="stage-circuit-field"');
    expect(stageSource).toContain('className="stage-circuit-frame"');
    expect(fixCss).toContain(".stage-circuit-field");
    expect(fixCss).toContain(".stage-circuit-frame__corner--tl");
  });

  it("carries the ring, the halo, and the recede in the theme CSS", () => {
    expect(fixCss).toContain(".presence-ring__seg--gold");
    expect(fixCss).toContain(".presence-ring__seg--amber");
    expect(fixCss).toContain(".presence-ring__seg--goldred");
    expect(fixCss).toContain(".anubis-presence__halo");
    expect(fixCss).toContain(".anubis-presence.anubis-presence--receded");
    expect(fixCss).toContain("transform: scale(0.7)");
  });

  it("the blue is OUT of the theme — field, frame, ring, and chrome (owner order 2026-11-26)", () => {
    // The cyan the theme shipped with, in every form it took:
    // the trace/frame rgb, the lit-segment hex, the dim blue-grey.
    expect(fixCss).not.toContain("47 216 255");
    expect(fixCss).not.toContain("#38e1ff");
    expect(fixCss).not.toContain("96 165 220");
    // Gold carries it instead: the frame line and the traces.
    expect(fixCss).toContain("border: 1px solid rgb(255 217 77 / 30%)");
    expect(fixCss).toContain("stroke: rgb(255 217 77 / 16%)");
    // The ALERT red survives — a signal, not dress.
    expect(fixCss).toContain(".presence-ring__seg--alert");
    expect(fixCss).toContain("#ff5347");
  });

  it("the chat dock's clearance survives the theme — the dock is untouched", () => {
    // Section 35's law, pinned by the dock round and re-pinned
    // here: the theme's frame stands at the same clearance, and
    // the dock's own rules were not rewritten by this round.
    expect(fixCss).toContain("--chat-dock-clearance: 4.5rem");
    expect(fixCss).toContain("bottom: var(--chat-dock-clearance)");
    expect(fixCss).toContain("bottom: calc(var(--chat-dock-clearance, 4.5rem) + 2px)");
  });
});
