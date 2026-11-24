import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/learner/say — the Flower's real voice (owner order
 * 2026-11-24). Learner-scoped twin of the operator's /api/say: text
 * in, Piper WAV out, generated on the core. It is on her allowlist;
 * the operator's /api/say stays outside her wall. Where Piper is
 * not installed on the answering host the route answers 503 with
 * the reason and her page falls back to the browser voice. All
 * logic lives in avatar/learner/learnerSay.server.ts (imported
 * lazily so nothing server-side leaks into the client bundle).
 */
export const Route = createFileRoute("/api/learner/say")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleLearnerSayRequest } = await import("@/avatar/learner/learnerSay.server");
        return handleLearnerSayRequest(request);
      },
    },
  },
});
