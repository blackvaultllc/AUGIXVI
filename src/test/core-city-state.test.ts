import { describe, expect, it } from "vitest";
import { parseCoreCommand, reduceCoreCityState } from "@/avatar/coreCityState";

describe("Core and City state machine", () => {
  it("moves from full Core to compact Core with City, then back", () => {
    const city = reduceCoreCityState({ mode: "CORE_FULL" }, "SHOW_CITY");
    expect(city).toEqual({ mode: "CORE_SMALL", view: "CITY" });
    expect(reduceCoreCityState(city, "BACK_TO_CORE")).toEqual({ mode: "CORE_FULL" });
  });

  it("wakes Core from the city state", () => {
    expect(reduceCoreCityState({ mode: "CORE_SMALL", view: "CITY" }, "WAKE_CORE")).toEqual({
      mode: "CORE_FULL",
    });
  });

  it("recognizes spoken or typed Core and City commands", () => {
    expect(parseCoreCommand("hey core, show me my city")).toEqual({
      action: "SHOW_CITY",
      message: "",
    });
    expect(parseCoreCommand("hey core")).toEqual({ action: "WAKE_CORE", message: "" });
    expect(parseCoreCommand("back to core")).toEqual({
      action: "BACK_TO_CORE",
      message: "",
    });
    expect(parseCoreCommand("hey core, what time is it")).toEqual({
      action: "WAKE_CORE",
      message: "what time is it",
    });
  });
});
