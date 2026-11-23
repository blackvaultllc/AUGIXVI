/**
 * CAMERA REGISTRY — every camera Augie can see through, as data
 * (operator order 2026-11-23: "Make sure he can access any camera
 * that I own" — a general RTSP/ONVIF camera system, the desk
 * SZSinocam dual-lens unit first).
 *
 * This module is the CLIENT-SAFE shape: names, addresses, ports,
 * stream paths, the device fingerprint, and the Permission Law
 * flags. It NEVER carries a password — credentials live only in
 * the server store (cameraStore.server.ts, mode 0600 on the core
 * machine) and cross the wire one way, from the Captain's hands in.
 *
 * Truth rule, same as the device registry: a field that was never
 * measured stays absent. A lens path is a claim only once a probe
 * or a frame grab proved the camera answers there.
 */

export type CameraLensKind = "fixed" | "ptz";

export type CameraLens = {
  /** Stable within the camera: "lens-1", "lens-2". */
  id: string;
  /** Plain name: "Fixed lens", "PTZ lens". */
  label: string;
  kind: CameraLensKind;
  /** RTSP path on the camera, e.g. "/tcp/av0_0" or "/ucast/11". */
  rtspPath: string;
  /** A frame was actually pulled from this path (probe-verified). */
  verified?: boolean | undefined;
};

export type CameraProfile = {
  id: string;
  name: string;
  /** IP or hostname on the Captain's own network. */
  host: string;
  /** RTSP port — 10554 on the O-KAM family, 554 on classic units. */
  rtspPort: number;
  /** ONVIF port — 10080 on the O-KAM family, 8080 on classic units. */
  onvifPort: number;
  /** Stream/ONVIF username ("admin" on the O-KAM family). */
  username: string;
  /** State only — the value itself lives in the server store. */
  hasPassword: boolean;
  lenses: CameraLens[];
  /* ---- the first-contact fingerprint (device mastery) ---- */
  manufacturer?: string | undefined;
  model?: string | undefined;
  firmware?: string | undefined;
  serial?: string | undefined;
  mac?: string | undefined;
  /** PTZ was driven and the lens obeyed (bench-proven control). */
  ptzVerified?: boolean | undefined;
  /* ---- THE PERMISSION LAW (operator order 2026-11-21) ---- */
  ownerConfirmed?: boolean | undefined;
  controlGranted?: boolean | undefined;
  notes?: string | undefined;
  addedAt: number;
};

/** The Permission Law for cameras: PTZ control needs both flags. */
export function cameraCanControl(camera: Pick<CameraProfile, "ownerConfirmed" | "controlGranted">): boolean {
  return camera.ownerConfirmed === true && camera.controlGranted === true;
}

/* ------------------------------ sanitize ------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function cleanPort(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 65535 ? v : fallback;
}

const MAX_LENSES = 8;

export function sanitizeLens(v: unknown, index: number): CameraLens | null {
  if (!isRecord(v)) return null;
  const rtspPath = cleanString(v["rtspPath"], 120);
  if (!rtspPath) return null;
  return {
    id: cleanString(v["id"], 48) ?? `lens-${index + 1}`,
    label: cleanString(v["label"], 60) ?? `Lens ${index + 1}`,
    kind: v["kind"] === "ptz" ? "ptz" : "fixed",
    rtspPath: rtspPath.startsWith("/") ? rtspPath : `/${rtspPath}`,
    verified: v["verified"] === true ? true : undefined,
  };
}

export function sanitizeCamera(v: unknown): CameraProfile | null {
  if (!isRecord(v)) return null;
  const name = cleanString(v["name"], 80);
  const host = cleanString(v["host"], 120);
  if (!name || !host) return null;
  const lenses = Array.isArray(v["lenses"])
    ? v["lenses"]
        .map((lens, i) => sanitizeLens(lens, i))
        .filter((l): l is CameraLens => l !== null)
        .slice(0, MAX_LENSES)
    : [];
  return {
    id: cleanString(v["id"], 64) ?? `camera-${Date.now()}`,
    name,
    host,
    rtspPort: cleanPort(v["rtspPort"], 554),
    onvifPort: cleanPort(v["onvifPort"], 8080),
    username: cleanString(v["username"], 60) ?? "admin",
    hasPassword: v["hasPassword"] === true,
    lenses,
    manufacturer: cleanString(v["manufacturer"], 80),
    model: cleanString(v["model"], 80),
    firmware: cleanString(v["firmware"], 80),
    serial: cleanString(v["serial"], 80),
    mac: cleanString(v["mac"], 40),
    ptzVerified: v["ptzVerified"] === true ? true : undefined,
    ownerConfirmed: v["ownerConfirmed"] === true ? true : undefined,
    controlGranted: v["controlGranted"] === true ? true : undefined,
    notes: cleanString(v["notes"], 400),
    addedAt: typeof v["addedAt"] === "number" ? v["addedAt"] : Date.now(),
  };
}

let cameraIdCounter = 0;
export function newCameraId(): string {
  cameraIdCounter += 1;
  return `camera-${Date.now()}-${cameraIdCounter}`;
}
