/**
 * CAMERAS — the server half of the camera system (operator order
 * 2026-11-23). Operator-only in fact: every function re-verifies
 * the operator session before it reports, stores, probes, or
 * drives anything. What crosses the wire to the client is the
 * public registry (cameraRegistry.ts) and plain-word states. A
 * camera password goes one way — from the Captain's hands into
 * the server store — and is never read back out.
 *
 * PTZ is Permission-Law gated HERE, not just in the panel: a move
 * is refused unless the camera's card carries both his ownership
 * confirmation and his control grant, whatever the client asks.
 *
 * Where the local store does not exist (the Cloudflare Worker)
 * every function says so honestly — cameras are a LAN capability
 * of the core machine.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { getCameraStore, toPublicCamera, type StoredCamera } from "./cameraStore.server";
import {
  cameraCanControl,
  sanitizeCamera,
  type CameraProfile,
} from "./cameras/cameraRegistry";

type TokenInput = { accessToken: string };

function isTokenInput(input: unknown): input is TokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    typeof (input as TokenInput).accessToken === "string" &&
    (input as TokenInput).accessToken.length > 0 &&
    (input as TokenInput).accessToken.length <= 16_384
  );
}

async function authorized(accessToken: string): Promise<boolean> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return verification.authorized;
}

export type CamerasView = {
  authorized: boolean;
  /** False where there is no local store (the hosted Worker). */
  storageAvailable: boolean;
  cameras: CameraProfile[];
};

export const getCameras = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid cameras request.");
    return input;
  })
  .handler(async ({ data }): Promise<CamerasView> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, storageAvailable: false, cameras: [] };
    }
    const store = await getCameraStore();
    if (!store) return { authorized: true, storageAvailable: false, cameras: [] };
    const stored = await store.list();
    return { authorized: true, storageAvailable: true, cameras: stored.map(toPublicCamera) };
  });

export type SaveCameraInput = TokenInput & {
  camera: unknown;
  /** Write-only. Omit (or empty) to keep the stored password. */
  password?: string;
};

export type SaveCameraResult = { authorized: boolean; stored: boolean; note: string };

export const saveCamera = createServerFn({ method: "POST" })
  .validator((input: unknown): SaveCameraInput => {
    if (!isTokenInput(input) || typeof input !== "object" || input === null) {
      throw new Error("Invalid camera save request.");
    }
    return input as SaveCameraInput;
  })
  .handler(async ({ data }): Promise<SaveCameraResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, stored: false, note: "The operator session is gone — sign in again." };
    }
    const profile = sanitizeCamera(data.camera);
    if (!profile) {
      return { authorized: true, stored: false, note: "That camera entry is missing its name or address." };
    }
    const store = await getCameraStore();
    if (!store) {
      return {
        authorized: true,
        stored: false,
        note: "Cameras live on the core machine — this surface has no local store.",
      };
    }
    const password =
      typeof data.password === "string" && data.password.length > 0 ? data.password : undefined;
    const stored: StoredCamera = { ...profile, password };
    await store.upsert(stored);
    return { authorized: true, stored: true, note: `${profile.name} is registered.` };
  });

export type RemoveCameraInput = TokenInput & { cameraId: string };

export const removeCamera = createServerFn({ method: "POST" })
  .validator((input: unknown): RemoveCameraInput => {
    if (!isTokenInput(input) || typeof (input as RemoveCameraInput).cameraId !== "string") {
      throw new Error("Invalid camera remove request.");
    }
    return input as RemoveCameraInput;
  })
  .handler(async ({ data }): Promise<SaveCameraResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, stored: false, note: "The operator session is gone — sign in again." };
    }
    const store = await getCameraStore();
    if (!store) return { authorized: true, stored: false, note: "No local camera store here." };
    await store.remove(data.cameraId);
    return { authorized: true, stored: true, note: "Camera removed from the registry." };
  });

/* ------------------------------- probe ------------------------------- */

export type LensProbe = {
  lensId: string;
  /** A real frame was pulled from this lens path. */
  frame: boolean;
  /** Plain-word outcome: "frame pulled", "no answer", … */
  state: string;
};

export type ProbeResult = {
  authorized: boolean;
  reachable: boolean;
  /** ONVIF states: ok / auth-refused / unreachable / not-tried. */
  onvif: string;
  fingerprint: { manufacturer?: string; model?: string; firmware?: string; serial?: string } | null;
  lenses: LensProbe[];
  note: string;
};

export type ProbeInput = TokenInput & { cameraId: string };

export const probeCamera = createServerFn({ method: "POST" })
  .validator((input: unknown): ProbeInput => {
    if (!isTokenInput(input) || typeof (input as ProbeInput).cameraId !== "string") {
      throw new Error("Invalid camera probe request.");
    }
    return input as ProbeInput;
  })
  .handler(async ({ data }): Promise<ProbeResult> => {
    const denied: ProbeResult = {
      authorized: false,
      reachable: false,
      onvif: "not-tried",
      fingerprint: null,
      lenses: [],
      note: "The operator session is gone — sign in again.",
    };
    if (!(await authorized(data.accessToken))) return denied;
    const store = await getCameraStore();
    if (!store) return { ...denied, authorized: true, note: "No local camera store here." };
    const camera = await store.get(data.cameraId);
    if (!camera) return { ...denied, authorized: true, note: "That camera is not in the registry." };

    const { onvifDeviceInfo, onvifProfiles, onvifStreamUri } = await import(
      "./cameras/onvifClient.server"
    );
    const { grabSnapshot } = await import("./cameras/cameraBridge.server");

    const info = await onvifDeviceInfo(
      camera.host,
      camera.onvifPort,
      camera.username,
      camera.password ?? "",
    );

    // When ONVIF answers, its own stream URIs are the authoritative
    // lens map — a dual-lens unit names both lenses there. Adopt
    // the URI paths by order (fixed first, PTZ second) so the
    // registry holds the camera's own answers, not our guesses.
    const effective: StoredCamera = { ...camera, lenses: camera.lenses.map((l) => ({ ...l })) };
    if (info.state === "ok" && info.value.mediaUrl) {
      const profiles = await onvifProfiles(info.value.mediaUrl, camera.username, camera.password ?? "");
      if (profiles.state === "ok") {
        for (let i = 0; i < Math.min(profiles.value.length, effective.lenses.length); i++) {
          const profileEntry = profiles.value[i];
          const targetLens = effective.lenses[i];
          if (!profileEntry || !targetLens) continue;
          const uri = await onvifStreamUri(
            info.value.mediaUrl,
            camera.username,
            camera.password ?? "",
            profileEntry.token,
          );
          if (uri.state === "ok") {
            try {
              const parsed = new URL(uri.value);
              if (parsed.pathname) targetLens.rtspPath = parsed.pathname;
              const port = Number(parsed.port);
              if (port >= 1 && port <= 65535) effective.rtspPort = port;
            } catch {
              // unparseable URI — keep the registered path
            }
          }
        }
      }
    }

    const lenses: LensProbe[] = [];
    let anyFrame = false;
    for (const lens of effective.lenses) {
      const frame = await grabSnapshot(effective, lens, 10_000);
      if (frame) anyFrame = true;
      lenses.push({
        lensId: lens.id,
        frame: frame !== null,
        state: frame ? "frame pulled" : "no frame — path silent or refused",
      });
    }

    // Persist what the probe PROVED: ONVIF lens paths, verified
    // lens paths, and the fingerprint the unit itself reported.
    const updated: StoredCamera = {
      ...effective,
      manufacturer: info.state === "ok" ? (info.value.manufacturer ?? camera.manufacturer) : camera.manufacturer,
      model: info.state === "ok" ? (info.value.model ?? camera.model) : camera.model,
      firmware: info.state === "ok" ? (info.value.firmware ?? camera.firmware) : camera.firmware,
      serial: info.state === "ok" ? (info.value.serial ?? camera.serial) : camera.serial,
      lenses: effective.lenses.map((lens) => ({
        ...lens,
        verified: lenses.find((l) => l.lensId === lens.id)?.frame ? true : lens.verified,
      })),
    };
    await store.upsert(updated);

    return {
      authorized: true,
      reachable: anyFrame || info.state !== "unreachable",
      onvif: info.state,
      fingerprint:
        info.state === "ok"
          ? {
              ...(info.value.manufacturer ? { manufacturer: info.value.manufacturer } : {}),
              ...(info.value.model ? { model: info.value.model } : {}),
              ...(info.value.firmware ? { firmware: info.value.firmware } : {}),
              ...(info.value.serial ? { serial: info.value.serial } : {}),
            }
          : null,
      lenses,
      note: anyFrame
        ? "The camera answered — frames pulled from the lens paths marked verified."
        : info.state === "auth-refused"
          ? "The camera is there but refused the login — the device password in the registry does not match the one set in its app."
          : "Nothing answered at that address. On the O-KAM family, ONVIF and RTSP stay off until a device password is set in the app.",
    };
  });

/* -------------------------------- PTZ -------------------------------- */

export type PtzInput = TokenInput & {
  cameraId: string;
  /** -1..1 each; all zero + stop=true ends a move. */
  pan: number;
  tilt: number;
  zoom: number;
  stop?: boolean;
};

export type PtzResult = { authorized: boolean; moved: boolean; note: string };

export const ptzCamera = createServerFn({ method: "POST" })
  .validator((input: unknown): PtzInput => {
    if (!isTokenInput(input) || typeof (input as PtzInput).cameraId !== "string") {
      throw new Error("Invalid PTZ request.");
    }
    return input as PtzInput;
  })
  .handler(async ({ data }): Promise<PtzResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, moved: false, note: "The operator session is gone — sign in again." };
    }
    const store = await getCameraStore();
    if (!store) return { authorized: true, moved: false, note: "No local camera store here." };
    const camera = await store.get(data.cameraId);
    if (!camera) return { authorized: true, moved: false, note: "That camera is not in the registry." };
    if (!cameraCanControl(camera)) {
      return {
        authorized: true,
        moved: false,
        note: "Control is not granted for this camera — the Permission Law holds it to observation only.",
      };
    }
    // THE ALL-STOP gates camera sends too (Camera Presence pass,
    // 2026-11-26): the same halt flag the device bridge checks.
    const { allStopInForce, stopPatrol } = await import("./cameraPresenceRuntime.server");
    if (await allStopInForce()) {
      return {
        authorized: true,
        moved: false,
        note: "Refused — the ALL-STOP is in force. The Captain releases it from his Devices window.",
      };
    }
    // A direct move ends any patrol on this camera — the pad is
    // the Captain's hand on the lens, and the patrol yields.
    if (!data.stop) await stopPatrol(data.cameraId, "a direct PTZ move replaced it");
    const lens = camera.lenses.find((l) => l.kind === "ptz");
    if (!lens) return { authorized: true, moved: false, note: "This camera has no PTZ lens registered." };

    const { onvifDeviceInfo, onvifProfiles, onvifPtzMove, onvifPtzStop } = await import(
      "./cameras/onvifClient.server"
    );
    const info = await onvifDeviceInfo(camera.host, camera.onvifPort, camera.username, camera.password ?? "");
    if (info.state !== "ok") {
      return {
        authorized: true,
        moved: false,
        note:
          info.state === "auth-refused"
            ? "The camera refused the login — check the device password."
            : "The camera's ONVIF door did not answer.",
      };
    }
    if (!info.value.ptzUrl || !info.value.mediaUrl) {
      return { authorized: true, moved: false, note: "This camera does not offer an ONVIF PTZ service." };
    }
    const profiles = await onvifProfiles(info.value.mediaUrl, camera.username, camera.password ?? "");
    if (profiles.state !== "ok" || !profiles.value.length) {
      return { authorized: true, moved: false, note: "The camera offered no media profiles to drive." };
    }
    // Dual-lens units expose the PTZ lens as the second profile; a
    // single-profile unit drives its only profile.
    const profile = profiles.value.length > 1 ? profiles.value[1] : profiles.value[0];
    if (!profile) {
      return { authorized: true, moved: false, note: "The camera offered no media profiles to drive." };
    }
    const result = data.stop
      ? await onvifPtzStop(info.value.ptzUrl, camera.username, camera.password ?? "", profile.token)
      : await onvifPtzMove(info.value.ptzUrl, camera.username, camera.password ?? "", profile.token, {
          pan: data.pan,
          tilt: data.tilt,
          zoom: data.zoom,
        });
    if (result.state !== "ok") {
      return { authorized: true, moved: false, note: "The camera did not accept the move." };
    }
    if (!camera.ptzVerified && !data.stop) {
      await store.upsert({ ...camera, ptzVerified: true });
    }
    return { authorized: true, moved: true, note: data.stop ? "PTZ stopped." : "PTZ moving." };
  });
