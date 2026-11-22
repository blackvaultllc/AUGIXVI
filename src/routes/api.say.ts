import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/say — Augie's local voice-out doorway (Piper, on this
 * machine). Text in, WAV out. Where Piper is not installed the route
 * answers 503 with the reason and the app falls back to the browser
 * voice. Operator-side only: this route is NOT in Khadija's learner
 * allowlist — her Flower keeps her own voice path.
 */
export const Route = createFileRoute("/api/say")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleSayRequest } = await import("@/avatar/piper.server");
        return handleSayRequest(request);
      },
    },
  },
});
