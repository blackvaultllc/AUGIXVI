import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/listening/chunk — one recorded audio chunk for the armed
 * Listening Mode session. The local speech service transcribes it,
 * appends the line to the session store on that machine only, marks
 * the wake word, and separates the speaker (Part 13). A chunk sent
 * while no session is armed is refused (409) and records nothing.
 */
export const Route = createFileRoute("/api/listening/chunk")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { forwardListeningChunk } = await import("@/avatar/listening.server");
        return forwardListeningChunk(request);
      },
    },
  },
});
