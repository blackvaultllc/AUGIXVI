import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/voiceprint/status — is a voiceprint enrolled on this
 * machine? Answers from the local speech service; never carries the
 * embedding itself.
 */
export const Route = createFileRoute("/api/voiceprint/status")({
  server: {
    handlers: {
      GET: async () => {
        const { forwardVoiceprintStatus } = await import("@/avatar/voiceprint.server");
        return forwardVoiceprintStatus();
      },
    },
  },
});
