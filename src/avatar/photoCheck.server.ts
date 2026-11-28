/**
 * PHOTO CHECK — endpoints.
 *
 * postPhotoCheck takes the facts of one ANSWERED in-session
 * picture ask (see photoCheck.ts for the law): what triggered
 * it, how it ended, a plain note, and — only on a completed
 * check — ONE snapshot frame as base64, and writes them into
 * the core-side photo-check store. It follows the gate
 * doorbell's discipline exactly: the write is fenced to plain
 * fields from fixed sets, the note is capped, the photo must
 * decode as a capped JPEG, and the timestamp is the server's,
 * never the caller's. A declined or camera-failed post carrying
 * a photo is refused outright — a "no" with a picture attached
 * is not a record this house writes.
 *
 * Reading is operator-only: getPhotoChecks and
 * getPhotoCheckPhoto verify the operator session with the exact
 * same check the gate log uses (registry ownership plus MFA
 * assurance) before a single record or photo byte is returned.
 * The records can hold the Captain's face; they are
 * operator-only in fact.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import {
  PHOTO_CHECK_OUTCOMES,
  PHOTO_CHECK_TRIGGERS,
  isPhotoCheckPhotoName,
  type PhotoCheckOutcome,
  type PhotoCheckRecord,
  type PhotoCheckTrigger,
} from "./photoCheck";
import {
  PHOTO_CHECK_PHOTO_MAX_BYTES,
  readPhotoCheckPhoto,
  readPhotoChecks,
  recordPhotoCheck,
} from "./photoCheckStore.server";

/* ---------------- recording (the answered ask) ---------------- */

export interface PhotoCheckPost {
  trigger: PhotoCheckTrigger;
  outcome: PhotoCheckOutcome;
  note: string;
  /** One JPEG frame, base64 — present only on a completed check. */
  photoBase64?: string;
}

const NOTE_MAX_CHARS = 512;
/** base64 of the largest accepted photo, with headroom. */
const PHOTO_BASE64_MAX_CHARS = Math.ceil((PHOTO_CHECK_PHOTO_MAX_BYTES * 4) / 3) + 1024;

function isPhotoCheckPost(input: unknown): input is PhotoCheckPost {
  if (typeof input !== "object" || input === null) return false;
  const p = input as Record<string, unknown>;
  if (!(PHOTO_CHECK_TRIGGERS as readonly string[]).includes(p["trigger"] as string)) return false;
  if (!(PHOTO_CHECK_OUTCOMES as readonly string[]).includes(p["outcome"] as string)) return false;
  if (typeof p["note"] !== "string" || p["note"].length > NOTE_MAX_CHARS) return false;
  if (
    p["photoBase64"] !== undefined &&
    (typeof p["photoBase64"] !== "string" || p["photoBase64"].length > PHOTO_BASE64_MAX_CHARS)
  ) {
    return false;
  }
  // The law at the fence: a picture rides ONLY a completed check.
  if (p["photoBase64"] !== undefined && p["outcome"] !== "completed") return false;
  return true;
}

function decodePhoto(photoBase64: string | undefined): Uint8Array | null {
  if (!photoBase64) return null;
  try {
    const bytes = Buffer.from(photoBase64, "base64");
    if (bytes.byteLength === 0 || bytes.byteLength > PHOTO_CHECK_PHOTO_MAX_BYTES) return null;
    // A snapshot frame is a JPEG: it starts with the JPEG magic.
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    return bytes;
  } catch {
    return null;
  }
}

export const postPhotoCheck = createServerFn({ method: "POST" })
  .validator((input: unknown): PhotoCheckPost => {
    if (!isPhotoCheckPost(input)) {
      throw new Error("Invalid photo check record.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<{ recorded: boolean }> => {
    const record: PhotoCheckRecord = {
      ts: new Date().toISOString(),
      trigger: data.trigger,
      outcome: data.outcome,
      note: data.note,
      photoFile: null,
    };
    const recorded = await recordPhotoCheck(record, decodePhoto(data.photoBase64));
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

export interface PhotoChecksView {
  configured: boolean;
  authorized: boolean;
  /** False where the local photo-check store does not exist (e.g. the Worker). */
  available: boolean;
  entries: PhotoCheckRecord[];
  total: number;
}

export const getPhotoChecks = createServerFn({ method: "POST" })
  .validator((input: unknown): AccessTokenInput => {
    if (!isAccessTokenInput(input)) {
      throw new Error("Invalid photo checks request.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<PhotoChecksView> => {
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
    const log = await readPhotoChecks();
    return {
      configured: true,
      authorized: true,
      available: log.available,
      entries: log.entries,
      total: log.total,
    };
  });

type PhotoCheckPhotoInput = { accessToken: string; photoFile: string };

function isPhotoCheckPhotoInput(input: unknown): input is PhotoCheckPhotoInput {
  if (!isAccessTokenInput(input)) return false;
  const p = input as Record<string, unknown>;
  return typeof p["photoFile"] === "string" && isPhotoCheckPhotoName(p["photoFile"]);
}

export interface PhotoCheckPhotoView {
  authorized: boolean;
  /** A data URL for the snapshot, or null when there is none to show. */
  dataUrl: string | null;
}

export const getPhotoCheckPhoto = createServerFn({ method: "POST" })
  .validator((input: unknown): PhotoCheckPhotoInput => {
    if (!isPhotoCheckPhotoInput(input)) {
      throw new Error("Invalid photo check photo request.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<PhotoCheckPhotoView> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) return { authorized: false, dataUrl: null };
    const bytes = await readPhotoCheckPhoto(data.photoFile);
    if (!bytes) return { authorized: true, dataUrl: null };
    return {
      authorized: true,
      dataUrl: `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`,
    };
  });
