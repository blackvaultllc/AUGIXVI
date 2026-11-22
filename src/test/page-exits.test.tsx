import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * PAGE EXITS — every full page in Augie carries the standing
 * "← Augie" control back to the avatar stage, in a header at the top
 * of the page. A full page is never a trap.
 *
 * Defect that pinned this (operator report 2026-11-22): the Ghost
 * Protocol One Phone Bridge (/phone-bridge) shipped with NO way back
 * — no back control, no link to the stage. The four room pages
 * (analyze, cube, world, game) already had the control; this suite
 * pins all five so none of them can silently lose it again.
 *
 * The router is reduced to an anchor (same pattern as
 * learner-home.test.tsx) and the RoomGate to a pass-through — the
 * gate has its own coverage; this suite is about the pages' own exit.
 */
vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute:
      () =>
      (options: unknown): unknown =>
        options,
    Link: (props: { to: string; children: React.ReactNode }) =>
      React.createElement("a", { href: props.to }, props.children),
  };
});

vi.mock("@/avatar/RoomGate", async () => {
  const React = await import("react");
  return {
    RoomGate: (props: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
  };
});

// Heavy room bodies are not what this suite is about.
vi.mock("@/avatar/PictureAnalysis", () => ({ PictureAnalysis: () => null }));
vi.mock("@/avatar/world-of-logic/WorldOfLogic", () => ({ default: () => null }));

// The phone bridge reads saved watch readings on mount; with no
// operator token in the test it must simply render its page.
vi.mock("@/avatar/trustedDevice", () => ({
  getOperatorAccessToken: vi.fn(async () => null),
}));
vi.mock("@/avatar/watchVitals.server", () => ({
  listWatchReadings: vi.fn(async () => ({ authorized: false, readings: [] })),
  saveWatchReading: vi.fn(async () => ({ saved: false })),
}));

import { Route as PhoneBridgeRoute } from "@/routes/phone-bridge";
import { Route as AnalyzeRoute } from "@/routes/avatar_.analyze";
import { Route as CubeRoute } from "@/routes/avatar_.cube";
import { Route as WorldRoute } from "@/routes/avatar_.world";
import { Route as GameRoute } from "@/routes/avatar_.game";

function pageComponent(route: unknown): ComponentType {
  return (route as { component: ComponentType }).component;
}

const PAGES: Array<{ path: string; route: unknown; title: string }> = [
  { path: "/phone-bridge", route: PhoneBridgeRoute, title: "Ghost Protocol One — Phone Bridge" },
  { path: "/avatar/analyze", route: AnalyzeRoute, title: "Picture Analysis — Analytic Window" },
  { path: "/avatar/cube", route: CubeRoute, title: "AR Cube" },
  { path: "/avatar/world", route: WorldRoute, title: "World of Logic" },
  { path: "/avatar/game", route: GameRoute, title: "Legend of Logic" },
];

describe("full-page exits — every full page can get back to Augie", () => {
  for (const { path, route, title } of PAGES) {
    it(`${path} shows a "← Augie" link to the stage in its top header`, () => {
      const Page = pageComponent(route);
      render(<Page />);
      const exit = screen.getByRole("link", { name: "← Augie" });
      expect(exit).toHaveAttribute("href", "/avatar");
      // The control sits in the page header at the top — reachable
      // without scrolling, next to the page's own title.
      expect(exit.closest("header")).not.toBeNull();
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    });
  }

  it("the phone bridge keeps its bridge content under the new header", () => {
    const Page = pageComponent(PhoneBridgeRoute);
    render(<Page />);
    expect(screen.getByRole("heading", { name: "The watch — heart rate" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect the watch (Bluetooth)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No watch reading yet — this line only ever shows a number/),
    ).toBeInTheDocument();
  });
});
