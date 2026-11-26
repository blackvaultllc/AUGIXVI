/**
 * CAMERA BRIDGE — node-only, server-side. Browsers cannot speak
 * RTSP, so the core machine dials the camera and re-serves the
 * picture in a shape Chromium plays natively:
 *
 *  - LIVE: ffmpeg reads the RTSP stream and transcodes to MJPEG
 *    (multipart/x-mixed-replace) — an <img> plays it directly.
 *    Sub-second latency class; ~10 fps at up to 960px wide, which
 *    is the honest cost of transcoding on the Parrot.
 *  - SNAPSHOT: one ffmpeg frame grab → one JPEG.
 *
 * The RTSP URL (which carries the camera password) is built here
 * from the server store and never leaves the server: it exists
 * only inside the ffmpeg child's argument list on this machine.
 */
import type { StoredCamera } from "../cameraStore.server";
import type { CameraLens } from "./cameraRegistry";

/** Build the camera's RTSP URL for one lens. Server-side only. */
export function rtspUrlFor(camera: StoredCamera, lens: CameraLens): string {
  const user = encodeURIComponent(camera.username);
  const pass = camera.password ? `:${encodeURIComponent(camera.password)}` : "";
  const auth = camera.password || camera.username ? `${user}${pass}@` : "";
  return `rtsp://${auth}${camera.host}:${camera.rtspPort}${lens.rtspPath}`;
}

export type BridgeSpawn = {
  stdout: NodeJS.ReadableStream;
  kill: () => void;
  /** Resolves with the exit code once the child ends. */
  done: Promise<number | null>;
};

type SpawnFn = (
  command: string,
  args: string[],
) => {
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  kill: (signal?: NodeJS.Signals) => void;
  on: (event: "exit", listener: (code: number | null) => void) => void;
};

async function spawnFfmpeg(args: string[]): Promise<BridgeSpawn | null> {
  try {
    const { spawn } = (await import("node:child_process")) as { spawn: SpawnFn };
    const child = spawn("ffmpeg", args);
    if (!child.stdout) return null;
    const done = new Promise<number | null>((resolve) => {
      child.on("exit", (code) => resolve(code));
    });
    return {
      stdout: child.stdout,
      kill: () => {
        try {
          child.kill("SIGKILL");
        } catch {
          // already gone
        }
      },
      done,
    };
  } catch {
    return null;
  }
}

/** Open a live MJPEG bridge for one lens. Null = ffmpeg unavailable here. */
export async function openLiveStream(camera: StoredCamera, lens: CameraLens): Promise<BridgeSpawn | null> {
  return spawnFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-rtsp_transport",
    "tcp",
    "-i",
    rtspUrlFor(camera, lens),
    "-an",
    "-vf",
    "scale='min(960,iw)':-2",
    "-r",
    "10",
    "-q:v",
    "5",
    "-f",
    "mpjpeg",
    "-",
  ]);
}

/**
 * Grab one frame as raw grayscale pixels (Camera Presence follow:
 * motion is measured between these, on the core, from the real
 * stream). Returns exactly width*height bytes or null.
 */
export async function grabGrayFrame(
  camera: StoredCamera,
  lens: CameraLens,
  width = 96,
  height = 54,
  timeoutMs = 12_000,
): Promise<Uint8Array | null> {
  const bridge = await spawnFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-rtsp_transport",
    "tcp",
    "-i",
    rtspUrlFor(camera, lens),
    "-an",
    "-frames:v",
    "1",
    "-vf",
    `scale=${width}:${height}`,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "gray",
    "-",
  ]);
  if (!bridge) return null;
  const chunks: Buffer[] = [];
  let size = 0;
  const want = width * height;
  const collected = new Promise<void>((resolve) => {
    bridge.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= want) bridge.kill();
    });
    bridge.stdout.on("end", resolve);
    bridge.stdout.on("error", resolve);
  });
  const timeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      bridge.kill();
      resolve();
    }, timeoutMs);
  });
  await Promise.race([collected, timeout]);
  const bytes = Buffer.concat(chunks);
  if (bytes.length < want) return null;
  return new Uint8Array(bytes.subarray(0, want));
}

/** Grab one frame as JPEG bytes. Null = unavailable or no frame in time. */
export async function grabSnapshot(
  camera: StoredCamera,
  lens: CameraLens,
  timeoutMs = 12_000,
): Promise<Buffer | null> {
  const bridge = await spawnFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-rtsp_transport",
    "tcp",
    "-i",
    rtspUrlFor(camera, lens),
    "-an",
    "-frames:v",
    "1",
    "-q:v",
    "3",
    "-f",
    "image2",
    "-",
  ]);
  if (!bridge) return null;
  const chunks: Buffer[] = [];
  let size = 0;
  const collected = new Promise<void>((resolve) => {
    bridge.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > 4_000_000) bridge.kill();
    });
    bridge.stdout.on("end", resolve);
    bridge.stdout.on("error", resolve);
  });
  const timeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      bridge.kill();
      resolve();
    }, timeoutMs);
  });
  await Promise.race([collected, timeout]);
  const bytes = Buffer.concat(chunks);
  // A real JPEG frame starts FFD8 and ends FFD9; anything else is not a frame.
  if (bytes.length > 1000 && bytes[0] === 0xff && bytes[1] === 0xd8) return bytes;
  return null;
}
