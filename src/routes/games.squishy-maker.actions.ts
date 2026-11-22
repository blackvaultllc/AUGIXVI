import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /games/squishy-maker/actions — her Squishy Maker's doorway
 * inside Augie (owner order 2026-11-21: "add that to the AUGI for
 * her, she wants her game over there").
 *
 * The game's built client (public/games/squishy-maker/, copied
 * unchanged from the artifact's live v4 build) POSTs {action, args}
 * to ./actions relative to its own page — which is this path. All
 * logic lives in avatar/learner/squishyMaker.server.ts (imported
 * lazily so nothing server-side leaks into the client bundle): the
 * same six actions the space runtime served, same shapes, backed by
 * a JSON file on this machine.
 */
export const Route = createFileRoute("/games/squishy-maker/actions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleSquishyActionsRequest } = await import(
          "@/avatar/learner/squishyMaker.server"
        );
        return handleSquishyActionsRequest(request);
      },
    },
  },
});
