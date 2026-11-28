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
 * - THE KNOCK, AS A NOTIFICATION (owner refinement
 *   2026-11-27 ~23:07 CST): "a message can come through
 *   from the notifications that one of them would like to
 *   speak to me. And if I click on the notification, I can
 *   let them in my office. And when they're done, they
 *   just go back to what they're doing." A standing knock
 *   is written into the record through notify() under the
 *   god's own name (the stage's half), and in the room it
 *   stands as the notification card: the god's name, the
 *   ask, the emergency mark, the real reason. Clicking
 *   "Let him in" admits the god INTO THE OFFICE — the room
 *   does not close; the conversation (the chat, addressed
 *   to that god) stands open inside the room, and the room
 *   carries his panel: he is here, and the way to send him
 *   back. Ending it sends the god back to his work; the
 *   Captain stays in his Office. "Not now" dismisses the
 *   knock for the standing alert it answers to; a grown
 *   count knocks again.
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
  guest,
  daddyRinging,
  onAdmit,
  onDismiss,
  onGuestLeave,
  onTalkToAnubis,
  onGoToCall,
  onClose,
}: {
  /** The gods at the door right now (already dismissal-filtered by the stage). */
  knocks: OfficeKnock[];
  /** The god standing IN the Office right now, if one was let in. */
  guest: OfficeKnock | null;
  /** Khadija's call is ringing in the Daddy Inbox right now. */
  daddyRinging: boolean;
  /** Admit a god INTO the Office: the room stays; his conversation opens inside it. */
  onAdmit: (knock: OfficeKnock) => void;
  /** Dismiss a knock — "not now", for the standing alert it answers to. */
  onDismiss: (knock: OfficeKnock) => void;
  /** End the guest's visit: he goes back to his work; the Captain stays. */
  onGuestLeave: () => void;
  /** Step out and open the chat, addressed to Anubis. */
  onTalkToAnubis: () => void;
  /** Step out to the Logs window, where her call's Answer button stands. */
  onGoToCall: () => void;
  /** Leave the Office, back to the stage. */
  onClose: () => void;
}) {
  const quiet = !guest && knocks.length === 0 && !daddyRinging;
  return (
    <div
      className={`captains-office${guest ? " captains-office--guest" : ""}`}
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

        {guest && (
          <div
            className="captains-office__guest"
            role="status"
            aria-label={`${guest.godName} is in your office`}
          >
            <p className="captains-office__guest-line">
              {guest.godName} is in your office.
            </p>
            <p className="captains-office__guest-note">
              He came about: {guest.reason} Speak with him in the chat — it
              stands open here in your office. When you are done, send him
              back and the room is yours again.
            </p>
            <button
              type="button"
              className="captains-office__btn captains-office__btn--gold"
              onClick={onGuestLeave}
            >
              End — send {guest.godName} back
            </button>
            {knocks.some((knock) => knock.signature !== guest.signature) && (
              <p className="captains-office__guest-waiting">
                Another knock waits at the door — it stands when the room is
                free.
              </p>
            )}
          </div>
        )}

        {!guest &&
          knocks.map((knock) => (
            <div
              key={knock.signature}
              className="captains-office__knock"
              role="alertdialog"
              aria-label={`Notification — ${knock.godName} would like to speak with you — emergency`}
            >
              <p className="captains-office__knock-line">
                {knock.godName} would like to speak with you.
              </p>
              <p className="captains-office__knock-mark">
                Emergency — he asks to come in.
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

        {!guest && (
          <button
            type="button"
            className="captains-office__btn"
            onClick={onTalkToAnubis}
          >
            Talk to Anubis
          </button>
        )}
      </div>
    </div>
  );
}
