import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpaceView } from "@/avatar/SpaceView";

describe("one world, one Earth, one flight", () => {
  it("supports a Montu-guarded landing view with an interactive sign-in overlay", () => {
    render(
      <SpaceView isLanding isEnteringLiveMode={false} isReturningToSpace={false}>
        <section aria-label="Operator sign-in">Sign in</section>
      </SpaceView>,
    );

    expect(screen.getByRole("main", { name: "Operator sign-in landing view" })).toBeInTheDocument();
    // THE LOGIN GUARDIAN IS MONTU (owner order 2026-11-24 ~10:00 EST,
    // superseding the Earth on the front intro): no spinning Earth
    // on the landing surface — Montu's medallion stands guard, and
    // the Earth waits inside the app. The CSS circle planet stays gone.
    expect(document.querySelector(".avatar-space-view__real-earth canvas")).toBeNull();
    expect(document.querySelector("[data-testid='montu-guard']")).not.toBeNull();
    expect(document.querySelector(".avatar-space-view__earth")).toBeNull();
    expect(screen.getByLabelText("Operator sign-in")).toBeInTheDocument();
    // ENTER BUTTON IS GONE (owner order 2026-11-11): the flight is automatic.
    expect(screen.queryByRole("button", { name: /Enter Live Mode/i })).toBeNull();
  });

  it("renders the same real Earth for the orbital view with Osiris in orbit — no split, no enter button", () => {
    render(<SpaceView isEnteringLiveMode={false} isReturningToSpace={false} />);

    expect(screen.getByRole("main", { name: "Earth orbital view" })).toBeInTheDocument();
    // Same real Earth scene (canvas), never the lightweight CSS planet.
    expect(document.querySelector(".avatar-space-view__real-earth canvas")).not.toBeNull();
    expect(document.querySelector(".avatar-space-view__earth")).toBeNull();
    // "One world. Two perspectives." is gone.
    expect(screen.queryByText(/Two perspectives/i)).toBeNull();
    // No Enter Live Mode button anywhere — the dive happens automatically.
    expect(screen.queryByRole("button", { name: /Enter Live Mode/i })).toBeNull();
  });

  it("freezes the Earth chrome while the fly-in plays", () => {
    render(<SpaceView isEnteringLiveMode isReturningToSpace={false} />);
    // During the continuous dive the CTA/label hide; the camera is flying.
    expect(document.querySelector(".spinning-earth__cta")).toBeNull();
    expect(document.querySelector(".avatar-space-view--entering")).not.toBeNull();
  });
});
