/**
 * LOGIN GATE — endpoints.
 *
 * postGateAttempt is the doorbell's bell-push: it takes the facts of
 * an attempt at the gate (which door, how it ended, the gate's note,
 * and — when the camera was granted — ONE snapshot frame as base64)
 * and writes them into the core-side gate store. It is deliberately
 * NOT behind a session: a doorbell records whoever stands at the
 * door, signed in or not, and a refused stranger has no session to
 * present. What it accepts is tightly fenced — plain fields from a
 * fixed set, a capped note, a capped photo that must decode as
 * bytes the store re-checks — and the timestamp is the server's,
 * never the caller's.
 *
 * Reading is the opposite: getGateAttempts and getGateAttemptPhoto
 * verify the operator session with the exact same check the gate
 * log uses (registry ownership plus MFA assurance) before a single
 * record or photo byte is returned. The records hold faces of
 * people who tried his gate; they are operator-only in fact.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import {
  GATE_ATTEMPT_RESULTS,
  isGatePhotoName,
  type GateAttemptRecord,
  type GateAttemptResult,
  type GateDoor,
} from "./loginGate";
import {
  GATE_PHOTO_MAX_BYTES,
  readGateAttemptPhoto,
  readGateAttempts,
  recordGateAttempt,
} from "./loginGateStore.server";

/* ---------------- recording (the doorbell) ---------------- */

export interface GateAttemptPost {
  door: GateDoor;
  result: GateAttemptResult;
  namedAs: string | null;
  note: string;
  /** One JPEG frame, base64 — present only when the camera was granted. */
  photoBase64?: string;
}

const NOTE_MAX_CHARS = 512;
const NAME_MAX_CHARS = 64;
/** base64 of the largest accepted photo, with headroom. */
const PHOTO_BASE64_MAX_CHARS = Math.ceil((GATE_PHOTO_MAX_BYTES * 4) / 3) + 1024;

function isGateAttemptPost(input: unknown): input is GateAttemptPost {
  if (typeof input !== "object" || input === null) return false;
  const p = input as Record<string, unknown>;
  if (p["door"] !== "operator" && p["door"] !== "learner") return false;
  if (
    typeof p["result"] !== "string" ||
    !(GATE_ATTEMPT_RESULTS as readonly string[]).includes(p["result"])
  ) {
    return false;
  }
  if (
    !(
      p["namedAs"] === null ||
      (typeof p["namedAs"] === "string" && p["namedAs"].length <= NAME_MAX_CHARS)
    )
  ) {
    return false;
  }
  if (typeof p["note"] !== "string" || p["note"].length > NOTE_MAX_CHARS) return false;
  if (
    p["photoBase64"] !== undefined &&
    (typeof p["photoBase64"] !== "string" || p["photoBase64"].length > PHOTO_BASE64_MAX_CHARS)
  ) {
    return false;
  }
  return true;
}

function decodePhoto(photoBase64: string | undefined): Uint8Array | null {
  if (!photoBase64) return null;
  try {
    const bytes = Buffer.from(photoBase64, "base64");
    if (bytes.byteLength === 0 || bytes.byteLength > GATE_PHOTO_MAX_BYTES) return null;
    // A snapshot frame is a JPEG: it starts with the JPEG magic.
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    return bytes;
  } catch {
    return null;
  }
}

export const postGateAttempt = createServerFn({ method: "POST" })
  .validator((input: unknown): GateAttemptPost => {
    if (!isGateAttemptPost(input)) {
      throw new Error("Invalid gate attempt record.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<{ recorded: boolean }> => {
    const record: GateAttemptRecord = {
      ts: new Date().toISOString(),
      door: data.door,
      result: data.result,
      namedAs: data.namedAs,
      note: data.note,
      photoFile: null,
    };
    const recorded = await recordGateAttempt(record, decodePhoto(data.photoBase64));
    return { recorded };
  });

/* ---------------- reading (operator only) ---------------- */

type AccessTokenInput = { accessToken: string };

function isAccessTokenInput(input: unknown): input is AccessTokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "accessToken" in input &&
    typeof input.accessToken === "string" &&
    input.accessToken.length > 0 &&
    input.accessToken.length <= 16_384
  );
}

export interface GateAttemptsView {
  configured: boolean;
  authorized: boolean;
  /** False where the local gate store does not exist (e.g. the Worker). */
  available: boolean;
  entries: GateAttemptRecord[];
  total: number;
}

export const getGateAttempts = createServerFn({ method: "POST" })
  .validator((input: unknown): AccessTokenInput => {
    if (!isAccessTokenInput(input)) {
      throw new Error("Invalid gate attempts request.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<GateAttemptsView> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) {
      return {
        configured: verification.configured,
        authorized: false,
        available: false,
        entries: [],
        total: 0,
      };
    }
    const log = await readGateAttempts();
    return {
      configured: true,
      authorized: true,
      available: log.available,
      entries: log.entries,
      total: log.total,
    };
  });

type GatePhotoInput = { accessToken: string; photoFile: string };

function isGatePhotoInput(input: unknown): input is GatePhotoInput {
  if (!isAccessTokenInput(input)) return false;
  const p = input as Record<string, unknown>;
  return typeof p["photoFile"] === "string" && isGatePhotoName(p["photoFile"]);
}

export interface GatePhotoView {
  authorized: boolean;
  /** A data URL for the snapshot, or null when there is none to show. */
  dataUrl: string | null;
}

export const getGateAttemptPhoto = createServerFn({ method: "POST" })
  .validator((input: unknown): GatePhotoInput => {
    if (!isGatePhotoInput(input)) {
      throw new Error("Invalid gate photo request.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<GatePhotoView> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) return { authorized: false, dataUrl: null };
    const bytes = await readGateAttemptPhoto(data.photoFile);
    if (!bytes) return { authorized: true, dataUrl: null };
    return {
      authorized: true,
      dataUrl: `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`,
    };
  });
