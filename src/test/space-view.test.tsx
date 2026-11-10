import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpaceView } from "@/avatar/SpaceView";

describe("orbital Earth view", () => {
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
    // The landing uses the real textured Spinning Earth, not the lightweight
    // CSS planet (which stays available for the in-world orbital view).
    expect(document.querySelector(".avatar-space-view__real-earth canvas")).not.toBeNull();
    expect(document.querySelector<HTMLButtonElement>(".avatar-space-view__earth")).toBeNull();
    expect(screen.getByLabelText("Operator sign-in")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enter Live Mode" })).toBeNull();
  });

  it("offers a lightweight zoomable planet and enters Osiris's live world", () => {
    const onEnterLiveMode = vi.fn();
    render(
      <SpaceView
        isEnteringLiveMode={false}
        isReturningToSpace={false}
        onEnterLiveMode={onEnterLiveMode}
      />,
    );

    const earth = screen.getByRole("button", { name: "Zoom into Earth" });
    fireEvent.click(earth);
    expect(screen.getByRole("button", { name: "Zoom out from Earth" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Europe" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enter Live Mode" }));
    expect(onEnterLiveMode).toHaveBeenCalledOnce();
  });

  it("focuses a selected region and displays its coordinates", () => {
    render(
      <SpaceView isEnteringLiveMode={false} isReturningToSpace={false} onEnterLiveMode={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Zoom into Earth" }));
    fireEvent.click(screen.getByRole("button", { name: "North America" }));

    expect(
      screen.getByText(/North America \(approx\. center\) · 39\.83° N, 98\.58° W/),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("North America selected.");
    expect(screen.getByRole("button", { name: "North America" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("reads device coordinates only after an explicit location request", () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "geolocation");
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 47.6, longitude: -122.3 } as GeolocationCoordinates,
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    try {
      render(
        <SpaceView
          isEnteringLiveMode={false}
          isReturningToSpace={false}
          onEnterLiveMode={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Zoom into Earth" }));
      fireEvent.click(screen.getByRole("button", { name: "Use device location" }));

      expect(getCurrentPosition).toHaveBeenCalledOnce();
      expect(screen.getByText(/Device location · 47\.60° N, 122\.30° W/)).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Device location is shown in this browser only.",
      );
    } finally {
      if (descriptor) Object.defineProperty(navigator, "geolocation", descriptor);
      else Reflect.deleteProperty(navigator, "geolocation");
    }
  });
});
