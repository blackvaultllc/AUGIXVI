const VISION_PROMPT =
  "Describe only the visible scene in one or two brief sentences. Refer to people only as people; never name or identify anyone, infer private traits, or guess beyond visible evidence. If something is unclear, say so plainly. Do not add greetings.";

export async function describeCameraFrame(video: HTMLVideoElement | null): Promise<string> {
  if (!video?.videoWidth || !video.videoHeight) {
    return "The camera is off. Turn it on and ask again.";
  }

  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 640 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return "I cannot read the camera frame in this browser.";
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const image = canvas.toDataURL("image/jpeg", 0.72).split(",")[1];
  if (!image) return "I cannot read the camera frame in this browser.";

  const baseUrl = (import.meta.env["VITE_OLLAMA_BASE_URL"] || "http://localhost:11434").replace(
    /\/+$/,
    "",
  );
  const model = import.meta.env["VITE_OLLAMA_VISION_MODEL"] || "llama3.2-vision";
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt: VISION_PROMPT, images: [image], stream: false }),
    });
    if (!response.ok) throw new Error(`Vision model returned ${response.status}.`);
    const result = (await response.json()) as { response?: string };
    const description = result.response?.trim();
    if (!description) return "I could not make out enough detail to describe the scene.";
    const sentences = description.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [description];
    return sentences.slice(0, 2).join("").trim().slice(0, 500);
  } catch {
    return "Camera vision is unavailable. Check that the local vision model is running.";
  } finally {
    window.clearTimeout(timeout);
    canvas.width = 0;
    canvas.height = 0;
  }
}
