import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/devices/wepwawet — the Wepwawet bridge door (operator
 * order 2026-11-24: the Captain runs the dog from inside Augie).
 *
 * Body: { hex, holdMs, live } — ONE 23-byte frame built by Augie's
 * own encoder in the Devices panel, its hold, and the Captain's
 * practice/LIVE switch state. The server hands the frame to the
 * staged sender on this machine (~/augie-tools/wepwawet/
 * wepwawet-send.py --air-frame), which airs it from the Parrot's
 * Bluetooth — or, without live, prints it and transmits nothing.
 *
 * The door is narrow on purpose: clients only from this machine,
 * the tailnet, or his private LAN (the bridge executes a local
 * program — it is never a public surface); the body is validated
 * to a single frame shape; the sender runs as an argv array, so
 * the hex is data, never code. Permission still gates the door
 * from the other side: the panel only reaches here through
 * sendDeviceCommand, which refuses before any channel is touched
 * when the dog's card lacks its grant.
 */
export const Route = createFileRoute("/api/devices/wepwawet")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { clientIpFromRequest } = await import("@/avatar/gateLogStore.server");
        const { bridgeClientAllowed, sanitizeBridgeRequest } = await import(
          "@/avatar/devices/wepwawetBridge"
        );
        const ip = clientIpFromRequest(request);
        if (!bridgeClientAllowed(ip)) {
          return Response.json(
            { ok: false, error: "the dog bridge answers only on this machine and the Captain's own networks" },
            { status: 403 },
          );
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 });
        }
        const frame = sanitizeBridgeRequest(body);
        if (!frame) {
          return Response.json(
            { ok: false, error: "invalid bridge frame — one 23-byte frame, its hold, and the live flag" },
            { status: 400 },
          );
        }
        const { runWepwawetFrame } = await import("@/avatar/devices/wepwawetBridge.server");
        const run = await runWepwawetFrame(frame);
        if (!run.ok) {
          return Response.json({ ok: false, error: run.error }, { status: run.status });
        }
        return Response.json({ ok: true, mode: run.mode, output: run.output });
      },
    },
  },
});
