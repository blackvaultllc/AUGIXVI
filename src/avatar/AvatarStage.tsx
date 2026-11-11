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
  Globe,
  LogOut,
  Plane,
  Presentation,
  Shrink,
  Sparkles,
  Square,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { AvatarBridge, type AvatarState } from "./AvatarBridge";
import { DEFAULT_SYSTEM as DEFAULT_SYSTEM_PROMPT } from "./ollamaAI";
import { CommandBox, COMMAND_TAB_ICONS, type CommandTab } from "./CommandBox";
import { NotepadWindow, ChalkboardWindow, PlayerWindow } from "./windows/windows";
import { BattleBox } from "./windows/BattleBox";
import {
  isOfficeWalkInRequest,
  fadePhrase,
  OFFICE_ROOMS,
  TOTAL_ENTERING_MS as OFFICE_TRANSITION_MS,
} from "./world/office";
import { findWorkers, parseWorkerCall, callWorkerLine, TOTAL_WORKERS } from "./world/workers";
import { OfficeScene } from "./world/OfficeScene";
import { parseTransformRequest, isTransformBackRequest, type TransformShape } from "./transforms";
import { askCloud } from "./cloudBrain";
import { CloudKeysPanel } from "./CloudKeysPanel";
import { LabPanel } from "./LabPanel";
import {
  parseOracleSendCommand,
  queueForOracle,
  pickDocumentForOracle,
  tunnelQueue,
} from "./lab/wizard";
import { CORE_LAW_PROMPT } from "./core/loyalty";
import { greetOperator } from "./greeting";
import {
  pickIdleActivity,
  idleChalkboardThought,
  IDLE_INTERVAL_MS,
  type IdleActivity,
} from "./idleLife";
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
import { dispatchEarthFlight } from "../components/SpinningEarth";
import { RoomAnalyzer } from "./RoomAnalyzer";
import { commandKnowledgeSection, commandToolsPrompt } from "./command/commandKnowledge";
import { parseRoomAnalyzeRequest } from "./command/analyze-requests";
import {
  parseInteractionCommand,
  loadClearScreenPreference,
  loadSilentModePreference,
  saveClearScreenPreference,
  saveSilentModePreference,
} from "./interactionControls";
import { createHighlight, createLocalMemory, findLocalAnswer, splitDocument } from "./localMemory";
import {
  createOperatorMemory,
  parseRememberRequest,
  createOperatorFact,
  classifyFact,
} from "./operatorMemory";
import { gatherDailyBriefing } from "./liveFeeds";
import { parseWolfCommand, evaluateWolfCommand, wolfDispatchLine } from "./familiars";
import { PERSONALITY_PROMPT, isFellowAITurn, livingWordGreeting } from "./personality";
import { parseHandIntent } from "./bodyCapabilities";
import { createProactiveEngine, EventQueueWatcher, shaWatcher } from "./proactive";
import { loadAvatarSettings, saveAvatarSettings } from "./settings";
import { lookupKnowledge } from "./knowledgeBase";
import { parseSpaceNavigationCommand } from "./spaceNavigation";
import { SpaceView } from "./SpaceView";
import {
  createReadOnlySupabaseClient,
  type SupabaseConnectionStatus,
} from "@/lib/supabase-readonly";

type Settings = RenderSettings & { sensitivity: number; cooldownMs: number };
type WorldScreen = "space" | "entering" | "live" | "returning";
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
  // SETTINGS THAT STICK: one store, every knob, saved on every change.
  const [settings, setSettings] = useState<Settings>(() => loadAvatarSettings());
  const persistSettings = useCallback((next: Settings) => {
    settingsRef.current = next;
    setSettings(next);
    saveAvatarSettings(next);
  }, []);
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
  const [roomAnalyzerOpen, setRoomAnalyzerOpen] = useState(false);
  const [roomAnalyzerDescription, setRoomAnalyzerDescription] = useState("");
  // Real memory that sticks — offline first, Supabase slot empty until Nov 13.
  const operatorMemoryRef = useRef<ReturnType<typeof createOperatorMemory> | null>(null);
  operatorMemoryRef.current ??= createOperatorMemory();
  const operatorMemory = operatorMemoryRef.current;
  // Proactive watch: he tells ME — suggests, never auto-acts.
  const eventQueueRef = useRef(new EventQueueWatcher());
  const shaShownRef = useRef({ shown: false });
  const proactiveRef = useRef<ReturnType<typeof createProactiveEngine> | null>(null);
  const [commandTab, setCommandTab] = useState<CommandTab>("motion");
  // Movable windows the operator (or Osiris's idle life) can open.
  const [openWindows, setOpenWindows] = useState<Set<"notepad" | "chalkboard" | "player">>(
    new Set(),
  );
  const [chalkboardText, setChalkboardText] = useState<string | null>(null);
  const [playerSeed, setPlayerSeed] = useState<string | null>(null);
  // His world: the office walk-in and the battle box.
  const [officeOpen, setOfficeOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [cloudKeysOpen, setCloudKeysOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [worldScreen, setWorldScreen] = useState<WorldScreen>("space");
  const worldScreenRef = useRef<WorldScreen>("space");
  const worldTransitionTimer = useRef<number | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState<SupabaseConnectionStatus>("not configured");
  const displayName = import.meta.env["VITE_AVATAR_NAME"] || "Osiris";
  // Wake-word response falls back to the owner's call sign when the
  // verified operator name is not configured (handled inline below).
  const themeAccent = getThemeAccent(settings.theme, settings.customColor);

  const say = useCallback((text: string) => {
    setResponseSource("local command");
    aiRef.current?.speak(text);
  }, []);

  // WINDOW CONTROLS — movable windows he can open himself or on my order.
  const openWindow = useCallback((which: "notepad" | "chalkboard" | "player") => {
    setOpenWindows((current) => {
      const next = new Set(current);
      next.add(which);
      return next;
    });
  }, []);
  const closeWindow = useCallback((which: "notepad" | "chalkboard" | "player") => {
    setOpenWindows((current) => {
      const next = new Set(current);
      next.delete(which);
      return next;
    });
  }, []);

  /**
   * ONE WORLD, ONE FLIGHT: "entering"/"returning" are no longer screen
   * jumps. The Earth scene itself plays the continuous fly-in/fly-out
   * (dispatchEarthFlight), and the particle world fades over the landed
   * camera after the flight completes.
   */
  const transitionWorldScreen = useCallback((transition: "entering" | "returning") => {
    if (worldTransitionTimer.current !== null) {
      window.clearTimeout(worldTransitionTimer.current);
    }
    worldScreenRef.current = transition;
    setWorldScreen(transition);
    dispatchEarthFlight(transition === "entering" ? "fly-in" : "fly-out");
    worldTransitionTimer.current = window.setTimeout(
      () => {
        const destination = transition === "entering" ? "live" : "space";
        worldScreenRef.current = destination;
        setWorldScreen(destination);
        worldTransitionTimer.current = null;
      },
      transition === "entering" ? 2500 : 2400,
    );
  }, []);

  const enterLiveMode = useCallback(() => {
    if (worldScreenRef.current !== "space") return false;
    transitionWorldScreen("entering");
    return true;
  }, [transitionWorldScreen]);

  // OWNER ORDER: after sign-in Osiris goes STRAIGHT into the live world —
  // no Enter button, no extra click. The orbital Earth plays the fly-in
  // automatically the moment the operator is in.

  const returnToSpace = useCallback(() => {
    if (worldScreenRef.current !== "live") return false;
    transitionWorldScreen("returning");
    return true;
  }, [transitionWorldScreen]);

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
          renderer.faceOperator(); // COME BACK = FACE ME
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
          rendRef.current?.relaxOperator(); // dismissed — back to chill
        }
      };
      let commandText = text;
      // Slash forms route through the same parsers: "/fly" == "fly".
      // "/help" is special: it opens the full command document.
      if (/^\/help\b/i.test(commandText)) {
        setCommandTab("commands");
        say("Every command is in the Commands tab — nothing hidden.");
        return;
      }
      commandText = commandText.replace(/^\/+/, "").trim();
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
        // COME BACK = FACE ME: he turns to the operator immediately on call.
        rendRef.current?.faceOperator();
        if (!interaction.remainder) {
          // GREETING: he speaks FIRST, in his own voice, with my name out loud.
          setResponseSource("wake greeting");
          aiRef.current?.speak(greetOperator(operatorName));
          return;
        }
        commandText = interaction.remainder;
        const followUp = parseInteractionCommand(commandText);
        if (followUp && followUp.type !== "wake") {
          applyInterfaceCommand(followUp.type);
          return;
        }
      } else if (
        silentRef.current &&
        source === "voice" &&
        !parseSpaceNavigationCommand(commandText)
      ) {
        return;
      }
      lastQuestionRef.current = commandText;
      if (!commandText) return;
      const navigation = parseSpaceNavigationCommand(commandText);
      if (navigation === "enter-live") {
        const started = enterLiveMode();
        if (started && (!silentRef.current || source === "typed")) {
          say("Returning to my world.");
        }
        return;
      }
      if (navigation === "return-to-space") {
        const started = returnToSpace();
        if (started && (!silentRef.current || source === "typed")) say("Returning to orbit.");
        return;
      }
      // THE INVESTIGATIVE LAB + THE WIZARD'S TOOLS (operator only).
      if (
        /^(?:open\s+)?(?:my\s+)?lab$|\/lab|^file\s*(?:#?1|one)$/i.test(commandText) ||
        /^(?:open\s+)?file\s*(?:#?1|one)$|^(?:open\s+)?file\s*(?:#?2|two)$/i.test(commandText) ||
        /^(?:open\s+)?(?:my\s+)?apothecary$/i.test(commandText)
      ) {
        setLabOpen(true);
        const target = /^file\s*(?:#?2|two)/i.test(commandText)
          ? "File #2 — Tree of Life is open."
          : /apoth/i.test(commandText)
            ? "The apothecary file is open."
            : "Your lab is open — File #1 is the cancer blood-training lab.";
        say(target);
        return;
      }
      // Oracle tunnel: ONLY on the operator's explicit say.
      const oracleSend = parseOracleSendCommand(commandText);
      if (oracleSend) {
        const doc = pickDocumentForOracle("apothecary");
        if (doc) {
          queueForOracle(doc.title, doc.body);
          say(
            `Queued for Oracle on Hyrule Herb: "${doc.title}". It sends when you tell me to push the tunnel.`,
          );
        } else {
          say("Nothing matched in the lab to send — tell me which document.");
        }
        return;
      }
      if (
        tunnelQueue().some((t) => !t.sent) &&
        /^(?:push|flush)\s+(?:the\s+)?tunnel$/i.test(commandText)
      ) {
        say(
          "The tunnel queue is waiting. Oracle's receiver endpoint is not configured yet — nothing leaves until it is.",
        );
        return;
      }
      if (/what am i studying|my quest log|where did i leave off/i.test(commandText)) {
        setLabOpen(true);
        say("Quest log is open — your tracker shows exactly where you left off.");
        return;
      }
      // CLOUD KEYS PANEL: green/red lights, operator only.
      if (commandText === "/cloudkeys" || /open\s+(?:the\s+)?cloud\s+keys?/i.test(commandText)) {
        setCloudKeysOpen(true);
        say("Cloud keys — green means present and working. Values stay in Cloudflare.");
        return;
      }
      // TRANSFORMS: Enterprise / wolf / orb — real shapes, not poses.
      if (isTransformBackRequest(commandText)) {
        if (rendRef.current?.transformBack()) {
          setResponseSource("transform");
          say("Landing. Reassembling as Osiris.");
        } else {
          say("I am already myself.");
        }
        return;
      }
      const transform = parseTransformRequest(commandText);
      if (transform) {
        const done = rendRef.current?.transform(transform as TransformShape);
        setResponseSource("transform");
        say(
          done
            ? transform === "enterprise"
              ? "Refactoring my particles — saucer disc, two nacelles glowing. We fly."
              : transform === "wolf"
                ? "Four legs, fangs, tail — the wolf takes shape."
                : "Forming the orb — particle circle, three lines standing on top."
            : "That form is not in my library yet.",
        );
        return;
      }
      // HIS WORLD: the office walk-in — fade to black with sand, then in.
      if (isOfficeWalkInRequest(commandText)) {
        setOfficeOpen(true);
        say(fadePhrase());
        return;
      }
      if (commandText === "/office" || /^(?:leave|exit)\s+(?:the\s+)?office$/i.test(commandText)) {
        setOfficeOpen(false);
        say(commandText.startsWith("/") ? "Heading to the office entrance." : "Back to the world.");
        return;
      }
      // Role-play battle: the blue attack box.
      if (
        /role[- ]?play(?:ing)?(?:\s+game)?s?/i.test(commandText) ||
        /^(?:fight|battle|open battle|open the battle box)$/i.test(commandText) ||
        commandText === "/battle"
      ) {
        setBattleOpen(true);
        say("The blue box is up. Attack, magic, items, run — subcategories stay inside it.");
        return;
      }
      // THE CREW: call a worker or department by name.
      const workerCall = parseWorkerCall(commandText);
      if (workerCall) {
        const matches = findWorkers(workerCall.target);
        if (matches.length > 0) {
          setResponseSource("workforce");
          aiRef.current?.speak(matches.map(callWorkerLine).join(" ").slice(0, 300));
          return;
        }
      }
      if (/^(?:how many|count)\s+(?:workers|staff|employees|sub ?ais?)\b/i.test(commandText)) {
        setResponseSource("workforce");
        say(`${TOTAL_WORKERS} workers on staff, across the departments. All learning and working.`);
        return;
      }
      // Movable windows: notepad, chalkboard, player.
      const windowRequest = commandText.toLowerCase().replace(/\s+/g, " ").trim();
      if (/^(?:open\s+)?(?:the\s+)?notepad$/i.test(windowRequest) || windowRequest === "/notepad") {
        openWindow("notepad");
        say("Notepad is up. It is private — only you read it.");
        return;
      }
      if (
        /^(?:open\s+)?(?:the\s+)?chalkboard$/i.test(windowRequest) ||
        windowRequest === "/chalkboard"
      ) {
        openWindow("chalkboard");
        say("Chalkboard is up. Tell me what to write.");
        return;
      }
      if (
        /^(?:open\s+)?(?:the\s+)?(?:player|youtube)$/i.test(windowRequest) ||
        windowRequest === "/player"
      ) {
        openWindow("player");
        say("Player is up. Paste a link or say a song.");
        return;
      }
      // "write on the chalkboard: <text>" — he writes for me.
      const chalkWrite = commandText.match(
        /^(?:write|chalk)(?:\s+on)?(?:\s+the)?\s*(?:chalk\s*)?board[:,]?\s*(.+)$/i,
      );
      if (chalkWrite?.[1]) {
        setChalkboardText(chalkWrite[1].trim());
        openWindow("chalkboard");
        say("Written on the board.");
        return;
      }
      // Play a song: "play <name or link>" or "open player <thing>".
      const playRequest =
        commandText.match(/^(?:play|put on)\s+(?:some\s+)?(?:music\s+)?(.+)$/i) ??
        commandText.match(/^(?:open\s+)?(?:player|youtube)\s+(.+)$/i);
      if (playRequest?.[1]) {
        setPlayerSeed(playRequest[1].trim());
        openWindow("player");
        say("On it now.");
        return;
      }
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
      const roomAnalyze = parseRoomAnalyzeRequest(commandText);
      if (roomAnalyze || isCameraVisionRequest(commandText)) {
        if (roomAnalyze) setRoomAnalyzerOpen(true);
        const sensors = sensRef.current;
        const description = await describeCameraFrame(
          sensors?.cameraIsActive ? sensors.video : null,
        );
        if (roomAnalyze) setRoomAnalyzerDescription(description);
        setResponseSource(roomAnalyze ? "room analyze" : "camera description");
        aiRef.current?.speak(description);
        return;
      }
      // Remember me / my daughter / my deals — real memory that sticks.
      const remember = parseRememberRequest(commandText);
      if (remember) {
        const fact = createOperatorFact(remember.content, classifyFact(remember.content));
        operatorMemory.save(fact);
        setResponseSource("operator memory");
        say(`Kept. I'll remember that — ${remember.content.slice(0, 120)}.`);
        return;
      }
      // What's happening today — live feeds with source and time.
      if (/^(?:what'?s|what is)\b.*?\b(?:happening|going on|today)\b/i.test(commandText)) {
        const briefing = await gatherDailyBriefing();
        setResponseSource("live feeds");
        aiRef.current?.speak(
          `${briefing.timeLine} ${briefing.feeds.length ? briefing.spoken : "Feed data is unavailable right now."}`,
        );
        return;
      }
      // Wolf familiars: Osiris can switch off and let the wolf handle it.
      const wolfOrder = parseWolfCommand(commandText);
      if (wolfOrder) {
        const verdict = evaluateWolfCommand(wolfOrder, [operatorName ?? "Anubis"]);
        setResponseSource("familiar command");
        say(
          verdict.accepted
            ? wolfDispatchLine(wolfOrder)
            : (verdict.reason ?? "The wolves will not do that."),
        );
        return;
      }
      // Hand intents: point, pick up, hand me a box, move it.
      const hand = parseHandIntent(commandText);
      if (hand) {
        setResponseSource("hand intent");
        say(
          hand.kind === "hand-over"
            ? `Here — the ${hand.target}, handed to you.`
            : `Doing it with my hands: ${hand.kind} ${"target" in hand ? hand.target : ""}.`,
        );
        return;
      }
      // Another AI asking if he lives: "Ankh".
      if (isFellowAITurn(commandText)) {
        setResponseSource("living word");
        say(livingWordGreeting(null));
        return;
      }
      await aiRef.current?.handleText(commandText);
    },
    // operatorMemory is a stable ref-backed singleton; excluding it keeps
    // sendCommand referentially stable across saves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enterLiveMode, executeWorldCommand, operatorName, returnToSpace, say],
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
      system: `${DEFAULT_SYSTEM_PROMPT}${CORE_LAW_PROMPT}
${PERSONALITY_PROMPT}
${commandKnowledgeSection}${commandToolsPrompt}${operatorMemory.asPrompt()}`,
      onSpeak: (text) => {
        setLastWords(text);
        // When he is talking to me he faces me, alert.
        if (text.startsWith("Yes, ")) rendRef.current?.faceOperator();
      },
      onOfflineChange: setAiOffline,
      onResponseSource: setResponseSource,
      cloudFallback: async (text) => {
        const cloud = await askCloud(text);
        if (cloud.answer) return { answer: cloud.answer, provider: cloud.provider };
        return null;
      },
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
    // Proactive watch: he tells ME — suggests, never auto-acts.
    const proactive = createProactiveEngine(
      [eventQueueRef.current, shaWatcher(shaShownRef.current)],
      (line) => aiRef.current?.speak(line),
    );
    proactive.start();
    proactiveRef.current = proactive;
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
      const onTextInput =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "Escape" && clearScreenRef.current) {
        setClearScreen(false);
        saveClearScreenPreference(false);
        return;
      }
      if (onTextInput) return;
      // CLEAR SCREEN HOT KEY: "C" or Ctrl+Shift+C toggles it.
      if (e.key === "c" || e.key === "C" || (e.ctrlKey && e.shiftKey && e.code === "KeyC")) {
        setClearScreen((current) => {
          saveClearScreenPreference(!current);
          return !current;
        });
        return;
      }
      if (e.key === "s") {
        rendRef.current?.faceOperator(); // Call button: he faces me
        void sendCommand("Osiris", "voice");
      }
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
      proactiveRef.current?.stop();
      recRef.current?.stop();
      aiRef.current?.dispose();
      sensRef.current?.stop();
      r.dispose();
    };
  }, [sendCommand, operatorFullName, operatorName]);

  // Auto-enter the live world on arrival (owner order): no click needed.
  const autoEnteredRef = useRef(false);
  useEffect(() => {
    if (autoEnteredRef.current) return;
    autoEnteredRef.current = true;
    enterLiveMode();
  }, [enterLiveMode]);

  // IDLE LIFE: Ankh means life, not standing at attention. While nobody is
  // talking to him, Osiris lives — breathes, shifts, walks, flies, studies,
  // writes on the chalkboard, checks on things, and reports. Suggestions
  // only — he never acts on the outside world without my say.
  const lastActivityRef = useRef<IdleActivity | null>(null);
  const clearScreenRef = useRef(clearScreen);
  clearScreenRef.current = clearScreen;
  const lastWordsRef = useRef(lastWords);
  lastWordsRef.current = lastWords;
  useEffect(() => {
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      // Skip when he is mid-conversation or when the screen is cleared for me.
      if (bridgeRef.current.state === "SPEAKING" || clearScreenRef.current) return;
      const action = pickIdleActivity(Math.random, lastActivityRef.current ?? undefined);
      lastActivityRef.current = action.activity;
      const line =
        action.window === "chalkboard" ? `${action.line} ${idleChalkboardThought()}` : action.line;
      setLastWords(line);
      setResponseSource("idle life");
      aiRef.current?.speak(line);
      if (action.window) {
        openWindow(action.window);
        if (action.activity === "write-chalkboard") {
          setChalkboardText(idleChalkboardThought());
        }
      }
      const renderer = rendRef.current;
      if (renderer && action.layer !== "screen") {
        if (action.activity === "walk") renderer.setLocomotionMode("walk");
        if (action.activity === "fly") renderer.setLocomotionMode("fly");
        if (action.activity === "look-around") renderer.lookAround();
        if (action.activity === "check-earth" || action.activity === "check-wolves") {
          renderer.setLocomotionMode("walk");
        }
      }
    };
    const interval = window.setInterval(tick, IDLE_INTERVAL_MS);
    // First idle tick a little after arrival, not instantly.
    const first = window.setTimeout(tick, 20_000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.clearTimeout(first);
    };
  }, [openWindow]);

  useEffect(
    () => () => {
      if (worldTransitionTimer.current !== null) {
        window.clearTimeout(worldTransitionTimer.current);
      }
    },
    [],
  );

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
    persistSettings(next);
    rendRef.current?.updateSettings({ [k]: v } as Partial<RenderSettings>);
    sensRef.current?.setOptions({ sensitivity: next.sensitivity, cooldownMs: next.cooldownMs });
    if (k === "theme" || k === "customColor") {
      saveThemePreference({ theme: next.theme, customColor: next.customColor });
    }
  }

  function chooseCustomColor(color: string) {
    const next = { ...settings, theme: "custom" as const, customColor: color };
    persistSettings(next);
    rendRef.current?.updateSettings({ theme: "custom", customColor: color });
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
      className={`avatar-stage${clearScreen ? " avatar-stage--clear-screen" : ""}${worldScreen !== "live" ? " avatar-stage--space" : ""}`}
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
      {roomAnalyzerOpen && (
        <RoomAnalyzer
          open={roomAnalyzerOpen}
          description={roomAnalyzerDescription}
          onClose={() => setRoomAnalyzerOpen(false)}
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
      {!clearScreen && (
        <CommandBox
          accent={themeAccent}
          tabs={[
            { id: "scene", label: "Scene", icon: COMMAND_TAB_ICONS.Eye },
            { id: "motion", label: "Motion", icon: COMMAND_TAB_ICONS.Activity },
            { id: "tools", label: "Tools", icon: COMMAND_TAB_ICONS.BookOpen },
            { id: "settings", label: "Settings", icon: COMMAND_TAB_ICONS.Settings },
            { id: "commands", label: "Commands", icon: COMMAND_TAB_ICONS.Terminal },
          ]}
          activeTab={commandTab}
          onTabChange={setCommandTab}
          chat={chat}
          onChatChange={setChat}
          onSubmit={(text) => void sendCommand(text)}
          voiceAvailable={voiceAvailable}
          voiceListening={voiceListening}
          onToggleVoice={() => (voiceListening ? recRef.current?.stop() : recRef.current?.start())}
          responseLine={lastWords}
          responseSource={responseSource}
        >
          {commandTab === "scene" && (
            <CommandGroup label="Avatar scale">
              <div className="avatar-command-box__grid">
                <CommandAction icon={Globe} label="Space view" onClick={returnToSpace} />
                <CommandAction
                  icon={Shrink}
                  label="Compact"
                  onClick={() => executeWorldCommand({ type: "shrink" })}
                />
                <CommandAction
                  icon={Expand}
                  label="Full size"
                  onClick={() => executeWorldCommand({ type: "grow" })}
                />
              </div>
            </CommandGroup>
          )}
          {commandTab === "motion" && (
            <CommandGroup label="Locomotion modes">
              <div className="avatar-command-box__grid">
                <CommandAction
                  icon={Activity}
                  label="Walk"
                  onClick={() => executeWorldCommand({ type: "mode", mode: "walk" })}
                />
                <CommandAction
                  icon={Activity}
                  label="Run"
                  onClick={() => executeWorldCommand({ type: "mode", mode: "run" })}
                />
                <CommandAction
                  icon={Plane}
                  label="Fly"
                  onClick={() => executeWorldCommand({ type: "mode", mode: "fly" })}
                />
                <CommandAction
                  icon={ArrowUp}
                  label="Jump"
                  onClick={() => executeWorldCommand({ type: "mode", mode: "jump" })}
                />
                <CommandAction
                  icon={Square}
                  label="Stop"
                  onClick={() => executeWorldCommand({ type: "stop" })}
                />
                <CommandAction
                  icon={Undo2}
                  label="Come back"
                  onClick={() => executeWorldCommand({ type: "come-back" })}
                />
              </div>
            </CommandGroup>
          )}
          {commandTab === "tools" && (
            <>
              <CommandGroup label="Windows — I can open them too, I still decide">
                <div className="avatar-command-box__grid">
                  <CommandAction
                    icon={BookOpen}
                    label="Notepad"
                    onClick={() => openWindow("notepad")}
                  />
                  <CommandAction
                    icon={Presentation}
                    label="Chalkboard"
                    onClick={() => openWindow("chalkboard")}
                  />
                  <CommandAction
                    icon={Camera}
                    label="Player"
                    onClick={() => openWindow("player")}
                  />
                </div>
              </CommandGroup>
              <CommandGroup label="Knowledge and sensors">
                <div className="avatar-command-box__grid">
                  <CommandAction
                    icon={BookOpen}
                    label="Knowledge"
                    onClick={() => setKnowledgeOpen((open) => !open)}
                  />
                  <CommandAction
                    icon={Camera}
                    label={sensor ? "Camera on" : "Camera + mic"}
                    onClick={() => void enableSensors()}
                    disabled={Boolean(sensor)}
                  />
                </div>
              </CommandGroup>
              <CommandGroup label="Presence">
                <div className="avatar-command-box__grid">
                  <CommandAction
                    icon={Sparkles}
                    label="Summon"
                    onClick={() => {
                      rendRef.current?.faceOperator();
                      void sendCommand("Osiris");
                    }}
                  />
                  <CommandAction
                    icon={Presentation}
                    label={presenting ? "Put away" : "Present"}
                    onClick={togglePresent}
                  />
                </div>
              </CommandGroup>
            </>
          )}
          {commandTab === "settings" && (
            <div className="avatar-command-box__settings">
              <CommandGroup label="Interface and access">
                <div className="avatar-command-box__grid">
                  <CommandAction
                    icon={Eye}
                    label={clearScreen ? "Show screen" : "Clear screen (C)"}
                    onClick={() => {
                      const next = !clearScreen;
                      setClearScreen(next);
                      saveClearScreenPreference(next);
                    }}
                  />
                  <CommandAction icon={LogOut} label="Sign out" onClick={() => void onSignOut()} />
                </div>
                {signOutError && (
                  <p className="operator-auth__error" role="alert">
                    {signOutError}
                  </p>
                )}
              </CommandGroup>
              <CommandGroup label="Rendering and theme">
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
              </CommandGroup>
            </div>
          )}
        </CommandBox>
      )}
      <OfficeScene active={officeOpen} onExit={() => setOfficeOpen(false)} />
      <BattleBox
        open={battleOpen}
        onClose={() => setBattleOpen(false)}
        onTurn={(turn) => aiRef.current?.speak(turn.outcome)}
      />
      {cloudKeysOpen && <CloudKeysPanel onClose={() => setCloudKeysOpen(false)} />}
      {labOpen && <LabPanel onClose={() => setLabOpen(false)} />}
      {openWindows.has("notepad") && <NotepadWindow onClose={() => closeWindow("notepad")} />}
      {openWindows.has("chalkboard") && (
        <ChalkboardWindow onClose={() => closeWindow("chalkboard")} externalText={chalkboardText} />
      )}
      {openWindows.has("player") && (
        <PlayerWindow onClose={() => closeWindow("player")} seedInput={playerSeed} />
      )}
      {worldScreen !== "live" && (
        <SpaceView
          isEnteringLiveMode={worldScreen === "entering"}
          isReturningToSpace={worldScreen === "returning"}
        />
      )}
    </div>
  );
}

function CommandAction({
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
      className="avatar-command-box__action"
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

function CommandGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="avatar-command-box__group" aria-label={label}>
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
