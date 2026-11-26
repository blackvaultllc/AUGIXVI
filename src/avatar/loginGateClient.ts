/**
 * LOGIN GATE — client poster.
 *
 * Hands the facts of one gate attempt to the core (postGateAttempt):
 * which door, how it ended, the gate's note, and the snapshot frame
 * when the camera was granted. Fire-and-forget by design — recording
 * an attempt must never block or break a sign-in; a failed post is
 * simply an attempt the log does not hold.
 */
import { postGateAttempt } from "./loginGate.server";
import type { GateAttemptResult, GateDoor } from "./loginGate";

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

export async function postGateAttemptRecord(input: {
  door: GateDoor;
  result: GateAttemptResult;
  namedAs: string | null;
  note: string;
  photo: Blob | null;
}): Promise<void> {
  try {
    const photoBase64 = input.photo ? await blobToBase64(input.photo) : undefined;
    await postGateAttempt({
      data: {
        door: input.door,
        result: input.result,
        namedAs: input.namedAs,
        note: input.note,
        ...(photoBase64 ? { photoBase64 } : {}),
      },
    });
  } catch {
    /* the doorbell never blocks the door */
  }
}
