/**
 * THE REQUEST DOORWAY — Khadija's side of the "Ask for
 * something to be added" button (Captain's order 2026-11-26).
 * POST /api/learner/request with {text}.
 *
 * This doorway is on her allowlist BY DESIGN, under the same
 * law as her daddy doorway: it sends words OUT to her father —
 * the request lands in the core's section-requests record and
 * in his notifications — and it brings NOTHING back but a
 * thank-you. It opens no content, no tool, and no surface to
 * her; her education wall is unchanged in every other respect.
 */
import { fileSectionRequest } from "../sectionRequestsStore.server";
import { LEARNER_FULL_NAME } from "./learnerProfile";

/** POST /api/learner/request — her button's doorway. */
export async function handleLearnerRequest(request: Request): Promise<Response> {
  let body: { text?: unknown };
  try {
    body = (await request.json()) as { text?: unknown };
  } catch {
    return Response.json({ error: "That was not JSON." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return Response.json({ error: "No words were written for the request." }, { status: 400 });
  }
  const stored = await fileSectionRequest({
    from: "khadija",
    fromName: LEARNER_FULL_NAME,
    text,
  });
  if (!stored) {
    return Response.json(
      {
        ok: false,
        reason:
          "Your request could not reach the core from here — the record is not connected on this surface.",
      },
      { status: 503 },
    );
  }
  return Response.json({ ok: true, request: stored });
}
