import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/cameras/stream?t=<operator token>&id=<camera>&lens=<lens>
 *
 * The live bridge: the server dials the camera's RTSP stream and
 * re-serves it as MJPEG (multipart/x-mixed-replace), which an
 * <img> plays natively in Chromium — no player library, no plugin.
 * Sub-second latency class at ~10 fps; the transcode runs on the
 * core machine (ffmpeg), never in the browser.
 *
 * Operator-only: the token is the same operator session every
 * other camera function verifies. The camera's own password never
 * appears here — the server store hands it to ffmpeg directly.
 *
 * Where ffmpeg or the store does not exist (the hosted Worker)
 * the route refuses honestly instead of faking a picture.
 */
export const Route = createFileRoute("/api/cameras/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("t") ?? "";
        const cameraId = url.searchParams.get("id") ?? "";
        const lensId = url.searchParams.get("lens") ?? "";
        if (!token || !cameraId || !lensId) {
          return new Response("missing stream parameters", { status: 400 });
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

        const { openLiveStream } = await import("@/avatar/cameras/cameraBridge.server");
        const bridge = await openLiveStream(camera, lens);
        if (!bridge) return new Response("camera bridge unavailable on this server", { status: 501 });

        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            bridge.stdout.on("data", (chunk: Buffer) => {
              try {
                controller.enqueue(new Uint8Array(chunk));
              } catch {
                bridge.kill();
              }
            });
            bridge.stdout.on("end", () => {
              try {
                controller.close();
              } catch {
                // already closed
              }
            });
            bridge.stdout.on("error", () => {
              try {
                controller.close();
              } catch {
                // already closed
              }
            });
          },
          cancel() {
            bridge.kill();
          },
        });
        request.signal.addEventListener("abort", () => bridge.kill());
        return new Response(body, {
          headers: {
            "Content-Type": "multipart/x-mixed-replace; boundary=ffmpeg",
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
