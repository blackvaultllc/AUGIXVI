import { act, fireEvent, render, screen } from "@testing-library/react";
import { Eye } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnubisPresence } from "@/avatar/AnubisPresence";
import { BlackHatterPresence } from "@/avatar/BlackHatterPresence";
import { CommandBox } from "@/avatar/CommandBox";
import { MontuPresence } from "@/avatar/MontuPresence";
import { centeredMedallionGeometry } from "@/avatar/medallionAnchor";
import type { ReplyHistoryEntry } from "@/avatar/replyHistory";

/**
 * STAGE FIX ROUND (owner orders 2026-11-22, from his live screen):
 * 1) moving an avatar must be OBVIOUS — a labeled Move handle, a
 *    one-click Center, and the anchor state shown on the medallion;
 *    nobody is centered onto the Captain's face.
 * 2) the chat's two modes — full box on the chat screen, a slim
 *    bottom strip on other screens, messages fading in over it
 *    Twitch-style, a tap returning him to the chat to answer.
 * 3) the blink repair — the eyelids sit on the eyes the shipped
 *    portraits actually have (re-measured by visual grounding).
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

describe("centered medallion geometry", () => {
  it("centers a medallion at the size it wears", () => {
    // Face only (owner eye-check 2026-11-22): nothing stands under
    // the face, so centering is the face's own box, dead-center.
    expect(centeredMedallionGeometry({ x: 10, y: 10, size: 168 }, 1200, 800)).toEqual({
      x: 516,
      y: 316,
      size: 168,
    });
  });

  it("never stacks another face onto the Captain's — it clears him below when there is room", () => {
    // A tall stage: the owner (380) centered on 1600×1000; a god
    // centering lands below the Captain's face instead.
    const owner = { x: 610, y: 270, size: 380 };
    expect(centeredMedallionGeometry({ x: 0, y: 0, size: 168 }, 1600, 1000, owner)).toEqual({
      x: 716,
      y: 662,
      size: 168,
    });
  });

  it("flanks the Captain when below and above cannot clear him", () => {
    // A shorter stage: below the Captain runs off the bottom and
    // above runs off the top, so the flank spot wins.
    const owner = { x: 410, y: 170, size: 380 };
    const landed = centeredMedallionGeometry({ x: 0, y: 0, size: 168 }, 1200, 640, owner);
    expect(landed).toEqual({ x: 802, y: 236, size: 168 });
    // The landed face does not touch the owner's face rect.
    expect(landed.x).toBeGreaterThanOrEqual(owner.x + owner.size);
  });

  it("an avoid rect that does not overlap the centered spot changes nothing", () => {
    expect(
      centeredMedallionGeometry({ x: 0, y: 0, size: 380 }, 1200, 800, { x: 0, y: 0, size: 380 }),
    ).toEqual({ x: 410, y: 210, size: 380 });
  });
});

describe("medallion controls — inside the box menu (owner eye-check 2026-11-22)", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("the stage shows the FACE ALONE — no plate, no controls row — until the menu opens", () => {
    const { container } = render(
      <>
        <BlackHatterPresence inPerspective onSelect={vi.fn()} />
        <AnubisPresence ready speaking={false} listening={false} acting={false} onSelect={vi.fn()} />
        <MontuPresence ready onSelect={vi.fn()} />
      </>,
    );
    // No name plates anywhere, and no controls standing on the stage.
    expect(container.querySelector(".anubis-presence__plate")).toBeNull();
    expect(container.querySelector(".black-hatter-presence__plate")).toBeNull();
    expect(container.querySelector(".montu-presence__plate")).toBeNull();
    expect(container.querySelectorAll('[data-testid="medallion-controls"]')).toHaveLength(0);
    // Each medallion carries exactly one small menu button.
    expect(screen.getByRole("button", { name: "Open The Black Hatter's menu" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Open Anubis's menu" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Open Montu's menu" })).not.toBeNull();
  });

  it("the box menu holds the labeled Move handle, the Center button, and the anchor state", () => {
    render(
      <>
        <BlackHatterPresence inPerspective onSelect={vi.fn()} />
        <AnubisPresence ready speaking={false} listening={false} acting={false} onSelect={vi.fn()} />
        <MontuPresence ready onSelect={vi.fn()} />
      </>,
    );
    // Exercised on the Captain's own medallion since the lock-down
    // round (owner eye-check 2026-11-23): Anubis's menu no longer
    // holds these controls at all — his seat is locked (the test
    // below, and stage-lockdown-round.test.ts). The other gods'
    // menus are unchanged.
    fireEvent.click(screen.getByRole("button", { name: "Open The Black Hatter's menu" }));
    expect(screen.getByRole("button", { name: /^Move The Black Hatter/ })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Center The Black Hatter on the stage" })).not.toBeNull();
    expect(screen.getByText("Anchored")).not.toBeNull();
    // Only the opened medallion's menu is up.
    expect(document.querySelectorAll('[data-testid="medallion-controls"]')).toHaveLength(1);
  });

  it("Anubis's menu holds the lock, not the mover — and his face does not drag (lock-down round)", () => {
    // SUPERSEDES the Anubis drag test that stood here (owner
    // eye-check 2026-11-23 ~06:51 EST): "I don't want to move it
    // around anymore — even if it's anchored it still lets me
    // click and move it, that's stupid. Anubis needs to stay
    // centered, anchored, nobody can move him around — unless I
    // have an emergency edit I have to do." His menu states the
    // lock and offers the one deliberate door; a drag on his face
    // moves nothing and writes nothing. The full lock-down
    // coverage (emergency edit included) lives in
    // stage-lockdown-round.test.ts.
    const { container } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} onSelect={vi.fn()} />,
    );
    const root = container.querySelector(".anubis-presence") as HTMLElement;
    // Factory home on the jsdom stage (1024×768): CENTER stage,
    // BIG — (1024−560)/2 = 232, 768/2−280 = 104.
    expect(root.style.left).toBe("232px");
    expect(root.style.top).toBe("104px");
    fireEvent.click(screen.getByRole("button", { name: "Open Anubis's menu" }));
    expect(screen.queryByRole("button", { name: /^Move Anubis/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Center Anubis on the stage" })).toBeNull();
    expect(screen.getByText("Centered · locked")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Emergency edit — unlock Anubis's placement" }),
    ).not.toBeNull();
    pointer(root, "pointerdown", 500, 300);
    pointer(root, "pointermove", 560, 360);
    pointer(root, "pointerup", 560, 360);
    expect(root.style.left).toBe("232px");
    expect(root.style.top).toBe("104px");
    // The only record the lock ever writes is the centered seat
    // itself (the heal) — the drag added nothing to it.
    expect(JSON.parse(localStorage.getItem("augi.avatar.medallion.anubis.v1") ?? "{}")).toEqual({
      x: 232,
      y: 104,
      size: 560,
    });
  });

  it("one click on Center puts a god dead-center — and never on the Captain's face", () => {
    // Exercised on Montu since the lock-down round (owner
    // eye-check 2026-11-23): Anubis has no Center button anymore —
    // he IS the center, locked. The flank law itself is unchanged
    // for the gods who can still be centered.
    const { container } = render(
      <>
        <BlackHatterPresence inPerspective onSelect={vi.fn()} />
        <MontuPresence ready onSelect={vi.fn()} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Montu's menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Center Montu on the stage" }));
    const montu = container.querySelector(".montu-presence") as HTMLElement;
    // The Captain stands at {322,194} with a 380 face on this
    // stage; dead-center ({434,306} at Montu's 156) would stack
    // Montu onto him, so he lands BELOW the Captain, horizontally
    // centered: y = 194+380+12 = 586, which fits (586+156 = 742
    // ≤ 768−16).
    expect(montu.style.left).toBe("434px");
    expect(montu.style.top).toBe("586px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.medallion.montu.v1") ?? "{}")).toEqual({
      x: 434,
      y: 586,
      size: 156,
    });
  });

  it("one click on Center brings the Captain's own face back to dead-center", () => {
    const { container } = render(<BlackHatterPresence inPerspective onSelect={vi.fn()} />);
    const root = container.querySelector(".black-hatter-presence") as HTMLElement;
    pointer(root, "pointerdown", 400, 300);
    pointer(root, "pointermove", 460, 340);
    pointer(root, "pointerup", 460, 340);
    expect(root.style.top).toBe("234px");
    fireEvent.click(screen.getByRole("button", { name: "Open The Black Hatter's menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Center The Black Hatter on the stage" }));
    expect(root.style.left).toBe("322px");
    expect(root.style.top).toBe("194px");
  });

  it("the menu's size steppers grow and shrink a god's face and persist the size (the stretch tab is gone)", () => {
    // Exercised on the Captain's own medallion since the lock-down
    // round (owner eye-check 2026-11-23): Anubis's size is part of
    // his locked seat — no steppers in his menu at all. The other
    // gods keep theirs.
    const { container } = render(<BlackHatterPresence inPerspective onSelect={vi.fn()} />);
    // No tab is drawn on the circle anymore (owner eye-check
    // 2026-11-23 — a clean circle); the size lives in the menu.
    expect(screen.queryByLabelText("Stretch the The Black Hatter medallion")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open The Black Hatter's menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Make The Black Hatter smaller" }));
    const face = container.querySelector(".black-hatter-presence__face") as HTMLElement;
    // 380 (his factory default) steps down 40, center held:
    // (322+20, 194+20).
    expect(face.style.width).toBe("340px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.medallion.black-hatter.v1") ?? "{}")).toEqual({
      x: 342,
      y: 214,
      size: 340,
    });
    fireEvent.click(screen.getByRole("button", { name: "Make The Black Hatter bigger" }));
    expect(face.style.width).toBe("380px");
  });
});

describe("the re-measured blink maps", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  function lid(container: HTMLElement, side: "left" | "right") {
    const el = container.querySelector<HTMLElement>(`[data-testid="living-lid-${side}"]`)!;
    return { left: parseFloat(el.style.left), top: parseFloat(el.style.top) };
  }

  it("the Black Hatter's lids sit on HIS eyes (centers 43.0/57.3 × 39.2 in the shipped portrait)", () => {
    const { container } = render(<BlackHatterPresence inPerspective />);
    // Lid box = eye center − half the lid size (8.2 × 3.8).
    expect(lid(container, "left").left).toBeCloseTo(38.9, 1);
    expect(lid(container, "left").top).toBeCloseTo(37.3, 1);
    expect(lid(container, "right").left).toBeCloseTo(53.2, 1);
    expect(lid(container, "right").top).toBeCloseTo(37.3, 1);
    const mouth = container.querySelector<HTMLElement>('[data-testid="living-mouth"]')!;
    expect(parseFloat(mouth.style.left)).toBeCloseTo(44.0, 1);
    expect(parseFloat(mouth.style.top)).toBeCloseTo(52.2, 1);
  });

  it("Anubis's lids sit on his eyes and no wider than them (centers 42.3/57.7 × 39.6/39.8)", () => {
    const { container } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} />,
    );
    // Lid box = eye center − half the lid size (7.4 × 4.8).
    expect(lid(container, "left").left).toBeCloseTo(38.6, 1);
    expect(lid(container, "left").top).toBeCloseTo(37.2, 1);
    expect(lid(container, "right").left).toBeCloseTo(54.0, 1);
    expect(lid(container, "right").top).toBeCloseTo(37.4, 1);
  });
});

describe("chat two-mode behavior — the strip on other screens", () => {
  const entry = (at: number, answer: string): ReplyHistoryEntry => ({
    at,
    question: "Captain's words",
    answer,
  });

  function renderChat(over: Partial<Parameters<typeof CommandBox>[0]> = {}) {
    const props = {
      accent: "#d4af37",
      chat: "",
      onChatChange: vi.fn(),
      onSubmit: vi.fn(),
      voiceAvailable: false,
      voiceListening: false,
      onToggleVoice: vi.fn(),
      responseLine: "",
      responseSource: "",
      ...over,
    };
    return render(<CommandBox {...props} />);
  }

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("on another screen the full box leaves only the slim bottom strip", () => {
    const { container } = renderChat({ away: true, history: [entry(1, "First answer.")] });
    expect(container.querySelector(".avatar-chat-strip")).not.toBeNull();
    expect(container.querySelector("#avatar-command-input")).toBeNull();
    // The line that was already latest when he left does not preview.
    expect(container.querySelector(".avatar-chat-strip__preview")).toBeNull();
  });

  it("a message arriving while away fades in over the strip, holds, fades out, and is counted", () => {
    const { container, rerender } = renderChat({
      away: true,
      history: [entry(1, "First answer.")],
    });
    rerender(
      <CommandBox
        accent="#d4af37"
        chat=""
        onChatChange={vi.fn()}
        onSubmit={vi.fn()}
        voiceAvailable={false}
        voiceListening={false}
        onToggleVoice={vi.fn()}
        responseLine=""
        responseSource=""
        history={[entry(1, "First answer."), entry(2, "The gate is quiet, Captain.")]}
        away
       />,
    );
    const preview = () => container.querySelector(".avatar-chat-strip__preview");
    expect(preview()).not.toBeNull();
    expect(preview()!.textContent).toContain("The gate is quiet, Captain.");
    expect(preview()!.classList.contains("is-fading")).toBe(false);
    act(() => {
      vi.advanceTimersByTime(5200);
    });
    expect(preview()!.classList.contains("is-fading")).toBe(true);
    act(() => {
      vi.advanceTimersByTime(650);
    });
    expect(preview()).toBeNull();
    expect(container.querySelector(".avatar-chat-strip__hint")!.textContent).toContain(
      "1 new message",
    );
  });

  it("a tap on the strip returns him to the chat screen to answer", () => {
    const onReturnToChat = vi.fn();
    const { container } = renderChat({ away: true, onReturnToChat, history: [] });
    fireEvent.click(container.querySelector(".avatar-chat-strip")!);
    expect(onReturnToChat).toHaveBeenCalledTimes(1);
  });

  it("back on the chat screen the bar stands — and his tap returns the full box, bottom-up log, input at the bottom", () => {
    // RESTAGED (owner order 2026-11-24 ~16:57 EST): back on the
    // chat screen what stands is the BAR — the Captain's own
    // window folded along the bottom, the field riding it; the
    // full box returns on his tap, exactly as it left. (For one
    // morning what stood here was Osiris's head console; before
    // that, the folded bar kept no field on the desktop.)
    const { container } = renderChat({ history: [entry(1, "First answer.")] });
    expect(container.querySelector(".avatar-chat-strip")).toBeNull();
    expect(container.querySelector(".avatar-command-box__console-face")).toBeNull();
    expect(container.querySelector(".avatar-command-box__bar")).not.toBeNull();
    expect(container.querySelector("#avatar-command-input")).not.toBeNull();
    expect(container.querySelector(".avatar-command-box__thread-flow")).toBeNull();
    fireEvent.click(container.querySelector(".avatar-command-box__bar") as HTMLElement);
    expect(container.querySelector("#avatar-command-input")).not.toBeNull();
    expect(container.querySelector(".avatar-command-box__thread-flow")).not.toBeNull();
  });
});
