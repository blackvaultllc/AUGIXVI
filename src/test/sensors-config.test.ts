import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEDIAPIPE_HAND_MODEL_URL,
  DEFAULT_MEDIAPIPE_WASM_ROOT,
  getVisionAssetCandidates,
} from "@/avatar/sensors";

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
});
