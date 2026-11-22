/**
 * WAND LISTENING MODE (Part 12, owner order 2026-11-21) — when he
 * turns listening ON, Augie hears and records the conversation from
 * that moment on THIS device, stays SILENT, and wakes only when he
 * says "Osiris" — then the recap of what was said is one tap away.
 *
 * Honesty rules, in the window where he can see them:
 * - The LISTENING indicator is always visible while it records —
 *   never hidden, never pretending.
 * - If the mic or the speech service fails, the window says so and
 *   records nothing — a session is never invented.
 * - Sessions save LOCALLY in his data core only.
 * - Live lines are labeled "Voice": speaker separation (Part 13)
 *   runs in the speech service and keeps other voices in their own
 *   labeled stores; this window does not guess who is speaking.
 * - The phone-side endpoint for this mode is Ghost Protocol One
 *   (Part 23) — this window is the desktop/device face of it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getOperatorAccessToken } from "./trustedDevice";
import { buildRecap, containsWakeWord, type ListeningLine } from "./listening";
import {
  getListeningSession,
  listListeningSessions,
  saveListeningSessionAuthed,
  type ListeningSession,
} from "./listening.server";

type ListenState = "off" | "starting" | "listening" | "awake" | "error";

const CHUNK_MS = 6000;

export function ListeningWindow({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<ListenState>("off");
  const [lines, setLines] = useState<ListeningLine[]>([]);
  const [error, setError] = useState("");
  const [recap, setRecap] = useState("");
  const [past, setPast] = useState<{ id: string; startedAt: number; lineCount: number }[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const linesRef = useRef<ListeningLine[]>([]);
  const startedAtRef = useRef(0);
  const awakeRef = useRef(false);

  const loadPast = useCallback(async () => {
    const token = await getOperatorAccessToken();
    if (!token) return;
    const result = await listListeningSessions({ data: { accessToken: token } });
    if (result.authorized) setPast(result.sessions);
  }, []);

  useEffect(() => {
    void loadPast();
  }, [loadPast]);

  const speak = useCallback((text: string) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      globalThis.speechSynthesis?.cancel();
      globalThis.speechSynthesis?.speak(utterance);
    } catch {
      // No speech on this device: the recap is on screen regardless.
    }
  }, []);

  const transcribeChunk = useCallback(
    async (blob: Blob) => {
      try {
        const response = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as { text?: string };
        const text = (payload.text ?? "").trim();
        if (!text) return;
        const line: ListeningLine = { at: Date.now(), text, speaker: "Voice" };
        linesRef.current = [...linesRef.current, line];
        setLines(linesRef.current);
        if (!awakeRef.current && containsWakeWord(text)) {
          awakeRef.current = true;
          setState("awake");
          speak("I am here. Ask me for the recap whenever you are ready.");
        }
      } catch {
        setError(
          "The local speech service did not answer for one chunk — that piece was NOT recorded. Listening continues; nothing was invented to fill the gap.",
        );
      }
    },
    [speak],
  );

  const start = async () => {
    setError("");
    setRecap("");
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      linesRef.current = [];
      setLines([]);
      startedAtRef.current = Date.now();
      awakeRef.current = false;
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) void transcribeChunk(event.data);
      };
      recorderRef.current = recorder;
      recorder.start(CHUNK_MS);
      setState("listening");
    } catch {
      setState("error");
      setError(
        "The microphone could not be opened. Allow microphone access for this site — until then, nothing is being recorded.",
      );
    }
  };

  const stop = async () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    awakeRef.current = false;
    setState("off");
    const session: ListeningSession = {
      id: `listen-${startedAtRef.current}`,
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      lines: linesRef.current,
    };
    if (session.lines.length > 0) {
      const token = await getOperatorAccessToken();
      if (token) {
        const result = await saveListeningSessionAuthed({ data: { accessToken: token, session } });
        if (result.saved) void loadPast();
      }
    }
  };

  useEffect(
    () => () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const askRecap = () => {
    const text = buildRecap(linesRef.current);
    setRecap(text);
    speak(text);
  };

  const loadPastRecap = async (id: string) => {
    const token = await getOperatorAccessToken();
    if (!token) return;
    const result = await getListeningSession({ data: { accessToken: token, id } });
    if (result.session) setRecap(buildRecap(result.session.lines, 40));
  };

  return (
    <FloatingWindow id="listening" title="Listening Mode — Silent Until Osiris" onClose={onClose} initialWidth={560} initialHeight={540} accent="#f472b6">
      <div className="window-listening">
        {(state === "listening" || state === "awake" || state === "starting") && (
          <p className="window-listening__indicator" role="status">
            <span className="window-listening__dot" aria-hidden="true" />
            {state === "awake"
              ? "OSIRIS IS AWAKE — he heard his name."
              : "LISTENING — recording this conversation on this device. Silent until you say \u201cOsiris\u201d."}
          </p>
        )}
        {state === "off" && (
          <p>
            Listening is OFF. Nothing is being heard or recorded. Turn it on and Augie records
            from that moment — silently — until you say &ldquo;Osiris&rdquo;.
          </p>
        )}
        {error && (
          <p role="alert" className="window-listening__error">
            {error}
          </p>
        )}
        <div className="window-logs__row">
          {state === "off" || state === "error" ? (
            <button type="button" onClick={() => void start()}>
              Turn listening ON (wand)
            </button>
          ) : (
            <button type="button" onClick={() => void stop()}>
              Stop &amp; save session
            </button>
          )}
          {state === "awake" && (
            <>
              <button type="button" onClick={askRecap}>
                Recap what was said
              </button>
              <button
                type="button"
                onClick={() => {
                  awakeRef.current = false;
                  setState("listening");
                }}
              >
                Back to silent
              </button>
            </>
          )}
        </div>

        <h3>Heard in this session</h3>
        {lines.length === 0 ? (
          <p>No lines yet — silence is recorded as silence, never filled in.</p>
        ) : (
          <ul className="window-logs__events">
            {lines.map((line, i) => (
              <li key={i}>
                {new Date(line.at).toLocaleTimeString()} — {line.text}
              </li>
            ))}
          </ul>
        )}
        {recap && (
          <section>
            <h3>Recap</h3>
            <p className="window-listening__recap">{recap}</p>
          </section>
        )}

        <h3>Past sessions (saved locally, in the data core only)</h3>
        {past.length === 0 ? (
          <p>No saved sessions yet.</p>
        ) : (
          <ul className="window-logs__events">
            {past.map((session) => (
              <li key={session.id}>
                {new Date(session.startedAt).toLocaleString()} — {session.lineCount} line(s){" "}
                <button type="button" onClick={() => void loadPastRecap(session.id)}>
                  Recap
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="window-logs__note">
          Speaker labels: live lines read &ldquo;Voice&rdquo; — the separation of who said what
          (Part 13) runs in the speech service, where other voices get their own labeled stores
          (Speaker 2, Speaker 3), never merged into the operator&apos;s voiceprint.
        </p>
      </div>
    </FloatingWindow>
  );
}
