/**
 * THE BLACK HATTER AT CENTER (owner order 2026-11-22).
 *
 * The default presence of the stage is DOMENICK HIMSELF — the Black
 * Hatter. His medallion stands in the middle of the screen: the face
 * he speaks with in the system, and the face every station
 * recognizes as the boss, the owner (BLACK_HATTER_BINDING —
 * medallionPortraits.ts; the binding is permanent, picture↔name).
 *
 * LIVING FACE (owner order 2026-11-22, superseding the still-
 * portrait treatment): the Black Hatter TALKS — his eyes blink on
 * a natural cadence and his mouth moves while he is speaking. Per
 * the Captain's protocol, this medallion speaks the Captain's
 * TYPED words (AvatarStage drives `speaking` for the length of the
 * line); when the Captain uses the mic, that is the Captain
 * himself and this face stays silent. The medallion also carries
 * the perspective: full and bright while the stage's focus is his
 * (the default), stepped back — a shade smaller, a shade dimmer —
 * while a station he opened holds the focus. Tapping the medallion
 * returns the perspective to him.
 */
import { BLACK_HATTER_BINDING } from "./medallionPortraits";
import { BLACK_HATTER_FEATURES, LivingPortrait } from "./LivingPortrait";

export const BLACK_HATTER_FACE_SRC = BLACK_HATTER_BINDING.portrait;

export function BlackHatterPresence({
  inPerspective,
  speaking = false,
  onSelect,
}: {
  /** True while the stage's focus is the owner's (the default). */
  inPerspective: boolean;
  /** The Hatter is speaking the Captain's typed words right now. */
  speaking?: boolean;
  /** Tapping the medallion returns the perspective to the owner. */
  onSelect?: () => void;
}) {
  const classes = [
    "black-hatter-presence",
    inPerspective ? "black-hatter-presence--in-perspective" : "black-hatter-presence--stepped-back",
    speaking ? "black-hatter-presence--speaking" : "",
    onSelect ? "black-hatter-presence--selectable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const label = `${BLACK_HATTER_BINDING.name} — ${BLACK_HATTER_BINDING.roleLabel}${speaking ? " — speaking" : ""}`;
  return (
    <div
      className={classes}
      role={onSelect ? "button" : "img"}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={label}
      title={
        onSelect
          ? `${label} — tap to return the stage to the Black Hatter`
          : label
      }
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      <div className="black-hatter-presence__face">
        <LivingPortrait
          src={BLACK_HATTER_FACE_SRC}
          features={BLACK_HATTER_FEATURES}
          speaking={speaking}
          imgClassName="black-hatter-presence__img"
        />
      </div>
      <div className="black-hatter-presence__plate">
        <span className="black-hatter-presence__name">{BLACK_HATTER_BINDING.name}</span>
        <span className="black-hatter-presence__role">{BLACK_HATTER_BINDING.roleLabel}</span>
      </div>
    </div>
  );
}
