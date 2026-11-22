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
    // Part 28: the panel lives behind the Menu button — open it so the
    // panel is on screen, then prove minimize hides it and expand
    // brings it back, with no drag capture on either press.
    fireEvent.click(screen.getByRole("button", { name: /tools menu/i }));
    expect(screen.getByText("panel body")).toBeInTheDocument();
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

  it("dragging still starts from the rail itself — once unanchored", () => {
    renderBox();
    // The box opens ANCHORED (owner order 2026-11-22): locked at the
    // middle of the screen, the rail does not drag. Unanchor first —
    // then the rail drags exactly as it always did.
    fireEvent.click(screen.getByRole("button", { name: "Unanchor the chat window" }));
    pointerDown(screen.getByText("Chat"));
    expect(captureSpy).toHaveBeenCalled();
  });

  it("opens anchored at the middle — locked, and the state persists", () => {
    const { container } = renderBox();
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    expect(box.dataset["anchored"]).toBe("true");
    pointerDown(screen.getByText("Chat"));
    expect(captureSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Unanchor the chat window" }));
    expect(box.dataset["anchored"]).toBe("false");
    expect(localStorage.getItem("augi.avatar.command-box.anchored.v1")).toBe("unanchored");
    fireEvent.click(screen.getByRole("button", { name: "Anchor the chat window at the center" }));
    expect(box.dataset["anchored"]).toBe("true");
    expect(localStorage.getItem("augi.avatar.command-box.anchored.v1")).toBe("anchored");
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

  it("shows his last message above Anubis's reply, under his own name", () => {
    renderBoxWithEcho("open the cube");
    const mine = screen.getByText("open the cube");
    const reply = screen.getByText("Standing by.");
    expect(screen.getByText("Captain:")).toBeInTheDocument();
    expect(mine.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no echo line before he has sent anything", () => {
    renderBoxWithEcho(undefined);
    expect(screen.queryByText("Captain:")).not.toBeInTheDocument();
    expect(screen.getByText("Standing by.")).toBeInTheDocument();
  });
});

/**
 * THE CHAT LOG (owner orders 2026-11-21 + 2026-11-22): the reply-
 * history store renders as the window's flowing log itself — Captain
 * and Anubis lines in order. There is NO Conversation dropdown or
 * thread toggle on the face anymore: he called the bar "stupid" and
 * ordered a plain MMORPG chat window.
 */
describe("command box chat log", () => {
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

  it("flows in order on the face — Captain and Anubis lines, no dropdown bar", () => {
    renderBoxWithHistory(true);
    expect(screen.queryByRole("button", { name: /Conversation/ })).not.toBeInTheDocument();
    const log = screen.getByRole("log", { name: "Chat log" });
    expect(log).toBeInTheDocument();
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
    expect(screen.getAllByText("Captain:")).toHaveLength(2);
    expect(screen.getAllByText("Anubis:").length).toBeGreaterThanOrEqual(2);
  });

  it("offers no Conversation bar when no history is wired in — the live reply still flows", () => {
    renderBoxWithHistory(false);
    expect(screen.queryByRole("button", { name: /Conversation/ })).not.toBeInTheDocument();
    expect(screen.getByText("Standing by.")).toBeInTheDocument();
  });
});

/**
 * RESIZE (owner correction 2026-11-22): the chat window stretches
 * from its corner/edges and the size persists, like the container
 * windows. A drag on the corner grip grows the box and saves it.
 */
describe("command box resize", () => {
  const captureSpy = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    captureSpy.mockClear();
    Element.prototype.setPointerCapture = captureSpy;
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

  it("stretching the corner grows the window and saves the size", () => {
    const { container } = render(
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
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    // The enlarged default (owner order 2026-11-22 — the old 500×430
    // box was "too darn small").
    expect(box.style.width).toBe("660px");
    expect(box.style.height).toBe("540px");
    // Anchored boxes do not stretch — unanchor first.
    fireEvent.click(screen.getByRole("button", { name: "Unanchor the chat window" }));
    const corner = screen.getByRole("separator", { name: "Resize the chat window" });
    pointer(corner, "pointerdown", 100, 100);
    expect(captureSpy).toHaveBeenCalled();
    pointer(corner, "pointermove", 200, 150);
    pointer(corner, "pointerup", 200, 150);
    expect(box.style.width).toBe("760px");
    expect(box.style.height).toBe("590px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.command-box.size.v1")!)).toEqual({
      w: 760,
      h: 590,
    });
  });

  it("a saved size is the size the window opens at", () => {
    localStorage.setItem("augi.avatar.command-box.size.v1", JSON.stringify({ w: 640, h: 300 }));
    const { container } = render(
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
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    expect(box.style.width).toBe("640px");
    expect(box.style.height).toBe("300px");
  });
});

/**
 * PLAIN CHAT FACE (Part 28, owner order 2026-11-21 — supersedes the
 * MMORPG tab-first layout): "All these options and I can't just get a
 * regular chat box to conversate with my AI and be able to see the
 * replies like a normal person." The DEFAULT face is a plain chat:
 * the thread open by default, the latest exchange, one typing line.
 * ALL machinery — tabs and their panels — sits behind ONE Menu button
 * in the grip. Abilities unchanged; everything that worked (tab
 * switching, the thread, the echo, submit, voice, minimize) must keep
 * working, one Menu press away.
 */
describe("command box plain chat face", () => {
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

  it("default face is a plain chat: flowing log, latest exchange, input — no tabs, no panel, no dropdown", () => {
    render(<StatefulBox />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("scene panel body")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Conversation/ })).not.toBeInTheDocument();

    const echo = screen.getByText("last thing I said");
    const reply = screen.getByText("Latest reply.");
    const input = screen.getByPlaceholderText(/Message Anubis/);

    expect(before(echo, reply)).toBe(true);
    expect(before(reply, input)).toBe(true);

    // The chat zone groups the log; the input lives below it, outside the zone.
    const zone = screen.getByRole("group", { name: "Chat" });
    expect(zone).toContainElement(reply);
    expect(zone).not.toContainElement(input);
  });

  it("the one Menu button opens the machinery — tabs and panel above the conversation", () => {
    render(<StatefulBox />);
    const menu = screen.getByRole("button", { name: /tools menu/i });
    expect(menu).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    const tablist = screen.getByRole("tablist");
    const panel = screen.getByText("scene panel body");
    const firstLine = screen.getByText("open the cube");
    expect(before(tablist, panel)).toBe(true);
    expect(before(panel, firstLine)).toBe(true);

    fireEvent.click(menu);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("scene panel body")).not.toBeInTheDocument();
    // The chat never left.
    expect(screen.getByText("Latest reply.")).toBeInTheDocument();
  });

  it("every tab still switches the panel while conversation and input stay put", () => {
    render(<StatefulBox />);
    fireEvent.click(screen.getByRole("button", { name: /tools menu/i }));
    const input = screen.getByPlaceholderText(/Message Anubis/);

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
    fireEvent.click(screen.getByRole("button", { name: /tools menu/i }));
    fireEvent.click(screen.getByRole("tab", { name: /Commands/ }));
    expect(screen.getByText(/Every command Anubis can pass to AUGI/)).toBeInTheDocument();
    // The panel swapped; the conversation and bottom input did not move.
    expect(screen.queryByText("scene panel body")).not.toBeInTheDocument();
    expect(screen.getByText("Latest reply.")).toBeInTheDocument();
    expect(
      before(screen.getByText("Latest reply."), screen.getByPlaceholderText(/Message Anubis/)),
    ).toBe(true);
  });

  it("the log reads down into the latest reply, right above the input", () => {
    render(<StatefulBox />);
    const first = screen.getByText("open the cube");
    const last = screen.getByText("Flying.");
    const reply = screen.getByText("Latest reply.");
    const input = screen.getByPlaceholderText(/Message Anubis/);
    expect(before(first, last)).toBe(true);
    expect(before(last, reply)).toBe(true);
    expect(before(reply, input)).toBe(true);
  });

  it("minimizing hides machinery and conversation — never the input; expanding restores the chat face", () => {
    render(<StatefulBox />);
    fireEvent.click(screen.getByRole("button", { name: /tools menu/i }));
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Minimize command box" }));
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("scene panel body")).not.toBeInTheDocument();
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.queryByText("Latest reply.")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Message Anubis/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand command box" }));
    expect(screen.getByText("Latest reply.")).toBeInTheDocument();
    expect(
      before(screen.getByText("Latest reply."), screen.getByPlaceholderText(/Message Anubis/)),
    ).toBe(true);
  });

  it("the bottom row still works: submit sends and the mic toggles", () => {
    const onSubmit = vi.fn();
    const onToggleVoice = vi.fn();
    render(<StatefulBox onSubmit={onSubmit} onToggleVoice={onToggleVoice} />);
    const input = screen.getByPlaceholderText(/Message Anubis/);
    fireEvent.change(input, { target: { value: "open the cube" } });
    fireEvent.click(screen.getByRole("button", { name: "Send command" }));
    expect(onSubmit).toHaveBeenCalledWith("open the cube");

    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    expect(onToggleVoice).toHaveBeenCalledTimes(1);
  });
});
