import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/listening/recap?session=<id> — ONLY the lines actually
 * recorded for a listening session (the given one, or the current /
 * most recent). An empty session returns the service's explicit
 * "nothing was recorded" — never invented content.
 */
export const Route = createFileRoute("/api/listening/recap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { forwardListeningRecap } = await import("@/avatar/listening.server");
        return forwardListeningRecap(request);
      },
    },
  },
});
