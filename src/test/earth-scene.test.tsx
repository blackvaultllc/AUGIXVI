import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpaceView } from "@/avatar/SpaceView";

/**
 * EARTH SCENE DRESSING (owner order 2026-11-24): the Captain looked at
 * his earth page and ordered the dressing cut — "the satellites and the
 * shooting star whatever get rid of that. And the orb that's moving
 * around there get rid of that. Get rid of the sun and the moon...
 * they don't look real." The Earth stays, spinning, as it was. In the
 * removed pieces' place: ANUBIS'S FACE on the LEFT side of the scene in
 * a still circular medallion — explicitly NOT in the middle — while
 * the world spins.
 */
const sceneSource = readFileSync(
  resolve(process.cwd(), "src/components/SpinningEarth.tsx"),
  "utf8",
);
const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("earth scene — the dressing is gone, the Earth stays", () => {
  it("no satellites, no meteor/shooting star, no whoosh, no moving orb in the scene source", () => {
    expect(sceneSource).not.toContain("Satellite");
    expect(sceneSource).not.toContain("Meteor");
    expect(sceneSource).not.toContain("playWhoosh");
    expect(sceneSource).not.toContain("OsirisOrbiter");
    expect(sceneSource).not.toContain("ORBIT_RADIUS");
  });

  it("no sun ball and no moon ball groups in the scene source", () => {
    // The decorative sun group and moon group positions are gone.
    expect(sceneSource).not.toContain("[12, 4.2, -10]");
    expect(sceneSource).not.toContain("[-5.2, 2.1, -2.6]");
    // Their core colors went with them.
    expect(sceneSource).not.toContain("#fff6c8");
    expect(sceneSource).not.toContain("#e9e4d2");
  });

  it("the Earth itself is untouched and still spins", () => {
    expect(sceneSource).toContain("<Earth />");
    expect(sceneSource).toContain("earth.current.rotation.y +=");
    expect(sceneSource).toContain("EARTH_TEXTURES");
  });
});

describe("earth scene — Anubis's face on the left", () => {
  it("renders the medallion with the canonical face in the orbital view", () => {
    render(<SpaceView isEnteringLiveMode={false} isReturningToSpace={false} />);
    const medallion = document.querySelector(".spinning-earth__anubis-medallion");
    expect(medallion).not.toBeNull();
    const img = medallion?.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/anubis-presence/face.webp");
    // Circular presentation, carried by the stylesheet's medallion rule.
    expect(css).toContain(".spinning-earth__anubis-medallion img");
    expect(css).toContain("border-radius: 9999px");
  });

  it("the medallion sits on the LEFT side — pinned left, vertically centered, never centered horizontally", () => {
    render(<SpaceView isEnteringLiveMode={false} isReturningToSpace={false} />);
    const medallion = document.querySelector<HTMLElement>(
      ".spinning-earth__anubis-medallion",
    );
    expect(medallion).not.toBeNull();
    // Placement is pinned in the stylesheet (the rendered page is
    // verified separately in a real browser): left edge pinned near the
    // scene's left side, vertically centered by a Y-only transform — no
    // X centering in the medallion's own rule, it is NOT in the middle.
    const ruleStart = css.indexOf(".spinning-earth__anubis-medallion {");
    const rule = css.slice(ruleStart, css.indexOf("}", ruleStart));
    expect(rule).toContain("left: clamp(0.75rem, 3vw, 2.5rem)");
    expect(rule).toContain("top: 50%");
    expect(rule).toContain("transform: translateY(-50%)");
    expect(rule).not.toContain("translateX");
    expect(sceneSource).toContain("ANUBIS_PORTRAIT_SRC");
    // Phone widths: the medallion steps up to the upper left so the
    // centered sign-in card never covers the face.
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("top: 10%");
  });

  it("the landing view is guarded by Montu now — no Earth, no Anubis medallion — and the flight still hides the chrome", () => {
    // SUPERSEDED (owner order 2026-11-24 ~10:00 EST): the landing used
    // to render the Earth scene with Anubis's medallion. The front
    // intro now drops the spinning Earth entirely — MONTU guards the
    // gate, and Anubis is reached only after sign-in. The Earth scene
    // (and its medallion) lives on in the orbital view, tested above.
    const landing = render(
      <SpaceView isLanding isEnteringLiveMode={false} isReturningToSpace={false}>
        <section aria-label="Operator sign-in">Sign in</section>
      </SpaceView>,
    );
    expect(
      landing.container.querySelector(".spinning-earth__anubis-medallion"),
    ).toBeNull();
    expect(landing.container.querySelector("[data-testid='montu-guard']")).not.toBeNull();
    expect(
      landing.container.querySelector(".avatar-space-view__montu-face")?.getAttribute("src"),
    ).toBe("/montu-presence/face.webp");
    landing.unmount();

    const flying = render(<SpaceView isEnteringLiveMode isReturningToSpace={false} />);
    expect(
      flying.container.querySelector(".spinning-earth__anubis-medallion"),
    ).toBeNull();
  });

  it("the Montu guard medallion is placed clear of the sign-in card at phone sizes", () => {
    // Same care as the earth-page medallion: at phone widths the
    // guardian steps to the top center and the landing overlay's
    // content box starts below him, so the card never covers him.
    const ruleStart = css.indexOf(".avatar-space-view__montu-guard {");
    const rule = css.slice(ruleStart, css.indexOf("}", ruleStart));
    expect(rule).toContain("left: clamp(1rem, 4vw, 3.5rem)");
    expect(rule).toContain("top: 50%");
    const phoneBlock = css.slice(css.indexOf("@media (max-width: 640px)", ruleStart));
    expect(phoneBlock).toContain(".avatar-space-view__montu-guard");
    expect(phoneBlock).toContain("padding-top: 12rem");
  });
});
