import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/voiceprint/commit — finish enrollment: the local speech
 * service averages the held sample embeddings into the stored
 * voiceprint.
 */
export const Route = createFileRoute("/api/voiceprint/commit")({
  server: {
    handlers: {
      POST: async () => {
        const { forwardEnrollAction } = await import("@/avatar/voiceprint.server");
        return forwardEnrollAction("commit");
      },
    },
  },
});
