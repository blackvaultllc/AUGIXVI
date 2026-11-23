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
    fireEvent.click(screen.getByRole("button", { name: "Open Anubis's menu" }));
    expect(screen.getByRole("button", { name: /^Move Anubis/ })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Center Anubis on the stage" })).not.toBeNull();
    expect(screen.getByText("Anchored")).not.toBeNull();
    // Only the opened medallion's menu is up.
    expect(document.querySelectorAll('[data-testid="medallion-controls"]')).toHaveLength(1);
  });

  it("the Move handle drags the medallion, shows the free state in hand, and persists the spot", () => {
    const { container } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} onSelect={vi.fn()} />,
    );
    const root = container.querySelector(".anubis-presence") as HTMLElement;
    // Factory home on the jsdom stage (1024×768): CENTER stage at
    // his resident size — the presence doctrine (owner order
    // 2026-11-22); face only, so the face's own box centers.
    expect(root.style.left).toBe("380px");
    expect(root.style.top).toBe("252px");
    fireEvent.click(screen.getByRole("button", { name: "Open Anubis's menu" }));
    const handle = screen.getByRole("button", { name: /^Move Anubis/ });
    pointer(handle, "pointerdown", 500, 100);
    expect(screen.getByText("Free — drag to place")).not.toBeNull();
    pointer(handle, "pointermove", 560, 160);
    pointer(handle, "pointerup", 560, 160);
    expect(root.style.left).toBe("440px");
    expect(root.style.top).toBe("312px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.medallion.anubis.v1") ?? "{}")).toEqual({
      x: 440,
      y: 312,
      size: 264,
    });
    expect(screen.getByText("Anchored")).not.toBeNull();
  });

  it("one click on Center puts a god dead-center — and never on the Captain's face", () => {
    const { container } = render(
      <>
        <BlackHatterPresence inPerspective onSelect={vi.fn()} />
        <AnubisPresence ready speaking={false} listening={false} acting={false} onSelect={vi.fn()} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Anubis's menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Center Anubis on the stage" }));
    const anubis = container.querySelector(".anubis-presence") as HTMLElement;
    // The Captain stands at {322,194} with a 380 face on this stage;
    // dead-center would stack Anubis onto him, so he lands flanking
    // — right of the Captain, vertically centered at his resident
    // size (264, presence doctrine 2026-11-22).
    expect(anubis.style.left).toBe("714px");
    expect(anubis.style.top).toBe("252px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.medallion.anubis.v1") ?? "{}")).toEqual({
      x: 714,
      y: 252,
      size: 264,
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

  it("the stretch handle grows Anubis's face and persists the size (the dead-arrow repair)", () => {
    const { container } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} onSelect={vi.fn()} />,
    );
    const handle = screen.getByLabelText("Stretch the Anubis medallion");
    pointer(handle, "pointerdown", 640, 510);
    pointer(handle, "pointermove", 680, 550);
    pointer(handle, "pointerup", 680, 550);
    const face = container.querySelector(".anubis-presence__face") as HTMLElement;
    expect(face.style.width).toBe("304px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.medallion.anubis.v1") ?? "{}")).toEqual({
      x: 380,
      y: 252,
      size: 304,
    });
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
      tabs: [{ id: "scene" as const, label: "Scene", icon: Eye }],
      activeTab: "scene" as const,
      onTabChange: vi.fn(),
      chat: "",
      onChatChange: vi.fn(),
      onSubmit: vi.fn(),
      voiceAvailable: false,
      voiceListening: false,
      onToggleVoice: vi.fn(),
      responseLine: "",
      responseSource: "",
      children: <p>panel body</p>,
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
        tabs={[{ id: "scene", label: "Scene", icon: Eye }]}
        activeTab="scene"
        onTabChange={vi.fn()}
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
      >
        <p>panel body</p>
      </CommandBox>,
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

  it("back on the chat screen the full box returns — bottom-up log, input at the bottom", () => {
    const { container } = renderChat({ history: [entry(1, "First answer.")] });
    expect(container.querySelector(".avatar-chat-strip")).toBeNull();
    expect(container.querySelector("#avatar-command-input")).not.toBeNull();
    expect(container.querySelector(".avatar-command-box__thread-flow")).not.toBeNull();
  });
});
