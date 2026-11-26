import { createFileRoute } from "@tanstack/react-router";

/**
 * The Voice Lab doorway (owner order 2026-11-26): GET the catalog,
 * the models this core really has, and the stored choice; POST a
 * new choice into the core store. Operator-side only — this route
 * is NOT in Khadija's learner allowlist; her Flower's voice is not
 * set here and never was.
 */
export const Route = createFileRoute("/api/voice")({
  server: {
    handlers: {
      GET: async () => {
        const { handleVoiceLabGet } = await import("@/avatar/voiceOut.server");
        return handleVoiceLabGet();
      },
      POST: async ({ request }) => {
        const { handleVoiceLabPost } = await import("@/avatar/voiceOut.server");
        return handleVoiceLabPost(request);
      },
    },
  },
});
