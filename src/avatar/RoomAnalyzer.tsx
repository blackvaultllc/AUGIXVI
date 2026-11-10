import { X, Radar } from "lucide-react";

/**
 * ROOM ANALYZER — the deck's analyze pop-up, pulled into AUGIXVI's back
 * (owner order 2026-11-10). A floating HoloBox-style panel that shows the
 * live scene description while Osiris analyzes what he sees. Front-end
 * presentation only; the analysis itself runs through the existing vision
 * path (describeCameraFrame) with the deck's honesty rules.
 */
export function RoomAnalyzer({
  open,
  description,
  onClose,
}: {
  open: boolean;
  description: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <section className="room-analyzer" aria-label="Room analyzer" role="dialog">
      <header className="room-analyzer__head">
        <span className="room-analyzer__title">
          <Radar aria-hidden="true" /> ROOM ANALYZER
        </span>
        <button
          className="room-analyzer__close"
          type="button"
          onClick={onClose}
          aria-label="Close room analyzer"
        >
          <X aria-hidden="true" />
        </button>
      </header>
      <p className="room-analyzer__note">
        Scene description only — objects, layout, movement. No recording, no person identification,
        ever.
      </p>
      <div className="room-analyzer__body" aria-live="polite">
        {description ? <p>{description}</p> : <p className="room-analyzer__waiting">Analyzing…</p>}
      </div>
    </section>
  );
}
