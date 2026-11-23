import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
import {
  POPUP_BLOCK_HEIGHT,
  POPUP_BLOCK_WIDTH,
  godForReportTopic,
  placePopUp,
  rectsOverlap,
  type StageRect,
} from "@/avatar/godPopUp";
import { GodReportPopUp } from "@/avatar/GodReportPopUp";

/**
 * THE ENVIRONMENT + ORDER ROUND (owner orders 2026-11-22, from his
 * live screen): the backdrop is the picture itself (no wash), the
 * floor covers when a color/picture is chosen (the grid defect
 * dies) — and then, his final word the same day, THE GRID ASPECT IS
 * REMOVED ENTIRELY: no grid floor choice, no grid lines in the
 * room; legacy grid layouts migrate to a solid color floor. Panels
 * are categories + subcategories, the gods pop up to report
 * without overlapping anyone, and the Connections area holds
 * honest open slots.
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

describe("the gods pop up — attribution and no-overlap placement", () => {
  it("defense reports come through Montu; the rest through Anubis in command", () => {
    expect(godForReportTopic("security")).toBe("montu");
    expect(godForReportTopic("defense check")).toBe("montu");
    expect(godForReportTopic("business")).toBe("anubis");
    expect(godForReportTopic("employees")).toBe("anubis");
  });

  it("places the pop-up clear of every avatar on an open stage", () => {
    const stage = { w: 1440, h: 900 };
    const occupied: StageRect[] = [
      { x: 520, y: 170, w: 400, h: 480 }, // the Captain at center
      { x: 636, y: 16, w: 168, h: 248 }, // Anubis top-center
      { x: 1180, y: 300, w: 156, h: 236 }, // Montu on the right flank
    ];
    const placed = placePopUp(stage, occupied);
    const block: StageRect = { x: placed.x, y: placed.y, w: POPUP_BLOCK_WIDTH, h: POPUP_BLOCK_HEIGHT };
    for (const rect of occupied) {
      expect(rectsOverlap(block, rect, 12)).toBe(false);
    }
    expect(placed.x).toBeGreaterThanOrEqual(0);
    expect(placed.y).toBeGreaterThanOrEqual(0);
    expect(placed.x + POPUP_BLOCK_WIDTH).toBeLessThanOrEqual(stage.w);
    expect(placed.y + POPUP_BLOCK_HEIGHT).toBeLessThanOrEqual(stage.h);
  });

  it("moves off a ground an avatar is standing on", () => {
    const stage = { w: 1440, h: 900 };
    // An avatar parked exactly where the first candidate ground is.
    const squatter: StageRect = {
      x: stage.w - POPUP_BLOCK_WIDTH - 16,
      y: stage.h - POPUP_BLOCK_HEIGHT - 120,
      w: POPUP_BLOCK_WIDTH,
      h: POPUP_BLOCK_HEIGHT,
    };
    const placed = placePopUp(stage, [squatter]);
    const block: StageRect = { x: placed.x, y: placed.y, w: POPUP_BLOCK_WIDTH, h: POPUP_BLOCK_HEIGHT };
    expect(rectsOverlap(block, squatter, 12)).toBe(false);
  });

  it("the bubble sits on the side away from the nearer edge, tail at the speaker", () => {
    const stage = { w: 1440, h: 900 };
    expect(placePopUp(stage, []).bubbleSide).toBe("left"); // lower-right ground: bubble left of the face
  });
});

describe("GodReportPopUp — he speaks his line, then he goes", () => {
  it("types the line slow, holds, and dismisses itself", () => {
    vi.useFakeTimers();
    try {
      const onDone = vi.fn();
      render(
        <GodReportPopUp
          request={{ id: 7, god: "anubis", text: "Done, Captain." }}
          stageSize={{ w: 1440, h: 900 }}
          occupiedRects={[]}
          onDone={onDone}
        />,
      );
      expect(screen.getByText("Anubis")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(25 * "Done, Captain.".length + 100);
      });
      expect(screen.getByText(/Done, Captain\./)).toBeInTheDocument();
      expect(onDone).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onDone).toHaveBeenCalledWith(7);
    } finally {
      vi.useRealTimers();
    }
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
