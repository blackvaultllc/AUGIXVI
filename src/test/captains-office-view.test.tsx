import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CaptainsOfficeView } from "@/avatar/CaptainsOffice";
import type { OfficeKnock } from "@/avatar/captainsOffice";

/**
 * CAPTAIN ZERO'S OFFICE — the room itself (owner order
 * 2026-11-27 ~22:28 CST, refined ~23:07 CST): his Matrix
 * Wall stands as the ground, the room is quiet, and the
 * privacy is real in the stage (the pop-up gate is pinned in
 * stage-eyecheck-round / the stage source pins below). The
 * knock arrives AS A NOTIFICATION — "[God] would like to
 * speak with you" — and clicking it lets the god INTO the
 * Office: the room does not close; the god stands in it (his
 * panel), the conversation opens inside the room (the
 * stage's half: the chat, addressed to that god, layered
 * over the Office's ground), and ending the visit sends him
 * back while the Captain stays. Khadija's line is NOT a
 * knock: while her call rings, the room carries it plainly
 * with the way to her call.
 */
const stageSource = readFileSync(
  resolve(process.cwd(), "src/avatar/AvatarStage.tsx"),
  "utf8",
);
const stylesCss = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

const KNOCK: OfficeKnock = {
  god: "montu",
  godName: "Montu",
  reason: "Sector Watch is holding one security event that has not been opened",
  signature: "montu:sector:1:sound:0",
};

function renderOffice(partial: Partial<Parameters<typeof CaptainsOfficeView>[0]> = {}) {
  const props = {
    knocks: [] as OfficeKnock[],
    guest: null as OfficeKnock | null,
    daddyRinging: false,
    onAdmit: vi.fn(),
    onDismiss: vi.fn(),
    onGuestLeave: vi.fn(),
    onTalkToAnubis: vi.fn(),
    onGoToCall: vi.fn(),
    onClose: vi.fn(),
    ...partial,
  };
  render(<CaptainsOfficeView {...props} />);
  return props;
}

describe("the room", () => {
  it("stands on his Matrix Wall, with the plate and the law in one line", () => {
    renderOffice();
    expect(screen.getByText("Captain Zero’s Office")).toBeInTheDocument();
    expect(screen.getByText(/no god stands, no report calls out/)).toBeInTheDocument();
  });

  it("quiet: no knock, no call — the room is his, and Talk to Anubis stands", () => {
    const props = renderOffice();
    expect(screen.getByText("No one is knocking. The room is yours.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Talk to Anubis" }));
    expect(props.onTalkToAnubis).toHaveBeenCalledTimes(1);
  });

  it("the Leave pill closes the room", () => {
    const props = renderOffice();
    fireEvent.click(
      screen.getByRole("button", { name: /Leave the Office — back to the stage/ }),
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe("the knock — a notification, and the god comes IN", () => {
  it("stands as a notification: the god's name, the ask, the emergency, the real reason", () => {
    renderOffice({ knocks: [KNOCK] });
    expect(screen.getByText("Montu would like to speak with you.")).toBeInTheDocument();
    expect(screen.getByText("Emergency — he asks to come in.")).toBeInTheDocument();
    expect(screen.getByText(KNOCK.reason)).toBeInTheDocument();
    expect(screen.queryByText("No one is knocking. The room is yours.")).toBeNull();
  });

  it("letting him in hands the knock to the stage — the room itself never closes here", () => {
    const props = renderOffice({ knocks: [KNOCK] });
    fireEvent.click(screen.getByRole("button", { name: "Let Montu in" }));
    expect(props.onAdmit).toHaveBeenCalledWith(KNOCK);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("'Not now' dismisses the knock", () => {
    const props = renderOffice({ knocks: [KNOCK] });
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(props.onDismiss).toHaveBeenCalledWith(KNOCK);
  });
});

describe("the guest — the god stands IN the Office", () => {
  it("his panel stands: he is here, what he came about, and the way to send him back", () => {
    const props = renderOffice({ guest: KNOCK, knocks: [KNOCK] });
    expect(screen.getByText("Montu is in your office.")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`He came about: ${KNOCK.reason}`))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "End — send Montu back" }));
    expect(props.onGuestLeave).toHaveBeenCalledTimes(1);
  });

  it("while a guest stands, the door cards and Talk to Anubis wait — one conversation at a time", () => {
    const other: OfficeKnock = { ...KNOCK, signature: "montu:sector:2:sound:0" };
    renderOffice({ guest: KNOCK, knocks: [KNOCK, other] });
    expect(screen.queryByRole("button", { name: "Let Montu in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Talk to Anubis" })).toBeNull();
    expect(screen.getByText(/Another knock waits at the door/)).toBeInTheDocument();
  });

  it("the guest's own standing alert does not read as another knock waiting", () => {
    renderOffice({ guest: KNOCK, knocks: [KNOCK] });
    expect(screen.queryByText(/Another knock waits at the door/)).toBeNull();
  });
});

describe("Khadija's line — never a knock", () => {
  it("while her call rings, the room carries it plainly, with the way to her call", () => {
    const props = renderOffice({ daddyRinging: true });
    expect(screen.getByText("Khadija is calling.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to her call" }));
    expect(props.onGoToCall).toHaveBeenCalledTimes(1);
  });

  it("her line stands even while a god is in the room — it is not gated like a knock", () => {
    renderOffice({ daddyRinging: true, guest: KNOCK, knocks: [KNOCK] });
    expect(screen.getByText("Khadija is calling.")).toBeInTheDocument();
    expect(screen.getByText("Montu is in your office.")).toBeInTheDocument();
  });
});

describe("the stage wiring — the privacy gate and the guest, in the stage's own code", () => {
  it("while the Office stands, the god pop-ups do not render at all — every call site gated", () => {
    const renderIdx = [...stageSource.matchAll(/<CalledGodPopUp/g)].map((m) => m.index);
    expect(renderIdx.length).toBeGreaterThan(0);
    for (const idx of renderIdx) {
      // Each pop-up's render condition carries the Office gate.
      const before = stageSource.slice(Math.max(0, idx - 260), idx);
      expect(before).toContain("!captainsOfficeOpen");
    }
  });

  it("a standing knock is carried into the record as a notification, under the god's own name", () => {
    expect(stageSource).toContain("officeKnockNotification(knock)");
    expect(stageSource).toContain('notify("office knock"');
  });

  it("admitting a god brings him INTO the Office — the room stays open, the chat opens inside it", () => {
    expect(stageSource).toContain("setOfficeGuest(knock)");
    expect(stageSource).toContain("avatar-stage--office-guest");
    // The conversation layers over the Office's ground while a guest stands.
    expect(stylesCss).toContain(".avatar-stage--office-guest .avatar-command-box");
  });

  it("sending the god back keeps the Captain in his Office", () => {
    const leaveAt = stageSource.indexOf("onGuestLeave");
    const leaveEnd = stageSource.indexOf("onTalkToAnubis", leaveAt);
    const leaveBlock = stageSource.slice(leaveAt, leaveEnd);
    expect(leaveBlock).toContain("setOfficeGuest(null)");
    expect(leaveBlock).not.toContain("setCaptainsOfficeOpen(false)");
  });
});
