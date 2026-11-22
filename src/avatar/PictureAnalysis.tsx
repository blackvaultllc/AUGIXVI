/**
 * PICTURE ANALYSIS — Augie's analytic window (operator room).
 *
 * Two ways in: scan the room with the live camera, or pick a picture
 * file. Either way the image goes to the Parrot's LOCAL Ollama vision
 * model and the analysis comes back as text on this page. Nothing
 * leaves this machine. When no vision model is installed, or Ollama is
 * not answering, the room says so plainly — it never invents a result.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { loadBrainAddress } from "./brain";

const ANALYZE_PROMPT = [
  "You are the analytic window of Augie, a local AI assistant.",
  "Look at this image and answer in EXACTLY this shape:",
  "First, a summary of one or two sentences describing the scene accurately.",
  "Then a line containing only the word FINDINGS:",
  "Then a list, one item per line, each line starting with '- ', naming each thing you found:",
  "the main objects and layout, any people (count them only — never try to identify anyone),",
  "any readable text, and anything unusual or worth the operator's attention.",
  "If the image is dark, blurry or unclear, say so plainly in the summary. Never invent details.",
].join(" ");

/**
 * Part 27: split the model's answer into the summary + the findings
 * list the window displays beside the picture. If the model did not
 * follow the shape, the whole answer is the summary and the list is
 * empty — the window says so rather than faking items.
 */
export function parseFindings(text: string): { summary: string; findings: string[] } {
  const marker = text.search(/^\s*FINDINGS:\s*$/im);
  if (marker === -1) return { summary: text.trim(), findings: [] };
  const summary = text.slice(0, marker).trim();
  const rest = text.slice(marker).replace(/^\s*FINDINGS:\s*/i, "");
  const findings = rest
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0);
  return { summary, findings };
}

/** Installed-model names the room prefers, best first. */
const VISION_MODEL_PREFERENCE = [
  "llava:7b",
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
  summary: string;
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
  /** Part 27: "Check again" must VISIBLY do something — the status
   *  panel shows when the last check ran and what it found. */
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const checkModel = useCallback(async () => {
    setModelState({ status: "checking" });
    setLastCheckedAt(Date.now());
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
          }). Picture analysis needs a vision model — this room uses llava:7b.`,
        });
      }
    } catch {
      setModelState({
        status: "unavailable",
        reason: `Ollama is not answering at ${brain}. Picture analysis is unavailable until the brain is reachable.`,
      });
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
    if (modelState.status !== "ready") {
      // Explain, never silently swallow the attempt (Part 27).
      setError(
        modelState.status === "unavailable"
          ? `That picture can't be analyzed yet: ${modelState.reason}`
          : "Still checking the vision model — give it a second, then try again.",
      );
      return;
    }
    if (!base64) return;
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
      const { summary, findings } = parseFindings(text);
      setAnalysis({ text, summary, findings, model: modelState.model, at: Date.now(), source });
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

  const scanRoom = () => {
    // Part 27: NO silent no-ops. Every path out of this button says
    // something in the window — a dead-feeling button is a defect.
    if (modelState.status !== "ready") {
      setError(
        modelState.status === "checking"
          ? "Still checking the vision model — give it a second, then scan again."
          : `Scan can't run yet: ${modelState.status === "unavailable" ? modelState.reason : "the vision model is not ready."}`,
      );
      return;
    }
    const video = videoRef.current;
    if (!video || !cameraOn) {
      setError("The camera is off — press Start camera first, then scan the room.");
      return;
    }
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
          <p style={{ margin: 0 }} role="alert">
            {modelState.reason}
          </p>
        )}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px", flexWrap: "wrap" }}>
          <button type="button" style={buttonStyle} onClick={() => void checkModel()}>
            Check again
          </button>
          {lastCheckedAt !== null && (
            <span style={{ fontSize: "13px", color: "#9fb0c9" }}>
              Last checked {new Date(lastCheckedAt).toLocaleTimeString()} —{" "}
              {modelState.status === "ready"
                ? `${modelState.model} is installed and answering.`
                : modelState.status === "checking"
                  ? "checking now…"
                  : "no vision model yet (see above)."}
            </span>
          )}
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
            disabled={busy}
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
          <p style={{ margin: "0 0 8px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {analysis.summary}
          </p>
          <h3 style={{ margin: "0 0 6px", fontSize: "15px" }}>Things found</h3>
          {analysis.findings.length > 0 ? (
            <ul style={{ margin: "0 0 8px", paddingLeft: "1.2rem", lineHeight: 1.55 }}>
              {analysis.findings.map((finding, i) => (
                <li key={i}>{finding}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: "0 0 8px", color: "#9fb0c9" }}>
              The model described the picture but did not return an item list this time —
              nothing has been invented to fill it.
            </p>
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
