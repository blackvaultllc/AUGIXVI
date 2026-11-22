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
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Menu,
  MessagesSquare,
  Mic,
  MicOff,
  Minus,
  Settings,
  Sparkles,
  Terminal,
  type LucideIcon,
} from "lucide-react";
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
const BOX_MINIMIZED_KEY = "augi.avatar.command-box.minimized.v1";
const BOX_THREAD_KEY = "augi.avatar.command-box.thread.v1";

function loadThreadOpen(): boolean {
  try {
    const stored = globalThis.localStorage?.getItem(BOX_THREAD_KEY);
    // Part 28 (owner order 2026-11-21): the default face is a plain
    // chat, so the thread is OPEN by default — only an explicit saved
    // "false" (he collapsed it himself) starts it closed.
    if (stored === null || stored === undefined) return true;
    return stored === "true";
  } catch {
    return true;
  }
}

function saveThreadOpen(open: boolean) {
  try {
    globalThis.localStorage?.setItem(BOX_THREAD_KEY, open ? "true" : "false");
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

function loadBoxMinimized(): boolean {
  try {
    return globalThis.localStorage?.getItem(BOX_MINIMIZED_KEY) === "true";
  } catch {
    return false;
  }
}

function saveBoxMinimized(minimized: boolean) {
  try {
    globalThis.localStorage?.setItem(BOX_MINIMIZED_KEY, minimized ? "true" : "false");
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
   * The full conversation (the reply-history store), shown as an
   * expandable thread pinned directly above the input — the operator
   * reads back over the exchange WHILE he types (owner order
   * 2026-11-21) instead of opening the separate history window.
   */
  history?: ReplyHistoryEntry[] | undefined;
  /** Lets AvatarStage ("/minimize" etc.) collapse or restore the box. */
  onMinimizeShortcut?: (controls: { minimize: () => void; restore: () => void }) => void;
  /** Slash-driven minimization from inside the box's own commands. */
  externalMinimize?: number;
}) {
  const [position, setPosition] = useState(loadBoxPosition);
  const [minimized, setMinimized] = useState(loadBoxMinimized);
  const [threadOpen, setThreadOpen] = useState(loadThreadOpen);
  // Part 28: the tab machinery (Scene / Motion / Tools / Settings /
  // Commands panels) lives behind ONE Menu button. The default face is
  // the chat alone; the menu opens only when he asks for it and is not
  // persisted — every fresh load starts as a plain chat box.
  const [machineryOpen, setMachineryOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLElement>(null);

  // Clamp a candidate position into the viewport.
  const clamp = useCallback((x: number, y: number) => {
    const width = boxRef.current?.offsetWidth ?? 380;
    const height = boxRef.current?.offsetHeight ?? 200;
    return {
      x: Math.min(Math.max(x, 8), Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(Math.max(y, 8), Math.max(8, window.innerHeight - height - 8)),
    };
  }, []);

  const minimizeNow = useCallback(() => {
    setMinimized(true);
    saveBoxMinimized(true);
  }, []);
  const restoreNow = useCallback(() => {
    setMinimized(false);
    saveBoxMinimized(false);
  }, []);

  const startDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
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
  }, []);

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
    setMinimized((current) => {
      saveBoxMinimized(!current);
      return !current;
    });
  }, []);

  const toggleThread = useCallback(() => {
    setThreadOpen((current) => {
      saveThreadOpen(!current);
      return !current;
    });
  }, []);

  // Keep the newest exchange in view while the thread is open.
  useEffect(() => {
    const thread = threadRef.current;
    if (threadOpen && thread) thread.scrollTop = thread.scrollHeight;
  }, [threadOpen, history]);

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

  const boxStyle = position
    ? { left: position.x, top: position.y, right: "auto", bottom: "auto", transform: "none" }
    : undefined;

  // PLAIN CHAT FACE (Part 28, owner order 2026-11-21 — supersedes the
  // MMORPG tab-first layout): the default face is a regular chat box —
  // the conversation thread (open by default) plus the latest exchange,
  // and the input pinned at the bottom. ALL machinery — the tabs and
  // their panels — sits behind the one Menu button in the grip and
  // renders only while the menu is open. The grip stays the window's
  // drag/title bar; when minimized it and the input are all that show.

  return (
    <section
      ref={boxRef}
      className={`avatar-command-box${minimized ? " avatar-command-box--minimized" : ""}`}
      style={boxStyle}
      aria-label="Command box"
    >
      <div
        className="avatar-command-box__grip"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="separator"
        aria-label="Drag to move the command box"
        title="Drag to move"
      >
        <GripVertical aria-hidden="true" />
        <span className="avatar-command-box__title">Command</span>
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
          title="Tools, rooms and settings"
        >
          <Menu aria-hidden="true" />
          <span>Menu</span>
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
        <>
          <div className="avatar-command-box__conversation" role="group" aria-label="Conversation">
            {history !== undefined && (
              <>
                <button
                  type="button"
                  className="avatar-command-box__thread-toggle"
                  aria-expanded={threadOpen}
                  aria-controls="avatar-command-thread"
                  onClick={toggleThread}
                >
                  <MessagesSquare aria-hidden="true" />
                  <span>Conversation{history.length > 0 ? ` (${history.length})` : ""}</span>
                  {threadOpen ? (
                    <ChevronUp aria-hidden="true" />
                  ) : (
                    <ChevronDown aria-hidden="true" />
                  )}
                </button>
                {threadOpen && (
                  <div
                    id="avatar-command-thread"
                    className="avatar-command-box__thread"
                    ref={threadRef}
                    role="log"
                    aria-label="Conversation so far"
                  >
                    {history.length === 0 ? (
                      <p className="avatar-command-box__thread-empty">
                        Nothing yet — your messages and Augie&rsquo;s replies collect here, in
                        order, so you can read back over the conversation while you type.
                      </p>
                    ) : (
                      history.map((entry, index) => (
                        <div
                          className="avatar-command-box__thread-entry"
                          key={`${entry.at}-${index}`}
                        >
                          {entry.question && (
                            <p className="avatar-command-box__thread-q">
                              <span className="avatar-command-box__thread-who">You:</span>{" "}
                              {entry.question}
                            </p>
                          )}
                          <p className="avatar-command-box__thread-a">
                            <span className="avatar-command-box__thread-who">Augie:</span>{" "}
                            {entry.answer}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
            <div className="avatar-command-box__response" aria-live="polite">
              {userLine ? (
                <p className="avatar-command-box__user-line">
                  <span className="avatar-command-box__user-label">You:</span> {userLine}
                </p>
              ) : null}
              <span className="avatar-command-box__response-source">{responseSource}</span>
              <p>{responseLine}</p>
            </div>
          </div>
        </>
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
          Command for Osiris
        </label>
        <input
          id="avatar-command-input"
          ref={inputRef}
          className="avatar-command-box__input"
          placeholder="Type a command — / for everything he can do"
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
      <style>{`--augi-command-accent:${accent}`}</style>
    </section>
  );
}

/** The full capability document — /help and the Commands tab share this. */
export function CommandsDocument({ highlighted }: { highlighted: string | null }) {
  return (
    <div className="avatar-command-doc">
      <p className="avatar-command-doc__intro">
        Every command Osiris can act on — nothing hidden. Most work typed or spoken; slash forms
        always work typed.
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
