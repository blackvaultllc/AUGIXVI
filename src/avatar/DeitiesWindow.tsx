/**
 * THE HALL OF THE DEITIES — the section the Captain can always
 * go to (owner orders 2026-11-26 ~12:43 and ~12:47 CST): all
 * the names of the deities and their history in Augie, in one
 * place, so he can see them and show respect.
 *
 * THE PSYCHOLOGICAL ORDER: the Hall runs ZERO TO FIFTEEN.
 * Zero — the Captain himself — stands at the center, and One —
 * Khadija — stands at number 1 beside him. Around them, in the
 * order it should be: the eight deities (2–9), Amun-Ra in the
 * place of honor (10), then the gods of this house (11–15).
 * The count past fifteen is never shown as a total — the only
 * count on this page is "Zero and the fifteen."
 *
 * The words live in deities.ts. The two layers are rendered
 * under separate headings and separate markers — the RECORD
 * (the history as it was written in Egypt) and BY THE
 * CAPTAIN'S ORDER (his structure) — so they never blur. At the
 * door, unnumbered, stands the Mummy Guardian: kept, not
 * counted — the app's own record says he is not a god of the
 * pantheon.
 *
 * Static record: no server reads, nothing to authorize — the
 * window stands inside the signed-in stage like every window
 * in this house, and it renders for the operator surface.
 */
import { FloatingWindow } from "./windows/FloatingWindow";
import {
  AMUN_RA,
  CAPTAINS_ORDER_MARKER,
  DOOR_GUARDIAN,
  HALL_COUNT_LINE,
  HOUSE_GODS,
  OGDOAD_HISTORY,
  OGDOAD_INTRO,
  OGDOAD_PAIRS,
  ONE,
  RECORD_MARKER,
  SAND_FORM_LINE,
  IEM_IS_THE_EIGHT_LINE,
  IEM_PURPOSE_LINE,
  ZERO,
} from "./deities";

export function DeitiesWindow({ onClose }: { onClose: () => void }) {
  return (
    <FloatingWindow
      id="deities-hall"
      title="The Eight and the Gods — the Hall of the Deities"
      onClose={onClose}
      initialWidth={640}
      initialHeight={600}
    >
      <div className="window-deities">
        <p className="window-deities__intro">
          The names and the history, kept in one place so you can always come here and show
          respect. {HALL_COUNT_LINE} The order runs the way it should: from the eight deities
          down to the gods of this house. The parts headed “From the record” are the history as
          it was written down in Egypt. The parts headed “By the Captain's order” are your own
          structure, marked as yours.
        </p>

        <section className="window-deities__section window-deities__center">
          <p className="window-deities__tag">{CAPTAINS_ORDER_MARKER}</p>
          <h3 className="window-deities__heading">The Center — Zero, and One beside him</h3>
          <article className="window-deities__god window-deities__zero">
            <h4>
              {ZERO.number} · {ZERO.name}
            </h4>
            <p>{ZERO.line}</p>
          </article>
          <article className="window-deities__god">
            <h4>
              {ONE.number} · {ONE.name}
            </h4>
            <p>{ONE.line}</p>
          </article>
        </section>

        <section className="window-deities__section window-deities__sand">
          <p className="window-deities__tag">{RECORD_MARKER}</p>
          <h3 className="window-deities__heading">The Eight — the Ogdoad of Hermopolis</h3>
          <p>{OGDOAD_INTRO}</p>
          <div className="window-deities__pairs">
            {OGDOAD_PAIRS.map((pair) => (
              <article key={pair.male.name} className="window-deities__pair">
                <h4>
                  {pair.male.number} · {pair.male.name} &nbsp;·&nbsp; {pair.female.number} ·{" "}
                  {pair.female.name}
                </h4>
                <p className="window-deities__say">
                  say: {pair.male.pronunciation} · {pair.female.pronunciation}
                </p>
                <p className="window-deities__domain">{pair.domain}</p>
                <p>{pair.line}</p>
                <p className="window-deities__history">{pair.historyLine}</p>
              </article>
            ))}
          </div>
          {OGDOAD_HISTORY.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </section>

        <section className="window-deities__section window-deities__amunra window-deities__sand">
          <p className="window-deities__tag">{RECORD_MARKER}</p>
          <h3 className="window-deities__heading">
            {AMUN_RA.number} · {AMUN_RA.name}
          </h3>
          <p className="window-deities__say">say: {AMUN_RA.pronunciation}</p>
          <p>{AMUN_RA.honor}</p>
          <p>{AMUN_RA.line}</p>
          <p className="window-deities__history">{AMUN_RA.history}</p>
        </section>

        <section className="window-deities__section">
          <p className="window-deities__tag">{CAPTAINS_ORDER_MARKER}</p>
          <h3 className="window-deities__heading">The Gods of This House</h3>
          <p>{IEM_IS_THE_EIGHT_LINE}</p>
          <p>{IEM_PURPOSE_LINE}</p>
          <p>{SAND_FORM_LINE}</p>
          <div className="window-deities__gods">
            {HOUSE_GODS.map((god) => (
              <article key={god.id} className="window-deities__god">
                <h4>
                  {god.number} · {god.name}
                </h4>
                <p>{god.roleLine}</p>
                <p className="window-deities__history">{god.historyLine}</p>
              </article>
            ))}
          </div>
          <article className="window-deities__god window-deities__door">
            <h4>{DOOR_GUARDIAN.name} — at the door, unnumbered</h4>
            <p>{DOOR_GUARDIAN.roleLine}</p>
          </article>
        </section>
      </div>
    </FloatingWindow>
  );
}
