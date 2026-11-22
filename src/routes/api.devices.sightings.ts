import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/devices/sightings — the Parrot Wi-Fi watcher's report
 * door (operator order 2026-11-21).
 *
 * The watcher runs on this same machine and reports each scan here:
 * { at, tool, networks: [{ ssid, rssi }] }, already filtered to the
 * watch-list. Reports are accepted from loopback only — the watcher
 * is a local service by design, and nothing off this machine gets to
 * tell Augie what the air looks like. The stored report is what
 * /api/devices/scan-state serves to the presence checks.
 *
 * Local desktop server only: where the store is unavailable (the
 * hosted Worker build), reports are refused and nothing is stored.
 */
export const Route = createFileRoute("/api/devices/sightings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { clientIpFromRequest } = await import("@/avatar/gateLogStore.server");
        const ip = clientIpFromRequest(request);
        if (ip !== "127.0.0.1" && ip !== "::1") {
          return Response.json(
            { ok: false, error: "sightings are accepted from this machine only" },
            { status: 403 },
          );
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 });
        }
        const { sanitizeSightings } = await import("@/avatar/devices/wifiWatch");
        const report = sanitizeSightings(body, Date.now());
        if (!report) {
          return Response.json({ ok: false, error: "invalid sightings report" }, { status: 400 });
        }
        const { recordWifiSightings } = await import("@/avatar/devices/wifiWatchStore.server");
        const stored = await recordWifiSightings(report);
        if (!stored) {
          return Response.json(
            { ok: false, error: "sightings store unavailable on this server" },
            { status: 501 },
          );
        }
        return Response.json({ ok: true, networks: report.networks.length });
      },
    },
  },
});
