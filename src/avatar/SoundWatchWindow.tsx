/**
 * SOUND WATCH WINDOW (owner order 2026-11-23) — the "ninja ability":
 * Augie listens to the room through this device's microphone and
 * breaks down what it hears — what it sounds like, how loud, roughly
 * how close (an ESTIMATE, labeled). For patrol: clearing a building
 * that should be empty, any sound matters.
 *
 * THE POKÉDEX LOOP (owner order 2026-11-23): a sound it cannot place
 * is UNCLASSIFIED — never guessed. Its fingerprint (measured numbers,
 * never audio) is kept; the Captain names it; the name joins his
 * personal sound library on this device; next time it's known, and
 * reported under HIS name.
 *
 * ENGINE TRUTH (v2): the built-in classifier is YAMNet, running
 * on-device from files vendored into the app (model + wasm under
 * public/mediapipe/) — no network at runtime. It labels a detected
 * sound's own segment once, when the event closes; the label feeds
 * the same decideLabel law as v1 (library outranks, under-threshold
 * is UNCLASSIFIED). A confident human-class label raises an alert
 * through the stage (notify + the reporting god's pop-up). If the
 * classifier cannot load on a device, the panel says so and the
 * v1 behavior — library + UNCLASSIFIED — carries on.
 *
 * THE MIC IS SHARED, NEVER FOUGHT OVER: the voice ear (LocalEar) is
 * push-to-talk and owns the microphone while it listens. Sound Watch
 * checks before it starts and yields the moment the ear takes the
 * mic, resuming when the ear is free — one stream at a time.
 *
 * PRIVACY: analysis is on-device in this window. Nothing is recorded;
 * no audio is stored. The log holds labels, levels, times, and
 * fingerprint numbers only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Ear, EarOff, Trash2 } from "lucide-react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { micErrorMessage } from "./localEar";
import {
  DIRECTION_NOTE,
  DISTANCE_ESTIMATE_NOTE,
  SOUND_WATCH_ENGINE_NOTE,
  SOUND_WATCH_PRIVACY_NOTE,
  SoundEventDetector,
  buildEntry,
  computeFeatures,
  decideLabel,
  distanceBandText,
  entryTitle,
  fingerprintOf,
  forgetSound,
  loadSoundLibrary,
  meterFraction,
  recordLibraryHit,
  saveSoundLibrary,
  setLibraryAlert,
  soundAlertLine,
  teachSound,
  unknownSoundLine,
  type SoundEventEntry,
  type SoundLibraryEntry,
  type StorageLike,
} from "./soundWatch";
import {
  SoundSegmentRecorder,
  YamnetClassifier,
  type ClassifierState,
} from "./soundClassifier";
import {
  acknowledgeAllSoundAlerts,
  acknowledgeSoundAlert,
  currentSoundFeed,
  publishSoundEntry,
  subscribeSoundFeed,
  unacknowledgedSoundAlerts,
  type SoundFeedEntry,
} from "./soundWatchFeed";

const TICK_MS = 100;
const MAX_LOG_ENTRIES = 80;

type Phase = "idle" | "starting" | "watching" | "yielding" | "error";

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function SoundWatchWindow({
  onClose,
  voiceEarBusy,
  onAlert,
}: {
  onClose: () => void;
  /** True while the voice ear holds the microphone (its turn). */
  voiceEarBusy?: () => boolean;
  /** Raised for alert entries (a person sound, or a flagged library sound). */
  onAlert?: (text: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [liveDb, setLiveDb] = useState(-100);
  const [entries, setEntries] = useState<SoundEventEntry[]>([]);
  // The shared feed (soundWatchFeed.ts): every classification is
  // published there so the Alert Ring and the Identifier read the
  // same record; acknowledgment of an alert happens here, in its
  // owning surface, and lands on the feed.
  const [feed, setFeed] = useState<SoundFeedEntry[]>(() => currentSoundFeed());
  useEffect(() => subscribeSoundFeed(setFeed), []);
  const [library, setLibrary] = useState<SoundLibraryEntry[]>(() =>
    loadSoundLibrary(browserStorage()),
  );
  const [teachNames, setTeachNames] = useState<Record<string, string>>({});

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptRef = useRef<ScriptProcessorNode | null>(null);
  const timerRef = useRef<unknown>(null);
  const detectorRef = useRef(new SoundEventDetector());
  const wantWatchRef = useRef(false);
  const startingRef = useRef(false);
  const libraryRef = useRef(library);
  const meterRef = useRef<HTMLCanvasElement>(null);
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  // The YAMNet engine + the in-memory segment recorder. The engine
  // loads once when the window opens (vendored files, no network);
  // the recorder only ever holds the last seconds, in memory.
  const classifierRef = useRef<YamnetClassifier | null>(null);
  const recorderRef = useRef<SoundSegmentRecorder | null>(null);
  const [classifierState, setClassifierState] = useState<ClassifierState>("idle");
  const [lastClassifyMs, setLastClassifyMs] = useState<number | null>(null);

  useEffect(() => {
    const engine = new YamnetClassifier();
    classifierRef.current = engine;
    setClassifierState("loading");
    void engine.load().then((ok) => setClassifierState(ok ? "ready" : "failed"));
    return () => {
      engine.dispose();
      classifierRef.current = null;
    };
  }, []);

  const applyLibrary = useCallback((next: SoundLibraryEntry[]) => {
    libraryRef.current = next;
    setLibrary(next);
    saveSoundLibrary(browserStorage(), next);
  }, []);

  const releaseCapture = useCallback(() => {
    if (scriptRef.current) {
      scriptRef.current.onaudioprocess = null;
      try {
        scriptRef.current.disconnect();
      } catch {
        /* already disconnected */
      }
      scriptRef.current = null;
    }
    recorderRef.current?.reset();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    analyserRef.current = null;
  }, []);

  const stopAll = useCallback(() => {
    wantWatchRef.current = false;
    if (timerRef.current !== null) {
      clearInterval(timerRef.current as number);
      timerRef.current = null;
    }
    releaseCapture();
    setPhase("idle");
    setLiveDb(-100);
  }, [releaseCapture]);

  useEffect(() => stopAll, [stopAll]);

  const handleDetected = useCallback(
    (sound: Parameters<typeof buildEntry>[1]) => {
      // Classify the event's OWN segment, once, now that it closed.
      // The segment is sliced from the in-memory recorder (a small
      // tail is included — the detector closes after ~500 ms of
      // quiet) and resampled inside the engine. Library matching
      // runs on the measured fingerprint exactly as before, and
      // decideLabel keeps the law: his names outrank YAMNet, and a
      // hit under the threshold is UNCLASSIFIED.
      const engine = classifierRef.current;
      const recorder = recorderRef.current;
      const ctx = ctxRef.current;
      let hit: Parameters<typeof decideLabel>[0] = null;
      if (engine && recorder && ctx && engine.state === "ready") {
        const segment = recorder.segment(sound.at, sound.at + sound.durationMs + 600);
        if (segment) {
          const result = engine.classifySegment(segment, ctx.sampleRate);
          if (result) {
            hit = result.hit;
            setLastClassifyMs(Math.round(result.ms));
          }
        }
      }
      const decision = decideLabel(hit, sound.fingerprint, libraryRef.current);
      const entry = buildEntry(nextId("sound"), sound, decision);
      if (decision.libraryId) {
        applyLibrary(recordLibraryHit(libraryRef.current, decision.libraryId));
      }
      setEntries((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
      publishSoundEntry(entry);
      if (entry.alert) onAlertRef.current?.(soundAlertLine(entry));
    },
    [applyLibrary],
  );

  const drawMeter = useCallback((dbfs: number) => {
    const canvas = meterRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 0, width, height);
    const frac = meterFraction(dbfs);
    ctx.fillStyle = dbfs >= -16 ? "#f87171" : dbfs >= -34 ? "#fbbf24" : "#34d399";
    ctx.fillRect(0, 0, Math.round(width * frac), height);
  }, []);

  const startCapture = useCallback(async () => {
    if (startingRef.current || analyserRef.current) return;
    startingRef.current = true;
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!wantWatchRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const ctx = new AudioContext();
      await ctx.resume().catch(() => undefined);
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.35;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;
      // Segment tap: a script processor copies the mic stream into
      // the in-memory recorder so a closed event's own audio can be
      // classified. Routed through a zero gain — nothing is played
      // back, and nothing is stored beyond the rolling seconds.
      const recorder = new SoundSegmentRecorder(ctx.sampleRate);
      recorderRef.current = recorder;
      const script = ctx.createScriptProcessor(4096, 1, 1);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      script.onaudioprocess = (event) => {
        recorder.push(event.inputBuffer.getChannelData(0), Date.now());
      };
      source.connect(script);
      script.connect(mute);
      mute.connect(ctx.destination);
      scriptRef.current = script;
      detectorRef.current.reset();
      setError("");
      setPhase("watching");
    } catch (err) {
      setError(micErrorMessage(err));
      setPhase("error");
      wantWatchRef.current = false;
    } finally {
      startingRef.current = false;
    }
  }, []);

  const tick = useCallback(() => {
    if (!wantWatchRef.current) return;
    const earBusy = voiceEarBusy?.() ?? false;
    if (earBusy) {
      // The voice ear's turn: hand the microphone over, stand by.
      if (analyserRef.current || streamRef.current) releaseCapture();
      if (!startingRef.current) setPhase("yielding");
      setLiveDb(-100);
      drawMeter(-100);
      return;
    }
    if (!analyserRef.current) {
      void startCapture();
      return;
    }
    const analyser = analyserRef.current;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const time = new Float32Array(analyser.fftSize);
    const freq = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(time);
    analyser.getFloatFrequencyData(freq);
    const features = computeFeatures(time, freq, ctx.sampleRate);
    setLiveDb(features.dbfs);
    drawMeter(features.dbfs);
    const detected = detectorRef.current.feed({
      t: Date.now(),
      dbfs: features.dbfs,
      fingerprint: fingerprintOf(features),
      dominantHz: features.dominantHz,
    });
    if (detected) handleDetected(detected);
  }, [drawMeter, handleDetected, releaseCapture, startCapture, voiceEarBusy]);

  const startWatch = useCallback(() => {
    setError("");
    wantWatchRef.current = true;
    if (timerRef.current === null) {
      timerRef.current = setInterval(tick, TICK_MS);
    }
    tick();
  }, [tick]);

  const teach = useCallback(
    (entry: SoundEventEntry) => {
      const name = (teachNames[entry.id] ?? "").trim();
      if (!name) return;
      applyLibrary(
        teachSound(libraryRef.current, name, entry.fingerprint, Date.now(), nextId("lib")),
      );
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, label: name, source: "library" as const } : e,
        ),
      );
      setTeachNames((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    },
    [applyLibrary, teachNames],
  );

  // Standing alerts read off the FEED: every alert entry this
  // window makes is published there, and a feed alert survives
  // the window closing — its acknowledgment still happens here,
  // in the owning surface. The window's own entries only enrich
  // the rows (distance, character) for sounds heard this session.
  const feedAlerts = feed.filter((f) => f.alert);
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const waitingAlerts = unacknowledgedSoundAlerts(feed);
  const unclassifiedCount = entries.filter((e) => e.source === "unclassified").length;
  const watching = phase === "watching" || phase === "starting" || phase === "yielding";

  return (
    <FloatingWindow
      id="sound-watch"
      title="Sound Watch — the room's ear"
      onClose={onClose}
      initialWidth={470}
      initialHeight={560}
      accent="#34d399"
    >
      <div className="window-soundwatch">
        <p className="window-hint">
          Augie listens to the room and logs what it hears — what it sounds like, how loud, and
          roughly how close. Sounds it doesn&apos;t know are marked UNCLASSIFIED until you name
          them; named sounds are known from then on.
        </p>

        {phase === "yielding" && (
          <p className="window-soundwatch__status" role="status">
            The voice ear has the microphone — Sound Watch stands by and takes its turn when the
            ear is free.
          </p>
        )}
        {phase === "watching" && (
          <p className="window-soundwatch__status" role="status">
            Watching — listening to the room now.
            {unclassifiedCount > 0 && <> {unknownSoundLine(unclassifiedCount)}</>}
          </p>
        )}
        {phase === "idle" && (
          <p className="window-soundwatch__status" role="status">
            Sound Watch is off. Start it and it listens from this device&apos;s microphone.
          </p>
        )}
        {classifierState === "loading" && (
          <p className="window-soundwatch__status" role="status">
            Built-in classifier (YAMNet) is loading from inside the app — a few seconds, no
            internet needed.
          </p>
        )}
        {classifierState === "ready" && (
          <p className="window-soundwatch__status" role="status">
            Built-in classifier (YAMNet) is on — sounds it reads confidently get their label;
            the rest stay UNCLASSIFIED for you to name.
          </p>
        )}
        {classifierState === "failed" && (
          <p className="window-soundwatch__status" role="status">
            The built-in classifier could not load on this device — your library and
            UNCLASSIFIED still work exactly as before.
          </p>
        )}
        {error && (
          <p role="alert" className="window-soundwatch__error">
            {error}
          </p>
        )}

        <div className="window-soundwatch__meter-row">
          <canvas ref={meterRef} className="window-soundwatch__meter" width={260} height={18} />
          <span className="window-soundwatch__db">
            {watching && phase === "watching" ? `${Math.round(liveDb)} dB` : "— dB"}
          </span>
          {!watching ? (
            <button type="button" className="window-btn" onClick={startWatch}>
              <Ear aria-hidden="true" /> Start watching
            </button>
          ) : (
            <button type="button" className="window-btn" onClick={stopAll}>
              <EarOff aria-hidden="true" /> Stop
            </button>
          )}
        </div>

        {feedAlerts.length > 0 && (
          <section className="window-soundwatch__alerts" aria-label="Alerts">
            <h3>
              Alerts
              {waitingAlerts.length > 0
                ? ` — ${waitingAlerts.length} waiting for your acknowledgment`
                : ""}
            </h3>
            <p className="window-hint">
              An alert you have not acknowledged keeps Anubis&apos;s ring in its alert state.
              Acknowledge it here when you have seen it — that is the only way the ring clears.
            </p>
            <ul className="window-soundwatch__log">
              {feedAlerts.map((record) => {
                const entry = entryById.get(record.id);
                return (
                  <li key={record.id} className="window-soundwatch__entry is-alert">
                    {entry ? (
                      <>
                        <b>{entryTitle(entry)}</b> · {distanceBandText(entry.distanceBand)} ·{" "}
                        {new Date(entry.at).toLocaleTimeString()} · {entry.character}
                      </>
                    ) : (
                      <>
                        <b>{record.label ?? "UNCLASSIFIED"}</b> ·{" "}
                        {new Date(record.at).toLocaleTimeString()} · heard in an earlier sitting
                      </>
                    )}{" "}
                    {record.acknowledged ? (
                      <span>· Acknowledged</span>
                    ) : (
                      <button
                        type="button"
                        className="window-btn"
                        onClick={() => acknowledgeSoundAlert(record.id)}
                      >
                        Acknowledge
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {waitingAlerts.length > 1 && (
              <button
                type="button"
                className="window-btn"
                onClick={() => acknowledgeAllSoundAlerts()}
              >
                Acknowledge all
              </button>
            )}
          </section>
        )}

        <section aria-label="Sound log">
          <h3>Sound log{unclassifiedCount > 0 ? ` — ${unclassifiedCount} to classify` : ""}</h3>
          {entries.length === 0 ? (
            <p className="window-hint">
              Nothing logged yet. When a sound rises above the room&apos;s quiet, it lands here
              with its time, level, and fingerprint.
            </p>
          ) : (
            <ul className="window-soundwatch__log">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className={`window-soundwatch__entry${entry.alert ? " is-alert" : ""}`}
                >
                  <div>
                    <b>{entryTitle(entry)}</b>
                    {entry.source === "library" && (
                      <span className="window-soundwatch__tag"> your library</span>
                    )}
                    {entry.source === "classifier" && (
                      <span className="window-soundwatch__tag"> built-in classifier</span>
                    )}{" "}
                    · {distanceBandText(entry.distanceBand)} ·{" "}
                    {new Date(entry.at).toLocaleTimeString()}
                  </div>
                  <div className="window-soundwatch__char">
                    {entry.character}
                    {entry.confidence !== null &&
                      ` · match ${Math.round(entry.confidence * 100)}%`}
                  </div>
                  {entry.source === "unclassified" && (
                    <div className="window-soundwatch__teach">
                      <input
                        type="text"
                        value={teachNames[entry.id] ?? ""}
                        onChange={(ev) =>
                          setTeachNames((prev) => ({ ...prev, [entry.id]: ev.target.value }))
                        }
                        placeholder="Name this sound — e.g. gate hinge"
                        aria-label="Name this sound"
                      />
                      <button
                        type="button"
                        className="window-btn"
                        onClick={() => teach(entry)}
                        disabled={!(teachNames[entry.id] ?? "").trim()}
                      >
                        Teach it
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {entries.length > 0 && (
            <button type="button" className="window-btn" onClick={() => setEntries([])}>
              <Trash2 aria-hidden="true" /> Clear log
            </button>
          )}
        </section>

        <section className="window-soundwatch__library" aria-label="Your sound library">
          <h3>Your sound library — {library.length} learned</h3>
          {library.length === 0 ? (
            <p className="window-hint">
              Nothing learned yet. When a sound you know lands as UNCLASSIFIED, name it above —
              from then on it&apos;s known, and reported under your name.
            </p>
          ) : (
            <ul className="window-soundwatch__log">
              {library.map((item) => (
                <li key={item.id} className="window-soundwatch__entry">
                  <div>
                    <b>{item.name}</b> · heard {item.hits}× since{" "}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                  <div className="window-soundwatch__teach">
                    <label>
                      <input
                        type="checkbox"
                        checked={item.alert}
                        onChange={(ev) =>
                          applyLibrary(setLibraryAlert(libraryRef.current, item.id, ev.target.checked))
                        }
                      />{" "}
                      Alert me for this sound
                    </label>
                    <button
                      type="button"
                      className="window-btn"
                      onClick={() => applyLibrary(forgetSound(libraryRef.current, item.id))}
                    >
                      Forget
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="window-soundwatch__note">{SOUND_WATCH_ENGINE_NOTE}</p>
        {lastClassifyMs !== null && (
          <p className="window-soundwatch__note">
            Last classification took {lastClassifyMs} ms — it runs once per sound, on that
            sound&apos;s own segment, never in a loop.
          </p>
        )}
        <p className="window-soundwatch__note">{DISTANCE_ESTIMATE_NOTE}</p>
        <p className="window-soundwatch__note">{DIRECTION_NOTE}</p>
        <p className="window-soundwatch__note">{SOUND_WATCH_PRIVACY_NOTE}</p>
      </div>
    </FloatingWindow>
  );
}
