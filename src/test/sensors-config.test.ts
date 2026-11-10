import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEDIAPIPE_HAND_MODEL_URL,
  DEFAULT_MEDIAPIPE_WASM_ROOT,
  getVisionAssetCandidates,
} from "@/avatar/sensors";
import { AvatarBridge } from "@/avatar/AvatarBridge";
import { Sensors } from "@/avatar/sensors";

describe("hand tracking asset configuration", () => {
  it("uses the built-in MediaPipe defaults when overrides are absent", () => {
    expect(getVisionAssetCandidates()).toEqual([
      {
        wasmRoot: DEFAULT_MEDIAPIPE_WASM_ROOT,
        handModelUrl: DEFAULT_MEDIAPIPE_HAND_MODEL_URL,
      },
    ]);
  });

  it("tries configured assets and then defaults", () => {
    expect(getVisionAssetCandidates("custom-wasm", "custom-model")).toEqual([
      { wasmRoot: "custom-wasm", handModelUrl: "custom-model" },
      {
        wasmRoot: DEFAULT_MEDIAPIPE_WASM_ROOT,
        handModelUrl: DEFAULT_MEDIAPIPE_HAND_MODEL_URL,
      },
    ]);
  });

  it("reports camera vision unavailable until a live camera stream is active", () => {
    const sensors = new Sensors(
      new AvatarBridge(),
      { onPalm: () => {}, onHandLost: () => {}, onWave: () => {}, onMicLevel: () => {} },
      { sensitivity: 0.8, cooldownMs: 800 },
    );
    expect(sensors.cameraIsActive).toBe(false);
    sensors.stop();
  });
});
