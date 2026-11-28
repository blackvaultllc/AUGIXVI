/**
 * PHOTO CHECK — client poster.
 *
 * Hands the facts of one answered in-session picture ask to the
 * core (postPhotoCheck): what triggered it, how it ended, the
 * plain note, and the snapshot frame when a completed check
 * took one. Fire-and-forget by design — recording an answer
 * must never block or break the session; a failed post is
 * simply an answer the record does not hold, and the cadence
 * clock on this device still stands (see photoCheck.ts).
 */
import { postPhotoCheck } from "./photoCheck.server";
import type { PhotoCheckOutcome, PhotoCheckTrigger } from "./photoCheck";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read the snapshot."));
    reader.readAsDataURL(blob);
  });
}

export async function postPhotoCheckRecord(input: {
  trigger: PhotoCheckTrigger;
  outcome: PhotoCheckOutcome;
  note: string;
  photo: Blob | null;
}): Promise<void> {
  try {
    const photoBase64 =
      input.outcome === "completed" && input.photo ? await blobToBase64(input.photo) : undefined;
    await postPhotoCheck({
      data: {
        trigger: input.trigger,
        outcome: input.outcome,
        note: input.note,
        ...(photoBase64 ? { photoBase64 } : {}),
      },
    });
  } catch {
    /* the record never blocks the session */
  }
}
