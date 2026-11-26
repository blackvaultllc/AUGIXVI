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
import {
  AGENT_SEATS,
  GOD_DEPARTMENTS,
  departmentHead,
  godDisplayName,
} from "./departmentHeads";

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
        {/* DEPARTMENT HEADS (Captain's orders 2026-11-26): the
            structure that joins his agents to the gods. Every
            agent has a god, and the god represents the agent's
            function. Osiris oversees ALL departments. Anubis
            and Montu are the Captain's own, 110%, and are never
            assigned. Seats stay empty until he names a head —
            the structure below is read straight from
            departmentHeads.ts, the one record. */}
        <h3 style={{ marginTop: "1.25rem" }}>Departments under the gods — the heads</h3>
        <p className="window-logs__note">
          Oversight of every department sits with <strong>Osiris</strong> — and Osiris is
          Khadija's construct: he always protects One, no matter what. Anubis and Montu are the
          Captain's own, 110% — they head no department and stand with no agent.
        </p>
        <ol className="window-logs__list">
          {GOD_DEPARTMENTS.map((dept) => {
            const head = departmentHead(dept.id);
            return (
              <li key={dept.id} className="window-logs__line" style={{ fontFamily: "inherit" }}>
                <strong>{dept.label}</strong> — under {godDisplayName(dept.god)}
                <br />
                {dept.blurb}
                <br />
                <span style={{ opacity: 0.7 }}>
                  Head:{" "}
                  {head
                    ? `${head.agentName} (${head.designation})`
                    : "no head seated — the seat stays empty until the Captain names one"}
                  {" · "}Oversight: Osiris
                </span>
              </li>
            );
          })}
          <li className="window-logs__line" style={{ fontFamily: "inherit" }}>
            <strong>The sixteen seats</strong>
            <br />
            {AGENT_SEATS.filter((s) => s.agentName).length} of 16 seats are filled — Zero (the
            Captain), One (Khadija), and 011 (Violet Hernandez). Every agent will have a god, and
            the god represents what the agent does in the company; the empty seats wait on his
            word, names and gods alike.
          </li>
        </ol>
      </div>
    </FloatingWindow>
  );
}
