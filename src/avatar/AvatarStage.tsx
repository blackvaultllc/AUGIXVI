import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import * as THREE from "three";
import {
  Activity,
  ArrowUp,
  BookOpen,
  Camera,
  Expand,
  Eye,
  LogOut,
  Mic,
  MicOff,
  Plane,
  Presentation,
  Settings,
  Shrink,
  Sparkles,
  Square,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { AvatarBridge, type AvatarState } from "./AvatarBridge";
import { AvatarRenderer, type RenderSettings } from "./AvatarRenderer";
import { Sensors, type SensorStatus } from "./sensors";
import { attachOllamaAI } from "./ollamaAI";
import { CubePanel } from "./CubePanel";
import { isCubePanelCommand } from "./cubeReference";
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
import { KnowledgePanel } from "./KnowledgePanel";
import {
  parseInteractionCommand,
  loadClearScreenPreference,
  loadSilentModePreference,
  saveClearScreenPreference,
  saveSilentModePreference,
} from "./interactionControls";
import { createHighlight, createLocalMemory, findLocalAnswer, splitDocument } from "./localMemory";
import { lookupKnowledge } from "./knowledgeBase";
import {
  createReadOnlySupabaseClient,
  type SupabaseConnectionStatus,
} from "@/lib/supabase-readonly";

type Settings = RenderSettings & { sensitivity: number; cooldownMs: number };
type CabinetTab = "scene" | "motion" | "tools" | "settings";
const DEFAULTS: Settings = {
  maxParticles: 120000,
  bloom: 1.1,
  glitch: 0.4,
  theme: "cyan",
  customColor: "#22d3ee",
  sensitivity: 0.8,
  cooldownMs: 800,
};

export function AvatarStage({
  onSignOut,
  operatorName,
  operatorFullName,
  signOutError,
}: {
  onSignOut: () => void;
  operatorName: string | null;
  operatorFullName: string | null;
  signOutError: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef(new AvatarBridge());
  const rendRef = useRef<AvatarRenderer | null>(null);
  const sensRef = useRef<Sensors | null>(null);
  const aiRef = useRef<ReturnType<typeof attachOllamaAI> | null>(null);
  const recRef = useRef<{ stop: () => void; start: () => void } | null>(null);
  const [silent, setSilent] = useState(loadSilentModePreference);
  const memoryRef = useRef<ReturnType<typeof createLocalMemory> | null>(null);
  memoryRef.current ??= createLocalMemory();
  const silentRef = useRef(silent);
  const lastQuestionRef = useRef("");
  const micFlashTimer = useRef<number | null>(null);
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULTS,
    ...loadThemePreference(),
  }));
  const settingsRef = useRef(settings);
  const [state, setState] = useState<AvatarState>("IDLE");
  const [level, setLevel] = useState(0);
  const [perf, setPerf] = useState({ fps: 0, particles: 0 });
  const [sensor, setSensor] = useState<SensorStatus | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [chat, setChat] = useState("");
  const [lastWords, setLastWords] = useState("No response yet.");
  const [responseSource, setResponseSource] = useState("awaiting response");
  const [aiOffline, setAiOffline] = useState(false);
  const [clearScreen, setClearScreen] = useState(loadClearScreenPreference);
  const [listeningFlash, setListeningFlash] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [memoryError, setMemoryError] = useState("");
  const [cubeOpen, setCubeOpen] = useState(false);
  const [cabinetTab, setCabinetTab] = useState<CabinetTab>("motion");
  const [databaseStatus, setDatabaseStatus] = useState<SupabaseConnectionStatus>("not configured");
  const displayName = import.meta.env["VITE_AVATAR_NAME"] || "Osiris";
  const themeAccent = getThemeAccent(settings.theme, settings.customColor);

  const say = useCallback((text: string) => {
    setResponseSource("local command");
    aiRef.current?.speak(text);
  }, []);

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
        case "mode":
          renderer.setLocomotionMode(command.mode);
          say(command.mode === "idle" ? "Idle." : `${command.mode} mode.`);
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
        case "speed":
          say(`Movement speed ${renderer.setMovementSpeed(command.value).toFixed(2)}.`);
          break;
        case "drive":
          say(
            renderer.driveObject(command.target)
              ? `The ${command.target} is moving.`
              : `I cannot drive a ${command.target} here.`,
          );
          break;
        case "walk-through":
          say(
            renderer.walkThroughObject(command.target)
              ? `Walking through the ${command.target}.`
              : `There is no traversable ${command.target} here.`,
          );
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
        case "make-and-walk-through":
          renderer.makeObject(command.kind);
          if (renderer.walkThroughObject(command.kind)) {
            say(`The ${command.kind} is built. I am walking through it.`);
          } else {
            say(`The ${command.kind} is built, but I cannot walk through that structure.`);
          }
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

  function togglePresent() {
    const b = bridgeRef.current;
    b.present(b.presenting ? null : "file");
  }
  const sendCommand = useCallback(
    async (text: string, source: "typed" | "voice" = "typed") => {
      const applyInterfaceCommand = (type: "clear-screen" | "show-screen" | "silence") => {
        if (type === "clear-screen") {
          setClearScreen(true);
          saveClearScreenPreference(true);
        } else if (type === "show-screen") {
          setClearScreen(false);
          saveClearScreenPreference(false);
        } else {
          silentRef.current = true;
          setSilent(true);
          saveSilentModePreference(true);
          aiRef.current?.setMuted(true);
        }
      };
      let commandText = text;
      const interaction = parseInteractionCommand(commandText);
      if (interaction && interaction.type !== "wake") {
        applyInterfaceCommand(interaction.type);
        return;
      }
      if (interaction?.type === "wake") {
        silentRef.current = false;
        setSilent(false);
        saveSilentModePreference(false);
        aiRef.current?.setMuted(false);
        if (!interaction.remainder) {
          setResponseSource("wake word");
          aiRef.current?.speak(operatorName ? `Yes, ${operatorName}.` : "Yes, operator.");
          return;
        }
        commandText = interaction.remainder;
        const followUp = parseInteractionCommand(commandText);
        if (followUp && followUp.type !== "wake") {
          applyInterfaceCommand(followUp.type);
          return;
        }
      } else if (silentRef.current && source === "voice") {
        return;
      }
      lastQuestionRef.current = commandText;
      if (!commandText) return;
      if (isCubePanelCommand(commandText)) {
        setCubeOpen(true);
        aiRef.current?.speak("Operator verification is required to open the cube.");
        return;
      }
      const worldCommand = parseWorldCommand(commandText);
      if (worldCommand) {
        executeWorldCommand(worldCommand);
        return;
      }
      if (isCameraVisionRequest(commandText)) {
        const sensors = sensRef.current;
        const description = await describeCameraFrame(
          sensors?.cameraIsActive ? sensors.video : null,
        );
        setResponseSource("camera description");
        aiRef.current?.speak(description);
        return;
      }
      await aiRef.current?.handleText(commandText);
    },
    [executeWorldCommand, operatorName],
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
      operatorName,
      operatorFullName,
      onSpeak: setLastWords,
      onOfflineChange: setAiOffline,
      onResponseSource: setResponseSource,
      findOfflineAnswer: (text) => {
        const memory = memoryRef.current;
        if (!memory) return null;
        try {
          const remembered = findLocalAnswer(text, memory);
          if (remembered) return remembered;
          const known = lookupKnowledge(text);
          return known ? { answer: known, source: "local knowledge" } : null;
        } catch (error) {
          setMemoryError(error instanceof Error ? error.message : "Local memory is unavailable.");
          return null;
        }
      },
    });
    aiRef.current = ai;
    ai.setMuted(silentRef.current);
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
    setVoiceAvailable(Boolean(RecCtor));
    let rec: Rec | null = null;
    const restart = () => {
      if (!RecCtor || rec) return;
      try {
        rec = new RecCtor();
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (e) => {
          const t = e.results[e.results.length - 1]?.[0]?.transcript;
          if (t) void sendCommand(t, "voice");
        };
        rec.onend = () => {
          rec = null;
          setVoiceListening(false);
        };
        rec.start();
        setVoiceListening(true);
      } catch {
        rec = null;
        setVoiceListening(false);
      }
    };
    restart();
    recRef.current = {
      stop: () => {
        rec?.stop();
        setVoiceListening(false);
      },
      start: restart,
    };
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
      if (e.key === "s") void sendCommand("Osiris", "voice");
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
      if (micFlashTimer.current !== null) window.clearTimeout(micFlashTimer.current);
      recRef.current?.stop();
      aiRef.current?.dispose();
      sensRef.current?.stop();
      r.dispose();
    };
  }, [sendCommand, operatorFullName, operatorName]);

  useEffect(() => {
    try {
      setMemoryCount(memoryRef.current?.list().length ?? 0);
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : "Local memory could not be loaded.");
    }
  }, []);

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
        onMicLevel: (value) => {
          if (value < 0.02) return;
          setListeningFlash(true);
          if (micFlashTimer.current !== null) window.clearTimeout(micFlashTimer.current);
          micFlashTimer.current = window.setTimeout(() => setListeningFlash(false), 240);
        },
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

  function saveCurrentHighlight() {
    const memory = memoryRef.current;
    if (!memory || !lastQuestionRef.current || lastWords === "No response yet.") return;
    try {
      setMemoryCount(memory.save([createHighlight(lastQuestionRef.current, lastWords)]));
      setMemoryError("");
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : "The highlight could not be saved.");
    }
  }

  async function importKnowledgeFile(file: File) {
    const memory = memoryRef.current;
    if (!memory) return;
    setMemoryError("");
    try {
      if (file.size > 500_000) throw new RangeError("Documents must be 500 KB or smaller.");
      const records = splitDocument(file.name, await file.text());
      setMemoryCount(memory.save(records));
    } catch (error) {
      setMemoryError(
        error instanceof Error ? error.message : "The document could not be imported.",
      );
    }
  }

  const stageStyle = {
    "--avatar-hud-accent": themeAccent,
    "--avatar-hud-line": `${themeAccent}80`,
  } as CSSProperties;

  return (
    <div
      className={`avatar-stage${clearScreen ? " avatar-stage--clear-screen" : ""}`}
      data-scene-ready={ready ? "" : undefined}
      style={stageStyle}
    >
      <div ref={host} className="absolute inset-0" />
      {cubeOpen && (
        <CubePanel
          onClose={() => setCubeOpen(false)}
          onAuthorized={(name) => aiRef.current?.setOperatorIdentity(name)}
        />
      )}
      {knowledgeOpen && (
        <KnowledgePanel
          count={memoryCount}
          error={memoryError}
          onClose={() => setKnowledgeOpen(false)}
          onImport={(file) => void importKnowledgeFile(file)}
        />
      )}
      <div className="avatar-hud avatar-hud--tr">
        {aiOffline && !clearScreen && (
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
          STATUS:{" "}
          <span className="avatar-hud__value">
            <span className={`avatar-hud__listening-flash${listeningFlash ? " is-active" : ""}`} />
            {state}
            {aiOffline ? " · OFFLINE" : silent ? " · SILENT" : ""}
          </span>
        </div>
        <div>
          INTENSITY: <span className="avatar-hud__value">{intensityLabel(level)}</span>
        </div>
      </div>
      <div className="avatar-hud avatar-hud--tl">
        <div className="avatar-hud__db-status">DB: {databaseStatus.toUpperCase()}</div>
        <div>
          {perf.fps} FPS {!clearScreen && `· ${(perf.particles / 1000).toFixed(0)}K PTS`}
        </div>
        {!clearScreen && (
          <div>
            CAM {sensor?.camera ? "ON" : "OFF"} · MIC {sensor?.mic ? "ON" : "OFF"} · HANDS{" "}
            {sensor?.hands ? "ON" : "OFF"}
          </div>
        )}
        {sensor?.error && !clearScreen && <div className="avatar-hud__warning">{sensor.error}</div>}
      </div>
      <section className="avatar-hud avatar-hud--commands avatar-cabinet" aria-label="Osiris chat">
        <div className="avatar-hud__last-words" aria-live="polite">
          <div className="avatar-hud__last-words-label">{displayName}&apos;s last words</div>
          <p>{lastWords}</p>
          <div className="avatar-cabinet__response-meta">
            <span className="avatar-hud__response-source">Response: {responseSource}</span>
            <button
              className="avatar-hud__save-highlight"
              type="button"
              onClick={saveCurrentHighlight}
              disabled={!lastQuestionRef.current || lastWords === "No response yet."}
            >
              Save highlight
            </button>
          </div>
        </div>
        <div className="avatar-cabinet__tabs" role="tablist" aria-label="Control categories">
          <CabinetTabButton
            icon={Sparkles}
            id="scene"
            label="Scene"
            selected={cabinetTab === "scene"}
            onSelect={setCabinetTab}
          />
          <CabinetTabButton
            icon={Activity}
            id="motion"
            label="Motion"
            selected={cabinetTab === "motion"}
            onSelect={setCabinetTab}
          />
          <CabinetTabButton
            icon={Eye}
            id="tools"
            label="Tools"
            selected={cabinetTab === "tools"}
            onSelect={setCabinetTab}
          />
          <CabinetTabButton
            icon={Settings}
            id="settings"
            label="Settings"
            selected={cabinetTab === "settings"}
            onSelect={setCabinetTab}
          />
        </div>
        <div
          id="avatar-cabinet-panel"
          className="avatar-cabinet__options"
          role="tabpanel"
          aria-labelledby={`avatar-cabinet-tab-${cabinetTab}`}
          aria-label={`${cabinetTab} controls`}
        >
          {cabinetTab === "scene" && (
            <CabinetGroup label="Avatar scale">
              <div className="avatar-cabinet__option-grid">
                <CabinetAction
                  icon={Shrink}
                  label="Compact"
                  onClick={() => executeWorldCommand({ type: "shrink" })}
                />
                <CabinetAction
                  icon={Expand}
                  label="Full size"
                  onClick={() => executeWorldCommand({ type: "grow" })}
                />
              </div>
            </CabinetGroup>
          )}
          {cabinetTab === "motion" && (
            <CabinetGroup label="Locomotion modes">
              <div className="avatar-cabinet__option-grid">
                <CabinetAction
                  icon={Activity}
                  label="Walk"
                  onClick={() => executeWorldCommand({ type: "mode", mode: "walk" })}
                />
                <CabinetAction
                  icon={Activity}
                  label="Run"
                  onClick={() => executeWorldCommand({ type: "mode", mode: "run" })}
                />
                <CabinetAction
                  icon={Plane}
                  label="Fly"
                  onClick={() => executeWorldCommand({ type: "mode", mode: "fly" })}
                />
                <CabinetAction
                  icon={ArrowUp}
                  label="Jump"
                  onClick={() => executeWorldCommand({ type: "mode", mode: "jump" })}
                />
                <CabinetAction
                  icon={Square}
                  label="Stop"
                  onClick={() => executeWorldCommand({ type: "stop" })}
                />
                <CabinetAction
                  icon={Undo2}
                  label="Come back"
                  onClick={() => executeWorldCommand({ type: "come-back" })}
                />
              </div>
            </CabinetGroup>
          )}
          {cabinetTab === "tools" && (
            <>
              <CabinetGroup label="Knowledge and sensors">
                <div className="avatar-cabinet__option-grid">
                  <CabinetAction
                    icon={BookOpen}
                    label="Knowledge"
                    onClick={() => setKnowledgeOpen((open) => !open)}
                  />
                  <CabinetAction
                    icon={Camera}
                    label={sensor ? "Camera on" : "Camera + mic"}
                    onClick={() => void enableSensors()}
                    disabled={Boolean(sensor)}
                  />
                </div>
              </CabinetGroup>
              <CabinetGroup label="Presence">
                <div className="avatar-cabinet__option-grid">
                  <CabinetAction
                    icon={Sparkles}
                    label="Summon"
                    onClick={() => void sendCommand("Osiris")}
                  />
                  <CabinetAction
                    icon={Presentation}
                    label={presenting ? "Put away" : "Present"}
                    onClick={togglePresent}
                  />
                </div>
              </CabinetGroup>
            </>
          )}
          {cabinetTab === "settings" && (
            <div className="avatar-cabinet__settings">
              <CabinetGroup label="Interface and access">
                <div className="avatar-cabinet__option-grid">
                  <CabinetAction
                    icon={Eye}
                    label={clearScreen ? "Show screen" : "Clear screen"}
                    onClick={() => {
                      const next = !clearScreen;
                      setClearScreen(next);
                      saveClearScreenPreference(next);
                    }}
                  />
                  <CabinetAction icon={LogOut} label="Sign out" onClick={() => void onSignOut()} />
                </div>
                {signOutError && (
                  <p className="operator-auth__error" role="alert">
                    {signOutError}
                  </p>
                )}
              </CabinetGroup>
              <CabinetGroup label="Rendering and theme">
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
              </CabinetGroup>
            </div>
          )}
        </div>
        <form
          className="avatar-cabinet__form"
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
          <input
            id="avatar-command"
            className="avatar-hud__input"
            placeholder="Type a command…"
            value={chat}
            onChange={(e) => setChat(e.target.value)}
          />
          <button
            className="avatar-cabinet__icon-button"
            type="button"
            onClick={() => (voiceListening ? recRef.current?.stop() : recRef.current?.start())}
            disabled={!voiceAvailable}
            aria-label={voiceListening ? "Stop voice input" : "Start voice input"}
            title={
              voiceAvailable ? "Toggle voice input" : "Voice input is unavailable in this browser"
            }
          >
            {voiceListening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
          </button>
          <button
            className="avatar-hud__send"
            type="submit"
            disabled={!chat.trim()}
            aria-label="Send command"
          >
            <Sparkles aria-hidden="true" />
          </button>
        </form>
      </section>
    </div>
  );
}

function CabinetTabButton({
  icon: Icon,
  id,
  label,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  id: CabinetTab;
  label: string;
  selected: boolean;
  onSelect: (tab: CabinetTab) => void;
}) {
  return (
    <button
      id={`avatar-cabinet-tab-${id}`}
      className="avatar-cabinet__tab"
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls="avatar-cabinet-panel"
      onClick={() => onSelect(id)}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function CabinetAction({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="avatar-cabinet__action"
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function CabinetGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="avatar-cabinet__group" aria-label={label}>
      <h3>{label}</h3>
      {children}
    </section>
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
