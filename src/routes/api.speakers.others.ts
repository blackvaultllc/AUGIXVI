import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/speakers/others — the SEPARATE other-voices store from the
 * local speech service (Part 13): labeled Speaker 2, Speaker 3… with
 * similarity scores and transcripts. Embeddings and transcripts only —
 * raw audio is never retained, operator speech never lands here, and
 * when no voiceprint is enrolled the payload says so (not-enrolled).
 */
export const Route = createFileRoute("/api/speakers/others")({
  server: {
    handlers: {
      GET: async () => {
        const { forwardOtherVoices } = await import("@/avatar/listening.server");
        return forwardOtherVoices();
      },
    },
  },
});
