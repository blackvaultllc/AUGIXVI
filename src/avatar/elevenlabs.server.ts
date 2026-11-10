import { createServerFn } from "@tanstack/react-start";

type ElevenLabsInput = {
  text: string;
  voiceId: string;
};

export const requestElevenLabsAudio = createServerFn({ method: "POST" })
  .validator((input: unknown): ElevenLabsInput => {
    if (
      input == null ||
      typeof input !== "object" ||
      !("text" in input) ||
      typeof input.text !== "string" ||
      !("voiceId" in input) ||
      typeof input.voiceId !== "string"
    ) {
      throw new Error("Invalid ElevenLabs speech request.");
    }
    const text = input.text.trim();
    const voiceId = input.voiceId.trim();
    if (!text || text.length > 1000 || !voiceId || voiceId.length > 128) {
      throw new Error("ElevenLabs speech request is outside the allowed limits.");
    }
    return { text, voiceId };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    const apiBaseUrl = process.env["ELEVENLABS_API_BASE_URL"]?.replace(/\/+$/, "");
    if (!apiKey || !apiBaseUrl) {
      throw new Error("ElevenLabs server configuration is missing.");
    }

    const response = await fetch(
      `${apiBaseUrl}/v1/text-to-speech/${encodeURIComponent(data.voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`ElevenLabs request failed with status ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") ?? "audio/mpeg";
    const audioBase64 = Buffer.from(await response.arrayBuffer()).toString("base64");
    return { audioBase64, contentType };
  });
