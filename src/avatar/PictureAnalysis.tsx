/**
 * PICTURE ANALYSIS — Augie's analytic window (operator room).
 *
 * Part 27: the PRIMARY face is the small FloatingWindow on the stage
 * (AnalyticWindow); the /avatar/analyze page renders this same panel
 * as the secondary, full-page face. Two ways in: scan the room with
 * the live camera, or pick a picture file. Either way the image goes
 * to the Parrot's LOCAL Ollama vision model and the result comes back
 * as the picture WITH a short analysis AND a list of things found.
 * Nothing leaves this machine. When no vision model is installed, or
 * Ollama is not answering, the panel says so plainly — including when
 * Scan is pressed — and never invents a result.
 *
 * STREAMING (live defect fix, owner order 2026-11-22): the local
 * vision model runs CPU-only on the Parrot, so a full answer takes
 * minute-class time. The old request waited for the WHOLE answer
 * (stream: false) and the panel showed nothing until it landed —
 * over a minute of blank. Now the answer streams in token by token
 * like chat, an honest working line names the model and counts the
 * seconds from the first second, and any failure lands as a labeled
 * error on the surface — never a silent blank.
 *
 * MARKS + ORIENTATION (owner order 2026-11-23): the result picture
 * renders LARGE and hugging its frame (the old 40vh cap left a
 * small picture beside a void), every finding is NUMBERED and the
 * same number is drawn on the picture at the finding's place —
 * from a real second placement pass (analysisAnnotations), never
 * invented coordinates; a finding the model cannot place stays
 * unmarked and says so. Uploaded photos are turned upright from
 * their own EXIF orientation mark before they are shown OR read,
 * so the operator and the model see the same upright picture.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { loadBrainAddress } from "./brain";
import { parseAnalysis } from "./analysisParsing";
import { CANONICAL_VISION_MODEL } from "./visionModel";
import { PLACEMENT_FALLBACK_NOTE, placeFindings, type PlacedFinding } from "./analysisAnnotations";
import { normalizeImageOrientation } from "./imageOrientation";
import { AnnotatedAnalysis } from "./AnnotatedAnalysis";

const ANALYZE_PROMPT = [
  "You are the analytic window of Augie, a local AI assistant.",
  "Describe what you see in this image accurately and briefly: the main objects and layout,",
  "any people (count them only — never try to identify anyone), any readable text,",
  "and anything unusual or worth the operator's attention.",
  "If the image is dark, blurry or unclear, say so plainly. Never invent details.",
  "After the description, add a line that says FINDINGS: and then list each distinct thing",
  "you found, one per line, each starting with '- '. Keep the list to what is actually visible.",
].join(" ");

/** Installed-model names the room prefers, best first — the canonical
 * model (Part 26 unification) always wins when it is installed. */
const VISION_MODEL_PREFERENCE = [
  CANONICAL_VISION_MODEL,
  "llama3.2-vision",
  "llama3.2-vision:latest",
  "qwen2.5vl:7b",
  "moondream",
  "moondream:latest",
  "bakllava:7b",
  "llava:13b",
  "minicpm-v:8b",
  "gemma3:4b",
  "gemma3:12b",
] as const;

const VISION_NAME_RE = /(llava|vision|moondream|bakllava|minicpm-v|gemma3|qwen[0-9.]*vl)/i;

/** Local vision inference is slow; give a real answer time to arrive. */
const ANALYZE_TIMEOUT_MS = 120_000;

/** Choose the vision model to use from what Ollama actually has installed. */
export function pickVisionModel(installed: string[]): string | null {
  for (const want of VISION_MODEL_PREFERENCE) {
    if (installed.includes(want)) return want;
  }
  return installed.find((name) => VISION_NAME_RE.test(name)) ?? null;
}

/**
 * Read a streamed Ollama /api/generate response (NDJSON: one JSON
 * object per line, each carrying the next `response` fragment) and
 * accumulate the full text, calling onText with the running total as
 * each fragment lands — the panel renders the answer WHILE it is
 * being written instead of after a minute of blank (defect fix
 * 2026-11-22). Falls back to a plain JSON body when the response has
 * no readable stream.
 */
export async function collectGenerateStream(
  res: Response,
  onText: (textSoFar: string) => void,
): Promise<string> {
  if (!res.body) {
    const data = (await res.json()) as { response?: string };
    const text = data.response ?? "";
    if (text) onText(text);
    return text;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  const takeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const data = JSON.parse(trimmed) as { response?: string };
      if (data.response) {
        full += data.response;
        onText(full);
      }
    } catch {
      // A partial line split across chunks is buffered below; a line
      // that never parses is skipped, never shown as a result.
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) takeLine(line);
  }
  if (buffer.trim()) takeLine(buffer);
  return full;
}

export type VisionReading = { text: string; findings: string[]; model: string };

/**
 * The one vision path, callable outside this panel — the Cameras
 * surface sends a camera frame through the exact same route
 * (operator order 2026-11-23, camera run-3 follow-up): pick the
 * installed vision model the same way, stream /api/generate with
 * the same prompt, split description + findings the same way.
 * Throws an Error carrying a plain-words reason on any failure —
 * callers show the words and never dress up a result that did
 * not happen.
 */
export async function analyzeImageBase64(args: {
  brain: string;
  base64: string;
  onText?: (textSoFar: string) => void;
  fetchFn?: typeof fetch;
}): Promise<VisionReading> {
  const fetchFn = args.fetchFn ?? fetch;
  let installed: string[] = [];
  try {
    const res = await fetchFn(`${args.brain}/api/tags`);
    if (!res.ok) throw new Error(`Ollama answered ${res.status}`);
    const data = (await res.json()) as { models?: { name?: string }[] };
    installed = (data.models ?? []).map((m) => m.name).filter((n): n is string => Boolean(n));
  } catch {
    throw new Error(`the vision model is not answering at ${args.brain}`);
  }
  const model = pickVisionModel(installed);
  if (!model) {
    throw new Error(
      `no vision model is installed on the brain — picture analysis uses ${CANONICAL_VISION_MODEL}`,
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
  try {
    const res = await fetchFn(`${args.brain}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt: ANALYZE_PROMPT,
        images: [args.base64],
        stream: true,
        options: { num_predict: 220 },
      }),
    });
    if (!res.ok) throw new Error(`the vision model answered ${res.status}`);
    const full = (await collectGenerateStream(res, args.onText ?? (() => undefined))).trim();
    if (!full) throw new Error("the vision model returned an empty answer");
    const parsed = parseAnalysis(full);
    return { text: parsed.summary || full, findings: parsed.findings, model };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `the vision model did not finish within ${Math.round(ANALYZE_TIMEOUT_MS / 1000)} seconds`,
      );
    }
    throw err instanceof Error ? err : new Error("the vision request failed");
  } finally {
    clearTimeout(timer);
  }
}

type ModelState =
  | { status: "checking" }
  | { status: "ready"; model: string }
  | { status: "unavailable"; reason: string };

type Analysis = {
  text: string;
  findings: string[];
  model: string;
  at: number;
  source: string;
  /** The exact picture that was read (already turned upright). */
  image: string;
  /** The numbered marks on the picture: pending while the
   *  placement pass runs, placed with per-finding points, failed
   *  with a plain-words note — never silently absent. */
  marks:
    | { kind: "none" }
    | { kind: "pending" }
    | { kind: "placed"; items: PlacedFinding[] }
    | { kind: "failed"; note: string };
};

const panelStyle: React.CSSProperties = {
  border: "1px solid #26314a",
  borderRadius: "10px",
  padding: "12px",
  background: "#101623",
};
const buttonStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  padding: "10px 14px",
  borderRadius: "9px",
  border: "1px solid #3a4763",
  background: "#1a2336",
  color: "#eef2f7",
  cursor: "pointer",
};
const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#d4af37",
  borderColor: "#d4af37",
  color: "#141414",
};

/**
 * The picture being read, shown LARGE while the reading streams —
 * same hugging figure as the annotated result (width capped by the
 * panel and by a 68vh height cap converted through the picture's
 * own aspect), never a small picture beside a void.
 */
function LargePicture({ src, alt }: { src: string; alt: string }) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  return (
    <figure
      className="analyzer-figure"
      style={
        natural ? { width: `min(100%, ${(68 * natural.w) / natural.h}vh)` } : { width: "100%" }
      }
    >
      <img
        className="analyzer-figure__img"
        src={src}
        alt={alt}
        onLoad={(event) => {
          const img = event.currentTarget;
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          }
        }}
      />
    </figure>
  );
}

export function PictureAnalysis() {
  const [brain] = useState(() => loadBrainAddress());
  const [modelState, setModelState] = useState<ModelState>({ status: "checking" });
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Which pass is running: the reading itself, or the marker
   *  placement pass that follows it. */
  const [phase, setPhase] = useState<"reading" | "placing">("reading");
  /** Streaming state (defect fix 2026-11-22): the answer so far and
   * the seconds on the clock, both live from the first second. */
  const [streamText, setStreamText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  /** When the model was last checked, and what the check found — the
   * "Check again" button must VISIBLY report, never spin silently. */
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const checkModel = useCallback(async () => {
    setModelState({ status: "checking" });
    setLastChecked(null);
    try {
      const res = await fetch(`${brain}/api/tags`);
      if (!res.ok) throw new Error(`Ollama answered ${res.status}`);
      const data = (await res.json()) as { models?: { name?: string }[] };
      const installed = (data.models ?? [])
        .map((m) => m.name)
        .filter((n): n is string => Boolean(n));
      const model = pickVisionModel(installed);
      if (model) {
        setModelState({ status: "ready", model });
      } else {
        setModelState({
          status: "unavailable",
          reason: `Ollama is running, but no vision model is installed yet (installed: ${
            installed.join(", ") || "none"
          }). Picture analysis needs a vision model — this room uses ${CANONICAL_VISION_MODEL}.`,
        });
      }
    } catch {
      setModelState({
        status: "unavailable",
        reason: `Ollama is not answering at ${brain}. Picture analysis is unavailable until the brain is reachable.`,
      });
    } finally {
      // The check always lands somewhere visible: the status text above
      // changes AND the time is stamped, so "Check again" can never
      // look like it did nothing (Part 27).
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, [brain]);

  useEffect(() => {
    void checkModel();
  }, [checkModel]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraOn(true);
    } catch {
      setError(
        "The camera could not be opened. Allow camera access for this site, or analyze a picture file instead.",
      );
    }
  };

  const analyze = async (base64: string, source: string, dataUrl: string) => {
    if (modelState.status !== "ready" || !base64) return;
    const model = modelState.model;
    setBusy(true);
    setPhase("reading");
    setError("");
    setPreview(dataUrl);
    setStreamText("");
    setElapsed(0);
    const startedAt = Date.now();
    const clock = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
    let partial = "";
    try {
      const res = await fetch(`${brain}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt: ANALYZE_PROMPT,
          images: [base64],
          stream: true,
          options: { num_predict: 220 },
        }),
      });
      if (!res.ok) throw new Error(`the vision model answered ${res.status}`);
      const text = (
        await collectGenerateStream(res, (soFar) => {
          partial = soFar;
          setStreamText(soFar);
        })
      ).trim();
      if (!text) throw new Error("the vision model returned an empty answer");
      const parsed = parseAnalysis(text);
      const at = Date.now();
      setAnalysis({
        text: parsed.summary || text,
        findings: parsed.findings,
        model,
        at,
        source,
        image: dataUrl,
        marks: parsed.findings.length > 0 ? { kind: "pending" } : { kind: "none" },
      });
      if (parsed.findings.length > 0) {
        // The marker pass: the same model looks at the same picture
        // again and places each finding on the 0–1000 grid. A failed
        // pass falls back to the plain list and SAYS so — the marks
        // are never faked and never silently missing.
        setPhase("placing");
        const outcome = await placeFindings({ brain, base64, findings: parsed.findings });
        setAnalysis((prev) =>
          prev && prev.at === at
            ? {
                ...prev,
                marks:
                  outcome.status === "placed"
                    ? { kind: "placed", items: outcome.items }
                    : { kind: "failed", note: PLACEMENT_FALLBACK_NOTE },
              }
            : prev,
        );
      }
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      if (partial.trim()) {
        // Honest partial: the model was cut off mid-answer — show what
        // it actually produced, labeled as partial, never dressed up
        // as a finished analysis.
        const parsed = parseAnalysis(partial.trim());
        setAnalysis({
          text: parsed.summary || partial.trim(),
          findings: parsed.findings,
          model,
          at: Date.now(),
          source: `${source} — PARTIAL (timed out at ${Math.round(ANALYZE_TIMEOUT_MS / 1000)}s)`,
          image: dataUrl,
          marks:
            parsed.findings.length > 0
              ? {
                  kind: "failed",
                  note: "The reading was cut off partway, so nothing is marked on the picture — this is the plain list.",
                }
              : { kind: "none" },
        });
        setError(
          `The vision model timed out at ${Math.round(ANALYZE_TIMEOUT_MS / 1000)} seconds — the answer above is what it produced before the cut-off, labeled partial. Nothing was invented.`,
        );
      } else {
        setError(
          `Analysis unavailable: ${
            timedOut
              ? `the vision model did not answer within ${Math.round(ANALYZE_TIMEOUT_MS / 1000)} seconds`
              : err instanceof Error
                ? err.message
                : "the request failed"
          }. Nothing was invented — try again, or check that the vision model is installed.`,
        );
      }
    } finally {
      window.clearTimeout(timer);
      window.clearInterval(clock);
      setBusy(false);
      setStreamText("");
    }
  };

  /** Scan/upload with no usable model must SAY why, in plain words —
   * a silently disabled button reads as broken (Part 27). */
  const refuseWithoutModel = (): boolean => {
    if (modelState.status === "ready") return false;
    setError(
      modelState.status === "checking"
        ? "Still checking for the vision model — give it a second, then press Scan again."
        : `Scan can't run: ${modelState.reason}`,
    );
    return true;
  };

  const scanRoom = () => {
    if (refuseWithoutModel()) return;
    const video = videoRef.current;
    if (!video || !cameraOn) return;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const scale = Math.min(1, 1024 / width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Could not capture a frame from the camera.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    void analyze(dataUrl.split(",")[1] ?? "", "live camera scan", dataUrl);
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    if (refuseWithoutModel()) return;
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const [head, payload] = dataUrl.split(",", 2);
      const mime = /data:([^;]+)/.exec(head ?? "")?.[1] ?? file.type ?? "image/jpeg";
      void (async () => {
        // Turn the photo upright from its own EXIF mark BEFORE it is
        // shown or read — a sideways photo reads sideways (the model
        // itself reported a rotated frame, 2026-11-23).
        const normalized = await normalizeImageOrientation({
          base64: payload ?? "",
          mime,
        });
        const source = normalized.corrected
          ? `picture file (${file.name}) — turned upright from the photo's own orientation mark`
          : `picture file (${file.name})`;
        await analyze(normalized.base64, source, normalized.dataUrl);
      })();
    };
    reader.onerror = () => setError("That picture could not be read.");
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <section style={panelStyle} aria-label="Vision model status">
        {modelState.status === "checking" && (
          <p style={{ margin: 0 }}>Checking the local vision model…</p>
        )}
        {modelState.status === "ready" && (
          <p style={{ margin: 0 }}>
            Vision model ready: <b>{modelState.model}</b> — running locally on this machine at{" "}
            {brain}. Pictures are analyzed here; nothing is uploaded anywhere.
          </p>
        )}
        {modelState.status === "unavailable" && (
          <p style={{ margin: "0 0 8px" }} role="alert">
            {modelState.reason}
          </p>
        )}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => void checkModel()}
            disabled={modelState.status === "checking"}
          >
            {modelState.status === "checking" ? "Checking…" : "Check again"}
          </button>
          <span style={{ fontSize: "13px", color: "#9fb0c9" }} role="status">
            {lastChecked
              ? `Last checked ${lastChecked} — ${
                  modelState.status === "ready"
                    ? `${modelState.model} is ready`
                    : modelState.status === "checking"
                      ? "checking…"
                      : "no vision model available"
                }`
              : "Not checked yet this session."}
          </span>
        </div>
      </section>

      <section style={panelStyle} aria-label="Scan the room">
        <h2 style={{ margin: "0 0 8px", fontSize: "17px" }}>Scan the room</h2>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: "100%",
            maxHeight: "46vh",
            background: "#000",
            borderRadius: "8px",
            display: cameraOn ? "block" : "none",
          }}
        />
        {!cameraOn && (
          <p style={{ margin: "0 0 8px", color: "#9fb0c9" }}>
            The camera is off. Turn it on, point it at the room, then scan.
          </p>
        )}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {cameraOn ? (
            <button type="button" style={buttonStyle} onClick={stopCamera}>
              Stop camera
            </button>
          ) : (
            <button type="button" style={buttonStyle} onClick={() => void startCamera()}>
              Start camera
            </button>
          )}
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={scanRoom}
            disabled={!cameraOn || busy}
          >
            {busy
              ? phase === "placing"
                ? `Marking… ${elapsed}s`
                : `Analyzing… ${elapsed}s`
              : "Scan the room"}
          </button>
        </div>
      </section>

      <section style={panelStyle} aria-label="Analyze a picture file">
        <h2 style={{ margin: "0 0 8px", fontSize: "17px" }}>Analyze a picture</h2>
        <label style={{ display: "block", marginBottom: "8px", color: "#9fb0c9" }}>
          Pick a photo or screenshot from this device:
        </label>
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          aria-label="Picture file to analyze"
        />
      </section>

      {busy && phase === "reading" && (
        <section style={panelStyle} aria-label="Analysis in progress">
          <p style={{ margin: "0 0 8px" }} role="status">
            Analyzing with{" "}
            <b>{modelState.status === "ready" ? modelState.model : "the vision model"}</b>…{" "}
            {elapsed}s — running locally on this machine (CPU), so a full answer takes a while. The
            words appear below as the model writes them.
          </p>
          {streamText ? (
            (() => {
              const live = parseAnalysis(streamText);
              return (
                <>
                  <p style={{ margin: "0 0 8px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {live.summary || streamText}
                  </p>
                  {live.findings.length > 0 && (
                    <>
                      <h3 style={{ margin: "0 0 6px", fontSize: "15px" }}>Things found so far</h3>
                      <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: 1.5 }}>
                        {live.findings.map((finding, index) => (
                          <li key={`${index}-${finding}`}>{finding}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              );
            })()
          ) : (
            <p style={{ margin: 0, color: "#9fb0c9" }}>Waiting for the model's first words…</p>
          )}
        </section>
      )}

      {error && (
        <p role="alert" style={{ ...panelStyle, borderColor: "#ef4444", margin: 0 }}>
          {error}
        </p>
      )}

      {preview && !analysis && (
        <section style={panelStyle} aria-label="Analyzed image">
          <h2 style={{ margin: "0 0 8px", fontSize: "17px" }}>Analyzed image</h2>
          <LargePicture src={preview} alt="The picture being analyzed" />
        </section>
      )}

      {analysis && (
        <section style={panelStyle} aria-label="Analysis result">
          <h2 style={{ margin: "0 0 8px", fontSize: "17px" }}>Analysis</h2>
          <p style={{ margin: "0 0 8px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {analysis.text}
          </p>
          {analysis.findings.length > 0 && analysis.marks.kind !== "none" && (
            <>
              <h3 style={{ margin: "0 0 6px", fontSize: "15px" }}>Things found</h3>
              <AnnotatedAnalysis
                src={analysis.image}
                alt="The picture that was analyzed, with the things found marked on it"
                items={
                  analysis.marks.kind === "placed"
                    ? analysis.marks.items
                    : analysis.findings.map((text) => ({ text, point: null }))
                }
                marksMode={
                  analysis.marks.kind === "placed"
                    ? "placed"
                    : analysis.marks.kind === "failed"
                      ? "failed"
                      : "pending"
                }
                {...(analysis.marks.kind === "failed" ? { failureNote: analysis.marks.note } : {})}
              />
            </>
          )}
          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#9fb0c9" }}>
            Source: {analysis.source} · Model: {analysis.model} ·{" "}
            {new Date(analysis.at).toLocaleTimeString()} · Analyzed locally on the Parrot.
          </p>
        </section>
      )}
    </div>
  );
}
