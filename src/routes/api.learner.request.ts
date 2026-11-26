import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/learner/request — Khadija's "Ask for something to
 * be added" doorway (Captain's order 2026-11-26). Learner-
 * scoped and on her allowlist BY DESIGN, under the daddy
 * doorway's law: it sends her words OUT to her father (a
 * section-requests record on the core, mirrored into his
 * notifications) and brings nothing back but a thank-you. It
 * opens no content, no tool, and no surface to her. All logic
 * lives in avatar/learner/request.server.ts (imported lazily
 * so nothing server-side leaks into the client bundle).
 */
export const Route = createFileRoute("/api/learner/request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleLearnerRequest } = await import("@/avatar/learner/request.server");
        return handleLearnerRequest(request);
      },
    },
  },
});
