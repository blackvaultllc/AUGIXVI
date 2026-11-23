/**
 * VOICE INDICATOR (owner order 2026-11-22) — "an indicator graph
 * that shows when voice is being heard or not, so I know Anubis
 * and the other constructs are hearing me."
 *
 * Two honest parts, one small box:
 *  1. THE GRAPH — a scrolling level graph fed ONLY by the local
 *     ear's measured microphone level (LocalEar.subscribeLevel,
 *     the same RMS the ear itself uses to detect speech). He
 *     speaks, the graph moves with his real voice; silence, it
 *     sits flat. There is no idle animation and no canned motion:
 *     when the mic closes the ear emits a true 0 and the graph
 *     settles flat on the truth.
 *  2. THE STATE — HEARING YOU / NOT HEARING in plain words for the
 *     construct he is addressing (the `addressee` prop — Anubis by
 *     default, a called god when he is talking to that god), with
 *     the reason underneath whenever it is NOT HEARING, derived
 *     from the ear's real state by voiceHearing.ts. Never a false
 *     green.
 *
 * Self-contained: it takes the ear (or anything shaped like it),
 * subscribes itself, and styles itself — the stage mounts it with
 * one element and no other wiring.
 */
import { useEffect, useRef, useState } from "react";
import type { HearingSnapshot } from "./localEar";
import { deriveHearingStatus, pushLevel, LEVEL_HISTORY_MAX } from "./voiceHearing";

/** The slice of the local ear this indicator reads. */
export interface EarSource {
  subscribeLevel: (cb: (level: number) => void) => () => void;
  hearingSnapshot: () => HearingSnapshot;
}

const WIDTH = 168;
const HEIGHT = 44;

export function VoiceIndicator({
  ear,
  addressee = "Anubis",
}: {
  ear: EarSource | null;
  /** The construct he is addressing — Anubis unless a god is called. */
  addressee?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(0);
  const historyRef = useRef<number[]>([]);
  const [status, setStatus] = useState(() =>
    deriveHearingStatus(
      ear?.hearingSnapshot() ?? {
        state: "idle",
        supported: true,
        lastError: null,
      },
    ),
  );

  // The level feed: subscribe to the ear's measured microphone
  // level. The latest sample lives in a ref; the draw loop appends
  // it to the history each frame, so the graph's motion IS the
  // measured input — loud moves it, silence flattens it.
  useEffect(() => {
    if (!ear) {
      levelRef.current = 0;
      return;
    }
    return ear.subscribeLevel((level) => {
      levelRef.current = level;
    });
  }, [ear]);

  // The hearing state: read the ear's real snapshot on a beat.
  useEffect(() => {
    if (!ear) return;
    const read = () => setStatus(deriveHearingStatus(ear.hearingSnapshot()));
    read();
    const timer = window.setInterval(read, 250);
    return () => window.clearInterval(timer);
  }, [ear]);

  // The graph itself: bars from the measured history, nothing else.
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      historyRef.current = pushLevel(historyRef.current, levelRef.current);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d") ?? null;
      if (canvas && ctx) {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        const history = historyRef.current;
        const barWidth = WIDTH / LEVEL_HISTORY_MAX;
        ctx.fillStyle = status.hearing ? "#7ee2a8" : "#5b6672";
        for (let i = 0; i < history.length; i += 1) {
          const value = history[i] ?? 0;
          const barHeight = Math.max(1, value * (HEIGHT - 4));
          ctx.fillRect(
            i * barWidth,
            HEIGHT - barHeight,
            Math.max(1, barWidth - 1),
            barHeight,
          );
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [status.hearing]);

  const hearing = ear !== null && status.hearing;
  return (
    <div
      className="voice-indicator"
      role="status"
      aria-label={
        hearing
          ? `${addressee} is hearing you`
          : `${addressee} is not hearing you${status.reason ? `: ${status.reason}` : ""}`
      }
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        // ONE TIGHT PANEL (owner desk photos 2026-11-23 ~07:11
        // EST): the indicator used to carry its OWN panel —
        // background, border, padding — inside the cluster's
        // panel, and the two boxes' spacing read as a tall panel
        // with the hearing note floating low in dead space. The
        // cluster's panel is the one panel now; the indicator is
        // lines and the graph, packed directly under STATUS /
        // INTENSITY. The graph keeps its working height — that
        // is content, not gap.
        padding: 0,
        background: "transparent",
        border: "none",
        color: "#eef2f6",
        // BIFOCAL TYPE (owner eye-check 2026-11-23): the reason
        // line rides at 14px and the HEARING state line at 16px —
        // nothing in the top clusters sits below the readable
        // floor. The box widens a step to hold the bigger words;
        // it still sizes to its content, never a reserved gap.
        fontSize: 14,
        lineHeight: 1.45,
        maxWidth: 230,
      }}
    >
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        aria-hidden="true"
        style={{ display: "block", width: WIDTH, height: HEIGHT }}
      />
      <div style={{ fontWeight: 700, letterSpacing: 0.4, fontSize: 16 }}>
        <span style={{ color: hearing ? "#7ee2a8" : "#f0a35e" }}>
          {hearing ? "HEARING YOU" : "NOT HEARING"}
        </span>{" "}
        <span style={{ fontWeight: 400, opacity: 0.85 }}>· {addressee}</span>
      </div>
      {!hearing && status.reason && (
        <div style={{ opacity: 0.85 }}>{status.reason}</div>
      )}
    </div>
  );
}
