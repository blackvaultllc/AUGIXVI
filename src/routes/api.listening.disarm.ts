import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/listening/disarm — stop the armed Listening Mode session
 * on the local speech service. Returns the session's final line count
 * and whether the wake word was heard.
 */
export const Route = createFileRoute("/api/listening/disarm")({
  server: {
    handlers: {
      POST: async () => {
        const { forwardListeningDisarm } = await import("@/avatar/listening.server");
        return forwardListeningDisarm();
      },
    },
  },
});
