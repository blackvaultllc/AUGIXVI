import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eraser,
  Eye,
  GripVertical,
  History,
  Menu,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Settings,
  Smile,
  Sparkles,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import {
  WINDOW_MARGIN,
  clampWindowPosition,
  clampWindowSize,
} from "./windows/windowGeometry";
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
const BOX_ENLARGED_KEY = "augi.avatar.command-box.enlarged.v1";
const BOX_ENLARGED_SIZE_KEY = "augi.avatar.command-box.enlarged-size.v1";

/**
 * The chat window's HOME form (owner order 2026-11-22, the defect
 * fix): compact, anchored at the stage's corner, so the center of
 * the stage and the Captain's medallion stay clear. His own
 * stretches replace the size (saved under the v2 key — the v1
 * sizes belonged to the broken layout), and the reset key always
 * brings the home form back in one click.
 *
 * THE HOME IS THE BOTTOM-LEFT (owner order 2026-11-24 ~16:57
 * EST — the Captain's refinement, superseding the top-left home
 * of the clean-screen round the same morning): the chat window
 * is THE CAPTAIN'S OWN WINDOW — it stands by itself along the
 * bottom of the stage, no god inside it or heading it. The
 * anchored box seats at the bottom-left now; the anchor, the
 * reset, and the healing clamp all work to that corner. (The
 * top-left belongs to Osiris's own medallion, standing bare —
 * OsirisMedallion.tsx.)
 *
 * SMALLER STILL (owner eye-check 2026-11-23 ~06:51 EST): "It's
 * too big — make the box smaller for the PC." The home form comes
 * down again, to 420×360. His saved size still outranks this
 * default the moment he sets one himself.
 */
export const COMMAND_BOX_DEFAULT_SIZE = { w: 420, h: 360 } as const;

/**
 * THE SMALLEST THE BOX MAY BE (owner desk photos 2026-11-23
 * ~07:11 EST): shrunk past the layout's floor, the box broke
 * apart in his photos — the input row's buttons fell out of the
 * bottom, the rail's foot poked below the border, log lines ran
 * off the right edge. The minimum is set where the layout still
 * holds: wide enough for the rail (120px) plus a thread that
 * wraps and an input row whose buttons stay inside, tall enough
 * for the rail's tightened stack (~342px) inside the border.
 * Every size path — load, stretch, enlarge — clamps to it, so a
 * size saved by an older, smaller box heals UP to the floor.
 */
export const COMMAND_BOX_MIN_SIZE = { w: 320, h: 348 } as const;

/** The anchored home spot: the bottom-left corner, in px margins. */
export const COMMAND_BOX_HOME_MARGIN = 16;

/**
 * THE ANCHOR (owner orders 2026-11-22): the command box is ANCHORED
 * at its home corner by default — locked in place, per his anchor
 * law (anchored = locked until unanchored). Unanchoring frees it to
 * be dragged and stretched; the anchor state persists like the size
 * and position do. Anything but the explicit "unanchored" record
 * reads as anchored, so the box opens at home for everyone who has
 * never touched the control.
 *
 * A GENUINE GRAB UNANCHORS (owner eye-check 2026-11-23): he
 * grabbed the box and it would not move — "I click it and I can't
 * move it" — because the lock refused every drag until he found
 * the rail's anchor toggle. The anchor still seats the box at
 * home on load and still re-seats it from the rail button, but a
 * real grab on the grip (or a stretch on an edge) lifts the lock
 * in place and moves the box. The box never refuses his hand.
 *
 * THE ANCHOR HOME IS THE LEFT SIDE (owner refinement 2026-11-22,
 * superseding the same day's center placement): at regular,
 * non-maximized window sizes the centered box overlapped other
 * elements — "make it align anchor to the left side of the screen
 * which gives more space and do it properly." The anchored box
 * sits at the left with a clear margin on every side, fully
 * on-screen at any window size, clear of the right-side selection
 * buttons. WHICH left corner is the Captain's refinement call
 * (2026-11-24 ~16:57 EST): the BOTTOM-left — his window stands
 * along the bottom of the stage.
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

function loadBoxSizeFrom(
  key: string,
  fallback: { w: number; h: number },
): { w: number; h: number } {
  let parsed: { w: number; h: number } = { ...fallback };
  try {
    const raw = globalThis.localStorage?.getItem(key);
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
    // fall through to the fallback size
  }
  if (typeof window === "undefined") return parsed;
  return clampWindowSize(
    parsed.w,
    parsed.h,
    window.innerWidth,
    window.innerHeight,
    COMMAND_BOX_MIN_SIZE.w,
    COMMAND_BOX_MIN_SIZE.h,
  );
}

/**
 * THE PHONE DEFAULT (owner order 2026-11-22 — "make the box smaller
 * for the phone and I can minimize and make it bigger"): below the
 * stylesheet's phone breakpoint, the desktop default (460×400)
 * clamps to nearly the whole screen, so the panel filled his phone
 * even with an empty thread. With NO saved size on record, a
 * phone-width viewport opens at this compact default instead. The
 * moment he stretches the box or enlarges it, that size persists
 * under the same records as on desktop — the phone default only
 * ever fills the gap before his first stretch, and his saved size
 * always wins over it.
 */
export const COMMAND_BOX_PHONE_BREAKPOINT = 700;

export function phoneDefaultBoxSize(
  viewportW: number,
  viewportH: number,
): { w: number; h: number } {
  return clampWindowSize(
    Math.min(340, viewportW),
    Math.min(400, Math.round(viewportH * 0.45)),
    viewportW,
    viewportH,
  );
}

function hasSavedBoxSize(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) != null;
  } catch {
    return false;
  }
}

function loadBoxSize(): { w: number; h: number } {
  if (
    typeof window !== "undefined" &&
    window.innerWidth <= COMMAND_BOX_PHONE_BREAKPOINT &&
    !hasSavedBoxSize(BOX_SIZE_KEY)
  ) {
    return phoneDefaultBoxSize(window.innerWidth, window.innerHeight);
  }
  return loadBoxSizeFrom(BOX_SIZE_KEY, COMMAND_BOX_DEFAULT_SIZE);
}

function saveBoxSizeTo(key: string, size: { w: number; h: number }) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(size));
  } catch {
    // best effort only
  }
}

/**
 * CLICK-TO-ENLARGE (owner order 2026-11-22): tapping the rail's dot
 * grip grows the chat box to an enlarged state — the exact same
 * format, only bigger, type included — and tapping it again returns
 * to the standard size. Each state keeps its OWN size record: the
 * standard size he stretched persists under BOX_SIZE_KEY exactly as
 * before, and the enlarged size persists under its own key, so the
 * box reopens in whichever state he left it, at the size he left
 * that state at. The enlarged default is the standard size scaled.
 */
export const COMMAND_BOX_ENLARGE_SCALE = 1.4;

export function loadBoxEnlarged(): boolean {
  try {
    return globalThis.localStorage?.getItem(BOX_ENLARGED_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveBoxEnlarged(enlarged: boolean) {
  try {
    globalThis.localStorage?.setItem(BOX_ENLARGED_KEY, enlarged ? "true" : "false");
  } catch {
    // best effort only
  }
}

function loadBoxEnlargedSize(standard: { w: number; h: number }): { w: number; h: number } {
  return loadBoxSizeFrom(BOX_ENLARGED_SIZE_KEY, {
    w: Math.round(standard.w * COMMAND_BOX_ENLARGE_SCALE),
    h: Math.round(standard.h * COMMAND_BOX_ENLARGE_SCALE),
  });
}

/** Save a size under the record of the state it belongs to. */
function persistBoxSize(size: { w: number; h: number }, enlarged: boolean) {
  saveBoxSizeTo(enlarged ? BOX_ENLARGED_SIZE_KEY : BOX_SIZE_KEY, size);
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
 *
 * THE PHONE EXCEPTION (owner eye-check + phone spec 2026-11-23):
 * on a phone-width screen the chat is a bottom BAR (see PHONE BAR
 * below), and a bar starts as a bar — minimized is the phone's
 * opening form, so he gets his stage and taps the bar when he
 * wants the conversation. Still session-only: nothing persists.
 */
function clearPersistedBoxLayout() {
  try {
    globalThis.localStorage?.removeItem(BOX_POSITION_KEY);
    globalThis.localStorage?.removeItem(BOX_SIZE_KEY);
    globalThis.localStorage?.removeItem(BOX_ENLARGED_SIZE_KEY);
    globalThis.localStorage?.removeItem(BOX_ENLARGED_KEY);
  } catch {
    // best effort only
  }
}

/** The chat strip's preview: how long a faded-in message stays
 *  readable over the bottom of another screen before it fades. */
export const STRIP_PREVIEW_HOLD_MS = 5200;
/** The fade itself — a smooth opacity glide, never a flash. */
export const STRIP_PREVIEW_FADE_MS = 650;

/**
 * THE EMOJI KEYS (owner order 2026-11-22 ~19:53 EST): he can add
 * emojis to a conversation — the picker's keys insert into the
 * message he is writing, and from there they send and render like
 * any other character he typed. A small standing set, no library.
 */
export const CHAT_EMOJIS = [
  "😀", "😂", "🙂", "😉", "😎", "🤔", "👍", "🙏",
  "🔥", "⭐", "❤️", "💯", "🎉", "👑", "🏆", "⚡",
  "🛡️", "🦅", "🌟", "✅", "❗", "❓", "💬", "👀",
] as const;

/**
 * THE WINDOW CONTROLS HANDED TO OSIRIS'S KEYS (owner order
 * 2026-11-24 ~16:57 EST): the anchor, the reset, the menu
 * opener, and the anchor's state — registered by the box,
 * driven from Osiris's three-lines menu on his own medallion.
 */
export interface CommandBoxWindowControls {
  toggleAnchored: () => void;
  resetLayout: () => void;
  toggleMenu: () => void;
  anchored: boolean;
}

/**
 * WHOLE LINES AT THE TOP OF THE PHONE STREAM (owner eye-check
 * 2026-11-27 ~21:56 CST, phone fix pass 4): a scroller resting
 * at its bottom almost always slices the topmost visible line
 * in half — a cream sliver of a bubble cut by the thread's top
 * edge in his screenshot. His law is whole messages only. When
 * the stream overflows its cap, this shrinks the thread's own
 * height by the sliced part of the top line, so the visible
 * window holds whole lines only: the top edge lands exactly on
 * a line's top edge, and the newest line stays flush at the
 * bottom, right above the input. A "line" is one child of the
 * flow — an exchange (his line and the reply under it) is one
 * child, so an exchange is never split either. A single line
 * taller than the cap keeps the plain bottom rest; nothing can
 * make it whole but itself. Phone stream only — the desktop
 * thread carries no inline height (the scroll effect clears
 * it on the desktop form).
 */
function snapThreadToWholeLines(thread: HTMLDivElement): void {
  const flow = thread.querySelector<HTMLElement>(".avatar-command-box__thread-flow");
  // Measure at the chain's natural height: a stale inline
  // height from an earlier snap would understate the cap.
  thread.style.height = "";
  if (!flow) {
    thread.scrollTop = thread.scrollHeight;
    return;
  }
  const cap = thread.clientHeight;
  const total = thread.scrollHeight;
  if (total <= cap) {
    thread.scrollTop = total;
    return;
  }
  const threadTop = thread.getBoundingClientRect().top;
  const borderTop = thread.clientTop;
  const resting = thread.scrollTop;
  let start: number | null = null;
  for (const child of Array.from(flow.children)) {
    const childTop =
      (child as HTMLElement).getBoundingClientRect().top - threadTop - borderTop + resting;
    if (total - childTop <= cap) {
      start = childTop;
      break;
    }
  }
  if (start === null) {
    thread.scrollTop = thread.scrollHeight;
    return;
  }
  thread.style.height = `${total - start}px`;
  thread.scrollTop = thread.scrollHeight;
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
  speakerName = "Anubis",
  userLine,
  userSource = "typed",
  history,
  onMinimizeShortcut,
  onMinimizedChange,
  onWindowControls,
  partnerSpeaking,
  away = false,
  onReturnToChat,
  onOpenHistory,
  onAttachFile,
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
   * THE SPEAKER'S NAME (routing law, owner order 2026-11-23): who
   * the Captain is addressing — the live reply is labeled with this
   * name, read from the same addressee state the reply prompt
   * carried, so the label and the words can never disagree. Kept
   * entries carry their own speaker (the addressee at their
   * moment); this prop names the CURRENT one. Defaults to Anubis,
   * the resident commander.
   */
  speakerName?: string;
  /**
   * The operator's own last submitted message (typed or spoken), echoed
   * above the reply — he must always see what he sent (defect 2026-11-21:
   * the box showed only Augie's reply and his messages vanished).
   */
  userLine?: string | undefined;
  /**
   * SPEAKING PROTOCOL (owner order 2026-11-22): how the operator's
   * line arrived decides the speaker of record shown in the log —
   * "typed": his character, the Black Hatter, speaks the line (and
   * the god follows the command); "voice": the operator himself, on
   * the mic — no presence speaks or represents for him.
   */
  userSource?: "typed" | "voice";
  /**
   * The full conversation (the reply-history store), rendered as the
   * chat log itself — flowing lines, Captain / Anubis / System, in
   * order. There is no thread picker or dropdown on the face (owner
   * order 2026-11-22); the log simply IS the window.
   */
  history?: ReplyHistoryEntry[] | undefined;
  /** Lets AvatarStage ("/minimize" etc.) collapse or restore the box. */
  onMinimizeShortcut?: (controls: { minimize: () => void; restore: () => void }) => void;
  /**
   * The box's folded state, reported as it changes (phone fix
   * pass 2026-11-27, item 2): the stage reads it to keep the
   * speech bubble out of the open conversation on the phone —
   * while he reads the thread, no bubble paints over it; the
   * reply stands in the thread, where it belongs.
   */
  onMinimizedChange?: (minimized: boolean) => void;
  /**
   * THE WINDOW'S KEYS, HANDED TO OSIRIS (owner order 2026-11-24
   * ~16:57 EST): the four window keys — anchor, reset, the
   * three-lines menu, minus — are Osiris's, and they live in
   * HIS menu on his own medallion now (OsirisMedallion.tsx), not
   * in this window. The box registers its window machinery here
   * so the stage can wire his keys to it. NO GOD SITS IN THIS
   * WINDOW: there is no presence slot anymore — the Captain's
   * window carries no face.
   */
  onWindowControls?: (controls: CommandBoxWindowControls) => void;
  /** Slash-driven minimization from inside the box's own commands. */
  externalMinimize?: number;
  /**
   * True while Anubis is actually speaking (bridge state SPEAKING):
   * the chat panel carries the speaking glow so the conversation is
   * visibly tied to the medallion at top-center.
   */
  partnerSpeaking?: boolean;
  /**
   * TWO-MODE CHAT (owner order 2026-11-22, his Twitch model): on
   * the chat screen the full box shows; on OTHER screens the chat
   * leaves only a slim bottom strip. While `away`, this component
   * renders the strip instead of the box — incoming messages fade
   * in over the strip, stay readable a few seconds, fade out, and a
   * tap on the strip returns him to the full chat to answer.
   */
  away?: boolean;
  /** The strip's tap: AvatarStage brings the chat screen back. */
  onReturnToChat?: () => void;
  /**
   * TERMINAL LAW (owner order 2026-11-22 ~19:53 EST): the chat's
   * History button opens the record — every conversation with its
   * date and time (the Reply history window AvatarStage holds).
   * The record is the truth; Clear (below) never touches it.
   */
  onOpenHistory?: () => void;
  /**
   * ATTACH FROM THE CHAT BOX (owner order, voice call
   * 2026-11-26 ~13:48 CST): he uploads pictures and files from
   * this box when he needs to — a paperclip in the phone
   * options and on the desktop line, shown only when the stage
   * wires a handler. The stage routes the pick: a picture goes
   * to Picture Analysis, a text file to Knowledge.
   */
  onAttachFile?: (file: File) => void;
}) {
  const [position, setPosition] = useState(loadBoxPosition);
  // Minimized is session-only (the defect fix above). THE BAR IS
  // THE OPENING FORM AT EVERY WIDTH (owner order 2026-11-24
  // ~16:57 EST — superseding the clean-screen round's console of
  // the same morning): the stage opens with the Captain's own
  // chat window folded to its BAR along the bottom — the type
  // field and its companions, no god inside it or heading it.
  // The full window opens when he asks for it: a tap on the bar,
  // a tap on a god's medallion or resting circle, or a god's own
  // menu.
  const [minimized, setMinimized] = useState(true);
  const [enlarged, setEnlarged] = useState(loadBoxEnlarged);
  const [boxSize, setBoxSize] = useState(() =>
    loadBoxEnlarged() ? loadBoxEnlargedSize(loadBoxSize()) : loadBoxSize(),
  );
  const [anchored, setAnchored] = useState(loadBoxAnchored);
  const [viewport, setViewport] = useState(() =>
    typeof window === "undefined"
      ? { w: 0, h: 0 }
      : { w: window.innerWidth, h: window.innerHeight },
  );
  /**
   * THE PHONE BAR (owner phone spec 2026-11-23 ~06:00 CST): at
   * phone widths the chat takes the phone FORM — the one-button
   * line (Part D) — and the rail's tap folds it. The form is
   * what this flag names now.
   *
   * THE DOCK IS UNIVERSAL (owner order 2026-11-25 ~01:39 EST,
   * with his Parrot screenshot — "the chat should be attached
   * to the bottom"): the floating window is retired at EVERY
   * width. The box is a bottom dock — full width, flush on the
   * stage's bottom edge, the window rising from that edge —
   * and CSS owns its geometry entirely (stage-fix-round.css
   * section 35), the way the phone bar's was owned from the
   * start. The drag / stretch machinery is gone, not stood
   * down per width; the anchor/size records remain only as
   * records (Osiris's reset key still clears them; the enlarge
   * toggle still flips its state, which the dock's CSS reads
   * as a taller panel). Nothing the Captain can do — no saved
   * position, no saved size — can float this window again.
   */
  const phoneBar = viewport.w > 0 && viewport.w <= COMMAND_BOX_PHONE_BREAKPOINT;
  const sizeRef = useRef(boxSize);
  sizeRef.current = boxSize;
  const enlargedRef = useRef(enlarged);
  enlargedRef.current = enlarged;
  // Part 28: the tab machinery (Scene / Motion / Tools / Settings /
  // Commands panels) lives behind ONE Menu button. The default face is
  // the chat alone; the menu opens only when he asks for it and is not
  // persisted — every fresh load starts as a plain chat box.
  const [machineryOpen, setMachineryOpen] = useState(false);
  /**
   * TERMINAL LAW (owner order 2026-11-22 ~19:53 EST): "chat works
   * like a terminal — Clear clears the screen." Clear hides every
   * line currently on the screen (the history entries up to now,
   * and the live user/response lines) and NOTHING is deleted: the
   * full record stays in the history store and in the History
   * view, dates and times and all, pull-up-able whenever he wants.
   * Screen state only — a reload brings the log back from the
   * record, like scrolling a terminal's buffer.
   *
   * THE THREAD OPENS CLEAN (owner eye-check 2026-11-23 ~06:51
   * EST, the terminal law carried to its conclusion): his phone
   * greeted him with the saved record sitting in the thread —
   * an old offer TWICE, an old musing — before he had said a
   * word. History lives behind the History button; the visible
   * thread starts EMPTY and carries the live conversation only.
   * So the Clear watermark starts at the record's full length on
   * load: nothing is deleted, the record is intact behind
   * History, and lines spoken from here on appear as they come.
   */
  const [hiddenCount, setHiddenCount] = useState(() => history?.length ?? 0);
  const [liveHidden, setLiveHidden] = useState(false);
  /** The emoji picker's open state (owner order 2026-11-22). */
  const [emojiOpen, setEmojiOpen] = useState(false);
  /**
   * THE PHONE BAR'S ONE BUTTON (owner order 2026-11-24 ~01:46
   * CST): the docked bar carried every control on its line —
   * emoji, mic, send, menu — crowded around a type field too
   * small to tap. His design: the bar's line holds the type
   * field and ONE button; everything else lives behind that
   * button, in the menu it opens. This is that menu's state.
   */
  const [optionsOpen, setOptionsOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLElement>(null);

  const minimizeNow = useCallback(() => {
    setMinimized(true);
  }, []);
  const restoreNow = useCallback(() => {
    setMinimized(false);
  }, []);

  // THE STAGE'S HANDLE ON THE BOX — wired by BOTH rounds that
  // landed 2026-11-24: (a) EVERY GOD HIS OWN CHAT (owner order
  // ~10:40 EST): AvatarStage registers for these controls so
  // tapping a god's medallion can OPEN that god's chat box from
  // outside the box — the medallion click routes the conversation
  // (selectGod) and this restores the box to receive it.
  // (b) THE BUILDER'S FOLD (owner order ~10:20 EST, the sibling
  // pass): building needs the stage clear, so the builder folds
  // the chat out of the way through the same handle — and
  // "/minimize" lands here too. The controls are stable (both
  // callbacks are), so the stage receives them once and holds
  // them in a ref.
  useEffect(() => {
    onMinimizeShortcut?.({ minimize: minimizeNow, restore: restoreNow });
  }, [onMinimizeShortcut, minimizeNow, restoreNow]);

  // The folded state, reported as it changes (phone fix pass
  // 2026-11-27, item 2 — see the prop's note).
  useEffect(() => {
    onMinimizedChange?.(minimized);
  }, [onMinimizedChange, minimized]);

  const toggleMinimized = useCallback(() => {
    setMinimized((current) => !current);
  }, []);

  /**
   * ONE-CLICK RESET (ForeverUI pattern, owner order 2026-11-22):
   * whatever he has dragged or stretched the panel into, one click
   * on the reset key restores the shipped home form — compact
   * size, bottom-left home corner, anchored, expanded — and
   * clears the saved size/position so a reload opens the same.
   * The key itself lives in Osiris's menu now (owner order
   * 2026-11-24 ~16:57 EST); the machinery it drives is unchanged.
   */
  const resetBoxLayout = useCallback(() => {
    clearPersistedBoxLayout();
    setBoxSize({ ...COMMAND_BOX_DEFAULT_SIZE });
    setEnlarged(false);
    setPosition(null);
    setAnchored(true);
    saveBoxAnchored(true);
    setMinimized(false);
    setMachineryOpen(false);
  }, []);

  // CLICK-TO-ENLARGE (owner order 2026-11-22): the rail's dot grip
  // toggles the enlarged state. Leaving a state saves its size
  // under its own record first, so each state reopens at the size
  // he left it — the format never changes, only the scale.
  const toggleEnlarged = useCallback(() => {
    const next = !enlargedRef.current;
    persistBoxSize(sizeRef.current, enlargedRef.current);
    setBoxSize(next ? loadBoxEnlargedSize(loadBoxSize()) : loadBoxSize());
    setEnlarged(next);
    saveBoxEnlarged(next);
  }, []);

  // THE ANCHOR TOGGLE: anchored, the box sits locked at its home
  // corner — the stage's BOTTOM-LEFT (owner order 2026-11-24
  // ~16:57 EST: his window stands along the bottom; the stage's
  // center and Anubis's medallion stay clear). Unanchoring keeps
  // it exactly where it sits and hands him the drag and the
  // stretch; anchoring again returns it home. The toggle itself
  // is Osiris's anchor key now; the state persists
  // (loadBoxAnchored).
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
    const width = boxRef.current?.offsetWidth || boxSize.w;
    // The anchor home: BOTTOM-LEFT (owner order 2026-11-24
    // ~16:57 EST — his window stands along the bottom of the
    // stage), WINDOW_MARGIN clear on every side, run through the
    // window clamp so the ENTIRE box — input row included — sits
    // inside the viewport at any window size, maximized or not,
    // clear of the right-side buttons. Enlarging grows it from
    // this bottom anchor (the effect re-runs on boxSize) and the
    // clamp still holds it on-screen.
    setAnchorPos(
      clampWindowPosition(
        WINDOW_MARGIN,
        viewport.h - height - WINDOW_MARGIN,
        width,
        height,
        viewport.w,
        viewport.h,
      ),
    );
  }, [anchored, boxSize, minimized, viewport]);

  // GEOMETRY HEALING (owner screen check 2026-11-22 — the panel sat
  // too low and the bottom of the chat ran off his screen): a saved
  // position is never trusted blindly. On open, on viewport resize,
  // and whenever the box's size changes (a stretch, the enlarge
  // toggle), an unanchored position is pulled back inside the
  // viewport with the window clamp — the same discipline
  // windowGeometry gave the floating windows — and the healed
  // position is what gets saved.
  useEffect(() => {
    if (anchored || viewport.w === 0 || viewport.h === 0) return;
    setPosition((previous) => {
      if (!previous) return previous;
      const height = minimized
        ? boxRef.current?.offsetHeight || boxSize.h
        : boxSize.h;
      const healed = clampWindowPosition(
        previous.x,
        previous.y,
        boxSize.w,
        height,
        viewport.w,
        viewport.h,
      );
      if (healed.x === previous.x && healed.y === previous.y) return previous;
      saveBoxPosition(healed);
      return healed;
    });
  }, [anchored, viewport, boxSize, minimized]);

  const toggleAnchored = useCallback(() => {
    if (anchored) {
      // Unanchor in place: the anchored spot becomes the free
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

  // OSIRIS'S KEYS, REGISTERED (owner order 2026-11-24 ~16:57
  // EST): his anchor key toggles this window's anchor, his reset
  // key restores its home form, his three-lines key opens the
  // window with its machinery up, and his menu reads the anchor
  // state off this registration. The keys live on HIS medallion;
  // the machinery stays here, where it has always lived.
  const toggleMenuNow = useCallback(() => {
    setMinimized(false);
    setMachineryOpen((open) => !open);
  }, []);
  useEffect(() => {
    onWindowControls?.({
      toggleAnchored,
      resetLayout: resetBoxLayout,
      toggleMenu: toggleMenuNow,
      anchored,
    });
  }, [onWindowControls, toggleAnchored, resetBoxLayout, toggleMenuNow, anchored]);

  const lastEntry = history && history.length > 0 ? history[history.length - 1] : undefined;
  const showLiveUser = !liveHidden && Boolean(userLine) && userLine !== lastEntry?.question;
  // The speaker of record (speaking protocol, owner order
  // 2026-11-22): typed lines are spoken by his character, the Black
  // Hatter; mic lines are the operator himself, in his own voice.
  const speakerLabel = (source: "typed" | "voice" | undefined) =>
    source === "voice" ? "Operator — voice" : "The Black Hatter";
  const liveSpeaker =
    responseSource === "microphone" || responseSource === "awaiting response"
      ? "System"
      : speakerName;
  const showLiveResponse =
    !liveHidden && Boolean(responseLine) && responseLine !== lastEntry?.answer;

  // The visible log: everything after the Clear watermark. The
  // watermark clamps if the record itself was cleared shorter.
  const visibleFrom = Math.min(hiddenCount, history?.length ?? 0);
  const hasVisibleLines = (history?.length ?? 0) > visibleFrom;

  /** Clear the SCREEN (terminal law): hide what is showing; the
   *  record in History is untouched. */
  const clearChatScreen = useCallback(() => {
    setHiddenCount(history?.length ?? 0);
    setLiveHidden(true);
  }, [history]);

  // A fresh line arriving after a Clear is a new screen — the live
  // slot shows again from that line on.
  useEffect(() => {
    setLiveHidden(false);
  }, [responseLine, userLine]);

  /** Insert an emoji at the caret, the way typing it would. */
  const insertEmoji = useCallback(
    (emoji: string) => {
      const input = inputRef.current;
      const start = input?.selectionStart ?? chat.length;
      const end = input?.selectionEnd ?? chat.length;
      onChatChange(chat.slice(0, start) + emoji + chat.slice(end));
      requestAnimationFrame(() => {
        input?.focus();
        const caret = start + emoji.length;
        input?.setSelectionRange(caret, caret);
      });
    },
    [chat, onChatChange],
  );

  // Keep the newest line in view as the conversation flows — and
  // when he comes BACK to chat from a section (Part B: the display
  // follows the tab), the thread stands at its newest line again.
  // PHONE FIX PASS 4 (owner eye-check 2026-11-27 ~21:56 CST): on
  // the phone the chat is an unboxed stream and his law is whole
  // lines only — after the bottom rest, the thread snaps to
  // whole lines (snapThreadToWholeLines, above) so a send moves
  // the stream up with the newest exchange whole, right above
  // the input, and no half-cut line at the top. The snap is the
  // phone form's alone: on the desktop form any inline height it
  // left behind is cleared, and the desktop rest is untouched.
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    if (!phoneBar) thread.style.height = "";
    if (!minimized) thread.scrollTop = thread.scrollHeight;
    if (!phoneBar || minimized || machineryOpen) return;
    const frame = requestAnimationFrame(() => {
      if (threadRef.current === thread) snapThreadToWholeLines(thread);
    });
    return () => cancelAnimationFrame(frame);
  }, [minimized, machineryOpen, history, responseLine, userLine, hiddenCount, phoneBar]);

  /**
   * THE STRIP'S MESSAGE PREVIEWS (owner order 2026-11-22, his
   * Twitch model): while he is on another screen, a NEW incoming
   * line fades in over the bottom strip, holds readable for a few
   * seconds, then fades out — smooth opacity fades only, never a
   * flash or a strobe. The newest line replaces any preview still
   * showing. The line that was already latest when he left the chat
   * screen does not preview; only arrivals while away do. A line
   * moving from the live slot into the history is one message, not
   * two previews.
   */
  const incoming =
    showLiveResponse && responseLine
      ? { key: `live:${responseLine}`, speaker: liveSpeaker, text: responseLine }
      : lastEntry?.answer
        ? {
            key: `hist:${lastEntry.at}`,
            speaker: lastEntry.speaker ?? "Anubis",
            text: lastEntry.answer,
          }
        : null;
  const [stripPreview, setStripPreview] = useState<{
    speaker: string;
    text: string;
    fading: boolean;
  } | null>(null);
  const [missedCount, setMissedCount] = useState(0);
  const stripSeenKey = useRef<string | null>(null);
  const stripLastText = useRef<{ text: string; at: number } | null>(null);
  const stripTimers = useRef<number[]>([]);

  const clearStripTimers = useCallback(() => {
    stripTimers.current.forEach((timer) => window.clearTimeout(timer));
    stripTimers.current = [];
  }, []);

  // Leaving for another screen: the current latest line becomes the
  // baseline — it does not preview. Back on the chat screen: the
  // strip folds away and the missed count resets.
  useEffect(() => {
    if (away) {
      stripSeenKey.current = incoming?.key ?? null;
    } else {
      clearStripTimers();
      setStripPreview(null);
      setMissedCount(0);
      stripSeenKey.current = null;
      stripLastText.current = null;
    }
    // The baseline is the incoming line at the moment of the flip;
    // tracking it live would re-baseline on every arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [away]);

  useEffect(() => {
    if (!away || !incoming) return;
    if (incoming.key === stripSeenKey.current) return;
    const lastText = stripLastText.current;
    if (lastText && lastText.text === incoming.text && Date.now() - lastText.at < 30000) {
      // The live line settling into the history — already shown.
      stripSeenKey.current = incoming.key;
      return;
    }
    stripSeenKey.current = incoming.key;
    stripLastText.current = { text: incoming.text, at: Date.now() };
    setMissedCount((count) => count + 1);
    clearStripTimers();
    setStripPreview({ speaker: incoming.speaker, text: incoming.text, fading: false });
    stripTimers.current.push(
      window.setTimeout(() => {
        setStripPreview((current) => (current ? { ...current, fading: true } : current));
        stripTimers.current.push(
          window.setTimeout(() => setStripPreview(null), STRIP_PREVIEW_FADE_MS),
        );
      }, STRIP_PREVIEW_HOLD_MS),
    );
  }, [away, incoming, clearStripTimers]);

  useEffect(() => clearStripTimers, [clearStripTimers]);

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
    setEmojiOpen(false);
    setOptionsOpen(false);
    onChatChange("");
    // THE CONVERSATION POPS UP ON SEND (owner order, voice call
    // 2026-11-26 ~13:48 CST): he can fold the box to its bar and
    // keep typing there — the bar never forces itself open while
    // he composes — but when he SENDS, the conversation box
    // rises so he can see the exchange. Minimizing again is his
    // one tap, as ever.
    if (minimized) restoreNow();
    onSubmit(text);
  };

  // THE ATTACH INPUT (same order): one hidden picker behind the
  // paperclip on both forms. Picking hands the file to the
  // stage's router and resets the input so the same file can be
  // picked again later.
  const attachInput = onAttachFile ? (
    <input
      ref={attachRef}
      type="file"
      className="sr-only"
      aria-label="Attach a picture or file"
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) onAttachFile(file);
      }}
    />
  ) : null;

  // NO INLINE GEOMETRY (owner order 2026-11-25): the section
  // renders with no style prop at any width, in either state.
  // The dock's geometry — full width, flush on the bottom edge,
  // the risen panel's height — is CSS law (stage-fix-round.css
  // section 35), so no state this component holds can float
  // the window over the medallion again.

  // THE MESSAGE FIELD — one element, shared by both forms below:
  // the desktop row and the phone bar's line carry the same field,
  // the same slash-menu keys, the same submit.
  const messageInput = (
    <>
      <label className="sr-only" htmlFor="avatar-command-input">
        Message for {speakerName}
      </label>
      <input
        id="avatar-command-input"
        ref={inputRef}
        className="avatar-command-box__input"
        placeholder={`Message ${speakerName} — / for commands`}
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
    </>
  );

  // THE EMOJI PICKER (owner order 2026-11-22): a key tap inserts
  // the emoji into the message at the caret — from there it sends
  // and renders like any character he typed. The picker stays up
  // for more picks; the toggle, a send, or minimize folds it away.
  const emojiPicker = emojiOpen ? (
    <div className="avatar-command-box__emoji" role="group" aria-label="Emoji picker">
      {CHAT_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="avatar-command-box__emoji-key"
          onClick={() => insertEmoji(emoji)}
          aria-label={`Insert ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  ) : null;

  /**
   * THE PHONE FORM — ONE BUTTON (owner order 2026-11-24 ~01:46
   * CST, Part D): on the docked bar the type field takes the
   * line — full width, a real tap target at bifocal size — and
   * ONE button stands beside it. Everything that crowded the
   * line (send, microphone, emoji, the menus, the fold) lives in
   * the panel that button opens, each as a labeled row he can
   * hit without aiming. Same form in the folded bar and in the
   * opened box: one bar, one behavior, every tab (Part B).
   */
  const phoneForm = (
    <form className="avatar-command-box__form avatar-command-box__form--phone" onSubmit={submit}>
      {messageInput}
      {attachInput}
      <button
        className="avatar-command-box__options-toggle"
        type="button"
        onClick={() => setOptionsOpen((open) => !open)}
        aria-expanded={optionsOpen}
        aria-label={
          optionsOpen
            ? "Close the message options"
            : "Open the message options — send, microphone, emoji, menus"
        }
        title="Options — send, microphone, emoji, menus"
      >
        <Plus aria-hidden="true" />
      </button>
      {optionsOpen && (
        <div className="avatar-command-box__options" role="menu" aria-label="Message options">
          <button
            className="avatar-command-box__option"
            type="submit"
            disabled={!chat.trim()}
            role="menuitem"
          >
            <Sparkles aria-hidden="true" />
            <span>Send</span>
          </button>
          <button
            className="avatar-command-box__option"
            type="button"
            role="menuitem"
            onClick={onToggleVoice}
            disabled={!voiceAvailable}
          >
            {voiceListening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
            <span>{voiceListening ? "Stop microphone" : "Microphone"}</span>
          </button>
          {onAttachFile && (
            <button
              className="avatar-command-box__option"
              type="button"
              role="menuitem"
              onClick={() => {
                setOptionsOpen(false);
                attachRef.current?.click();
              }}
            >
              <Paperclip aria-hidden="true" />
              <span>Attach a picture or file</span>
            </button>
          )}
          <button
            className="avatar-command-box__option"
            type="button"
            role="menuitem"
            onClick={() => {
              setOptionsOpen(false);
              setEmojiOpen((open) => !open);
            }}
            aria-expanded={emojiOpen}
          >
            <Smile aria-hidden="true" />
            <span>Emoji</span>
          </button>
          <button
            className="avatar-command-box__option"
            type="button"
            role="menuitem"
            onClick={() => {
              setOptionsOpen(false);
              if (minimized) {
                restoreNow();
                setMachineryOpen(true);
              } else {
                setMachineryOpen((open) => !open);
              }
            }}
          >
            <Menu aria-hidden="true" />
            <span>{machineryOpen && !minimized ? "Back to chat" : "Menus — tools & settings"}</span>
          </button>
          <button
            className="avatar-command-box__option"
            type="button"
            role="menuitem"
            onClick={() => {
              setOptionsOpen(false);
              toggleMinimized();
            }}
          >
            {minimized ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            <span>{minimized ? "Open the chat" : "Fold to the bar"}</span>
          </button>
        </div>
      )}
    </form>
  );

  // THE DESKTOP FORM: the field and its three companions in a
  // row — at desktop widths there is room for them, and they stay.
  const standardForm = (
    <form className="avatar-command-box__form" onSubmit={submit}>
      {messageInput}
      {attachInput}
      {onAttachFile && (
        <button
          className="avatar-command-box__icon-button"
          type="button"
          onClick={() => attachRef.current?.click()}
          aria-label="Attach a picture or file"
          title="Attach a picture or file"
        >
          <Paperclip aria-hidden="true" />
        </button>
      )}
      <button
        className="avatar-command-box__icon-button"
        type="button"
        onClick={() => setEmojiOpen((open) => !open)}
        aria-expanded={emojiOpen}
        aria-label={emojiOpen ? "Close the emoji picker" : "Add an emoji"}
        title="Add an emoji"
      >
        <Smile aria-hidden="true" />
      </button>
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
  );

  /**
   * THE FOLDED BAR (owner order 2026-11-24 ~16:57 EST —
   * superseding the clean-screen round's Osiris console of the
   * same morning): folded, the Captain's window is its BAR along
   * the bottom — the type field and its companions, and NO god
   * in it or heading it. On the phone the bar is the one-button
   * line (Part D); on the desktop it is the standard line (field,
   * emoji, mic, send). A tap on the bar's bare ground opens the
   * window. The bar does not travel: the dock holds the window
   * to the stage's bottom edge (owner order 2026-11-25 — the
   * drag is retired with the floating window). The window's
   * four keys are not here: they are Osiris's, in his menu on
   * his medallion.
   */
  const foldedBar = (
    <div
      className="avatar-command-box__bar"
      onClick={(event) => {
        // Clicks on the field or a button keep their own jobs;
        // a tap on the bar's bare ground opens the window.
        if ((event.target as HTMLElement).closest?.("button, input, textarea, select")) return;
        restoreNow();
      }}
    >
      {phoneBar ? phoneForm : standardForm}
      {emojiPicker}
    </div>
  );

  // THE MMORPG CHAT PANEL (owner orders 2026-11-21 Part 28, and
  // 2026-11-22 — the picked Drakensang-style reference): a slim
  // rail down the left edge, a flowing chat log whose lines
  // lead with the speaker's name (Captain / Anubis / System), and
  // one clean input bar at the bottom. NO conversation dropdown,
  // no thread machinery on the face — the log simply flows. All
  // other machinery stays behind the Menu key — Osiris's now, on
  // his own medallion (owner order 2026-11-24 ~16:57 EST). The
  // panel is the dock risen from the stage's bottom edge: it is
  // not dragged, stretched, or parked (owner order 2026-11-25).

  // TWO-MODE CHAT (owner order 2026-11-22): on another screen the
  // box leaves only this slim bottom strip — Osiris's face, the word
  // Chat, and room for a message to fade in over it. A tap anywhere
  // on the strip returns him to the chat screen to answer.
  if (away) {
    return (
      <section
        className="avatar-chat-strip"
        role="button"
        tabIndex={0}
        aria-label="Chat — you are on another screen. Activate to open the chat and answer."
        onClick={() => onReturnToChat?.()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onReturnToChat?.();
          }
        }}
      >
        <span className="avatar-chat-strip__label">Chat</span>
        {stripPreview ? (
          <p
            className={`avatar-chat-strip__preview${stripPreview.fading ? " is-fading" : ""}`}
            role="status"
          >
            <span className="avatar-chat-strip__who">{stripPreview.speaker}:</span>{" "}
            {stripPreview.text}
          </p>
        ) : (
          <span className="avatar-chat-strip__hint">
            {missedCount > 0
              ? `${missedCount} new message${missedCount === 1 ? "" : "s"} — tap to open and answer`
              : "Tap to open the chat and answer"}
          </span>
        )}
        <style>{`--augi-command-accent:${accent}`}</style>
      </section>
    );
  }

  return (
    <section
      ref={boxRef}
      className={`avatar-command-box${minimized ? " avatar-command-box--minimized" : ""}${partnerSpeaking ? " avatar-command-box--partner-speaking" : ""}${anchored ? " avatar-command-box--anchored" : ""}${enlarged ? " avatar-command-box--enlarged" : ""}${phoneBar ? " avatar-command-box--phone-bar" : ""}${machineryOpen && !minimized ? " avatar-command-box--section-open" : ""}`}
      data-anchored={anchored ? "true" : "false"}
      data-enlarged={enlarged ? "true" : "false"}
      aria-label={`Chat with ${speakerName}`}
    >
      {minimized ? (
        // THE BAR (owner order 2026-11-24 ~16:57 EST): folded —
        // on the PC and on the phone alike — the Captain's
        // window is its bar, docked flush on the stage's bottom
        // edge (the dock, owner order 2026-11-25): the type
        // field and its companions, no god inside it. The Osiris
        // console that stood here for a morning is retired by
        // this order; Osiris stands alone on the stage with his
        // own keys.
        foldedBar
      ) : (
      <>
      <div
        className="avatar-command-box__rail avatar-command-box__grip"
        onClick={(event) => {
          // THE BAR TAP (owner phone spec 2026-11-23): tapping the
          // phone bar opens it upward; tapping again folds it back
          // to the bar. The rail's buttons keep their own jobs —
          // only a tap on the bar itself toggles.
          if (!phoneBar) return;
          if ((event.target as HTMLElement).closest?.("button")) return;
          toggleMinimized();
        }}
        role="separator"
        aria-label={phoneBar ? "Chat bar — tap to open or close the chat" : "The chat dock's rail — the dock holds the window to the bottom of the stage"}
        title={phoneBar ? "Tap to open or close the chat" : "The chat dock's rail"}
      >
        <button
          type="button"
          className="avatar-command-box__grip-toggle"
          onClick={toggleEnlarged}
          aria-pressed={enlarged}
          aria-label={enlarged ? "Shrink the chat window to standard size" : "Enlarge the chat window"}
          title={enlarged ? "Back to standard size" : "Enlarge the chat window"}
        >
          <GripVertical aria-hidden="true" />
        </button>
        {/* THE RAIL IS A GRIP, NOTHING MORE (owner order
            2026-11-24 ~16:57 EST): the rail once carried a god's
            face and the window's four keys down its length. The
            face is gone — no god sits in this window — and the
            four keys (anchor, reset, three-lines menu, minus)
            are Osiris's, in his three-lines menu on his own
            medallion. What remains here is the window's own
            furniture: the enlarge toggle (the dock reads the
            state as a taller panel). The machinery opens from
            Osiris's menu key, from the phone line's options, or
            by command. */}
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

      {/* THE DISPLAY FOLLOWS THE TAB (owner order 2026-11-24
          ~01:45 CST, Part B): "if I click off chat I'm going to
          somewhere else — the chat window does not need to stay
          there the whole time. The bottom part for me to type can
          stay there, but the display that's on the screen is the
          tab that's showing." So while a section is open, the
          conversation display is GONE — unmounted, not hidden
          under the panel — and the section owns the box's display
          alone, with the input bar still pinned under it. Closing
          the section brings the chat face back whole: the record
          was never touched, and everything that arrived meanwhile
          (replies by voice and pop-up, reports kept by notify) is
          standing in the thread. */}
      {!minimized && !machineryOpen && (
        <div className="avatar-command-box__conversation" role="group" aria-label="Chat">
          {/* TERMINAL TOOLS (owner order 2026-11-22): Clear wipes
              the SCREEN only — the record is never touched — and
              History opens the full record, dates and times, any
              time he wants to pull it up. */}
          <div className="avatar-command-box__chat-tools">
            <button
              type="button"
              className="avatar-command-box__chat-tool"
              onClick={clearChatScreen}
              aria-label="Clear the chat screen"
              title="Clear — clears the screen only; the record stays in History"
            >
              <Eraser aria-hidden="true" />
              <span>Clear</span>
            </button>
            {onOpenHistory && (
              <button
                type="button"
                className="avatar-command-box__chat-tool"
                onClick={onOpenHistory}
                aria-label="Open the chat history"
                title="History — every conversation, with its date and time"
              >
                <History aria-hidden="true" />
                <span>History</span>
              </button>
            )}
          </div>
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
            {history?.slice(visibleFrom).map((entry, sliceIndex) => {
              const index = visibleFrom + sliceIndex;
              return (
              <div className="avatar-command-box__thread-entry" key={`${entry.at}-${index}`}>
                {entry.question && (
                  <p className="avatar-command-box__thread-q">
                    <span className="avatar-command-box__thread-who">
                      {speakerLabel(entry.source)}:
                    </span>{" "}
                    {entry.question}
                  </p>
                )}
                <p className="avatar-command-box__thread-a">
                  <span className="avatar-command-box__thread-who">
                    {entry.speaker ?? "Anubis"}:
                  </span>{" "}
                  {entry.answer}
                </p>
              </div>
              );
            })}
            {showLiveUser && (
              <p className="avatar-command-box__thread-q avatar-command-box__user-line">
                <span className="avatar-command-box__thread-who">
                  {speakerLabel(userSource)}:
                </span>{" "}
                {userLine}
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
            {showLiveResponse && liveSpeaker === speakerName && responseSource && (
              <p className="avatar-command-box__response-source">Answered by {responseSource}</p>
            )}
            {!hasVisibleLines && !showLiveUser && !showLiveResponse && (
              <p className="avatar-command-box__thread-system">
                <span className="avatar-command-box__thread-who">System:</span> Standing by —
                talk to {speakerName} here.
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

      {!minimized && emojiPicker}

      {phoneBar ? phoneForm : standardForm}
      </div>
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
