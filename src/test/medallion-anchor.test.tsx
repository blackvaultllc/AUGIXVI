import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlackHatterPresence } from "@/avatar/BlackHatterPresence";
import { MontuPresence } from "@/avatar/MontuPresence";
import {
  besideMedallionGeometry,
  clampMedallionGeometry,
  clearMedallionSpot,
  defaultMedallionGeometry,
  loadOrDefaultMedallionGeometry,
  medallionRect,
  medallionRectsOverlap,
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
    // 1200×800 stage: 380px face, centered both ways — face only
    // (owner eye-check 2026-11-22): nothing stands under the face,
    // so the face's own box is what centers.
    expect(defaultMedallionGeometry("black-hatter", 1200, 800)).toEqual({
      x: 410,
      y: 210,
      size: 380,
    });
  });

  it("Anubis's home is CENTER stage (presence doctrine); Montu's is the right flank", () => {
    // The resident commander stands in the middle — BIG by
    // default (owner eye-check 2026-11-23: the large size he
    // stretched it to himself is the factory home now), centered
    // both ways. Montu's flank home is the face's own center too,
    // since the plate/controls heights went to zero with the
    // face-only order.
    expect(defaultMedallionGeometry("anubis", 1200, 800)).toEqual({ x: 320, y: 120, size: 560 });
    expect(defaultMedallionGeometry("montu", 1200, 800)).toEqual({ x: 1028, y: 322, size: 156 });
  });

  it("a clear spot: a standing spot that overlaps nobody is returned untouched", () => {
    const anubis = defaultMedallionGeometry("anubis", 1200, 800);
    const montu = defaultMedallionGeometry("montu", 1200, 800);
    expect(clearMedallionSpot(montu, [anubis], 1200, 800)).toEqual(montu);
  });

  it("a clear spot: an overlapping spot is moved to one that overlaps nobody (no-overlap law)", () => {
    const anubis = defaultMedallionGeometry("anubis", 390, 844); // phone stage
    // A Montu spot dropped right on top of Anubis at center:
    const onTop = { x: anubis.x, y: anubis.y, size: 156 };
    const spot = clearMedallionSpot(onTop, [anubis], 390, 844);
    expect(medallionRectsOverlap(medallionRect(spot), medallionRect(anubis))).toBe(false);
    // The whole medallion stays inside the phone stage.
    expect(spot.x).toBeGreaterThanOrEqual(0);
    expect(spot.y).toBeGreaterThanOrEqual(0);
    expect(spot.x + spot.size).toBeLessThanOrEqual(390);
  });

  it("overlap is judged on the medallions' footprints, with air between", () => {
    const a = { x: 0, y: 0, w: 100, h: 146 };
    expect(medallionRectsOverlap(a, { x: 120, y: 0, w: 100, h: 146 })).toBe(false);
    expect(medallionRectsOverlap(a, { x: 105, y: 0, w: 100, h: 146 })).toBe(true); // within the gap
    expect(medallionRectsOverlap(a, { x: 0, y: 140, w: 100, h: 146 })).toBe(true); // footprints cross
    expect(medallionRectsOverlap(a, { x: 0, y: 160, w: 100, h: 146 })).toBe(false);
  });

  it("a saved placement heals back inside a smaller stage", () => {
    localStorage.setItem(
      medallionStorageKey("black-hatter"),
      JSON.stringify({ x: 9999, y: 9999, size: 300 }),
    );
    expect(loadOrDefaultMedallionGeometry("black-hatter", 1024, 768)).toEqual({
      x: 720,
      y: 464,
      size: 300,
    });
  });

  it("sizes clamp to the readable band and the stage", () => {
    expect(clampMedallionGeometry({ x: 0, y: 0, size: 10 }, 1200, 800).size).toBe(72);
    expect(clampMedallionGeometry({ x: 0, y: 0, size: 9999 }, 1200, 800).size).toBe(560);
  });

  it("an in-bounds seat is returned EXACTLY as it stands — the system never nudges a placed medallion", () => {
    // FIXED IN PLACE (owner order 2026-11-22 ~20:06 EST): clamping
    // is healing for out-of-bounds geometry only. A medallion
    // seated inside the stage — Anubis above all — comes through
    // every clamp, load, and layout shift byte-identical: where
    // he sits is where he stays until the Captain's own hand
    // moves him.
    const seated = { x: 468, y: 268, size: 264 };
    expect(clampMedallionGeometry(seated, 1200, 800)).toEqual(seated);
    expect(clampMedallionGeometry(seated, 1024, 768)).toEqual(seated);
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
    expect(root.style.top).toBe("194px");
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
    expect(root.style.top).toBe("234px");
    expect(
      JSON.parse(localStorage.getItem("augi.avatar.medallion.black-hatter.v1") ?? "{}"),
    ).toEqual({ x: 382, y: 234, size: 380 });
    fireEvent.click(root);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(root);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("sizes from its box menu and persists the size (no stretch tab on the circle)", () => {
    const { container } = render(<BlackHatterPresence inPerspective onSelect={vi.fn()} />);
    expect(screen.queryByLabelText("Stretch the Black Hatter medallion")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open The Black Hatter's menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Make The Black Hatter bigger" }));
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

  it("Montu's station renders his face — face only, his controls in his menu", () => {
    const { container } = render(<MontuPresence ready onSelect={vi.fn()} />);
    const img = container.querySelector<HTMLImageElement>(".montu-presence__img");
    expect(img?.getAttribute("src")).toBe("/montu-presence/face.webp");
    // FACE ONLY (owner eye-check 2026-11-22): no name plate stands
    // under the face; the name lives in the aria-label and the menu.
    expect(container.querySelector(".montu-presence__plate")).toBeNull();
    expect(container.querySelector(".montu-presence")!.getAttribute("aria-label")).toContain(
      "Montu",
    );
    expect(screen.getByRole("button", { name: "Open Montu's menu" })).not.toBeNull();
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

  it("registers the Matrix Wall, the living world, and the Desert photo slot", () => {
    // THE MATRIX WALL (owner order 2026-11-27) stands first in
    // the registry — the permanent background, "always and
    // forever"; the older two remain his picks to set.
    expect(STAGE_BACKDROPS.map((b) => b.id)).toEqual(["matrix-wall", "world", "desert-photo"]);
    const desert = STAGE_BACKDROPS.find((b) => b.id === "desert-photo");
    expect(desert?.name).toBe("Desert");
    expect(desert?.image).toBe(DESERT_BACKDROP_SRC);
    expect(DESERT_BACKDROP_SRC).toBe("/backdrops/desert.webp");
  });

  it("the choice persists — a fresh start returns to his backdrop", () => {
    // No pick on record: the stage stands on the Matrix Wall.
    expect(loadStageBackdrop()).toBe("matrix-wall");
    saveStageBackdrop("desert-photo");
    expect(loadStageBackdrop()).toBe("desert-photo");
    saveStageBackdrop("world");
    expect(loadStageBackdrop()).toBe("world");
    saveStageBackdrop("matrix-wall");
    expect(loadStageBackdrop()).toBe("matrix-wall");
  });
});

describe("besideMedallionGeometry — the council seat beside the commander", () => {
  // Anubis's standing home on a 1200x800 stage.
  const anubis = { x: 468, y: 268, size: 264 };

  it("seats the called god at Anubis's right flank, centered on him, one gap away", () => {
    const seat = besideMedallionGeometry(anubis, 156, 1200, 800);
    expect(seat.x).toBe(anubis.x + anubis.size + 28);
    expect(seat.y).toBe(Math.round(anubis.y + anubis.size / 2 - 156 / 2));
    expect(seat.size).toBe(156);
    expect(medallionRectsOverlap(medallionRect(seat), medallionRect(anubis))).toBe(false);
  });

  it("takes the left flank when the right is occupied", () => {
    const blocker = { x: anubis.x + anubis.size + 28, y: 322, size: 156 };
    const seat = besideMedallionGeometry(anubis, 156, 1200, 800, [blocker]);
    expect(seat.x).toBe(anubis.x - 156 - 28);
    expect(medallionRectsOverlap(medallionRect(seat), medallionRect(anubis))).toBe(false);
    expect(medallionRectsOverlap(medallionRect(seat), medallionRect(blocker))).toBe(false);
  });

  it("never returns a seat on top of the commander himself", () => {
    const seat = besideMedallionGeometry(anubis, 200, 700, 500);
    expect(medallionRectsOverlap(medallionRect(seat), medallionRect(anubis))).toBe(false);
  });
});
