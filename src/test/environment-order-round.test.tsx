import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BACKDROP_IMAGE_OPACITY } from "@/avatar/builder/backdrops";
import { BuilderPanel, type BuilderPanelProps } from "@/avatar/builder/BuilderPanel";
import {
  DEFAULT_SURFACES,
  defaultLayoutStore,
  emptyRoom,
  sanitizeSurfaces,
  standingFloorImage,
} from "@/avatar/builder/room";
import { CategorySection } from "@/avatar/CategorySection";
import {
  CONNECTION_CATEGORIES,
  CONNECTION_SLOTS,
  slotStateLine,
} from "@/avatar/connections";
import { godForReportTopic } from "@/avatar/godPopUp";

/**
 * THE ENVIRONMENT + ORDER ROUND (owner orders 2026-11-22, from his
 * live screen): the backdrop is the picture itself (no wash), the
 * floor covers when a color/picture is chosen (the grid defect
 * dies) — and then, his final word the same day, THE GRID ASPECT IS
 * REMOVED ENTIRELY: no grid floor choice, no grid lines in the
 * room; legacy grid layouts migrate to a solid color floor. Panels
 * are categories + subcategories, a god's report is signed by its
 * god in the record (the pop-up presentation was removed
 * 2026-11-24), and the Connections area holds honest open slots.
 */

describe("the backdrop is the picture itself", () => {
  it("renders at full strength — the veil wash cannot come back", () => {
    expect(BACKDROP_IMAGE_OPACITY).toBe(1);
  });
});

describe("the floor — no grid, ever (owner decision: remove the grid entirely)", () => {
  it("there is no grid floor: the shipped default is a solid color floor", () => {
    expect(DEFAULT_SURFACES.floorStyle).toBe("color");
    const anyStyle: string = DEFAULT_SURFACES.floorStyle;
    expect(anyStyle).not.toBe("grid");
  });

  it("a color floor and a picture floor are chosen explicitly, never by tint alone", () => {
    const colored = sanitizeSurfaces({ floor: "#224466", floorStyle: "color" });
    expect(colored.floorStyle).toBe("color");
    const pictured = sanitizeSurfaces({ floorStyle: "picture", floorImage: "map-matrix" });
    expect(pictured.floorStyle).toBe("picture");
    expect(standingFloorImage(pictured)).toBe("map-matrix");
  });

  it("a picture style with no picture falls back to the solid color — never a hole in the floor", () => {
    const broken = sanitizeSurfaces({ floorStyle: "picture", floorImage: "not-his-picture" });
    expect(broken.floorStyle).toBe("color");
    expect(broken.floorImage).toBeNull();
    expect(standingFloorImage(broken)).toBeNull();
  });

  it("MIGRATION: a layout saved with the grid floor loads as a solid color in its saved tint", () => {
    const saved = sanitizeSurfaces({ floor: "#2a4a7a", floorStyle: "grid" });
    expect(saved.floorStyle).toBe("color");
    expect(saved.floor).toBe("#2a4a7a");
    expect(saved.floorImage).toBeNull();
  });

  it("a layout saved before the floor choice existed loads as a solid color floor", () => {
    const legacy = sanitizeSurfaces({ backdrop: "#101018", floor: "#2a4a7a", wall: "#3a3f4a" });
    expect(legacy.floorStyle).toBe("color");
    expect(legacy.floor).toBe("#2a4a7a");
    expect(legacy.floorImage).toBeNull();
  });
});

function panelProps(overrides: Partial<BuilderPanelProps> = {}): BuilderPanelProps {
  const room = emptyRoom();
  const layouts = { ...defaultLayoutStore(), layouts: [{ id: "default", name: "The Room — default", room }] };
  return {
    room,
    layouts,
    selectedId: null,
    onPlace: vi.fn(),
    onSelectItem: vi.fn(),
    onVariant: vi.fn(),
    onRotate: vi.fn(),
    onToggleAnchor: vi.fn(),
    onRemove: vi.fn(),
    onSurfaces: vi.fn(),
    onSwitchLayout: vi.fn(),
    onNewLayout: vi.fn(),
    onRenameLayout: vi.fn(),
    onDeleteLayout: vi.fn(),
    onResetDefaultLayout: vi.fn(),
    onExport: vi.fn(() => "{}"),
    onImport: vi.fn(() => "ok"),
    frames: {},
    framesArmed: false,
    onToggleFramesArmed: vi.fn(),
    onResetFrame: vi.fn(),
    onResetAllFrames: vi.fn(),
    ...overrides,
  };
}

describe("the builder is categories + subcategories", () => {
  it("names its categories, with the library split into subcategories", () => {
    render(<BuilderPanel {...panelProps()} />);
    for (const title of ["Pieces for the room", "The piece you picked", "The room itself"]) {
      expect(screen.getByRole("button", { name: new RegExp(title, "i") })).toBeInTheDocument();
    }
    for (const sub of ["Buildings", "Nature", "Park & street", "Backdrop", "Floor", "Walls"]) {
      expect(screen.getByText(sub)).toBeInTheDocument();
    }
  });

  it("a closed category keeps its contents out until he opens it", () => {
    render(<BuilderPanel {...panelProps()} />);
    expect(screen.queryByRole("button", { name: /Export this room/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Saved layouts/i }));
    expect(screen.getByRole("button", { name: /Export this room/ })).toBeInTheDocument();
  });

  it("the floor kind is a choice: solid color covers, picture covers — and no grid kind exists", () => {
    const props = panelProps();
    render(<BuilderPanel {...props} />);
    expect(screen.queryByRole("button", { name: "Grid floor" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Solid color" }));
    expect(props.onSurfaces).toHaveBeenCalledWith(
      expect.objectContaining({ floorStyle: "color" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Picture floor" }));
    expect(props.onSurfaces).toHaveBeenCalledWith(
      expect.objectContaining({ floorStyle: "picture" }),
    );
  });

  it("picking a floor picture sets the picture floor in one act", () => {
    const props = panelProps({
      room: {
        ...emptyRoom(),
        surfaces: { ...DEFAULT_SURFACES, floorStyle: "picture", floorImage: null },
      },
    });
    render(<BuilderPanel {...props} />);
    // The same pictures are offered for the backdrop and for the floor —
    // scope to the floor picker by its label.
    const floorPicker = screen.getByText("Floor picture — Egyptian themes").parentElement as HTMLElement;
    fireEvent.click(within(floorPicker).getByRole("button", { name: /The Sphinx at sunset/ }));
    expect(props.onSurfaces).toHaveBeenCalledWith(
      expect.objectContaining({ floorStyle: "picture", floorImage: "egypt-sphinx-sunset" }),
    );
  });
});

describe("CategorySection — the organization standard", () => {
  it("opens and closes on its head, plainly", () => {
    render(
      <CategorySection title="Records" defaultOpen={false}>
        <p>inside the category</p>
      </CategorySection>,
    );
    expect(screen.queryByText("inside the category")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Records/ }));
    expect(screen.getByText("inside the category")).toBeInTheDocument();
  });
});

describe("report attribution — and the pop-up's removal", () => {
  it("defense reports are signed by Montu; the rest by Anubis in command", () => {
    expect(godForReportTopic("security")).toBe("montu");
    expect(godForReportTopic("defense check")).toBe("montu");
    expect(godForReportTopic("business")).toBe("anubis");
    expect(godForReportTopic("employees")).toBe("anubis");
  });

  it("the placement machinery is deleted with the pop-up (removal 2026-11-24) — nothing can render a report on the stage", () => {
    const godPopUpSource = readFileSync(resolve(process.cwd(), "src/avatar/godPopUp.ts"), "utf8");
    expect(godPopUpSource).not.toContain("placePopUp");
    expect(godPopUpSource).not.toContain("StageRect");
    const stageSource = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
    expect(stageSource).not.toContain("<GodReportPopUp");
  });
});

describe("Connections — the universal slots registry", () => {
  it("every slot is labeled, explained, categorized, and named on the server side", () => {
    const envNames = new Set<string>();
    for (const slot of CONNECTION_SLOTS) {
      expect(slot.label.length).toBeGreaterThan(0);
      expect(slot.purpose.length).toBeGreaterThan(10);
      expect(CONNECTION_CATEGORIES).toContain(slot.category);
      expect(slot.envName).toMatch(/^[A-Z0-9_]+$/);
      expect(envNames.has(slot.envName)).toBe(false);
      envNames.add(slot.envName);
    }
    // The brains he already uses are slots with live consumers.
    const groq = CONNECTION_SLOTS.find((slot) => slot.id === "groq");
    expect(groq?.consumer).toBeTruthy();
    expect(groq?.envName).toBe("GROQ_API_KEY");
  });

  it("an open slot reads honestly — what it waits for, never a fake connected", () => {
    const weather = CONNECTION_SLOTS.find((slot) => slot.id === "weather")!;
    const openLine = slotStateLine(weather, false);
    expect(openLine).toMatch(/^Open — nothing connected here yet\./);
    expect(openLine).toContain("waits for");
    const groq = CONNECTION_SLOTS.find((slot) => slot.id === "groq")!;
    expect(slotStateLine(groq, true)).toMatch(/^Connected — /);
    expect(slotStateLine(groq, false)).toMatch(/^Open — /);
  });
});
