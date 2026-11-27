/**
 * ASSET TRACERS — the window (phone fix pass, owner order
 * 2026-11-27, Top 100 #71): his tracker tags — truck, vest,
 * gear — on one card: the registry (what each tag rides and
 * where it belongs), the last report each tag sent, the
 * tamper-guard standing (home / moved / no report), and a
 * local plot of his ground drawn from the record alone.
 *
 * No tag hardware is paired with this build yet, and the
 * window says so on its face: until a tag reports, a tracer
 * stands as NO REPORT — never a guessed place. A position he
 * reads off a tag's own app can be entered by hand and is
 * labeled ENTERED, never dressed as a live feed. The model
 * (registry, record, standings, plot) is assetTracers.ts.
 */
import { useMemo, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import {
  loadAssetTracers,
  saveAssetTracers,
  tracerPlotPoints,
  tracerStatuses,
  TRACER_DEFAULT_HOME_RADIUS_M,
  type AssetTracerKind,
  type AssetTracersFile,
} from "./assetTracers";

function parseCoord(text: string): number | null {
  const value = Number(text.trim());
  return Number.isFinite(value) ? value : null;
}

export function AssetTracersWindow({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<AssetTracersFile>(() => loadAssetTracers());
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<AssetTracerKind>("gear");
  const [homeLat, setHomeLat] = useState("");
  const [homeLng, setHomeLng] = useState("");
  const [reportText, setReportText] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const statuses = useMemo(() => tracerStatuses(file, Date.now()), [file]);
  const plot = useMemo(() => tracerPlotPoints(file), [file]);

  const persist = (next: AssetTracersFile) => {
    saveAssetTracers(next);
    setFile(next);
  };

  const addTracer = () => {
    const name = label.trim();
    if (!name) return;
    const lat = parseCoord(homeLat);
    const lng = parseCoord(homeLng);
    const home = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
    persist({
      ...file,
      tracers: [
        ...file.tracers,
        {
          id: `tracer-${Date.now().toString(36)}`,
          label: name,
          kind,
          home,
          homeRadiusM: TRACER_DEFAULT_HOME_RADIUS_M,
        },
      ],
    });
    setLabel("");
    setHomeLat("");
    setHomeLng("");
    setNote(
      home
        ? `${name} is registered, with its home ground set. When its tag reports, its standing reads here.`
        : `${name} is registered with no home ground yet — reports will show a place, but no moved judgment can be made until home is set.`,
    );
  };

  const enterReport = (tracerId: string) => {
    const parts = (reportText[tracerId] ?? "").split(/[,\s]+/).filter(Boolean);
    const lat = parts.length === 2 ? parseCoord(parts[0]!) : null;
    const lng = parts.length === 2 ? parseCoord(parts[1]!) : null;
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setNote("A report is two numbers — latitude, longitude — the way the tag's own app shows them.");
      return;
    }
    persist({
      ...file,
      reports: [...file.reports, { tracerId, at: Date.now(), lat, lng, source: "entered" }],
    });
    setReportText((prev) => ({ ...prev, [tracerId]: "" }));
    setNote("Entered and labeled as entered — the record never dresses a hand entry as a live feed.");
  };

  const removeTracer = (tracerId: string) => {
    persist({
      tracers: file.tracers.filter((t) => t.id !== tracerId),
      reports: file.reports.filter((r) => r.tracerId !== tracerId),
    });
  };

  return (
    <FloatingWindow id="asset-tracers" title="Asset Tracers — truck, vest, gear" onClose={onClose} initialWidth={500} initialHeight={560} fitContentHeight>
      <div className="asset-tracers">
        <p className="asset-tracers__meta">
          Tracker tags ride the truck, the vest, and the gear, and report where they are.{" "}
          <strong>No tag is paired with this build yet</strong> — until one reports, its tracer
          stands as NO REPORT and no place is guessed. A position read off a tag's own app can be
          entered by hand below; it is labeled ENTERED, never a live feed.
        </p>

        {plot && (
          <svg className="asset-tracers__plot" viewBox="0 0 100 100" role="img" aria-label="Local plot of tracer homes and last reports">
            {plot.map((point) => (
              <g key={point.id}>
                <circle
                  cx={point.x * 100}
                  cy={point.y * 100}
                  r={point.kind === "home" ? 2.6 : 2}
                  fill={point.kind === "home" ? "#ffd94d" : "#ff8f3f"}
                  stroke="#050403"
                  strokeWidth={0.6}
                />
              </g>
            ))}
          </svg>
        )}

        {statuses.length === 0 && (
          <p className="asset-tracers__meta">No tracers registered yet. Register the first tag below.</p>
        )}
        {statuses.map((status) => (
          <div
            key={status.tracer.id}
            className={`asset-tracers__item${status.standing === "moved" ? " asset-tracers__item--moved" : ""}`}
          >
            <strong>{status.tracer.label}</strong> · {status.tracer.kind}
            <div className="asset-tracers__meta">
              {status.standing === "no-report" &&
                "NO REPORT — this tag has not reported. No place is claimed for it."}
              {status.standing === "home" &&
                `HOME — last report is on its home ground (${status.distanceFromHomeM} m from home).`}
              {status.standing === "moved" &&
                `MOVED — last report stands ${status.distanceFromHomeM} m from home, outside its ${status.tracer.homeRadiusM} m home ground.`}
              {status.standing === "away-no-home" &&
                "A place is on record, but no home ground is set — no moved judgment is made."}
              {status.lastReport &&
                ` Last report ${new Date(status.lastReport.at).toLocaleString()} · ${status.lastReport.lat.toFixed(5)}, ${status.lastReport.lng.toFixed(5)} · ${status.lastReport.source === "tag" ? "sent by the tag" : "entered by hand"}${status.stale ? " · STALE (over a day old)" : ""}.`}
            </div>
            <div className="asset-tracers__form" style={{ marginTop: "0.45rem" }}>
              <input
                aria-label={`Report position for ${status.tracer.label} — latitude, longitude`}
                placeholder="Tag's position — latitude, longitude"
                value={reportText[status.tracer.id] ?? ""}
                onChange={(event) => setReportText((prev) => ({ ...prev, [status.tracer.id]: event.target.value }))}
              />
              <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                <button type="button" className="window-btn" onClick={() => enterReport(status.tracer.id)}>
                  Enter this report
                </button>
                <button type="button" className="window-btn" onClick={() => removeTracer(status.tracer.id)}>
                  Remove tracer
                </button>
              </div>
            </div>
          </div>
        ))}

        <form
          className="asset-tracers__form"
          onSubmit={(event) => {
            event.preventDefault();
            addTracer();
          }}
        >
          <strong>Register a tag</strong>
          <input
            aria-label="Tag name"
            placeholder="Tag name — Truck tag, Vest tag…"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
          />
          <select aria-label="What the tag rides" value={kind} onChange={(event) => setKind(event.target.value as AssetTracerKind)}>
            <option value="truck">Truck</option>
            <option value="vest">Vest</option>
            <option value="gear">Gear</option>
          </select>
          <input
            aria-label="Home latitude (optional)"
            placeholder="Home latitude (optional — where it belongs)"
            value={homeLat}
            onChange={(event) => setHomeLat(event.target.value)}
            inputMode="decimal"
          />
          <input
            aria-label="Home longitude (optional)"
            placeholder="Home longitude (optional)"
            value={homeLng}
            onChange={(event) => setHomeLng(event.target.value)}
            inputMode="decimal"
          />
          <button type="submit" className="window-btn" disabled={!label.trim()}>
            Register the tag
          </button>
        </form>

        {note && (
          <p className="window-hint" role="status">
            {note}
          </p>
        )}
      </div>
    </FloatingWindow>
  );
}
