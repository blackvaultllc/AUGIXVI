import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvatarBridge } from "@/avatar/AvatarBridge";
import { GodReportPopUp } from "@/avatar/GodReportPopUp";
import {
  CAPABILITY_LINES,
  CAPABILITY_LINES_SHORT,
  capabilitiesBrief,
} from "@/avatar/capabilities";
import { MANUAL_CATEGORIES } from "@/avatar/manualContent";
import { attachOllamaAI } from "@/avatar/ollamaAI";

const stageCss = readFileSync(
  resolve(process.cwd(), "src/avatar/stage-fix-round.css"),
  "utf8",
);
const baseCss = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const stageSource = readFileSync(
  resolve(process.cwd(), "src/avatar/AvatarStage.tsx"),
  "utf8",
);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("DEFECT 1 — a god's report is his medallion + the comic box, never a corner card", () => {
  it("renders ONE unit: circular medallion, comic box beside it, name tag INSIDE the box", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <GodReportPopUp
          request={{ id: 1, god: "montu", text: "Report: business steady." }}
          stageSize={{ w: 1200, h: 800 }}
          occupiedRects={[]}
          onDone={() => undefined}
        />,
      );
    });
    const popUp = container.querySelector(".god-popup");
    expect(popUp).not.toBeNull();
    // The medallion circle is part of the unit…
    const face = container.querySelector(".god-popup__face");
    expect(face).not.toBeNull();
    expect(popUp!.contains(face)).toBe(true);
    // …and the comic box sits in the SAME unit, carrying the name
    // tag inside it (the comic-book standard) — not a plate drawn
    // on the circle (the clean-circle law).
    const bubble = container.querySelector(".god-popup__bubble");
    expect(bubble).not.toBeNull();
    expect(popUp!.contains(bubble)).toBe(true);
    const tag = container.querySelector(".god-popup__tag");
    expect(tag).not.toBeNull();
    expect(bubble!.contains(tag)).toBe(true);
    expect(tag!.textContent).toBe("Montu");
    expect(container.querySelector(".god-popup__name")).toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  it("the medallion wears the gold-ring medallion dress; the box wears the comic tag", () => {
    const faceStart = baseCss.indexOf(".god-popup__face {");
    const face = baseCss.slice(faceStart, baseCss.indexOf("}", faceStart));
    expect(face).toContain("border-radius: 50%");
    expect(face).toContain("#d4af37");
    expect(baseCss).toContain(".god-popup__tag");
  });

  it("notify() delivers through the pop-up ONLY — no card stack is fed anywhere", () => {
    const notifyStart = stageSource.indexOf("const notify = useCallback(");
    const notifyBody = stageSource.slice(notifyStart, stageSource.indexOf("}, []);", notifyStart));
    expect(notifyBody).toContain("setGodPopUp(");
    expect(notifyBody).not.toContain("setNotifications");
    expect(stageSource).not.toContain("<StageNotifications");
  });
});

describe("DEFECT 2 — the CORE box keeps its measure; the Activity line wraps", () => {
  it("both top clusters carry the desktop width cap", () => {
    const capStart = stageCss.indexOf("22. THE CORE BOX KEEPS ITS MEASURE");
    expect(capStart).toBeGreaterThan(-1);
    // Section 22 is the file's last section — slice to the end.
    const cap = stageCss.slice(capStart);
    expect(cap).toContain("@media (min-width: 701px)");
    expect(cap).toContain(".avatar-stage .avatar-hud--tl");
    expect(cap).toContain(".avatar-stage .avatar-hud--tr");
    expect(cap).toContain("max-width: min(34rem, calc(100vw - 3rem))");
  });

  it("the long single lines wrap instead of stretching their panel", () => {
    // Slice inside section 22 — the same selectors carry earlier
    // rules elsewhere in the file (type, spacing).
    const section = stageCss.slice(stageCss.indexOf("22. THE CORE BOX KEEPS ITS MEASURE"));
    const activityStart = section.indexOf(".avatar-stage .avatar-hud__activity {");
    const activity = section.slice(activityStart, section.indexOf("}", activityStart));
    expect(activity).toContain("overflow-wrap: break-word");
    const warningStart = section.indexOf(".avatar-stage .avatar-hud__warning {");
    const warning = section.slice(warningStart, section.indexOf("}", warningStart));
    expect(warning).toContain("overflow-wrap: break-word");
    // The bifocal floor stands: the cap section never shrinks the type.
    const section22 = stageCss.slice(stageCss.indexOf("22. THE CORE BOX KEEPS ITS MEASURE"));
    expect(section22).not.toContain("font-size");
  });
});

describe("DEFECT 3a — the capability brief is true, and stays true with the manual", () => {
  it("states the camera's real reach — look, move, hear, analyze; never speak", () => {
    const brief = capabilitiesBrief();
    expect(brief).toContain("Agagmoss v1");
    expect(brief).toContain("CANNOT speak through");
  });

  it("states Wepwawet exactly: built and byte-verified, NOT yet proven live", () => {
    const brief = capabilitiesBrief();
    expect(brief).toContain("byte-verified");
    expect(brief).toContain("NOT been fired");
    expect(brief).toContain("not yet proven live");
    expect(capabilitiesBrief("short")).toContain("NOT yet proven live");
  });

  it("every brief line mirrors a Master Manual entry that still exists", () => {
    const manualIds = new Set(
      MANUAL_CATEGORIES.flatMap((category) => category.entries.map((entry) => entry.id)),
    );
    for (const line of [...CAPABILITY_LINES, ...CAPABILITY_LINES_SHORT]) {
      expect(manualIds.has(line.manualId), `manual entry ${line.manualId}`).toBe(true);
    }
    // And the manual carries the entry that teaches the law itself.
    expect(manualIds.has("gods-capabilities")).toBe(true);
  });

  it("the brief rides the local brain's system content, ahead of the speaker directive", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: "At your service." } }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const brief = capabilitiesBrief();
    const ai = attachOllamaAI(new AvatarBridge(), {
      voice: { speak: vi.fn(), stop: vi.fn() },
      getCapabilitiesBrief: () => brief,
      getSpeakerDirective: () => "You are speaking as Anubis",
    });
    await ai.handleText("Can you access the camera?");
    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: { role: string; content: string }[];
    };
    const system = request.messages[0]?.content ?? "";
    expect(system).toContain("WHAT YOU CAN ACCESS AND DO");
    expect(system.indexOf("Agagmoss v1")).toBeGreaterThan(-1);
    // The directive stays LAST (routing law) — the brief rides before it.
    expect(system.indexOf("WHAT YOU CAN ACCESS AND DO")).toBeLessThan(
      system.indexOf("You are speaking as Anubis"),
    );
    expect(system.trimEnd().endsWith("You are speaking as Anubis")).toBe(true);
    ai.dispose();
  });
});

describe("DEFECT 3b — no silent deaths; the speak path carries replies", () => {
  it("an EMPTY brain reply becomes a spoken, recorded failure line — never a vanish", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: "" } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onSpeak = vi.fn();
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const ai = attachOllamaAI(new AvatarBridge(), { voice, onSpeak });
    const answer = await ai.handleText("Can you access the AI dog?");
    expect(answer).not.toBe("");
    expect(answer.length).toBeGreaterThan(10);
    // Spoken (voice on) AND reported to the interface (the thread
    // record rides onSpeak) — the question got an answer.
    expect(voice.speak).toHaveBeenCalledWith(answer, expect.any(Function));
    expect(onSpeak).toHaveBeenCalledWith(answer);
    ai.dispose();
  });

  it("a real reply is spoken through the voice provider when voice is on", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ message: { content: "Yes — the camera is live, Captain." } }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const bridge = new AvatarBridge();
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const ai = attachOllamaAI(bridge, { voice });
    const answer = await ai.handleText("Can you access the camera?");
    expect(answer).toBe("Yes — the camera is live, Captain.");
    expect(voice.speak).toHaveBeenCalledWith(answer, expect.any(Function));
    expect(bridge.state).toBe("SPEAKING");
    ai.dispose();
  });

  it("a repeated unknown question offline gets the still-offline line — the old code returned silence", async () => {
    vi.useFakeTimers();
    // The brain is down: every fetch rejects, so every question
    // lands in the offline path.
    const fetchMock = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.stubGlobal("fetch", fetchMock);
    const onSpeak = vi.fn();
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const ai = attachOllamaAI(new AvatarBridge(), { voice, onSpeak });

    const first = await ai.handleText("What is the airspeed of a swallow?");
    expect(first).toContain("I am offline");
    // Past the anti-spam cooldown: the unknown-answer line speaks.
    await vi.advanceTimersByTimeAsync(31_000);
    const second = await ai.handleText("What is the airspeed of a swallow?");
    expect(second).toContain("do not have that in saved memory");
    // Past the cooldown again: the SAME line would repeat — the
    // anti-loop law still holds (never the same line twice), but
    // where the old code returned "" and the question vanished,
    // the still-offline line is spoken and returned instead.
    await vi.advanceTimersByTimeAsync(31_000);
    const third = await ai.handleText("What is the airspeed of a swallow?");
    expect(third).toBe(
      "Still offline, Captain — and that one is not in my saved memory either.",
    );
    expect(voice.speak).toHaveBeenCalledTimes(3);
    expect(onSpeak).toHaveBeenCalledTimes(3);
    ai.dispose();
  });

  it("when muted, the voice stays silent but the reply still reaches the thread record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: "Standing by." } }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onSpeak = vi.fn();
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const ai = attachOllamaAI(new AvatarBridge(), { voice, onSpeak });
    ai.setMuted(true);
    const answer = await ai.handleText("Report.");
    expect(answer).toBe("Standing by.");
    expect(voice.speak).not.toHaveBeenCalled();
    expect(onSpeak).toHaveBeenCalledWith("Standing by.");
    ai.dispose();
  });
});
