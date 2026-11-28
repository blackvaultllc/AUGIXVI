import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

describe("phone fix pass 3 — the sheet hugs its content, the caption stays on the phone, the grid stands even (owner eye-check 2026-11-27 ~21:32 CST)", () => {
  const passCss = readFileSync(resolve(process.cwd(), "src/avatar/phone-fix-pass.css"), "utf8");
  const pass3 = passCss.slice(passCss.indexOf("PHONE FIX PASS 3"));

  it("the open command box fits its content, capped — no fixed height, no void", () => {
    expect(pass3).toContain(
      ".avatar-stage .avatar-command-box:not(.avatar-command-box--minimized)",
    );
    expect(pass3).toContain("height: auto");
    expect(pass3).toContain("max-height: min(62dvh, 36rem)");
    expect(pass3).toContain("max-height: min(80dvh, 44rem)");
  });

  it("the section chain has one scroller — the panel — with no nested cap to slice a row", () => {
    expect(pass3).toContain(
      ".avatar-stage .avatar-command-box--section-open .avatar-command-box__panel",
    );
    expect(pass3).toContain("overflow-y: auto");
    expect(pass3).toContain(".avatar-stage .avatar-command-box__thread");
    expect(pass3).toContain("max-height: min(38dvh, 22rem)");
  });

  it("Anubis's spoken caption stands inside the right margin, bounded to a reading width", () => {
    expect(pass3).toContain(".avatar-stage .speech-bubble--anubis");
    expect(pass3).toContain("right: 0.75rem");
    expect(passCss).toContain("max-width: min(16rem, 74vw)");
  });

  it("the tools grid's rows stand even and its labels wrap whole inside their tiles", () => {
    expect(pass3).toContain("grid-auto-rows: 1fr");
    expect(pass3).toContain(".avatar-stage .avatar-command-box__action > span");
    expect(pass3).toContain("white-space: normal");
  });
});

describe("phone fix pass 4 — the phone chat is a stream, not a box (owner restatement 2026-11-27 ~21:58 CST)", () => {
  const passCss = readFileSync(resolve(process.cwd(), "src/avatar/phone-fix-pass.css"), "utf8");
  const pass4 = passCss.slice(
    passCss.indexOf("PHONE FIX PASS 4"),
    passCss.indexOf("PHONE FIX PASS 5"),
  );
  const boxSource = readFileSync(resolve(process.cwd(), "src/avatar/CommandBox.tsx"), "utf8");

  it("the chat face carries no sheet: no background, no border, no shadow, no blur", () => {
    expect(pass4).toContain(
      ".avatar-command-box--phone-bar:not(.avatar-command-box--minimized):not(.avatar-command-box--section-open):not(.avatar-command-box--enlarged)",
    );
    expect(pass4).toContain("background: transparent");
    expect(pass4).toContain("border: none");
    expect(pass4).toContain("box-shadow: none");
    expect(pass4).toContain("backdrop-filter: none");
  });

  it("the unit is capped in the stage's lower reach, so the construct stands visible above the stream", () => {
    expect(pass4).toContain("height: auto");
    expect(pass4).toContain("max-height: min(40dvh, 30rem)");
  });

  it("the thread is a bare scroller — no slate, no border — flexing inside the unit", () => {
    expect(pass4).toContain(
      ".avatar-command-box--phone-bar:not(.avatar-command-box--section-open) .avatar-command-box__thread",
    );
    expect(pass4).toContain("max-height: none");
    expect(pass4).toContain("flex: 1 1 auto");
  });

  it("a section keeps pass 3's sheet — the unboxing is fenced to the chat face", () => {
    // Every pass-4 chat-face rule excludes the section-open state.
    const pass4Rules = pass4.slice(pass4.indexOf("@media"));
    for (const rule of pass4Rules.split("}")) {
      if (rule.includes(".avatar-command-box")) {
        expect(rule).toContain(":not(.avatar-command-box--section-open)");
      }
    }
  });

  it("the stream snaps to whole lines on the phone form — no half-cut line at the top", () => {
    expect(boxSource).toContain("snapThreadToWholeLines");
    expect(boxSource).toContain('thread.querySelector<HTMLElement>(".avatar-command-box__thread-flow")');
    // The snap is the phone form's alone; the desktop form clears its trace.
    expect(boxSource).toContain('if (!phoneBar) thread.style.height = "";');
  });
});

describe("phone fix pass 5 — the chat's type steps down, sections hug their content, tiles fit their words, the '+' menu stays on the screen (owner eye-check 2026-11-27 ~22:20 CST)", () => {
  const passCss = readFileSync(resolve(process.cwd(), "src/avatar/phone-fix-pass.css"), "utf8");
  const pass5 = passCss.slice(passCss.indexOf("PHONE FIX PASS 5"));

  it("the stream's reading size steps down one step on the phone — the stream itself untouched", () => {
    expect(pass5).toContain(
      ".avatar-command-box--phone-bar:not(.avatar-command-box--minimized):not(.avatar-command-box--section-open) .avatar-command-box__thread",
    );
    expect(pass5).toContain("font-size: 0.85rem");
  });

  it("a section unit is its content's height, at a measure no bundle order can outrank", () => {
    expect(pass5).toContain(
      ".avatar-command-box--phone-bar.avatar-command-box--section-open:not(.avatar-command-box--minimized):not(.avatar-command-box--enlarged)",
    );
    expect(pass5).toContain("height: auto");
    expect(pass5).toContain("max-height: min(62dvh, 36rem)");
    // The enlarged measure keeps its taller cap, still fit to content.
    expect(pass5).toContain(
      ".avatar-command-box--section-open.avatar-command-box--enlarged:not(.avatar-command-box--minimized)",
    );
    expect(pass5).toContain("max-height: min(80dvh, 44rem)");
  });

  it("the section chain cannot hold the unit open — machinery and panel size to content, the panel the one scroller", () => {
    expect(pass5).toContain(
      ".avatar-command-box--section-open .avatar-command-box__machinery",
    );
    expect(pass5).toContain(".avatar-command-box--section-open .avatar-command-box__panel");
    expect(pass5).toContain("flex: 0 1 auto");
    expect(pass5).toContain("overflow-y: auto");
  });

  it("the section tiles fit their words — rows size to content, labels smaller, padding tighter", () => {
    expect(pass5).toContain("grid-auto-rows: auto");
    expect(pass5).toContain(
      ".avatar-command-box--section-open .avatar-command-box__grid .avatar-command-box__action",
    );
    expect(pass5).toContain("font-size: 0.68rem");
    expect(pass5).toContain("padding: 0.35rem 0.5rem");
    expect(pass5).toContain("min-height: 0");
  });

  it("the '+' menu is bounded to the screen and scrolls inside itself — every row reachable", () => {
    expect(pass5).toContain(".avatar-command-box--phone-bar .avatar-command-box__options");
    expect(pass5).toContain("max-height: min(48dvh, 30rem)");
    expect(pass5).toContain("overflow-y: auto");
    // While the menu stands open on the chat face, the unit takes the room it needs.
    expect(pass5).toContain(":has(.avatar-command-box__options)");
    expect(pass5).toContain("max-height: min(88dvh, 44rem)");
  });
});

describe("phone fix pass 9 — the plus menu as symbols: gold on the dark ground, no blue bars, no unused space (owner order 2026-11-28 ~00:37 CST)", () => {
  const stageCss = readFileSync(resolve(process.cwd(), "src/avatar/stage-fix-round.css"), "utf8");
  const passCss = readFileSync(resolve(process.cwd(), "src/avatar/phone-fix-pass.css"), "utf8");
  const pass9 = passCss.slice(passCss.indexOf("PHONE FIX PASS 9"));

  function ruleBody(css: string, selector: string): string {
    const start = css.indexOf(selector);
    expect(start, `rule for ${selector}`).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf("}", start));
  }

  it("the strip is a tight row sized to its symbols — not a full-width column", () => {
    const optionsRule = ruleBody(stageCss, ".avatar-command-box__options {");
    expect(optionsRule).toContain("order: -1");
    expect(optionsRule).toContain("flex-direction: row");
    expect(optionsRule).toContain("width: fit-content");
    expect(optionsRule).not.toContain("flex: 1 1 100%");
  });

  it("the blue bar fill is out of the menu — symbols gold on the dark ground", () => {
    const optionRule = ruleBody(stageCss, ".avatar-command-box__option {");
    expect(optionRule).not.toContain("#1d2a52");
    expect(optionRule).toContain("background: transparent");
    expect(optionRule).toContain("color: #ffd94d");
    // The plus button itself sheds the blue fill too.
    const toggleRule = ruleBody(stageCss, ".avatar-command-box__options-toggle {");
    expect(toggleRule).not.toContain("#1d2a52");
    expect(toggleRule).toContain("color: #ffd94d");
  });

  it("one action is one square symbol — no word-bar geometry left", () => {
    const optionRule = ruleBody(stageCss, ".avatar-command-box__option {");
    expect(optionRule).toContain("width: 3rem");
    expect(optionRule).toContain("height: 3rem");
    expect(optionRule).not.toContain("width: 100%");
    expect(optionRule).not.toContain("text-align: left");
  });

  it("pass 5's bounded scroller is retired for the strip — the symbols stand in the open", () => {
    expect(pass9).toContain(".avatar-command-box--phone-bar .avatar-command-box__options");
    expect(pass9).toContain("max-height: none");
    expect(pass9).toContain("overflow: visible");
    expect(pass9).toContain("width: fit-content");
  });
});
