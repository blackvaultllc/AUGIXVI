import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceCalibrationPanel } from "@/avatar/VoiceCalibrationPanel";
import type { VoiceCalibrationPrefs } from "@/avatar/voiceCalibration";

/**
 * VOICE CALIBRATION PANEL — the states the operator must be able to
 * trust at a glance: not enrolled (with the first reading ready),
 * enrolled (with removal offered), and service-down (honest words,
 * fail-closed stated, never a guessed state). The fetch to
 * /api/voiceprint/status is faked; no microphone is touched.
 */

const OFF: VoiceCalibrationPrefs = { enabled: false, threshold: 0.5 };

function statusFetch(payload: Record<string, unknown> | Error) {
  return vi.fn(async (input: string) => {
    if (String(input).includes("/api/voiceprint/status")) {
      if (payload instanceof Error) throw payload;
      return { ok: true, status: 200, json: async () => payload };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

const NOT_ENROLLED = {
  enrolled: false,
  model: "wespeaker-voxceleb-resnet34-LM",
  model_ready: true,
  default_threshold: 0.5,
  min_samples: 3,
  max_samples: 8,
  pending_samples: 0,
  samples: null,
};

const ENROLLED = { ...NOT_ENROLLED, enrolled: true, samples: 4 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Voice calibration panel", () => {
  it("not enrolled: shows the state, the first reading, and the honest small print", async () => {
    vi.stubGlobal("fetch", statusFetch(NOT_ENROLLED));
    render(<VoiceCalibrationPanel prefs={OFF} onPrefsChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Not enrolled — Augie cannot yet tell your voice/)).toBeTruthy();
    });
    expect(screen.getByText(/“Osiris, open the cube.”/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Record reading 1/ })).toBeTruthy();
    expect(screen.getByText(/Readings held: 0 of 3 needed/)).toBeTruthy();
    // The liveness limit is stated, not hidden.
    expect(screen.getByText(/It is not a liveness check/)).toBeTruthy();
    expect(screen.getByText(/deleted the\s+moment it is embedded/)).toBeTruthy();
  });

  it("enrolled: shows the state, offers removal, and hides the enrollment flow", async () => {
    vi.stubGlobal("fetch", statusFetch(ENROLLED));
    render(<VoiceCalibrationPanel prefs={OFF} onPrefsChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Enrolled — Augie knows your voice, from 4 readings/)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /Remove voiceprint/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Record reading/ })).toBeNull();
  });

  it("service down: honest words and the fail-closed rule, never a guessed state", async () => {
    vi.stubGlobal("fetch", statusFetch(new Error("Local speech service is not running.")));
    render(<VoiceCalibrationPanel prefs={OFF} onPrefsChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/calibration state is unknown/)).toBeTruthy();
    });
    expect(screen.getByText(/voice commands fail closed/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Check again/ })).toBeTruthy();
  });

  it("the switch and the threshold report changes upward", async () => {
    vi.stubGlobal("fetch", statusFetch(NOT_ENROLLED));
    const onPrefsChange = vi.fn();
    render(<VoiceCalibrationPanel prefs={OFF} onPrefsChange={onPrefsChange} />);
    await waitFor(() => {
      expect(screen.getByText(/Not enrolled/)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Calibration: OFF/ }));
    expect(onPrefsChange).toHaveBeenCalledWith({ enabled: true, threshold: 0.5 });
    fireEvent.change(screen.getByLabelText("Voice match threshold"), {
      target: { value: "0.65" },
    });
    expect(onPrefsChange).toHaveBeenCalledWith({ enabled: false, threshold: 0.65 });
  });
});
