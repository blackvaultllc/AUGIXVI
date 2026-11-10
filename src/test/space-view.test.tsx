import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpaceView } from "@/avatar/SpaceView";

describe("one world, one Earth, one flight", () => {
  it("supports an Earth-only landing view with an interactive sign-in overlay", () => {
    render(
      <SpaceView
        isLanding
        isEnteringLiveMode={false}
        isReturningToSpace={false}
        onEnterLiveMode={vi.fn()}
      >
        <section aria-label="Operator sign-in">Sign in</section>
      </SpaceView>,
    );

    expect(screen.getByRole("main", { name: "Operator sign-in landing view" })).toBeInTheDocument();
    // The real textured SpinningEarth is the stage; the CSS circle planet is gone.
    expect(document.querySelector(".avatar-space-view__real-earth canvas")).not.toBeNull();
    expect(document.querySelector(".avatar-space-view__earth")).toBeNull();
    expect(screen.getByLabelText("Operator sign-in")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enter Live Mode" })).toBeNull();
  });

  it("renders the same real Earth for the orbital view with Osiris in orbit — no split", () => {
    const onEnterLiveMode = vi.fn();
    render(
      <SpaceView
        isEnteringLiveMode={false}
        isReturningToSpace={false}
        onEnterLiveMode={onEnterLiveMode}
      />,
    );

    expect(screen.getByRole("main", { name: "Earth orbital view" })).toBeInTheDocument();
    // Same real Earth scene (canvas), never the lightweight CSS planet.
    expect(document.querySelector(".avatar-space-view__real-earth canvas")).not.toBeNull();
    expect(document.querySelector(".avatar-space-view__earth")).toBeNull();
    // "One world. Two perspectives." is gone.
    expect(screen.queryByText(/Two perspectives/i)).toBeNull();
    // Enter Live Mode flies down home rather than jumping screens.
    const enter = screen.getByRole("button", { name: /Enter Live Mode/i });
    expect(document.querySelector(".spinning-earth__cta")).not.toBeNull();
    fireEvent.click(enter);
    expect(onEnterLiveMode).toHaveBeenCalledOnce();
  });

  it("freezes the Earth chrome while the fly-in plays", () => {
    render(<SpaceView isEnteringLiveMode isReturningToSpace={false} onEnterLiveMode={vi.fn()} />);
    // During the continuous dive the CTA/label hide; the camera is flying.
    expect(document.querySelector(".spinning-earth__cta")).toBeNull();
    expect(document.querySelector(".avatar-space-view--entering")).not.toBeNull();
  });
});
