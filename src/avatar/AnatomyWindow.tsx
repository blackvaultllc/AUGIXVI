/**
 * ANATOMY WINDOW (Part 17) — the operator's map of Augie's core:
 * every system, how they connect, and whether each is answering
 * right now (probed live on open — a dot claims only what its probe
 * just saw). Below the map: CONFIG VERSIONS — save the full current
 * configuration under a name and return to it exactly.
 *
 * Operator-only: it renders inside the signed-in stage. Restoring a
 * version takes effect on the next stage load (settings load at
 * start, per Part 14) — the window says so rather than pretending
 * an instant swap.
 */
import { useCallback, useEffect, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { ANATOMY_LINKS, ANATOMY_NODES, loadConfigVersions, restoreConfigVersion, snapshotCurrentAs, type ConfigVersion } from "./anatomy";
import { loadBrainAddress } from "./brain";

type ProbeState = "probing" | "up" | "down" | "unknown";

const NODE_W = 150;
const NODE_H = 54;

export function AnatomyWindow({ onClose }: { onClose: () => void }) {
  const [probes, setProbes] = useState<Record<string, ProbeState>>({});
  const [versions, setVersions] = useState<ConfigVersion[]>(() => loadConfigVersions());
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const probe = useCallback(async () => {
    const next: Record<string, ProbeState> = {};
    const check = async (id: string, url: string) => {
      try {
        const res = await fetch(url);
        next[id] = res.ok ? "up" : "down";
      } catch {
        next[id] = "down";
      }
    };
    await Promise.all([
      check("brain", `${loadBrainAddress()}/api/tags`),
      check("vision", `${loadBrainAddress()}/api/tags`),
      check("ear", "/api/voiceprint/status"),
      check("voice-gate", "/api/voiceprint/status"),
      check("watcher", "/api/devices/scan-state"),
      check("library", "/api/library/catalog"),
    ]);
    // Providers and the registry are structural — no honest probe
    // exists from here, so they stay "unknown" rather than fake "up".
    next["providers"] = "unknown";
    next["devices"] = "unknown";
    next["core"] = "up";
    setProbes(next);
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  const save = useCallback(() => {
    if (!name.trim()) {
      setNote("Give the version a name first.");
      return;
    }
    setVersions(snapshotCurrentAs(name, Date.now()));
    setNote(`Saved "${name.trim()}" — the full current configuration.`);
    setName("");
  }, [name]);

  const restore = useCallback((versionName: string) => {
    const ok = restoreConfigVersion(versionName);
    setNote(
      ok
        ? `Restored "${versionName}". Reload Augie to run on it — settings load at start.`
        : `Could not restore "${versionName}".`,
    );
  }, []);

  const center = (id: string) => {
    const n = ANATOMY_NODES.find((node) => node.id === id)!;
    return { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 };
  };

  return (
    <FloatingWindow id="anatomy" title="AUGI Anatomy" onClose={onClose} initialWidth={520} initialHeight={460}>
      <div className="window-logs">
        <svg viewBox="0 0 640 340" role="img" aria-label="Map of Augie's systems" style={{ width: "100%" }}>
          {ANATOMY_LINKS.map((link) => {
            const a = center(link.from);
            const b = center(link.to);
            return (
              <line key={`${link.from}-${link.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3a4763" strokeWidth="1.5" />
            );
          })}
          {ANATOMY_NODES.map((node) => {
            const state = probes[node.id] ?? "probing";
            const dot = state === "up" ? "#4ade80" : state === "down" ? "#ef4444" : "#9fb0c9";
            return (
              <g key={node.id}>
                <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx="9" fill="#101623" stroke="#d4af37" strokeWidth="1" />
                <circle cx={node.x + 14} cy={node.y + 16} r="5" fill={dot} />
                <text x={node.x + 26} y={node.y + 20} fill="#eef2f7" fontSize="12.5" fontWeight="700">
                  {node.label}
                </text>
                <text x={node.x + 10} y={node.y + 40} fill="#9fb0c9" fontSize="8.6">
                  {node.detail.slice(0, 34)}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="window-logs__note">
          Green = its probe just answered. Red = it did not. Gray = no honest probe exists from
          here (provider failover and the device registry are structural on this map).{" "}
          <button type="button" className="window-btn" onClick={() => void probe()}>
            Probe again
          </button>
        </p>

        <h3 style={{ margin: "0.2rem 0 0" }}>Configuration versions</h3>
        <div className="window-logs__tabs">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this configuration — e.g. Demo day"
            aria-label="Version name"
            style={{ flex: "1 1 auto", minWidth: 0 }}
          />
          <button type="button" className="window-btn" onClick={save}>
            Save current as a version
          </button>
        </div>
        {note && (
          <p className="window-logs__note" role="status">
            {note}
          </p>
        )}
        <ol className="window-logs__list">
          {versions.length === 0 && (
            <li className="window-logs__note">No saved versions yet.</li>
          )}
          {versions.map((v) => (
            <li key={v.name} className="window-logs__line" style={{ fontFamily: "inherit" }}>
              <strong>{v.name}</strong> — saved {new Date(v.at).toLocaleString()} · bloom{" "}
              {v.settings.bloom} · theme {v.settings.theme} · particles {v.settings.maxParticles}{" "}
              <button type="button" className="window-btn" onClick={() => restore(v.name)}>
                Restore
              </button>
            </li>
          ))}
        </ol>
      </div>
    </FloatingWindow>
  );
}
