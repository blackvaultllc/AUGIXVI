import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaptainsOfficeView } from "@/avatar/CaptainsOffice";
import type { OfficeKnock } from "@/avatar/captainsOffice";

/**
 * CAPTAIN ZERO'S OFFICE — the room (owner order 2026-11-27
 * ~22:28 CST). The pins that matter: the room is quiet and
 * plain (his Matrix Wall, the law in one line, no one
 * knocking); a knock names the god, marks the emergency,
 * gives the real reason, and only ASKS — admit opens the
 * god's door, dismiss answers "not now"; Khadija's ringing
 * call rides its own line, never dressed as a knock; and
 * on the stage the privacy gate stands in code — while the
 * Office stands, no god pop-up renders.
 */
const MONTU_KNOCK: OfficeKnock = {
  god: "montu",
  godName: "Montu",
  reason: "Sector Watch: one security event is waiting, not yet acknowledged.",
  signature: "montu|sector=1",
};

function renderOffice(overrides: Partial<Parameters<typeof CaptainsOfficeView>[0]> = {}) {
  const props = {
    knocks: [] as OfficeKnock[],
    daddyRinging: false,
    onAdmit: vi.fn(),
    onDismiss: vi.fn(),
    onTalkToAnubis: vi.fn(),
    onGoToCall: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<CaptainsOfficeView {...props} />) };
}

describe("Captain Zero's Office — the room", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("stands quiet over his Matrix Wall: the plate, the law, no one knocking", () => {
    const { container } = renderOffice();
    expect(container.querySelector(".matrix-wall")).not.toBeNull();
    expect(screen.getByText("Captain Zero’s Office")).toBeTruthy();
    expect(screen.getByText(/you are left alone/)).toBeTruthy();
    expect(screen.getByText(/Only an emergency knocks, and a knock only asks/)).toBeTruthy();
    expect(screen.getByText("No one is knocking. The room is yours.")).toBeTruthy();
  });

  it("leaves by the Leave pill and reaches Anubis by his button", () => {
    const { props } = renderOffice();
    fireEvent.click(screen.getByRole("button", { name: "Leave the Office — back to the stage" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Talk to Anubis" }));
    expect(props.onTalkToAnubis).toHaveBeenCalledTimes(1);
  });

  it("a knock names the god, marks the emergency, gives the reason — and only asks", () => {
    const { props } = renderOffice({ knocks: [MONTU_KNOCK] });
    expect(screen.getByText("Montu is at the door.")).toBeTruthy();
    expect(screen.getByText(/Emergency — he asks to speak with you/)).toBeTruthy();
    expect(screen.getByText(/Sector Watch: one security event/)).toBeTruthy();
    expect(screen.queryByText("No one is knocking. The room is yours.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Let Montu in" }));
    expect(props.onAdmit).toHaveBeenCalledWith(MONTU_KNOCK);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(props.onDismiss).toHaveBeenCalledWith(MONTU_KNOCK);
  });

  it("Khadija's ringing call rides its own line — never a knock, never gated", () => {
    const { props } = renderOffice({ daddyRinging: true });
    expect(screen.getByText("Khadija is calling.")).toBeTruthy();
    expect(screen.queryByText(/is at the door/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Go to her call" }));
    expect(props.onGoToCall).toHaveBeenCalledTimes(1);
  });
});

describe("Captain Zero's Office — the stage wiring (source pins)", () => {
  const stage = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
  const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

  it("the privacy gate stands on every god pop-up render", () => {
    expect(stage).toContain("!captainsOfficeOpen && montuPop.shown");
    expect(stage).toContain("!captainsOfficeOpen && helperPop.shown");
    expect(stage).toContain("!captainsOfficeOpen && councilOsirisPop.shown");
    const councilMontu = stage.slice(
      stage.indexOf("councilMontuPop.shown") - 120,
      stage.indexOf("councilMontuPop.shown"),
    );
    expect(councilMontu).toContain("!captainsOfficeOpen");
  });

  it("his door stands in the Tools grid and the room renders from his state", () => {
    expect(stage).toContain('label="Captain Zero\'s Office"');
    expect(stage).toContain("setCaptainsOfficeOpen(true)");
    expect(stage).toContain("<CaptainsOfficeView");
    expect(stage).toContain("knocks={officeKnockList}");
    expect(stage).toContain("officeKnocks(alertReading)");
  });

  it("the room's dress stands in the sheet, on the hexo view's layer", () => {
    const block = styles.slice(styles.indexOf(".captains-office {"), styles.indexOf(".captains-office__leave"));
    expect(block).toContain("z-index: 70");
    expect(styles).toContain(".captains-office__knock");
    expect(styles).toContain(".captains-office__call");
  });
});
