import { createFileRoute } from "@tanstack/react-router";

/**
 * /api/devices/watchlist — the watch-list the Parrot's Wi-Fi watcher
 * sweeps for (operator order 2026-11-21).
 *
 * POST { ssids } — the Devices window syncs the registry's
 * activation SSIDs here whenever they change, so the watcher always
 * watches what Augie has registered (never a hard-coded name).
 * GET — the watcher reads its list here; the window also reads it to
 * show the watcher's real state (active, last scan, watched SSIDs).
 *
 * Local desktop server only: where the server store is unavailable
 * (the hosted Worker build), POST is refused and GET reports no
 * watcher — nothing is faked on the public surface.
 */
export const Route = createFileRoute("/api/devices/watchlist")({
  server: {
    handlers: {
      GET: async () => {
        const { getWifiWatchlist } = await import("@/avatar/devices/wifiWatchStore.server");
        const { buildScanState } = await import("@/avatar/devices/wifiWatch");
        const { available, ssids, watcher } = await getWifiWatchlist();
        if (!available) {
          return Response.json({ available: false, ssids: [], watcher: null });
        }
        const view = buildScanState(
          { watchlist: ssids, sightings: null, lastScanAt: watcher.lastScanAt, tool: watcher.tool },
          Date.now(),
        );
        return Response.json({ available: true, ssids, watcher: view.watcher });
      },
      POST: async ({ request }) => {
        const { setWifiWatchlist } = await import("@/avatar/devices/wifiWatchStore.server");
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 });
        }
        const ssids =
          typeof body === "object" && body !== null
            ? (body as Record<string, unknown>)["ssids"]
            : undefined;
        const stored = await setWifiWatchlist(Array.isArray(ssids) ? ssids : []);
        if (!stored) {
          return Response.json(
            { ok: false, error: "watch-list store unavailable on this server" },
            { status: 501 },
          );
        }
        return Response.json({ ok: true });
      },
    },
  },
});
