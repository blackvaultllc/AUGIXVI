import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/voiceprint/verify — one spoken clip, checked against the
 * stored voiceprint by the local speech service. Returns the verdict
 * (match + score); the voiceprint embedding never leaves the service.
 */
export const Route = createFileRoute("/api/voiceprint/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { forwardVerify } = await import("@/avatar/voiceprint.server");
        return forwardVerify(request);
      },
    },
  },
});
