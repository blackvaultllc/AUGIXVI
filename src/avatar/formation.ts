/**
 * THE FORMATION (cybernetic pass, 2026-11-26 — the survey's
 * Voltron row): one board where every surface of the ONE core
 * stands or says why it can't. The one-core law says every
 * surface is the same Augie reaching through; the parity law
 * says a fix on only one copy is not done. This board is where
 * both laws become visible: each surface is PROBED at open and
 * on Refresh — nothing here is a carried-over state dressed as
 * live.
 *
 * THE BOARD'S TRUTH RULES (the dossier's):
 *   · A surface that answers is REACHED, with its build stamp
 *     when a stamp can honestly be read.
 *   · A surface no probe can read from here says NO LIVE
 *     READING — the board never borrows a state from memory
 *     and calls it current.
 *   · A stamp mismatch is stated in plain words: which copy is
 *     behind, and by what stamp.
 *   · The Go Drive is deliberately NOT a row — it is not a
 *     network surface; its truth is the Seal Check.
 *
 * Pure derivations over probe results — the window runs the
 * probes; this module judges them. Unit-testable by the repo's
 * rules.
 */
import type { CoreStatus } from "./coreLink";

export type FormationRowState = "reached" | "unreached" | "no-live-reading" | "probing";

export interface FormationRow {
  id: string;
  name: string;
  state: FormationRowState;
  stateWord: string;
  detail: string;
  stamp?: string | undefined;
}

export interface FormationProbe {
  /** The core link's probe result for the Parrot core. */
  coreStatus: CoreStatus | "probing";
  /** This surface's own host (window.location.host). */
  thisHost: string;
  /** True when this surface IS the online copy. */
  onlineHost: boolean;
  /** The serving server's own build stamp (the update view's
   *  `current`), or null when it could not be read. */
  servingStamp: string | null;
  /** The repo's newest build stamp (the update view's
   *  `latest`), or null when the check could not run. */
  latestStamp: string | null;
  /** The Osiris node probe: something answered at its address. */
  osiris: "answered" | "unreached" | "probing";
  /** When this board's probes ran. */
  probedAt: number;
}

/** The online copy's public host — the one named in the record. */
export const ONLINE_HOST = "augixvi.space";

/** A stamp's short form, the way the record quotes builds. */
export function shortStamp(stamp: string): string {
  return stamp.slice(0, 7);
}

const CORE_STATUS_WORD: Record<CoreStatus, string> = {
  connected: "CORE CONNECTED",
  queued: "QUEUED",
  "not-configured": "NOT CONFIGURED",
};

export function formationRows(probe: FormationProbe): FormationRow[] {
  const rows: FormationRow[] = [];

  /* The Parrot core — probed through the core link itself. */
  if (probe.coreStatus === "probing") {
    rows.push({
      id: "parrot-core",
      name: "The Parrot core",
      state: "probing",
      stateWord: "PROBING",
      detail: "The core link is knocking now.",
    });
  } else if (probe.coreStatus === "connected") {
    rows.push({
      id: "parrot-core",
      name: "The Parrot core",
      state: "reached",
      stateWord: "REACHED",
      detail:
        "The core answered this surface's probe just now — the one core, one memory, one command, live at the other end of the link.",
    });
  } else {
    rows.push({
      id: "parrot-core",
      name: "The Parrot core",
      state: "unreached",
      stateWord: CORE_STATUS_WORD[probe.coreStatus],
      detail:
        probe.coreStatus === "queued"
          ? "The core did not answer, and work is queued for it — the link will carry it when the core is back. Nothing is claimed live that is not."
          : "The core link is not configured on this surface, so the core cannot be probed from here — NO LIVE READING for the core itself.",
    });
  }

  /* This surface — its serving server stamps itself. */
  rows.push({
    id: "this-surface",
    name: "This surface",
    state: probe.servingStamp ? "reached" : "no-live-reading",
    stateWord: probe.servingStamp ? `Build ${shortStamp(probe.servingStamp)}` : "NO LIVE READING",
    stamp: probe.servingStamp ?? undefined,
    detail: probe.servingStamp
      ? `You are looking at the copy served by ${probe.thisHost}, and the server that served it stamps its build ${shortStamp(probe.servingStamp)}.`
      : `The server that served this copy ( ${probe.thisHost} ) gave no build stamp to read — this surface's build is NO LIVE READING from here.`,
  });

  /* The online copy — only this surface can speak for it when
   * this surface IS it; otherwise no honest probe exists. */
  if (probe.onlineHost) {
    rows.push({
      id: "online-copy",
      name: "The online copy",
      state: probe.servingStamp ? "reached" : "no-live-reading",
      stateWord: probe.servingStamp ? `Build ${shortStamp(probe.servingStamp)}` : "NO LIVE READING",
      stamp: probe.servingStamp ?? undefined,
      detail: "This surface IS the online copy — its row above is its own reading.",
    });
  } else {
    rows.push({
      id: "online-copy",
      name: "The online copy",
      state: "no-live-reading",
      stateWord: "NO LIVE READING",
      detail:
        `No probe from this surface can read the build the online copy (${ONLINE_HOST}) is serving right now. ` +
        "The board does not guess it — open the online copy and read its own Formation board there.",
    });
  }

  /* The Osiris node — a plain knock on its own address. */
  if (probe.osiris === "probing") {
    rows.push({
      id: "osiris-node",
      name: "The Osiris node",
      state: "probing",
      stateWord: "PROBING",
      detail: "Knocking on the node's own address (10.42.0.1) now.",
    });
  } else if (probe.osiris === "answered") {
    rows.push({
      id: "osiris-node",
      name: "The Osiris node",
      state: "reached",
      stateWord: "REACHED",
      detail:
        "Something answered at the node's own address, 10.42.0.1 — the node is up on its own air.",
    });
  } else {
    rows.push({
      id: "osiris-node",
      name: "The Osiris node",
      state: "unreached",
      stateWord: "UNREACHED",
      detail:
        "The knock on 10.42.0.1 went unanswered from this surface. The node may be off, out of reach of this surface's network, or this browser may refuse the knock — the board reports the knock, not a verdict on the node.",
    });
  }

  /* The phone copy — no surface can read another surface's link
   * state; the honest row says so. */
  rows.push({
    id: "phone-copy",
    name: "The phone copy",
    state: "no-live-reading",
    stateWord: "NO LIVE READING",
    detail:
      "The phone copy is another surface of the same core, and no surface can read another's link state from here. Its own Formation board, opened on the phone, carries its reading.",
  });

  return rows;
}

/**
 * THE PARITY LINE: this surface's build against the newest
 * build, in plain words — the parity law ("a fix on only one
 * copy is not done") as one sentence.
 */
export function parityLine(probe: FormationProbe): string {
  if (!probe.servingStamp) {
    return "Parity: this surface's build could not be read, so parity cannot be judged from here — NO LIVE READING.";
  }
  if (!probe.latestStamp) {
    return `Parity: this surface carries build ${shortStamp(probe.servingStamp)}; the newest build could not be checked from here, so whether it is current is NO LIVE READING.`;
  }
  if (
    probe.servingStamp.startsWith(probe.latestStamp) ||
    probe.latestStamp.startsWith(probe.servingStamp)
  ) {
    return `Parity: this surface carries the newest build (${shortStamp(probe.latestStamp)}). The copies this board can read are in step.`;
  }
  return `Parity: this surface (${shortStamp(probe.servingStamp)}) is BEHIND the newest build (${shortStamp(probe.latestStamp)}). A fix that lives on only one copy is not done — this copy is owed the update.`;
}

/* --------------------- the live-senses census ------------------------ */

export interface SensesCensus {
  /** Classifications on the Sound Watch feed. */
  soundClassified: number;
  /** Alert sounds still unacknowledged. */
  soundAlertsWaiting: number;
  /** Cards on the device registry. */
  devicesRegistered: number;
  /** Registered devices whose presence stands active. */
  devicesPresent: number;
  /** The signal watcher's standing, from its scan record. */
  watcher: "available" | "unavailable" | "unknown";
}

/**
 * THE LIVE-SENSES CENSUS (the survey's Astro Boy row, folded
 * onto this board): what the one core's senses have actually
 * recorded, counted from the records at the moment of asking —
 * each count traceable to its source, none of it telemetry.
 */
export function sensesCensusLine(census: SensesCensus): string {
  const parts = [
    census.soundClassified === 0
      ? "Sound Watch has classified nothing on its record"
      : `Sound Watch has classified ${census.soundClassified} sound${census.soundClassified === 1 ? "" : "s"}` +
        (census.soundAlertsWaiting > 0
          ? `, ${census.soundAlertsWaiting} alert${census.soundAlertsWaiting === 1 ? "" : "s"} waiting for acknowledgment`
          : ", no alerts waiting"),
    `${census.devicesRegistered} device${census.devicesRegistered === 1 ? "" : "s"} on the registry, ${census.devicesPresent} present`,
    census.watcher === "available"
      ? "the signal watcher is reporting"
      : census.watcher === "unavailable"
        ? "the signal watcher is UNAVAILABLE on this surface"
        : "the signal watcher's standing is not yet read",
  ];
  return parts.join(" · ") + ".";
}
