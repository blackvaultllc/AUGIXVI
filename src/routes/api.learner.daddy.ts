import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/learner/daddy — Khadija's line to her father (owner
 * order 2026-11-24). Learner-scoped and on her allowlist BY DESIGN:
 * reaching Daddy is the one contact her education wall always opens
 * for. Actions: message (words for Daddy), call (ring him if he is
 * at his Augie), poll (his replies, his presence, the call's state),
 * end-call. Everything lands in the core's Daddy Inbox — it reaches
 * Domenick Arlon Hall and nobody else. All logic lives in
 * avatar/learner/daddy.server.ts (imported lazily so nothing
 * server-side leaks into the client bundle).
 */
export const Route = createFileRoute("/api/learner/daddy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleLearnerDaddyRequest } = await import("@/avatar/learner/daddy.server");
        return handleLearnerDaddyRequest(request);
      },
    },
  },
});
