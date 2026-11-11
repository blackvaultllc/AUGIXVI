/**
 * CLOUD KEYS PANEL — operator-only, in the back area (behind operator sign-in).
 * Green light = key present and working; red = missing / failed. KEY VALUES
 * ARE NEVER SHOWN — names and lights only, like Command's cloud-keys panel.
 */
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { fetchCloudKeyLights, type CloudKeyLight } from "./cloudBrain";
import { FloatingWindow } from "./windows/FloatingWindow";

export function CloudKeysPanel({ onClose }: { onClose: () => void }) {
  const [lights, setLights] = useState<CloudKeyLight[]>([]);
  const [busy, setBusy] = useState(true);

  const refresh = () => {
    setBusy(true);
    void fetchCloudKeyLights().then((next) => {
      setLights(next);
      setBusy(false);
    });
  };

  useEffect(refresh, []);

  return (
    <FloatingWindow
      id="cloud-keys"
      title="Cloud Keys — operator only"
      onClose={onClose}
      initialWidth={420}
    >
      <div className="window-cloud-keys">
        <p className="window-hint">
          Values live in Cloudflare Worker secrets — never shown here, never in code.
        </p>
        <ul className="window-cloud-keys__list">
          {lights.map((entry) => (
            <li key={entry.provider}>
              <span
                className={`window-cloud-keys__light window-cloud-keys__light--${entry.light}`}
                role="img"
                aria-label={entry.light === "green" ? "working" : "missing or failed"}
              />
              <span className="window-cloud-keys__provider">{entry.provider}</span>
              <span className="window-cloud-keys__detail">{entry.detail}</span>
            </li>
          ))}
          {lights.length === 0 && !busy && (
            <li className="window-hint">Status unavailable — try refresh.</li>
          )}
        </ul>
        <button type="button" className="window-btn" onClick={refresh} disabled={busy}>
          <RefreshCw aria-hidden="true" /> {busy ? "Checking…" : "Refresh lights"}
        </button>
      </div>
    </FloatingWindow>
  );
}
