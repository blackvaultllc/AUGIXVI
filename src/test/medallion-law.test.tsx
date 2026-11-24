import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OsirisMedallion } from "@/avatar/OsirisMedallion";

/**
 * THE MEDALLION LAW (owner order 2026-11-24 ~16:57 EST, reinforced
 * ~17:05 EST over his screenshot of the gods-on-the-sides build):
 *
 * - NO EDGE FIGURES: the tall side strips are OFF the stage
 *   entirely — nothing stands on the left or right edges.
 * - ANUBIS CENTER AT REST: Anubis stands in the middle at his
 *   regular front size; the other gods rest as SMALLER circles
 *   on the stage; dismissal returns Anubis to the center.
 *   (The resting-front behavior itself is pinned in
 *   god-stage.test.tsx; here: the shape law and the wiring.)
 * - ONE CIRCLE FORMAT (the 17:05 reinforcement, his words: "both
 *   of the other guards should not look in that shape or format —
 *   they should look like Osiris looks"): EVERY god's medallion
 *   is a true round circle — equal width and height, full-circle
 *   radius, the face centered and cover-fit inside. Not oval,
 *   not tall, not a strip, not a rounded rectangle. jsdom has no
 *   layout, so the geometry is pinned at the stylesheet: every
 *   rule that sizes a god's face pairs its width with the SAME
 *   height, and the circle format (radius + hidden overflow +
 *   cover-fit face) is carried by all three gods alike.
 * - OSIRIS STANDS ALONE: bare on the stage — no box, no panel,
 *   no border drawn around him by a container — with his four
 *   keys and his message option inside his three-lines menu,
 *   and his direct-message screen opening under him.
 */

const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const fixCss = readFileSync(
  resolve(process.cwd(), "src/avatar/stage-fix-round.css"),
  "utf8",
);
const stageSource = readFileSync(
  resolve(process.cwd(), "src/avatar/AvatarStage.tsx"),
  "utf8",
);

/** Every rule body for an exact selector opening, in order. */
function ruleBodies(css: string, selector: string): string[] {
  const bodies: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(selector, from);
    if (start === -1) break;
    const open = css.indexOf("{", start);
    bodies.push(css.slice(open, css.indexOf("}", open)));
    from = start + 1;
  }
  return bodies;
}

function widthOf(body: string): string | null {
  return body.match(/width:\s*([^;]+);/)?.[1]?.trim() ?? null;
}
function heightOf(body: string): string | null {
  return body.match(/height:\s*([^;]+);/)?.[1]?.trim() ?? null;
}

describe("one circle format — every god's medallion is a true round circle", () => {
  it("the resting circles (Anubis's and Montu's small medallions): square, 50% radius, clipped round", () => {
    const bodies = ruleBodies(styles, ".god-medallion {");
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    // EVERY sizing rule pairs width with the identical height —
    // a tall or oval medallion cannot be expressed.
    for (const body of bodies) {
      const w = widthOf(body);
      if (w !== null) expect(heightOf(body)).toBe(w);
    }
    const base = bodies[0];
    expect(base).toContain("border-radius: 50%");
    expect(base).toContain("aspect-ratio: 1");
    expect(base).toContain("overflow: hidden");
    // The face image is cover-fit and centered — never stretched.
    const img = ruleBodies(styles, ".god-medallion__img {")[0];
    expect(img).toContain("object-fit: cover");
    expect(img).toContain("border-radius: 50%");
  });

  it("Osiris's medallion: 104×104 standing, 84×84 at phone width — equal sides both", () => {
    const bodies = ruleBodies(fixCss, ".osiris-medallion .augie-presence {");
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    for (const body of bodies) {
      const w = widthOf(body);
      if (w !== null) expect(heightOf(body)).toBe(w);
    }
    expect(bodies.some((b) => b.includes("width: 104px"))).toBe(true);
    expect(bodies.some((b) => b.includes("width: 84px"))).toBe(true);
    // His circle format is the shared presence format: full
    // radius on the base rule, face clipped inside it.
    const base = ruleBodies(styles, ".augie-presence {")[0];
    expect(base).toContain("border-radius: 9999px");
  });

  it("Anubis's front medallion: every sizing pairs equal sides, full-circle radius, cover-fit face", () => {
    const bodies = ruleBodies(styles, ".anubis-presence__face {");
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    for (const body of bodies) {
      const w = widthOf(body);
      if (w !== null) expect(heightOf(body)).toBe(w);
    }
    expect(
      bodies.some(
        (b) => b.includes("border-radius: 9999px") && b.includes("overflow: hidden"),
      ),
    ).toBe(true);
    const img = ruleBodies(styles, ".anubis-presence__img {")[0];
    expect(img).toContain("object-fit: cover");
    expect(img).toContain("object-position: 50% 50%");
  });

  it("Montu's front medallion: the same circle format — full radius, clipped, cover-fit face", () => {
    const bodies = ruleBodies(styles, ".montu-presence__face {");
    expect(bodies.length).toBeGreaterThanOrEqual(1);
    expect(
      bodies.some(
        (b) => b.includes("border-radius: 9999px") && b.includes("overflow: hidden"),
      ),
    ).toBe(true);
    const img = ruleBodies(styles, ".montu-presence__img {")[0];
    expect(img).toContain("object-fit: cover");
    expect(img).toContain("object-position: 50% 50%");
  });

  it("no edge figures anywhere: no side rail in the stage, the styles, or the fix sheet", () => {
    expect(stageSource).not.toContain("GodSideRail");
    expect(stageSource).not.toContain("god-side-rail");
    expect(styles).not.toContain(".god-side-rail");
    expect(fixCss).not.toContain(".god-side-rail");
    // The resting circles and Osiris's lone stand are wired.
    expect(stageSource).toContain("<GodMedallions");
    expect(stageSource).toContain("<OsirisMedallion");
    expect(stageSource).toContain("RESTING_FRONT");
  });
});

describe("Osiris stands alone — bare, his keys in his three-lines menu", () => {
  function renderOsiris(over: Partial<Parameters<typeof OsirisMedallion>[0]> = {}) {
    const props = {
      ready: true,
      avatarState: "IDLE" as const,
      voiceListening: false,
      acting: false,
      speaking: false,
      anchored: false,
      onToggleAnchor: vi.fn(),
      onResetWindow: vi.fn(),
      onOpenMenu: vi.fn(),
      onMinimizeWindow: vi.fn(),
      onSelectFace: vi.fn(),
      onDirectMessage: vi.fn(),
      ...over,
    };
    const utils = render(<OsirisMedallion {...props} />);
    return { ...utils, props };
  }

  it("he renders bare: the face stands with no box, panel, or window around him", () => {
    const { container } = renderOsiris();
    const root = container.querySelector(".osiris-medallion");
    expect(root).not.toBeNull();
    // His face is right there under his own name — no container
    // class from the chat window or any panel dresses him.
    expect(root!.querySelector(".augie-presence")).not.toBeNull();
    expect(container.querySelector(".avatar-command-box")).toBeNull();
    expect(root!.className).not.toMatch(/panel|box|console/);
    // At rest the menu and the message screen are closed.
    expect(container.querySelector(".osiris-medallion__menu")).toBeNull();
    expect(container.querySelector(".osiris-medallion__dm")).toBeNull();
  });

  it("his face tap turns the conversation to him", () => {
    const { props } = renderOsiris();
    fireEvent.click(
      screen.getByRole("button", { name: "Talk to Osiris — turn the chat to him" }),
    );
    expect(props.onSelectFace).toHaveBeenCalledTimes(1);
  });

  it("the three-lines button pops his menu: the four keys in a row, plus his message option", () => {
    const { container, props } = renderOsiris();
    const openMenu = () =>
      fireEvent.click(screen.getByRole("button", { name: "Open Osiris's menu" }));
    openMenu();
    const menu = container.querySelector(".osiris-medallion__menu");
    expect(menu).not.toBeNull();
    // The row is horizontal — pinned at the stylesheet.
    const menuRule = ruleBodies(fixCss, ".osiris-medallion__menu {")[0];
    expect(menuRule).toContain("flex-direction: row");
    // The message option stands in the same menu.
    expect(
      screen.getByRole("menuitem", { name: "Message Osiris directly" }),
    ).toBeInTheDocument();
    // The four keys, same functions as they always had — each
    // one fires its act and folds the menu away behind it.
    fireEvent.click(screen.getByRole("menuitem", { name: "Anchor the chat window" }));
    expect(props.onToggleAnchor).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".osiris-medallion__menu")).toBeNull();
    openMenu();
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Reset the chat window to its home form" }),
    );
    expect(props.onResetWindow).toHaveBeenCalledTimes(1);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Open the chat window's menu" }));
    expect(props.onOpenMenu).toHaveBeenCalledTimes(1);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Minimize the chat window" }));
    expect(props.onMinimizeWindow).toHaveBeenCalledTimes(1);
  });

  it("the anchor key speaks its other state when the window is anchored", () => {
    renderOsiris({ anchored: true });
    fireEvent.click(screen.getByRole("button", { name: "Open Osiris's menu" }));
    expect(
      screen.getByRole("menuitem", { name: "Unanchor the chat window" }),
    ).toBeInTheDocument();
  });

  it("the message option opens his message screen under him, and the line goes to Osiris", () => {
    const { container, props } = renderOsiris();
    fireEvent.click(screen.getByRole("button", { name: "Open Osiris's menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Message Osiris directly" }));
    const dm = container.querySelector(".osiris-medallion__dm");
    expect(dm).not.toBeNull();
    // The screen stands under him — its sheet dresses it below
    // the medallion (top offset past his face), never over him.
    const dmRule = ruleBodies(fixCss, ".osiris-medallion__dm {")[0];
    expect(dmRule).toContain("position: absolute");
    const input = screen.getByPlaceholderText("Message Osiris directly");
    fireEvent.change(input, { target: { value: "Osiris, stand watch." } });
    fireEvent.click(screen.getByRole("button", { name: "Send the message to Osiris" }));
    expect(props.onDirectMessage).toHaveBeenCalledWith("Osiris, stand watch.");
    // The line is sent and the field clears, ready for the next
    // one — the screen folds away with his menu discipline
    // (outside press / Escape), not on its own.
    expect((input as HTMLInputElement).value).toBe("");
    expect(container.querySelector(".osiris-medallion__dm")).not.toBeNull();
  });
});
