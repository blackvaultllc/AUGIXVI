import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PHONE PERFORMANCE ROUND (owner voice call 2026-11-24 ~10:00 EST):
 * source pins for the render caps' wiring, plus the ACTIVITY-line
 * containment from his phone screenshots the same morning. The
 * behavior of the caps themselves is pinned in device-profile.test.ts;
 * the delegate order in sensors-config.test.ts; the Montu gate in
 * space-view.test.tsx / earth-scene.test.tsx.
 */
const stage = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
const renderer = readFileSync(resolve(process.cwd(), "src/avatar/AvatarRenderer.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/avatar/stage-fix-round.css"), "utf8");

describe("phone render caps — wiring", () => {
  it("the stage constructs its renderer with the device caps spread in", () => {
    expect(stage).toContain("currentRenderCaps()");
    expect(stage).toContain("...currentRenderCaps()");
  });

  it("the renderer builds its particle buffer at the capped count", () => {
    expect(renderer).toContain(
      "source(Math.min(settings.maxParticles, settings.particleCap ?? Infinity))",
    );
  });

  it("the renderer caps its pixel ratio by the profile, defaulting to the old 1.75", () => {
    expect(renderer).toContain("settings.pixelRatioCap ?? 1.75");
  });

  it("the adaptive governor's floor comes from the profile, defaulting to the old 15000", () => {
    expect(renderer).toContain("this.settings.particleFloor ?? 15000");
  });

  it("a later settings raise still respects the cap in updateSettings", () => {
    expect(renderer).toContain("this.settings.particleCap ?? Infinity");
  });
});

describe("the placement card ends above the bar (section 30)", () => {
  const start = css.indexOf("30) THE PLACEMENT CARD ENDS ABOVE THE BAR");
  const section = css.slice(start);

  it("the section exists and is phone-scoped", () => {
    expect(start).toBeGreaterThan(-1);
    expect(section).toContain("@media (max-width: 700px)");
  });

  it("the card docks fixed above the folded bar, height-capped with its own scroll", () => {
    expect(section).toContain(".medallion-menu__panel {");
    expect(section).toContain("position: fixed");
    expect(section).toContain("bottom: calc(7.25rem + env(safe-area-inset-bottom))");
    expect(section).toContain("overflow-y: auto");
  });
});

describe("the activity line never leaves its panel (section 29)", () => {
  const start = css.indexOf("29) THE ACTIVITY LINE NEVER LEAVES ITS PANEL");
  const section = css.slice(start);

  it("the section exists and is phone-scoped", () => {
    expect(start).toBeGreaterThan(-1);
    expect(section).toContain("@media (max-width: 700px)");
  });

  it("the left panel clips its contents to its own bounds at phone sizes", () => {
    expect(section).toContain(".avatar-stage .avatar-hud--tl {");
    expect(section).toContain("overflow: hidden");
  });

  it("every line inside wraps within the panel, the activity line named", () => {
    expect(section).toContain(".avatar-stage .avatar-hud--tl > *");
    expect(section).toContain("overflow-wrap: anywhere");
    expect(section).toContain(".avatar-stage .avatar-hud__activity");
  });
});
