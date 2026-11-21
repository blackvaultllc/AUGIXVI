import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/voiceprint/enroll — one enrollment clip. The local speech
 * service embeds it in memory and discards the raw audio; only the
 * embedding is kept, and only until enrollment is committed.
 */
export const Route = createFileRoute("/api/voiceprint/enroll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { forwardEnrollSample } = await import("@/avatar/voiceprint.server");
        return forwardEnrollSample(request);
      },
    },
  },
});
