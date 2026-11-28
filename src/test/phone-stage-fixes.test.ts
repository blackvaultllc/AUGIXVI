import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  backdropById,
  DEFAULT_BACKDROP_IMAGE_ID,
  DEFAULT_FLOOR_IMAGE_ID,
} from "@/avatar/builder/backdrops";
import { DEFAULT_SURFACES, startingSurfaces, type RoomSurfaces } from "@/avatar/builder/room";

/**
 * THE PHONE STAGE FIXES (owner orders 2026-11-26, from his
 * phone): three defects he hit using the app —
 * 1. tapping the chat input ZOOMED the screen in and it would
 *    not come back out;
 * 2. he could not find where to add a background — so two of
 *    his own shipped pictures are SET FOR HIM, top and bottom;
 * 3. (the blue-out lives in circuit-ring-round.test.tsx.)
 * These tests pin the first two at their sources.
 */

const appCss = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const fixCss = readFileSync(resolve(process.cwd(), "src/avatar/stage-fix-round.css"), "utf8");
const rootSource = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
const stageSource = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");

describe("the keyboard zoom — dead at the source", () => {
  it("touch devices carry every text field at 16px or better", () => {
    const section = appCss.slice(appCss.indexOf("TOUCH INPUTS NEVER ZOOM THE SCREEN"));
    expect(section).toContain("@media (pointer: coarse)");
    expect(section).toContain("font-size: 16px !important");
    expect(section).toContain("textarea");
    expect(section).toContain("select");
    // Non-text controls are not text entry — they keep their dress.
    expect(section).toContain('[type="checkbox"]');
    expect(section).toContain('[type="range"]');
  });

  it("the viewport was already right — and no scale lock was added over it", () => {
    expect(rootSource).toContain('content: "width=device-width, initial-scale=1"');
    expect(rootSource).not.toContain("maximum-scale");
    expect(rootSource).not.toContain("user-scalable");
  });

  it("the chat dock law survives — the fix is a font floor, not a layout change", () => {
    // The compact dock's own numbers are untouched by this round:
    // the input's dressed sizes still stand in their own rules
    // for non-touch pointers.
    expect(appCss).toContain(".avatar-command-box__input");
  });
});

describe("the starting pictures — set for him, top and bottom", () => {
  it("names two real pictures from his own shipped registry", () => {
    const top = backdropById(DEFAULT_BACKDROP_IMAGE_ID);
    const bottom = backdropById(DEFAULT_FLOOR_IMAGE_ID);
    expect(top).not.toBeNull();
    expect(bottom).not.toBeNull();
    expect(top!.id).not.toBe(bottom!.id);
    expect(top!.set).toBe("egyptian");
    expect(bottom!.set).toBe("egyptian");
  });

  it("lays both pictures on a room no one has ever dressed", () => {
    const next = startingSurfaces({ ...DEFAULT_SURFACES });
    expect(next.backdropImage).toBe(DEFAULT_BACKDROP_IMAGE_ID);
    expect(next.floorStyle).toBe("picture");
    expect(next.floorImage).toBe(DEFAULT_FLOOR_IMAGE_ID);
    // Nothing else about the factory room moves.
    expect(next.backdrop).toBe(DEFAULT_SURFACES.backdrop);
    expect(next.wall).toBe(DEFAULT_SURFACES.wall);
    expect(next.backdropFit).toBe(DEFAULT_SURFACES.backdropFit);
  });

  it("never touches a pick he made — wall, floor, or either", () => {
    const dressed: RoomSurfaces = {
      ...DEFAULT_SURFACES,
      backdropImage: "egypt-throne",
      floor: "#1d4d2b",
      floorStyle: "color",
      floorImage: null,
    };
    expect(startingSurfaces(dressed)).toBe(dressed);
    const floored: RoomSurfaces = {
      ...DEFAULT_SURFACES,
      backdropImage: null,
      floorStyle: "picture",
      floorImage: "map-vintage",
    };
    const next = startingSurfaces(floored);
    expect(next.backdropImage).toBe(DEFAULT_BACKDROP_IMAGE_ID);
    expect(next.floorImage).toBe("map-vintage");
  });

  it("is idempotent — a room already wearing the defaults comes back as itself", () => {
    const once = startingSurfaces({ ...DEFAULT_SURFACES });
    expect(startingSurfaces(once)).toBe(once);
  });

  it("the stage lays them at boot only when no pick has ever synced", () => {
    expect(stageSource).toContain("startingSurfaces(room.surfaces)");
    expect(stageSource).toContain("if (saved.backdropSynced)");
  });
});

describe("the top bar — three symbols at the top-right (owner order 2026-11-27 ~23:03 CST, pass 7)", () => {
  // SUPERSEDES the left rail of 2026-11-26: the NOTIFICATIONS and
  // SETTINGS word pills and the STATUS word tab are gone. One row
  // of three small symbols stands at the top-right — bell, status
  // pulse, menu cog — and the drop-down he called brilliant is the
  // MENU now, carrying the command box's sections as categories.
  const passCss = readFileSync(resolve(process.cwd(), "src/avatar/phone-fix-pass.css"), "utf8");

  it("the bar stands at the top-right and carries the three symbols", () => {
    expect(stageSource).toContain("stage-top-bar");
    expect(stageSource).not.toContain("stage-left-rail");
    const bar = passCss.slice(passCss.indexOf(".stage-top-bar {"), passCss.indexOf(".stage-top-bar {") + 300);
    expect(bar).toContain("right: 0.75rem");
    expect(bar).toContain("flex-direction: row");
    // The bell: the badge's class, in symbol form, with the red
    // dot as its indication — no word, no count pill.
    expect(stageSource).toContain("notifications-stage-badge stage-top-bar__button");
    expect(stageSource).toContain("stage-top-bar__dot");
    expect(stageSource).not.toContain("notifications-stage-badge__count");
    // The status symbol keeps the tab's class and panel wiring.
    expect(stageSource).toContain("avatar-status-tab stage-top-bar__button");
    // The cog opens the menu.
    expect(stageSource).toContain("stage-quick-menu__button stage-top-bar__button");
    expect(stageSource).toContain('aria-label="Menu"');
  });

  it("the menu: folding categories, one-line rows, one height — and the sections as categories", () => {
    expect(stageSource).toContain("stage-quick-menu__button");
    expect(stageSource).toContain("quickMenuGroups");
    expect(stageSource).toContain("quickMenuSections");
    expect(stageSource).toContain("Change wallpaper");
    expect(appCss).toContain(".stage-quick-menu__panel");
    expect(appCss).toContain("height: 2.5rem");
    expect(appCss).toContain("text-overflow: ellipsis");
    // The menu's doors are the tools' own openers.
    expect(stageSource).toContain("setCamerasOpen(true)");
    expect(stageSource).toContain("setVaultOpen(true)");
    // The sections stand in the menu with their full content —
    // the Captain Zero's Office door among them, first in Tools.
    expect(stageSource).toContain("quickMenuSections");
    expect(stageSource).toContain("Captain Zero's Office");
    expect(stageSource).toContain("CommandsDocument");
  });

  it("STATUS is a small symbol in the bar — its panel keeps its top-right home", () => {
    const tab = fixCss.slice(fixCss.indexOf(".avatar-status-tab {"), fixCss.indexOf(".avatar-status-tab {") + 300);
    expect(tab).toContain("right: 1.5rem");
    // Inside the bar the tab stands at the small measure (pass 7).
    const barTab = passCss.slice(
      passCss.indexOf(".stage-top-bar .avatar-status-tab {"),
      passCss.indexOf(".stage-top-bar .avatar-status-tab {") + 400,
    );
    expect(barTab).toContain("position: static");
    expect(barTab).toContain("width: 2.3rem");
  });

  it("Osiris's called medallion docks at the top-left — the corner the rail vacated", () => {
    const medallion = fixCss.slice(
      fixCss.indexOf(".avatar-stage .osiris-medallion {"),
      fixCss.indexOf(".avatar-stage .osiris-medallion {") + 600,
    );
    expect(medallion).toContain("top: 5.75rem");
    expect(medallion).toContain("left: 1rem");
  });
});

describe("the install identity — IEM, the emblem, gold (owner order 2026-11-26)", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/manifest.webmanifest"), "utf8"),
  ) as {
    name: string;
    short_name: string;
    description: string;
    theme_color: string;
    background_color: string;
    icons: { src: string; sizes: string }[];
  };

  it("the installed name is IEM — Augie is the spoken name, not the install name", () => {
    expect(manifest.name).toBe("IEM");
    expect(manifest.short_name).toBe("IEM");
    expect(manifest.description).not.toContain("Augie");
    expect(rootSource).toContain('{ name: "apple-mobile-web-app-title", content: "IEM" }');
    expect(rootSource).toContain('{ title: "IEM" }');
  });

  it("the theme color is gold family — the blue is out of the install surface too", () => {
    expect(manifest.theme_color).toBe("#d4af37");
    expect(manifest.background_color).toBe("#0d0b06");
    expect(rootSource).toContain('{ name: "theme-color", content: "#d4af37" }');
    expect(rootSource).not.toContain("#0a0e1a");
  });

  it("the install icons are the emblem files, at the sizes the manifest promises", () => {
    expect(manifest.icons.map((icon) => icon.src)).toEqual([
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/maskable-512.png",
    ]);
    expect(rootSource).toContain('{ rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" }');
    expect(rootSource).toContain('{ rel: "icon", href: "/favicon.ico", type: "image/x-icon" }');
  });

  it("the backend brand rides the operator's status panel — emblem + licensing line", () => {
    expect(stageSource).toContain("avatar-hud__brand");
    expect(stageSource).toContain('src="/icons/icon-192.png"');
    expect(stageSource).toContain("software-as-a-service (SaaS) product of I-E-M");
    expect(stageSource).toContain("licensed for use — not sold");
    expect(fixCss).toContain(".avatar-hud__brand-emblem");
  });
});
