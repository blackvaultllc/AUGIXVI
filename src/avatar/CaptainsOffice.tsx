/**
 * CAPTAIN ZERO'S OFFICE (owner order 2026-11-27 ~22:28 CST):
 * "Make Captain Zero's office — it's my own office to be
 * left alone, work in focus, but if emergency any of the
 * gods can come in there and ask if they can speak with me
 * if it's important."
 *
 * A stage screen, like the HEXO cube view: his Matrix Wall
 * stands as the ground, and the room itself is plain — a
 * plate, the law in one line, and quiet. Nothing in here
 * reaches for him. His work is one reach away, never a
 * lockout: "Talk to Anubis" steps out and opens Anubis's
 * chat, and the Leave pill at the top-left returns him to
 * the stage.
 *
 * THE QUIET, real in the build: while this screen stands,
 * the stage does not render the god pop-ups at all (the
 * privacy gate in AvatarStage), and reports land in the
 * record silently, as they always collect. The ONE thing
 * that pierces the quiet is derived from real standing
 * records only (captainsOffice.ts, off alertRing.ts):
 *
 * - THE KNOCK — a god at the door, named, marked EMERGENCY,
 *   with the real reason in plain words. He admits him
 *   (the Office closes and the god's own chat opens — the
 *   standing way he speaks with a god) or dismisses him
 *   ("Not now" — the knock goes quiet for that standing
 *   alert; a grown count knocks again).
 * - KHADIJA'S LINE — not a knock and never gated like one:
 *   while her call rings in the Daddy Inbox, the Office
 *   carries the line plainly, with the way to her call
 *   (the Logs window, where her Answer button stands).
 */
import { ArrowLeft } from "lucide-react";
import { MatrixWall } from "./MatrixWall";
import type { OfficeKnock } from "./captainsOffice";

export function CaptainsOfficeView({
  knocks,
  daddyRinging,
  onAdmit,
  onDismiss,
  onTalkToAnubis,
  onGoToCall,
  onClose,
}: {
  /** The gods at the door right now (already dismissal-filtered by the stage). */
  knocks: OfficeKnock[];
  /** Khadija's call is ringing in the Daddy Inbox right now. */
  daddyRinging: boolean;
  /** Admit a god: his own chat opens, addressed to him. */
  onAdmit: (knock: OfficeKnock) => void;
  /** Dismiss a knock — "not now", for the standing alert it answers to. */
  onDismiss: (knock: OfficeKnock) => void;
  /** Step out and open the chat, addressed to Anubis. */
  onTalkToAnubis: () => void;
  /** Step out to the Logs window, where her call's Answer button stands. */
  onGoToCall: () => void;
  /** Leave the Office, back to the stage. */
  onClose: () => void;
}) {
  const quiet = knocks.length === 0 && !daddyRinging;
  return (
    <div
      className="captains-office"
      role="dialog"
      aria-label="Captain Zero's Office — your private office"
    >
      <MatrixWall role="owner" />
      <button
        type="button"
        className="captains-office__leave"
        onClick={onClose}
        aria-label="Leave the Office — back to the stage"
      >
        <ArrowLeft aria-hidden="true" size={15} />
        <span>Leave the Office</span>
      </button>
      <div className="captains-office__content">
        <p className="captains-office__plate">Captain Zero&rsquo;s Office</p>
        <p className="captains-office__law">
          Your office, Zero. In here you are left alone — no god stands, no
          report calls out. Only an emergency knocks, and a knock only asks.
        </p>

        {daddyRinging && (
          <div className="captains-office__call" role="alert">
            <p className="captains-office__call-line">Khadija is calling.</p>
            <p className="captains-office__call-note">
              Her line does not knock — it reaches you. Her Answer button
              stands in the Logs window.
            </p>
            <button
              type="button"
              className="captains-office__btn captains-office__btn--gold"
              onClick={onGoToCall}
            >
              Go to her call
            </button>
          </div>
        )}

        {knocks.map((knock) => (
          <div
            key={knock.signature}
            className="captains-office__knock"
            role="alertdialog"
            aria-label={`${knock.godName} is at the door — emergency`}
          >
            <p className="captains-office__knock-line">
              {knock.godName} is at the door.
            </p>
            <p className="captains-office__knock-mark">
              Emergency — he asks to speak with you.
            </p>
            <p className="captains-office__knock-reason">{knock.reason}</p>
            <div className="captains-office__knock-row">
              <button
                type="button"
                className="captains-office__btn captains-office__btn--gold"
                onClick={() => onAdmit(knock)}
              >
                Let {knock.godName} in
              </button>
              <button
                type="button"
                className="captains-office__btn"
                onClick={() => onDismiss(knock)}
              >
                Not now
              </button>
            </div>
          </div>
        ))}

        {quiet && <p className="captains-office__quiet">No one is knocking. The room is yours.</p>}

        <button
          type="button"
          className="captains-office__btn"
          onClick={onTalkToAnubis}
        >
          Talk to Anubis
        </button>
      </div>
    </div>
  );
}
