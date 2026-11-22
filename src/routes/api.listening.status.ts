import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/listening/status — is a Listening Mode session armed on
 * this machine? Answers from the local speech service: armed, session
 * id, start time, recorded line count, whether the wake word was
 * heard. This drives the always-visible LISTENING indicator.
 */
export const Route = createFileRoute("/api/listening/status")({
  server: {
    handlers: {
      GET: async () => {
        const { forwardListeningStatus } = await import("@/avatar/listening.server");
        return forwardListeningStatus();
      },
    },
  },
});
