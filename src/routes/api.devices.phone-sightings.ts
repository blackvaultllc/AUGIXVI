import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/devices/phone-sightings — GHOST PROTOCOL ONE's report
 * door (Part 23, operator order 2026-11-21).
 *
 * The Parrot watcher's own door (/api/devices/sightings) is loopback
 * only and stays that way. The phone is a second scanner with its
 * own, narrower door: requests are accepted only from private/LAN/
 * tailnet addresses AND carrying the pairing token (see
 * ghostPairing.server.ts). The payload is the same watcher shape —
 * { at, networks: [{ ssid, rssi }] } — and the tool is forced to
 * "ghost-protocol-one": a phone cannot claim to be the Parrot's
 * radio. Reports land in the store's phone slot and merge into
 * /api/devices/scan-state alongside the Parrot watcher's own.
 *
 * Local desktop server only: on the hosted Worker there is no store,
 * reports are refused, and nothing is stored.
 */
export const Route = createFileRoute("/api/devices/phone-sightings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { clientIpFromRequest } = await import("@/avatar/gateLogStore.server");
        const { authorizePhoneSightings } = await import("@/avatar/devices/ghostPairing.server");
        const refusal = await authorizePhoneSightings(request, clientIpFromRequest(request));
        if (refusal) {
          return Response.json({ ok: false, error: refusal }, { status: 403 });
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
        const { recordPhoneWifiSightings } = await import("@/avatar/devices/wifiWatchStore.server");
        const stored = await recordPhoneWifiSightings({ ...report, tool: "ghost-protocol-one" });
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
