import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { AvatarBridge, type AvatarState } from "./AvatarBridge";
import { AvatarRenderer, type RenderSettings } from "./AvatarRenderer";
import { Sensors, type SensorStatus } from "./sensors";
import { attachOllamaAI } from "./ollamaAI";
import { CityView } from "./CityView";
import {
  parseCoreCommand,
  reduceCoreCityState,
  type CoreCityAction,
  type CoreCityState,
} from "./coreCityState";
import { intensityLabel } from "./stateParams";
import {
  getThemeAccent,
  loadThemePreference,
  saveThemePreference,
  THEMES,
  type ThemeChoice,
} from "./themes";
import { isCameraVisionRequest, parseWorldCommand, type MaterialKind } from "./worldCommands";
import { describeCameraFrame } from "./vision";
import {
  createReadOnlySupabaseClient,
  type SupabaseConnectionStatus,
} from "@/lib/supabase-readonly";

type Settings = RenderSettings & { sensitivity: number; cooldownMs: number };
const DEFAULTS: Settings = {
  maxParticles: 120000,
  bloom: 1.1,
  glitch: 0.4,
  theme: "cyan",
  customColor: "#22d3ee",
  sensitivity: 0.8,
  cooldownMs: 800,
};

export function AvatarStage() {
  const host = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef(new AvatarBridge());
  const rendRef = useRef<AvatarRenderer | null>(null);
  const sensRef = useRef<Sensors | null>(null);
  const aiRef = useRef<ReturnType<typeof attachOllamaAI> | null>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULTS,
    ...loadThemePreference(),
  }));
  const settingsRef = useRef(settings);
  const [state, setState] = useState<AvatarState>("IDLE");
  const [level, setLevel] = useState(0);
  const [perf, setPerf] = useState({ fps: 0, particles: 0 });
  const [panel, setPanel] = useState(false);
  const [sensor, setSensor] = useState<SensorStatus | null>(null);
  const [ready, setReady] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [chat, setChat] = useState("");
  const [lastWords, setLastWords] = useState("No response yet.");
  const [aiOffline, setAiOffline] = useState(false);
  const [cityState, setCityState] = useState<CoreCityState>({ mode: "CORE_FULL" });
  const [databaseStatus, setDatabaseStatus] = useState<SupabaseConnectionStatus>("not configured");
  const displayName = import.meta.env["VITE_AVATAR_NAME"] || "Osiris";
  const cityOpen = cityState.mode === "CORE_SMALL";
  const themeAccent = getThemeAccent(settings.theme, settings.customColor);

  const say = useCallback((text: string) => aiRef.current?.speak(text), []);

  const executeWorldCommand = useCallback(
    (command: NonNullable<ReturnType<typeof parseWorldCommand>>) => {
      const renderer = rendRef.current;
      if (!renderer) return;
      const objectName = (kind: MaterialKind) => (kind === "mountain" ? "mountains" : kind);
      const missingObject = (kind: MaterialKind) =>
        kind === "mountain"
          ? "There are no mountains here"
          : `There is no ${objectName(kind)} here`;
      switch (command.type) {
        case "shrink":
          renderer.shrink();
          say("Compact form.");
          break;
        case "walk":
          renderer.walk();
          say("I am exploring.");
          break;
        case "look":
          renderer.lookAround();
          say("Surveying the scene.");
          break;
        case "come-back":
          renderer.comeBack();
          say("Returning to my mark.");
          break;
        case "grow":
          renderer.grow();
          say("Full size.");
          break;
        case "drive":
          say(renderer.driveCar() ? "The car is moving." : "There is no car here to drive.");
          break;
        case "stop":
          renderer.stopWalking();
          renderer.stopDriving();
          say("Stopped.");
          break;
        case "make":
          renderer.makeObject(command.kind);
          say(
            command.kind === "mountain"
              ? "Mountains are in the scene."
              : `The ${command.kind} is in the scene.`,
          );
          break;
        case "move": {
          const count = renderer.moveObject(command.target, command.direction);
          say(
            count
              ? `Moved the ${objectName(command.target)} ${command.direction}.`
              : `${missingObject(command.target)} to move.`,
          );
          break;
        }
        case "reshape": {
          const count = renderer.reshapeObject(command.target, command.kind);
          say(
            count
              ? `Changed the ${objectName(command.target)} into ${command.kind === "mountain" ? "mountains" : `a ${command.kind}`}.`
              : `${missingObject(command.target)} to reshape.`,
          );
          break;
        }
        case "remove": {
          const count = renderer.removeObject(command.target);
          say(
            count
              ? `Removed the ${objectName(command.target)}.`
              : `${missingObject(command.target)} to remove.`,
          );
          break;
        }
        case "unsupported":
          if (command.operation === "make") {
            say(`I cannot materialize ${command.request || "that object"} yet.`);
          } else if (command.operation === "reshape") {
            say(
              `I cannot reshape ${command.request || "that object"}. That form is not in my library.`,
            );
          } else {
            say(
              `I cannot ${command.operation} ${command.request || "that object"}; it is not in my scene library.`,
            );
          }
          break;
      }
    },
    [say],
  );

  const transitionCityState = useCallback((action: CoreCityAction) => {
    setCityState((current) => reduceCoreCityState(current, action));
  }, []);

  function togglePresent() {
    const b = bridgeRef.current;
    b.present(b.presenting ? null : "file");
  }
  const sendCommand = useCallback(
    async (text: string) => {
      const parsed = parseCoreCommand(text);
      if (parsed.action === "BACK_TO_CORE") {
        transitionCityState(parsed.action);
        aiRef.current?.speak("Back to core.");
        return;
      }
      if (parsed.action === "SHOW_CITY") {
        transitionCityState(parsed.action);
        aiRef.current?.speak("Opening city view.");
        return;
      }
      if (parsed.action === "WAKE_CORE") {
        transitionCityState(parsed.action);
        if (!parsed.message) {
          bridgeRef.current.emitSummon();
          return;
        }
      }
      if (!parsed.message) return;
      const worldCommand = parseWorldCommand(parsed.message);
      if (worldCommand) {
        executeWorldCommand(worldCommand);
        return;
      }
      if (isCameraVisionRequest(parsed.message)) {
        const sensors = sensRef.current;
        const description = await describeCameraFrame(
          sensors?.cameraIsActive ? sensors.video : null,
        );
        aiRef.current?.speak(description);
        return;
      }
      await aiRef.current?.handleText(parsed.message);
    },
    [executeWorldCommand, transitionCityState],
  );

  useEffect(() => {
    const bridge = bridgeRef.current;
    const r = new AvatarRenderer(host.current!, bridge, { ...settingsRef.current });
    rendRef.current = r;
    r.onFrame = (p) => {
      setPerf(p);
      setReady(true);
    };
    const ai = attachOllamaAI(bridge, {
      onSpeak: setLastWords,
      onOfflineChange: setAiOffline,
    });
    aiRef.current = ai;
    // Speech recognition feeds Ollama; gestures ("front the file") stay local.
    const W = window as unknown as {
      SpeechRecognition?: new () => Rec;
      webkitSpeechRecognition?: new () => Rec;
    };
    const RecCtor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    type Rec = {
      continuous: boolean;
      interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
    let rec: Rec | null = null;
    const restart = () => {
      if (!RecCtor || rec) return;
      try {
        rec = new RecCtor();
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (e) => {
          const t = e.results[e.results.length - 1]?.[0]?.transcript;
          if (t) void sendCommand(t);
        };
        rec.onend = () => {
          rec = null;
        };
        rec.start();
      } catch {
        rec = null;
      }
    };
    restart();
    recRef.current = { stop: () => rec?.stop() };
    bridge.setState("LISTENING");
    const off = bridge.onStateChange(setState);
    const offP = bridge.onPresent((l) => setPresenting(l !== null));
    const iv = window.setInterval(
      () =>
        setLevel(
          bridge.state === "SPEAKING"
            ? bridge.speechLevel
            : bridge.state === "LISTENING"
              ? 0.5
              : bridge.state === "THINKING"
                ? 0.4
                : 0.1,
        ),
      150,
    );
    // mouse / touch fallback attractor
    const move = (e: PointerEvent) => {
      if (sensRef.current?.status.hands) return;
      aim(e.clientX / window.innerWidth, e.clientY / window.innerHeight, 0.6);
    };
    const leave = () => {
      if (!sensRef.current?.status.hands) release();
    };
    window.addEventListener("pointermove", move);
    document.addEventListener("pointerleave", leave);
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "s") bridge.emitSummon();
      if (e.key === "p") togglePresent();
    };
    window.addEventListener("keydown", key);
    return () => {
      off();
      offP();
      clearInterval(iv);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("keydown", key);
      recRef.current?.stop();
      aiRef.current?.dispose();
      sensRef.current?.stop();
      r.dispose();
    };
  }, [sendCommand]);

  useEffect(() => {
    const client = createReadOnlySupabaseClient();
    let active = true;
    const check = () => {
      void client.checkConnection().then((status) => {
        if (active) setDatabaseStatus(status);
      });
    };
    check();
    const interval = window.setInterval(check, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  function aim(nx: number, ny: number, k: number) {
    const r = rendRef.current;
    if (!r) return;
    r.inputs.attract.set((nx - 0.5) * 7, (0.5 - ny) * 4.5 + 0.2, 1.5);
    r.inputs.attractK = k;
    const listening = bridgeRef.current.state === "LISTENING" ? 1.6 : 1;
    r.inputs.look.set((nx - 0.5) * 0.9 * listening, (0.5 - ny) * 0.5 * listening);
  }
  function release() {
    const r = rendRef.current;
    if (!r) return;
    r.inputs.attractK = 0;
    r.inputs.look.set(0, 0);
  }

  async function enableSensors() {
    if (sensRef.current) return;
    const s = new Sensors(
      bridgeRef.current,
      {
        onPalm: (x, y) => aim(x, y, 1),
        onHandLost: release,
        onWave: (vx) => {
          const r = rendRef.current;
          if (r)
            r.inputs.sweep = THREE.MathUtils.clamp(r.inputs.sweep + Math.sign(vx) * 0.3, -1, 1);
        },
        onMicLevel: () => {},
      },
      {
        sensitivity: settings.sensitivity,
        cooldownMs: settings.cooldownMs,
        wasmRoot: import.meta.env["VITE_MEDIAPIPE_WASM_ROOT"],
        handModelUrl: import.meta.env["VITE_MEDIAPIPE_HAND_MODEL_URL"],
      },
    );
    sensRef.current = s;
    setSensor(await s.start());
  }

  function update<K extends keyof Settings>(k: K, v: Settings[K]) {
    const next = { ...settings, [k]: v };
    settingsRef.current = next;
    setSettings(next);
    rendRef.current?.updateSettings({ [k]: v } as Partial<RenderSettings>);
    sensRef.current?.setOptions({ sensitivity: next.sensitivity, cooldownMs: next.cooldownMs });
    if (k === "theme" || k === "customColor") {
      saveThemePreference({ theme: next.theme, customColor: next.customColor });
    }
  }

  function chooseCustomColor(color: string) {
    const next = { ...settings, theme: "custom" as const, customColor: color };
    settingsRef.current = next;
    setSettings(next);
    rendRef.current?.updateSettings({ theme: "custom", customColor: color });
    saveThemePreference({ theme: next.theme, customColor: next.customColor });
  }

  const stageStyle = {
    "--avatar-hud-accent": themeAccent,
    "--avatar-hud-line": `${themeAccent}80`,
  } as CSSProperties;

  return (
    <>
      {cityOpen && <CityView />}
      <div
        className={`avatar-stage${cityOpen ? " avatar-stage--city" : ""}`}
        data-scene-ready={ready ? "" : undefined}
        style={stageStyle}
      >
        <div ref={host} className="absolute inset-0" />
        <div className="avatar-hud avatar-hud--tr">
          {aiOffline && (
            <div className="avatar-hud__offline" role="status">
              <span>OFFLINE</span>
              <button
                className="avatar-hud__retry"
                onClick={() => void aiRef.current?.retry()}
                type="button"
              >
                Retry
              </button>
            </div>
          )}
          <div>
            STATUS: <span className="avatar-hud__value">{state}</span>
          </div>
          <div>
            INTENSITY: <span className="avatar-hud__value">{intensityLabel(level)}</span>
          </div>
        </div>
        <div className="avatar-hud avatar-hud--tl">
          <div className="avatar-hud__db-status">DB: {databaseStatus.toUpperCase()}</div>
          <div>
            {perf.fps} FPS · {(perf.particles / 1000).toFixed(0)}K PTS
          </div>
          <div>
            CAM {sensor?.camera ? "ON" : "OFF"} · MIC {sensor?.mic ? "ON" : "OFF"} · HANDS{" "}
            {sensor?.hands ? "ON" : "OFF"}
          </div>
          {sensor?.error && <div className="avatar-hud__warning">{sensor.error}</div>}
        </div>
        <div className="avatar-hud avatar-hud--commands">
          <div className="avatar-hud__last-words" aria-live="polite">
            <div className="avatar-hud__last-words-label">{displayName}&apos;s last words</div>
            <p>{lastWords}</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = chat.trim();
              if (!t) return;
              setChat("");
              void sendCommand(t);
            }}
          >
            <label className="sr-only" htmlFor="avatar-command">
              Command for {displayName}
            </label>
            <div className="avatar-hud__command-row">
              <input
                id="avatar-command"
                className="avatar-hud__input"
                placeholder="Type a command…"
                value={chat}
                onChange={(e) => setChat(e.target.value)}
              />
              <button className="avatar-hud__send" type="submit" disabled={!chat.trim()}>
                Send
              </button>
            </div>
          </form>
        </div>
        <div className="avatar-hud__bar">
          {cityOpen ? (
            <button
              className="avatar-hud__button avatar-hud__button--primary"
              onClick={() => transitionCityState("BACK_TO_CORE")}
              type="button"
            >
              Back to Core
            </button>
          ) : (
            <button
              className="avatar-hud__button"
              onClick={() => transitionCityState("SHOW_CITY")}
              type="button"
            >
              City
            </button>
          )}
          {!cityOpen && (
            <>
              <button
                className="avatar-hud__button"
                onClick={() => executeWorldCommand({ type: "shrink" })}
              >
                Shrink
              </button>
              <button
                className="avatar-hud__button"
                onClick={() => executeWorldCommand({ type: "walk" })}
              >
                Walk around
              </button>
              <button
                className="avatar-hud__button"
                onClick={() => executeWorldCommand({ type: "come-back" })}
              >
                Come back
              </button>
              <button
                className="avatar-hud__button"
                onClick={() => executeWorldCommand({ type: "grow" })}
              >
                Grow
              </button>
            </>
          )}
          {!sensor && (
            <button
              className="avatar-hud__button avatar-hud__button--primary"
              onClick={enableSensors}
              title="Enable camera and microphone"
            >
              Cam + Mic
            </button>
          )}
          <button
            className="avatar-hud__button"
            onClick={() => bridgeRef.current.emitSummon()}
            title="Summon Osiris (S)"
          >
            Summon
          </button>
          <button
            className="avatar-hud__button"
            onClick={togglePresent}
            title="Toggle presentation (P)"
          >
            {presenting ? "Put away" : "Present"}
          </button>
          <button className="avatar-hud__button" onClick={() => setPanel((p) => !p)}>
            Settings
          </button>
        </div>
        {panel && (
          <div className="avatar-hud__panel">
            <Slider
              label="Particles"
              min={20000}
              max={120000}
              step={5000}
              value={settings.maxParticles}
              onChange={(v) => update("maxParticles", v)}
              fmt={(v) => `${v / 1000}K`}
            />
            <Slider
              label="Bloom"
              min={0}
              max={2.5}
              step={0.05}
              value={settings.bloom}
              onChange={(v) => update("bloom", v)}
            />
            <Slider
              label="Glitch"
              min={0}
              max={1}
              step={0.05}
              value={settings.glitch}
              onChange={(v) => update("glitch", v)}
            />
            <Slider
              label="Snap sensitivity"
              min={0}
              max={1}
              step={0.05}
              value={settings.sensitivity}
              onChange={(v) => update("sensitivity", v)}
            />
            <Slider
              label="Cooldown"
              min={200}
              max={3000}
              step={50}
              value={settings.cooldownMs}
              onChange={(v) => update("cooldownMs", v)}
              fmt={(v) => `${v}ms`}
            />
            <label className="avatar-hud__row">
              Theme
              <select
                className="avatar-hud__select"
                value={settings.theme}
                onChange={(e) => update("theme", e.target.value as ThemeChoice)}
              >
                {Object.keys(THEMES).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="avatar-hud__row">
              Custom glow / particles / core
              <input
                className="avatar-hud__color"
                type="color"
                value={settings.customColor}
                onChange={(e) => chooseCustomColor(e.target.value)}
              />
            </label>
          </div>
        )}
      </div>
    </>
  );
}

function Slider(p: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="avatar-hud__row">
      <span>
        {p.label} <span className="avatar-hud__value">{p.fmt ? p.fmt(p.value) : p.value}</span>
      </span>
      <input
        type="range"
        className="avatar-hud__range"
        min={p.min}
        max={p.max}
        step={p.step}
        value={p.value}
        onChange={(e) => p.onChange(Number(e.target.value))}
      />
    </label>
  );
}
