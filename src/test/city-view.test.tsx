import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CityView } from "@/avatar/CityView";

describe("construct city background", () => {
  it("renders the rule-derived town, outer zones, route and markers", () => {
    render(<CityView />);

    expect(screen.getByRole("main", { name: "Construct map placeholder" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Town, outer forest, hot zone/ })).toBeInTheDocument();
    expect(screen.getByText("Town center")).toBeInTheDocument();
    expect(screen.getByText("Outer forest")).toBeInTheDocument();
    expect(screen.getByText("Warm fields")).toBeInTheDocument();
    expect(screen.getByText("Forest encounter site")).toBeInTheDocument();
    expect(screen.getByText("Town trainer")).toBeInTheDocument();
    expect(screen.getByText(/no game systems are loaded/)).toBeInTheDocument();
  });
});
