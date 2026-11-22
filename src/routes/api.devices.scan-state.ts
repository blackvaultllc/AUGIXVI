import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/devices/scan-state — what the local Wi-Fi watcher last
 * saw, in the shape the client's presence checks consume
 * (operator order 2026-11-21).
 *
 * Answers: the watcher's real state (active when its last scan is
 * fresh, the SSIDs it watches, when it last scanned) and the watched
 * networks still inside the grace window. Where no watcher has ever
 * reported — every hosted/browser context — watcher is null and the
 * client keeps its honest "browsers cannot scan Wi-Fi" answer.
 */
export const Route = createFileRoute("/api/devices/scan-state")({
  server: {
    handlers: {
      GET: async () => {
        const { getWifiScanState } = await import("@/avatar/devices/wifiWatchStore.server");
        const state = await getWifiScanState(Date.now());
        return Response.json(state, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
