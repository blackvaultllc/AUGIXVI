import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MORNING EYE-CHECK ROUND (owner, 2026-11-23 ~06:12–06:15 EST,
 * from his screenshot of the new build):
 * 1) idle musings polluted the conversation thread as fake
 *    replies — they now surface ONLY as a quiet activity line,
 *    and proactive reports travel the notification channel, never
 *    the reply channel; the Sha offer is day-gated;
 * 2) STATUS claimed LISTENING while the mic was off — the stage
 *    source wires the ear's real state into the STATUS readout
 *    (the label rule itself is pinned in voice-hearing.test.ts);
 * 3) the backdrop's holder goes BLACK while a picture is up, and
 *    every HUD line reads bright-on-black;
 * 4) Anubis's factory default is the big size, centered (pinned
 *    in medallion-anchor.test.tsx);
 * 5) the yellow stretch tab is gone — size lives in the menu;
 * 6) the circle does not move (pinned in stage-eyecheck-round);
 * 7) both top HUD clusters wear the indicator's panel style and
 *    spread out;
 * 8) the chat box moves on a genuine grab, and its rail contains
 *    everything inside the border.
 */

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const stage = read("src/avatar/AvatarStage.tsx");
const stageCss = read("src/avatar/stage-fix-round.css");
const styles = read("src/styles.css");
const worldRenderer = read("src/avatar/worldSceneRenderer.ts");
const avatarRenderer = read("src/avatar/AvatarRenderer.ts");
const commandBox = read("src/avatar/CommandBox.tsx");
const medallionMenu = read("src/avatar/MedallionMenu.tsx");
const medallionHook = read("src/avatar/useMedallionAnchor.ts");
const livingPortrait = read("src/avatar/LivingPortrait.tsx");

function ruleBody(css: string, selector: string, fromIndex = 0): string {
  const start = css.indexOf(selector, fromIndex);
  expect(start, `selector ${selector}`).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open, close);
}

describe("thread purity — musings never wear a reply's clothes", () => {
  it("the idle tick writes the quiet activity line and never speaks", () => {
    expect(stage).toContain("setActivityLine(line)");
    // The line's home is the top-left box now (desk photos
    // 2026-11-23 ~07:11 EST) — a readout line in the CORE
    // cluster, not a loose element on the stage's edge.
    expect(stage).toContain("avatar-hud__activity");
    // The old pollution path: the tick feeding the reply channel.
    expect(stage).not.toContain('setResponseSource("idle life")');
  });

  it("the idle tick also stands down while a reply is being composed", () => {
    expect(stage).toContain('bridgeRef.current.state === "THINKING"');
  });

  it("proactive reports travel the notification channel, not the reply channel", () => {
    expect(stage).toContain('(line) => notify("proactive", line)');
    expect(stage).not.toContain("(line) => aiRef.current?.speak(line)");
  });

  it("the Sha offer is wrapped in the once-a-day gate", () => {
    expect(stage).toContain("withDailyOfferGate(shaWatcher(shaShownRef.current)");
    expect(stage).toContain("augi.proactive.sha-offer-day.v1");
  });
});

describe("one truth on screen — STATUS answers to the ear", () => {
  it("the stage tracks the ear's real state and derives the STATUS label from it", () => {
    expect(stage).toContain("setEarState(nextEarState)");
    expect(stage).toContain("setEarState(ear.currentState)");
    expect(stage).toContain("stageStatusLabel(state, earState)");
  });
});

describe("the holder goes black — backdrop surround and HUD readability", () => {
  it("the room's back wall renders black while a backdrop picture is up", () => {
    expect(worldRenderer).toContain('backdrop ? "#000000" : surfaces.wall');
  });

  it("the canvas clears black while a backdrop picture is up", () => {
    expect(avatarRenderer).toContain("builderBackdropPicture");
    expect(avatarRenderer).toContain("roomClearColor()");
    expect(avatarRenderer).toContain("this.builderBackdropPicture ? 0x000000");
  });

  it("the FPS and sensor lines carry the bright readout class", () => {
    expect(stage).toContain('className="avatar-hud__db-status"');
    // ANCHOR MOVED (clean-screen round, 2026-11-24): the first
    // bare "FPS" in the file is now the status tab's own comment —
    // the pin anchors on the readout itself, inside the one
    // status panel the clusters moved into.
    const fpsAt = stage.indexOf("{perf.fps} FPS");
    expect(stage.slice(Math.max(0, fpsAt - 200), fpsAt)).toContain("avatar-hud__db-status");
  });

  it("both top clusters wear the indicator's panel — and size to their content", () => {
    const hud = ruleBody(stageCss, ".avatar-stage div.avatar-hud");
    expect(hud).toContain("rgb(10 12 16 / 88%)");
    expect(hud).toContain("border-radius: 10px");
    // SUPERSEDED the same morning (owner eye-check 2026-11-23
    // ~06:51 EST): the 19rem minimum width this test was written
    // to pin became the defect — "if that's all the words why do
    // we have those other gaps in the container box." The No
    // Empty Gaps law governs now: no minimum width anywhere, and
    // the type went UP for his bifocals in the same round (1rem
    // primary lines — the lock-down round's pins live in
    // stage-lockdown-round.test.ts).
    expect(stageCss).not.toContain("min-width: 19rem");
    expect(hud).toContain("font-size: 1rem");
  });

  it("the activity line is a quiet status surface of its own", () => {
    // MOVED INTO THE BOX (owner desk photos 2026-11-23 ~07:11
    // EST): "the activity on the side could be put up in one of
    // the boxes… stop putting extra stuff on the screen." The
    // free-floating bottom-right line is gone; the musing renders
    // as a readout line inside the top-left cluster.
    expect(stage).toContain("avatar-hud__activity");
    expect(stage).not.toContain('className="avatar-activity-line"');
    expect(stageCss).toContain(".avatar-stage .avatar-hud__activity");
    expect(stageCss).not.toContain(".avatar-activity-line {");
  });
});

describe("the clean circle — no tab drawn on the face", () => {
  it("no presence renders a stretch handle, and the hook offers none", () => {
    for (const file of [
      "src/avatar/AnubisPresence.tsx",
      "src/avatar/BlackHatterPresence.tsx",
      "src/avatar/MontuPresence.tsx",
    ]) {
      expect(read(file)).not.toContain("medallion-anchor__stretch");
      expect(read(file)).toContain("onSizeChange={anchor.setSize}");
    }
    expect(medallionHook).not.toContain("stretchProps");
    expect(medallionHook).toContain("const setSize");
  });

  it("size lives in the medallion's box menu, in plain steps", () => {
    expect(medallionMenu).toContain("medallion-menu__size");
    expect(medallionMenu).toContain("Smaller");
    expect(medallionMenu).toContain("Bigger");
    expect(medallionMenu).toContain("onSizeChange(size - 40)");
    expect(medallionMenu).toContain("onSizeChange(size + 40)");
  });
});

describe("the circle does not move", () => {
  it("the living portrait has no look-around and no wrapper motion CSS", () => {
    expect(livingPortrait).not.toContain("useLookAround");
    expect(livingPortrait).not.toContain("is-looking");
    expect(stageCss).not.toContain("is-looking-");
    expect(stageCss).not.toContain("living-face-breathe");
  });
});

describe("the chat box — movable and contained", () => {
  it("a genuine grab unanchors in place instead of refusing the drag", () => {
    expect(commandBox).not.toContain("if (anchored) return;");
    expect(commandBox).toContain("A GENUINE GRAB MOVES THE BOX");
    expect(commandBox).toContain("saveBoxAnchored(false)");
  });

  it("the rail is wide enough to hold Osiris inside the border", () => {
    const rail = ruleBody(styles, ".avatar-command-box__rail");
    expect(rail).toContain("width: 7.5rem");
  });
});
