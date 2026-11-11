import { describe, expect, it } from "vitest";
import {
  DEPARTMENTS,
  ROSTER,
  TOTAL_WORKERS,
  callWorkerLine,
  departmentOf,
  findWorkers,
  parseWorkerCall,
} from "@/avatar/world/workers";
import {
  BLACK_HATTER,
  FADE_MS,
  OFFICE_ROOMS,
  TOTAL_ENTERING_MS,
  isOfficeWalkInRequest,
  phaseAt,
  sandSparkle,
} from "@/avatar/world/office";
import { TOP_LEVEL, resolveChoice } from "@/avatar/windows/BattleBox";

describe("Osiris's workforce — the crew works HERE now", () => {
  it("fields the full crew of 68 across departments", () => {
    expect(TOTAL_WORKERS).toBe(68);
    expect(ROSTER.length).toBe(68);
    expect(DEPARTMENTS.length).toBeGreaterThanOrEqual(6);
  });

  it("finds workers by name, specialty and department", () => {
    expect(findWorkers("Defense Watch").length).toBeGreaterThan(0);
    expect(findWorkers("radar").length).toBeGreaterThan(0);
    const everyone = findWorkers("of Intelligence Desk");
    expect(everyone.length).toBeGreaterThan(0);
  });

  it("calls a worker: status plus a suggestion, never an action", () => {
    const worker = ROSTER[0]!;
    const line = callWorkerLine(worker);
    expect(line).toContain(worker.name);
    expect(line).toMatch(/suggest/i);
    expect(departmentOf(worker)).toBeTruthy();
  });

  it("parses call orders and refuses vague targets", () => {
    expect(parseWorkerCall("call Amun")).toEqual({ target: "Amun" });
    expect(parseWorkerCall("ask the Defense Watch")).toEqual({ target: "Defense Watch" });
    expect(parseWorkerCall("call everyone")).toBeNull();
    expect(parseWorkerCall("what time is it")).toBeNull();
  });
});

describe("the office walk-in — fade to black with sand", () => {
  it("hears the request in its natural shapes", () => {
    expect(isOfficeWalkInRequest("hey, let's go to office")).toBe(true);
    expect(isOfficeWalkInRequest("take me to the office")).toBe(true);
    expect(isOfficeWalkInRequest("office")).toBe(true);
    expect(isOfficeWalkInRequest("fly to space")).toBe(false);
  });

  it("fades first, holds black, then reveals Osiris inside", () => {
    expect(phaseAt(FADE_MS - 1)).toBe("fade-out");
    expect(phaseAt(FADE_MS + 10)).toBe("entering");
    expect(phaseAt(TOTAL_ENTERING_MS + 1)).toBe("inside");
  });

  it("sand sparkles mid-fade and settles inside", () => {
    expect(sandSparkle(-1)).toBe(0);
    expect(sandSparkle(FADE_MS / 2)).toBeGreaterThan(0.5);
    expect(sandSparkle(TOTAL_ENTERING_MS + 100)).toBeLessThan(0.2);
  });

  it("has rooms for the departments and Osiris's corner office", () => {
    const ids = OFFICE_ROOMS.map((r) => r.id);
    expect(ids).toContain("office-top");
    expect(ids).toContain("war-room");
    expect(OFFICE_ROOMS.length).toBeGreaterThanOrEqual(8);
  });

  it("the Black Hatter is a wolf-type, ready to spawn on button press", () => {
    expect(BLACK_HATTER.build).toBe("wolf");
    expect(BLACK_HATTER.fur).toBe("black");
  });
});

describe("Mom's blue attack box — the container, fixed", () => {
  it("opens exactly the four command rows", () => {
    expect(TOP_LEVEL.map((c) => c.label)).toEqual(["Attack", "Magic", "Items", "Run"]);
  });

  it("subcategories live INSIDE the same box (children, not screens)", () => {
    const attack = TOP_LEVEL.find((c) => c.label === "Attack");
    expect(attack?.children?.length).toBeGreaterThan(0);
    // Resolving a deep choice keeps the outcome in-box.
    expect(resolveChoice("attack", "strike")).toMatch(/strike/i);
    expect(resolveChoice("chosen", "run")).toMatch(/away/i);
  });
});
