import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Eye } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backdropFitSize } from "@/avatar/builder/backdrops";
import { CommandBox } from "@/avatar/CommandBox";
import { ANUBIS_FEATURES, LivingPortrait } from "@/avatar/LivingPortrait";
import type { ReplyHistoryEntry } from "@/avatar/replyHistory";

/**
 * STAGE EYE-CHECK ROUND (owner, 2026-11-22 ~19:40 EST, from his
 * live screen and screenshot):
 * 1) the backdrop picture was a zoomed, cropped middle slice —
 *    it must be the WHOLE picture, centered, fit to the window;
 * 2) the little orange stretch arrow at Anubis's corner did
 *    nothing — a pointer-events casualty, repaired and pinned;
 * 4) a blink blurred the whole face briefly — the filter surfaces
 *    that re-rastered the portrait are gone, the lids repaint in
 *    their own layer;
 * 5) Osiris in the chat box: too small (a 3rem override had
 *    silently shrunk the ordered 76px) and on a white ground —
 *    bigger now, and his ground is black;
 * 6) the HUD readouts were dim blue over the picture — bright
 *    text on a dark backing now.
 * (Items 2's face-only medallions and 3's idle life have their
 * component pins in stage-fix-round / living-portrait tests; the
 * idle wrapper's behavior is pinned here too.)
 */

const stageCss = readFileSync(
  resolve(process.cwd(), "src/avatar/stage-fix-round.css"),
  "utf8",
);
const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const renderer = readFileSync(
  resolve(process.cwd(), "src/avatar/worldSceneRenderer.ts"),
  "utf8",
);

function ruleBody(css: string, selector: string, fromIndex = 0): string {
  const start = css.indexOf(selector, fromIndex);
  expect(start, `selector ${selector}`).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open, close);
}

describe("the backdrop fit — the whole picture, centered", () => {
  it("contain fit: a wide picture fits inside the window with nothing cropped", () => {
    // The Sphinx banner (474×197) in a 16:9-ish window: width
    // rules, the height lands inside — the whole picture visible.
    const size = backdropFitSize({ width: 474, height: 197 }, 18.5, 10.4);
    expect(size.w).toBeCloseTo(18.5, 5);
    expect(size.h).toBeLessThanOrEqual(10.4);
    expect(size.w / size.h).toBeCloseTo(474 / 197, 5);
  });

  it("contain fit: a square picture stands at the window's full height, uncropped", () => {
    const size = backdropFitSize({ width: 474, height: 474 }, 18.5, 10.4);
    expect(size.h).toBeCloseTo(10.4, 5);
    expect(size.w).toBeCloseTo(10.4, 5);
  });

  it("contain fit never exceeds the window on either axis", () => {
    for (const image of [
      { width: 1600, height: 1200 },
      { width: 474, height: 632 },
      { width: 474, height: 197 },
      { width: 672, height: 384 },
    ]) {
      const size = backdropFitSize(image, 18.5, 10.4);
      expect(size.w).toBeLessThanOrEqual(18.5 + 1e-9);
      expect(size.h).toBeLessThanOrEqual(10.4 + 1e-9);
      // And it is as big as whole-picture framing allows: one axis
      // always meets the window.
      expect(Math.abs(size.w - 18.5) < 1e-9 || Math.abs(size.h - 10.4) < 1e-9).toBe(true);
    }
  });

  it("the renderer contain-fits the backdrop and centers it in the window", () => {
    expect(renderer).toContain("backdropFitSize(backdrop, viewW, viewH)");
    expect(renderer).toContain("plane.position.set(0, viewH / 2, -10.6)");
    // The old cover-bleed factor that zoomed the picture is gone.
    expect(renderer).not.toContain("viewAspect * 1.8");
  });
});

describe("the stretch handle — repaired", () => {
  it("the handle re-enables its own pointer events and sits at the face's corner", () => {
    const body = ruleBody(stageCss, ".avatar-stage .medallion-anchor__stretch");
    expect(body).toContain("pointer-events: auto");
    expect(body).toContain("bottom: -6px");
    expect(body).toContain("width: 28px");
  });

  it("the selectable god medallions take presses at stage specificity", () => {
    const body = ruleBody(stageCss, ".avatar-stage .anubis-presence--selectable");
    expect(body).toContain("pointer-events: auto");
  });

  it("the window grip is a real target now, not a sliver", () => {
    const body = ruleBody(styles, ".floating-window__grip");
    expect(body).toContain("width: 1.5rem");
    expect(body).toContain("touch-action: none");
  });
});

describe("the blink cannot blur the face", () => {
  it("no filter rides the Black Hatter's medallion — stepped-back is opacity alone", () => {
    const body = ruleBody(styles, ".black-hatter-presence--stepped-back");
    expect(body).not.toContain("filter:");
    expect(body).toContain("opacity: 0.82");
  });

  it("the speaking pulse animates transform only — no brightness filter on the portrait", () => {
    const start = styles.indexOf("@keyframes anubis-speak");
    expect(start).toBeGreaterThan(-1);
    const raw = styles.slice(start, styles.indexOf("}", styles.indexOf("}", start) + 1) + 1);
    // Declarations only — the rule's own comment may name what was
    // removed; the pin is that no filter declaration remains.
    const block = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(block).not.toContain("filter");
    expect(block).toContain("transform: scale(1.025)");
  });

  it("each lid repaints in its own layer", () => {
    const body = ruleBody(stageCss, ".avatar-stage .living-face__lid {");
    expect(body).toContain("will-change: transform");
    expect(body).toContain("contain: paint");
  });
});

describe("Osiris in the panel — bigger, on black", () => {
  it("the full-box size is 104px — the old 3rem shrink is gone from the cascade", () => {
    const bodies: string[] = [];
    let from = 0;
    for (;;) {
      const start = styles.indexOf(".avatar-command-box .augie-presence {", from);
      if (start === -1) break;
      const open = styles.indexOf("{", start);
      bodies.push(styles.slice(open, styles.indexOf("}", open)));
      from = start + 1;
    }
    // One of the cascade's rules carries the new full-box size, the
    // phone rule carries 84px, and NO rule shrinks him to 3rem or
    // 2.5rem anymore (the silent override his eye-check caught).
    expect(bodies.some((body) => body.includes("width: 104px"))).toBe(true);
    expect(bodies.some((body) => body.includes("width: 84px"))).toBe(true);
    expect(bodies.some((body) => body.includes("width: 3rem"))).toBe(false);
    expect(bodies.some((body) => body.includes("width: 2.5rem"))).toBe(false);
  });

  it("his frame's ground is black", () => {
    const body = ruleBody(styles, ".augie-presence {");
    expect(body).toContain("background: #000");
  });
});

describe("the HUD readouts — bright", () => {
  it("bright text on a dark backing, and the top-left column at full strength", () => {
    const body = ruleBody(stageCss, ".avatar-stage div.avatar-hud");
    expect(body).toContain("color: #eef4ff");
    expect(body).toContain("background: rgb(3 6 14 / 62%)");
    const tl = ruleBody(stageCss, ".avatar-stage .avatar-hud--tl");
    expect(tl).toContain("opacity: 1");
  });
});

describe("idle life — the face looks around", () => {  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("portrait, lids, and mouth ride inside one living-face wrapper", () => {
    const { container } = render(
      <LivingPortrait
        src="/anubis-presence/face.webp"
        features={ANUBIS_FEATURES}
        speaking={false}
        imgClassName="anubis-presence__img"
      />,
    );
    const face = container.querySelector('[data-testid="living-face"]');
    expect(face).not.toBeNull();
    expect(face!.querySelector('[data-testid="living-lid-left"]')).not.toBeNull();
    expect(face!.querySelector('[data-testid="living-mouth"]')).not.toBeNull();
    expect(face!.querySelector("img.living-face__portrait")).not.toBeNull();
  });

  it("every several seconds the head turns to look to one side, then returns", () => {
    const { container } = render(
      <LivingPortrait
        src="/anubis-presence/face.webp"
        features={ANUBIS_FEATURES}
        speaking={false}
        imgClassName="anubis-presence__img"
      />,
    );
    const face = () => container.querySelector('[data-testid="living-face"]')!;
    expect(face().className).not.toContain("is-looking-");
    let sawLook = false;
    // The first look lands 8–16s in and holds 1.5–2.2s; step
    // through 30 seconds of stage time and catch it mid-hold.
    for (let i = 0; i < 60 && !sawLook; i += 1) {
      act(() => {
        vi.advanceTimersByTime(500);
      });
      if (/is-looking-(left|right)/.test(face().className)) sawLook = true;
    }
    expect(sawLook).toBe(true);
  });
});

/**
 * TERMINAL CHAT + NOTHING POPS UP (owner orders 2026-11-22
 * ~19:53 EST): Clear clears the SCREEN and only the screen — the
 * record lives in History, dates and times, untouched; emojis
 * insert into the message from a picker in the input bar; and
 * AUGI's construct box starts CLOSED on entry, always.
 */
describe("terminal chat — clear, history, emoji", () => {
  const entry = (at: number, question: string, answer: string): ReplyHistoryEntry => ({
    at,
    question,
    answer,
  });

  function renderChat(over: Partial<Parameters<typeof CommandBox>[0]> = {}) {
    const props = {
      accent: "#d4af37",
      tabs: [{ id: "scene" as const, label: "Scene", icon: Eye }],
      activeTab: "scene" as const,
      onTabChange: vi.fn(),
      chat: "",
      onChatChange: vi.fn(),
      onSubmit: vi.fn(),
      voiceAvailable: false,
      voiceListening: false,
      onToggleVoice: vi.fn(),
      responseLine: "",
      responseSource: "",
      children: <p>panel body</p>,
      ...over,
    };
    return render(<CommandBox {...props} />);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it("Clear wipes the screen — and the record itself is untouched", () => {
    const history = [
      entry(1, "First question", "First answer."),
      entry(2, "Second question", "Second answer."),
    ];
    const { container, rerender } = renderChat({ history });
    expect(container.textContent).toContain("First answer.");
    expect(container.textContent).toContain("Second answer.");
    fireEvent.click(screen.getByRole("button", { name: "Clear the chat screen" }));
    // The screen is clear: no history lines remain in the thread.
    expect(container.textContent).not.toContain("First answer.");
    expect(container.textContent).not.toContain("Second answer.");
    // The record was NOT deleted: the same history handed back in
    // (as the History view reads it) still exists — and a line
    // arriving after the Clear starts the new screen.
    rerender(
      <CommandBox
        accent="#d4af37"
        tabs={[{ id: "scene", label: "Scene", icon: Eye }]}
        activeTab="scene"
        onTabChange={vi.fn()}
        chat=""
        onChatChange={vi.fn()}
        onSubmit={vi.fn()}
        voiceAvailable={false}
        voiceListening={false}
        onToggleVoice={vi.fn()}
        responseLine=""
        responseSource=""
        history={[...history, entry(3, "Third question", "Third answer.")]}
      >
        <p>panel body</p>
      </CommandBox>,
    );
    expect(container.textContent).not.toContain("First answer.");
    expect(container.textContent).toContain("Third answer.");
  });

  it("the History button opens the record", () => {
    const onOpenHistory = vi.fn();
    renderChat({ history: [entry(1, "Q", "A.")], onOpenHistory });
    fireEvent.click(screen.getByRole("button", { name: "Open the chat history" }));
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it("the emoji picker inserts the picked emoji into the message at the caret", () => {
    const onChatChange = vi.fn();
    renderChat({ chat: "Well done ", onChatChange });
    fireEvent.click(screen.getByRole("button", { name: "Add an emoji" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert 👍" }));
    expect(onChatChange).toHaveBeenCalledWith("Well done 👍");
  });
});

describe("nothing pops up on entry", () => {
  it("AUGI's construct box starts closed — useState(false), never persisted open", () => {
    const stage = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
    expect(stage).toContain("const [constructOpen, setConstructOpen] = useState(false);");
    expect(stage).not.toContain("const [constructOpen, setConstructOpen] = useState(true);");
  });
});

describe("the response model — Anubis pops up and talks (owner order 2026-11-22 ~20:02 EST)", () => {  it("a speaking reply raises the Anubis pop-up, keyed on the SPEAKING state", () => {
    const stage = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
    // The pop-up keys on the speaking state and the line itself,
    // delivered through the same GodReportPopUp the reports use.
    expect(stage).toContain('if (state !== "SPEAKING") return;');
    expect(stage).toContain(
      'setGodPopUp({ id: notificationIdRef.current, god: "anubis", text: lastWords });',
    );
    // Room status and idle musings do not pop — replies do.
    expect(stage).toContain('responseSource === "idle life"');
  });
});

describe("Anubis stays fixed in his place (owner order 2026-11-22 ~20:06 EST)", () => {
  it("no presentation transform displaces him — council and perspective leave his seat as-is", () => {
    const council = ruleBody(stageCss, ".avatar-stage .anubis-presence.medallion-anchor--in-council");
    expect(council).toContain("transform: none");
    const perspective = ruleBody(
      stageCss,
      ".avatar-stage .anubis-presence--in-perspective .anubis-presence__face",
    );
    expect(perspective).toContain("transform: none");
  });

  it("a summon never writes Anubis's geometry — only the summoned god's own spot", () => {
    const stage = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
    // The one geometry write on the summon path sits behind the
    // not-Anubis guard; Anubis is loaded as an obstacle to clear,
    // never as the piece being placed.
    expect(stage).toContain('if (god !== "anubis") {');
    expect(stage).toContain("saveMedallionGeometry(god, spot);");
    expect(stage).not.toContain('saveMedallionGeometry("anubis"');
  });
});

describe("god presence — call and council (owner order 2026-11-22 ~20:09 EST)", () => {
  it("a god addressed alone comes up BIG — the call scale, presentation only", () => {
    const call = ruleBody(stageCss, ".avatar-stage .montu-presence.medallion-anchor--in-call");
    expect(call).toContain("transform: scale(1.4)");
    // The Captain never scales for a call, and Anubis never scales at all.
    expect(stageCss).not.toContain(".black-hatter-presence.medallion-anchor--in-call");
    expect(stageCss).not.toContain(".anubis-presence.medallion-anchor--in-call");
  });

  it("a council seats the called god beside Anubis — his seat is written, Anubis's never is", () => {
    const stage = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
    expect(stage).toContain("const seatBesideAnubis = useCallback(");
    expect(stage).toContain('seatBesideAnubis(god === "anubis" ? perspective : god);');
    expect(stage).toContain("saveMedallionGeometry(god, seat);");
    // Anubis is the anchor the seat is measured from — read-only.
    expect(stage).toContain('const anubis = loadOrDefaultMedallionGeometry("anubis", stageW, stageH);');
  });
});

/**
 * NO EMPTY GAPS (owner law 2026-11-22 ~19:25 CST, "get that fixed
 * right away"): he opened PULSE on his phone — content at the top,
 * a big dead gap filling the bottom of the box. The cause: the
 * window carried a fixed pixel height (500, persisted) unrelated
 * to its content, the body stretched to it, and the panel's
 * height:100% column stacked everything at the top. Now the Pulse
 * window (and the Reply history this round wires open) fits its
 * content, and the panel spreads its readouts when he stretches
 * the frame himself.
 */
describe("no empty gaps — Pulse sizes to its content (item 13)", () => {
  const floating = readFileSync(
    resolve(process.cwd(), "src/avatar/windows/FloatingWindow.tsx"),
    "utf8",
  );
  const pulse = readFileSync(resolve(process.cwd(), "src/avatar/PulseWindow.tsx"), "utf8");
  const historyWin = readFileSync(
    resolve(process.cwd(), "src/avatar/ReplyHistoryWindow.tsx"),
    "utf8",
  );

  it("the window shell offers fit-content height — no fixed height, viewport cap", () => {
    expect(floating).toContain("fitContentHeight = false");
    expect(floating).toContain('maxHeight: "calc(100dvh - 16px)"');
  });

  it("Pulse and the Reply history open fit-content", () => {
    expect(pulse).toContain("fitContentHeight");
    expect(historyWin).toContain("fitContentHeight");
  });

  it("the panel no longer forces height:100% — it sizes to content and spreads on stretch", () => {
    const body = ruleBody(styles, ".window-pulse {").replace(/\/\*[\s\S]*?\*\//g, "");
    // No standalone height declaration remains (min-height is the
    // deliberate fill, not the old forced stretch).
    expect(body).not.toContain("  height: 100%;");
    expect(body).toContain("min-height: 100%;");
    const panes = ruleBody(styles, ".window-pulse__panes {");
    expect(panes).toContain("flex: 1");
  });
});

describe("the voice indicator — mounted on the stage's own ear", () => {
  it("AvatarStage mounts VoiceIndicator with the stage ear and the addressed god", () => {
    const stage = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
    expect(stage).toContain('import { VoiceIndicator } from "./VoiceIndicator";');
    expect(stage).toContain("ear={earRef.current}");
    // Anubis by default; Montu when Montu holds the perspective.
    expect(stage).toContain(
      'addressee={perspective === "montu" ? MONTU_BINDING.name : ANUBIS_BINDING.name}',
    );
  });
});
