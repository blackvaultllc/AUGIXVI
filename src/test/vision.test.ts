import { afterEach, describe, expect, it, vi } from "vitest";
import { describeCameraFrame } from "@/avatar/vision";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("on-request camera vision", () => {
  it("plainly reports when the camera is off without contacting Ollama", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(describeCameraFrame(null)).resolves.toBe(
      "The camera is off. Turn it on and ask again.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a single transient frame to the local vision model only on request", async () => {
    const context = { drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,frame-data",
    );
    const response = new Response(
      JSON.stringify({
        response: "A chair is beside a window. A lamp is nearby. A person stands there.",
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;

    await expect(describeCameraFrame(video)).resolves.toBe(
      "A chair is beside a window. A lamp is nearby.",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/generate",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      model: string;
      prompt: string;
      images: string[];
    };
    expect(body.model).toBe("llama3.2-vision");
    expect(body.images).toEqual(["frame-data"]);
    expect(body.prompt).toContain("never name or identify anyone");
    expect(body).not.toHaveProperty("api_key");
  });
});
