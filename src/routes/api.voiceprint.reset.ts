import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/voiceprint/reset — abandon an in-progress enrollment: the
 * local speech service drops the held sample embeddings.
 */
export const Route = createFileRoute("/api/voiceprint/reset")({
  server: {
    handlers: {
      POST: async () => {
        const { forwardEnrollAction } = await import("@/avatar/voiceprint.server");
        return forwardEnrollAction("reset");
      },
    },
  },
});
