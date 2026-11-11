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
  Eye,
  GripVertical,
  Mic,
  MicOff,
  Minus,
  Settings,
  Sparkles,
  Terminal,
  type LucideIcon,
} from "lucide-react";
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
  /** Lets AvatarStage ("/minimize" etc.) collapse or restore the box. */
  onMinimizeShortcut?: (controls: { minimize: () => void; restore: () => void }) => void;
  /** Slash-driven minimization from inside the box's own commands. */
  externalMinimize?: number;
}) {
  const [position, setPosition] = useState(loadBoxPosition);
  const [minimized, setMinimized] = useState(loadBoxMinimized);
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
          className="avatar-command-box__window-button"
          onClick={toggleMinimized}
          aria-label={minimized ? "Expand command box" : "Minimize command box"}
          title={minimized ? "Expand" : "Minimize"}
        >
          {minimized ? <ChevronDown aria-hidden="true" /> : <Minus aria-hidden="true" />}
        </button>
      </div>

      {!minimized && (
        <>
          <div className="avatar-command-box__response" aria-live="polite">
            <span className="avatar-command-box__response-source">{responseSource}</span>
            <p>{responseLine}</p>
          </div>
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
