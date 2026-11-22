import { fireEvent, render, screen } from "@testing-library/react";
import { Eye, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandBox, COMMAND_TAB_ICONS, type CommandTab } from "@/avatar/CommandBox";
import type { ReplyHistoryEntry } from "@/avatar/replyHistory";

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

/**
 * Regression guard for the invisible-messages defect (2026-11-21): the
 * box rendered only Augie's reply; the operator's submitted text was
 * cleared from the input and echoed nowhere, so he could not see the
 * messages he sent. The box now renders his last message — passed in as
 * `userLine` by AvatarStage, which records it in sendCommand for BOTH
 * the typed submit and the spoken path — above Augie's response line.
 */
describe("command box message echo", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function renderBoxWithEcho(userLine?: string) {
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
        userLine={userLine}
      >
        <p>panel body</p>
      </CommandBox>,
    );
  }

  it("shows his last message above Augie's reply", () => {
    renderBoxWithEcho("open the cube");
    const mine = screen.getByText("open the cube");
    const reply = screen.getByText("Standing by.");
    expect(screen.getByText("You:")).toBeInTheDocument();
    expect(mine.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no echo line before he has sent anything", () => {
    renderBoxWithEcho(undefined);
    expect(screen.queryByText("You:")).not.toBeInTheDocument();
    expect(screen.getByText("Standing by.")).toBeInTheDocument();
  });
});

/**
 * CONVERSATION THREAD (owner order 2026-11-21): "when I'm typing I like
 * to look up the conversation." The reply-history store renders as an
 * expandable thread pinned above the input in the box itself — his
 * messages and Augie's replies in order — no trip to a separate window.
 */
describe("command box conversation thread", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const history = [
    { at: 1, question: "open the cube", answer: "The cube is open." },
    { at: 2, question: "now fly", answer: "Flying." },
  ];

  function renderBoxWithHistory(withHistory: boolean) {
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
        history={withHistory ? history : undefined}
      >
        <p>panel body</p>
      </CommandBox>,
    );
  }

  it("keeps the thread collapsed until he opens it, then shows the exchange in order", () => {
    renderBoxWithHistory(true);
    const toggle = screen.getByRole("button", { name: /Conversation \(2\)/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("The cube is open.")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const first = screen.getByText("open the cube");
    const firstReply = screen.getByText("The cube is open.");
    const second = screen.getByText("now fly");
    const secondReply = screen.getByText("Flying.");
    // In order: his words before the reply, first exchange before second.
    expect(
      first.compareDocumentPosition(firstReply) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      firstReply.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      second.compareDocumentPosition(secondReply) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByText("The cube is open.")).not.toBeInTheDocument();
  });

  it("offers no thread toggle when no history is wired in", () => {
    renderBoxWithHistory(false);
    expect(screen.queryByRole("button", { name: /Conversation/ })).not.toBeInTheDocument();
  });
});

/**
 * MMORPG LAYOUT (owner order 2026-11-21): he did not like the box's
 * arrangement — response on top, tabs in the middle, conversation
 * buried — and ordered the opposite, "like playing a video game, on
 * the MMORPG": tabs across the TOP of the box, the active tab's
 * content under them, the conversation as the lower body, and the
 * input pinned at the very bottom, always visible. Same pieces, MMO
 * order; everything that worked (tab switching, the thread, the echo,
 * submit, voice, minimize) must keep working in the new order.
 */
describe("command box MMORPG layout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const TABS: Array<{ id: CommandTab; label: string; icon: LucideIcon }> = [
    { id: "scene", label: "Scene", icon: COMMAND_TAB_ICONS.Eye },
    { id: "motion", label: "Motion", icon: COMMAND_TAB_ICONS.Activity },
    { id: "tools", label: "Tools", icon: COMMAND_TAB_ICONS.BookOpen },
    { id: "settings", label: "Settings", icon: COMMAND_TAB_ICONS.Settings },
    { id: "commands", label: "Commands", icon: COMMAND_TAB_ICONS.Terminal },
  ];

  const history: ReplyHistoryEntry[] = [
    { at: 1, question: "open the cube", answer: "The cube is open." },
    { at: 2, question: "now fly", answer: "Flying." },
  ];

  function StatefulBox({
    onSubmit,
    onToggleVoice,
  }: {
    onSubmit?: (text: string) => void;
    onToggleVoice?: () => void;
  } = {}) {
    const [tab, setTab] = useState<CommandTab>("scene");
    const [chat, setChat] = useState("");
    return (
      <CommandBox
        accent="#d4af37"
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        chat={chat}
        onChatChange={setChat}
        onSubmit={onSubmit ?? (() => {})}
        voiceAvailable
        voiceListening={false}
        onToggleVoice={onToggleVoice ?? (() => {})}
        responseLine="Latest reply."
        responseSource="test"
        userLine="last thing I said"
        history={history}
      >
        <p>{tab} panel body</p>
      </CommandBox>
    );
  }

  const before = (a: HTMLElement, b: HTMLElement) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it("orders the box MMO-style: tabs, panel, conversation, input", () => {
    render(<StatefulBox />);
    const tablist = screen.getByRole("tablist");
    const panel = screen.getByText("scene panel body");
    const toggle = screen.getByRole("button", { name: /Conversation \(2\)/ });
    const echo = screen.getByText("last thing I said");
    const reply = screen.getByText("Latest reply.");
    const input = screen.getByPlaceholderText(/Type a command/);

    expect(before(tablist, panel)).toBe(true);
    expect(before(panel, toggle)).toBe(true);
    expect(before(toggle, reply)).toBe(true);
    expect(before(echo, reply)).toBe(true);
    expect(before(reply, input)).toBe(true);

    // The conversation zone groups the thread and the latest exchange;
    // the input lives below it, outside the zone.
    const zone = screen.getByRole("group", { name: "Conversation" });
    expect(zone).toContainElement(toggle);
    expect(zone).toContainElement(reply);
    expect(zone).not.toContainElement(input);
  });

  it("every tab still switches the panel while conversation and input stay put", () => {
    render(<StatefulBox />);
    const input = screen.getByPlaceholderText(/Type a command/);

    fireEvent.click(screen.getByRole("tab", { name: /Tools/ }));
    expect(screen.getByText("tools panel body")).toBeInTheDocument();
    expect(screen.queryByText("scene panel body")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Motion/ }));
    expect(screen.getByText("motion panel body")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Settings/ }));
    expect(screen.getByText("settings panel body")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Settings/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: /Scene/ }));
    expect(screen.getByText("scene panel body")).toBeInTheDocument();

    // Through every switch the conversation and the bottom input held.
    expect(screen.getByText("Latest reply.")).toBeInTheDocument();
    expect(before(screen.getByText("Latest reply."), input)).toBe(true);
  });

  it("the Commands tab still shows the full command document in the panel", () => {
    render(<StatefulBox />);
    fireEvent.click(screen.getByRole("tab", { name: /Commands/ }));
    expect(screen.getByText(/Every command Osiris can act on/)).toBeInTheDocument();
    // The panel swapped; the conversation and bottom input did not move.
    expect(screen.queryByText("scene panel body")).not.toBeInTheDocument();
    expect(screen.getByText("Latest reply.")).toBeInTheDocument();
    expect(
      before(screen.getByText("Latest reply."), screen.getByPlaceholderText(/Type a command/)),
    ).toBe(true);
  });

  it("the open thread reads down into the latest reply, right above the input", () => {
    render(<StatefulBox />);
    fireEvent.click(screen.getByRole("button", { name: /Conversation \(2\)/ }));
    const first = screen.getByText("open the cube");
    const last = screen.getByText("Flying.");
    const reply = screen.getByText("Latest reply.");
    const input = screen.getByPlaceholderText(/Type a command/);
    expect(before(first, last)).toBe(true);
    expect(before(last, reply)).toBe(true);
    expect(before(reply, input)).toBe(true);
  });

  it("minimizing hides tabs, panel and conversation — never the input", () => {
    render(<StatefulBox />);
    fireEvent.click(screen.getByRole("button", { name: "Minimize command box" }));
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("scene panel body")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Conversation/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Latest reply.")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type a command/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand command box" }));
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(
      before(screen.getByText("Latest reply."), screen.getByPlaceholderText(/Type a command/)),
    ).toBe(true);
  });

  it("the bottom row still works: submit sends and the mic toggles", () => {
    const onSubmit = vi.fn();
    const onToggleVoice = vi.fn();
    render(<StatefulBox onSubmit={onSubmit} onToggleVoice={onToggleVoice} />);
    const input = screen.getByPlaceholderText(/Type a command/);
    fireEvent.change(input, { target: { value: "open the cube" } });
    fireEvent.click(screen.getByRole("button", { name: "Send command" }));
    expect(onSubmit).toHaveBeenCalledWith("open the cube");

    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    expect(onToggleVoice).toHaveBeenCalledTimes(1);
  });
});
