import { fireEvent, render, screen } from "@testing-library/react";
import { Eye } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandBox } from "@/avatar/CommandBox";

/**
 * Regression guard for the command-box minimize defect (2026-11-21):
 * pressing the grip's minimize button did nothing. The grip's drag
 * handler captured the pointer even when the press started on the
 * button, and a captured pointer retargets the click to the grip — the
 * button never receives it. Same root cause as the FloatingWindow X
 * button fix; CommandBox has its own drag code, so it gets its own
 * guard and its own tests. A press on the button must NOT start a drag
 * (no pointer capture), and the button must toggle the box.
 */
describe("command box grip controls", () => {
  const captureSpy = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    captureSpy.mockClear();
    Element.prototype.setPointerCapture = captureSpy;
    Element.prototype.releasePointerCapture = vi.fn();
  });

  // jsdom has no PointerEvent constructor, and a generic event loses the
  // `button` field the drag handler checks — dispatch a MouseEvent typed
  // as pointerdown so the handler sees a real primary-button press.
  function pointerDown(node: Element) {
    const ev = new window.MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(ev, "pointerId", { value: 1 });
    fireEvent(node, ev);
  }

  function renderBox() {
    return render(
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
        responseLine="Standing by."
        responseSource="test"
      >
        <p>panel body</p>
      </CommandBox>,
    );
  }

  it("minimizes when the grip button is pressed — the press does not start a drag", () => {
    renderBox();
    const minimize = screen.getByRole("button", { name: "Minimize command box" });
    pointerDown(minimize);
    expect(captureSpy).not.toHaveBeenCalled();
    fireEvent.click(minimize);
    expect(screen.queryByText("panel body")).not.toBeInTheDocument();
    const expand = screen.getByRole("button", { name: "Expand command box" });
    pointerDown(expand);
    expect(captureSpy).not.toHaveBeenCalled();
    fireEvent.click(expand);
    expect(screen.getByText("panel body")).toBeInTheDocument();
  });

  it("dragging still starts from the grip itself", () => {
    renderBox();
    pointerDown(screen.getByText("Command"));
    expect(captureSpy).toHaveBeenCalled();
  });
});
