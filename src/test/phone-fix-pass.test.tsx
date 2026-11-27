import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MATRIX_PLANES,
  MATRIX_ROLE_TUNING,
  MATRIX_WALL_MAX_COLUMNS,
  MATRIX_WALL_STEP_MS,
  matrixCellGlyph,
  matrixPlaneColumns,
  newMatrixDrop,
  stepMatrixDrops,
} from "@/avatar/matrixWall";
import { MatrixWall } from "@/avatar/MatrixWall";
import {
  distanceMeters,
  loadAssetTracers,
  sanitizeAssetTracersFile,
  tracerPlotPoints,
  tracerStatuses,
  type AssetTracersFile,
} from "@/avatar/assetTracers";
import { detectiveFlagsForCamera } from "@/avatar/cameras/detectiveFlags";
import type { SectorEvent } from "@/avatar/cameras/sectorWatch";
import { AgentContactButtons } from "@/avatar/AgentContactButtons";

/**
 * THE PHONE FIX PASS (owner orders 2026-11-27, items 1–14):
 * the pins this round stands on — the wall's alphabet and
 * budget, the ring's rest gold (pinned in circuit-ring-round),
 * the medallion's phone measure (pinned in stage-lockdown),
 * the tracers' honest standings, the Detective View's flags
 * read from the record alone, and the agents' three buttons
 * wired to the host's doors.
 */

describe("the Matrix Wall model — 0s and 1s only, capped, working speed", () => {
  it("is a boxed room: back, floor, ceiling, left, right", () => {
    expect(MATRIX_PLANES.map((p) => p.id)).toEqual(["back", "floor", "ceiling", "left", "right"]);
  });

  it("speaks only the real alphabet — every glyph a 0 or a 1", () => {
    const rng = () => 0.42;
    const drop = newMatrixDrop(20, 9, rng);
    expect(drop.glyphs).toMatch(/^[01]+$/);
    expect(drop.glyphs).toHaveLength(9);
    const stepped = stepMatrixDrops([drop], 20, 9, rng);
    expect(stepped[0]!.glyphs).toMatch(/^[01]+$/);
  });

  it("caps the room's columns at the performance budget, per plane and role", () => {
    for (const plane of MATRIX_PLANES) {
      expect(matrixPlaneColumns(plane.id, 4000, "owner")).toBeLessThanOrEqual(
        Math.floor(MATRIX_WALL_MAX_COLUMNS * plane.columnShare) + 1,
      );
    }
    // The learner's tuning is sparser and slower — calm for her seat.
    expect(matrixPlaneColumns("back", 4000, "learner")).toBeLessThan(
      matrixPlaneColumns("back", 4000, "owner"),
    );
    expect(MATRIX_ROLE_TUNING.learner.speed).toBeLessThan(MATRIX_ROLE_TUNING.owner.speed);
    // The working speed is the calibrated step — not the sleep copy's third.
    expect(MATRIX_WALL_STEP_MS).toBe(66);
  });

  it("steps drops down and recycles them off the plane's foot", () => {
    const rng = () => 0.99;
    const drop = { head: 4, glyphs: "101", speed: 1 };
    const [moved] = stepMatrixDrops([drop], 10, 3, rng);
    expect(moved!.head).toBe(5);
    const [gone] = stepMatrixDrops([{ head: 30, glyphs: "101", speed: 1 }], 10, 3, rng);
    expect(gone!.head).toBeLessThan(0); // a fresh drop, entering above
    expect(matrixCellGlyph({ head: 3, glyphs: "10", speed: 1 }, 3)).toEqual({ glyph: "1", head: true });
    expect(matrixCellGlyph({ head: 3, glyphs: "10", speed: 1 }, 9)).toBeNull();
  });

  it("renders five canvases — one per face of the room", () => {
    const { container } = render(<MatrixWall role="owner" />);
    expect(container.querySelectorAll("canvas")).toHaveLength(5);
    for (const plane of MATRIX_PLANES) {
      expect(container.querySelector(`.matrix-wall__plane--${plane.id}`)).not.toBeNull();
    }
  });
});

describe("asset tracers — the record, and nothing invented", () => {
  const file: AssetTracersFile = {
    tracers: [
      { id: "t1", label: "Truck tag", kind: "truck", home: { lat: 30.7, lng: -88.1 }, homeRadiusM: 75 },
      { id: "t2", label: "Vest tag", kind: "vest", home: null, homeRadiusM: 75 },
    ],
    reports: [{ tracerId: "t1", at: 1_000, lat: 30.7, lng: -88.1, source: "tag" }],
  };

  it("sanitizes a corrupt record to an empty one", () => {
    expect(sanitizeAssetTracersFile(null)).toEqual({ tracers: [], reports: [] });
    expect(sanitizeAssetTracersFile({ tracers: [{ id: 4 }], reports: "junk" })).toEqual({
      tracers: [],
      reports: [],
    });
    expect(loadAssetTracers({ getItem: () => "{broken" })).toEqual({ tracers: [], reports: [] });
  });

  it("reads standings from the record alone: home, moved, no-report", () => {
    const now = 2_000;
    const [truck, vest] = tracerStatuses(file, now);
    expect(truck!.standing).toBe("home");
    expect(truck!.distanceFromHomeM).toBe(0);
    expect(vest!.standing).toBe("no-report");
    expect(vest!.lastReport).toBeNull();

    const movedFile: AssetTracersFile = {
      ...file,
      reports: [{ tracerId: "t1", at: 1_500, lat: 30.71, lng: -88.1, source: "entered" }],
    };
    const [moved] = tracerStatuses(movedFile, now);
    expect(moved!.standing).toBe("moved");
    expect(moved!.distanceFromHomeM!).toBeGreaterThan(1_000);
    expect(distanceMeters({ lat: 30.7, lng: -88.1 }, { lat: 30.7, lng: -88.1 })).toBe(0);
  });

  it("plots only what the record holds", () => {
    expect(tracerPlotPoints({ tracers: [], reports: [] })).toBeNull();
    const points = tracerPlotPoints(file);
    expect(points).toHaveLength(2); // t1's home + t1's report; the vest has neither
    expect(points!.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(true);
  });
});

describe("Detective View flags — from the sector record alone", () => {
  const event = (kind: SectorEvent["kind"], cameraId: string, acknowledged = false): SectorEvent => ({
    id: `${kind}-${cameraId}-${Math.random()}`,
    at: 5_000,
    cameraId,
    cameraName: "Front",
    zone: "front",
    kind,
    summary: "an event",
    reading: "",
    reasoning: "",
    frames: [],
    evidence: [],
    personReading: "",
    crossExam: [],
    acknowledged,
  });

  it("maps the record's kinds to the view's flags, for that camera only", () => {
    const events = [
      event("weapon", "cam-a"),
      event("bedroom-no-access", "cam-a"),
      event("front-threat", "cam-b"),
      event("front-truck", "cam-a", true),
    ];
    const flags = detectiveFlagsForCamera(events, "cam-a");
    expect(flags.map((f) => f.kind)).toEqual(["weapon", "new-face", "vehicle"]);
    // Unacknowledged lead; the acknowledged vehicle flag stands last.
    expect(flags[0]!.acknowledged).toBe(false);
    expect(flags[flags.length - 1]!.acknowledged).toBe(true);
    expect(detectiveFlagsForCamera(events, "cam-none")).toEqual([]);
    expect(detectiveFlagsForCamera([], "cam-a")).toEqual([]);
  });
});

describe("the agent's three buttons — problem, message, emergency", () => {
  it("files the typed problem through the host's door, and fires the emergency on confirm", async () => {
    const onReportError = vi.fn(async () => ({ ok: true, message: "Filed." }));
    const onMessage = vi.fn(async () => ({ ok: true, message: "Sent." }));
    const onEmergency = vi.fn(async () => ({ ok: true, message: "Ringing." }));
    render(
      <AgentContactButtons
        captainLabel="the Captain"
        emergencyNote="This rings the Captain's side."
        onReportError={onReportError}
        onMessage={onMessage}
        onEmergency={onEmergency}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    fireEvent.change(screen.getByPlaceholderText("Type the problem…"), {
      target: { value: "The calculator will not open" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send the problem to the Captain" }));
    await waitFor(() => expect(onReportError).toHaveBeenCalledWith("The calculator will not open"));
    expect(await screen.findByText("Filed.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "EMERGENCY" }));
    expect(onEmergency).not.toHaveBeenCalled(); // the confirm stands first
    fireEvent.click(screen.getByRole("button", { name: "Yes — emergency, send it now" }));
    await waitFor(() => expect(onEmergency).toHaveBeenCalledTimes(1));
  });
});
