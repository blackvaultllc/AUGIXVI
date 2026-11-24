/**
 * THE FLOWER'S REAL VOICE — Khadija's learner-scoped speech doorway
 * (owner order 2026-11-24: "the voice sounds all cracky — it should
 * sound more present, pleasant").
 *
 * The defect, plainly: her side spoke through the browser's raw
 * speechSynthesis with NO voice ever chosen, so her device used its
 * out-of-the-box default synth voice — on a child's tablet that is
 * the crackly robot voice he heard. The operator's side never had
 * this problem because it speaks through Piper on the core
 * (/api/say) — but that route is operator-side and stays outside
 * her wall.
 *
 * This doorway is the learner twin of /api/say: same Piper engine,
 * same installed voice (en_US-joe-medium — the pleasant voice the
 * Captain picked and confirmed), reached only from her page, for
 * her Flower's words only. Text in, WAV out. Where Piper is not
 * installed on the answering host it answers 503 with the reason
 * and her page falls back to the browser voice — with a voice
 * actually picked this time (see LearnerHome).
 */
import { synthesizeWithPiper } from "../piper.server";

export async function handleLearnerSayRequest(request: Request): Promise<Response> {
  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text : "";
  } catch {
    return Response.json({ error: "Expected a JSON body with a text field." }, { status: 400 });
  }
  if (!text.trim()) {
    return Response.json({ error: "Nothing to say — the text was empty." }, { status: 400 });
  }
  const result = await synthesizeWithPiper(text);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 503 });
  }
  return new Response(new Uint8Array(result.wav), {
    status: 200,
    headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
  });
}
