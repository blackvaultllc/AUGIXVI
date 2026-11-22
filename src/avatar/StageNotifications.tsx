import { X } from "lucide-react";

/**
 * REPORTS AS NOTIFICATIONS (owner order 2026-11-22): when a
 * construct or god finishes something the Captain set in motion,
 * the completion surfaces HERE — a notification on the stage — not
 * buried as a line in the thread. The stack is presentation only:
 * what may surface at all is decided by his standing notification
 * rules (notificationPrefs.ts) at the point the report is raised.
 */
export interface StageNotification {
  id: number;
  /** The report's topic key — the unit his filters name. */
  topic: string;
  /** The report line itself (already closed with the blessing). */
  text: string;
  at: number;
  /**
   * The god this report is attributed to, when it is one god's
   * report (presence doctrine): a non-resident god pops onto the
   * stage with his report and leaves when its life ends.
   */
  god?: "anubis" | "montu";
}

export function StageNotifications({
  items,
  onDismiss,
}: {
  items: StageNotification[];
  onDismiss: (id: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="stage-notifications" aria-live="polite" aria-label="Reports">
      {items.map((item) => (
        <div className="stage-notifications__item" key={item.id} role="status">
          <span className="stage-notifications__topic">{item.topic}</span>
          {item.god && (
            <span className="stage-notifications__god">
              {item.god === "montu" ? "Montu" : "Anubis"}
            </span>
          )}
          <p className="stage-notifications__text">{item.text}</p>
          <button
            type="button"
            className="stage-notifications__dismiss"
            onClick={() => onDismiss(item.id)}
            aria-label="Dismiss this report"
            title="Dismiss"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
