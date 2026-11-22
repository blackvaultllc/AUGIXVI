/**
 * DEPARTMENTS (Part 10) — per-department status from the command
 * surface, under the standing truth rule: a department shows REAL
 * data where a real feed exists and reads UNAVAILABLE — with the
 * reason — where none is connected. Nothing here performs busyness.
 *
 * Real today:
 * - Security Operations: the Wi-Fi watcher's live state and how
 *   many watched networks are in the air right now (scan-state).
 * - Main Floor: the office's structure — desks staffed per the
 *   scene definition (structure, labeled as structure, not a live
 *   headcount).
 * Not connected: Finance, Marketing, Social Media — no feed reaches
 * Augie for them yet, and the window says exactly that.
 */
import { useCallback, useEffect, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { buildScene } from "./worldScenes";

type DeptRow = {
  name: string;
  status: string;
  source: string;
};

export function DepartmentsWindow({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<DeptRow[] | null>(null);

  const load = useCallback(async () => {
    let security: DeptRow = {
      name: "Security Operations",
      status: "UNAVAILABLE — the watcher state could not be read",
      source: "/api/devices/scan-state",
    };
    try {
      const res = await fetch("/api/devices/scan-state");
      if (res.ok) {
        const view = (await res.json()) as {
          available?: boolean;
          watcher?: { active?: boolean; watchedSsids?: string[] } | null;
          networks?: unknown[];
        };
        if (view.available) {
          security = {
            name: "Security Operations",
            status: view.watcher?.active
              ? `Watcher ACTIVE — ${view.networks?.length ?? 0} watched network(s) in the air now, ${view.watcher?.watchedSsids?.length ?? 0} on the watch-list. Gate Log holds the knock record.`
              : "Watcher store answers, but no fresh scan — the watcher service may be down.",
            source: "/api/devices/scan-state (the Parrot watcher + Ghost Protocol One)",
          };
        } else {
          security = {
            name: "Security Operations",
            status: "UNAVAILABLE on this surface — the watcher lives on the local build",
            source: "/api/devices/scan-state",
          };
        }
      }
    } catch {
      // The row already carries the honest unavailable wording.
    }

    let staffed = 0;
    try {
      const office = buildScene("office");
      staffed = office?.floors
        ? office.floors.reduce((sum, f) => sum + f.people.length, 0)
        : (office?.people.length ?? 0);
    } catch {
      staffed = 0;
    }

    setRows([
      security,
      {
        name: "Main Floor",
        status: staffed
          ? `Office structure: ${staffed} citizens staffed across the floors (scene definition — structure, not a live headcount).`
          : "Office structure unavailable.",
        source: "worldScenes (the office scene definition)",
      },
      {
        name: "Finance",
        status: "UNAVAILABLE — no finance feed is connected to Augie. The books live in I-E-M's back office.",
        source: "none connected",
      },
      {
        name: "Marketing",
        status: "UNAVAILABLE — no marketing feed is connected to Augie.",
        source: "none connected",
      },
      {
        name: "Social Media",
        status: "UNAVAILABLE — no social feed is connected to Augie. (The accounts exist; no pipe reaches this core yet.)",
        source: "none connected",
      },
    ]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FloatingWindow id="departments" title="Departments" onClose={onClose} initialWidth={480} initialHeight={420}>
      <div className="window-logs">
        {!rows && <p className="window-logs__note">Reading department status…</p>}
        {rows && (
          <ol className="window-logs__list">
            {rows.map((row) => (
              <li key={row.name} className="window-logs__line" style={{ fontFamily: "inherit" }}>
                <strong>{row.name}</strong>
                <br />
                {row.status}
                <br />
                <span style={{ opacity: 0.7 }}>Source: {row.source}</span>
              </li>
            ))}
          </ol>
        )}
        <button type="button" className="window-btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>
    </FloatingWindow>
  );
}
