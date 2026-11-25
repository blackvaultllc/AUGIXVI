import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/devices/bridge — the generalized device bridge door
 * (owner order 2026-11-24: the dog's bridge, opened to every
 * registered broadcast device).
 *
 * Body: { deviceId, hex, holdMs, live } — ONE frame built by
 * Augie's own encoder, the device it is for, its hold, and the
 * practice/LIVE switch state. The server looks the device up in
 * the core registry, resolves ITS registered sender (allowlisted
 * to ~/augie-tools/), and hands the frame to that sender — which
 * airs it from this machine's Bluetooth, or, without live, prints
 * it and transmits nothing.
 *
 * The door is narrow on purpose: clients only from this machine,
 * the tailnet, or his private LAN (the bridge executes a local
 * program — it is never a public surface); the body is validated
 * to a single frame shape; the sender runs as an argv array, so
 * the hex is data, never code. Permission still gates the door
 * from the other side: callers reach here through
 * sendDeviceCommand, which refuses before any channel is touched
 * when the device's card lacks its grant.
 */
export const Route = createFileRoute("/api/devices/bridge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { clientIpFromRequest } = await import("@/avatar/gateLogStore.server");
        const { bridgeClientAllowed } = await import("@/avatar/devices/wepwawetBridge");
        const ip = clientIpFromRequest(request);
        if (!bridgeClientAllowed(ip)) {
          return Response.json(
            { ok: false, error: "the device bridge answers only on this machine and the Captain's own networks" },
            { status: 403 },
          );
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 });
        }
        const { sanitizeDeviceBridgeRequest } = await import("@/avatar/devices/deviceBridge");
        const frame = sanitizeDeviceBridgeRequest(body);
        if (!frame) {
          return Response.json(
            { ok: false, error: "invalid bridge frame — a device id, one 23-byte frame, its hold, and the live flag" },
            { status: 400 },
          );
        }
        const { runDeviceFrame } = await import("@/avatar/devices/deviceBridge.server");
        const run = await runDeviceFrame(frame);
        if (!run.ok) {
          return Response.json({ ok: false, error: run.error }, { status: run.status });
        }
        return Response.json({ ok: true, mode: run.mode, output: run.output });
      },
    },
  },
});
