import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlackHatterPresence } from "@/avatar/BlackHatterPresence";
import { MontuPresence } from "@/avatar/MontuPresence";
import {
  clampMedallionGeometry,
  defaultMedallionGeometry,
  loadOrDefaultMedallionGeometry,
  medallionStorageKey,
} from "@/avatar/medallionAnchor";
import {
  AMUN_RA_BINDING,
  MONTU_BINDING,
  MUMMY_GUARDIAN_BINDING,
} from "@/avatar/medallionPortraits";
import { TOP_SEAT, conversationViewFor } from "@/avatar/stagePerspective";
import { BLESSING, PEACE_CLOSING, closeWithBlessing, respectfulAddress } from "@/avatar/etiquette";
import { idleReportLine } from "@/avatar/idleLife";
import {
  availablePresenceViews,
  effectivePresenceView,
} from "@/avatar/presenceView";
import { BLACK_HATTER_BINDING, ANUBIS_BINDING } from "@/avatar/medallionPortraits";
import {
  applyNotificationInstruction,
  describeNotificationInstruction,
  parseNotificationInstruction,
  shouldNotify,
  DEFAULT_NOTIFICATION_PREFS,
} from "@/avatar/notificationPrefs";
import { DESERT_BACKDROP_SRC, STAGE_BACKDROPS, loadStageBackdrop, saveStageBackdrop } from "@/avatar/stageBackdrop";

/**
 * THE MEDALLION ANCHOR SYSTEM (owner orders 2026-11-22): the stage's
 * presences are anchored elements — grab, move, stretch, persist.
 * The Black Hatter's default is BIGGER, in the MIDDLE (his verdict
 * from the live screen check).
 */
describe("medallion anchor geometry", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("the Black Hatter's factory home is bigger, in the middle", () => {
    // 1200×800 stage: 380px face, centered; the whole medallion
    // (face + 80px under the face — plate and the move controls)
    // centered vertically.
    expect(defaultMedallionGeometry("black-hatter", 1200, 800)).toEqual({
      x: 410,
      y: 170,
      size: 380,
    });
  });

  it("Anubis's home is top-center; Montu's is the right flank", () => {
    expect(defaultMedallionGeometry("anubis", 1200, 800)).toEqual({ x: 516, y: 16, size: 168 });
    expect(defaultMedallionGeometry("montu", 1200, 800)).toEqual({ x: 1028, y: 282, size: 156 });
  });

  it("a saved placement heals back inside a smaller stage", () => {
    localStorage.setItem(
      medallionStorageKey("black-hatter"),
      JSON.stringify({ x: 9999, y: 9999, size: 300 }),
    );
    expect(loadOrDefaultMedallionGeometry("black-hatter", 1024, 768)).toEqual({
      x: 720,
      y: 384,
      size: 300,
    });
  });

  it("sizes clamp to the readable band and the stage", () => {
    expect(clampMedallionGeometry({ x: 0, y: 0, size: 10 }, 1200, 800).size).toBe(72);
    expect(clampMedallionGeometry({ x: 0, y: 0, size: 9999 }, 1200, 800).size).toBe(560);
  });
});

describe("BlackHatterPresence — the anchor at work", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  function pointer(node: Element, type: string, x: number, y: number) {
    const ev = new window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: x,
      clientY: y,
    });
    Object.defineProperty(ev, "pointerId", { value: 7 });
    fireEvent(node, ev);
  }

  it("opens at the default — 380px in the middle of the jsdom stage", () => {
    const { container } = render(<BlackHatterPresence inPerspective onSelect={vi.fn()} />);
    const root = container.querySelector(".black-hatter-presence") as HTMLElement;
    expect(root.style.left).toBe("322px");
    expect(root.style.top).toBe("154px");
    const face = container.querySelector(".black-hatter-presence__face") as HTMLElement;
    expect(face.style.width).toBe("380px");
  });

  it("drags to a new spot, persists it, and the trailing click does not select", () => {
    const onSelect = vi.fn();
    const { container } = render(<BlackHatterPresence inPerspective onSelect={onSelect} />);
    const root = container.querySelector(".black-hatter-presence") as HTMLElement;
    pointer(root, "pointerdown", 400, 300);
    pointer(root, "pointermove", 460, 340);
    pointer(root, "pointerup", 460, 340);
    expect(root.style.left).toBe("382px");
    expect(root.style.top).toBe("194px");
    expect(
      JSON.parse(localStorage.getItem("augi.avatar.medallion.black-hatter.v1") ?? "{}"),
    ).toEqual({ x: 382, y: 194, size: 380 });
    fireEvent.click(root);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(root);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("stretches from its corner handle and persists the size", () => {
    const { container } = render(<BlackHatterPresence inPerspective onSelect={vi.fn()} />);
    const handle = screen.getByLabelText("Stretch the Black Hatter medallion");
    pointer(handle, "pointerdown", 700, 550);
    pointer(handle, "pointermove", 740, 590);
    pointer(handle, "pointerup", 740, 590);
    const face = container.querySelector(".black-hatter-presence__face") as HTMLElement;
    expect(face.style.width).toBe("420px");
    expect(
      JSON.parse(localStorage.getItem("augi.avatar.medallion.black-hatter.v1") ?? "{}").size,
    ).toBe(420);
  });
});

/**
 * THE PANTHEON REGISTRY (owner orders 2026-11-22): Montu wired
 * under Anubis; Amun-Ra's top seat OVER the Captain, his protection
 * domain and its rule on the binding; the mummy guardian set bound
 * at the gate.
 */
describe("the presence registry", () => {
  it("Montu is bound — falcon portrait, commander of the army", () => {
    expect(MONTU_BINDING.name).toBe("Montu");
    expect(MONTU_BINDING.role).toContain("commander of the army");
    expect(MONTU_BINDING.portrait).toBe("/montu-presence/face.webp");
  });

  it("Montu's station renders his face and plate", () => {
    const { container } = render(<MontuPresence ready onSelect={vi.fn()} />);
    const img = container.querySelector<HTMLImageElement>(".montu-presence__img");
    expect(img?.getAttribute("src")).toBe("/montu-presence/face.webp");
    expect(screen.getByText("Montu")).toBeInTheDocument();
    expect(screen.getByText("Commander")).toBeInTheDocument();
  });

  it("Amun-Ra holds the top seat — over the Captain, never a perspective", () => {
    expect(TOP_SEAT.binding).toBe(AMUN_RA_BINDING);
    expect(TOP_SEAT.above).toBe("operator/owner");
    expect(AMUN_RA_BINDING.portrait).toBe("/amun-ra-presence/face.webp");
    expect(AMUN_RA_BINDING.portraitStatus).toBe("bound");
    expect(AMUN_RA_BINDING.domain).toContain("protection");
    expect(AMUN_RA_BINDING.protectionRule).toContain("without good reason there is no protection");
  });

  it("the mummy guardians are a bound rotating set of three", () => {
    expect(MUMMY_GUARDIAN_BINDING.portraitStatus).toBe("bound");
    expect(MUMMY_GUARDIAN_BINDING.guardians).toHaveLength(3);
    expect(MUMMY_GUARDIAN_BINDING.guardians[0]).toBe("/mummy-guardian-presence/guardian-1.webp");
  });
});

/**
 * CONVERSATION VIEWS + RESPECT FORMS + BODIES (owner orders
 * 2026-11-22): one god is a call, several are a council; reports
 * close with the blessing; every medallion avatar is head-only
 * until body artwork lands — the model says so honestly.
 */
describe("conversation views, respect forms, bodies", () => {
  it("one addressed god is a call; a second god raises the council", () => {
    expect(conversationViewFor("black-hatter", [])).toBe("stage");
    expect(conversationViewFor("anubis", [])).toBe("call");
    expect(conversationViewFor("montu", ["anubis", "montu"])).toBe("council");
    expect(conversationViewFor("construct", [])).toBe("stage");
  });

  it("the blessing closes a god's report; the peace form carries an employee's line", () => {
    expect(closeWithBlessing("Report: all quiet")).toBe(`Report: all quiet. ${BLESSING}.`);
    expect(closeWithBlessing(`Report: done. ${BLESSING}.`)).toBe(`Report: done. ${BLESSING}.`);
    expect(respectfulAddress("The crew is working")).toBe(`The crew is working. ${PEACE_CLOSING}.`);
    expect(idleReportLine("check-business", true)).toContain(BLESSING);
    expect(idleReportLine("check-sub-ais", true)).toContain(PEACE_CLOSING);
  });

  it("every medallion binding is head-only until body artwork lands", () => {
    for (const binding of [BLACK_HATTER_BINDING, ANUBIS_BINDING, MONTU_BINDING, AMUN_RA_BINDING]) {
      expect(availablePresenceViews(binding)).toEqual(["head"]);
      expect(effectivePresenceView(binding, "body")).toBe("head");
    }
    const withBody = { id: "test", body: "/somewhere/body.webp" };
    expect(availablePresenceViews(withBody)).toEqual(["head", "body"]);
    expect(effectivePresenceView(withBody, "body")).toBe("body");
  });
});

/**
 * NOTIFICATION CONTROL BY HIS WORD (owner order 2026-11-22): his
 * instruction sets the standing rules — holds, mutes, wanted
 * topics — and every report honors them.
 */
describe("notification preferences", () => {
  it("parses his words into instructions", () => {
    expect(parseNotificationInstruction("hold notifications for 2 hours")).toEqual({
      kind: "hold-hours",
      hours: 2,
    });
    expect(parseNotificationInstruction("hold notifications")).toEqual({ kind: "hold" });
    expect(parseNotificationInstruction("resume notifications")).toEqual({ kind: "resume" });
    expect(parseNotificationInstruction("don't tell me about the business")).toEqual({
      kind: "mute",
      topic: "the business",
    });
    expect(parseNotificationInstruction("tell me about security")).toEqual({
      kind: "allow",
      topic: "security",
    });
    expect(parseNotificationInstruction("open the cube")).toBeNull();
  });

  it("a hold silences every topic until it expires", () => {
    const now = 1_000_000;
    const held = applyNotificationInstruction(
      DEFAULT_NOTIFICATION_PREFS,
      { kind: "hold-hours", hours: 2 },
      now,
    );
    expect(shouldNotify(held, "business", now + 60_000)).toBe(false);
    expect(shouldNotify(held, "business", now + 3 * 3_600_000)).toBe(true);
    expect(describeNotificationInstruction({ kind: "hold-hours", hours: 2 })).toContain("2 hours");
  });

  it("muted topics stay silent; named topics are the only ones that surface", () => {
    const now = 5_000;
    const muted = applyNotificationInstruction(
      DEFAULT_NOTIFICATION_PREFS,
      { kind: "mute", topic: "the business reports" },
      now,
    );
    expect(shouldNotify(muted, "business", now)).toBe(false);
    expect(shouldNotify(muted, "earth", now)).toBe(true);
    const wanted = applyNotificationInstruction(
      DEFAULT_NOTIFICATION_PREFS,
      { kind: "allow", topic: "security" },
      now,
    );
    expect(shouldNotify(wanted, "security", now)).toBe(true);
    expect(shouldNotify(wanted, "earth", now)).toBe(false);
  });
});

/**
 * THE DESERT BACKDROP SLOT (owner order 2026-11-22): a saved,
 * switchable backdrop choice; his photograph drops in at the
 * registered path with no code change.
 */
describe("stage backdrops", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("registers the living world and the Desert photo slot", () => {
    expect(STAGE_BACKDROPS.map((b) => b.id)).toEqual(["world", "desert-photo"]);
    const desert = STAGE_BACKDROPS.find((b) => b.id === "desert-photo");
    expect(desert?.name).toBe("Desert");
    expect(desert?.image).toBe(DESERT_BACKDROP_SRC);
    expect(DESERT_BACKDROP_SRC).toBe("/backdrops/desert.webp");
  });

  it("the choice persists — a fresh start returns to his backdrop", () => {
    expect(loadStageBackdrop()).toBe("world");
    saveStageBackdrop("desert-photo");
    expect(loadStageBackdrop()).toBe("desert-photo");
    saveStageBackdrop("world");
    expect(loadStageBackdrop()).toBe("world");
  });
});
