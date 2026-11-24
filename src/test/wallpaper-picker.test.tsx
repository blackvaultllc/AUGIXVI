import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WallpaperPicker } from "@/avatar/WallpaperPicker";
import { BACKDROPS } from "@/avatar/builder/backdrops";

/**
 * CHANGE WALLPAPER, FINDABLE (owner order 2026-11-24 ~17:26 EST):
 * he went looking in the menu for where to change the wallpaper
 * and could not find it. Now the stage's menu (the chat window's
 * Scene tab, its first group) carries a plainly labeled "Change
 * wallpaper" entry; tapping it opens this picker — his existing
 * stage pictures, the cascade set — and tapping a picture sets
 * the wallpaper immediately. These pins hold the label, the
 * picker's contents, and the immediate-apply wiring.
 *
 * THE EGYPTIAN DRESS (same order): the Captain's chat window
 * wears gold trim on a deep blue-black frame — pinned at the
 * stylesheet (section 33), since jsdom has no layout.
 */

const stageSource = readFileSync(
  resolve(process.cwd(), "src/avatar/AvatarStage.tsx"),
  "utf8",
);
const fixCss = readFileSync(
  resolve(process.cwd(), "src/avatar/stage-fix-round.css"),
  "utf8",
);

describe("the menu's Change wallpaper entry", () => {
  it("the stage's menu carries the exact label, wired to the picker", () => {
    expect(stageSource).toContain('label="Change wallpaper"');
    expect(stageSource).toContain("<WallpaperPicker");
    expect(stageSource).toContain("setWallpaperPickerOpen");
  });

  it("picking applies at once and syncs — the pickWallpaper path", () => {
    // The pick goes through applyBackdropPick (the room follows
    // immediately) and persistSettings with the synced flag (his
    // other devices follow), the builder pick's own road.
    expect(stageSource).toContain("const pickWallpaper = useCallback(");
    expect(stageSource).toContain("applyBackdropPick(image, fit)");
    expect(stageSource).toContain("backdropSynced: true");
  });
});

/** A tile's full accessible name: the picture's name, plus " · set" when set. */
const tileName = (name: string) =>
  new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( · set)?$`);

describe("the wallpaper picker", () => {
  // 22 picture tiles + 23 role queries: under full-suite load
  // this render can outrun the default 5s (flake proven green on
  // re-run 2026-11-24) — it carries its own clock.
  it("shows every one of his stage pictures by name, plus No picture", { timeout: 20_000 }, () => {
    render(<WallpaperPicker picked={null} onPick={vi.fn()} />);
    for (const asset of BACKDROPS) {
      expect(screen.getByRole("button", { name: tileName(asset.name) })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /No picture/ })).toBeInTheDocument();
  });

  it("the set picture is marked, and only it", () => {
    const first = BACKDROPS[0]!;
    render(<WallpaperPicker picked={first.id} onPick={vi.fn()} />);
    expect(screen.getByRole("button", { name: tileName(first.name) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /No picture/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("tapping a picture picks it — that tap IS the apply", () => {
    const onPick = vi.fn();
    render(<WallpaperPicker picked={null} onPick={onPick} />);
    const target = BACKDROPS[BACKDROPS.length - 1]!;
    fireEvent.click(screen.getByRole("button", { name: tileName(target.name) }));
    expect(onPick).toHaveBeenCalledWith(target.id);
    fireEvent.click(screen.getByRole("button", { name: /No picture/ }));
    expect(onPick).toHaveBeenCalledWith(null);
  });
});

describe("the Captain's window — Egyptian dress", () => {
  it("section 33 dresses the frame in gold on deep blue-black", () => {
    expect(fixCss).toContain("33) THE CAPTAIN'S WINDOW");
    const start = fixCss.indexOf(".avatar-stage .avatar-command-box {", fixCss.indexOf("33)"));
    expect(start).toBeGreaterThan(-1);
    const body = fixCss.slice(start, fixCss.indexOf("}", start));
    expect(body).toContain("border: 1px solid rgb(216 178 90");
    expect(body).toContain("linear-gradient(180deg, rgb(14 18 38");
  });

  it("the send key wears gold, and the field's focus ring is gold", () => {
    // Read §33's own rules — earlier sections dress the send key
    // in the comic style; the Egyptian finish stands in §33.
    const section33 = fixCss.slice(fixCss.indexOf("33)"));
    const sendStart = section33.indexOf(".avatar-stage .avatar-command-box__send {");
    expect(sendStart).toBeGreaterThan(-1);
    const sendBody = section33.slice(sendStart, section33.indexOf("}", sendStart));
    expect(sendBody).toContain("#e8c766");
    const focusStart = section33.indexOf(".avatar-stage .avatar-command-box__input:focus {");
    const focusBody = section33.slice(focusStart, section33.indexOf("}", focusStart));
    expect(focusBody).toContain("rgb(216 178 90");
  });

  it("the wallpaper picker is dressed in section 34", () => {
    expect(fixCss).toContain("34) THE WALLPAPER PICKER");
    expect(fixCss).toContain(".wallpaper-picker__tile.is-picked");
  });
});
