import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BuilderPanel, type BuilderPanelProps } from "@/avatar/builder/BuilderPanel";
import { MapPanel } from "@/avatar/builder/MapPanel";
import {
  addItem,
  defaultLayoutStore,
  emptyRoom,
  makePlacedItem,
} from "@/avatar/builder/room";

/**
 * THE BUILDER + MAP PANELS (owner order 2026-11-22): the panel
 * prints the library's honest count math, places pieces through
 * its callbacks, dresses the room (surfaces + his backdrop
 * pictures), manages layouts and frames; the map resolves real
 * places to real readouts and refuses — in words — what it cannot
 * resolve.
 */
function panelProps(overrides: Partial<BuilderPanelProps> = {}): BuilderPanelProps {
  const item = makePlacedItem("piece-1", "store", { form: "flat", size: "medium", color: "brick" }, 1, -1);
  const room = addItem(emptyRoom(), item);
  const layouts = { ...defaultLayoutStore(), layouts: [{ id: "default", name: "The Room — default", room }] };
  return {
    room,
    layouts,
    selectedId: "piece-1",
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

describe("BuilderPanel", () => {
  it("prints the honest variant math and offers every base piece", () => {
    render(<BuilderPanel {...panelProps()} />);
    expect(screen.getByText(/2,376 placeable variants/)).toBeInTheDocument();
    expect(screen.getByText(/26 base pieces/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a Store to the room" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a Pine tree to the room" })).toBeInTheDocument();
  });

  it("the Add button places through the callback", () => {
    const props = panelProps();
    render(<BuilderPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a Store to the room" }));
    expect(props.onPlace).toHaveBeenCalledWith("store");
  });

  it("the selected piece shows its controls — form, anchor, remove", () => {
    const props = panelProps();
    render(<BuilderPanel {...props} />);
    expect(screen.getByLabelText("Form")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Anchor/ }));
    expect(props.onToggleAnchor).toHaveBeenCalledWith("piece-1", true);
    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    expect(props.onRemove).toHaveBeenCalledWith("piece-1");
  });

  it("his backdrop pictures are offered by name, both sets", () => {
    render(<BuilderPanel {...panelProps()} />);
    expect(screen.getByRole("button", { name: /Pyramids under the planets/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /World map — countries/ })).toBeInTheDocument();
  });

  it("the frames list names every frame, and the chat panel reads as its own mover", () => {
    render(<BuilderPanel {...panelProps()} />);
    expect(screen.getByText("Anubis medallion")).toBeInTheDocument();
    expect(screen.getByText("Black Hatter medallion")).toBeInTheDocument();
    expect(screen.getByText("Command box (chat)")).toBeInTheDocument();
    expect(screen.getByText("its own mover")).toBeInTheDocument();
  });
});

describe("MapPanel", () => {
  it("shows a named place with its true readout and a marker", () => {
    const { container } = render(<MapPanel />);
    fireEvent.change(screen.getByLabelText(/Place to show on the map/), {
      target: { value: "Mobile" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show it" }));
    expect(screen.getByText("Mobile, Alabama")).toBeInTheDocument();
    expect(screen.getByText("30.6944° N, 88.0431° W")).toBeInTheDocument();
    const marker = container.querySelector(".map-panel__marker") as HTMLElement;
    expect(marker).not.toBeNull();
    // Equirectangular: lon -88.0431 → 25.54%, lat 30.6944 → 32.95%.
    expect(parseFloat(marker.style.left)).toBeCloseTo(25.5436, 3);
    expect(parseFloat(marker.style.top)).toBeCloseTo(32.9476, 3);
    // A plain place carries no magnitude line in its readout.
    expect(container.querySelector(".map-panel__magnitude")).toBeNull();
  });

  it("an earthquake entry carries its magnitude — and only those do", () => {
    render(<MapPanel />);
    fireEvent.change(screen.getByLabelText(/Place to show on the map/), {
      target: { value: "2010 Haiti earthquake" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show it" }));
    expect(screen.getByText("Magnitude 7.0")).toBeInTheDocument();
    expect(screen.getByText("18.4400° N, 72.5700° W")).toBeInTheDocument();
  });

  it("an unknown place is refused in words — nothing invented, no marker", () => {
    const { container } = render(<MapPanel />);
    fireEvent.change(screen.getByLabelText(/Place to show on the map/), {
      target: { value: "Atlantis" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show it" }));
    expect(screen.getByText(/not in the gazetteer/)).toBeInTheDocument();
    expect(container.querySelector(".map-panel__marker")).toBeNull();
  });
});
