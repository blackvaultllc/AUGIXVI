/**
 * SIGNAL MAP (Part 31) — what the core's scanners see, and nothing else.
 *
 * The browser never scans: this window reads the merged scan-state
 * (the Parrot's Wi-Fi watcher + Ghost Protocol One phone reports) and
 * the device registry, and lays them out as a map — registered devices
 * up or down with signal, last-seen and the scanner that reported
 * them; a registered signal freshly UP is marked as the activation
 * event; networks nobody registered sit in their own section, labeled
 * unknown. When the watcher is silent the window says the scanner is
 * not reporting — it never claims the air is empty.
 */
import { useCallback, useEffect, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { loadRegistry } from "./devices/deviceRegistry";
import type { ScanStateView } from "./devices/wifiWatch";
import { buildSignalMap, relativeSeen, type SignalMapModel } from "./signalMap";

type Loaded = { model: SignalMapModel; at: number };

export function SignalMapWindow({ onClose }: { onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/devices/scan-state");
      if (!res.ok) throw new Error(`scan-state ${res.status}`);
      const view = (await res.json()) as ScanStateView & { available?: boolean };
      const model = buildSignalMap(
        { available: view.available === true, view, devices: loadRegistry() },
        Date.now(),
      );
      setLoaded({ model, at: Date.now() });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const model = loaded?.model;

  return (
    <FloatingWindow id="signal-map" title="Signal Map" onClose={onClose} initialWidth={480} initialHeight={440}>
      <div className="window-logs">
        <p className="window-logs__note">
          This window never scans. It shows what the core's scanners report — the Parrot watcher
          and Ghost Protocol One on the phone. Signal values are the watcher's estimate, not a
          measure of distance.
        </p>
        {failed && (
          <p className="window-logs__note">
            The scan-state could not be read — no claim is made about the air.
          </p>
        )}
        {model && model.scannerState === "unavailable" && (
          <p>
            <strong>Scanner UNAVAILABLE</strong> — no watcher store answers on this server (the
            watcher lives on the local core build).
          </p>
        )}
        {model && model.scannerState === "silent" && (
          <p>
            <strong>Scanner not reporting</strong> — the store answers, but no fresh scan has
            arrived. That is not proof the air is empty.
          </p>
        )}
        {model && model.scannerState !== "unavailable" && (
          <>
            <ol className="window-logs__list">
              {model.registered.map((row) => (
                <li key={row.deviceId} className="window-logs__line" style={{ fontFamily: "inherit" }}>
                  <strong>{row.name}</strong>{" "}
                  {row.signalUp ? (
                    <span aria-label="signal up">— ⚡ SIGNAL UP</span>
                  ) : (
                    <span>— {row.up ? "UP" : "down"}</span>
                  )}
                  <br />
                  <span style={{ opacity: 0.85 }}>
                    {row.ssid ?? "no SSID on its card"}
                    {row.rssi !== null ? ` · ≈ ${row.rssi} dBm` : ""}
                    {` · last seen ${relativeSeen(row.lastSeenAt, loaded!.at)}`}
                    {row.sources.length ? ` · via ${row.sources.join(" + ")}` : ""}
                    {row.beaconRole ? " · beacon — its signal is a summons" : ""}
                  </span>
                </li>
              ))}
              {model.registered.length === 0 && (
                <li className="window-logs__line" style={{ fontFamily: "inherit" }}>
                  No registered devices — the registry is empty on this surface.
                </li>
              )}
            </ol>
            <p className="window-logs__note">
              Not registered ({model.unknown.length}) — seen by a scanner, matched to no device
              card:
            </p>
            <ol className="window-logs__list">
              {model.unknown.map((net) => (
                <li key={net.ssid} className="window-logs__line" style={{ fontFamily: "inherit" }}>
                  <strong>{net.ssid}</strong>
                  <br />
                  <span style={{ opacity: 0.85 }}>
                    {net.rssi !== null ? `≈ ${net.rssi} dBm · ` : ""}
                    last seen {relativeSeen(net.lastSeenAt, loaded!.at)} · via{" "}
                    {net.sources.join(" + ")}
                  </span>
                </li>
              ))}
              {model.unknown.length === 0 && (
                <li className="window-logs__line" style={{ fontFamily: "inherit" }}>
                  None in the current reports.
                </li>
              )}
            </ol>
          </>
        )}
      </div>
    </FloatingWindow>
  );
}
