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
 * The proactive engine polls the moment it starts, so a report
 * raised in the first seconds of a load performed itself at
 * boot. The law: the in-person delivery (pop-up + the scepter it
 * raises) belongs to a report that arrives while he is PRESENT
 * — presence earned by his hand, never assumed at load — and a
 * report raised before that waits in the record instead.
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

describe("Part A — boot is quiet", () => {
  it("presence is tracked from his hand — a press or a key — never assumed at load", () => {
    expect(stageSource).toContain("const presentRef = useRef(false);");
    expect(stageSource).toContain('window.addEventListener("pointerdown", markPresent);');
    expect(stageSource).toContain('window.addEventListener("keydown", markPresent);');
    // A command sent is presence itself.
    const sendStart = stageSource.indexOf("const sendCommand = useCallback(");
    const sendHead = stageSource.slice(sendStart, sendStart + 900);
    expect(sendHead).toContain("presentRef.current = true;");
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

  it("notify raises the pop-up ONLY when he is present — the boot ambush is dead", () => {
    const notifyStart = stageSource.indexOf("const notify = useCallback(");
    const notifyBody = stageSource.slice(
      notifyStart,
      stageSource.indexOf("}, []);", notifyStart),
    );
    const gate = notifyBody.indexOf("if (!presentRef.current) return;");
    const raise = notifyBody.indexOf("setGodPopUp(");
    expect(gate).toBeGreaterThan(-1);
    expect(raise).toBeGreaterThan(gate);
    // The record write stands BEFORE the gate: a report raised
    // while he is away is kept, not dropped.
    expect(notifyBody.indexOf("appendReplyHistory(prev, {")).toBeLessThan(gate);
  });

  it("the reply pop-up is presence-gated too — nothing performs at an empty room", () => {
    const effectStart = stageSource.indexOf('if (state !== "SPEAKING") return;');
    const effectHead = stageSource.slice(effectStart, effectStart + 700);
    expect(effectHead).toContain("if (!presentRef.current) return;");
  });

  it("the scepter still answers ONLY to a live pop-up — no pop-up at boot, no scepter at boot", () => {
    expect(stageSource).toContain('scepter={godPopUp?.god === "anubis"}');
    // The pop-up's initial state is empty; nothing seeds it.
    expect(stageSource).toContain("useState<GodPopUpRequest | null>(null)");
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
