import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConstructControls } from "@/avatar/ConstructControls";

/**
 * The construct's anchor/control law, stated on the stage: anchored
 * AUGI is free to work; unanchored he is held for fixing and cannot
 * be driven; while the Captain drives, the state says so.
 */
describe("ConstructControls", () => {
  it("anchored and free: both toggles live, states named plainly", () => {
    const onToggleAnchor = vi.fn();
    const onToggleControl = vi.fn();
    render(
      <ConstructControls
        anchored
        captainDriving={false}
        onToggleAnchor={onToggleAnchor}
        onToggleControl={onToggleControl}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /ANCHORED — FREE TO WORK/ }));
    expect(onToggleAnchor).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /CONTROL · AUGI FREE/ }));
    expect(onToggleControl).toHaveBeenCalledTimes(1);
  });

  it("unanchored: held for fixing, and the drive control is disabled", () => {
    render(
      <ConstructControls
        anchored={false}
        captainDriving={false}
        onToggleAnchor={() => {}}
        onToggleControl={() => {}}
      />,
    );
    expect(screen.getByText(/UNANCHORED — HELD FOR FIXING/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CONTROL · AUGI FREE/ })).toBeDisabled();
  });

  it("captain driving says who has the keys", () => {
    render(
      <ConstructControls
        anchored
        captainDriving
        onToggleAnchor={() => {}}
        onToggleControl={() => {}}
      />,
    );
    expect(screen.getByText(/CAPTAIN DRIVING — WASD \+ SPACE/)).toBeInTheDocument();
  });
});
