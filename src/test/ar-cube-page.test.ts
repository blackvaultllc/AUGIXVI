import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AR ROUND (owner, 2026-11-22 ~20:37 EST, from his live test on the
 * Parrot): the in-app AR Cube works — camera running, "Locked on:
 * Diamond Star", the Wolf riding his physical cube. His two orders:
 * (1) "it needs to be faster"; (2) "the circular cube should be the
 * one to work as well" — the Rainbow Ball, his own round puzzle ball,
 * must also work as a tracked marker alongside the cube.
 *
 * These pins hold the static AR page (public/ar-cube/) to both:
 * the speed fixes in the render loop, and a Ball mode whose target is
 * compiled from photos of HIS ball — probed for, never fabricated.
 */
const appJs = readFileSync(resolve(process.cwd(), "public/ar-cube/js/app.js"), "utf8");
const pageHtml = readFileSync(resolve(process.cwd(), "public/ar-cube/index.html"), "utf8");

describe("AR Cube page — speed (v2.4)", () => {
  it("animates only the locked face's instance, never all anchors per frame", () => {
    expect(appJs).toContain("modelInstances[lockedFace]");
    expect(appJs).not.toContain("for (const inst of modelInstances)");
  });

  it("caps the renderer's pixel ratio at 1 (MindAR pins devicePixelRatio)", () => {
    expect(appJs).toContain("renderer.setPixelRatio(1)");
  });

  it("carries a live FPS readout wired into the page", () => {
    expect(appJs).toContain("fpsFrames");
    expect(pageHtml).toContain('id="fps"');
  });
});

describe("AR Cube page — markers (v2.4)", () => {
  it("offers exactly the cube and the Rainbow Ball, each with its own target file", () => {
    expect(appJs).toContain("targetsSrc: './assets/targets.mind'");
    expect(appJs).toContain("targetsSrc: './assets/ball-targets.mind'");
    expect(pageHtml).toContain('id="markerCubeBtn"');
    expect(pageHtml).toContain('id="markerBallBtn"');
    expect(pageHtml).toContain("Rainbow Ball");
  });

  it("stages cube models in the volume and ball models on the surface", () => {
    expect(appJs).toContain("staging: 'volume'");
    expect(appJs).toContain("staging: 'surface'");
  });

  it("probes for the ball target file instead of assuming it exists", () => {
    expect(appJs).toContain("probeBallTarget");
    expect(appJs).toContain("method: 'HEAD'");
    expect(appJs).toContain("ballTargetReady");
  });

  it("states the exact photo ask when the ball target is missing — no invented pattern", () => {
    expect(appJs).toContain("photos of YOUR ball");
    expect(appJs).toContain("front, back,");
    expect(appJs).toContain("left, right, top, bottom");
    // The compiled target is NOT in the repo until his photos are:
    // Ball mode must stay an honest slot, not a fabricated pattern.
    expect(existsSync(resolve(process.cwd(), "public/ar-cube/assets/ball-targets.mind"))).toBe(false);
    // And the photo spec lives in the slot for whoever compiles it.
    const readme = readFileSync(
      resolve(process.cwd(), "public/ar-cube/assets/ball/README.md"),
      "utf8",
    );
    expect(readme).toContain("ball-1-front.png");
    expect(readme).toContain("ball-targets.mind");
  });

  it("restarts the session on a marker switch (MindAR binds targets at construction)", () => {
    expect(appJs).toContain("teardownSession");
    expect(appJs).toContain("forceContextLoss");
  });
});

describe("AR Cube page — takeover truth (v2.5, Domenick's 2026-11-23 live test)", () => {
  it("never overrides the video's position — MindAR centers it to match its projection", () => {
    // v2's layering fix pinned the video to top/left 0; MindAR's
    // resize() centers the video with negative offsets (cover-crop)
    // and computes the projection for that placement, so the pin
    // displaced the whole overlay from the real cube — the model
    // rendered above the cube, in a box of its own. The pin is gone;
    // the layering function asserts stacking only.
    expect(appJs).toContain("fixCameraLayering");
    expect(appJs).not.toContain("video.style.top");
    expect(appJs).not.toContain("video.style.left");
    expect(appJs).not.toContain("video.style.position");
  });

  it("seats every staged model by the computed volume seat, not a hand shift", () => {
    expect(appJs).toContain("from './volumeSeat.js'");
    expect(appJs).toContain("computeVolumeSeat(bounds)");
    expect(appJs).toContain("makeStageGroup(built)");
    // The v2.2 hand shift and hand-tuned per-model scales are gone.
    expect(appJs).not.toContain("stagePos:");
    expect(appJs).not.toContain("stageScale:");
  });

  it("carries GLB bounds from the measured silhouette seat into the staging", () => {
    expect(appJs).toContain("rotatedBounds: rb");
    expect(appJs).toContain("volumeBounds");
  });
});

describe("AR Cube page — the Ball tap answers where he tapped (v2.5)", () => {
  it("renders the photo ask in a notice directly under the Marker row", () => {
    expect(pageHtml).toContain('id="ballNote"');
    expect(appJs).toContain("ballNoteEl");
    expect(appJs).toContain("showBallAsk()");
    expect(appJs).toContain("hideBallAsk()");
  });

  it("labels the Ball button itself while the target is missing", () => {
    expect(appJs).toContain("needs your photos");
  });

  it("does not trust a bare 200 for the ball target — an HTML fallback is not a target", () => {
    expect(appJs).toContain("content-type");
    expect(appJs).toContain("text/html");
  });
});
