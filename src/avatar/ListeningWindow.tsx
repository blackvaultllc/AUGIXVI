/**
 * LISTENING MODE WINDOW (Part 12, owner order 2026-11-21) — the face
 * of the ear service's listening sessions. Arm it here and the local
 * speech service records the conversation FROM THAT MOMENT — on the
 * Parrot only — staying SILENT, taking no actions, until a line
 * contains the wake word "Osiris" / "Usir". The recap then shows ONLY
 * what was actually recorded.
 *
 * Honesty rules, in the window where he can see them:
 * - The LISTENING indicator is always visible while the service
 *   reports armed — driven by the service's own status endpoint,
 *   polled, never by local optimism. The stage shows the same
 *   indicator outside this window while a session is armed.
 * - If the mic or the speech service fails, the window says so; a
 *   chunk that fails records nothing and invents nothing.
 * - Speaker labels come from the service (Part 13): "Operator",
 *   "Speaker 2"… or "Voice" when separation cannot run.
 *
 * Below the session controls, the SPEAKER STORES panel (Part 13)
 * shows the service's separate other-voices store — labeled, with the
 * service's own note of what is kept — and says plainly when
 * separation is not running (no voiceprint enrolled) or the service
 * cannot be reached.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Ear, EarOff, RefreshCw, ScrollText } from "lucide-react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { pickRecorderMimeType } from "./localEar";
import {
  buildRecap,
  listeningIndicatorText,
  parseListeningRecap,
  parseListeningStatus,
  type ListeningRecap,
  type ListeningStatus,
} from "./listening";
import { parseOtherVoices, separationStateText, type OtherVoicesView } from "./speakerStores";

const CHUNK_MS = 6000;
const STATUS_POLL_MS = 2500;

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, init);
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    /* an unreadable body is reported by status below */
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

export function ListeningWindow({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<ListeningStatus | null>(null);
  const [serviceError, setServiceError] = useState("");
  const [feeding, setFeeding] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [lastLine, setLastLine] = useState("");
  const [recap, setRecap] = useState<ListeningRecap | null>(null);
  const [others, setOthers] = useState<OtherVoicesView | null>(null);
  const [othersError, setOthersError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const feedingRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    try {
      const parsed = parseListeningStatus(await fetchJson("/api/listening/status"));
      if (parsed) {
        setStatus(parsed);
        setServiceError("");
      }
    } catch (error) {
      setServiceError(
        error instanceof Error ? error.message : "The local speech service did not answer.",
      );
    }
  }, []);

  const refreshOthers = useCallback(async () => {
    try {
      const parsed = parseOtherVoices(await fetchJson("/api/speakers/others"));
      if (parsed) {
        setOthers(parsed);
        setOthersError("");
      }
    } catch (error) {
      setOthersError(
        error instanceof Error ? error.message : "The local speech service did not answer.",
      );
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    void refreshOthers();
    const timer = setInterval(() => void refreshStatus(), STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [refreshStatus, refreshOthers]);

  const stopFeed = useCallback(() => {
    feedingRef.current = false;
    setFeeding(false);
    try {
      recorderRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopFeed, [stopFeed]);

  const sendChunk = useCallback(
    async (blob: Blob) => {
      try {
        const payload = (await fetchJson("/api/listening/chunk", {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        })) as { recorded?: boolean; text?: string; speaker?: string };
        if (payload?.recorded && payload.text) {
          setLastLine(`${payload.speaker ?? "Voice"}: ${payload.text}`);
          setFeedError("");
        }
        void refreshStatus();
        void refreshOthers();
      } catch (error) {
        setFeedError(
          `One chunk was NOT recorded — ${
            error instanceof Error ? error.message : "the speech service did not answer"
          } Listening continues; nothing was invented to fill the gap.`,
        );
      }
    },
    [refreshStatus, refreshOthers],
  );

  const startFeed = useCallback(async () => {
    setFeedError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMimeType((m) => MediaRecorder.isTypeSupported(m));
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) void sendChunk(event.data);
      };
      recorderRef.current = recorder;
      feedingRef.current = true;
      setFeeding(true);
      recorder.start(CHUNK_MS);
    } catch {
      setFeedError(
        "The microphone could not be opened. Allow microphone access for this site — until then, this window is not feeding the session.",
      );
    }
  }, [sendChunk]);

  const arm = async () => {
    setServiceError("");
    try {
      const parsed = parseListeningStatus(
        await fetchJson("/api/listening/arm", { method: "POST" }),
      );
      if (parsed) setStatus(parsed);
      await startFeed();
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Arming listening failed.");
    }
  };

  const resumeFeed = async () => {
    await startFeed();
  };

  const disarm = async () => {
    stopFeed();
    try {
      const parsed = parseListeningStatus(
        await fetchJson("/api/listening/disarm", { method: "POST" }),
      );
      if (parsed) setStatus(parsed);
      void refreshStatus();
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Disarming listening failed.");
    }
  };

  const askRecap = async () => {
    try {
      const parsed = parseListeningRecap(await fetchJson("/api/listening/recap"));
      if (parsed) setRecap(parsed);
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "The recap could not be read.");
    }
  };

  const armed = status?.armed === true;

  return (
    <FloatingWindow
      id="listening"
      title="Listening Mode — Silent Until Osiris"
      onClose={onClose}
      initialWidth={500}
      initialHeight={520}
      accent="#f472b6"
    >
      <div className="window-listening">
        {status === null && !serviceError && (
          <p className="window-hint">Asking the speech service…</p>
        )}
        {serviceError && (
          <p role="alert" className="window-listening__error">
            The local speech service did not answer: {serviceError} Nothing is being recorded.
          </p>
        )}
        {status !== null && (
          <p
            className={`window-listening__indicator${armed ? " is-armed" : ""}`}
            role="status"
            data-testid="listening-indicator"
          >
            <span className="window-listening__dot" aria-hidden="true" />
            {listeningIndicatorText(status)}
          </p>
        )}
        {status !== null && armed && (
          <p className="window-hint">
            Session {status.sessionId} · started{" "}
            {status.startedAt ? new Date(status.startedAt).toLocaleTimeString() : "—"} ·{" "}
            {status.lineCount} line(s) recorded
            {feeding
              ? " · this window is feeding the microphone"
              : " · this window is NOT feeding audio"}
          </p>
        )}
        {feedError && (
          <p role="alert" className="window-listening__error">
            {feedError}
          </p>
        )}
        <div className="window-logs__tabs">
          {!armed ? (
            <button type="button" className="window-btn" onClick={() => void arm()}>
              <Ear aria-hidden="true" /> Arm listening
            </button>
          ) : (
            <>
              {!feeding && (
                <button type="button" className="window-btn" onClick={() => void resumeFeed()}>
                  <Ear aria-hidden="true" /> Feed this session from the mic
                </button>
              )}
              <button type="button" className="window-btn" onClick={() => void disarm()}>
                <EarOff aria-hidden="true" /> Disarm &amp; stop
              </button>
            </>
          )}
          <button type="button" className="window-btn" onClick={() => void askRecap()}>
            <ScrollText aria-hidden="true" /> Recap what was said
          </button>
          <button type="button" className="window-btn" onClick={() => void refreshStatus()}>
            <RefreshCw aria-hidden="true" /> Refresh
          </button>
        </div>
        {lastLine && (
          <p className="window-hint">
            Last line heard: <span className="window-listening__lastline">{lastLine}</span>
          </p>
        )}
        {recap && (
          <section>
            <h3>Recap</h3>
            <p className="window-listening__recap">{buildRecap(recap, 40)}</p>
            {recap.lines.length > 0 && (
              <ul className="window-logs__list">
                {recap.lines.map((line, i) => (
                  <li key={i} className="window-logs__line">
                    {line.at ? new Date(line.at).toLocaleTimeString() : "—"} — {line.speaker}:{" "}
                    {line.text}
                    {line.wake ? " · WAKE WORD" : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="speaker-stores">
          <h3>Speaker stores — other voices (Part 13)</h3>
          {othersError && (
            <p role="alert" className="window-listening__error">
              The speaker panel could not reach the speech service: {othersError}
            </p>
          )}
          {others && (
            <>
              <p className="window-logs__note">{separationStateText(others)}</p>
              <p className="window-logs__note">
                Kept for other voices: {others.kept}. No names are guessed, no identity is claimed,
                and nothing here ever merges into the operator&apos;s voiceprint.
              </p>
              {others.speakers.length === 0 ? (
                <p className="window-hint">
                  No other voices stored yet. When the service separates another voice, its store
                  appears here.
                </p>
              ) : (
                <ul className="window-logs__list">
                  {others.speakers.map((speaker) => (
                    <li key={speaker.label} className="window-logs__line">
                      <b>{speaker.label}</b> — {speaker.utterances} utterance(s)
                      {speaker.lastHeard
                        ? ` · last heard ${new Date(speaker.lastHeard).toLocaleString()}`
                        : ""}
                    </li>
                  ))}
                </ul>
              )}
              {others.entries.length > 0 && (
                <>
                  <h4>Latest separated lines</h4>
                  <ul className="window-logs__list">
                    {others.entries
                      .slice(-6)
                      .reverse()
                      .map((entry, i) => (
                        <li key={i} className="window-logs__line">
                          {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "—"} —{" "}
                          {entry.label} (similarity to operator{" "}
                          {entry.similarity !== null ? entry.similarity.toFixed(2) : "—"}):{" "}
                          {entry.transcript}
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </FloatingWindow>
  );
}
