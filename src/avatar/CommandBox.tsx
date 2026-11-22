import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  Anchor,
  BookOpen,
  ChevronDown,
  Eye,
  GripVertical,
  Menu,
  Mic,
  MicOff,
  Minus,
  RotateCcw,
  Settings,
  Sparkles,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { clampWindowSize } from "./windows/windowGeometry";
import type { ReplyHistoryEntry } from "./replyHistory";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SLASH_COMMANDS,
  filterSlashCommands,
  isSlashMenuActive,
  slashQuery,
  type SlashCommand,
} from "./command/slashCommands";

export type CommandTab = "scene" | "motion" | "tools" | "settings" | "commands";

const BOX_POSITION_KEY = "augi.avatar.command-box.position.v1";
const BOX_SIZE_KEY = "augi.avatar.command-box.size.v2";
const BOX_ANCHOR_KEY = "augi.avatar.command-box.anchored.v1";

/**
 * The chat window's HOME form (owner order 2026-11-22, the defect
 * fix): compact — 500×430 class — anchored at the stage's
 * bottom-left corner, so the center of the stage and the Captain's
 * medallion stay clear. His own stretches replace the size (saved
 * under the v2 key — the v1 sizes belonged to the broken layout),
 * and the rail's reset button always brings the home form back in
 * one click.
 */
export const COMMAND_BOX_DEFAULT_SIZE = { w: 500, h: 430 } as const;

/** The anchored home spot: the bottom-left corner, in px margins. */
export const COMMAND_BOX_HOME_MARGIN = 16;

/**
 * THE ANCHOR (owner order 2026-11-22): the command box is ANCHORED
 * at its home corner by default — locked in place, per his anchor
 * law (anchored = locked until unanchored). Unanchoring frees it to
 * be dragged and stretched; the anchor state persists like the size
 * and position do. Anything but the explicit "unanchored" record
 * reads as anchored, so the box opens at home for everyone who has
 * never touched the control.
 */
export function loadBoxAnchored(): boolean {
  try {
    return globalThis.localStorage?.getItem(BOX_ANCHOR_KEY) !== "unanchored";
  } catch {
    return true;
  }
}

export function saveBoxAnchored(anchored: boolean) {
  try {
    globalThis.localStorage?.setItem(BOX_ANCHOR_KEY, anchored ? "anchored" : "unanchored");
  } catch {
    // best effort only
  }
}

function loadBoxSize(): { w: number; h: number } {
  let parsed: { w: number; h: number } = { ...COMMAND_BOX_DEFAULT_SIZE };
  try {
    const raw = globalThis.localStorage?.getItem(BOX_SIZE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (
        typeof value === "object" &&
        value !== null &&
        typeof (value as { w?: unknown }).w === "number" &&
        typeof (value as { h?: unknown }).h === "number"
      ) {
        parsed = value as { w: number; h: number };
      }
    }
  } catch {
    // fall through to the default size
  }
  if (typeof window === "undefined") return parsed;
  return clampWindowSize(parsed.w, parsed.h, window.innerWidth, window.innerHeight);
}

function saveBoxSize(size: { w: number; h: number }) {
  try {
    globalThis.localStorage?.setItem(BOX_SIZE_KEY, JSON.stringify(size));
  } catch {
    // best effort only
  }
}

function loadBoxPosition(): { x: number; y: number } | null {
  try {
    const raw = globalThis.localStorage?.getItem(BOX_POSITION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "x" in parsed &&
      "y" in parsed &&
      typeof (parsed as { x: unknown }).x === "number" &&
      typeof (parsed as { y: unknown }).y === "number"
    ) {
      return parsed as { x: number; y: number };
    }
  } catch {
    // fall through to default
  }
  return null;
}

function saveBoxPosition(position: { x: number; y: number }) {
  try {
    globalThis.localStorage?.setItem(BOX_POSITION_KEY, JSON.stringify(position));
  } catch {
    // best effort only
  }
}

/**
 * MINIMIZED IS SESSION-ONLY (owner defect fix 2026-11-22): the
 * minimized state used to persist, so a box he once collapsed
 * reopened as a tall empty panel with the conversation hidden and
 * the input floating mid-box — the "horrible" broken panel on his
 * screen. The box now ALWAYS reloads in its full home form;
 * minimizing lasts only until he expands it or reloads.
 */
function clearPersistedBoxLayout() {
  try {
    globalThis.localStorage?.removeItem(BOX_POSITION_KEY);
    globalThis.localStorage?.removeItem(BOX_SIZE_KEY);
  } catch {
    // best effort only
  }
}

export function CommandBox({
  accent,
  tabs,
  activeTab,
  onTabChange,
  children,
  chat,
  onChatChange,
  onSubmit,
  voiceAvailable,
  voiceListening,
  onToggleVoice,
  responseLine,
  responseSource,
  userLine,
  history,
  onMinimizeShortcut,
  presence,
  partnerSpeaking,
}: {
  accent: string;
  tabs: Array<{ id: CommandTab; label: string; icon: LucideIcon }>;
  activeTab: CommandTab;
  onTabChange: (tab: CommandTab) => void;
  children: ReactNode;
  chat: string;
  onChatChange: (value: string) => void;
  onSubmit: (text: string) => void;
  voiceAvailable: boolean;
  voiceListening: boolean;
  onToggleVoice: () => void;
  responseLine: string;
  responseSource: string;
  /**
   * The operator's own last submitted message (typed or spoken), echoed
   * above the reply — he must always see what he sent (defect 2026-11-21:
   * the box showed only Augie's reply and his messages vanished).
   */
  userLine?: string | undefined;
  /**
   * The full conversation (the reply-history store), rendered as the
   * chat log itself — flowing lines, Captain / Anubis / System, in
   * order. There is no thread picker or dropdown on the face (owner
   * order 2026-11-22); the log simply IS the window.
   */
  history?: ReplyHistoryEntry[] | undefined;
  /** Lets AvatarStage ("/minimize" etc.) collapse or restore the box. */
  onMinimizeShortcut?: (controls: { minimize: () => void; restore: () => void }) => void;
  /** Slash-driven minimization from inside the box's own commands. */
  externalMinimize?: number;
  /**
   * Augie's living presence (owner order 2026-11-22): the circular
   * animated face rendered at the head of the rail, beside the title.
   * Supplied by AvatarStage; the box itself stays a dumb container.
   */
  presence?: ReactNode;
  /**
   * True while Anubis is actually speaking (bridge state SPEAKING):
   * the chat panel carries the speaking glow so the conversation is
   * visibly tied to the medallion at top-center.
   */
  partnerSpeaking?: boolean;
}) {
  const [position, setPosition] = useState(loadBoxPosition);
  const [minimized, setMinimized] = useState(false);
  const [boxSize, setBoxSize] = useState(loadBoxSize);
  const [anchored, setAnchored] = useState(loadBoxAnchored);
  const [viewport, setViewport] = useState(() =>
    typeof window === "undefined"
      ? { w: 0, h: 0 }
      : { w: window.innerWidth, h: window.innerHeight },
  );
  const sizeRef = useRef(boxSize);
  sizeRef.current = boxSize;
  // Part 28: the tab machinery (Scene / Motion / Tools / Settings /
  // Commands panels) lives behind ONE Menu button. The default face is
  // the chat alone; the menu opens only when he asks for it and is not
  // persisted — every fresh load starts as a plain chat box.
  const [machineryOpen, setMachineryOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizing = useRef<{
    mode: "corner" | "right" | "bottom";
    startX: number;
    startY: number;
    w: number;
    h: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLElement>(null);

  // Clamp a candidate position into the viewport.
  const clamp = useCallback(
    (x: number, y: number) => {
      const width = boxRef.current?.offsetWidth ?? sizeRef.current.w;
      const height = boxRef.current?.offsetHeight ?? sizeRef.current.h;
      return {
        x: Math.min(Math.max(x, 8), Math.max(8, window.innerWidth - width - 8)),
        y: Math.min(Math.max(y, 8), Math.max(8, window.innerHeight - height - 8)),
      };
    },
    [],
  );

  const minimizeNow = useCallback(() => {
    setMinimized(true);
  }, []);
  const restoreNow = useCallback(() => {
    setMinimized(false);
  }, []);

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Anchored means locked in place (his anchor law) — no drag
      // until he unanchors the box from the rail's anchor button.
      if (anchored) return;
      if ("button" in event && event.button !== 0) return;
    // The grip's own minimize/expand button keeps its click: starting a
    // drag here captures the pointer to the grip, and a captured pointer
    // retargets the click to the grip — the button never receives it, so
    // pressing minimize appeared to do nothing. Dragging starts from the
    // grip itself, never from its button. (Same fix as FloatingWindow.)
    if ((event.target as HTMLElement).closest?.("button")) return;
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    dragging.current = true;
    dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    },
    [anchored],
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const next = clamp(
        event.clientX - dragOffset.current.x,
        event.clientY - dragOffset.current.y,
      );
      setPosition(next);
    },
    [clamp],
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    saveBoxPosition({
      x: boxRef.current?.getBoundingClientRect().left ?? 0,
      y: boxRef.current?.getBoundingClientRect().top ?? 0,
    });
  }, []);

  const toggleMinimized = useCallback(() => {
    setMinimized((current) => !current);
  }, []);

  /**
   * ONE-CLICK RESET (ForeverUI pattern, owner order 2026-11-22):
   * whatever he has dragged or stretched the panel into, one click
   * on the rail's reset button restores the shipped home form —
   * compact size, bottom-left home corner, anchored, expanded —
   * and clears the saved size/position so a reload opens the same.
   */
  const resetBoxLayout = useCallback(() => {
    clearPersistedBoxLayout();
    setBoxSize({ ...COMMAND_BOX_DEFAULT_SIZE });
    setPosition(null);
    setAnchored(true);
    saveBoxAnchored(true);
    setMinimized(false);
    setMachineryOpen(false);
  }, []);

  // RESIZE (owner correction 2026-11-22): the chat window stretches
  // from its right edge, bottom edge, or corner grip, and the size he
  // leaves it at persists — the same discipline as the container
  // windows (windowGeometry clamps it inside the viewport).
  const startResize =
    (mode: "corner" | "right" | "bottom") => (event: ReactPointerEvent<HTMLDivElement>) => {
      // Anchored = locked: no stretching until he unanchors.
      if (anchored) return;
      if ("button" in event && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = boxRef.current?.getBoundingClientRect();
      resizing.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        w: rect && rect.width > 0 ? rect.width : sizeRef.current.w,
        h: rect && rect.height > 0 ? rect.height : sizeRef.current.h,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };
  const moveResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const active = resizing.current;
    if (!active) return;
    const nextW = active.mode === "bottom" ? active.w : active.w + (event.clientX - active.startX);
    const nextH = active.mode === "right" ? active.h : active.h + (event.clientY - active.startY);
    setBoxSize(clampWindowSize(nextW, nextH, window.innerWidth, window.innerHeight));
  }, []);
  const endResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizing.current) return;
    resizing.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    saveBoxSize(sizeRef.current);
  }, []);

  // THE ANCHOR TOGGLE: anchored, the box sits locked at its home
  // corner — the stage's bottom-left (owner order 2026-11-22: the
  // chat sits at the bottom, the stage's center and the Captain's
  // medallion stay clear). Unanchoring keeps it exactly where it
  // sits and hands him the drag and the stretch; anchoring again
  // returns it home. The state persists (loadBoxAnchored).
  const [anchorPos, setAnchorPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!anchored) {
      setAnchorPos(null);
      return;
    }
    const height = boxRef.current?.offsetHeight || boxSize.h;
    setAnchorPos({
      x: COMMAND_BOX_HOME_MARGIN,
      y: Math.max(8, viewport.h - height - COMMAND_BOX_HOME_MARGIN),
    });
  }, [anchored, boxSize, minimized, viewport]);

  const toggleAnchored = useCallback(() => {
    if (anchored) {
      // Unanchor in place: the centered spot becomes the free
      // position, so the box does not jump when the lock comes off.
      const rect = boxRef.current?.getBoundingClientRect();
      const free = {
        x: rect ? Math.round(rect.left) : (anchorPos?.x ?? 0),
        y: rect ? Math.round(rect.top) : (anchorPos?.y ?? 0),
      };
      setPosition(free);
      saveBoxPosition(free);
      setAnchored(false);
      saveBoxAnchored(false);
    } else {
      setAnchored(true);
      saveBoxAnchored(true);
    }
  }, [anchored, anchorPos]);

  // Keep the newest line in view as the conversation flows.
  useEffect(() => {
    const thread = threadRef.current;
    if (!minimized && thread) thread.scrollTop = thread.scrollHeight;
  }, [minimized, history, responseLine, userLine]);

  // Slash-menu state derived from the draft text.
  const menuOpen = !minimized && isSlashMenuActive(chat);
  const slashFilter = menuOpen ? (slashQuery(chat) ?? "") : null;
  const suggestions = slashFilter === null ? [] : filterSlashCommands(slashFilter);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  useEffect(() => {
    setHighlightedIndex(0);
  }, [slashFilter]);

  const applySuggestion = useCallback(
    (command: SlashCommand) => {
      // Replace the trailing "/token" with the full command + space.
      onChatChange(chat.replace(/(^|\s)\/[^\s]*$/, `$1${command.command} `));
      inputRef.current?.focus();
    },
    [chat, onChatChange],
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chat.trim();
    if (!text) return;
    onChatChange("");
    onSubmit(text);
  };

  const boxStyle = {
    ...(anchored
      ? anchorPos
        ? { left: anchorPos.x, top: anchorPos.y, right: "auto", bottom: "auto", transform: "none" }
        : { left: COMMAND_BOX_HOME_MARGIN, top: "auto", right: "auto", bottom: COMMAND_BOX_HOME_MARGIN, transform: "none" }
      : position
        ? { left: position.x, top: position.y, right: "auto", bottom: "auto", transform: "none" }
        : {}),
    width: boxSize.w,
    height: minimized ? undefined : boxSize.h,
  } as const;

  // THE MMORPG CHAT PANEL (owner orders 2026-11-21 Part 28, and
  // 2026-11-22 — the picked Drakensang-style reference): a slim rail
  // of round controls down the left edge, a flowing chat log whose
  // lines lead with the speaker's name (Captain / Anubis / System),
  // and one clean input bar at the bottom. NO conversation dropdown,
  // no thread machinery on the face — the log simply flows. All other
  // machinery stays behind the rail's one Menu button. The window
  // drags by its rail and stretches from its edges/corner; position
  // and size both persist.

  const lastEntry = history && history.length > 0 ? history[history.length - 1] : undefined;
  const showLiveUser = Boolean(userLine) && userLine !== lastEntry?.question;
  const liveSpeaker =
    responseSource === "microphone" || responseSource === "awaiting response"
      ? "System"
      : "Anubis";
  const showLiveResponse = Boolean(responseLine) && responseLine !== lastEntry?.answer;

  return (
    <section
      ref={boxRef}
      className={`avatar-command-box${minimized ? " avatar-command-box--minimized" : ""}${partnerSpeaking ? " avatar-command-box--partner-speaking" : ""}${anchored ? " avatar-command-box--anchored" : ""}`}
      style={boxStyle}
      data-anchored={anchored ? "true" : "false"}
      aria-label="Chat with Anubis"
    >
      <div
        className="avatar-command-box__rail avatar-command-box__grip"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="separator"
        aria-label={anchored ? "Chat window anchored at its home corner" : "Drag to move the chat window"}
        title={anchored ? "Anchored at the bottom-left home corner — unanchor to move" : "Drag to move"}
      >
        <GripVertical aria-hidden="true" />
        {presence}
        <span className="avatar-command-box__title">Chat</span>
        <button
          type="button"
          className="avatar-command-box__window-button avatar-command-box__anchor-button"
          onClick={toggleAnchored}
          aria-pressed={anchored}
          aria-label={anchored ? "Unanchor the chat window" : "Anchor the chat window at its home corner"}
          title={
            anchored
              ? "Anchored at the bottom-left home corner — tap to unanchor, then drag and stretch it"
              : "Unanchored — tap to anchor it back at the bottom-left home corner"
          }
        >
          <Anchor aria-hidden="true" />
          <span className="sr-only">{anchored ? "Unanchor" : "Anchor"}</span>
        </button>
        <button
          type="button"
          className="avatar-command-box__window-button avatar-command-box__reset-button"
          onClick={resetBoxLayout}
          aria-label="Reset the chat window to its home spot and size"
          title="Reset — the chat window back to its compact home form, bottom-left"
        >
          <RotateCcw aria-hidden="true" />
          <span className="sr-only">Reset</span>
        </button>
        <button
          type="button"
          className="avatar-command-box__window-button avatar-command-box__menu-button"
          onClick={() => {
            if (minimized) restoreNow();
            setMachineryOpen((open) => !open);
          }}
          aria-expanded={machineryOpen}
          aria-controls="avatar-command-machinery"
          aria-label={machineryOpen ? "Close the tools menu" : "Open the tools menu"}
          title="Menu — tools, rooms and settings"
        >
          <Menu aria-hidden="true" />
          <span className="sr-only">Menu</span>
        </button>
        <button
          type="button"
          className="avatar-command-box__window-button"
          onClick={toggleMinimized}
          aria-label={minimized ? "Expand command box" : "Minimize command box"}
          title={minimized ? "Expand" : "Minimize"}
        >
          {minimized ? <ChevronDown aria-hidden="true" /> : <Minus aria-hidden="true" />}
        </button>
      </div>

      {/* THE MAIN COLUMN (owner defect fix 2026-11-22): machinery on
          top, the conversation filling the middle, and the input
          form as the column's last child — pinned to the panel's
          bottom at every size, by construction, not by luck. */}
      <div className="avatar-command-box__main">
      {!minimized && machineryOpen && (
        <div id="avatar-command-machinery" className="avatar-command-box__machinery">
          <div className="avatar-command-box__tabs" role="tablist" aria-label="Command tabs">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`avatar-cabinet-tab-${id}`}
                className="avatar-command-box__tab"
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                aria-controls="avatar-command-panel"
                onClick={() => onTabChange(id)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div
            id="avatar-command-panel"
            className="avatar-command-box__panel"
            role="tabpanel"
            aria-labelledby={`avatar-cabinet-tab-${activeTab}`}
          >
            {activeTab === "commands" ? <CommandsDocument highlighted={null} /> : children}
          </div>
        </div>
      )}

      {!minimized && (
        <div className="avatar-command-box__conversation" role="group" aria-label="Chat">
          <div
            id="avatar-command-thread"
            className="avatar-command-box__thread"
            ref={threadRef}
            role="log"
            aria-label="Chat log"
            aria-live="polite"
          >
            {/* BOTTOM-STACKED FLOW (owner order 2026-11-22): the
                lines stack from the bottom up like a regular chat
                window — margin-top:auto pins the stack to the
                thread's bottom when it is short, the newest line
                sits last, right above the input, and a long log
                scrolls with the newest kept in view. */}
            <div className="avatar-command-box__thread-flow">
            {history?.map((entry, index) => (
              <div className="avatar-command-box__thread-entry" key={`${entry.at}-${index}`}>
                {entry.question && (
                  <p className="avatar-command-box__thread-q">
                    <span className="avatar-command-box__thread-who">Captain:</span>{" "}
                    {entry.question}
                  </p>
                )}
                <p className="avatar-command-box__thread-a">
                  <span className="avatar-command-box__thread-who">Anubis:</span> {entry.answer}
                </p>
              </div>
            ))}
            {showLiveUser && (
              <p className="avatar-command-box__thread-q avatar-command-box__user-line">
                <span className="avatar-command-box__thread-who">Captain:</span> {userLine}
              </p>
            )}
            {showLiveResponse && (
              <p
                className={
                  liveSpeaker === "System"
                    ? "avatar-command-box__thread-system"
                    : "avatar-command-box__thread-a"
                }
              >
                <span className="avatar-command-box__thread-who">{liveSpeaker}:</span>{" "}
                {responseLine}
              </p>
            )}
            {showLiveResponse && liveSpeaker === "Anubis" && responseSource && (
              <p className="avatar-command-box__response-source">Answered by {responseSource}</p>
            )}
            {!history?.length && !showLiveUser && !showLiveResponse && (
              <p className="avatar-command-box__thread-system">
                <span className="avatar-command-box__thread-who">System:</span> Standing by —
                talk to Anubis here.
              </p>
            )}
            </div>
          </div>
        </div>
      )}

      {menuOpen && suggestions.length > 0 && (
        <ul className="avatar-command-box__menu" role="listbox" aria-label="Slash commands">
          {suggestions.map((command, index) => (
            <li key={command.command}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                className="avatar-command-box__menu-item"
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => applySuggestion(command)}
              >
                <code>{command.command}</code>
                <span>{command.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="avatar-command-box__form" onSubmit={submit}>
        <label className="sr-only" htmlFor="avatar-command-input">
          Message for Anubis
        </label>
        <input
          id="avatar-command-input"
          ref={inputRef}
          className="avatar-command-box__input"
          placeholder="Message Anubis — / for commands"
          value={chat}
          onChange={(event) => onChatChange(event.target.value)}
          onKeyDown={(event) => {
            if (!menuOpen || suggestions.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedIndex((i) => (i + 1) % suggestions.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (event.key === "Enter" && suggestions[highlightedIndex]) {
              event.preventDefault();
              applySuggestion(suggestions[highlightedIndex]!);
            } else if (event.key === "Escape") {
              onChatChange(chat.replace(/(^|\s)\/[^\s]*$/, "$1"));
            }
          }}
          autoComplete="off"
        />
        <button
          className="avatar-command-box__icon-button"
          type="button"
          onClick={onToggleVoice}
          disabled={!voiceAvailable}
          aria-label={voiceListening ? "Stop voice input" : "Start voice input"}
          title={
            voiceAvailable ? "Toggle voice input" : "Voice input is unavailable in this browser"
          }
        >
          {voiceListening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
        </button>
        <button
          className="avatar-command-box__send"
          type="submit"
          disabled={!chat.trim()}
          aria-label="Send command"
        >
          <Sparkles aria-hidden="true" />
        </button>
      </form>
      </div>
      {!minimized && (
        <>
          <div
            className="avatar-command-box__resize avatar-command-box__resize--right"
            onPointerDown={startResize("right")}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            aria-hidden="true"
            title="Drag to stretch the chat window"
          />
          <div
            className="avatar-command-box__resize avatar-command-box__resize--bottom"
            onPointerDown={startResize("bottom")}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            aria-hidden="true"
            title="Drag to stretch the chat window"
          />
          <div
            className="avatar-command-box__resize avatar-command-box__resize--corner"
            onPointerDown={startResize("corner")}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            role="separator"
            aria-label="Resize the chat window"
            title="Drag to stretch the chat window"
          />
        </>
      )}
      <style>{`--augi-command-accent:${accent}`}</style>
    </section>
  );
}

/** The full capability document — /help and the Commands tab share this. */
export function CommandsDocument({ highlighted }: { highlighted: string | null }) {
  return (
    <div className="avatar-command-doc">
      <p className="avatar-command-doc__intro">
        Every command Anubis can pass to AUGI — nothing hidden. Most work typed or spoken; slash
        forms always work typed.
      </p>
      {CATEGORY_ORDER.map((category) => {
        const items = SLASH_COMMANDS.filter((c) => c.category === category);
        return (
          <section key={category} className="avatar-command-doc__section">
            <h3>{CATEGORY_LABELS[category]}</h3>
            <dl>
              {items.map((item) => (
                <div
                  key={item.command}
                  className={`avatar-command-doc__row${highlighted === item.command ? " is-highlighted" : ""}`}
                >
                  <dt>
                    <code>{item.command}</code>
                  </dt>
                  <dd>
                    {item.description}
                    {item.example && (
                      <span className="avatar-command-doc__example">
                        {" "}
                        e.g. &ldquo;{item.example}&rdquo;
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
      <p className="avatar-command-doc__limits">
        What he cannot do: record or save camera frames, identify people by face, act without being
        asked, attack the operator or anyone marked safe, or reach beyond this world and its tools.
      </p>
    </div>
  );
}

export const COMMAND_TAB_ICONS = { Activity, BookOpen, Eye, Settings, Terminal };
