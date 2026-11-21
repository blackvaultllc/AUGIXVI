import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/transcribe — the local ear's doorway.
 *
 * Accepts one recorded audio clip from the avatar page and returns the
 * transcript produced by the faster-whisper service running on this
 * machine. All logic lives in avatar/transcribe.server.ts (imported
 * lazily so nothing server-side leaks into the client bundle).
 */
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { forwardTranscription } = await import("@/avatar/transcribe.server");
        return forwardTranscription(request);
      },
    },
  },
});
