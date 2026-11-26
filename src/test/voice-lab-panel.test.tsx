import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceLabPanel } from "@/avatar/VoiceLabPanel";

/**
 * VOICE LAB PANEL — the states the Captain must be able to trust:
 * the deep default marked, a voice not on this core shown as such
 * with its buttons disabled (never a fake preview), a preview that
 * goes through the real /api/say path with the voice named, and a
 * choice that posts to the core store doorway.
 */

const VIEW = {
  chosenVoiceId: null,
  speaking: {
    voiceId: "anubis-deep",
    factLine: "Piper model en_US-ryan-low · pitch shifted down 12% (deeper, a touch slower)",
    note: "Speaking in the standing default — no Voice Lab choice made yet.",
  },
  entries: [
    {
      voice: {
        id: "anubis-deep",
        model: "en_US-ryan-low",
        label: "Anubis — deep, dark, disciplined",
        description: "The deepest voice on the core.",
        pitchFactor: 0.88,
        deep: true,
      },
      factLine: "Piper model en_US-ryan-low · pitch shifted down 12% (deeper, a touch slower)",
      installed: true,
      isDefault: true,
      isChosen: false,
    },
    {
      voice: {
        id: "danny-low",
        model: "en_US-danny-low",
        label: "Danny — low and even",
        description: "A naturally low man's voice.",
        pitchFactor: 0.93,
        deep: true,
      },
      factLine: "Piper model en_US-danny-low · pitch shifted down 7% (deeper, a touch slower)",
      installed: false,
      isDefault: false,
      isChosen: false,
    },
  ],
};

const CHOSEN_VIEW = {
  ...VIEW,
  chosenVoiceId: "anubis-deep",
  speaking: {
    voiceId: "anubis-deep",
    factLine: VIEW.speaking.factLine,
    note: "Speaking in your Voice Lab choice.",
  },
  entries: VIEW.entries.map((entry) =>
    entry.voice.id === "anubis-deep" ? { ...entry, isChosen: true } : entry,
  ),
};

function labFetch() {
  return vi.fn(async (input: string, init?: { method?: string; body?: string }) => {
    const url = String(input);
    if (url.includes("/api/voice") && init?.method === "POST") {
      return { ok: true, status: 200, json: async () => CHOSEN_VIEW };
    }
    if (url.includes("/api/voice")) {
      return { ok: true, status: 200, json: async () => VIEW };
    }
    if (url.includes("/api/say")) {
      return {
        ok: true,
        status: 200,
        blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

class FakeAudio {
  play = vi.fn(async () => undefined);
  pause = vi.fn();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Voice Lab panel", () => {
  it("shows the deep default, the honest fact line, and a not-installed voice disabled", async () => {
    vi.stubGlobal("fetch", labFetch());
    render(<VoiceLabPanel />);
    await waitFor(() => {
      expect(screen.getByText("Anubis — deep, dark, disciplined")).toBeTruthy();
    });
    expect(screen.getByText("Standing default")).toBeTruthy();
    expect(screen.getAllByText(/Piper model en_US-ryan-low/).length).toBeGreaterThan(0);
    expect(screen.getByText("Not on this core yet")).toBeTruthy();
    const buttons = screen.getAllByRole("button");
    const dannyPreview = buttons.find(
      (b) => b.textContent?.includes("Preview") && b.closest("li")?.textContent?.includes("Danny"),
    );
    expect(dannyPreview?.hasAttribute("disabled")).toBe(true);
  });

  it("preview speaks through /api/say with the voice named; choosing posts the choice to the core", async () => {
    const fetchMock = labFetch();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });
    render(<VoiceLabPanel />);
    const previewButton = await waitFor(() => {
      const button = screen
        .getAllByRole("button")
        .find(
          (b) =>
            b.textContent?.includes("Preview") &&
            b.closest("li")?.textContent?.includes("Anubis — deep"),
        );
      expect(button).toBeTruthy();
      return button!;
    });
    fireEvent.click(previewButton);
    await waitFor(() => {
      const sayCall = fetchMock.mock.calls.find(([input]) => String(input).includes("/api/say"));
      expect(sayCall).toBeTruthy();
      const body = JSON.parse(String(sayCall?.[1]?.body ?? "{}")) as { voiceId?: string };
      expect(body.voiceId).toBe("anubis-deep");
    });

    const useButton = screen
      .getAllByRole("button")
      .find(
        (b) =>
          b.textContent?.includes("Use this voice") &&
          b.closest("li")?.textContent?.includes("Anubis — deep"),
      );
    expect(useButton).toBeTruthy();
    fireEvent.click(useButton!);
    await waitFor(() => {
      expect(screen.getByText("Your choice")).toBeTruthy();
    });
    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).includes("/api/voice") && init?.method === "POST",
    );
    expect(postCall).toBeTruthy();
  });
});
