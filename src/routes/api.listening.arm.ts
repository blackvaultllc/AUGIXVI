import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/listening/arm — arm a Listening Mode session on the local
 * speech service. From this moment the service records the lines it
 * is fed, silently, until disarmed or until the wake word is heard.
 */
export const Route = createFileRoute("/api/listening/arm")({
  server: {
    handlers: {
      POST: async () => {
        const { forwardListeningArm } = await import("@/avatar/listening.server");
        return forwardListeningArm();
      },
    },
  },
});
