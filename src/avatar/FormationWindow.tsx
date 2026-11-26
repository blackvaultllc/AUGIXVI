/**
 * THE FORMATION WINDOW (cybernetic pass, 2026-11-26 — the
 * survey's Voltron row): the board where every surface of the
 * one core stands or says why it can't. It lives in a cabinet
 * (Tools → Connections — APIs & data), never on the stage.
 *
 * Every row is probed WHEN THE BOARD OPENS and again on the
 * Captain's Refresh — the board holds no carried-over state and
 * calls it live (formation.ts judges the probes; this window
 * runs them):
 *   · the Parrot core, through the core link's own probe;
 *   · this surface, through the serving server's build stamp
 *     (the update view — the same stamp the Logs window reads);
 *   · the newest build, through the same update check, for the
 *     parity line;
 *   · the Osiris node, by a plain knock on its own address;
 *   · the online copy and the phone copy, which no probe from
 *     here can honestly read — their rows say NO LIVE READING.
 *
 * Under the rows, the LIVE-SENSES CENSUS: what the core's
 * senses have on record, counted at the moment of asking.
 */
import { useCallback, useEffect, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import {
  ONLINE_HOST,
  formationRows,
  parityLine,
  sensesCensusLine,
  type FormationProbe,
  type SensesCensus,
} from "./formation";
import type { CoreStatus } from "./coreLink";
import { getCoreLink } from "./coreLinkClient";
import { getUpdateView } from "./logs.server";
import { operatorAccessToken } from "./learner/daddyInboxClient";
import { loadRegistry } from "./devices/deviceRegistry";
import { currentSoundFeed, unacknowledgedSoundAlerts } from "./soundWatchFeed";

const OSIRIS_NODE_URL = "http://10.42.0.1:8081/";

export function FormationWindow({ onClose }: { onClose: () => void }) {
  const [probe, setProbe] = useState<FormationProbe | null>(null);
  const [census, setCensus] = useState<SensesCensus | null>(null);
  const [probing, setProbing] = useState(false);

  const runProbes = useCallback(async () => {
    setProbing(true);
    const thisHost = typeof window !== "undefined" ? window.location.host : "";
    const base: FormationProbe = {
      coreStatus: "probing",
      thisHost,
      onlineHost: thisHost === ONLINE_HOST || thisHost.endsWith(`.${ONLINE_HOST}`),
      servingStamp: null,
      latestStamp: null,
      osiris: "probing",
      probedAt: Date.now(),
    };
    setProbe(base);

    const coreStatus: CoreStatus | "probing" = await getCoreLink()
      .probe()
      .catch((): CoreStatus => "not-configured");
    setProbe((p) => (p ? { ...p, coreStatus } : p));

    const token = await operatorAccessToken().catch(() => null);
    if (token) {
      const view = await getUpdateView({ data: { accessToken: token } }).catch(() => null);
      if (view && view.authorized) {
        setProbe((p) =>
          p ? { ...p, servingStamp: view.current, latestStamp: view.latest } : p,
        );
      }
    }

    let osiris: FormationProbe["osiris"] = "unreached";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      await fetch(OSIRIS_NODE_URL, { signal: controller.signal, mode: "no-cors" });
      clearTimeout(timer);
      osiris = "answered";
    } catch {
      osiris = "unreached";
    }
    setProbe((p) => (p ? { ...p, osiris, probedAt: Date.now() } : p));

    /* The census — counted from this surface's records, with
     * the watcher's standing read from its scan record. */
    let watcher: SensesCensus["watcher"] = "unknown";
    try {
      const res = await fetch("/api/devices/scan-state");
      if (res.ok) {
        const view = (await res.json()) as { available?: boolean };
        watcher = view.available === true ? "available" : "unavailable";
      }
    } catch {
      watcher = "unknown";
    }
    const feed = currentSoundFeed();
    const registry = loadRegistry();
    setCensus({
      soundClassified: feed.length,
      soundAlertsWaiting: unacknowledgedSoundAlerts(feed).length,
      devicesRegistered: registry.length,
      devicesPresent: registry.filter((d) => d.presence === "active").length,
      watcher,
    });
    setProbing(false);
  }, []);

  useEffect(() => {
    void runProbes();
  }, [runProbes]);

  const rows = probe ? formationRows(probe) : [];

  return (
    <FloatingWindow
      id="formation"
      title="The Formation — every surface of the one core"
      onClose={onClose}
      initialWidth={520}
      initialHeight={560}
    >
      <div className="window-formation">
        <p className="window-logs__note">
          One core, one memory, one command — every surface is the same Augie reaching through.
          This board probes each surface as it stands now; a surface no probe can read says NO
          LIVE READING instead of borrowing a state.
        </p>
        {rows.map((row) => (
          <section key={row.id} className="window-formation__card" aria-label={row.name}>
            <h3>
              {row.name} — {row.stateWord}
            </h3>
            <p className="window-logs__note">{row.detail}</p>
          </section>
        ))}
        {probe && <p className="window-formation__headline">{parityLine(probe)}</p>}
        {census && (
          <section className="window-formation__card" aria-label="Live-senses census">
            <h3>Live senses</h3>
            <p className="window-logs__note">{sensesCensusLine(census)}</p>
          </section>
        )}
        <p className="window-logs__note">
          {probe
            ? `Probed at ${new Date(probe.probedAt).toLocaleTimeString()}. `
            : "Probing… "}
          <button
            type="button"
            className="window-btn"
            disabled={probing}
            onClick={() => void runProbes()}
          >
            {probing ? "Probing…" : "Probe again"}
          </button>
        </p>
      </div>
    </FloatingWindow>
  );
}
