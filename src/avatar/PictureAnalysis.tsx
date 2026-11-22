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
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { loadBrainAddress } from "./brain";
import { parseAnalysis } from "./analysisParsing";
import { CANONICAL_VISION_MODEL } from "./visionModel";

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

export function PictureAnalysis() {
  const [brain] = useState(() => loadBrainAddress());
  const [modelState, setModelState] = useState<ModelState>({ status: "checking" });
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    setError("");
    setPreview(dataUrl);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
    try {
      const res = await fetch(`${brain}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelState.model,
          prompt: ANALYZE_PROMPT,
          images: [base64],
          stream: false,
          options: { num_predict: 220 },
        }),
      });
      if (!res.ok) throw new Error(`the vision model answered ${res.status}`);
      const data = (await res.json()) as { response?: string };
      const text = (data.response ?? "").trim();
      if (!text) throw new Error("the vision model returned an empty answer");
      const parsed = parseAnalysis(text);
      setAnalysis({
        text: parsed.summary || text,
        findings: parsed.findings,
        model: modelState.model,
        at: Date.now(),
        source,
      });
    } catch (err) {
      setError(
        `Analysis unavailable: ${
          err instanceof Error ? err.message : "the request failed"
        }. Nothing was invented — try again, or check that the vision model is installed.`,
      );
    } finally {
      window.clearTimeout(timer);
      setBusy(false);
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
      void analyze(dataUrl.split(",")[1] ?? "", `picture file (${file.name})`, dataUrl);
    };
    reader.onerror = () => setError("That picture could not be read.");
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <section style={panelStyle} aria-label="Vision model status">
        {modelState.status === "checking" && <p style={{ margin: 0 }}>Checking the local vision model…</p>}
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
        <div
          style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}
        >
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
            {busy ? "Analyzing…" : "Scan the room"}
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

      {error && (
        <p role="alert" style={{ ...panelStyle, borderColor: "#ef4444", margin: 0 }}>
          {error}
        </p>
      )}

      {preview && (
        <section style={panelStyle} aria-label="Analyzed image">
          <h2 style={{ margin: "0 0 8px", fontSize: "17px" }}>Analyzed image</h2>
          <img
            src={preview}
            alt="The picture that was analyzed"
            style={{ maxWidth: "100%", maxHeight: "40vh", borderRadius: "8px" }}
          />
        </section>
      )}

      {analysis && (
        <section style={panelStyle} aria-label="Analysis result">
          <h2 style={{ margin: "0 0 8px", fontSize: "17px" }}>Analysis</h2>
          <p style={{ margin: "0 0 8px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{analysis.text}</p>
          {analysis.findings.length > 0 && (
            <>
              <h3 style={{ margin: "0 0 6px", fontSize: "15px" }}>Things found</h3>
              <ul style={{ margin: "0 0 8px", paddingLeft: "20px", lineHeight: 1.5 }}>
                {analysis.findings.map((finding, index) => (
                  <li key={`${index}-${finding}`}>{finding}</li>
                ))}
              </ul>
            </>
          )}
          <p style={{ margin: 0, fontSize: "13px", color: "#9fb0c9" }}>
            Source: {analysis.source} · Model: {analysis.model} ·{" "}
            {new Date(analysis.at).toLocaleTimeString()} · Analyzed locally on the Parrot.
          </p>
        </section>
      )}
    </div>
  );
}
