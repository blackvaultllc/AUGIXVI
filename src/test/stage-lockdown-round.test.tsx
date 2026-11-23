import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnubisPresence } from "@/avatar/AnubisPresence";
import {
  defaultMedallionGeometry,
  loadOrDefaultMedallionGeometry,
  medallionRect,
  medallionRectsOverlap,
  medallionStorageKey,
} from "@/avatar/medallionAnchor";
import { DEFAULT_SURFACES, sanitizeSurfaces, surfaceIsLight } from "@/avatar/builder/room";
import { clearRespectAsks } from "@/avatar/useMedallionAnchor";
import { notificationLaneRect } from "@/avatar/AvatarStage";
import { sanitizeAvatarSettings } from "@/avatar/settings";
import {
  loadStageView,
  saveStageView,
  stageViewCameraX,
} from "@/avatar/stageView";
import { loadSpeechBubble, saveSpeechBubble } from "@/avatar/speechBubble";
import { COMMAND_BOX_MIN_SIZE } from "@/avatar/CommandBox";
import { clampWindowSize } from "@/avatar/windows/windowGeometry";
import {
  POPUP_BLOCK_HEIGHT,
  placePopUp,
  rectsOverlap,
  type StageRect as PopUpStageRect,
} from "@/avatar/godPopUp";

/**
 * STAGE LOCK-DOWN ROUND (owner eye-check 2026-11-23 ~06:51 EST,
 * from his screenshot of 457e63d, plus the bifocal order ~06:58
 * and the phone photo + phone spec ~06:00 CST):
 * 1) ANUBIS DOES NOT MOVE — no drag, no grab-to-unanchor, no
 *    Move/Center/size in his everyday menu; placement lives only
 *    behind a deliberate EMERGENCY EDIT unlock, and locking again
 *    re-seats him CENTERED at the big default (560). A saved
 *    off-center Anubis record is never honored again.
 * 2) PERSPECTIVE BY BUTTON — Left / Front / Right in his menu;
 *    the camera turns, his geometry never does.
 * 3) The top clusters SIZE TO THEIR CONTENT (No Empty Gaps law)
 *    with BIFOCAL TYPE — 1rem primary lines.
 * 4) The PC chat default is smaller (420×360 — pinned in
 *    command-box.test.tsx); on the phone the chat is a bottom
 *    BAR (also pinned there).
 * 5) PHONE = DESKTOP COMPOSITION: the shipped room is the
 *    black-holder composition on every device, and Anubis on a
 *    phone-sized stage is BIG — a large fraction of the stage's
 *    smaller dimension, centered.
 * 6) THE OVERLAP SWEEP at his 1920×1080: medallion vs chat home
 *    vs the grown HUD clusters — nothing touches (the cluster
 *    extents are computed in the test from the pinned type).
 */

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

const stageCss = readFileSync(
  resolve(process.cwd(), "src/avatar/stage-fix-round.css"),
  "utf8",
);

describe("the locked seat — Anubis does not move", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("a saved off-center Anubis record is never honored — the seat is the centered default", () => {
    localStorage.setItem(
      medallionStorageKey("anubis"),
      JSON.stringify({ x: 40, y: 500, size: 200 }),
    );
    expect(loadOrDefaultMedallionGeometry("anubis", 1200, 800)).toEqual({
      x: 320,
      y: 120,
      size: 560,
    });
    // Another god's saved record still outranks his default —
    // the lock is Anubis's alone.
    localStorage.setItem(
      medallionStorageKey("black-hatter"),
      JSON.stringify({ x: 40, y: 500, size: 200 }),
    );
    expect(loadOrDefaultMedallionGeometry("black-hatter", 1200, 800)).toEqual({
      x: 40,
      y: 500,
      size: 200,
    });
  });

  it("Anubis renders centered-big even with an off-center record on file", () => {
    localStorage.setItem(
      medallionStorageKey("anubis"),
      JSON.stringify({ x: 40, y: 500, size: 200 }),
    );
    const { container } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} onSelect={vi.fn()} />,
    );
    const root = container.querySelector(".anubis-presence") as HTMLElement;
    expect(root.style.left).toBe("232px");
    expect(root.style.top).toBe("104px");
    const face = container.querySelector(".anubis-presence__face") as HTMLElement;
    expect(face.style.width).toBe("560px");
    // And the record itself is healed to the seat he ordered.
    expect(JSON.parse(localStorage.getItem(medallionStorageKey("anubis")) ?? "{}")).toEqual({
      x: 232,
      y: 104,
      size: 560,
    });
  });

  it("emergency edit is the one door: unlock, move, lock — and locking re-seats him centered", () => {
    const { container } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} onSelect={vi.fn()} />,
    );
    const root = container.querySelector(".anubis-presence") as HTMLElement;
    fireEvent.click(screen.getByRole("button", { name: "Open Anubis's menu" }));
    // Locked: no mover, no centerer, no steppers — the lock and
    // the one deliberate door only.
    expect(screen.queryByRole("button", { name: /^Move Anubis/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Center Anubis on the stage" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Make Anubis bigger" })).toBeNull();
    expect(screen.getByText("Centered · locked")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Emergency edit — unlock Anubis's placement" }),
    );
    // Unlocked: the everyday controls return, and the way back is
    // labeled with what it does.
    const handle = screen.getByRole("button", { name: /^Move Anubis/ });
    expect(screen.getByRole("button", { name: "Done — lock Anubis centered" })).not.toBeNull();
    expect(root.classList.contains("medallion-anchor--emergency-edit")).toBe(true);
    pointer(handle, "pointerdown", 500, 100);
    pointer(handle, "pointermove", 560, 160);
    pointer(handle, "pointerup", 560, 160);
    expect(root.style.left).toBe("292px");
    expect(root.style.top).toBe("164px");

    fireEvent.click(screen.getByRole("button", { name: "Done — lock Anubis centered" }));
    // Locking re-seats him CENTERED at the big default — the
    // emergency placement does not survive the lock.
    expect(root.style.left).toBe("232px");
    expect(root.style.top).toBe("104px");
    expect(root.classList.contains("medallion-anchor--emergency-edit")).toBe(false);
    expect(JSON.parse(localStorage.getItem(medallionStorageKey("anubis")) ?? "{}")).toEqual({
      x: 232,
      y: 104,
      size: 560,
    });
    expect(screen.getByText("Centered · locked")).not.toBeNull();
  });
});

describe("perspective by button", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("the buttons ride in Anubis's menu and report the pick — his seat never changes", () => {
    const onStageViewChange = vi.fn();
    const { container } = render(
      <AnubisPresence
        ready
        speaking={false}
        listening={false}
        acting={false}
        onSelect={vi.fn()}
        stageView="front"
        onStageViewChange={onStageViewChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Anubis's menu" }));
    expect(screen.getByRole("button", { name: "Left perspective" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Front perspective" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Right perspective" }));
    expect(onStageViewChange).toHaveBeenCalledWith("right");
    fireEvent.click(screen.getByRole("button", { name: "Left perspective" }));
    expect(onStageViewChange).toHaveBeenCalledWith("left");
    // The seat through all of it: centered, big, untouched.
    const root = container.querySelector(".anubis-presence") as HTMLElement;
    expect(root.style.left).toBe("232px");
    expect(root.style.top).toBe("104px");
  });

  it("the view persists, defaults to front, and turns the camera — left negative, right positive", () => {
    expect(loadStageView()).toBe("front");
    saveStageView("left");
    expect(loadStageView()).toBe("left");
    saveStageView("right");
    expect(loadStageView()).toBe("right");
    expect(stageViewCameraX("front")).toBe(0);
    expect(stageViewCameraX("left")).toBeLessThan(0);
    expect(stageViewCameraX("right")).toBeGreaterThan(0);
  });
});

describe("content-sized clusters, bifocal type", () => {
  it("no reserved width remains, and the primary lines stand at 1rem", () => {
    expect(stageCss).not.toContain("min-width: 19rem");
    const hudStart = stageCss.indexOf(".avatar-stage div.avatar-hud {");
    expect(hudStart).toBeGreaterThan(-1);
    const hud = stageCss.slice(hudStart, stageCss.indexOf("}", hudStart));
    expect(hud).toContain("font-size: 1rem");
    expect(hud).toContain("line-height: 1.9");
  });

  it("the phone keeps the clusters — dark panels at the 0.85rem floor, room to hold the words", () => {
    const phoneStart = stageCss.indexOf("@media (max-width: 700px)");
    expect(phoneStart).toBeGreaterThan(-1);
    const phone = stageCss.slice(phoneStart);
    expect(phone).toContain("font-size: 0.85rem");
    expect(phone).toContain("max-width: 62vw");
  });

  it("the lock, the perspective row, and the emergency ring are styled", () => {
    expect(stageCss).toContain(".medallion-menu__lock-state");
    expect(stageCss).toContain(".medallion-menu__lock-button");
    expect(stageCss).toContain(".medallion-menu__perspective-button");
    expect(stageCss).toContain('.medallion-menu__perspective-button[aria-pressed="true"]');
    expect(stageCss).toContain("medallion-anchor--emergency-edit");
  });
});

describe("the phone composition = the desktop composition", () => {
  it("the shipped room is the black-holder composition — backdrop, wall, and floor all black", () => {
    expect(DEFAULT_SURFACES.backdrop).toBe("#000000");
    expect(DEFAULT_SURFACES.wall).toBe("#000000");
    expect(DEFAULT_SURFACES.floor).toBe("#000000");
    expect(surfaceIsLight("#000000")).toBe(false);
    expect(surfaceIsLight("#f6f2e9")).toBe(true);
  });

  it("Anubis on a phone-sized stage is BIG — most of the smaller dimension, centered", () => {
    // Portrait 390×844 and landscape 844×390 (his phone photo's
    // shape): the clamp seats him at 358 — 92% of the stage's
    // smaller dimension — dead center both ways.
    expect(defaultMedallionGeometry("anubis", 390, 844)).toEqual({
      x: 16,
      y: 243,
      size: 358,
    });
    expect(defaultMedallionGeometry("anubis", 844, 390)).toEqual({
      x: 243,
      y: 16,
      size: 358,
    });
  });

  it("the phone chat is a bottom bar — and no loose box parks on the stage's face", () => {
    expect(stageCss).toContain(".avatar-command-box--phone-bar");
    const barStart = stageCss.indexOf(".avatar-command-box--phone-bar {");
    const bar = stageCss.slice(barStart, stageCss.indexOf("}", barStart));
    expect(bar).toContain("bottom: 0");
    expect(bar).toContain("left: 0");
    expect(bar).toContain("right: 0");
    // The standing right-side box he pointed at — the activity
    // line — has left the stage face entirely (desk photos
    // 2026-11-23 ~07:11 EST): it renders inside the top-left
    // cluster now, on every screen size.
    expect(stageCss).not.toContain(".avatar-activity-line {");
    expect(stageCss).toContain(".avatar-stage .avatar-hud__activity");
  });
});

describe("desk photos round — consolidation, the tight panel, the bubble switch, box integrity", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("the speech-bubble switch rides in Anubis's menu and persists — default ON", () => {
    expect(loadSpeechBubble()).toBe(true);
    saveSpeechBubble(false);
    expect(loadSpeechBubble()).toBe(false);
    saveSpeechBubble(true);
    expect(loadSpeechBubble()).toBe(true);

    const onSpeechBubbleChange = vi.fn();
    render(
      <AnubisPresence
        ready
        speaking={false}
        listening={false}
        acting={false}
        onSelect={vi.fn()}
        speechBubble
        onSpeechBubbleChange={onSpeechBubbleChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Anubis's menu" }));
    expect(screen.getByRole("button", { name: "Speech bubble on" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Speech bubble off" }));
    expect(onSpeechBubbleChange).toHaveBeenCalledWith(false);
    // And the stage's response model reads the switch before
    // raising a reply bubble.
    const stage = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
    expect(stage).toContain("loadSpeechBubble");
    expect(stage).toContain("if (!speechBubble) return;");
  });

  it("the top-right is ONE tight panel — the indicator carries no panel of its own", () => {
    const indicator = readFileSync(
      resolve(process.cwd(), "src/avatar/VoiceIndicator.tsx"),
      "utf8",
    );
    expect(indicator).not.toContain("rgba(10, 12, 16, 0.82)");
    const trStart = stageCss.indexOf(".avatar-stage div.avatar-hud--tr {");
    expect(trStart).toBeGreaterThan(-1);
    const tr = stageCss.slice(trStart, stageCss.indexOf("}", trStart));
    expect(tr).toContain("flex-direction: column");
  });

  it("the chat box's minimum is where its layout holds, and nothing crosses its border", () => {
    expect(COMMAND_BOX_MIN_SIZE).toEqual({ w: 320, h: 348 });
    expect(clampWindowSize(100, 100, 1024, 768, COMMAND_BOX_MIN_SIZE.w, COMMAND_BOX_MIN_SIZE.h)).toEqual({
      w: 320,
      h: 348,
    });
    // The shared floor is untouched for the other windows.
    expect(clampWindowSize(100, 100, 1024, 768)).toEqual({ w: 260, h: 140 });
    const boxStart = stageCss.indexOf(".avatar-stage .avatar-command-box {");
    expect(boxStart).toBeGreaterThan(-1);
    expect(stageCss.slice(boxStart, stageCss.indexOf("}", boxStart))).toContain(
      "overflow: hidden",
    );
    expect(stageCss).toContain(".avatar-stage .avatar-command-box__main");
  });
});

describe("the overlap sweep at 1920×1080", () => {
  it("medallion, chat home, and the grown clusters never touch", () => {
    const anubis = defaultMedallionGeometry("anubis", 1920, 1080);
    expect(anubis).toEqual({ x: 680, y: 260, size: 560 });
    const face = medallionRect(anubis);
    // The chat's home form: bottom-left, margin 16, the new
    // compact 420×360.
    const chat = { x: 16, y: 1080 - 16 - 360, w: 420, h: 360 };
    expect(medallionRectsOverlap(face, chat)).toBe(false);
    // The top-left cluster at the bifocal size: its longest line
    // ("PHONE BRAIN: NO WEBGPU ON THIS DEVICE", 37 chars at 1rem
    // with the HUD's 0.18em tracking ≈ 465px) plus panel padding
    // ends well left of the medallion, and its lines — the five
    // readouts plus the activity line that moved into the box
    // (desk photos 2026-11-23) — at 1.9 line-height plus padding
    // end well above it.
    const tl = { x: 24, y: 20, w: 465 + 2 * 15.2, h: 6 * 30.4 + 2 * 10.4 };
    expect(tl.x + tl.w).toBeLessThan(anubis.x);
    expect(tl.y + tl.h).toBeLessThan(anubis.y);
    expect(medallionRectsOverlap(face, tl)).toBe(false);
    // The top-right cluster (STATUS/INTENSITY + the indicator,
    // one tight panel now): its widest content is the indicator
    // box (230px max) — it ends well right of the medallion and
    // above its top.
    const tr = { x: 1920 - 24 - 262, y: 20, w: 262, h: 200 };
    expect(tr.x).toBeGreaterThan(anubis.x + anubis.size);
    expect(tr.y + tr.h).toBeLessThan(anubis.y);
    expect(medallionRectsOverlap(face, tr)).toBe(false);
  });

  it("the speaking god's pop-up renders fully inside the stage — 1920×1080 and phone sizes", () => {
    // Owner screenshot 2026-11-23 ~07:18 EST: the popped portrait
    // hung half off the screen's edge. The placement math now
    // counts the WHOLE block (bubble + face + dismiss) and the
    // component renders at the placement's width — the block is
    // inside the stage at every size, and at his resolution it
    // also clears the command face it speaks beside.
    const occupied1920: PopUpStageRect[] = [
      { x: 680, y: 260, w: 560, h: 560 }, // Anubis, centered-big
      { x: 16, y: 704, w: 420, h: 360 }, // the chat at home
    ];
    const placed = placePopUp({ w: 1920, h: 1080 }, occupied1920);
    const block: PopUpStageRect = { x: placed.x, y: placed.y, w: placed.w, h: POPUP_BLOCK_HEIGHT };
    expect(placed.x).toBeGreaterThanOrEqual(0);
    expect(placed.y).toBeGreaterThanOrEqual(0);
    expect(placed.x + placed.w).toBeLessThanOrEqual(1920);
    expect(placed.y + POPUP_BLOCK_HEIGHT).toBeLessThanOrEqual(1080);
    for (const rect of occupied1920) {
      expect(rectsOverlap(block, rect, 12)).toBe(false);
    }
    // Phone sizes: the block may have to share ground with the
    // big medallion (a phone stage is mostly face), but it is
    // NEVER clipped by an edge.
    for (const stage of [
      { w: 390, h: 844 },
      { w: 844, h: 390 },
    ]) {
      const seat = defaultMedallionGeometry("anubis", stage.w, stage.h);
      const p = placePopUp(stage, [
        { x: seat.x, y: seat.y, w: seat.size, h: seat.size },
      ]);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(stage.w);
      expect(p.y + POPUP_BLOCK_HEIGHT).toBeLessThanOrEqual(stage.h);
    }
  });
});

describe("the 07:22 additions — lane, fit, respect, sync, comic", () => {
  beforeEach(() => {
    localStorage.clear();
    clearRespectAsks();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("THE RESPECT ASK: five rapid presses on the face — the god asks once, never twice", () => {
    // Owner doctrine 2026-11-23 ~07:22 EST: "these are my gods —
    // if somebody tries to use the AI and touch the face too
    // much, the gods will out of respect ask the person please."
    // Once per session; no nagging.
    const onRespectAsk = vi.fn();
    const { container } = render(
      <AnubisPresence
        ready
        speaking={false}
        listening={false}
        acting={false}
        onSelect={vi.fn()}
        onRespectAsk={onRespectAsk}
      />,
    );
    const root = container.querySelector(".anubis-presence") as HTMLElement;
    for (let i = 0; i < 4; i++) pointer(root, "pointerdown", 300, 300);
    expect(onRespectAsk).not.toHaveBeenCalled();
    pointer(root, "pointerdown", 300, 300);
    expect(onRespectAsk).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 6; i++) pointer(root, "pointerdown", 300, 300);
    expect(onRespectAsk).toHaveBeenCalledTimes(1);
  });

  it("THE NOTIFICATION LANE: its ground clears the medallion, the chat, and both clusters", () => {
    // Owner screenshot 2026-11-23 ~07:22 EST: a BUSINESS card ON
    // TOP of the STATUS panel. The lane's rect (notificationLaneRect
    // mirrors the section-20 CSS) is checked against every named
    // element at desktop and phone sizes, with cards raised.
    const anubis1920: PopUpStageRect = { x: 680, y: 260, w: 560, h: 560 };
    const chat1920: PopUpStageRect = { x: 16, y: 704, w: 420, h: 360 };
    const laneDesktop = notificationLaneRect(1920, 1080, 4)!;
    expect(laneDesktop).not.toBeNull();
    expect(rectsOverlap(laneDesktop, anubis1920, 0)).toBe(false);
    expect(rectsOverlap(laneDesktop, chat1920, 0)).toBe(false);
    expect(laneDesktop.y).toBeGreaterThan(400); // far below both top clusters
    expect(notificationLaneRect(1920, 1080, 0)).toBeNull();
    // Phone portrait: the band above the chat bar clears the big
    // centered face (seat bottom = 243 + 358 = 601 at 390×844).
    const seatPortrait = defaultMedallionGeometry("anubis", 390, 844);
    const lanePortrait = notificationLaneRect(390, 844, 2)!;
    expect(lanePortrait.y).toBeGreaterThanOrEqual(seatPortrait.y + seatPortrait.size);
    // Phone landscape: the narrowed right column clears the face
    // (seat right edge = 243 + 358 = 601 at 844×390).
    const seatLandscape = defaultMedallionGeometry("anubis", 844, 390);
    const laneLandscape = notificationLaneRect(844, 390, 1)!;
    expect(laneLandscape.x).toBeGreaterThanOrEqual(seatLandscape.x + seatLandscape.size);
    // The CSS lane lives at the bottom, never at the top-right.
    const laneStart = stageCss.indexOf(".avatar-stage .stage-notifications {");
    const lane = stageCss.slice(laneStart, stageCss.indexOf("}", laneStart));
    expect(lane).toContain("bottom: 1rem");
    expect(lane).toContain("top: auto");
  });

  it("BACKDROP FIT: Whole picture is the default; Fill screen survives the sanitize", () => {
    expect(DEFAULT_SURFACES.backdropFit).toBe("contain");
    expect(sanitizeSurfaces({ backdropFit: "cover" }).backdropFit).toBe("cover");
    expect(sanitizeSurfaces({ backdropFit: "contain" }).backdropFit).toBe("contain");
    expect(sanitizeSurfaces({ backdropFit: "zoom" }).backdropFit).toBe("contain");
    expect(sanitizeSurfaces({}).backdropFit).toBe("contain");
    // The renderer branches on the choice (cover math exists for
    // the floor picture already — the backdrop joins it).
    const renderer = readFileSync(
      resolve(process.cwd(), "src/avatar/worldSceneRenderer.ts"),
      "utf8",
    );
    expect(renderer).toContain('surfaces.backdropFit === "cover"');
    expect(renderer).toContain("backdropPlaneSize(backdrop, viewW, viewH)");
  });

  it("BACKDROP SYNC: the account settings carry the pick — legacy copies stay silent", () => {
    // Owner decision 2026-11-23 ~07:27 EST: picture + fit sync
    // through the operator settings; a copy that predates the
    // sync must never wipe a room's stored backdrop (synced flag
    // false), and an unknown picture id reads as no picture.
    const legacy = sanitizeAvatarSettings({ bloom: 1 });
    expect(legacy.backdropSynced).toBe(false);
    const picked = sanitizeAvatarSettings({
      backdropImage: "egypt-sphinx-sunset",
      backdropFit: "cover",
      backdropSynced: true,
    });
    expect(picked.backdropImage).toBe("egypt-sphinx-sunset");
    expect(picked.backdropFit).toBe("cover");
    expect(picked.backdropSynced).toBe(true);
    const cleared = sanitizeAvatarSettings({ backdropImage: null, backdropSynced: true });
    expect(cleared.backdropImage).toBeNull();
    expect(cleared.backdropSynced).toBe(true);
    const unknown = sanitizeAvatarSettings({
      backdropImage: "not-his-picture",
      backdropSynced: true,
    });
    expect(unknown.backdropImage).toBeNull();
    // The stage bridges both directions: a builder pick goes into
    // the settings, and a synced settings copy lands on the room.
    const stage = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
    expect(stage).toContain("applyBackdropPick(backdropImage, backdropFit)");
    expect(stage).toContain("backdropSynced: true");
  });

  it("COMIC STYLE: bold frames and name tags on the conversation surfaces — no type shrinks", () => {
    // The Captain's tap 2026-11-23 ~06:31 CST. Style lives in
    // frames, panels, and tags; the section sets no font size
    // (bifocal type outranks style).
    const comicStart = stageCss.indexOf("/* 21. FULL COMIC STYLE");
    expect(comicStart).toBeGreaterThan(-1);
    const comic = stageCss.slice(comicStart);
    expect(comic).toContain("border: 3px solid #0b0e14");
    expect(comic).toContain(".avatar-command-box__thread-a");
    expect(comic).toContain("#fff6da");
    expect(comic).toContain(".avatar-command-box__thread-who");
    expect(comic).toContain("text-transform: uppercase");
    expect(comic).toContain(".god-popup__bubble");
    expect(comic).not.toContain("font-size");
  });
});
