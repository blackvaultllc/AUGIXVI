import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceIndicator, type EarSource } from "@/avatar/VoiceIndicator";
import type { HearingSnapshot } from "@/avatar/localEar";

/**
 * THE VOICE INDICATOR (owner order 2026-11-22): the label is the
 * ear's real state or it does not ship — NOT HEARING with the plain
 * reason while the mic is off or failed, HEARING YOU only while the
 * ear is truly listening, and the addressee is whoever he is
 * talking to.
 */

function fakeEar(snapshot: HearingSnapshot): EarSource {
  return {
    subscribeLevel: () => () => undefined,
    hearingSnapshot: () => snapshot,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("voice indicator", () => {
  it("reads NOT HEARING with the plain reason while the mic is off", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const ear = fakeEar({ state: "idle", supported: true, lastError: null });
    const { container } = render(<VoiceIndicator ear={ear} />);
    expect(container.textContent).toContain("NOT HEARING");
    expect(container.textContent).toContain("Anubis");
    expect(container.textContent).toContain("The microphone is off.");
    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("reads HEARING YOU only while the ear is truly listening", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const ear = fakeEar({ state: "listening", supported: true, lastError: null });
    const { container } = render(<VoiceIndicator ear={ear} addressee="Montu" />);
    expect(container.textContent).toContain("HEARING YOU");
    expect(container.textContent).toContain("Montu");
    expect(container.textContent).not.toContain("NOT HEARING");
  });

  it("shows the ear's own failure words — never a false green", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const ear = fakeEar({
      state: "error",
      supported: true,
      lastError: "Microphone unavailable: permission was denied.",
    });
    const { container } = render(<VoiceIndicator ear={ear} />);
    expect(container.textContent).toContain("NOT HEARING");
    expect(container.textContent).toContain("permission was denied");
  });

  it("with no ear at all it still tells the truth: not hearing, mic off", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { container } = render(<VoiceIndicator ear={null} />);
    expect(container.textContent).toContain("NOT HEARING");
    expect(container.textContent).toContain("The microphone is off.");
  });
});
