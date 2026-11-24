import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE STAGE LAW ROUND (owner order 2026-11-24 ~01:45 CST, Parts A
 * and C — Part B and the phone bar's Part D are pinned in
 * command-box.test.tsx):
 *
 * Part A — BOOT IS QUIET: "On boot up, I see the scepter and I
 * still see Anubis pop up and say something then disappear."
 * This round first answered it with a presence gate (the
 * in-person delivery belonged to a report that arrived while he
 * was PRESENT). SUPERSEDED THE SAME DAY (~09:57 EST, voice
 * call): the Captain removed the pop-up ENTIRELY — "Stop having
 * that pop up. I don't want to see that anymore." Part A now
 * pins the removal: no pop-up, no scepter, no gate — because
 * nothing performs at all. A report's whole delivery is the
 * record (and its god's voice on the proactive path).
 *
 * Part C — TOOLS, CONTAINED: long action labels burst their
 * grid cells because the button's text span could not shrink.
 * The panel's containment is pinned at the stylesheet. (The CSS
 * sections are numbered 26–28: 23–25 are reserved by the phone
 * stage fix landing in the same file from a parallel line.)
 */
const stageSource = readFileSync(
  resolve(process.cwd(), "src/avatar/AvatarStage.tsx"),
  "utf8",
);
const stageCss = readFileSync(
  resolve(process.cwd(), "src/avatar/stage-fix-round.css"),
  "utf8",
);

describe("Part A — boot is quiet (the pop-up itself is REMOVED, 2026-11-24 ~09:57 EST)", () => {
  it("no presence gate exists — nothing is gated, because nothing performs", () => {
    expect(stageSource).not.toContain("presentRef");
    expect(stageSource).not.toContain("markPresent");
    const sendStart = stageSource.indexOf("const sendCommand = useCallback(");
    const sendHead = stageSource.slice(sendStart, sendStart + 900);
    expect(sendHead).not.toContain("presentRef");
  });

  it("notify keeps every report in the record — question-less, under its god's name", () => {
    const notifyStart = stageSource.indexOf("const notify = useCallback(");
    const notifyBody = stageSource.slice(
      notifyStart,
      stageSource.indexOf("}, []);", notifyStart),
    );
    expect(notifyBody).toContain("appendReplyHistory(prev, {");
    expect(notifyBody).toContain('question: "",');
    expect(notifyBody).toContain("speaker: ADDRESSEE_NAMES[reportingGod],");
  });

  it("notify raises NOTHING — no pop-up, no pop-in, at boot or any other time", () => {
    const notifyStart = stageSource.indexOf("const notify = useCallback(");
    const notifyBody = stageSource.slice(
      notifyStart,
      stageSource.indexOf("}, []);", notifyStart),
    );
    expect(notifyBody).not.toContain("setGodPopUp(");
    expect(notifyBody).not.toContain("setReportGod(");
    // The record write is the WHOLE delivery — nothing follows it.
    expect(notifyBody.indexOf("appendReplyHistory(prev, {")).toBeGreaterThan(-1);
  });

  it("no reply pop-up effect remains — a speaking line raises nothing on the stage", () => {
    expect(stageSource).not.toContain("lastResponsePopRef");
    expect(stageSource).not.toContain("notificationIdRef");
    expect(stageSource).not.toContain("setGodPopUp({");
  });

  it("no scepter driver and no pop-up state — boot has nothing to ambush with", () => {
    expect(stageSource).not.toContain("scepter={");
    expect(stageSource).not.toContain("useState<GodPopUpRequest | null>(null)");
    expect(stageSource).not.toContain("<GodReportPopUp");
  });
});

describe("Part C — Tools, contained", () => {
  it("action labels wrap inside their buttons — the span may shrink and break", () => {
    const ruleStart = stageCss.indexOf(".avatar-command-box__action > span {");
    expect(ruleStart).toBeGreaterThan(-1);
    const rule = stageCss.slice(ruleStart, stageCss.indexOf("}", ruleStart));
    expect(rule).toContain("min-width: 0");
    expect(rule).toContain("overflow-wrap: anywhere");
  });

  it("grid cells may shrink to the panel — buttons fill their cell at one height", () => {
    expect(stageCss).toContain(
      "grid-template-columns: repeat(auto-fill, minmax(min(6.5rem, 100%), 1fr));",
    );
    const ruleStart = stageCss.indexOf(
      ".avatar-command-box__grid .avatar-command-box__action {",
    );
    expect(ruleStart).toBeGreaterThan(-1);
    const rule = stageCss.slice(ruleStart, stageCss.indexOf("}", ruleStart));
    expect(rule).toContain("width: 100%");
    expect(rule).toContain("min-width: 0");
    expect(rule).toContain("min-height: 2.1rem");
  });

  it("the panel never scrolls sideways — overflow stays inside the box", () => {
    const ruleStart = stageCss.indexOf(".avatar-stage .avatar-command-box__panel {");
    expect(ruleStart).toBeGreaterThan(-1);
    const rule = stageCss.slice(ruleStart, stageCss.indexOf("}", ruleStart));
    expect(rule).toContain("overflow-x: hidden");
  });

  it("Part B geometry: an open section takes the full display, panel scrolling inside itself", () => {
    const mechStart = stageCss.indexOf(
      ".avatar-command-box--section-open .avatar-command-box__machinery {",
    );
    expect(mechStart).toBeGreaterThan(-1);
    const mech = stageCss.slice(mechStart, stageCss.indexOf("}", mechStart));
    expect(mech).toContain("flex: 1");
    expect(mech).toContain("max-height: none");
    const panelStart = stageCss.indexOf(
      ".avatar-command-box--section-open .avatar-command-box__panel {",
    );
    expect(panelStart).toBeGreaterThan(-1);
    const panel = stageCss.slice(panelStart, stageCss.indexOf("}", panelStart));
    expect(panel).toContain("flex: 1");
    expect(panel).toContain("max-height: none");
  });
});
