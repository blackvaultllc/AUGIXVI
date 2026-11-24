import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render } from "@testing-library/react";
import { Eye } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandBox } from "@/avatar/CommandBox";

/**
 * BUILDER UX + STAGE LAYERING + LOGIN FLASH (owner orders
 * 2026-11-24): (A) entering the environment builder folds the
 * chat box to the bar so the stage is clear to build on, leaving
 * restores it; (B) the sand-code AUGI renders nowhere on the
 * main stage by default and never flashes at login — invisible
 * at renderer creation, before the first frame; (C) placed
 * pieces move by mouse AND touch — the stage canvas keeps touch
 * gestures for the drag, and the builder's Help line states the
 * whole flow.
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Section A — the stage can fold the chat box (builder needs the stage clear)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("CommandBox hands working minimize/restore controls to the stage", () => {
    let controls: { minimize: () => void; restore: () => void } | null = null;
    const { container } = render(
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
        responseLine="Standing by."
        responseSource="test"
        onMinimizeShortcut={(handed) => {
          controls = handed;
        }}
      >
        <p>panel body</p>
      </CommandBox>,
    );
    expect(controls).not.toBeNull();
    const box = container.querySelector(".avatar-command-box");
    expect(box?.classList.contains("avatar-command-box--minimized")).toBe(false);
    act(() => controls!.minimize());
    expect(box?.classList.contains("avatar-command-box--minimized")).toBe(true);
    act(() => controls!.restore());
    expect(box?.classList.contains("avatar-command-box--minimized")).toBe(false);
  });

  it("AvatarStage folds on builderOpen and restores on leave, through the shortcut", () => {
    const stage = read("src/avatar/AvatarStage.tsx");
    expect(stage).toContain("onMinimizeShortcut={holdChatBoxControls}");
    expect(stage).toContain("chatBoxControlsRef.current?.minimize()");
    expect(stage).toContain("chatBoxControlsRef.current?.restore()");
    // The restore is guarded: only a fold the stage itself made
    // is undone (builderFoldedChatRef), so the Captain's own
    // fold/open is never fought.
    expect(stage).toContain("builderFoldedChatRef");
  });

  it("CommandBox wires the long-dead onMinimizeShortcut prop to its fold state", () => {
    const box = read("src/avatar/CommandBox.tsx");
    expect(box).toContain(
      "onMinimizeShortcut?.({ minimize: minimizeNow, restore: restoreNow })",
    );
  });
});

describe("Section B — no flash, and nowhere on the main stage by default", () => {
  it("the renderer creates the construct invisible — before the first frame can render", () => {
    const renderer = read("src/avatar/AvatarRenderer.ts");
    const added = renderer.indexOf("this.scene.add(this.figureAnchor);");
    const hidden = renderer.indexOf("this.figureAnchor.visible = false;");
    expect(added).toBeGreaterThan(-1);
    expect(hidden).toBeGreaterThan(added);
  });

  it("the stage's renderer init no longer raises him outside the live Room", () => {
    const stage = read("src/avatar/AvatarStage.tsx");
    expect(stage).not.toContain('setConstructVisible(worldScreenRef.current !== "live")');
    expect(stage).toContain("r.setConstructVisible(false);");
  });
});

describe("Section B(1) — placed pieces move by mouse and touch, and the Help line says how", () => {
  it("the stage canvas keeps touch gestures for the drag (touch-action: none)", () => {
    const css = read("src/styles.css");
    const ruleStart = css.indexOf(".avatar-construct-host canvas {");
    expect(ruleStart).toBeGreaterThan(-1);
    const rule = css.slice(ruleStart, css.indexOf("}", ruleStart));
    expect(rule).toContain("touch-action: none");
  });

  it("the builder's Help line states the full move flow — pick, drag, set down, anchor", () => {
    const panel = read("src/avatar/builder/BuilderPanel.tsx");
    expect(panel).toContain("To move a piece: 1. Tap the piece standing in the room to pick it.");
    expect(panel).toContain("Drag it across");
    expect(panel).toContain("Let go to set it down.");
    expect(panel).toContain("Anchor on the piece's own controls to lock it there");
  });
});
