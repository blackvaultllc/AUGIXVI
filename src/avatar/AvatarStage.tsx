import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AvatarBridge, type AvatarState } from "./AvatarBridge";
import { AvatarRenderer, type RenderSettings } from "./AvatarRenderer";
import { Sensors, type SensorStatus } from "./sensors";
import { attachOllamaAI } from "./ollamaAI";
import { intensityLabel } from "./stateParams";
import { THEMES, type ThemeName } from "./themes";

type Settings = RenderSettings & { sensitivity: number; cooldownMs: number };
const DEFAULTS: Settings = {
  maxParticles: 120000,
  bloom: 1.1,
  glitch: 0.4,
  theme: "cyan",
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
  const [state, setState] = useState<AvatarState>("IDLE");
  const [level, setLevel] = useState(0);
  const [perf, setPerf] = useState({ fps: 0, particles: 0 });
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [panel, setPanel] = useState(false);
  const [sensor, setSensor] = useState<SensorStatus | null>(null);
  const [ready, setReady] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [chat, setChat] = useState("");
  const [lastWords, setLastWords] = useState("AUGI hasn't spoken yet.");
  function togglePresent() {
    const b = bridgeRef.current;
    b.present(b.presenting ? null : "file");
  }
  async function sendCommand(text: string) {
    await aiRef.current?.handleText(text);
  }

  useEffect(() => {
    const bridge = bridgeRef.current;
    const r = new AvatarRenderer(host.current!, bridge, { ...DEFAULTS });
    rendRef.current = r;
    r.onFrame = (p) => {
      setPerf(p);
      setReady(true);
    };
    const ai = attachOllamaAI(bridge, {
      model: "llama3.1:8b",
      onSpeak: setLastWords,
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
      { sensitivity: settings.sensitivity, cooldownMs: settings.cooldownMs },
    );
    sensRef.current = s;
    setSensor(await s.start());
  }

  function update<K extends keyof Settings>(k: K, v: Settings[K]) {
    const next = { ...settings, [k]: v };
    setSettings(next);
    rendRef.current?.updateSettings({ [k]: v } as Partial<RenderSettings>);
    sensRef.current?.setOptions({ sensitivity: next.sensitivity, cooldownMs: next.cooldownMs });
  }

  return (
    <div className="avatar-stage" data-scene-ready={ready ? "" : undefined}>
      <div ref={host} className="absolute inset-0" />
      <div className="hud hud-tr">
        <div>
          STATUS: <span className="hud-val">{state}</span>
        </div>
        <div>
          INTENSITY: <span className="hud-val">{intensityLabel(level)}</span>
        </div>
      </div>
      <div className="hud hud-tl">
        <div>
          {perf.fps} FPS · {(perf.particles / 1000).toFixed(0)}K PTS
        </div>
        <div>
          CAM {sensor?.camera ? "ON" : "OFF"} · MIC {sensor?.mic ? "ON" : "OFF"} · HANDS{" "}
          {sensor?.hands ? "ON" : "OFF"}
        </div>
        {sensor?.error && <div className="hud-warn">{sensor.error}</div>}
      </div>
      <div className="hud hud-br">
        <div className="hud-last-words" aria-live="polite">
          <div className="hud-last-words-label">AUGI&apos;S LAST WORDS</div>
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
            Command for AUGI
          </label>
          <div className="hud-command-row">
            <input
              id="avatar-command"
              className="hud-input"
              placeholder="Type a command…"
              value={chat}
              onChange={(e) => setChat(e.target.value)}
            />
            <button className="hud-send" type="submit" disabled={!chat.trim()}>
              Send
            </button>
          </div>
        </form>
      </div>
      <div className="hud-bar">
        {!sensor && (
          <button className="hud-btn hud-btn-primary" onClick={enableSensors}>
            Enable camera &amp; mic
          </button>
        )}
        <button className="hud-btn" onClick={() => bridgeRef.current.emitSummon()}>
          Summon (S)
        </button>
        <button className="hud-btn" onClick={togglePresent}>
          {presenting ? "Put away (P)" : "Present file (P)"}
        </button>
        <button className="hud-btn" onClick={() => setPanel((p) => !p)}>
          Settings
        </button>
      </div>
      {panel && (
        <div className="hud-panel">
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
          <label className="hud-row">
            Theme
            <select
              className="hud-select"
              value={settings.theme}
              onChange={(e) => update("theme", e.target.value as ThemeName)}
            >
              {Object.keys(THEMES).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
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
    <label className="hud-row">
      <span>
        {p.label} <span className="hud-val">{p.fmt ? p.fmt(p.value) : p.value}</span>
      </span>
      <input
        type="range"
        className="hud-range"
        min={p.min}
        max={p.max}
        step={p.step}
        value={p.value}
        onChange={(e) => p.onChange(Number(e.target.value))}
      />
    </label>
  );
}
