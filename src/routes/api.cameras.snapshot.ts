import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/cameras/snapshot?t=<operator token>&id=<camera>&lens=<lens>
 *
 * One frame, grabbed by the server from the camera's RTSP stream
 * and returned as a single JPEG. Same operator gate and same
 * honesty rules as the live bridge: no frame in time → 502 with
 * plain words, never a stale or fabricated picture.
 */
export const Route = createFileRoute("/api/cameras/snapshot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("t") ?? "";
        const cameraId = url.searchParams.get("id") ?? "";
        const lensId = url.searchParams.get("lens") ?? "";
        if (!token || !cameraId || !lensId) {
          return new Response("missing snapshot parameters", { status: 400 });
        }
        const { verifySupabaseOperatorSession } = await import("@/avatar/operatorAuth.server");
        const verification = await verifySupabaseOperatorSession({ data: { accessToken: token } });
        if (!verification.authorized) {
          return new Response("operator session required", { status: 403 });
        }
        const { getCameraStore } = await import("@/avatar/cameraStore.server");
        const store = await getCameraStore();
        if (!store) return new Response("camera bridge unavailable on this server", { status: 501 });
        const camera = await store.get(cameraId);
        if (!camera) return new Response("camera not registered", { status: 404 });
        const lens = camera.lenses.find((l) => l.id === lensId);
        if (!lens) return new Response("lens not registered", { status: 404 });

        const { grabSnapshot } = await import("@/avatar/cameras/cameraBridge.server");
        const frame = await grabSnapshot(camera, lens);
        if (!frame) {
          return new Response("no frame from that lens — path silent or refused", { status: 502 });
        }
        return new Response(new Uint8Array(frame), {
          headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
