/**
 * OSIRIS STANDS ALONE (owner order 2026-11-24 ~16:57 EST — the
 * Captain's refinement over his screenshot of the deployed
 * build).
 *
 * Osiris's medallion sits BARE on the stage at the top-left —
 * no blue box, no panel, no border, no chat attached — animated
 * with his own clips as before, "chilling with his animations."
 * His medallion look itself was good; only the keys and their
 * placement were wrong. The chat window is the Captain's own
 * window now (it stands along the bottom, no god inside it), so
 * Osiris's four window keys — anchor, reset, three-lines menu,
 * minus: the same four functions they have always had — live
 * HERE, inside his selection menu:
 *
 * - A THREE-LINES button stands on his medallion. Tapping it
 *   pops his menu open: the four keys in one HORIZONTAL row of
 *   round icons, and a MESSAGE option beside them.
 * - The MESSAGE option opens a SMALL MESSAGE SCREEN directly
 *   under Osiris: the Captain types there and the line goes to
 *   Osiris directly — his own direct-message path, separate
 *   from the main chat window (the reply is spoken and stands
 *   in the record like every reply).
 * - Tapping his FACE turns the conversation to Osiris and
 *   opens the chat window addressed to him (every god his own
 *   chat — the clean-screen law, kept): he is reached in the
 *   main window by addressing him there, or by /Osiris.
 *
 * The menu folds away on an outside press or Escape — a tool
 * he opens, never furniture (the MedallionMenu discipline).
 */
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Anchor, Menu, MessageSquare, Minus, RotateCcw, Send } from "lucide-react";
import { AugiePresence } from "./AugiePresence";
import type { AvatarState } from "./AvatarBridge";

export function OsirisMedallion({
  ready,
  avatarState,
  voiceListening,
  acting,
  speaking,
  anchored,
  onToggleAnchor,
  onResetWindow,
  onOpenMenu,
  onMinimizeWindow,
  onSelectFace,
  onDirectMessage,
}: {
  /** His living face's signals — the same the panel face read. */
  ready: boolean;
  avatarState: AvatarState;
  voiceListening: boolean;
  acting: boolean;
  /** Osiris is the one speaking — the glow rides his face. */
  speaking: boolean;
  /** The chat window's anchor state, for his anchor key. */
  anchored: boolean;
  /** His anchor key: anchor / unanchor the chat window. */
  onToggleAnchor: () => void;
  /** His reset key: the chat window back to its home form. */
  onResetWindow: () => void;
  /** His three-lines key: open the chat window with its menu. */
  onOpenMenu: () => void;
  /** His minus key: fold the chat window to its bar. */
  onMinimizeWindow: () => void;
  /** His face tapped: the conversation turns to Osiris and his
   *  chat window opens, addressed to him. */
  onSelectFace: () => void;
  /** A line sent from his own message screen under him. */
  onDirectMessage: (text: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // His menu folds away on an outside press or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const sendDirect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onDirectMessage(text);
  };

  return (
    <div
      className={`osiris-medallion${speaking ? " osiris-medallion--speaking" : ""}`}
      ref={rootRef}
    >
      <div
        className="osiris-medallion__face"
        role="button"
        tabIndex={0}
        aria-label="Talk to Osiris — turn the chat to him"
        title="Osiris — tap to turn the chat to him"
        onClick={onSelectFace}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectFace();
          }
        }}
      >
        <AugiePresence
          ready={ready}
          avatarState={avatarState}
          voiceListening={voiceListening}
          acting={acting}
          captioned={false}
        />
      </div>
      <button
        type="button"
        className="osiris-medallion__menu-button"
        aria-label="Open Osiris's menu"
        aria-expanded={menuOpen}
        title="Osiris's menu — his keys and his message screen"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Menu aria-hidden="true" />
      </button>
      {menuOpen && (
        <div className="osiris-medallion__menu" role="menu" aria-label="Osiris's keys">
          <button
            type="button"
            className="osiris-medallion__key"
            role="menuitem"
            aria-label={anchored ? "Unanchor the chat window" : "Anchor the chat window"}
            aria-pressed={anchored}
            title={
              anchored
                ? "The chat window is anchored at its home — tap to unanchor it"
                : "Anchor the chat window at its home corner"
            }
            onClick={() => {
              setMenuOpen(false);
              onToggleAnchor();
            }}
          >
            <Anchor aria-hidden="true" />
          </button>
          <button
            type="button"
            className="osiris-medallion__key"
            role="menuitem"
            aria-label="Reset the chat window to its home form"
            title="Reset — the chat window back to its home form"
            onClick={() => {
              setMenuOpen(false);
              onResetWindow();
            }}
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <button
            type="button"
            className="osiris-medallion__key"
            role="menuitem"
            aria-label="Open the chat window's menu"
            title="Menu — the chat window's tools and settings"
            onClick={() => {
              setMenuOpen(false);
              onOpenMenu();
            }}
          >
            <Menu aria-hidden="true" />
          </button>
          <button
            type="button"
            className="osiris-medallion__key"
            role="menuitem"
            aria-label="Minimize the chat window"
            title="Minimize — fold the chat window to its bar"
            onClick={() => {
              setMenuOpen(false);
              onMinimizeWindow();
            }}
          >
            <Minus aria-hidden="true" />
          </button>
          <button
            type="button"
            className="osiris-medallion__key osiris-medallion__key--message"
            role="menuitem"
            aria-label="Message Osiris directly"
            aria-expanded={dmOpen}
            title="Message Osiris directly — a small screen opens under him"
            onClick={() => {
              setMenuOpen(false);
              setDmOpen((open) => !open);
            }}
          >
            <MessageSquare aria-hidden="true" />
          </button>
        </div>
      )}
      {dmOpen && (
        <form
          className="osiris-medallion__dm"
          onSubmit={sendDirect}
          aria-label="Message Osiris directly"
        >
          <label className="sr-only" htmlFor="osiris-dm-input">
            Message for Osiris
          </label>
          <input
            id="osiris-dm-input"
            className="osiris-medallion__dm-input"
            placeholder="Message Osiris directly"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="off"
          />
          <button
            type="submit"
            className="osiris-medallion__dm-send"
            disabled={!draft.trim()}
            aria-label="Send the message to Osiris"
            title="Send to Osiris"
          >
            <Send aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  );
}
