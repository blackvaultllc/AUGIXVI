import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/voiceprint/delete — remove the stored voiceprint from
 * this machine entirely (re-enrollment starts from nothing).
 */
export const Route = createFileRoute("/api/voiceprint/delete")({
  server: {
    handlers: {
      POST: async () => {
        const { forwardEnrollAction } = await import("@/avatar/voiceprint.server");
        return forwardEnrollAction("delete");
      },
    },
  },
});
