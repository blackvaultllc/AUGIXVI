import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Eye, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CommandBox,
  COMMAND_TAB_ICONS,
  type CommandBoxWindowControls,
  type CommandTab,
} from "@/avatar/CommandBox";
import { ReplyHistoryWindow } from "@/avatar/ReplyHistoryWindow";
import type { ReplyHistoryEntry } from "@/avatar/replyHistory";

/**
 * THE BAR OPENS THE BOX (owner order 2026-11-24 ~16:57 EST):
 * the box starts FOLDED — its bar along the bottom, the
 * Captain's own window with no god in it — at every width now.
 * Tests that exercise the OPEN box tap the bar's bare ground
 * first, exactly as the Captain does; tests of the folded form
 * use the bar itself. (For one morning the folded form was
 * Osiris's head console — the clean-screen round — and before
 * that, the phone-only bar of 2026-11-23.)
 */
function openTheBox() {
  const bar = document.querySelector(".avatar-command-box__bar");
  if (!bar) throw new Error("the folded bar is not on screen");
  fireEvent.click(bar);
}

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

  let windowControls: CommandBoxWindowControls | null = null;

  function renderBox() {
    const utils = render(
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
        onWindowControls={(controls) => {
          windowControls = controls;
        }}
      >
        <p>panel body</p>
      </CommandBox>,
    );
    // The bar is the opening form (owner order 2026-11-24
    // ~16:57 EST) — this describe exercises the open box, so
    // tap the bar open.
    openTheBox();
    return utils;
  }

  it("the grip toggle keeps its click — a press on it does not start a drag", () => {
    // SUPERSEDED SUBJECT (owner order 2026-11-24 ~16:57 EST):
    // this guard was born for the grip's MINIMIZE button
    // (2026-11-21) — the window's keys (anchor, reset, menu,
    // minimize) are Osiris's now and live in his menu, out of
    // the box entirely. The regression class stands wherever a
    // button rides a drag surface: the rail's one remaining
    // button is the grip toggle, and a press on it must not be
    // captured by the rail's drag — the toggle must land.
    const { container } = renderBox();
    const toggle = screen.getByRole("button", { name: "Enlarge the chat window" });
    pointerDown(toggle);
    expect(captureSpy).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    expect(box.dataset["enlarged"]).toBe("true");
  });

  it("dragging starts from the rail itself — a genuine grab unanchors and moves", () => {
    const { container } = renderBox();
    // The box opens ANCHORED (owner order 2026-11-22) at its home
    // corner — but a genuine grab on the rail lifts the lock in
    // place and drags (owner eye-check 2026-11-23: "I click it and
    // I can't move it" was the defect this replaces).
    // TARGET MOVED (clean-screen round, 2026-11-24): the rail's
    // "Chat" title is gone by his order — the grab lands on the
    // rail itself.
    pointerDown(container.querySelector(".avatar-command-box__rail") as HTMLElement);
    expect(captureSpy).toHaveBeenCalled();
  });

  it("opens anchored at the bottom-left — fully on screen, and the state persists", () => {
    const { container } = renderBox();
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    expect(box.dataset["anchored"]).toBe("true");
    // The anchored home: the LEFT side, BOTTOM corner (owner
    // order 2026-11-24 ~16:57 EST — his window stands along the
    // bottom; the top-left home of the clean-screen morning is
    // superseded). jsdom is 1024×768 and the standard box is
    // the compact 420×360, so home is x=16, y=768−360−16=392.
    expect(box.style.left).toBe("16px");
    expect(box.style.top).toBe("392px");
    // A grab on the rail unanchors the box in place (eye-check
    // 2026-11-23) and the unanchored state persists. (Target
    // moved with the "Chat" title's removal — the rail itself.)
    pointerDown(container.querySelector(".avatar-command-box__rail") as HTMLElement);
    expect(captureSpy).toHaveBeenCalled();
    expect(box.dataset["anchored"]).toBe("false");
    expect(localStorage.getItem("augi.avatar.command-box.anchored.v1")).toBe("unanchored");
    // The anchor key itself is Osiris's now — it drives the box
    // through the registered window controls.
    act(() => windowControls!.toggleAnchored());
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
    const utils = render(
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
    openTheBox();
    return utils;
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
    openTheBox();
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
    const utils = render(
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
    openTheBox();
    return utils;
  }

  it("flows in order on the face — Captain and Anubis lines, no dropdown bar", () => {
    // THE THREAD OPENS CLEAN (owner eye-check 2026-11-23): the
    // record that exists when the box opens stays behind the
    // History button — the face starts empty. Lines that land
    // DURING the session flow in order, as they always did. So
    // this test opens on the record (clean), then the session's
    // exchanges arrive.
    const { rerender } = renderBoxWithHistory(true);
    expect(screen.queryByRole("button", { name: /Conversation/ })).not.toBeInTheDocument();
    const log = screen.getByRole("log", { name: "Chat log" });
    expect(log).toBeInTheDocument();
    expect(screen.queryByText("open the cube")).not.toBeInTheDocument();
    expect(screen.queryByText("Flying.")).not.toBeInTheDocument();
    // The session's own exchanges land — and flow in order.
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
        responseLine="Standing by."
        responseSource="test"
        history={[
          ...history,
          { at: 3, question: "open the cube", answer: "The cube is open." },
          { at: 4, question: "now fly", answer: "Flying." },
        ]}
      >
        <p>panel body</p>
      </CommandBox>,
    );
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
 * THE SPEAKER'S NAME (routing law, owner order 2026-11-23): the
 * thread's label is read from the same addressee state the reply
 * prompt carried — label and words can never disagree again. The
 * live line wears the CURRENT addressee's name; a kept entry wears
 * the name it was recorded under; an entry from before routing
 * wears Anubis, as it always did.
 */
describe("command box routed speaker label", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function renderRouted(speakerName: string, entries?: ReplyHistoryEntry[]) {
    const utils = render(
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
        responseLine="I hear you, Captain."
        responseSource="test"
        speakerName={speakerName}
        history={entries}
      >
        <p>panel body</p>
      </CommandBox>,
    );
    openTheBox();
    return utils;
  }

  it("the live reply is labeled with the addressee's name — and the box addresses him too", () => {
    renderRouted("Osiris");
    expect(screen.getByText("Osiris:")).toBeInTheDocument();
    expect(screen.queryByText("Anubis:")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Message Osiris — / for commands")).toBeInTheDocument();
  });

  it("a kept entry renders under the name it was recorded with", () => {
    const entries: ReplyHistoryEntry[] = [
      { at: 1, question: "Anubis, can you hear me?", answer: "I hear you, Captain.", speaker: "Anubis" },
      { at: 2, question: "Osiris, report", answer: "Watching, Captain.", speaker: "Osiris" },
      { at: 3, question: "old line", answer: "From before routing." },
    ];
    const { unmount } = renderRouted("Osiris", entries);
    // THE THREAD OPENS CLEAN (owner phone photo 2026-11-23): the
    // kept entries are NOT in the opening thread — the only label
    // on the face is the live Osiris line. The full record lives
    // behind the History button…
    expect(screen.getAllByText("Osiris:")).toHaveLength(1);
    expect(screen.queryByText("Anubis:")).not.toBeInTheDocument();
    unmount();
    // …and THERE each kept entry renders under the name it was
    // recorded with: one routed Anubis entry, one Osiris entry,
    // and the pre-routing entry under Anubis.
    // …and THERE each kept entry renders under the name it was
    // recorded with: one routed Anubis entry, one Osiris entry,
    // and the pre-routing entry under Anubis.
    render(
      <ReplyHistoryWindow entries={entries} onClear={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getAllByText(/Anubis:/)).toHaveLength(2);
    expect(screen.getAllByText(/Osiris:/)).toHaveLength(1);
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
    let windowControls: CommandBoxWindowControls | null = null;
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
        onWindowControls={(controls) => {
          windowControls = controls;
        }}
      >
        <p>panel body</p>
      </CommandBox>,
    );
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    // The compact home default (owner order 2026-11-22, defect fix;
    // smaller again on his eye-check 2026-11-23 — 420×360 class).
    // Measured on the OPEN box (the folded bar carries no size) —
    // tap the bar first.
    openTheBox();
    expect(box.style.width).toBe("420px");
    expect(box.style.height).toBe("360px");
    // Anchored boxes do not stretch — unanchor first, through
    // Osiris's anchor key path (the registered window controls).
    act(() => windowControls!.toggleAnchored());
    const corner = screen.getByRole("separator", { name: "Resize the chat window" });
    pointer(corner, "pointerdown", 100, 100);
    expect(captureSpy).toHaveBeenCalled();
    pointer(corner, "pointermove", 200, 150);
    pointer(corner, "pointerup", 200, 150);
    expect(box.style.width).toBe("520px");
    expect(box.style.height).toBe("410px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.command-box.size.v2")!)).toEqual({
      w: 520,
      h: 410,
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
    // The size the window OPENS at (clean-screen round: opening is
    // the tap on his face — the folded console carries no size).
    openTheBox();
    expect(box.style.width).toBe("640px");
    // The saved 300 height heals UP to the layout floor (348 —
    // COMMAND_BOX_MIN_SIZE, desk photos 2026-11-23): below it
    // the box broke apart in his photos, so no size on record
    // opens smaller than the layout can hold.
    expect(box.style.height).toBe("348px");
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
    // The box opens on an EMPTY record and the session's lines
    // land a beat later — the thread-opens-clean law (owner
    // eye-check 2026-11-23) keeps whatever record exists at first
    // paint behind the History button; lines that arrive during
    // the session flow. These tests exercise the flowing log, so
    // the record arrives the way a live session's lines do.
    const [landed, setLanded] = useState<ReplyHistoryEntry[]>([]);
    useEffect(() => {
      setLanded(history);
    }, []);
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
        history={landed}
        onMinimizeShortcut={(controls) => {
          shortcutControls = controls;
        }}
        onWindowControls={(controls) => {
          windowControls = controls;
        }}
      >
        <p>{tab} panel body</p>
      </CommandBox>
    );
  }

  // The window's keys are Osiris's now (owner order 2026-11-24
  // ~16:57 EST): his menu drives the box through these
  // registered controls, and the tests drive them the same way.
  let shortcutControls: { minimize: () => void; restore: () => void } | null = null;
  let windowControls: CommandBoxWindowControls | null = null;
  const toggleTheMenu = () => {
    act(() => windowControls!.toggleMenu());
  };
  const foldTheBox = () => {
    act(() => shortcutControls!.minimize());
  };

  const before = (a: HTMLElement, b: HTMLElement) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it("default face is a plain chat: flowing log, latest exchange, input — no tabs, no panel, no dropdown", () => {
    render(<StatefulBox />);
    openTheBox();
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

  it("Osiris's menu key opens the machinery — the tab's display REPLACES the chat display", () => {
    // SUPERSEDED PIN (owner order 2026-11-24 ~01:45 CST, Part B):
    // this test used to pin "tabs and panel above the
    // conversation" — the chat display followed him into every
    // section, and his word killed it: "the display that's on
    // the screen is the tab that's showing." Opening a section
    // now unmounts the conversation display; the input bar stays;
    // closing the section restores the chat whole.
    // SUPERSEDED AGAIN (owner order 2026-11-24 ~16:57 EST): the
    // Menu button itself left the box — the three-lines key is
    // Osiris's, in his own menu, driving the box through the
    // registered window controls. The machinery law stands.
    render(<StatefulBox />);
    openTheBox();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();

    toggleTheMenu();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByText("scene panel body")).toBeInTheDocument();
    // The chat display is GONE while the section shows.
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.queryByText("Latest reply.")).not.toBeInTheDocument();
    // The bottom input bar persists across sections.
    expect(screen.getByPlaceholderText(/Message Anubis/)).toBeInTheDocument();

    toggleTheMenu();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("scene panel body")).not.toBeInTheDocument();
    // The chat never left the record — it is back, whole.
    expect(screen.getByText("Latest reply.")).toBeInTheDocument();
  });

  it("every tab still switches the panel — the input stays put, the chat display does not follow", () => {
    render(<StatefulBox />);
    openTheBox();
    toggleTheMenu();
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

    // Through every switch the chat display stayed away and the
    // bottom input held — and the record returns whole on close.
    expect(screen.queryByText("Latest reply.")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Message Anubis/)).toBe(input);
    toggleTheMenu();
    expect(screen.getByText("Latest reply.")).toBeInTheDocument();
    expect(before(screen.getByText("Latest reply."), input)).toBe(true);
  });

  it("the Commands tab still shows the full command document in the panel", () => {
    render(<StatefulBox />);
    openTheBox();
    toggleTheMenu();
    fireEvent.click(screen.getByRole("tab", { name: /Commands/ }));
    expect(screen.getByText(/Every command Anubis can pass to AUGI/)).toBeInTheDocument();
    // The panel swapped; the chat display is the tab's now (Part
    // B) — the input did not move, and the thread returns whole.
    expect(screen.queryByText("scene panel body")).not.toBeInTheDocument();
    expect(screen.queryByText("Latest reply.")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Message Anubis/)).toBeInTheDocument();
    toggleTheMenu();
    expect(
      before(screen.getByText("Latest reply."), screen.getByPlaceholderText(/Message Anubis/)),
    ).toBe(true);
  });

  it("lines that arrive while a section is open wait in the record and stand in the thread on return", () => {
    // Part B's other half: nothing that arrives while he is in a
    // tab is lost or forced over the tab — the record carries it,
    // and the restored thread shows it.
    const baseProps = {
      accent: "#d4af37",
      tabs: TABS,
      activeTab: "tools" as CommandTab,
      onTabChange: vi.fn(),
      chat: "",
      onChatChange: vi.fn(),
      onSubmit: vi.fn(),
      voiceAvailable: false,
      voiceListening: false,
      onToggleVoice: vi.fn(),
      responseLine: "Latest reply.",
      responseSource: "test",
      onWindowControls: (controls: CommandBoxWindowControls) => {
        windowControls = controls;
      },
    };
    const { rerender } = render(
      <CommandBox {...baseProps} history={history}>
        <p>tools panel body</p>
      </CommandBox>,
    );
    openTheBox();
    toggleTheMenu();
    expect(screen.getByText("tools panel body")).toBeInTheDocument();
    rerender(
      <CommandBox
        {...baseProps}
        history={[...history, { at: 3, question: "", answer: "Captain — a report that waited." }]}
      >
        <p>tools panel body</p>
      </CommandBox>,
    );
    // Still in the section: the arrived line is not forced over his tab.
    expect(screen.queryByText(/a report that waited/)).not.toBeInTheDocument();
    toggleTheMenu();
    expect(screen.getByText(/a report that waited/)).toBeInTheDocument();
    expect(screen.getByText("Latest reply.")).toBeInTheDocument();
  });

  it("the log reads down into the latest reply, right above the input", () => {
    render(<StatefulBox />);
    openTheBox();
    const first = screen.getByText("open the cube");
    const last = screen.getByText("Flying.");
    const reply = screen.getByText("Latest reply.");
    const input = screen.getByPlaceholderText(/Message Anubis/);
    expect(before(first, last)).toBe(true);
    expect(before(last, reply)).toBe(true);
    expect(before(reply, input)).toBe(true);
  });

  it("minimizing folds the box to its bar; opening restores the section, closing it restores the chat face", () => {
    // SUPERSEDED TAIL (Part B, 2026-11-24): expanding used to
    // restore the chat face directly because the conversation
    // rendered under the machinery. Now the display follows the
    // tab — the section he left open is the display he returns
    // to, and the chat face returns when the section closes.
    // SUPERSEDED AGAIN (owner order 2026-11-24 ~16:57 EST): for
    // one morning the folded box was Osiris's head alone; his
    // window is his own again — the folded form is the BAR, the
    // message line standing along the bottom with the field on
    // it — and the fold itself is driven by Osiris's minus key
    // through the registered controls, not a button in the box.
    const { container } = render(<StatefulBox />);
    openTheBox();
    toggleTheMenu();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    foldTheBox();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("scene panel body")).not.toBeInTheDocument();
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.queryByText("Latest reply.")).not.toBeInTheDocument();
    // The bar is what stands in the box's place — and the field
    // rides it, as it did on the phone bar before the console.
    expect(container.querySelector(".avatar-command-box__bar")).not.toBeNull();
    expect(screen.getByPlaceholderText(/Message Anubis/)).toBeInTheDocument();

    openTheBox();
    // The section he left is the display again (Part B)…
    expect(screen.getByText("scene panel body")).toBeInTheDocument();
    expect(screen.queryByText("Latest reply.")).not.toBeInTheDocument();
    // …and closing it restores the chat face, whole.
    toggleTheMenu();
    expect(screen.getByText("Latest reply.")).toBeInTheDocument();
    expect(
      before(screen.getByText("Latest reply."), screen.getByPlaceholderText(/Message Anubis/)),
    ).toBe(true);
  });

  it("the bottom row still works: submit sends and the mic toggles", () => {
    const onSubmit = vi.fn();
    const onToggleVoice = vi.fn();
    render(<StatefulBox onSubmit={onSubmit} onToggleVoice={onToggleVoice} />);
    openTheBox();
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
 * now: opens (on the tap of Osiris's head — the console is the
 * opening form since the clean-screen round, 2026-11-24) in the
 * compact home form, stacks its lines from the bottom up inside a
 * bottom-pinned flow, keeps the input as the main column's last
 * child (the panel's bottom at every size), and carries a one-click
 * reset on the rail.
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

  let windowControls: CommandBoxWindowControls | null = null;

  function renderHome() {
    const utils = render(
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
        onWindowControls={(controls) => {
          windowControls = controls;
        }}
      >
        <p>panel body</p>
      </CommandBox>,
    );
    openTheBox();
    return utils;
  }

  it("opens compact and anchored — 420×360 at the home corner", () => {
    const { container } = renderHome();
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    expect(box.style.width).toBe("420px");
    expect(box.style.height).toBe("360px");
    expect(box.dataset["anchored"]).toBe("true");
    // Anchored home is the bottom-left (owner order 2026-11-24
    // ~16:57 EST; the clean-screen morning's top-left is
    // superseded): left margin, no centering transform.
    expect(box.style.left).toBe("16px");
    expect(box.style.transform).toBe("none");
  });

  it("a persisted minimized state from the old build never hides the conversation again", () => {
    localStorage.setItem("augi.avatar.command-box.minimized.v1", "true");
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
        history={history}
      >
        <p>panel body</p>
      </CommandBox>,
    );
    // The stale record is never read: the box stands folded
    // because the BAR is the opening form by law now (owner
    // order 2026-11-24 ~16:57 EST; the clean-screen morning's
    // head console is superseded) — the same law for every
    // load, record or no record — and one tap on the bar opens
    // the conversation whole. The defect this test was born for
    // (a hidden conversation with no way back) stays dead: the
    // way back is the bar itself.
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    expect(box.classList.contains("avatar-command-box--minimized")).toBe(true);
    openTheBox();
    expect(screen.getByRole("log", { name: "Chat log" })).toBeInTheDocument();
    // The live line stands on the face…
    expect(screen.getByText("Standing by.")).toBeInTheDocument();
    // …and the saved record does NOT greet him in the thread: the
    // thread opens clean (owner eye-check 2026-11-23 — his phone
    // opened on an old offer twice and an old musing). The record
    // itself is untouched, behind the History button.
    expect(screen.queryByText("Flying.")).not.toBeInTheDocument();
    expect(screen.queryByText("open the cube")).not.toBeInTheDocument();
  });

  it("the log lines live in the bottom-pinned flow, newest last, input below them all", () => {
    const { container, rerender } = renderHome();
    const log = screen.getByRole("log", { name: "Chat log" });
    const flow = log.querySelector(".avatar-command-box__thread-flow");
    expect(flow).not.toBeNull();
    // The thread opens clean (2026-11-23): the saved record is not
    // on the face. A line SPOKEN in this session lands in the flow.
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
        responseLine="Standing by."
        responseSource="test"
        history={[...history, { at: 3, question: "open the cube", answer: "Flying." }]}
      >
        <p>panel body</p>
      </CommandBox>,
    );
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

  it("the log renders the session's lines when the panel is stretched large — and opens clean", () => {
    localStorage.setItem(
      "augi.avatar.command-box.size.v2",
      JSON.stringify({ w: 1000, h: 740 }),
    );
    const { rerender } = renderHome();
    const box = document.querySelector(".avatar-command-box") as HTMLElement;
    // 1000 saved, clamped to the jsdom viewport minus the window
    // margin (1024 − 2×16) — a genuinely large panel either way.
    expect(box.style.width).toBe("992px");
    // Clean open at any size: none of the saved record is on the
    // face (thread-opens-clean law, owner eye-check 2026-11-23).
    for (const line of ["open the cube", "The cube is open.", "now fly", "Flying."]) {
      expect(screen.queryByText(line)).not.toBeInTheDocument();
    }
    expect(screen.getByRole("log", { name: "Chat log" })).toBeInTheDocument();
    // Lines spoken in the session render in the large panel.
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
        responseLine="Standing by."
        responseSource="test"
        history={[...history, { at: 3, question: "now fly", answer: "Flying." }]}
      >
        <p>panel body</p>
      </CommandBox>,
    );
    expect(screen.getByText("now fly")).toBeInTheDocument();
    expect(screen.getByText("Flying.")).toBeInTheDocument();
  });

  it("Osiris's reset key restores the home form and clears the saved layout", () => {
    // SUPERSEDED DRIVER (owner order 2026-11-24 ~16:57 EST): the
    // anchor and reset keys left the rail — they are Osiris's
    // now, in his menu, driving the box through the registered
    // window controls. The reset law itself stands.
    localStorage.setItem(
      "augi.avatar.command-box.size.v2",
      JSON.stringify({ w: 900, h: 700 }),
    );
    const { container } = renderHome();
    const box = container.querySelector(".avatar-command-box") as HTMLElement;
    expect(box.style.width).toBe("900px");
    act(() => windowControls!.toggleAnchored());
    const corner = screen.getByRole("separator", { name: "Resize the chat window" });
    pointer(corner, "pointerdown", 100, 100);
    pointer(corner, "pointermove", 160, 140);
    pointer(corner, "pointerup", 160, 140);
    expect(localStorage.getItem("augi.avatar.command-box.size.v2")).not.toBeNull();

    act(() => windowControls!.resetLayout());
    expect(box.style.width).toBe("420px");
    expect(box.style.height).toBe("360px");
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
 * size these numbers run from is the compact home form, 420×360.
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
    // 420×360 at 1024×768 clamps to the far inside corner (edge 4).
    expect(box.style.left).toBe("600px");
    expect(box.style.top).toBe("404px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.command-box.position.v1") ?? "{}")).toEqual(
      { x: 600, y: 404 },
    );
  });

  it("the dot grip enlarges the box in the same format — and shrinks it back", () => {
    const { container } = renderBox();
    openTheBox();
    const box = boxOf(container);
    expect(box.style.width).toBe("420px");
    expect(box.style.height).toBe("360px");
    fireEvent.click(screen.getByRole("button", { name: "Enlarge the chat window" }));
    expect(box.dataset["enlarged"]).toBe("true");
    // 420×360 × 1.4 — inside the jsdom viewport, no clamp needed.
    expect(box.style.width).toBe("588px");
    expect(box.style.height).toBe("504px");
    expect(localStorage.getItem("augi.avatar.command-box.enlarged.v1")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Shrink the chat window to standard size" }));
    expect(box.dataset["enlarged"]).toBe("false");
    expect(box.style.width).toBe("420px");
    expect(box.style.height).toBe("360px");
    expect(localStorage.getItem("augi.avatar.command-box.enlarged.v1")).toBe("false");
  });

  it("a press on the grip toggle never starts a rail drag", () => {
    renderBox();
    openTheBox();
    pointerDown(screen.getByRole("button", { name: "Enlarge the chat window" }));
    expect(captureSpy).not.toHaveBeenCalled();
  });

  it("opens enlarged when the enlarged state was saved", () => {
    localStorage.setItem("augi.avatar.command-box.enlarged.v1", "true");
    const { container } = renderBox();
    openTheBox();
    const box = boxOf(container);
    expect(box.dataset["enlarged"]).toBe("true");
    expect(box.style.width).toBe("588px");
    expect(box.style.height).toBe("504px");
  });

  it("the standard size is never overwritten by enlarging", () => {
    localStorage.setItem(
      "augi.avatar.command-box.size.v2",
      JSON.stringify({ w: 640, h: 300 }),
    );
    const { container } = renderBox();
    openTheBox();
    const box = boxOf(container);
    fireEvent.click(screen.getByRole("button", { name: "Enlarge the chat window" }));
    expect(box.style.width).toBe("896px");
    // The standard height healed to the 348 floor on load (desk
    // photos 2026-11-23), so the enlarged height runs from it:
    // 348 × 1.4 = 487.
    expect(box.style.height).toBe("487px");
    fireEvent.click(screen.getByRole("button", { name: "Shrink the chat window to standard size" }));
    expect(box.style.width).toBe("640px");
    expect(box.style.height).toBe("348px");
    expect(JSON.parse(localStorage.getItem("augi.avatar.command-box.size.v2") ?? "{}")).toEqual({
      w: 640,
      h: 348,
    });
  });

  it("at phone width the folded chat is the docked bar — the field and one button, in flow", () => {
    // THE CONSOLE FOLD IS SUPERSEDED (owner order 2026-11-24
    // ~16:57 EST): for one morning the phone fold was Osiris's
    // head alone at the top-left; his window is his own again —
    // folded on the phone is the docked bottom BAR (the Part D
    // form of 2026-11-23, restored): the field and ONE button on
    // the line, docked in flow with no inline geometry, so it
    // can never cover his stage. The OPEN phone chat keeps the
    // same one-button line.
    const widthSpy = vi
      .spyOn(window, "innerWidth", "get")
      .mockReturnValue(390);
    const heightSpy = vi
      .spyOn(window, "innerHeight", "get")
      .mockReturnValue(844);
    try {
      const { container } = renderBox();
      const box = boxOf(container);
      expect(box.classList.contains("avatar-command-box--phone-bar")).toBe(true);
      expect(box.classList.contains("avatar-command-box--minimized")).toBe(true);
      expect(box.classList.contains("avatar-command-box--console")).toBe(false);
      expect(box.style.width).toBe("");
      expect(box.style.height).toBe("");
      expect(box.style.top).toBe("");
      expect(box.style.left).toBe("");
      // The bar stands there: the field and the one options
      // button on the line; the conversation waits behind the tap.
      expect(container.querySelector(".avatar-command-box__bar")).not.toBeNull();
      expect(screen.getByLabelText("Message for Anubis")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Open the message options/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Send command" })).not.toBeInTheDocument();
      expect(container.querySelector(".avatar-command-box__console-face")).toBeNull();
      expect(container.querySelector(".avatar-command-box__conversation")).toBeNull();
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });

  it("a size he saved on the phone no longer drives the layout — the bar's geometry is the screen's", () => {
    // The saved-size law stands on the PC (his stretch outranks
    // the default). On the phone the floating box is GONE (his
    // phone spec): a saved size stays on record for the PC, but
    // the docked bar takes the screen's own width and height.
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
      expect(box.classList.contains("avatar-command-box--phone-bar")).toBe(true);
      expect(box.style.width).toBe("");
      expect(box.style.height).toBe("");
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });

  it("the bar opens on a tap and folds back on a tap of the rail", () => {
    const widthSpy = vi
      .spyOn(window, "innerWidth", "get")
      .mockReturnValue(390);
    const heightSpy = vi
      .spyOn(window, "innerHeight", "get")
      .mockReturnValue(844);
    try {
      const { container } = renderBox();
      const box = boxOf(container);
      expect(box.classList.contains("avatar-command-box--minimized")).toBe(true);
      // A tap on the bar's bare ground opens the chat upward.
      const bar = container.querySelector(".avatar-command-box__bar") as HTMLElement;
      expect(bar).not.toBeNull();
      fireEvent.click(bar);
      expect(box.classList.contains("avatar-command-box--minimized")).toBe(false);
      expect(container.querySelector(".avatar-command-box__conversation")).not.toBeNull();
      // A tap on the open box's rail folds it back to the bar.
      fireEvent.click(container.querySelector(".avatar-command-box__rail") as HTMLElement);
      expect(box.classList.contains("avatar-command-box--minimized")).toBe(true);
      expect(container.querySelector(".avatar-command-box__conversation")).toBeNull();
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });

  it("the bar folds from the message options too", () => {
    const widthSpy = vi
      .spyOn(window, "innerWidth", "get")
      .mockReturnValue(390);
    const heightSpy = vi
      .spyOn(window, "innerHeight", "get")
      .mockReturnValue(844);
    try {
      const { container } = renderBox();
      const box = boxOf(container);
      // Open with a tap on the bar, then fold from the options
      // menu — the phone's own fold entry (Part D).
      fireEvent.click(container.querySelector(".avatar-command-box__bar") as HTMLElement);
      expect(box.classList.contains("avatar-command-box--minimized")).toBe(false);
      expect(container.querySelector(".avatar-command-box__conversation")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Open the message options/ }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Fold to the bar" }));
      expect(box.classList.contains("avatar-command-box--minimized")).toBe(true);
      // The footprint collapses completely — no reserved height
      // (the 2026-11-22 "big blue gap" symptom stays dead) — and
      // the field rides the bar: that is the bar's whole point.
      expect(box.style.height).toBe("");
      expect(container.querySelector(".avatar-command-box__conversation")).toBeNull();
      expect(screen.getByLabelText("Message for Anubis")).toBeInTheDocument();
      expect(container.querySelector(".avatar-command-box__bar")).not.toBeNull();
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });
  it("the stylesheet folds the minimized window to its bar — the bar is the whole footprint", () => {
    // jsdom has no layout, so the collapse itself is pinned at
    // the stylesheet: the effective (last, cascade-winning)
    // minimized rule must give the box an automatic height and
    // the bar must flex to fill the row alone. (The console
    // morning pinned a rail row carrying the head here;
    // superseded 2026-11-24 ~16:57 EST with the console itself.)
    // If a future edit reserves panel height for the fold, the
    // big blue gap returns — this fails first.
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    const boxRuleStart = css.lastIndexOf(".avatar-command-box--minimized {");
    expect(boxRuleStart).toBeGreaterThan(-1);
    const boxRule = css.slice(boxRuleStart, css.indexOf("}", boxRuleStart));
    expect(boxRule).toContain("height: auto");
    const barRuleStart = css.indexOf(".avatar-command-box__bar {");
    expect(barRuleStart).toBeGreaterThan(-1);
    const barRule = css.slice(barRuleStart, css.indexOf("}", barRuleStart));
    expect(barRule).toContain("flex: 1");
  });

  it("the stylesheet keeps the phone rail inside the panel — a strip across the top, never a spilling column", () => {
    // jsdom has no layout, so the containment is pinned at the
    // stylesheet (owner defect 2026-11-22): the desktop rail is a
    // column taller than a short phone panel, and its lower
    // buttons hung below the panel's frame on his phone. Below
    // the phone breakpoint the box must stack — rail folded into
    // one horizontal strip across the panel's top — so no panel
    // height can push a button outside the frame again.
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    const mediaStart = css.indexOf("@media (max-width: 700px)");
    expect(mediaStart).toBeGreaterThan(-1);
    const media = css.slice(mediaStart);
    const boxRuleStart = media.indexOf(".avatar-command-box {");
    expect(boxRuleStart).toBeGreaterThan(-1);
    const boxRule = media.slice(boxRuleStart, media.indexOf("}", boxRuleStart));
    expect(boxRule).toContain("flex-direction: column");
    const railRuleStart = media.indexOf(".avatar-command-box__rail {");
    expect(railRuleStart).toBeGreaterThan(-1);
    const railRule = media.slice(railRuleStart, media.indexOf("}", railRuleStart));
    expect(railRule).toContain("flex-direction: row");
    expect(railRule).toContain("width: auto");
    // The grid vestige of the pre-flex layout must not come back,
    // and the retired standalone toolbar stays retired.
    expect(media).not.toContain("grid-template-rows");
    expect(media).not.toContain("stage-toolbar");
  });
});

/**
 * THE PHONE BAR — ONE BUTTON (owner order 2026-11-24 ~01:46 CST,
 * Part D): "cut out all the other options there and leave one
 * thing there on the line — the first thing that pops up is like
 * type a message, and then when I click the button then it opens
 * up the menus and stuff." The folded bar's line: the medallion
 * (his picture — untouched), the type field at full width, and
 * ONE button. Send, microphone, emoji, the menus and the fold
 * all live in the panel that button opens. Same form in the
 * opened box — one bar, one behavior, every tab (Part B).
 *
 * SUPERSEDED IN PART (clean-screen round, owner order 2026-11-24
 * ~10:40 EST): the FOLDED form was not the bar for one morning —
 * folded was Osiris's head alone (the console), on the phone
 * exactly as on the PC.
 *
 * RESTORED (owner order 2026-11-24 ~16:57 EST): his window is
 * his own again — no god sits in it — and the folded form IS
 * the bar, phone exactly as written below. The one-button line
 * stands on the folded bar and on the OPEN box's input row.
 */
describe("command box phone bar — one button (Part D)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function renderPhoneBar(extra: Record<string, unknown> = {}) {
    const widthSpy = vi.spyOn(window, "innerWidth", "get").mockReturnValue(390);
    const heightSpy = vi.spyOn(window, "innerHeight", "get").mockReturnValue(844);
    const utils = render(
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
        {...extra}
      >
        <p>panel body</p>
      </CommandBox>,
    );
    return {
      ...utils,
      restore: () => {
        widthSpy.mockRestore();
        heightSpy.mockRestore();
      },
    };
  }

  it("the folded phone form is the bar — the field and ONE button, nothing else on the line", () => {
    // RESTORED (owner order 2026-11-24 ~16:57 EST): Part D's
    // folded bar — field, ONE button — is the folded form again;
    // the clean-screen morning's head console is superseded and
    // NO god rides this window at all now: the bar carries no
    // medallion, no face, no three dots. The one-button line
    // also stands on the OPEN box's input row (next tests).
    const { container, restore } = renderPhoneBar();
    try {
      const box = container.querySelector(".avatar-command-box") as HTMLElement;
      expect(box.classList.contains("avatar-command-box--phone-bar")).toBe(true);
      expect(box.classList.contains("avatar-command-box--minimized")).toBe(true);
      expect(box.classList.contains("avatar-command-box--console")).toBe(false);
      const bar = container.querySelector(".avatar-command-box__bar") as HTMLElement;
      expect(bar).not.toBeNull();
      // The field and the ONE button stand on the line.
      expect(screen.getByLabelText("Message for Anubis")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Open the message options/ }),
      ).toBeInTheDocument();
      // NOTHING else on the folded line: no send/mic/minimize
      // furniture, and no god — no face, no console dots.
      expect(screen.queryByRole("button", { name: "Send command" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Start voice input" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Minimize command box" })).not.toBeInTheDocument();
      expect(container.querySelector(".avatar-command-box__console-face")).toBeNull();
      expect(screen.queryByRole("button", { name: "Open Osiris's chat options" })).not.toBeInTheDocument();
      // And the options menu starts closed.
      expect(container.querySelector(".avatar-command-box__options")).toBeNull();
    } finally {
      restore();
    }
  });

  it("the window's four keys are not in this window — they are Osiris's now", () => {
    // THE KEYS MOVED (owner order 2026-11-24 ~16:57 EST): anchor,
    // reset, menu and minimize used to ride this box (the rail,
    // then the console's three dots). They live in Osiris's own
    // three-lines menu now — his medallion test pins them there.
    // In THIS window the rail carries only the grip toggle, and
    // no key answers anywhere in the box, folded or open.
    const { container, restore } = renderPhoneBar();
    try {
      openTheBox();
      const rail = container.querySelector(".avatar-command-box__rail") as HTMLElement;
      const railButtons = rail.querySelectorAll("button");
      expect(railButtons.length).toBe(1);
      expect(railButtons.item(0).getAttribute("aria-label")).toMatch(/Enlarge|Shrink/);
      expect(screen.queryByRole("button", { name: "Minimize command box" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Reset the chat window/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /nchor the chat window/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /tools menu/i })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("the one button opens the menus — send, microphone, emoji, menus, fold", () => {
    // Part D's one-button line lives on the folded bar AND on
    // the OPEN phone box's input row — the same line, the same
    // flow: one button, one menu, every act inside it.
    const onToggleVoice = vi.fn();
    const { container, restore } = renderPhoneBar({ onToggleVoice });
    try {
      openTheBox();
      fireEvent.click(screen.getByRole("button", { name: /Open the message options/ }));
      const menu = container.querySelector(".avatar-command-box__options") as HTMLElement;
      expect(menu).not.toBeNull();
      expect(screen.getByRole("menuitem", { name: /Send/ })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Microphone/ })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Emoji/ })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Menus/ })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Fold to the bar/ })).toBeInTheDocument();

      // The microphone row works from inside the menu (and the
      // menu stays open — the toggle now reads Close).
      fireEvent.click(screen.getByRole("menuitem", { name: /Microphone/ }));
      expect(onToggleVoice).toHaveBeenCalledTimes(1);

      // The fold row returns the box to the bar.
      fireEvent.click(screen.getByRole("button", { name: /Close the message options/ }));
      fireEvent.click(screen.getByRole("button", { name: /Open the message options/ }));
      fireEvent.click(screen.getByRole("menuitem", { name: /Fold to the bar/ }));
      const box = container.querySelector(".avatar-command-box") as HTMLElement;
      expect(box.classList.contains("avatar-command-box--minimized")).toBe(true);
      expect(box.classList.contains("avatar-command-box--console")).toBe(false);
    } finally {
      restore();
    }
  });

  it("send lives in the menu and submits what he typed in the bar", () => {
    const onSubmit = vi.fn();
    const { restore } = renderPhoneBar({ onSubmit, chat: "open the cube", onChatChange: vi.fn() });
    try {
      openTheBox();
      fireEvent.click(screen.getByRole("button", { name: /Open the message options/ }));
      fireEvent.click(screen.getByRole("menuitem", { name: /Send/ }));
      expect(onSubmit).toHaveBeenCalledWith("open the cube");
    } finally {
      restore();
    }
  });

  it("the stylesheet gives the bar's field a real tap target and keeps the options in flow", () => {
    // jsdom has no layout: the size law is pinned at the
    // stylesheet — the field stands 3.25rem tall at 1rem type
    // (bifocal), the toggle matches it, and the options panel is
    // an in-flow row above the line (order: -1), never a floating
    // layer that could clip against the box's border.
    const css = readFileSync(
      resolve(process.cwd(), "src/avatar/stage-fix-round.css"),
      "utf8",
    );
    const inputStart = css.indexOf(".avatar-command-box__form--phone .avatar-command-box__input {");
    expect(inputStart).toBeGreaterThan(-1);
    const inputRule = css.slice(inputStart, css.indexOf("}", inputStart));
    expect(inputRule).toContain("min-height: 3.25rem");
    expect(inputRule).toContain("font-size: 1rem");
    const optionsStart = css.indexOf(".avatar-command-box__options {");
    expect(optionsStart).toBeGreaterThan(-1);
    const optionsRule = css.slice(optionsStart, css.indexOf("}", optionsStart));
    expect(optionsRule).toContain("order: -1");
  });
});
