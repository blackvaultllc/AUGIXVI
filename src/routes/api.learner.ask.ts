import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/learner/ask — Augie the Flower's doorway (owner order
 * 2026-11-21). A learner-scoped endpoint: it answers school questions
 * from the offline library (and exact arithmetic) and nothing else.
 * It is on her allowlist; every operator endpoint — /api/transcribe,
 * /api/library/*, the voiceprint routes — stays outside her wall.
 * All logic lives in avatar/learner/flower.server.ts (imported
 * lazily so nothing server-side leaks into the client bundle).
 */
export const Route = createFileRoute("/api/learner/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleFlowerAskRequest } = await import("@/avatar/learner/flower.server");
        return handleFlowerAskRequest(request);
      },
    },
  },
});
