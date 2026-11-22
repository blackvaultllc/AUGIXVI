import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
    // The box opens ANCHORED (owner order 2026-11-22): locked at its
    // home corner, the rail does not drag. Unanchor first — then the
    // rail drags exactly as it always did.
    fireEvent.click(screen.getByRole("button", { name: "Unanchor the chat window" }));
    pointerDown(screen.getByText("Chat"));
    expect(captureSpy).toHaveBeenCalled();
  });

  it("opens anchored at the bottom-left — locked, fully on screen, and the state persists", () => {
    const { container } = renderBox();
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    expect(box.dataset["anchored"]).toBe("true");
    // The anchored home (owner orders 2026-11-22): the LEFT side,
    // bottom corner, margin from the edges — jsdom is 1024×768 and
    // the standard box is the compact 500×430, so home is
    // x=16, y=768−430−16.
    expect(box.style.left).toBe("16px");
    expect(box.style.top).toBe("322px");
    pointerDown(screen.getByText("Chat"));
    expect(captureSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Unanchor the chat window" }));
    expect(box.dataset["anchored"]).toBe("false");
    expect(localStorage.getItem("augi.avatar.command-box.anchored.v1")).toBe("unanchored");
    fireEvent.click(screen.getByRole("button", { name: "Anchor the chat window at its home corner" }));
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
    // SPEAKING PROTOCOL (owner order 2026-11-22): a typed line's
    // speaker of record is his character — the Black Hatter.
    expect(screen.getByText("The Black Hatter:")).toBeInTheDocument();
    expect(mine.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no echo line before he has sent anything", () => {
    renderBoxWithEcho(undefined);
    expect(screen.queryByText("The Black Hatter:")).not.toBeInTheDocument();
    expect(screen.getByText("Standing by.")).toBeInTheDocument();
  });

  it("a mic line is the operator himself — no presence speaks for him", () => {
    render(
      <CommandBox
        accent="#d4af37"
        tabs={[{ id: "scene", label: "Scene", icon: Eye }]}
        activeTab="scene"
        onTabChange={vi.fn()}
        chat=""
        onChatChange={vi.fn()}
        onSubmit={vi.fn()}
        voiceAvailable
        voiceListening={false}
        onToggleVoice={vi.fn()}
        responseLine="Standing by."
        responseSource="test"
        userLine="open the cube"
        userSource="voice"
      >
        <p>panel body</p>
      </CommandBox>,
    );
    expect(screen.getByText("Operator — voice:")).toBeInTheDocument();
    expect(screen.queryByText("The Black Hatter:")).not.toBeInTheDocument();
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
    expect(screen.getAllByText("The Black Hatter:")).toHaveLength(2);
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
    // The compact home default (owner order 2026-11-22, defect fix:
    // 500×430 class, bottom-left — the stage's center stays clear).
    expect(box.style.width).toBe("500px");
    expect(box.style.height).toBe("430px");
    // Anchored boxes do not stretch — unanchor first.
    fireEvent.click(screen.getByRole("button", { name: "Unanchor the chat window" }));
    const corner = screen.getByRole("separator", { name: "Resize the chat window" });
    pointer(corner, "pointerdown", 100, 100);
    expect(captureSpy).toHaveBeenCalled();
    pointer(corner, "pointermove", 200, 150);
    pointer(corner, "pointerup", 200, 150);
    expect(box.style.width).toBe("600px");
    expect(box.style.height).toBe("480px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.command-box.size.v2")!)).toEqual({
      w: 600,
      h: 480,
    });
  });

  it("a saved size is the size the window opens at", () => {
    localStorage.setItem("augi.avatar.command-box.size.v2", JSON.stringify({ w: 640, h: 300 }));
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

/**
 * THE HOME FORM + BOTTOM-STACKED LOG (owner defect fix 2026-11-22):
 * his live panel was a big empty box mid-stage — persisted minimized
 * state hid the conversation, the input floated, and the anchored
 * "home" was the screen's center, covering his medallion. The panel
 * now: reloads expanded in the compact home form, stacks its lines
 * from the bottom up inside a bottom-pinned flow, keeps the input
 * as the main column's last child (the panel's bottom at every
 * size), and carries a one-click reset on the rail.
 */
describe("command box home form and bottom-stacked log", () => {
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
    Object.defineProperty(ev, "pointerId", { value: 9 });
    fireEvent(node, ev);
  }

  const history: ReplyHistoryEntry[] = [
    { at: 1, question: "open the cube", answer: "The cube is open." },
    { at: 2, question: "now fly", answer: "Flying." },
  ];

  function renderHome() {
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
        history={history}
      >
        <p>panel body</p>
      </CommandBox>,
    );
  }

  it("opens compact and anchored — 500×430 at the home corner", () => {
    const { container } = renderHome();
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    expect(box.style.width).toBe("500px");
    expect(box.style.height).toBe("430px");
    expect(box.dataset["anchored"]).toBe("true");
    // Anchored home is the bottom-left: left margin, no centering transform.
    expect(box.style.left).toBe("16px");
    expect(box.style.transform).toBe("none");
  });

  it("a persisted minimized state from the old build never hides the conversation again", () => {
    localStorage.setItem("augi.avatar.command-box.minimized.v1", "true");
    renderHome();
    expect(screen.getByRole("log", { name: "Chat log" })).toBeInTheDocument();
    expect(screen.getByText("Flying.")).toBeInTheDocument();
  });

  it("the log lines live in the bottom-pinned flow, newest last, input below them all", () => {
    const { container } = renderHome();
    const log = screen.getByRole("log", { name: "Chat log" });
    const flow = log.querySelector(".avatar-command-box__thread-flow");
    expect(flow).not.toBeNull();
    expect(flow!.contains(screen.getByText("open the cube"))).toBe(true);
    expect(flow!.contains(screen.getByText("Flying."))).toBe(true);
    // The input form is the main column's last child — the panel's
    // bottom edge at every size — and the log's column sits above it.
    const main = container.querySelector(".avatar-command-box__main") as HTMLElement;
    const form = container.querySelector(".avatar-command-box__form") as HTMLElement;
    expect(main.lastElementChild).toBe(form);
    const conversation = container.querySelector(".avatar-command-box__conversation") as HTMLElement;
    expect(
      conversation.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("the log still renders every line when the panel is stretched large", () => {
    localStorage.setItem(
      "augi.avatar.command-box.size.v2",
      JSON.stringify({ w: 1000, h: 740 }),
    );
    renderHome();
    const box = document.querySelector(".avatar-command-box") as HTMLElement;
    // 1000 saved, clamped to the jsdom viewport minus the window
    // margin (1024 − 2×16) — a genuinely large panel either way.
    expect(box.style.width).toBe("992px");
    for (const line of ["open the cube", "The cube is open.", "now fly", "Flying."]) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(screen.getByRole("log", { name: "Chat log" })).toBeInTheDocument();
  });

  it("one click on the rail's reset restores the home form and clears the saved layout", () => {
    localStorage.setItem(
      "augi.avatar.command-box.size.v2",
      JSON.stringify({ w: 900, h: 700 }),
    );
    const { container } = renderHome();
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    expect(box.style.width).toBe("900px");
    fireEvent.click(screen.getByRole("button", { name: "Unanchor the chat window" }));
    const corner = screen.getByRole("separator", { name: "Resize the chat window" });
    pointer(corner, "pointerdown", 100, 100);
    pointer(corner, "pointermove", 160, 140);
    pointer(corner, "pointerup", 160, 140);
    expect(localStorage.getItem("augi.avatar.command-box.size.v2")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Reset the chat window to its home spot and size" }),
    );
    expect(box.style.width).toBe("500px");
    expect(box.style.height).toBe("430px");
    expect(box.dataset["anchored"]).toBe("true");
    expect(box.style.left).toBe("16px");
    expect(localStorage.getItem("augi.avatar.command-box.size.v2")).toBeNull();
    expect(localStorage.getItem("augi.avatar.command-box.position.v1")).toBeNull();
    expect(localStorage.getItem("augi.avatar.command-box.anchored.v1")).toBe("anchored");
  });
});

/**
 * THE EVENING PASS (owner orders 2026-11-22): the panel heals into
 * the viewport when a saved position would put it off screen; the
 * dot grip toggles an enlarged state in the SAME format (both sizes
 * persist separately); and at phone width the anchored box sits
 * fully inside the small viewport with its margin. The standard
 * size these numbers run from is the compact home form, 500×430.
 */
describe("command box viewport heal + enlarge + phone form", () => {
  const captureSpy = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    captureSpy.mockClear();
    Element.prototype.setPointerCapture = captureSpy;
    Element.prototype.releasePointerCapture = vi.fn();
  });

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

  function boxOf(container: HTMLElement) {
    return container.querySelector(".avatar-command-box") as HTMLElement;
  }

  it("heals a saved off-screen position back inside the viewport on open", () => {
    localStorage.setItem("augi.avatar.command-box.anchored.v1", "unanchored");
    localStorage.setItem(
      "augi.avatar.command-box.position.v1",
      JSON.stringify({ x: 4000, y: 4000 }),
    );
    const { container } = renderBox();
    const box = boxOf(container);
    // 500×430 at 1024×768 clamps to the far inside corner (edge 4).
    expect(box.style.left).toBe("520px");
    expect(box.style.top).toBe("334px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.command-box.position.v1") ?? "{}")).toEqual(
      { x: 520, y: 334 },
    );
  });

  it("the dot grip enlarges the box in the same format — and shrinks it back", () => {
    const { container } = renderBox();
    const box = boxOf(container);
    expect(box.style.width).toBe("500px");
    expect(box.style.height).toBe("430px");
    fireEvent.click(screen.getByRole("button", { name: "Enlarge the chat window" }));
    expect(box.dataset["enlarged"]).toBe("true");
    // 500×430 × 1.4 — inside the jsdom viewport, no clamp needed.
    expect(box.style.width).toBe("700px");
    expect(box.style.height).toBe("602px");
    expect(localStorage.getItem("augi.avatar.command-box.enlarged.v1")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Shrink the chat window to standard size" }));
    expect(box.dataset["enlarged"]).toBe("false");
    expect(box.style.width).toBe("500px");
    expect(box.style.height).toBe("430px");
    expect(localStorage.getItem("augi.avatar.command-box.enlarged.v1")).toBe("false");
  });

  it("a press on the grip toggle never starts a rail drag", () => {
    renderBox();
    pointerDown(screen.getByRole("button", { name: "Enlarge the chat window" }));
    expect(captureSpy).not.toHaveBeenCalled();
  });

  it("opens enlarged when the enlarged state was saved", () => {
    localStorage.setItem("augi.avatar.command-box.enlarged.v1", "true");
    const { container } = renderBox();
    const box = boxOf(container);
    expect(box.dataset["enlarged"]).toBe("true");
    expect(box.style.width).toBe("700px");
    expect(box.style.height).toBe("602px");
  });

  it("the standard size is never overwritten by enlarging", () => {
    localStorage.setItem(
      "augi.avatar.command-box.size.v2",
      JSON.stringify({ w: 640, h: 300 }),
    );
    const { container } = renderBox();
    const box = boxOf(container);
    fireEvent.click(screen.getByRole("button", { name: "Enlarge the chat window" }));
    expect(box.style.width).toBe("896px");
    expect(box.style.height).toBe("420px");
    fireEvent.click(screen.getByRole("button", { name: "Shrink the chat window to standard size" }));
    expect(box.style.width).toBe("640px");
    expect(box.style.height).toBe("300px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.command-box.size.v2") ?? "{}")).toEqual({
      w: 640,
      h: 300,
    });
  });

  it("at phone width the anchored box sits fully inside the viewport with margin", () => {
    const widthSpy = vi
      .spyOn(window, "innerWidth", "get")
      .mockReturnValue(390);
    const heightSpy = vi
      .spyOn(window, "innerHeight", "get")
      .mockReturnValue(844);
    try {
      const { container } = renderBox();
      const box = boxOf(container);
      expect(box.dataset["anchored"]).toBe("true");
      // The compact phone default (owner order 2026-11-22): with no
      // saved size on record the box opens at 340×380 on a 390×844
      // phone — NOT the desktop default clamped to nearly the whole
      // screen. It stands at the bottom-left, its input row above
      // the edge: top = 844 − 380 − 16 margin.
      expect(box.style.width).toBe("340px");
      expect(box.style.height).toBe("380px");
      expect(box.style.left).toBe("16px");
      expect(box.style.top).toBe("448px");
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });

  it("a size he saved on the phone wins over the phone default", () => {
    localStorage.setItem(
      "augi.avatar.command-box.size.v2",
      JSON.stringify({ w: 300, h: 500 }),
    );
    const widthSpy = vi
      .spyOn(window, "innerWidth", "get")
      .mockReturnValue(390);
    const heightSpy = vi
      .spyOn(window, "innerHeight", "get")
      .mockReturnValue(844);
    try {
      const { container } = renderBox();
      const box = boxOf(container);
      // His stretch persists on the phone exactly as on desktop —
      // the phone default only fills the gap before his first one.
      expect(box.style.width).toBe("300px");
      expect(box.style.height).toBe("500px");
      expect(box.style.top).toBe("328px");
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });

  it("enlarge on the phone grows the box from the compact default — and shrinking returns to it", () => {
    const widthSpy = vi
      .spyOn(window, "innerWidth", "get")
      .mockReturnValue(390);
    const heightSpy = vi
      .spyOn(window, "innerHeight", "get")
      .mockReturnValue(844);
    try {
      const { container } = renderBox();
      const box = boxOf(container);
      expect(box.style.width).toBe("340px");
      expect(box.style.height).toBe("380px");
      fireEvent.click(screen.getByRole("button", { name: "Enlarge the chat window" }));
      expect(box.dataset["enlarged"]).toBe("true");
      // 340×380 × 1.4, the width clamped by the phone (390 − 2×16).
      expect(box.style.width).toBe("358px");
      expect(box.style.height).toBe("532px");
      fireEvent.click(
        screen.getByRole("button", { name: "Shrink the chat window to standard size" }),
      );
      expect(box.dataset["enlarged"]).toBe("false");
      expect(box.style.width).toBe("340px");
      expect(box.style.height).toBe("380px");
      // The compact default became the phone's standard record.
      expect(JSON.parse(localStorage.getItem("augi.avatar.command-box.size.v2") ?? "{}")).toEqual({
        w: 340,
        h: 380,
      });
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });

  it("minimizing on the phone collapses the panel to the bar — no reserved height left behind", () => {
    const widthSpy = vi
      .spyOn(window, "innerWidth", "get")
      .mockReturnValue(390);
    const heightSpy = vi
      .spyOn(window, "innerHeight", "get")
      .mockReturnValue(844);
    try {
      const { container } = renderBox();
      const box = boxOf(container);
      expect(box.style.height).toBe("380px");
      fireEvent.click(screen.getByRole("button", { name: "Minimize command box" }));
      expect(box.classList.contains("avatar-command-box--minimized")).toBe(true);
      // The footprint collapses completely (owner symptom 2026-11-22
      // — minimize left a big blue gap): the box carries NO fixed
      // height, so its height is the slim bar's own and the stage
      // area it covered belongs to the stage again.
      expect(box.style.height).toBe("");
      // The conversation is gone from the face; the input — never
      // hidden — rides in the bar.
      expect(container.querySelector(".avatar-command-box__conversation")).toBeNull();
      expect(screen.getByLabelText("Message for Anubis")).toBeInTheDocument();
      // Expanding restores the open panel at his size.
      fireEvent.click(screen.getByRole("button", { name: "Expand command box" }));
      expect(box.classList.contains("avatar-command-box--minimized")).toBe(false);
      expect(box.style.height).toBe("380px");
      expect(container.querySelector(".avatar-command-box__conversation")).not.toBeNull();
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });

  it("the stylesheet folds the minimized rail into a row — the bar is the whole footprint", () => {
    // jsdom has no layout, so the collapse itself is pinned at the
    // stylesheet: the effective (last, cascade-winning) minimized
    // rules must give the box an automatic height and fold the rail
    // from a column into a horizontal bar. If a future edit stands
    // the rail back up, the big blue gap returns — this fails first.
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    const boxRuleStart = css.lastIndexOf(".avatar-command-box--minimized {");
    expect(boxRuleStart).toBeGreaterThan(-1);
    const boxRule = css.slice(boxRuleStart, css.indexOf("}", boxRuleStart));
    expect(boxRule).toContain("height: auto");
    const railRuleStart = css.indexOf(".avatar-command-box--minimized .avatar-command-box__rail {");
    expect(railRuleStart).toBeGreaterThan(-1);
    const railRule = css.slice(railRuleStart, css.indexOf("}", railRuleStart));
    expect(railRule).toContain("flex-direction: row");
  });
});
