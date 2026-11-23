import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import * as THREE from "three";
import {
  Activity,
  Anchor,
  ArrowUp,
  AudioLines,
  BarChart3,
  Bluetooth,
  BookOpen,
  Box,
  Brain,
  Bug,
  Building2,
  Clapperboard,
  Camera,
  Coffee,
  DoorOpen,
  Ear,
  Expand,
  Eye,
  FlaskConical,
  Gamepad2,
  Globe,
  Hammer,
  History,
  Home,
  LandPlot,
  Map as MapIcon,
  Network,
  Laptop,
  LayoutGrid,
  LocateFixed,
  LogOut,
  MoveLeft,
  MoveRight,
  Plane,
  Presentation,
  Save,
  Scale,
  ScanSearch,
  ScrollText,
  Shield,
  Shrink,
  Smartphone,
  Sparkles,
  Square,
  Sun,
  Swords,
  TreePine,
  Undo2,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { AvatarBridge, type AvatarState } from "./AvatarBridge";
import { DEFAULT_SYSTEM as DEFAULT_SYSTEM_PROMPT } from "./ollamaAI";
import { CommandBox, COMMAND_TAB_ICONS, type CommandTab } from "./CommandBox";
import "./stage-fix-round.css";
import { BuilderPanel } from "./builder/BuilderPanel";
import { MapPanel } from "./builder/MapPanel";
import { BuiltWorldMapPanel } from "./builder/BuiltWorldMapPanel";
import { BuilderSelectionCluster } from "./builder/SelectionCluster";
import type { WorldInhabitant } from "./builder/worldMap";
import {
  activeLayout,
  addItem,
  claimPlot,
  emptyRoom,
  exportRoomPackage,
  loadLayoutStore,
  makePlacedItem,
  moveItem,
  parseRoomPackage,
  plotAtPoint,
  plotClaimed,
  removeItem,
  rotateItem,
  saveLayoutStore,
  setItemAnchored,
  setSurfaces as setRoomSurfaces,
  unclaimPlot,
  updateItemVariant,
  withLayoutRoom,
  type LayoutStore,
  type RoomContent,
} from "./builder/room";
import { defaultVariant, libraryItem } from "./builder/library";
import {
  frameOffset,
  loadFrameStore,
  saveFrameStore,
  snapFramePosition,
  withFrameOffset,
  withoutFrame,
  type FrameId,
  type FrameRect,
  type FrameStore,
  type SnapGuides,
} from "./builder/frames";
import { AugiePresence } from "./AugiePresence";
import { speakingMsForText } from "./LivingPortrait";
import { AnubisPresence } from "./AnubisPresence";
import { BlackHatterPresence } from "./BlackHatterPresence";
import { MontuPresence } from "./MontuPresence";
import {
  DEFAULT_STAGE_PERSPECTIVE,
  conversationViewFor,
  isGodPerspective,
  perspectiveAfterClose,
  type GodPerspective,
  type StagePerspective,
} from "./stagePerspective";
import {
  constructStandsOnStage,
  dismissalTarget,
  godOnStage,
  isDismissal,
  summonTarget,
  type StageResidency,
} from "./presenceDoctrine";
import {
  ADDRESSEE_NAMES,
  DEFAULT_ADDRESSEE,
  detectAddressee,
  speakerDirective,
  type Addressee,
} from "./addressee";
import {
  besideMedallionGeometry,
  clearMedallionSpot,
  loadOrDefaultMedallionGeometry,
  saveMedallionGeometry,
} from "./medallionAnchor";
import { ANUBIS_BINDING, MONTU_BINDING } from "./medallionPortraits";
import { closeWithBlessing } from "./etiquette";
import {
  applyNotificationInstruction,
  describeNotificationInstruction,
  loadNotificationPrefs,
  parseNotificationInstruction,
  saveNotificationPrefs,
  shouldNotify,
} from "./notificationPrefs";
import { StageNotifications, type StageNotification } from "./StageNotifications";
import { GodReportPopUp, type GodPopUpRequest } from "./GodReportPopUp";
import { godForReportTopic, type StageRect } from "./godPopUp";
import {
  MEDALLION_UNDER_FACE_HEIGHT,
  defaultMedallionGeometry,
  loadMedallionGeometry,
} from "./medallionAnchor";
import { loadSpeechVolume, saveSpeechVolume } from "./speechVoice";
import {
  STAGE_BACKDROPS,
  backdropById,
  loadStageBackdrop,
  saveStageBackdrop,
  type StageBackdropId,
} from "./stageBackdrop";
import { FloatingWindow } from "./windows/FloatingWindow";
import {
  clearFigureOffset,
  loadConstructAnchored,
  loadFigureOffset,
  loadFullBodyHold,
  saveConstructAnchored,
  saveFigureOffset,
  saveFullBodyHold,
} from "./osirisPosition";
import { ConstructControls } from "./ConstructControls";
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
import { ConnectionsPanel } from "./ConnectionsPanel";
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
  idleReportLine,
  IDLE_INTERVAL_MS,
  type IdleActivity,
} from "./idleLife";
import { AvatarRenderer, type RenderSettings } from "./AvatarRenderer";
import { Sensors, type SensorStatus } from "./sensors";
import { attachOllamaAI, type OllamaAIOptions } from "./ollamaAI";
import { CubePanel } from "./CubePanel";
import { ArCubeWindow } from "./ArCubeWindow";
import { PulseWindow } from "./PulseWindow";
import { SoundWatchWindow } from "./SoundWatchWindow";
import { AnalyticWindow } from "./AnalyticWindow";
import { GateLogWindow } from "./GateLogWindow";
import { SignalMapWindow } from "./SignalMapWindow";
import { LogsWindow } from "./LogsWindow";
import { TestAreaWindow } from "./TestAreaWindow";
import { ListeningWindow } from "./ListeningWindow";
import { AnatomyWindow } from "./AnatomyWindow";
import { DepartmentsWindow } from "./DepartmentsWindow";
import { CaptainsLogWindow } from "./CaptainsLogWindow";
import { SandboxWindow } from "./SandboxWindow";
import { LibraryWindow } from "./LibraryWindow";
import { DevicesWindow } from "./DevicesWindow";
import { CamerasWindow } from "./CamerasWindow";
import {
  WAND_GREETING,
  createHeartbeatCheckPacer,
  notePresenceCheck,
  runPresenceCheck,
  scanWifiEnvironment,
} from "./devices/presence";
import { loadRegistry } from "./devices/deviceRegistry";
import { LawWindow } from "./LawWindow";
import { OfficeAnalyticsWindow } from "./OfficeAnalyticsWindow";
import { SpeakerStoresPanel } from "./SpeakerStoresPanel";
import { parseRoomCommand } from "./command/roomCommands";
import { loadBrainAddress, saveBrainAddress } from "./brain";
import { intensityLabel } from "./stateParams";
import {
  getThemeAccent,
  loadThemePreference,
  saveThemePreference,
  THEMES,
  type ThemeChoice,
} from "./themes";
import { isCameraVisionRequest, parseWorldCommand, type MaterialKind } from "./worldCommands";
import {
  DEFAULT_WORLD_SCENE,
  WORLD_SCENES,
  parseFloorCommand,
  parseSceneCommand,
  sceneLine,
  type WorldSceneId,
} from "./worldScenes";
import { describeCameraFrame } from "./vision";
import { KnowledgePanel } from "./KnowledgePanel";
import { ReplyHistoryWindow } from "./ReplyHistoryWindow";
import {
  appendReplyHistory,
  clearReplyHistory,
  loadReplyHistory,
  type ReplyHistoryEntry,
} from "./replyHistory";
import { useNavigate } from "@tanstack/react-router";
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
import { createLocalEar, type EarState, type LocalEar } from "./localEar";
import { stageStatusLabel } from "./voiceHearing";
import { VoiceIndicator } from "./VoiceIndicator";
import { VoiceCalibrationPanel } from "./VoiceCalibrationPanel";
import { TrustedDevicesPanel } from "./TrustedDevicesPanel";
import { PhoneBrainPanel } from "./PhoneBrainPanel";
import {
  PHONE_BRAIN_PROVIDER,
  askPhoneBrain,
  getPhoneBrainStatus,
  phoneBrainStatusLabel,
  type PhoneBrainStatus,
} from "./phoneBrain";
import {
  createVoiceGateVerifier,
  loadVoiceCalibrationPrefs,
  saveVoiceCalibrationPrefs,
  type VoiceCalibrationPrefs,
} from "./voiceCalibration";
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
import {
  createProactiveEngine,
  EventQueueWatcher,
  shaWatcher,
  withDailyOfferGate,
} from "./proactive";
import { loadAvatarSettings, saveAvatarSettings } from "./settings";
import {
  createSettingsSync,
  settingsSyncLabel,
  type SettingsSync,
  type SettingsSyncStatus,
} from "./settingsSync";
import { lookupKnowledge } from "./knowledgeBase";
import { parseSpaceNavigationCommand } from "./spaceNavigation";
import { SpaceView } from "./SpaceView";
import { coreStatusLabel, type CoreStatus } from "./coreLink";
import { fetchCoreFacts, getCoreLink } from "./coreLinkClient";

type Settings = RenderSettings & { sensitivity: number; cooldownMs: number };
type WorldScreen = "space" | "entering" | "live" | "returning";
/**
 * How near a press must land to the construct's center to be a
 * press ON HIM — shared by his own press handlers and by the
 * environment builder's capture pass, which yields to him in edit
 * mode (owner order 2026-11-22).
 */
const FIGURE_GRAB_RADIUS_PX = 175;

const DEFAULTS: Settings = {
  maxParticles: 120000,
  bloom: 0.25,
  glitch: 0.4,
  theme: "cyan",
  customColor: "#22d3ee",
  sensitivity: 0.8,
  cooldownMs: 800,
};

const WORLD_SCENE_ICONS: Record<WorldSceneId, LucideIcon> = {
  room: LayoutGrid,
  office: Building2,
  beach: Waves,
  desert: Sun,
  park: TreePine,
  coffee: Coffee,
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
  // The exact options the brain was attached with, kept so the brain
  // address setting can re-attach the same brain at a new address.
  const aiOptsRef = useRef<OllamaAIOptions | null>(null);
  const [brainDraft, setBrainDraft] = useState(() => loadBrainAddress());
  const [brainMsg, setBrainMsg] = useState("");
  function applyBrain(raw: string) {
    const url = saveBrainAddress(raw);
    if (!url) {
      setBrainMsg("That address doesn't look right — try 192.168.1.50 or your Tailscale address.");
      return;
    }
    setBrainDraft(url);
    const opts = aiOptsRef.current;
    if (opts && aiRef.current) {
      aiRef.current.dispose();
      const ai = attachOllamaAI(bridgeRef.current, { ...opts, baseUrl: url });
      aiRef.current = ai;
      ai.setMuted(silentRef.current);
    }
    setBrainMsg(`Brain set to ${url} — remembered on this device.`);
  }
  const earRef = useRef<LocalEar | null>(null);
  const [silent, setSilent] = useState(loadSilentModePreference);
  const memoryRef = useRef<ReturnType<typeof createLocalMemory> | null>(null);
  memoryRef.current ??= createLocalMemory();
  const silentRef = useRef(silent);
  const lastQuestionRef = useRef("");
  const micFlashTimer = useRef<number | null>(null);
  // SETTINGS THAT STICK: one store, every knob, saved on every change —
  // and, while signed in, synced to the operator's account so the same
  // configuration is waiting on his other devices (settingsSync.ts).
  const [settings, setSettings] = useState<Settings>(() => loadAvatarSettings());
  const syncRef = useRef<SettingsSync | null>(null);
  const [syncStatus, setSyncStatus] = useState<SettingsSyncStatus>("connecting");
  const persistSettings = useCallback((next: Settings) => {
    settingsRef.current = next;
    setSettings(next);
    saveAvatarSettings(next);
    syncRef.current?.notifyLocalChange(next);
  }, []);
  const settingsRef = useRef(settings);
  const [state, setState] = useState<AvatarState>("IDLE");
  const [level, setLevel] = useState(0);
  const [perf, setPerf] = useState({ fps: 0, particles: 0 });
  const [sensor, setSensor] = useState<SensorStatus | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  // THE EAR'S REAL CONDITION (owner eye-check 2026-11-23): the
  // STATUS readout derives from this, never from the bridge's
  // resting state alone — mic off must read MIC OFF everywhere.
  const [earState, setEarState] = useState<EarState>("idle");
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  // VOICE CALIBRATION: while ON, the ear checks every spoken phrase
  // against the operator's voiceprint before it may run (localEar
  // gate). Typed commands are never gated. Default OFF — he enrolls
  // and turns it on himself in Settings.
  const [voiceCalPrefs, setVoiceCalPrefs] = useState<VoiceCalibrationPrefs>(() =>
    loadVoiceCalibrationPrefs(),
  );
  const voiceCalPrefsRef = useRef(voiceCalPrefs);
  const applyVoiceGate = useCallback(() => {
    const ear = earRef.current;
    if (!ear) return;
    if (voiceCalPrefsRef.current.enabled) {
      ear.setVoiceVerifier(createVoiceGateVerifier(() => voiceCalPrefsRef.current.threshold));
    } else {
      ear.setVoiceVerifier(null);
    }
  }, []);
  const changeVoiceCalPrefs = useCallback(
    (next: VoiceCalibrationPrefs) => {
      voiceCalPrefsRef.current = next;
      setVoiceCalPrefs(next);
      saveVoiceCalibrationPrefs(next);
      applyVoiceGate();
    },
    [applyVoiceGate],
  );
  useEffect(() => {
    applyVoiceGate();
  }, [applyVoiceGate, voiceCalPrefs]);
  // THE GODS' VOICE LEVEL (owner order 2026-11-22): his speech
  // volume, full by default — he could not hear the gods on his
  // phone at full phone volume. The level is his, set in Settings
  // beside the calibration, and read by the voice provider at every
  // line (speechVoice.ts).
  const [speechVolume, setSpeechVolume] = useState<number>(() => loadSpeechVolume());
  const changeSpeechVolume = useCallback((next: number) => {
    setSpeechVolume(next);
    saveSpeechVolume(next);
  }, []);
  const [ready, setReady] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [chat, setChat] = useState("");
  const [lastWords, setLastWords] = useState("No response yet.");
  // THE QUIET ACTIVITY LINE (owner eye-check 2026-11-23): idle
  // musings surface HERE — a small status line outside the
  // conversation — and nowhere else. They never enter the thread,
  // never wear the reply's clothes, and are never spoken as if
  // they answered something he said.
  const [activityLine, setActivityLine] = useState<string | null>(null);
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
  // Movable windows — the operator opens these himself, by command or tap.
  // Augie's idle life never opens them (owner order 2026-11-21).
  const [openWindows, setOpenWindows] = useState<Set<"notepad" | "chalkboard" | "player">>(
    new Set(),
  );
  const [chalkboardText, setChalkboardText] = useState<string | null>(null);
  const [playerSeed, setPlayerSeed] = useState<string | null>(null);
  // His world: the office walk-in and the battle box.
  const [officeOpen, setOfficeOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [cloudKeysOpen, setCloudKeysOpen] = useState(false);
  // CONNECTIONS PANEL: the universal API/data slots (owner order 2026-11-22).
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [worldScreen, setWorldScreen] = useState<WorldScreen>("space");
  const worldScreenRef = useRef<WorldScreen>("space");
  const worldTransitionTimer = useRef<number | null>(null);
  // CORE LINK (Part 30): the status is earned by a real round trip to
  // the core's memory store — CONNECTED only when the store answered,
  // QUEUED while exchanges wait in the outbox, NOT CONFIGURED when no
  // core store answers. The old Supabase REST ping could never succeed
  // with the publishable key and read NOT CONFIGURED forever; it is gone.
  const [coreStatus, setCoreStatus] = useState<CoreStatus>("not-configured");
  // ON-PHONE BRAIN (owner order 2026-11-22): the HUD line beside the
  // core status — earned from WebLLM's cache check on this device,
  // refreshed when Settings downloads or deletes a model.
  const [phoneBrainState, setPhoneBrainState] = useState<PhoneBrainStatus | null>(null);
  useEffect(() => {
    let active = true;
    void getPhoneBrainStatus().then((status) => {
      if (active) setPhoneBrainState(status);
    });
    return () => {
      active = false;
    };
  }, []);
  const responseSourceRef = useRef("awaiting response");
  const navigate = useNavigate();
  // REPLY HISTORY: every line Augie speaks is logged (persisted on this
  // device) so the operator can scroll back through his replies — the
  // stage used to show only the single latest one.
  const [transcript, setTranscript] = useState<ReplyHistoryEntry[]>(() => loadReplyHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  // AR CUBE WINDOW: the cube in a small floating box on this screen (his
  // standing UI rule — tools in contained boxes, not full-screen takeovers).
  // The full room at /avatar/cube stays for the spoken "open the cube".
  const [arCubeOpen, setArCubeOpen] = useState(false);
  // THE CONSTRUCT IN HIS OWN BOX (owner order 2026-11-22): the sand
  // construct no longer holds center stage — he stands in a floating
  // container window, and the renderer's canvas docks into that
  // window's body. CLOSED ON ENTRY (owner order 2026-11-22 ~19:53
  // EST, superseding the same day's open-by-default fix): "the AGI
  // screen that pops up — don't let it pop up on the beginning of
  // coming in the screen. If I open it, I open it. It takes the
  // background away from the actual main screen until I close the
  // AUGI." The stage opens to the room and the resident face;
  // AUGI's box opens only when he opens it ("open AUGI avatar",
  // the Scene tab seat). The state is not persisted, so a fresh
  // entry starts closed even if he left it open last session.
  const [constructOpen, setConstructOpen] = useState(false);
  const [constructDock, setConstructDock] = useState<HTMLElement | null>(null);
  // THE ENVIRONMENT BUILDER (owner order 2026-11-22): the Captain's
  // designed Room — layouts saved as he goes, the active room fed to
  // the renderer, pieces placed/moved/anchored from the panel and
  // by dragging on the stage itself. The stage frames that are not
  // self-managed (the HUD clusters, the construct controls) carry
  // their offsets beside it; the medallions run their own anchor
  // system, like the command box.
  const [builderOpen, setBuilderOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  // THE BUILT WORLD (owner order 2026-11-23): the map of his own
  // built world, where the stage view stands over it, the
  // ground-laying hand, and where the selected piece's control
  // cluster sits on screen.
  const [builtWorldMapOpen, setBuiltWorldMapOpen] = useState(false);
  const [worldPan, setWorldPan] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const worldPanRef = useRef(worldPan);
  worldPanRef.current = worldPan;
  const [layGroundArmed, setLayGroundArmed] = useState(false);
  const layGroundArmedRef = useRef(layGroundArmed);
  layGroundArmedRef.current = layGroundArmed;
  const [selectionPoint, setSelectionPoint] = useState<{ x: number; y: number } | null>(null);
  const [layoutStore, setLayoutStore] = useState<LayoutStore>(() => loadLayoutStore());
  const layoutStoreRef = useRef(layoutStore);
  layoutStoreRef.current = layoutStore;
  const [builderSelection, setBuilderSelection] = useState<string | null>(null);
  const builderIdCounter = useRef(0);
  const stageRootRef = useRef<HTMLDivElement>(null);
  const [frameStore, setFrameStore] = useState<FrameStore>(() => loadFrameStore());
  const frameStoreRef = useRef(frameStore);
  frameStoreRef.current = frameStore;
  const [framesArmed, setFramesArmed] = useState(false);
  const framesArmedRef = useRef(framesArmed);
  framesArmedRef.current = framesArmed;
  const [snapGuides, setSnapGuides] = useState<SnapGuides | null>(null);
  // ON STAGE BY ORDER (owner order 2026-11-22): a position order —
  // "bring Augie in", "step aside" — stands him on the stage itself
  // in the live Room, outside his box, until his box closes the
  // standing arrangement back down (closeConstruct clears this).
  const [constructOnStage, setConstructOnStage] = useState(false);
  const stageDockRef = useRef<HTMLDivElement>(null);
  // DOCKING: the renderer's host element is moved — not recreated —
  // between its home slot on the stage and the construct window's
  // body. The WebGL canvas is a child of the host, so it travels
  // with its context intact; the renderer's ResizeObserver watches
  // the host and refits it to whichever home it is in. When the
  // window minimizes or closes, its body unmounts, the dock ref
  // clears, and the host comes home to the stage.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const target = constructDock ?? stageDockRef.current;
    if (target && el.parentElement !== target) target.appendChild(el);
  }, [constructDock]);
  // STAGE PERSPECTIVE (owner order 2026-11-22): whose presence holds
  // the stage's focus. The default is ANUBIS — the resident
  // commander; a station takes the focus when he turns to it, and
  // the perspective returns to Anubis when it closes.
  const [perspective, setPerspective] = useState<StagePerspective>(DEFAULT_STAGE_PERSPECTIVE);
  // THE ADDRESSEE — A ROUTING STATE (owner order 2026-11-23;
  // rules in addressee.ts): who the Captain is talking to. Anubis
  // by default; naming a god in address switches the conversation
  // to him until another is addressed. THREE readers, one state:
  // the reply prompt carries it per message (speakerDirective),
  // the thread's speaker label renders it, and the reply pop-up
  // rises on the addressed god's face — so the label and the words
  // can never disagree again (the 2026-11-23 screenshots: a reply
  // labeled ANUBIS whose words denied being Anubis).
  const [addressee, setAddressee] = useState<Addressee>(DEFAULT_ADDRESSEE);
  const addresseeRef = useRef<Addressee>(DEFAULT_ADDRESSEE);
  const applyAddressee = useCallback((next: Addressee) => {
    addresseeRef.current = next;
    setAddressee(next);
  }, []);
  // PRESENCE DOCTRINE (owner order 2026-11-22; rules in
  // presenceDoctrine.ts): Anubis is resident — alone on the stage by
  // default. The Black Hatter is PUT AWAY until the Owner seat
  // brings him back. Every other god is on the stage only while
  // summoned for a conversation, popped in for a report, or bowing
  // out under dismissal.
  const [ownerPresent, setOwnerPresent] = useState(false);
  const [summonedGods, setSummonedGods] = useState<GodPerspective[]>([]);
  const [reportGod, setReportGod] = useState<GodPerspective | null>(null);
  const [bowingGod, setBowingGod] = useState<GodPerspective | null>(null);
  const reportGodTimer = useRef<number | null>(null);
  const residency: StageResidency = {
    ownerPresent,
    summoned: summonedGods,
    reportGod,
    bowingGod,
  };
  // Live mirrors for the command path, which outlives any single
  // render's closure (the file's standing ref pattern).
  const residencyRef = useRef(residency);
  residencyRef.current = residency;
  const perspectiveRef = useRef(perspective);
  perspectiveRef.current = perspective;
  // A god answers a summon: he comes onto the stage and stays for
  // the conversation. Under the no-overlap law he takes a clear
  // spot — if the spot he was left at would overlap someone already
  // standing, a clear spot is written for him BEFORE he mounts, so
  // he never appears on top of another face.
  const summonGod = useCallback((god: GodPerspective) => {
    if (god !== "anubis") {
      const stageW = typeof window === "undefined" ? 0 : window.innerWidth;
      const stageH = typeof window === "undefined" ? 0 : window.innerHeight;
      if (stageW > 0 && stageH > 0) {
        const others = [loadOrDefaultMedallionGeometry("anubis", stageW, stageH)];
        if (ownerPresent) others.push(loadOrDefaultMedallionGeometry("black-hatter", stageW, stageH));
        const standing = loadOrDefaultMedallionGeometry(god, stageW, stageH);
        const spot = clearMedallionSpot(standing, others, stageW, stageH);
        if (spot.x !== standing.x || spot.y !== standing.y || spot.size !== standing.size) {
          saveMedallionGeometry(god, spot);
        }
      }
    }
    setSummonedGods((current) => (current.includes(god) ? current : [...current, god]));
  }, [ownerPresent]);
  /**
   * THE COUNCIL SEAT (owner order 2026-11-22 ~20:09 EST): a god
   * called into a conversation with Anubis comes up RIGHT NEXT TO
   * ANUBIS, SMALL — beside the commander, never replacing him, and
   * Anubis is never moved to make room: the called god's own seat
   * is what gets written, at the flank of Anubis's standing
   * geometry. His hand can re-place the god afterwards like any
   * medallion; the next council call seats him beside Anubis
   * again, because that is what a council call means.
   */
  const seatBesideAnubis = useCallback((god: GodPerspective) => {
    if (god === "anubis") return;
    const stageW = typeof window === "undefined" ? 0 : window.innerWidth;
    const stageH = typeof window === "undefined" ? 0 : window.innerHeight;
    if (stageW <= 0 || stageH <= 0) return;
    const anubis = loadOrDefaultMedallionGeometry("anubis", stageW, stageH);
    const standing = loadOrDefaultMedallionGeometry(god, stageW, stageH);
    const others: ReturnType<typeof loadOrDefaultMedallionGeometry>[] = [];
    if (ownerPresent) others.push(loadOrDefaultMedallionGeometry("black-hatter", stageW, stageH));
    const seat = besideMedallionGeometry(anubis, standing.size, stageW, stageH, others);
    if (seat.x !== standing.x || seat.y !== standing.y) {
      saveMedallionGeometry(god, seat);
    }
  }, [ownerPresent]);
  // CONVERSATION VIEWS (owner order 2026-11-22): speaking with ONE
  // god is a CALL — his Black Hatter and the god, side by side.
  // Tapping a SECOND god while one holds the perspective raises a
  // COUNCIL — the gods present at the smaller factor. Tapping the
  // Black Hatter, or opening the construct, ends the council and
  // returns the stage to its standing arrangement. The views are
  // presentation only: his anchored placements and sizes hold.
  const [council, setCouncil] = useState<StagePerspective[]>([]);
  const conversationView = conversationViewFor(perspective, council);
  const selectGod = useCallback(
    (god: GodPerspective) => {
      // Turning to a god turns the CONVERSATION to him too
      // (routing law): his name tapped is his name addressed.
      applyAddressee(god);
      // Residency first: a non-resident god tapped by name is
      // SUMMONED onto the stage; returning to Anubis puts the
      // Black Hatter away again — the resident holds the stage.
      if (god === "anubis") setOwnerPresent(false);
      else summonGod(god);
      if (council.length >= 2) {
        // Already in council: tapping a god takes the call to him alone.
        setCouncil([]);
        setPerspective(god);
        return;
      }
      if (isGodPerspective(perspective) && perspective !== god) {
        // A second god joins the one addressed: a council. The
        // joining god takes the council seat — right beside
        // Anubis, small (owner order 2026-11-22 ~20:09 EST). When
        // the joining god IS Anubis, the god already standing is
        // the one who takes the seat beside him.
        seatBesideAnubis(god === "anubis" ? perspective : god);
        setCouncil([perspective, god]);
        setPerspective(god);
        return;
      }
      setPerspective(god);
    },
    [perspective, council, summonGod, seatBesideAnubis, applyAddressee],
  );
  const selectOwner = useCallback(() => {
    // The Owner seat brings the Black Hatter BACK onto the stage
    // from put-away — at his saved placement, with the perspective.
    setOwnerPresent(true);
    setCouncil([]);
    setPerspective("black-hatter");
  }, []);
  const selectGodRef = useRef(selectGod);
  selectGodRef.current = selectGod;
  // PULSE WINDOW: presence + motion, the rPPG heart-rate estimate and
  // the room-frequency readout in a small floating box (operator order
  // 2026-11-21). Opens from Tools → Rooms and from "open pulse".
  const [pulseOpen, setPulseOpen] = useState(false);
  // SOUND WATCH WINDOW: the room's ear — environmental sound events,
  // distance estimates, and the Captain's learned sound library
  // (owner order 2026-11-23). Shares the microphone with the voice
  // ear by taking turns; never runs a second capture against it.
  const [soundWatchOpen, setSoundWatchOpen] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  // GATE LOG WINDOW: every recorded knock on the gate (trap-path
  // probes), read server-side under the operator session (operator
  // order 2026-11-21 — "Honeypot city"). Opens from Tools → Rooms and
  // from "open gate log" / "honeypot".
  const [gateLogOpen, setGateLogOpen] = useState(false);
  const [signalMapOpen, setSignalMapOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [testAreaOpen, setTestAreaOpen] = useState(false);
  const [anatomyOpen, setAnatomyOpen] = useState(false);
  const [departmentsOpen, setDepartmentsOpen] = useState(false);
  const [captainsLogOpen, setCaptainsLogOpen] = useState(false);
  // SANDBOX WINDOW: the attack-simulation + antivirus-design bench —
  // modeled attacks stepped stage by stage, each stage naming the
  // countermeasure that hooks it (operator order 2026-11-21).
  // Simulation only; opens from Tools → Rooms and "open sandbox".
  const [sandboxOpen, setSandboxOpen] = useState(false);
  // LIBRARY WINDOW: the offline Kiwix books on Domenick's shelves —
  // searched and read through the local library proxy, no internet
  // (Knowledge Phase 2, operator order 2026-11-21). Opens from
  // Tools → Rooms and from "open the library".
  const [libraryOpen, setLibraryOpen] = useState(false);
  // DEVICES WINDOW: the device-understanding sector — every connected
  // device gets a capability card (what it can do, what is unknown,
  // what was measured), from the BLE profiler or a manual probe entry
  // (operator order 2026-11-21). Opens from Tools → Rooms and from
  // "open devices".
  const [devicesOpen, setDevicesOpen] = useState(false);
  // CAMERAS WINDOW (operator order 2026-11-23): his own cameras on
  // his own network — both lenses live, PTZ under his grant. Opens
  // from Tools → Senses & analysis.
  const [camerasOpen, setCamerasOpen] = useState(false);
  // LISTENING MODE WINDOW (Part 12): the armed silent ear's control
  // surface. Opens from Tools → Rooms and from "open listening mode".
  const [listeningOpen, setListeningOpen] = useState(false);
  // LISTENING INDICATOR: while the speech service reports a session
  // armed, a badge stays visible on the stage — recording state is
  // never covert, even with the window closed. Polled from the
  // service's own status endpoint, not local state.
  const [listeningArmed, setListeningArmed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/listening/status");
        if (!response.ok) return;
        const payload = (await response.json()) as { armed?: unknown };
        if (!cancelled) setListeningArmed(payload.armed === true);
      } catch {
        /* service unreachable: the badge stays as last known; the
           window itself reports the outage in words. */
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  // LAW DESK + OFFICE ANALYTICS WINDOWS (learner-build line's Parts
  // 11/10 faces): their own windows beside this line's Library-law door
  // and Departments window. Open from Tools → Rooms and by phrase.
  const [lawOpen, setLawOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  // HIS OWN LAST MESSAGE: echoed in the Command box above Augie's reply
  // (operator defect 2026-11-21 — the box showed only the reply, so he
  // could not see the messages he sent, typed or spoken).
  const [lastUserMessage, setLastUserMessage] = useState("");
  // THE BLACK HATTER SPEAKS HIS TYPED WORDS (owner order 2026-11-22):
  // while this is true, the owner's medallion carries the talking
  // mouth for the line he just typed. Voice input never sets it —
  // on the mic, the Captain is speaking himself.
  const [hatterSpeaking, setHatterSpeaking] = useState(false);
  const hatterSpeechTimer = useRef<number | null>(null);
  // SPEAKING PROTOCOL (owner order 2026-11-22): how his last line
  // arrived decides who the speaker of record is — TYPED lines are
  // the Black Hatter speaking (his character delivers them, and the
  // god follows the command); MIC lines are the operator himself,
  // and no presence speaks or echoes for him.
  const [lastUserSource, setLastUserSource] = useState<"typed" | "voice">("typed");
  const lastUserSourceRef = useRef<"typed" | "voice">("typed");
  // REPORTS AS NOTIFICATIONS (owner order 2026-11-22): completions
  // surface on the stage as notifications, gated by his standing
  // notification rules (notificationPrefs.ts) at raise time.
  const [notifications, setNotifications] = useState<StageNotification[]>([]);
  const notificationIdRef = useRef(0);
  // A GOD POPS UP TO REPORT (owner order 2026-11-22): a report also
  // brings its god to the stage — his face pops up at a clear edge
  // with the anime bubble beside his head, he speaks the line, and
  // he goes. One at a time: a newer report steps up in his place.
  // The notification card stays as the record; the pop-up is the
  // god himself delivering it.
  const [godPopUp, setGodPopUp] = useState<GodPopUpRequest | null>(null);
  const dismissGodPopUp = useCallback((id: number) => {
    setGodPopUp((current) => (current && current.id === id ? null : current));
  }, []);
  const notify = useCallback((topic: string, text: string, god?: GodPerspective) => {
    if (!shouldNotify(loadNotificationPrefs(), topic, Date.now())) return;
    notificationIdRef.current += 1;
    const id = notificationIdRef.current;
    setNotifications((current) => [
      ...current.slice(-3),
      { id, topic, text, at: Date.now(), ...(god ? { god } : {}) },
    ]);
    // The reporting god delivers the line himself in the bubble: an
    // explicitly attributed god wins; otherwise the topic decides
    // (Montu for defense and security, Anubis in command for the rest).
    setGodPopUp({ id, god: god ?? godForReportTopic(topic), text });
    window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== id));
    }, 14_000);
    // REPORT POP-IN (presence doctrine): a report attributed to a
    // non-resident god brings HIM onto the stage with it — portrait
    // up like the message itself — and he goes away on his own when
    // the report's life ends, unless the Captain has since summoned
    // him to stay. Anubis is resident; his reports need no pop-in.
    if (god && god !== "anubis") {
      setReportGod(god);
      if (reportGodTimer.current !== null) window.clearTimeout(reportGodTimer.current);
      reportGodTimer.current = window.setTimeout(() => {
        reportGodTimer.current = null;
        setReportGod((current) => (current === god ? null : current));
      }, 14_000);
    }
  }, []);
  const dismissNotification = useCallback((id: number) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);
  /**
   * THE RESPONSE MODEL (owner order 2026-11-22 ~20:02 EST): "the
   * way that he popped up to chat, that's the way I want my AI to
   * respond to me. Not do the chat box. I'll send the commands to
   * the chat, it'll show me a chat window and talk to me."
   *
   * So a REPLY is delivered by Anubis himself: when a line of his
   * starts SPEAKING, he pops up — face at a clear edge, the cream
   * bubble beside his head typing the line, his mouth moving with
   * it (GodReportPopUp) — and when the line is done he goes, and
   * the stage settles back to the room and the resident face. The
   * chat box is where the Captain SENDS and where the conversation
   * can be read while it is live; the record waits behind the
   * History button. The pop-up keys on the speaking STATE and the
   * line itself — the same signals the medallion's mouth reads —
   * never on the voice pipeline's internals.
   *
   * Not every line pops: microphone status lines are the room
   * talking to itself, and idle-life musings keep to voice and
   * text (his reports already pop through notify()). One pop per
   * distinct line: the same words spoken twice in a row are one
   * delivery.
   */
  const lastResponsePopRef = useRef("");
  useEffect(() => {
    if (worldScreen !== "live" || clearScreen) return;
    if (state !== "SPEAKING") return;
    if (!lastWords || lastWords === "No response yet.") return;
    if (
      responseSource === "microphone" ||
      responseSource === "awaiting response" ||
      responseSource === "idle life"
    ) {
      return;
    }
    if (lastResponsePopRef.current === lastWords) return;
    // OSIRIS'S PLACE (routing law): the core speaks from the chat
    // window — his lines never borrow a god's face for a pop-up.
    if (addressee === "osiris") return;
    lastResponsePopRef.current = lastWords;
    notificationIdRef.current += 1;
    // The reply is delivered by the ADDRESSED god's face (routing
    // law): Montu's words rise on Montu, Anubis's on Anubis.
    setGodPopUp({
      id: notificationIdRef.current,
      god: addressee === "montu" ? "montu" : "anubis",
      text: lastWords,
    });
  }, [state, lastWords, responseSource, worldScreen, clearScreen, addressee]);
  const recordReply = useCallback((text: string) => {
    setTranscript((prev) =>
      appendReplyHistory(prev, {
        at: Date.now(),
        question: lastQuestionRef.current,
        answer: text,
        source: lastUserSourceRef.current,
        // The speaker of record (routing law): the addressee at
        // this reply's moment — the same state the reply prompt
        // carried — so the log's label is the name that spoke.
        speaker: ADDRESSEE_NAMES[addresseeRef.current],
      }),
    );
    // Every exchange also goes to the CORE's durable memory (Part 30):
    // written now, or queued on this surface and synced when the core
    // answers again. Fire-and-forget — a memory write never blocks a reply.
    const question = lastQuestionRef.current;
    if (question) {
      void getCoreLink()
        .record({
          exchangeId: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          question,
          answer: text,
          provider: responseSourceRef.current,
          surface: "stage",
          queuedAt: new Date().toISOString(),
        })
        .catch(() => undefined);
    }
  }, []);
  const displayName = import.meta.env["VITE_AVATAR_NAME"] || "Osiris";
  // Wake-word response falls back to the owner's call sign when the
  // verified operator name is not configured (handled inline below).
  const themeAccent = getThemeAccent(settings.theme, settings.customColor);

  const say = useCallback((text: string) => {
    setResponseSource("local command");
    aiRef.current?.speak(text);
  }, []);

  // THE LIVING WORLD (owner order 2026-11-21): five scenes grown from
  // the particle code itself — office, beach, desert, park, coffee
  // shop. One state setter serves the Scene tab buttons and the spoken
  // phrases alike; Augie stays himself in every one of them.
  const [worldScene, setWorldScene] = useState<WorldSceneId>(DEFAULT_WORLD_SCENE);
  const applyWorldScene = useCallback((id: WorldSceneId) => {
    rendRef.current?.setWorldScene(id);
    setWorldScene(id);
  }, []);
  // STAGE BACKDROP (owner order 2026-11-22): a saved, switchable
  // choice in his layout. "world" is the living particle world;
  // "desert-photo" is his own photograph (desert with pyramids)
  // dropped in at its registered path — until the file lands, the
  // stage falls back to the world (backdropArtReady flips false on
  // a failed load and the layer simply never covers anything).
  const [backdrop, setBackdrop] = useState<StageBackdropId>(loadStageBackdrop);
  const [backdropArtReady, setBackdropArtReady] = useState(true);
  const applyBackdrop = useCallback((id: StageBackdropId) => {
    setBackdrop(id);
    saveStageBackdrop(id);
    setBackdropArtReady(true);
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

  // THE CONSTRUCT'S BOX (owner order 2026-11-22): opening him puts
  // the sand construct in his own container and brings him into
  // perspective; closing the box takes him off the stage and returns
  // the perspective to the Black Hatter — the default.
  const openConstruct = useCallback(() => {
    setConstructOpen(true);
    setCouncil([]);
    setPerspective("construct");
  }, []);
  const closeConstruct = useCallback(() => {
    setConstructOpen(false);
    setConstructDock(null);
    setConstructOnStage(false);
    setCouncil([]);
    setPerspective(perspectiveAfterClose());
  }, []);

  // He stands on the stage outside the live Room (the space view
  // keeps him), when he has been brought on, inside his box while
  // it is open and docked — and WHILE THE CAPTAIN IS EDITING
  // (owner order 2026-11-22): with the Environment Builder open he
  // stands IN the environment being edited, present and workable
  // there — moved, positioned, adjusted under the same anchor law
  // and the same saved spot as in his own sandbox — never exiled
  // to the sandbox only. In the live Room with none of those true,
  // the stage belongs to the resident commander and he is off
  // stage. The rule itself lives in presenceDoctrine.ts.
  useEffect(() => {
    rendRef.current?.setConstructVisible(
      constructStandsOnStage({
        worldScreen,
        constructOnStage,
        builderOpen,
        constructOpen,
        constructDocked: constructDock !== null,
      }),
    );
  }, [worldScreen, constructOpen, constructDock, constructOnStage, builderOpen]);

  // ONE VOICE AT A TIME: when Anubis starts answering, the Black
  // Hatter's line is done — his mouth stills and Anubis's medallion
  // carries the speech.
  useEffect(() => {
    if (state !== "SPEAKING") return;
    setHatterSpeaking(false);
    if (hatterSpeechTimer.current !== null) {
      window.clearTimeout(hatterSpeechTimer.current);
      hatterSpeechTimer.current = null;
    }
  }, [state]);

  /* --------------------- the environment builder --------------------- */

  // Save-as-you-go + the renderer always holds the active room.
  useEffect(() => {
    saveLayoutStore(layoutStore);
    rendRef.current?.setBuilderRoom(activeLayout(layoutStore).room);
  }, [layoutStore]);

  useEffect(() => {
    rendRef.current?.setBuilderSelected(builderSelection);
  }, [builderSelection]);

  useEffect(() => {
    saveFrameStore(frameStore);
  }, [frameStore]);

  const updateRoom = useCallback((next: RoomContent) => {
    setLayoutStore((store) => withLayoutRoom(store, store.activeId, next));
  }, []);

  const newBuilderItemId = useCallback(() => {
    builderIdCounter.current += 1;
    return `piece-${Date.now().toString(36)}-${builderIdCounter.current}`;
  }, []);

  const placeFromLibrary = useCallback(
    (baseId: string, at?: { x: number; z: number }) => {
      const base = libraryItem(baseId);
      if (!base) return;
      const current = activeLayout(layoutStoreRef.current).room;
      let spot = at;
      if (!spot) {
        // The next free floor spot, scanned front-to-back — pieces
        // never land on top of each other from a panel click.
        const taken = (x: number, z: number) =>
          current.items.some((item) => Math.hypot(item.x - x, item.z - z) < 1.7);
        outer: for (const z of [-1, -4, -7, 1.5, -2.5, -5.5]) {
          for (let x = -9; x <= 9; x += 3) {
            if (!taken(x, z)) {
              spot = { x, z };
              break outer;
            }
          }
        }
        spot ??= { x: 0, z: -1 };
      }
      const item = makePlacedItem(newBuilderItemId(), baseId, defaultVariant(base), spot.x, spot.z);
      const placed = addItem(current, item);
      // A piece dropped on dark ground claims its plot and covers
      // it (owner order 2026-11-23) — nothing he builds floats on
      // the void. Home plots are the room's own ground already.
      const landed = placed.items.find((entry) => entry.id === item.id);
      updateRoom(landed ? claimPlot(placed, plotAtPoint(landed.x, landed.z)) : placed);
      setBuilderSelection(item.id);
    },
    [newBuilderItemId, updateRoom],
  );

  /* ------------------- travelling the built world ------------------- */

  // Stand the stage view over a point of the built world; the
  // renderer clamps to the world's edge and the state mirrors its
  // ruling, so the panel and the map read the true view center.
  const panWorldTo = useCallback((x: number, z: number) => {
    const renderer = rendRef.current;
    if (!renderer) return;
    renderer.setWorldPan(x, z);
    setWorldPan(renderer.getWorldPan());
  }, []);

  // Who stands in the built world, for its map: the gods at the
  // command seat on the home plot (where their medallions stand),
  // and AUGI at his true floor spot, read from the renderer.
  const getWorldInhabitants = useCallback((): WorldInhabitant[] => {
    const souls: WorldInhabitant[] = [];
    if (worldScreenRef.current === "live") {
      souls.push({ id: "anubis", name: "Anubis", x: 0, z: -3, kind: "god" });
      if (godOnStage(residencyRef.current, "montu"))
        souls.push({ id: "montu", name: "Montu", x: -2.6, z: -3, kind: "god" });
      if (residencyRef.current.ownerPresent)
        souls.push({ id: "black-hatter", name: "Black Hatter", x: 2.6, z: -3, kind: "god" });
    }
    const renderer = rendRef.current;
    if (renderer?.constructVisible) {
      const spot = renderer.figureWorldPosition();
      souls.push({ id: "augi", name: "AUGI", x: spot.x, z: spot.z, kind: "construct" });
    }
    return souls;
  }, []);

  // Dragging pieces on the stage itself: capture-phase on the stage
  // root, so a press that lands on a placed piece is the builder's
  // before the figure's own press handlers ever see it. Only while
  // the builder is open and the Room is on stage.
  useEffect(() => {
    const root = stageRootRef.current;
    if (!root || !builderOpen || worldScene !== "room") return;
    let drag: { id: string; dx: number; dz: number } | null = null;
    // A press on empty ground is either a click (clears the pick)
    // or a travel drag (pans the world view) — decided by how far
    // the hand actually moves (owner order 2026-11-23: drag the
    // ground to go somewhere else in the world and build there).
    let groundPress: { startX: number; startY: number; panX: number; panZ: number; moved: boolean } | null =
      null;
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!(event.target as HTMLElement | null)?.closest?.("canvas")) return;
      const renderer = rendRef.current;
      if (!renderer) return;
      // THE CONSTRUCT FIRST (owner order 2026-11-22): in edit mode
      // he stands in this environment to be worked on — a press
      // that lands on HIM is his, even over a placed piece behind
      // him, so the builder never locks him out of his own stage.
      // His own press handlers (drag when unanchored, the keys when
      // anchored) take it from here; the builder simply steps aside.
      if (renderer.constructVisible) {
        const point = renderer.figureScreenPoint();
        const hostEl = host.current;
        if (point && hostEl) {
          const rect = hostEl.getBoundingClientRect();
          if (
            Math.hypot(event.clientX - rect.left - point.x, event.clientY - rect.top - point.y) <=
            FIGURE_GRAB_RADIUS_PX
          ) {
            return;
          }
        }
      }
      const id = renderer.builderPick(event.clientX, event.clientY);
      if (!id) {
        // LAYING GROUND (owner order 2026-11-23): with the
        // ground-laying hand armed, a tap on the world floor
        // covers that plot — or takes the cover back up. Home
        // plots are the room's own ground and never toggle.
        if (layGroundArmedRef.current) {
          const floor = renderer.builderFloorPoint(event.clientX, event.clientY);
          if (floor) {
            const plot = plotAtPoint(floor.x, floor.z);
            const current = activeLayout(layoutStoreRef.current).room;
            if (current.plots.some((entry) => entry.x === plot.x && entry.z === plot.z)) {
              updateRoom(unclaimPlot(current, plot));
            } else if (!plotClaimed(current, plot)) {
              updateRoom(claimPlot(current, plot));
            }
          }
          return;
        }
        const pan = renderer.getWorldPan();
        groundPress = {
          startX: event.clientX,
          startY: event.clientY,
          panX: pan.x,
          panZ: pan.z,
          moved: false,
        };
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      setBuilderSelection(id);
      const item = activeLayout(layoutStoreRef.current).room.items.find((entry) => entry.id === id);
      if (!item || item.anchored) return; // selected — but the anchor law holds it fast
      const floor = renderer.builderFloorPoint(event.clientX, event.clientY);
      drag = { id, dx: floor ? item.x - floor.x : 0, dz: floor ? item.z - floor.z : 0 };
    };
    const onMove = (event: PointerEvent) => {
      const renderer = rendRef.current;
      if (!renderer) return;
      if (groundPress) {
        const dx = event.clientX - groundPress.startX;
        const dy = event.clientY - groundPress.startY;
        if (Math.hypot(dx, dy) > 4) groundPress.moved = true;
        if (groundPress.moved) {
          // The ground follows the hand: drag right, the view
          // travels west; drag down, it travels north.
          const perPixel = renderer.worldUnitsPerPixel();
          panWorldTo(groundPress.panX - dx * perPixel, groundPress.panZ - dy * perPixel * 1.6);
        }
        return;
      }
      if (!drag) return;
      const floor = renderer.builderFloorPoint(event.clientX, event.clientY);
      if (!floor) return;
      const current = activeLayout(layoutStoreRef.current).room;
      updateRoom(moveItem(current, drag.id, floor.x + drag.dx, floor.z + drag.dz));
    };
    const onUp = () => {
      if (groundPress && !groundPress.moved) setBuilderSelection(null);
      groundPress = null;
      if (drag) {
        // A piece set down on dark ground claims its plot.
        const current = activeLayout(layoutStoreRef.current).room;
        const landed = current.items.find((entry) => entry.id === drag!.id);
        if (landed) updateRoom(claimPlot(current, plotAtPoint(landed.x, landed.z)));
      }
      drag = null;
    };
    root.addEventListener("pointerdown", onDown, true);
    root.addEventListener("pointermove", onMove, true);
    root.addEventListener("pointerup", onUp, true);
    root.addEventListener("pointercancel", onUp, true);
    return () => {
      root.removeEventListener("pointerdown", onDown, true);
      root.removeEventListener("pointermove", onMove, true);
      root.removeEventListener("pointerup", onUp, true);
      root.removeEventListener("pointercancel", onUp, true);
    };
  }, [builderOpen, worldScene, updateRoom, panWorldTo]);

  // TRAVEL BY KEY (owner order 2026-11-23): the arrow keys move
  // the view one plot at a time while the builder is open — hold
  // to travel. Never while he is typing somewhere.
  useEffect(() => {
    if (!builderOpen || worldScene !== "room") return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      )
        return;
      const step = 11; // one plot
      const pan = worldPanRef.current;
      if (event.key === "ArrowLeft") panWorldTo(pan.x - step, pan.z);
      else if (event.key === "ArrowRight") panWorldTo(pan.x + step, pan.z);
      else if (event.key === "ArrowUp") panWorldTo(pan.x, pan.z - step);
      else if (event.key === "ArrowDown") panWorldTo(pan.x, pan.z + step);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [builderOpen, worldScene, panWorldTo]);

  // THE SELECTED PIECE'S CONTROL CLUSTER (owner order 2026-11-23):
  // while a piece is picked, track where it stands on screen so
  // its controls can sit beside it — move, turn, delete, done,
  // right at the piece, no hunting through the panel.
  useEffect(() => {
    if (!builderOpen || !builderSelection) {
      setSelectionPoint(null);
      return;
    }
    const track = () => {
      const renderer = rendRef.current;
      const root = stageRootRef.current;
      if (!renderer || !root) return;
      const point = renderer.builderItemScreenPoint(builderSelection);
      if (!point) {
        setSelectionPoint(null);
        return;
      }
      const w = root.clientWidth || 1;
      const h = root.clientHeight || 1;
      setSelectionPoint({
        x: Math.min(Math.max(point.x, 110), Math.max(110, w - 110)),
        y: Math.min(Math.max(point.y, 70), Math.max(70, h - 40)),
      });
    };
    track();
    const timer = window.setInterval(track, 120);
    return () => window.clearInterval(timer);
  }, [builderOpen, builderSelection]);

  const builderLayoutOps = useMemo(
    () => ({
      onSwitchLayout: (id: string) => {
        setLayoutStore((store) => ({ ...store, activeId: id }));
        setBuilderSelection(null);
      },
      onNewLayout: () => {
        const id = `layout-${Date.now().toString(36)}`;
        setLayoutStore((store) => ({
          activeId: id,
          layouts: [
            ...store.layouts,
            { id, name: `Room ${store.layouts.length + 1}`, room: emptyRoom() },
          ],
        }));
        setBuilderSelection(null);
      },
      onRenameLayout: (id: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setLayoutStore((store) => ({
          ...store,
          layouts: store.layouts.map((layout) =>
            layout.id === id ? { ...layout, name: trimmed } : layout,
          ),
        }));
      },
      onDeleteLayout: (id: string) => {
        setLayoutStore((store) => {
          if (store.layouts.length <= 1) return store;
          const layouts = store.layouts.filter((layout) => layout.id !== id);
          return {
            layouts,
            activeId: store.activeId === id ? layouts[0]!.id : store.activeId,
          };
        });
        setBuilderSelection(null);
      },
      onResetDefaultLayout: () => {
        setLayoutStore((store) => withLayoutRoom(store, store.activeId, emptyRoom()));
        setBuilderSelection(null);
      },
      onExport: () => exportRoomPackage(activeLayout(layoutStoreRef.current)),
      onImport: (text: string) => {
        const parsed = parseRoomPackage(text);
        if (!parsed.ok) return parsed.error;
        const id = `layout-${Date.now().toString(36)}`;
        setLayoutStore((store) => ({
          activeId: id,
          layouts: [...store.layouts, { id, name: parsed.name, room: parsed.room }],
        }));
        setBuilderSelection(null);
        return `Brought in as the layout “${parsed.name}”.`;
      },
    }),
    [],
  );

  /* ------------------------- the stage frames ------------------------- */

  const frameEls = useRef<Partial<Record<FrameId, HTMLElement | null>>>({});
  const frameDrag = useRef<{
    id: FrameId;
    startX: number;
    startY: number;
    baseDx: number;
    baseDy: number;
    home: { x: number; y: number };
    size: { w: number; h: number };
    others: FrameRect[];
  } | null>(null);

  const frameStyle = useCallback(
    (id: FrameId): CSSProperties => {
      const offset = frameOffset(frameStore, id);
      return offset.dx === 0 && offset.dy === 0
        ? {}
        : { translate: `${offset.dx}px ${offset.dy}px` };
    },
    [frameStore],
  );

  const framePointerDown =
    (id: FrameId, self = false) =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!framesArmedRef.current) return;
      if (event.button !== 0) return;
      const target = self
        ? event.currentTarget
        : (event.currentTarget.firstElementChild as HTMLElement | null);
      const rect = target?.getBoundingClientRect();
      if (!rect) return;
      const base = frameOffset(frameStoreRef.current, id);
      const others: FrameRect[] = [];
      for (const [otherId, el] of Object.entries(frameEls.current)) {
        if (otherId === id || !el) continue;
        const otherRect = el.getBoundingClientRect();
        if (otherRect.width > 0) others.push({ x: otherRect.left, y: otherRect.top, w: otherRect.width, h: otherRect.height });
      }
      frameDrag.current = {
        id,
        startX: event.clientX,
        startY: event.clientY,
        baseDx: base.dx,
        baseDy: base.dy,
        home: { x: rect.left - base.dx, y: rect.top - base.dy },
        size: { w: rect.width, h: rect.height },
        others,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };

  const framePointerMove =
    (id: FrameId) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = frameDrag.current;
      if (!drag || drag.id !== id) return;
      const dx = drag.baseDx + (event.clientX - drag.startX);
      const dy = drag.baseDy + (event.clientY - drag.startY);
      // Snap the would-be top-left (Alt moves free), then read the
      // offset back out of the snapped spot.
      const snapped = snapFramePosition(
        { x: drag.home.x + dx, y: drag.home.y + dy },
        drag.size,
        { w: window.innerWidth, h: window.innerHeight },
        drag.others,
        { enabled: !event.altKey },
      );
      setSnapGuides(snapped.guides);
      setFrameStore((store) =>
        withFrameOffset(store, id, {
          dx: Math.round(snapped.x - drag.home.x),
          dy: Math.round(snapped.y - drag.home.y),
          anchored: true,
        }),
      );
    };

  const framePointerUp = () => {
    frameDrag.current = null;
    setSnapGuides(null);
  };

  /**
   * Drag wiring for one stage frame. `self` frames (the HUD divs)
   * carry the props on the frame element itself; wrapped frames
   * (the medallions, the construct controls) carry them on a plain
   * static wrapper — the frame inside keeps its own absolute
   * placement against the stage, and the wrapper only listens.
   */
  const frameDragProps = (id: FrameId, self = false) => ({
    ref: (el: HTMLDivElement | null) => {
      frameEls.current[id] = self
        ? el
        : ((el?.firstElementChild as HTMLElement | null) ?? null);
    },
    onPointerDown: framePointerDown(id, self),
    onPointerMove: framePointerMove(id),
    onPointerUp: framePointerUp,
    onPointerCancel: framePointerUp,
  });

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

  /**
   * BACK TO THE CHAT (owner order 2026-11-22): the chat lives on
   * the live screen. Tapping the chat strip on another screen flies
   * him back to it — from space, the fly-in; mid-return, the flight
   * turns around; mid-entry, he is already coming.
   */
  const returnToChat = useCallback(() => {
    if (worldScreenRef.current === "space") {
      enterLiveMode();
    } else if (worldScreenRef.current === "returning") {
      transitionWorldScreen("entering");
    }
  }, [enterLiveMode, transitionWorldScreen]);

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
          // COME BACK = FACE ME — on ARRIVAL, by locomotion's rule.
          // (Calling faceOperator() here cancelled the journey: its
          // faceForward() cleared the returning flag mid-trip, so he
          // froze off-mark while claiming to return. Defect 2026-11-21.)
          renderer.alertAttention();
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

  // CONSTRUCT POSITION ORDERS (owner orders 2026-11-22): the typed
  // and spoken forms — "bring Augie in", "move to the left side",
  // "move right", "step aside" — and the toolbar's buttons run
  // these same moves. HE WALKS THEM: the travel rides the
  // locomotion walker along the floor — gait playing, feet on the
  // floor line, his size set by where he stands — never the old
  // screen-plane float of his anchor, which read as a zoom and a
  // slide (owner verdict 2026-11-22: "kind of weird"). While he
  // travels, his anchor's height settles back to the floor line;
  // on arrival the travelled distance folds into the anchor, the
  // landing persists like every drag (saveFigureOffset), and he
  // takes his facing: profile toward the middle when aside, the
  // Captain himself when brought in.
  const constructWalkRef = useRef<number | null>(null);
  // Assigned in the anchor/drag section below: releases the
  // Captain's WASD drive, so a position order hands AUGI back to
  // himself before he walks it (the order rules, as the float did).
  const releaseDriveRef = useRef<() => void>(() => {});
  const cancelConstructWalk = useCallback(() => {
    if (constructWalkRef.current !== null) {
      window.cancelAnimationFrame(constructWalkRef.current);
      constructWalkRef.current = null;
    }
    rendRef.current?.cancelFigureWalk();
  }, []);
  const settleConstructOnStage = useCallback(() => {
    // Off the box, onto the stage, anchored and free at the landing.
    setConstructOpen(false);
    setConstructDock(null);
    setConstructOnStage(true);
    setCouncil([]);
    setPerspective("construct");
    setConstructAnchored(true);
    saveConstructAnchored(true);
    rendRef.current?.setConstructAnchored(true);
  }, []);
  const walkConstructTo = useCallback(
    (
      targetRoot: { x: number; z: number },
      opts: { fullSizeOnArrive: boolean; onLanded: () => void },
    ) => {
      const renderer = rendRef.current;
      if (!renderer) return;
      releaseDriveRef.current();
      cancelConstructWalk();
      const startedAt = performance.now();
      let last = startedAt;
      // The floor settle: while the walk runs, ease the anchor's
      // height back to the floor line. The watcher ends itself when
      // the walk does — arrived (the landing runs through
      // locomotion's own hand-back) or taken over by a newer order
      // (no landing side effects at all, like a wander cut short).
      const settle = (now: number) => {
        const r = rendRef.current;
        if (!r || !r.isFigureWalking || now - startedAt > 30_000) {
          constructWalkRef.current = null;
          return;
        }
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        last = now;
        const current = r.figureOffset;
        if (Math.abs(current.y) > 0.005) {
          r.setFigureOffset(current.x, current.y * Math.exp(-2.4 * dt));
        }
        constructWalkRef.current = window.requestAnimationFrame(settle);
      };
      const started = renderer.walkFigureTo(targetRoot, {
        fullSizeOnArrive: opts.fullSizeOnArrive,
        onArrive: () => {
          if (constructWalkRef.current !== null) {
            window.cancelAnimationFrame(constructWalkRef.current);
            constructWalkRef.current = null;
          }
          opts.onLanded();
        },
      });
      if (started) {
        constructWalkRef.current = window.requestAnimationFrame(settle);
      } else {
        opts.onLanded();
      }
    },
    [cancelConstructWalk],
  );
  const bringConstructIn = useCallback(() => {
    settleConstructOnStage();
    const renderer = rendRef.current;
    if (!renderer) return;
    // He walks home to his mark from wherever he stands and arrives
    // WHOLE — full size, facing the Captain (the come-back rule).
    // The landing folds into the anchor as home itself, and the
    // saved spot is cleared: home is the mark, not a placement.
    const anchor = renderer.figureOffset;
    walkConstructTo(
      { x: -anchor.x, z: 0 },
      {
        fullSizeOnArrive: true,
        onLanded: () => {
          const r = rendRef.current;
          if (!r) return;
          r.rebaseFigureAnchor();
          const landed = r.figureOffset;
          r.setFigureOffset(landed.x, 0);
          clearFigureOffset();
          r.faceOperator();
        },
      },
    );
  }, [settleConstructOnStage, walkConstructTo]);
  const walkConstructAside = useCallback(
    (side: "left" | "right") => {
      const renderer = rendRef.current;
      const hostEl = host.current;
      if (!renderer || !hostEl) return;
      settleConstructOnStage();
      const point = renderer.figureScreenPoint();
      if (!point) return;
      const rect = hostEl.getBoundingClientRect();
      const targetPx = side === "left" ? rect.width * 0.13 : rect.width * 0.87;
      const scale = renderer.worldUnitsPerPixel();
      const root = renderer.figureRootPosition();
      // The target in root space: his root plus the world distance
      // between where he stands on screen and the side's mark. The
      // anchor does not move while he walks — his legs cover it.
      walkConstructTo(
        { x: root.x + (targetPx - point.x) * scale, z: root.z },
        {
          fullSizeOnArrive: false,
          onLanded: () => {
            const r = rendRef.current;
            if (!r) return;
            const landed = r.rebaseFigureAnchor();
            r.setFigureOffset(landed.x, 0);
            saveFigureOffset(r.figureOffset);
            r.faceSide(side);
          },
        },
      );
    },
    [settleConstructOnStage, walkConstructTo],
  );
  // DISMISSAL (presence doctrine, owner order 2026-11-22): the
  // Captain's word sends a summoned god off — and the god SHOWS
  // HIS ALLEGIANCE on the way out: the bow, with the blessing
  // spoken, holds for a breath, and then he is gone back to his
  // work. The resident is never dismissed; a report pop-in is
  // never dismissed (it leaves on its own).
  const bowTimerRef = useRef<number | null>(null);
  const dismissGod = useCallback(
    (god: GodPerspective) => {
      const name = god === "montu" ? MONTU_BINDING.name : ANUBIS_BINDING.name;
      // A dismissed god leaves the conversation too (routing law):
      // the address falls back to the resident commander.
      if (addresseeRef.current === god) applyAddressee(DEFAULT_ADDRESSEE);
      setBowingGod(god);
      say(closeWithBlessing(`As you command, Captain — ${name} bows and returns to his work`));
      if (bowTimerRef.current !== null) window.clearTimeout(bowTimerRef.current);
      bowTimerRef.current = window.setTimeout(() => {
        bowTimerRef.current = null;
        setBowingGod((current) => (current === god ? null : current));
        setSummonedGods((current) => current.filter((entry) => entry !== god));
        setReportGod((current) => (current === god ? null : current));
        setCouncil((current) => current.filter((entry) => entry !== god));
        setPerspective((current) => (current === god ? DEFAULT_STAGE_PERSPECTIVE : current));
      }, 1600);
    },
    [say, applyAddressee],
  );

  function togglePresent() {
    const b = bridgeRef.current;
    b.present(b.presenting ? null : "file");
  }
  const sendCommand = useCallback(
    async (text: string, source: "typed" | "voice" = "typed") => {
      // Echo first: whatever he sent — typed or spoken — stays visible
      // in the Command box above the reply, even for commands that
      // return early (rooms, /help, wake greeting).
      setLastUserMessage(text.trim());
      setLastUserSource(source);
      lastUserSourceRef.current = source;
      // His typed words are spoken by his own medallion: the Black
      // Hatter's mouth moves for the length of the line. The mic
      // path (source "voice") is the Captain himself — the Hatter
      // stays silent, per his protocol.
      if (source === "typed") {
        if (hatterSpeechTimer.current !== null) window.clearTimeout(hatterSpeechTimer.current);
        setHatterSpeaking(true);
        hatterSpeechTimer.current = window.setTimeout(() => {
          setHatterSpeaking(false);
          hatterSpeechTimer.current = null;
        }, speakingMsForText(text));
      }
      // ROUTING (owner order 2026-11-23; rules in addressee.ts):
      // an explicit address — a god named at the head of the line,
      // typed or spoken — turns the conversation to that god BEFORE
      // anything answers, so the prompt, the label, and the pop-up
      // all read the new addressee for this very message. A stage
      // god not yet up is pulled up (the pop-in doctrine) through
      // the same seat a tap takes. Osiris is addressed in place:
      // his seat is the chat window, and nothing on the stage moves
      // for him. A passing mention never routes (detectAddressee is
      // conservative by design).
      const addressedGod = detectAddressee(text);
      if (addressedGod && addressedGod !== addresseeRef.current) {
        applyAddressee(addressedGod);
        if (
          addressedGod === "montu" &&
          perspectiveRef.current !== "montu" &&
          !residencyRef.current.summoned.includes("montu")
        ) {
          selectGodRef.current("montu");
        }
      }
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
      // THE BUILDER AND THE MAP, BY NAME (owner order 2026-11-22).
      if (/^(open|show|start)?\s*(the\s+)?(environment\s+)?builder$/i.test(commandText.trim())) {
        setBuilderOpen(true);
        say("The Environment Builder is open, Captain. Design the Room your way.");
        return;
      }
      if (
        /^(open|show)?\s*(the\s+)?(my|built)\s+world(\s+map)?$/i.test(commandText.trim()) ||
        /^(open|show)\s+my\s+world$/i.test(commandText.trim())
      ) {
        setBuiltWorldMapOpen(true);
        say("Your built world, Captain — every plot and piece, and where everyone stands.");
        return;
      }
      if (/^(open|show)?\s*(the\s+)?(world\s+)?map$/i.test(commandText.trim())) {
        setMapOpen(true);
        say("The world map is up. Name a place and I will show it.");
        return;
      }
      commandText = commandText.replace(/^\/+/, "").trim();
      // NOTIFICATION CONTROL BY HIS WORD (owner order 2026-11-22):
      // "hold notifications for X hours", "don't tell me about
      // that, tell me about this" — the standing rules change here
      // and every report honors them from this point on.
      const noteInstruction = parseNotificationInstruction(commandText);
      if (noteInstruction) {
        saveNotificationPrefs(
          applyNotificationInstruction(loadNotificationPrefs(), noteInstruction, Date.now()),
        );
        setResponseSource("notification preferences");
        say(describeNotificationInstruction(noteInstruction));
        return;
      }
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
      // CONNECTIONS: the universal API/data slots area (owner order
      // 2026-11-22) — open slots he fills himself, values server-side.
      if (
        commandText === "/connections" ||
        /open\s+(?:the\s+)?connections?/i.test(commandText) ||
        /open\s+(?:the\s+)?api\s+slots?/i.test(commandText)
      ) {
        setConnectionsOpen(true);
        say("Connections is open, Captain — the slots for APIs and data. Fill one and it works; an empty slot just waits.");
        return;
      }
      // ROOMS — deterministic and TERMINAL (operator incident
      // 2026-11-21): "open the cube" used to fall through to the LLM
      // chat and earn a refusal. parseRoomCommand is the single decider
      // for every room phrase — the AR Cube, Picture Analysis (the
      // analytic window), the Legend of Logic game room (actually play
      // it, not a walkthrough), the Reply history window, and the
      // Metatron "My Cube" panel under its own distinct triggers.
      // Typed or spoken; a match returns here and never reaches chat.
      const room = parseRoomCommand(commandText);
      if (room === "ar-cube") {
        void navigate({ to: "/avatar/cube" });
        return;
      }
      if (room === "picture-analysis") {
        // Part 27: the analytic WINDOW is the primary face now; the
        // /avatar/analyze page remains as the secondary full page.
        setAnalyzeOpen(true);
        say(
          "Picture Analysis is open in its window — scan the room or pick a picture, and the findings land beside the picture.",
        );
        return;
      }
      if (room === "game") {
        void navigate({ to: "/avatar/game" });
        return;
      }
      if (room === "world") {
        void navigate({ to: "/avatar/world" });
        return;
      }
      if (room === "reply-history") {
        setHistoryOpen(true);
        say("Reply history is open — everything I have said, newest first.");
        return;
      }
      if (room === "pulse") {
        setPulseOpen(true);
        say(
          "Pulse is open — presence, a heart-rate estimate, and the room's frequencies, all read on this machine. Nothing is recorded.",
        );
        return;
      }
      if (room === "gate-log") {
        setGateLogOpen(true);
        say("Gate log is open — every recorded knock on the gate, newest first.");
        return;
      }
      if (room === "signal-map") {
        setSignalMapOpen(true);
        say("Signal map is open — what the core's scanners report, registered and unknown.");
        return;
      }
      if (room === "captains-log") {
        setCaptainsLogOpen(true);
        say("Captain's log is open — record when ready; entries stay on this machine.");
        return;
      }
      if (room === "departments") {
        setDepartmentsOpen(true);
        say("Departments are open — real status where a feed exists, and an honest unavailable where none is connected.");
        return;
      }
      if (room === "anatomy") {
        setAnatomyOpen(true);
        say("Anatomy is open — the map of my systems, their live state, and your saved configuration versions.");
        return;
      }
      if (room === "test-area") {
        setTestAreaOpen(true);
        say("Test area is open — every ability has a real probe, and the ledger only claims what a run proved.");
        return;
      }
      if (room === "logs") {
        setLogsOpen(true);
        say("Logs are open — the service journal, update state, and the updater's own record.");
        return;
      }
      if (room === "sandbox") {
        setSandboxOpen(true);
        say(
          "Sandbox is open — pick an attack, step it stage by stage, and watch where the antivirus hooks it. Simulation only; nothing real runs there.",
        );
        return;
      }
      if (room === "library") {
        setLibraryOpen(true);
        say(
          "Library is open — your shelves, read from the books on this machine. No internet involved.",
        );
        return;
      }
      if (room === "listening") {
        setListeningOpen(true);
        say(
          "Listening Mode is open — arm it there and I record silently on this machine until you say Osiris. The indicator stays visible the whole time.",
        );
        return;
      }
      if (room === "law-desk") {
        setLawOpen(true);
        say(
          "Law Desk is open — law answers from the books on this machine, cited. Knowledge, not a licensed attorney.",
        );
        return;
      }
      if (room === "office-analytics") {
        setAnalyticsOpen(true);
        say(
          "Office Analytics is open — every department's real status, or an honest unavailable where no source exists.",
        );
        return;
      }
      if (room === "devices") {
        setDevicesOpen(true);
        say(
          "Devices is open — every device I have met, what it can do, and what is still unknown. Profile a Bluetooth device there and I will learn what it is.",
        );
        return;
      }
      if (room === "my-cube") {
        setCubeOpen(true);
        aiRef.current?.speak("Operator verification is required to open the cube.");
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
      // LIVING WORLD SCENES — deterministic and terminal, like the
      // rooms: "take me to the beach" reshapes the world around him
      // and never falls through to chat. (The office walk-in above
      // keeps "go to the office" — parseSceneCommand returns null for
      // it on purpose; the office SCENE answers to "office scene".)
      const sceneTarget = parseSceneCommand(commandText);
      if (sceneTarget) {
        applyWorldScene(sceneTarget);
        say(sceneLine(sceneTarget));
        return;
      }
      // OFFICE FLOORS (owner order 2026-11-21): "next floor", "go
      // through the portal", "floor down" — he walks the aisles to the
      // portal and steps through; the landing announces itself via
      // onFloorChange. Only inside the living office — elsewhere the
      // words fall through to the rest of the command chain untouched.
      const floorMove = parseFloorCommand(commandText);
      if (floorMove && worldScene === "office") {
        if (rendRef.current?.goThroughPortal(floorMove)) {
          say(
            floorMove === "up"
              ? "Walking to the gold portal — next floor up."
              : "Walking to the blue portal — one floor down.",
          );
        } else {
          say(
            floorMove === "up"
              ? "No portal up from this floor — this is the top."
              : "No portal down from this floor — this is the ground floor.",
          );
        }
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
      // THE CONSTRUCT'S OWN BOX (owner order 2026-11-22): "open AUGI
      // avatar" stands the sand construct in his own container —
      // bloodshot red eyes, so the Captain can see him — and brings
      // him into perspective. Closing the box takes him off stage.
      const avatarRequest = commandText.toLowerCase().replace(/\s+/g, " ").trim();
      if (
        /^(?:open\s+)?(?:the\s+)?(?:augi\s+)?avatar$/i.test(avatarRequest) ||
        avatarRequest === "/avatar"
      ) {
        openConstruct();
        say(
          "AUGI is up — the sand construct in his own box, red eyes on him so you can see him. The stage stays yours, Captain.",
        );
        return;
      }
      if (/^close\s+(?:the\s+)?(?:augi\s+)?avatar$/i.test(avatarRequest)) {
        closeConstruct();
        say("His box is closed. The stage is back to you, Captain.");
        return;
      }
      // CONSTRUCT POSITION ORDERS (owner order 2026-11-22): "bring
      // Augie in" stands him on the stage facing the Captain; "move
      // to the left side" / "move right" / "step aside" floats him
      // to that side in profile, out of the way, so the whole
      // screen reads clear. The landing persists like a drag.
      if (
        /^(?:bring|call)\s+(?:augi|augie|osiris)\s+in$/i.test(avatarRequest) ||
        avatarRequest === "come in augi" ||
        avatarRequest === "augi come in"
      ) {
        bringConstructIn();
        say("AUGI is in, Captain — on the stage, facing you.");
        return;
      }
      const asideMatch = avatarRequest.match(
        /^(?:move\s+(?:augi\s+)?(?:to\s+)?(?:the\s+)?|step\s+aside\s*(?:to\s+)?(?:the\s+)?|augi\s+(?:move\s+)?(?:to\s+)?(?:the\s+)?)(left|right)(?:\s+side)?$/,
      );
      if (asideMatch?.[1] || avatarRequest === "step aside") {
        const side = asideMatch?.[1] === "right" ? "right" : "left";
        walkConstructAside(side);
        say(`AUGI steps to the ${side}, Captain — side-on and out of your way.`);
        return;
      }
      // SUMMON A GOD BY NAME (presence doctrine, owner order
      // 2026-11-22): his name — typed here or spoken through the
      // same command path — calls him onto the stage, where he
      // stays for the conversation.
      const summonedGod = summonTarget(avatarRequest);
      if (summonedGod) {
        selectGodRef.current(summonedGod);
        say(
          summonedGod === "montu"
            ? "Montu answers your call, Captain — commander of the army, on the stage and at your command."
            : "He answers your call, Captain.",
        );
        return;
      }
      // DISMISSAL (presence doctrine): the Captain's word — "good
      // work", "you can leave", "that'll be all" — sends the
      // summoned god off with his allegiance shown. With nobody
      // summoned to send, the line is ordinary conversation and
      // falls through untouched.
      if (isDismissal(avatarRequest)) {
        const addressed = isGodPerspective(perspectiveRef.current)
          ? perspectiveRef.current
          : null;
        const target = dismissalTarget(residencyRef.current, addressed);
        if (target) {
          dismissGod(target);
          return;
        }
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
      // (The Metatron "My Cube" panel is routed with the rooms above —
      // parseRoomCommand owns its triggers now.)
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
    [enterLiveMode, executeWorldCommand, navigate, operatorName, returnToSpace, say],
  );

  useEffect(() => {
    const bridge = bridgeRef.current;
    const r = new AvatarRenderer(host.current!, bridge, { ...settingsRef.current });
    rendRef.current = r;
    // AUGI'S SAVED SPOT AND ANCHOR (owner orders 2026-11-22): if he
    // was dragged somewhere last session, he is standing there when
    // the stage opens — the drag persists like every other setting
    // of his — and his anchor state (free, or held for fixing) is
    // the one the Captain left him in.
    const savedSpot = loadFigureOffset();
    if (savedSpot) r.setFigureOffset(savedSpot.x, savedSpot.y);
    r.setConstructAnchored(loadConstructAnchored());
    // FULL-BODY HOLD (owner order 2026-11-22): if the Captain left
    // the hold thrown, AUGI opens at full body and stays there.
    r.setFullBodyHold(loadFullBodyHold());
    // THE BUILDER'S ROOM (owner order 2026-11-22): his saved design
    // stands in the Room from the first frame.
    r.setBuilderRoom(activeLayout(layoutStoreRef.current).room);
    // CENTER STAGE (owner order 2026-11-22): in the live Room the
    // construct starts OFF stage — the Black Hatter holds center —
    // until the Captain opens the AUGI avatar box. (The space view
    // keeps him; the visibility effect below owns the rule from
    // here on.)
    r.setConstructVisible(worldScreenRef.current !== "live");
    r.onFrame = (p) => {
      setPerf(p);
      setReady(true);
    };
    // HEARTBEAT PRESENCE (follow-up order 2026-11-21): Augie's
    // heartbeat — one beat per breath cycle of the body — paces the
    // Wi-Fi presence check while he is awake on stage, replacing the
    // 15-minute timer as the primary cadence. Every 8th beat (≈42 s)
    // a check runs through the same honest pipeline as the Devices
    // window's button: an unavailable scan records nothing and is
    // noted once per state change; a real sighting flips the wand in
    // the registry and Augie speaks the greeting himself.
    // OFFICE PORTALS (owner order 2026-11-21): when a portal carries
    // him to another floor, he announces the floor he landed on.
    r.onFloorChange = (transition) => {
      say(transition.line);
    };
    const heartbeatPacer = createHeartbeatCheckPacer();
    r.onHeartbeat = () => {
      if (!heartbeatPacer.beat(Date.now())) return;
      void (async () => {
        const scan = await scanWifiEnvironment();
        if (!scan.available) {
          notePresenceCheck(scan, "heartbeat", false);
          return;
        }
        const before = loadRegistry();
        const { devices: next, activated } = runPresenceCheck(before, scan, scan.at);
        notePresenceCheck(scan, "heartbeat", JSON.stringify(next) !== JSON.stringify(before));
        for (const _device of activated) say(WAND_GREETING);
      })();
    };
    const aiOpts: OllamaAIOptions = {
      baseUrl: loadBrainAddress(),
      operatorName,
      operatorFullName,
      system: `${DEFAULT_SYSTEM_PROMPT}${CORE_LAW_PROMPT}
${PERSONALITY_PROMPT}
${commandKnowledgeSection}${commandToolsPrompt}${operatorMemory.asPrompt()}`,
      // The speaker directive, read fresh per message from the
      // routing state (routing law): this reply speaks as the
      // addressee, under his name — the same name the thread label
      // shows for it.
      getSpeakerDirective: () => speakerDirective(addresseeRef.current),
      onSpeak: (text) => {
        setLastWords(text);
        recordReply(text);
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
      // ON-PHONE BRAIN (owner order 2026-11-22): the latched-offline
      // door to the small brain inside this device. (In the unlatched
      // path the same leg is tried inside askCloud, below Ollama and
      // above simulated.) When it answers, its provider name —
      // "On-phone brain (small)" — is what the reply is labeled with.
      onPhoneFallback: async (text) => {
        // The small brain gets the same routing (routing law):
        // it speaks as the addressed presence, under the same name.
        const answer = await askPhoneBrain(text, [], addresseeRef.current);
        return answer ? { answer, provider: PHONE_BRAIN_PROVIDER } : null;
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
    };
    const ai = attachOllamaAI(bridge, aiOpts);
    aiOptsRef.current = aiOpts;
    aiRef.current = ai;
    ai.setMuted(silentRef.current);
    // LOCAL EAR — offline speech-to-text on this machine (faster-whisper
    // via /api/transcribe). The browser's SpeechRecognition is gone: on
    // Linux Chromium it secretly depends on Google's cloud service, died
    // the instant it was clicked, and said nothing about why. The local
    // ear is push-to-talk: click the mic, it listens until a phrase is
    // captured or he clicks again, and every failure lands in the Command
    // box in plain words. Transcripts feed the same sendCommand voice
    // path as before, so wake word, silent mode and room routing behave
    // exactly as they do for typed input.
    const ear = createLocalEar({
      onTranscript: (text) => {
        if (text) void sendCommand(text, "voice");
      },
      // VOICE CALIBRATION GATE: a spoken phrase that is not his voice —
      // or whose check could not run — never becomes a command. The
      // lock line is spoken like any other reply, so it also lands in
      // the reply history with the attempt noted beside it.
      onVoiceRejected: (rejection) => {
        setVoiceListening(false);
        if (rejection.reason === "mismatch") {
          lastQuestionRef.current = "Voice command — not the operator's voice";
          say("That is not my operator's voice — voice commands stay locked.");
        } else {
          lastQuestionRef.current = "Voice command — the voice check could not run";
          say(
            "I could not check that voice — the speech service did not answer, so voice commands stay locked.",
          );
        }
      },
      onError: (message) => {
        setVoiceListening(false);
        setResponseSource("microphone");
        setLastWords(message);
      },
      onState: (nextEarState) => {
        setEarState(nextEarState);
        setVoiceListening(nextEarState === "starting" || nextEarState === "listening");
        if (nextEarState === "listening") {
          setResponseSource("microphone");
          setLastWords("Listening — speak now. Click the mic again to stop.");
        } else if (nextEarState === "transcribing") {
          setResponseSource("microphone");
          setLastWords("Transcribing what you said…");
        }
      },
    });
    earRef.current = ear;
    setEarState(ear.currentState);
    applyVoiceGate();
    setVoiceAvailable(ear.supported);
    bridge.setState("LISTENING");
    // Proactive watch: he tells ME — suggests, never auto-acts.
    // THREAD PURITY (owner eye-check 2026-11-23): a proactive
    // report is NOT a reply, so it never travels the reply channel
    // (ai.speak → onSpeak → the conversation thread, where reports
    // landed as "answers" to whatever he last typed). Reports
    // surface as stage notifications with their god's pop-up — the
    // report channel idle reports already use (notify). And the
    // Sha offer is day-gated: it surfaces once a day at most, never
    // again on every page load.
    const proactive = createProactiveEngine(
      [
        eventQueueRef.current,
        withDailyOfferGate(shaWatcher(shaShownRef.current), "augi.proactive.sha-offer-day.v1"),
      ],
      (line) => notify("proactive", line),
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
      earRef.current?.dispose();
      aiRef.current?.dispose();
      sensRef.current?.stop();
      r.dispose();
    };
  }, [sendCommand, operatorFullName, operatorName, say, applyVoiceGate]);

  // AUGI — ANCHOR, DRAG, AND THE CAPTAIN'S KEYS (owner orders
  // 2026-11-22): the construct's three ways of being on the stage.
  // ANCHORED he is set in and FREE — he roams and works. UNANCHORED
  // the Captain has lifted him out to FIX something — he holds, and
  // a press-and-pull drags him to his new spot (saved on release,
  // standing there next session; double-press sends him home).
  // A plain CLICK on him while anchored takes control: WASD drives
  // him, SPACEBAR is his action; click again or Escape hands him
  // back. The state is stated on the stage at all times
  // (ConstructControls) so the two never fight over the figure.
  const [osirisDragging, setOsirisDragging] = useState(false);
  const [constructAnchored, setConstructAnchored] = useState(loadConstructAnchored);
  const [captainDriving, setCaptainDriving] = useState(false);
  const anchoredRef = useRef(constructAnchored);
  anchoredRef.current = constructAnchored;
  const drivingRef = useRef(captainDriving);
  drivingRef.current = captainDriving;
  // The position orders (defined above) release the Captain's drive
  // through this ref before AUGI walks an order out.
  releaseDriveRef.current = () => {
    if (!drivingRef.current) return;
    setCaptainDriving(false);
    rendRef.current?.setCaptainDriving(false);
  };

  const applyAnchor = useCallback((next: boolean) => {
    setConstructAnchored(next);
    saveConstructAnchored(next);
    rendRef.current?.setConstructAnchored(next);
    if (!next) {
      setCaptainDriving(false);
      rendRef.current?.setCaptainDriving(false);
    }
  }, []);
  const toggleAnchor = useCallback(() => {
    applyAnchor(!anchoredRef.current);
  }, [applyAnchor]);
  const toggleControl = useCallback(() => {
    if (!anchoredRef.current) return;
    const next = !drivingRef.current;
    setCaptainDriving(next);
    rendRef.current?.setCaptainDriving(next);
  }, []);
  // FULL-BODY HOLD (owner order 2026-11-22, live defect fix): full
  // body is a state he holds, not a load flash. The toggle grows him
  // whole and keeps him there — across reloads too — until released.
  const [fullBodyHold, setFullBodyHold] = useState(loadFullBodyHold);
  const bodyHoldRef = useRef(fullBodyHold);
  bodyHoldRef.current = fullBodyHold;
  const toggleBodyHold = useCallback(() => {
    const next = !bodyHoldRef.current;
    setFullBodyHold(next);
    saveFullBodyHold(next);
    rendRef.current?.setFullBodyHold(next);
    say(
      next
        ? "AUGI is at full body, Captain, and he will hold it there."
        : "AUGI is back to companion size.",
    );
  }, [say]);
  const resetOsirisHome = useCallback(() => {
    rendRef.current?.resetFigureOffset();
    clearFigureOffset();
    // Home is his set-in spot: sending him home anchors him there, free.
    applyAnchor(true);
  }, [applyAnchor]);
  useEffect(() => {
    const hostEl = host.current;
    if (!hostEl) return;
    const GRAB_RADIUS_PX = FIGURE_GRAB_RADIUS_PX;
    let press: {
      pointerId: number;
      startX: number;
      startY: number;
      lastX: number;
      lastY: number;
      at: number;
      moved: boolean;
    } | null = null;
    const nearFigure = (clientX: number, clientY: number) => {
      const renderer = rendRef.current;
      if (!renderer) return false;
      const point = renderer.figureScreenPoint();
      if (!point) return false;
      const rect = hostEl.getBoundingClientRect();
      return (
        Math.hypot(clientX - rect.left - point.x, clientY - rect.top - point.y) <= GRAB_RADIUS_PX
      );
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!nearFigure(e.clientX, e.clientY)) return;
      press = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        at: Date.now(),
        moved: false,
      };
      hostEl.setPointerCapture(e.pointerId);
      if (!anchoredRef.current) setOsirisDragging(true);
    };
    const onMove = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.pointerId) return;
      if (Math.hypot(e.clientX - press.startX, e.clientY - press.startY) > 7) press.moved = true;
      if (anchoredRef.current) return; // anchored: a press is a click, never a drag
      const renderer = rendRef.current;
      if (!renderer) return;
      const scale = renderer.worldUnitsPerPixel();
      const current = renderer.figureOffset;
      renderer.setFigureOffset(
        current.x + (e.clientX - press.lastX) * scale,
        current.y - (e.clientY - press.lastY) * scale,
      );
      press.lastX = e.clientX;
      press.lastY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.pointerId) return;
      const wasPress = press;
      press = null;
      if (!anchoredRef.current) {
        setOsirisDragging(false);
        const renderer = rendRef.current;
        if (renderer) saveFigureOffset(renderer.figureOffset);
        return;
      }
      // A plain click on AUGI while he is anchored: take the keys —
      // or hand them back, if the Captain already has them.
      if (!wasPress.moved && Date.now() - wasPress.at < 600) toggleControl();
    };
    const onDblClick = (e: MouseEvent) => {
      if (!nearFigure(e.clientX, e.clientY)) return;
      resetOsirisHome();
    };
    hostEl.addEventListener("pointerdown", onDown);
    hostEl.addEventListener("pointermove", onMove);
    hostEl.addEventListener("pointerup", onUp);
    hostEl.addEventListener("pointercancel", onUp);
    hostEl.addEventListener("dblclick", onDblClick);
    return () => {
      hostEl.removeEventListener("pointerdown", onDown);
      hostEl.removeEventListener("pointermove", onMove);
      hostEl.removeEventListener("pointerup", onUp);
      hostEl.removeEventListener("pointercancel", onUp);
      hostEl.removeEventListener("dblclick", onDblClick);
    };
  }, [resetOsirisHome, toggleControl]);

  // THE CAPTAIN'S KEYS: while he drives, WASD moves AUGI in the stage
  // plane and SPACEBAR is his action. Typing in any field never
  // drives — the chat input keeps its letters.
  useEffect(() => {
    if (!captainDriving) return;
    const keys = new Set<string>();
    const applyKeys = () => {
      rendRef.current?.setDriveVector(
        (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0),
        (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0),
      );
    };
    const isTyping = (e: KeyboardEvent) =>
      Boolean(
        (e.target as HTMLElement | null)?.closest?.(
          'input, textarea, select, [contenteditable="true"]',
        ),
      );
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const key = e.key.toLowerCase();
      if (key === "escape") {
        toggleControl();
        return;
      }
      if (key === " ") {
        e.preventDefault();
        if (!e.repeat) rendRef.current?.captainAction();
        return;
      }
      if (["w", "a", "s", "d"].includes(key)) {
        e.preventDefault();
        keys.add(key);
        applyKeys();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (keys.delete(key)) applyKeys();
    };
    const onBlur = () => {
      keys.clear();
      applyKeys();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      rendRef.current?.setDriveVector(0, 0);
    };
  }, [captainDriving, toggleControl]);

  // Auto-enter the live world on arrival (owner order): no click needed.
  const autoEnteredRef = useRef(false);
  useEffect(() => {
    if (autoEnteredRef.current) return;
    autoEnteredRef.current = true;
    enterLiveMode();
  }, [enterLiveMode]);

  // IDLE LIFE: Ankh means life, not standing at attention. While nobody is
  // talking to him, Osiris lives — breathes, shifts, walks, flies, studies,
  // thinks, checks on things, and reports. Suggestions only — he never acts
  // on the outside world without my say, and he NEVER opens a window,
  // player or panel on my screen unless I ask (owner order 2026-11-21).
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
      // THINKING counts as mid-conversation (owner eye-check
      // 2026-11-23): a reply is being composed — idle life does not
      // step into its place.
      if (
        bridgeRef.current.state === "SPEAKING" ||
        bridgeRef.current.state === "THINKING" ||
        clearScreenRef.current
      )
        return;
      // Held states (construct law): unanchored he is lifted out for
      // fixing, and while the Captain drives he is under the keys —
      // idle life does not speak or act over either.
      if (!anchoredRef.current || drivingRef.current) return;
      const action = pickIdleActivity(Math.random, lastActivityRef.current ?? undefined);
      lastActivityRef.current = action.activity;
      const line =
        action.activity === "write-chalkboard"
          ? `${action.line} ${idleChalkboardThought()}`
          : action.line;
      // THREAD PURITY (owner eye-check 2026-11-23): the musing
      // goes to the quiet activity line ONLY. It used to ride
      // ai.speak() — the reply channel — so onSpeak recorded it in
      // the conversation thread as the "answer" to whatever he
      // last typed, and its voice.stop() could cut a real reply
      // off mid-sentence. That path is cut: no speech, no thread,
      // no history — a status line, nothing more.
      setActivityLine(line);
      // REPORTS AS NOTIFICATIONS (owner order 2026-11-22): a
      // finished check reports as a stage notification — the same
      // report pattern as the sub-category constructs — gated by
      // his standing notification rules inside notify().
      const reportTopic =
        action.activity === "check-business"
          ? "business"
          : action.activity === "check-sub-ais"
            ? "employees"
            : action.activity === "check-earth"
              ? "earth"
              : null;
      if (reportTopic) {
        const report = idleReportLine(action.activity, true);
        if (report) notify(reportTopic, report);
      }
      // No window opens here — idle life is presence and words only.
      // Notepad, chalkboard and player open on the operator's explicit
      // command or tap, never on Augie's own initiative (2026-11-21).
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
  }, []);

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
    responseSourceRef.current = responseSource;
  }, [responseSource]);

  // CORE LINK: probe on mount and on a slow cadence; a successful probe
  // also flushes the outbox and syncs the core's facts DOWN into this
  // surface's local operator memory, so what was said on another surface
  // is remembered here too (dedupe is by content, inside save()).
  useEffect(() => {
    const link = getCoreLink(setCoreStatus);
    let active = true;
    const check = () => {
      void link.probe().then(async (status) => {
        if (!active || status !== "connected") return;
        const facts = await fetchCoreFacts().catch(() => null);
        if (!active || !facts) return;
        for (const fact of facts) {
          operatorMemory.save(createOperatorFact(fact.content, fact.category, new Date(fact.at)));
        }
      });
    };
    check();
    const interval = window.setInterval(check, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
    // operatorMemory is the stable ref-backed singleton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ACCOUNT SETTINGS: a newer account copy lands here and is applied
  // through the same path as a local change — persisted, pushed into the
  // renderer and sensors, and mirrored to the theme store — so what he
  // sees IS his saved configuration, on whichever device he opened.
  function applySyncedSettings(next: Settings) {
    persistSettings(next);
    const { sensitivity, cooldownMs, ...renderSettings } = next;
    rendRef.current?.updateSettings(renderSettings);
    sensRef.current?.setOptions({ sensitivity, cooldownMs });
    saveThemePreference({ theme: next.theme, customColor: next.customColor });
  }

  useEffect(() => {
    const sync = createSettingsSync({
      apply: (incoming) => applySyncedSettings(incoming),
      onStatus: setSyncStatus,
    });
    syncRef.current = sync;
    sync.start();
    return () => {
      sync.stop();
      if (syncRef.current === sync) syncRef.current = null;
    };
    // Mounted once for the stage's life; the applier reads live refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      ref={stageRootRef}
      className={`avatar-stage${clearScreen ? " avatar-stage--clear-screen" : ""}${worldScreen !== "live" ? " avatar-stage--space" : ""}${osirisDragging ? " avatar-stage--dragging-osiris" : ""}${captainDriving ? " avatar-stage--captain-driving" : ""}${!constructAnchored ? " avatar-stage--construct-held" : ""}${framesArmed ? " avatar-stage--moving-frames" : ""}`}
      data-scene-ready={ready ? "" : undefined}
      data-stage-look={worldScreen === "live" && worldScene === "room" ? "light" : "dark"}
      data-conversation-view={conversationView}
      style={stageStyle}
      onDragOver={(event) => {
        if (builderOpen && event.dataTransfer.types.includes("augi-builder-base")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        const baseId = event.dataTransfer.getData("augi-builder-base");
        if (!baseId || !builderOpen) return;
        event.preventDefault();
        const floor = rendRef.current?.builderFloorPoint(event.clientX, event.clientY);
        placeFromLibrary(baseId, floor ?? undefined);
      }}
    >
      {backdrop === "desert-photo" && backdropArtReady && (
        <img
          className="avatar-stage__backdrop"
          src={backdropById("desert-photo").image ?? undefined}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setBackdropArtReady(false)}
        />
      )}
      <div ref={stageDockRef} className="avatar-stage-dock">
        <div ref={host} className="avatar-construct-host" />
      </div>
      {/* PRESENCE DOCTRINE (owner order 2026-11-22): the Black
          Hatter's medallion stands on the stage only when the
          Captain has brought him back from put-away (the Owner
          seat). His place in the Command box — speaker of record
          for typed lines — is not stage presence and is unchanged. */}
      {!clearScreen && worldScreen === "live" && ownerPresent && (
        <BlackHatterPresence
          inPerspective={perspective === "black-hatter"}
          speaking={hatterSpeaking}
          inCall={conversationView === "call"}
          onSelect={selectOwner}
        />
      )}
      {!clearScreen && worldScreen === "live" && (
        <AnubisPresence
          ready={ready}
          speaking={state === "SPEAKING"}
          listening={voiceListening}
          acting={presenting || state === "THINKING"}
          inPerspective={perspective === "anubis"}
          inCall={conversationView === "call" && perspective === "anubis"}
          inCouncil={council.includes("anubis")}
          atAttention={perspective === "anubis"}
          scepter={godPopUp?.god === "anubis"}
          onSelect={() => selectGod("anubis")}
        />
      )}
      {/* Montu is NOT resident: his medallion stands on the stage
          only while he is summoned, popped in with a report, or
          bowing out under dismissal (presenceDoctrine.ts). */}
      {!clearScreen && worldScreen === "live" && godOnStage(residency, "montu") && (
        <MontuPresence
          ready={ready}
          speaking={perspective === "montu" && state === "SPEAKING"}
          bowing={bowingGod === "montu"}
          inPerspective={perspective === "montu"}
          inCall={conversationView === "call" && perspective === "montu"}
          inCouncil={council.includes("montu")}
          atAttention={perspective === "montu"}
          onSelect={() => selectGod("montu")}
        />
      )}
      {/* THE TOOLBAR IS GONE FROM THE STAGE (owner order 2026-11-22
          — consolidation): the standalone bottom-center bar's seats
          and construct-position orders now live INSIDE the chat box
          (Scene tab: Seats; Motion tab: Construct position). The
          chat box is the main box that controls everything; the
          stage carries no extra controls he does not need. The
          position orders it fires are the WALK orders of this round
          (walkConstructAside / bringConstructIn), passed down to the
          CommandBox below. */}
      {!clearScreen && worldScreen === "live" && (
        <StageNotifications items={notifications} onDismiss={dismissNotification} />
      )}
      {/* THE QUIET ACTIVITY LINE (owner eye-check 2026-11-23):
          idle life's latest musing, as a status line in the
          stage's bottom-right — outside the conversation thread,
          unspoken, and never dressed as a reply. */}
      {!clearScreen && worldScreen === "live" && activityLine && (
        <div className="avatar-activity-line" role="status" aria-label="Construct activity">
          <span className="avatar-activity-line__label">Activity</span> {activityLine}
        </div>
      )}
      {!clearScreen && worldScreen === "live" && godPopUp && (
        <GodReportPopUp
          request={godPopUp}
          stageSize={{
            w: stageRootRef.current?.clientWidth ?? 1440,
            h: stageRootRef.current?.clientHeight ?? 900,
          }}
          occupiedRects={["black-hatter", "anubis", "montu"].map((id): StageRect => {
            const stageW = stageRootRef.current?.clientWidth ?? 1440;
            const stageH = stageRootRef.current?.clientHeight ?? 900;
            const geometry =
              loadMedallionGeometry(id) ?? defaultMedallionGeometry(id, stageW, stageH);
            return {
              x: geometry.x,
              y: geometry.y,
              w: geometry.size,
              h: geometry.size + MEDALLION_UNDER_FACE_HEIGHT,
            };
          })}
          onDone={dismissGodPopUp}
        />
      )}
      {!clearScreen && worldScreen === "live" && constructOpen && (
        <div className="avatar-frame" {...frameDragProps("construct-controls")}>
          <ConstructControls
            anchored={constructAnchored}
            captainDriving={captainDriving}
            onToggleAnchor={toggleAnchor}
            onToggleControl={toggleControl}
            fullBodyHold={fullBodyHold}
            onToggleBodyHold={toggleBodyHold}
            style={frameStyle("construct-controls")}
          />
        </div>
      )}
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
      <div className="avatar-hud avatar-hud--tr" style={frameStyle("hud-status")} {...frameDragProps("hud-status", true)}>
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
            {stageStatusLabel(state, earState)}
            {aiOffline ? " · OFFLINE" : silent ? " · SILENT" : ""}
          </span>
        </div>
        <div>
          INTENSITY: <span className="avatar-hud__value">{intensityLabel(level)}</span>
        </div>
        {/* THE VOICE INDICATOR (owner order 2026-11-22 ~20:11 EST):
            the live graph of his REAL microphone level and the
            plain HEARING YOU / NOT HEARING state for the construct
            he is addressing — Anubis, or the god holding the call
            (Montu). It reads the same local ear the stage listens
            through (earRef — created in the mount effect below,
            which re-renders the stage as it lands), so the graph
            can only move on his measured voice. */}
        <VoiceIndicator
          ear={earRef.current}
          addressee={ADDRESSEE_NAMES[addressee]}
        />
      </div>
      <div className="avatar-hud avatar-hud--tl" style={frameStyle("hud-core")} {...frameDragProps("hud-core", true)}>
        <div className="avatar-hud__db-status">CORE: {coreStatusLabel(coreStatus)}</div>
        <div className="avatar-hud__db-status">
          PHONE BRAIN: {phoneBrainState ? phoneBrainStatusLabel(phoneBrainState) : "CHECKING…"}
        </div>
        {/* SYSTEM HEALTH (owner order 2026-11-22): the calibration
            state joins the standing readouts — the voice gate he
            armed (or did not) is a fact the stage itself holds. A
            knowledge fault surfaces here too, beside the sensor
            fault line, instead of hiding inside a closed panel. */}
        <div className="avatar-hud__db-status">
          VOICE CAL: {voiceCalPrefs.enabled ? "ON" : "OFF"}
        </div>
        <div className="avatar-hud__db-status">
          {perf.fps} FPS {!clearScreen && `· ${(perf.particles / 1000).toFixed(0)}K PTS`}
        </div>
        {!clearScreen && (
          <div className="avatar-hud__db-status">
            CAM {sensor?.camera ? "ON" : "OFF"} · MIC {sensor?.mic ? "ON" : "OFF"} · HANDS{" "}
            {sensor?.hands ? "ON" : "OFF"}
          </div>
        )}
        {sensor?.error && !clearScreen && <div className="avatar-hud__warning">{sensor.error}</div>}
        {memoryError && !clearScreen && (
          <div className="avatar-hud__warning">KNOWLEDGE: {memoryError}</div>
        )}
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
          onToggleVoice={() => earRef.current?.toggle()}
          responseLine={lastWords}
          responseSource={responseSource}
          speakerName={ADDRESSEE_NAMES[addressee]}
          userLine={lastUserMessage}
          userSource={lastUserSource}
          history={transcript}
          partnerSpeaking={state === "SPEAKING"}
          away={worldScreen !== "live"}
          onReturnToChat={returnToChat}
          onOpenHistory={() => setHistoryOpen(true)}
          presence={
            <AugiePresence
              ready={ready}
              avatarState={state}
              voiceListening={voiceListening}
              acting={presenting || worldScreen === "entering" || worldScreen === "returning"}
            />
          }
        >
          {commandTab === "scene" && (
            <CommandGroup label="Seats — the stage turns to who you call">
              <div className="avatar-command-box__grid">
                <CommandAction
                  thumb="/owner-presence/captain-infinity.webp"
                  label={
                    perspective === "black-hatter" && conversationView !== "council"
                      ? "Owner · seated"
                      : "Owner"
                  }
                  onClick={selectOwner}
                />
                <CommandAction
                  thumb="/anubis-presence/face.webp"
                  label={perspective === "anubis" ? "Anubis · seated" : "Anubis"}
                  onClick={() => selectGod("anubis")}
                />
                <CommandAction
                  thumb="/montu-presence/face.webp"
                  label={perspective === "montu" ? "Montu · seated" : "Montu"}
                  onClick={() => selectGod("montu")}
                />
              </div>
            </CommandGroup>
          )}
          {commandTab === "scene" && (
            <CommandGroup label="Avatar scale">
              <div className="avatar-command-box__grid">
                <CommandAction
                  icon={Sparkles}
                  label={constructOpen ? "AUGI avatar · in his box" : "AUGI avatar · open his box"}
                  onClick={() => {
                    if (constructOpen) {
                      closeConstruct();
                      say("His box is closed. The stage is back to you, Captain.");
                    } else {
                      openConstruct();
                      say(
                        "AUGI is up — the sand construct in his own box, red eyes on him so you can see him.",
                      );
                    }
                  }}
                />
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
                <CommandAction
                  icon={LocateFixed}
                  label="AUGI · home spot"
                  onClick={() => {
                    resetOsirisHome();
                    say("AUGI is back at his home spot, anchored and free.");
                  }}
                />
                <CommandAction
                  icon={Anchor}
                  label={
                    constructAnchored
                      ? "AUGI · anchored — lift out to fix"
                      : "AUGI · unanchored — set back in, free"
                  }
                  onClick={() => {
                    toggleAnchor();
                    say(
                      constructAnchored
                        ? "AUGI is lifted out — unanchored, held for fixing. Drag him where you want him."
                        : "AUGI is anchored — set into the stage and free to work.",
                    );
                  }}
                />
                <CommandAction
                  icon={Gamepad2}
                  label={captainDriving ? "Control · Captain driving" : "Control · AUGI free"}
                  onClick={() => {
                    toggleControl();
                    say(
                      captainDriving
                        ? "AUGI has his controls back."
                        : "You have the keys — W A S D moves AUGI, spacebar is his action.",
                    );
                  }}
                />
              </div>
            </CommandGroup>
          )}
          {commandTab === "scene" && (
            <CommandGroup label="World scenes — grown from the living code">
              <div className="avatar-command-box__grid">
                {WORLD_SCENES.map((scene) => (
                  <CommandAction
                    key={scene.id}
                    icon={WORLD_SCENE_ICONS[scene.id]}
                    label={worldScene === scene.id ? `${scene.name} · here` : scene.name}
                    onClick={() => {
                      applyWorldScene(scene.id);
                      say(sceneLine(scene.id));
                    }}
                  />
                ))}
              </div>
            </CommandGroup>
          )}
          {commandTab === "scene" && (
            <CommandGroup label="Backdrop — the stage's saved background, his to set">
              <div className="avatar-command-box__grid">
                {STAGE_BACKDROPS.map((option) => (
                  <CommandAction
                    key={option.id}
                    icon={WORLD_SCENE_ICONS.desert}
                    label={backdrop === option.id ? `${option.name} · set` : option.name}
                    onClick={() => {
                      applyBackdrop(option.id);
                      say(
                        option.id === "desert-photo"
                          ? "The Desert backdrop is set — your photograph, Captain, when it lands at its place."
                          : "The living world is the backdrop again.",
                      );
                    }}
                  />
                ))}
              </div>
            </CommandGroup>
          )}
          {commandTab === "motion" && (
            <CommandGroup label="Construct position">
              <div className="avatar-command-box__grid">
                <CommandAction
                  icon={DoorOpen}
                  label="Bring in"
                  onClick={() => {
                    bringConstructIn();
                    say("AUGI is in, Captain — on the stage, facing you.");
                  }}
                />
                <CommandAction
                  icon={MoveLeft}
                  label="Left"
                  onClick={() => {
                    walkConstructAside("left");
                    say("AUGI steps to the left, Captain — side-on and out of your way.");
                  }}
                />
                <CommandAction
                  icon={MoveRight}
                  label="Right"
                  onClick={() => {
                    walkConstructAside("right");
                    say("AUGI steps to the right, Captain — side-on and out of your way.");
                  }}
                />
                <CommandAction
                  icon={Home}
                  label="Home"
                  onClick={() => {
                    bringConstructIn();
                    say("AUGI is back at his home spot, anchored and free.");
                  }}
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
              {/* ORGANIZATION (owner order 2026-11-22): the rooms used
                  to be one long undifferentiated grid of two dozen
                  buttons. Now subcategories — each thing in exactly
                  one obvious place, same standard as the builder. */}
              <CommandGroup label="Worlds & building">
                <div className="avatar-command-box__grid">
                  <CommandAction icon={Box} label="AR Cube" onClick={() => setArCubeOpen(true)} />
                  <CommandAction
                    icon={Gamepad2}
                    label="Legend of Logic"
                    onClick={() => void navigate({ to: "/avatar/game" })}
                  />
                  <CommandAction
                    icon={Swords}
                    label="World of Logic"
                    onClick={() => void navigate({ to: "/avatar/world" })}
                  />
                  <CommandAction
                    icon={Hammer}
                    label={builderOpen ? "Environment Builder · open" : "Environment Builder"}
                    onClick={() => setBuilderOpen((open) => !open)}
                  />
                  <CommandAction
                    icon={MapIcon}
                    label={mapOpen ? "World Map · open" : "World Map"}
                    onClick={() => setMapOpen((open) => !open)}
                  />
                  <CommandAction
                    icon={LandPlot}
                    label={builtWorldMapOpen ? "Built World · open" : "Built World"}
                    onClick={() => setBuiltWorldMapOpen((open) => !open)}
                  />
                  <CommandAction
                    icon={Building2}
                    label="Departments"
                    onClick={() => setDepartmentsOpen(true)}
                  />
                  <CommandAction
                    icon={Smartphone}
                    label="Phone Bridge — Ghost Protocol One"
                    onClick={() => void navigate({ to: "/phone-bridge" })}
                  />
                </div>
              </CommandGroup>
              <CommandGroup label="Senses & analysis">
                <div className="avatar-command-box__grid">
                  <CommandAction
                    icon={ScanSearch}
                    label="Picture Analysis"
                    onClick={() => setAnalyzeOpen(true)}
                  />
                  <CommandAction icon={Activity} label="Pulse" onClick={() => setPulseOpen(true)} />
                  <CommandAction
                    icon={AudioLines}
                    label="Sound Watch"
                    onClick={() => setSoundWatchOpen(true)}
                  />
                  <CommandAction
                    icon={Waves}
                    label="Signal Map"
                    onClick={() => setSignalMapOpen(true)}
                  />
                  <CommandAction
                    icon={Ear}
                    label="Listening Mode"
                    onClick={() => setListeningOpen(true)}
                  />
                  <CommandAction
                    icon={Bluetooth}
                    label="Devices"
                    onClick={() => setDevicesOpen(true)}
                  />
                  <CommandAction
                    icon={Camera}
                    label="Cameras"
                    onClick={() => setCamerasOpen(true)}
                  />
                </div>
              </CommandGroup>
              <CommandGroup label="Records & safety">
                <div className="avatar-command-box__grid">
                  <CommandAction
                    icon={History}
                    label="Reply history"
                    onClick={() => setHistoryOpen(true)}
                  />
                  <CommandAction
                    icon={Shield}
                    label="Gate Log"
                    onClick={() => setGateLogOpen(true)}
                  />
                  <CommandAction
                    icon={ScrollText}
                    label="Logs"
                    onClick={() => setLogsOpen(true)}
                  />
                  <CommandAction
                    icon={Clapperboard}
                    label="Captain's Log"
                    onClick={() => setCaptainsLogOpen(true)}
                  />
                  <CommandAction
                    icon={BookOpen}
                    label="Library"
                    onClick={() => setLibraryOpen(true)}
                  />
                  <CommandAction
                    icon={Scale}
                    label="Law Desk"
                    onClick={() => setLawOpen(true)}
                  />
                  <CommandAction
                    icon={BarChart3}
                    label="Office Analytics"
                    onClick={() => setAnalyticsOpen(true)}
                  />
                </div>
              </CommandGroup>
              <CommandGroup label="Workshop & study">
                <div className="avatar-command-box__grid">
                  <CommandAction icon={Bug} label="Sandbox" onClick={() => setSandboxOpen(true)} />
                  <CommandAction
                    icon={FlaskConical}
                    label="Test Area"
                    onClick={() => setTestAreaOpen(true)}
                  />
                  <CommandAction
                    icon={Network}
                    label="Anatomy"
                    onClick={() => setAnatomyOpen(true)}
                  />
                </div>
              </CommandGroup>
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
                <p role="status">{settingsSyncLabel(syncStatus)}</p>
              </CommandGroup>
              <CommandGroup label="Brain — where Augie lives">
                <label className="avatar-hud__row">
                  Brain address (Ollama)
                  <input
                    className="avatar-hud__input"
                    value={brainDraft}
                    onChange={(e) => setBrainDraft(e.target.value)}
                    placeholder="192.168.1.50"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    aria-label="Brain address (Ollama)"
                  />
                </label>
                <CommandAction
                  icon={Save}
                  label="Save brain address"
                  onClick={() => applyBrain(brainDraft)}
                />
                <CommandAction
                  icon={Laptop}
                  label="Use this device"
                  onClick={() => applyBrain("")}
                />
                <p>
                  On the computer itself, use “Use this device”. On a phone, type the computer’s
                  address — home Wi-Fi or Tailscale — and Augie answers from the computer.
                </p>
                {brainMsg && <p role="status">{brainMsg}</p>}
              </CommandGroup>
              <CommandGroup label="Connections — APIs & data">
                <div className="avatar-command-box__grid">
                  <CommandAction
                    icon={Globe}
                    label="Connections — the universal slots"
                    onClick={() => setConnectionsOpen(true)}
                  />
                  <CommandAction
                    icon={Network}
                    label="Cloud keys — the lights"
                    onClick={() => setCloudKeysOpen(true)}
                  />
                </div>
                <p>
                  Open slots for APIs and data from other websites — fill one and the system can
                  use it; an empty slot waits, honestly labeled. Values live on the server, never
                  shown.
                </p>
              </CommandGroup>
              <CommandGroup label="On-phone brain — the emergency brain">
                <PhoneBrainPanel onStatusChange={setPhoneBrainState} />
              </CommandGroup>
              <CommandGroup label="Voice — the gods' speech">
                <Slider
                  label="Voice volume"
                  min={0}
                  max={1}
                  step={0.05}
                  value={speechVolume}
                  onChange={changeSpeechVolume}
                  fmt={(v) => `${Math.round(v * 100)}%`}
                />
                <p>
                  The gods speak in a deeper British man's voice — a woman's voice only when the
                  speaker is a woman. The level is yours; full is the standing default.
                </p>
              </CommandGroup>
              <CommandGroup label="Voice calibration — only my operator's voice">
                <VoiceCalibrationPanel prefs={voiceCalPrefs} onPrefsChange={changeVoiceCalPrefs} />
              </CommandGroup>
              <CommandGroup label="Trusted devices — confirmed by full sign-in">
                <TrustedDevicesPanel />
              </CommandGroup>
              <CommandGroup label="Other voices — kept separate, never merged (Part 13)">
                <SpeakerStoresPanel />
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
      {connectionsOpen && <ConnectionsPanel onClose={() => setConnectionsOpen(false)} />}
      {labOpen && <LabPanel onClose={() => setLabOpen(false)} />}
      {historyOpen && (
        <ReplyHistoryWindow
          entries={transcript}
          onClear={() => setTranscript(clearReplyHistory())}
          onClose={() => setHistoryOpen(false)}
        />
      )}
      {arCubeOpen && <ArCubeWindow onClose={() => setArCubeOpen(false)} />}
      {pulseOpen && <PulseWindow onClose={() => setPulseOpen(false)} />}
      {soundWatchOpen && (
        <SoundWatchWindow
          onClose={() => setSoundWatchOpen(false)}
          voiceEarBusy={() => {
            const state = earRef.current?.currentState;
            return state === "starting" || state === "listening" || state === "transcribing";
          }}
          onAlert={(text) => notify("sound-watch security", text)}
        />
      )}
      {analyzeOpen && <AnalyticWindow onClose={() => setAnalyzeOpen(false)} />}
      {gateLogOpen && <GateLogWindow onClose={() => setGateLogOpen(false)} />}
      {signalMapOpen && <SignalMapWindow onClose={() => setSignalMapOpen(false)} />}
      {logsOpen && <LogsWindow onClose={() => setLogsOpen(false)} />}
      {testAreaOpen && <TestAreaWindow onClose={() => setTestAreaOpen(false)} />}
      {anatomyOpen && <AnatomyWindow onClose={() => setAnatomyOpen(false)} />}
      {departmentsOpen && <DepartmentsWindow onClose={() => setDepartmentsOpen(false)} />}
      {captainsLogOpen && <CaptainsLogWindow onClose={() => setCaptainsLogOpen(false)} />}
      {sandboxOpen && <SandboxWindow onClose={() => setSandboxOpen(false)} />}
      {libraryOpen && <LibraryWindow onClose={() => setLibraryOpen(false)} />}
      {lawOpen && <LawWindow onClose={() => setLawOpen(false)} />}
      {analyticsOpen && <OfficeAnalyticsWindow onClose={() => setAnalyticsOpen(false)} />}
      {listeningOpen && <ListeningWindow onClose={() => setListeningOpen(false)} />}
      {listeningArmed && !listeningOpen && (
        <button
          type="button"
          className="listening-stage-badge"
          onClick={() => setListeningOpen(true)}
          aria-label="Listening Mode is armed — open the Listening window"
        >
          <span className="listening-stage-badge__dot" aria-hidden="true" />
          LISTENING
        </button>
      )}
      {devicesOpen && (
        <DevicesWindow
          onClose={() => setDevicesOpen(false)}
          onActivated={() => say(WAND_GREETING)}
        />
      )}
      {camerasOpen && <CamerasWindow onClose={() => setCamerasOpen(false)} />}
      {openWindows.has("notepad") && <NotepadWindow onClose={() => closeWindow("notepad")} />}
      {openWindows.has("chalkboard") && (
        <ChalkboardWindow onClose={() => closeWindow("chalkboard")} externalText={chalkboardText} />
      )}
      {openWindows.has("player") && (
        <PlayerWindow onClose={() => closeWindow("player")} seedInput={playerSeed} />
      )}
      {constructOpen && (
        <FloatingWindow
          id="augie-construct"
          title="AUGI — the construct"
          onClose={closeConstruct}
          initialWidth={560}
          initialHeight={520}
        >
          <div ref={setConstructDock} className="avatar-construct-dock" />
        </FloatingWindow>
      )}
      {builderOpen && (
        <FloatingWindow
          id="environment-builder"
          title="Environment Builder — design the Room"
          onClose={() => setBuilderOpen(false)}
          initialWidth={480}
          initialHeight={680}
        >
          <BuilderPanel
            room={activeLayout(layoutStore).room}
            layouts={layoutStore}
            selectedId={builderSelection}
            onPlace={(baseId) => placeFromLibrary(baseId)}
            onSelectItem={setBuilderSelection}
            onVariant={(id, patch) =>
              updateRoom(updateItemVariant(activeLayout(layoutStoreRef.current).room, id, patch))
            }
            onRotate={(id, rotation) =>
              updateRoom(rotateItem(activeLayout(layoutStoreRef.current).room, id, rotation))
            }
            onToggleAnchor={(id, anchored) =>
              updateRoom(setItemAnchored(activeLayout(layoutStoreRef.current).room, id, anchored))
            }
            onRemove={(id) => {
              updateRoom(removeItem(activeLayout(layoutStoreRef.current).room, id));
              if (builderSelection === id) setBuilderSelection(null);
            }}
            onSurfaces={(surfaces) =>
              updateRoom(setRoomSurfaces(activeLayout(layoutStoreRef.current).room, surfaces))
            }
            {...builderLayoutOps}
            frames={frameStore}
            framesArmed={framesArmed}
            onToggleFramesArmed={() => setFramesArmed((armed) => !armed)}
            onResetFrame={(id) => setFrameStore((store) => withoutFrame(store, id))}
            onResetAllFrames={() => setFrameStore({})}
            worldView={worldPan}
            onGoHome={() => panWorldTo(0, 0)}
            layGroundArmed={layGroundArmed}
            onToggleLayGround={() => setLayGroundArmed((armed) => !armed)}
          />
        </FloatingWindow>
      )}
      {builderOpen && builderSelection && selectionPoint && (
        <BuilderSelectionCluster
          room={activeLayout(layoutStore).room}
          selectedId={builderSelection}
          point={selectionPoint}
          onRotate={(id, rotation) =>
            updateRoom(rotateItem(activeLayout(layoutStoreRef.current).room, id, rotation))
          }
          onToggleAnchor={(id, anchored) =>
            updateRoom(setItemAnchored(activeLayout(layoutStoreRef.current).room, id, anchored))
          }
          onRemove={(id) => {
            updateRoom(removeItem(activeLayout(layoutStoreRef.current).room, id));
            if (builderSelection === id) setBuilderSelection(null);
          }}
          onDone={() => setBuilderSelection(null)}
        />
      )}
      {mapOpen && (
        <FloatingWindow
          id="command-map"
          title="World Map — show a place"
          onClose={() => setMapOpen(false)}
          initialWidth={540}
          initialHeight={600}
        >
          <MapPanel />
        </FloatingWindow>
      )}
      {builtWorldMapOpen && (
        <FloatingWindow
          id="built-world-map"
          title="Built World — your world, mapped"
          onClose={() => setBuiltWorldMapOpen(false)}
          initialWidth={560}
          initialHeight={580}
        >
          <BuiltWorldMapPanel
            room={activeLayout(layoutStore).room}
            getInhabitants={getWorldInhabitants}
            viewCenter={worldPan}
            onGoTo={panWorldTo}
          />
        </FloatingWindow>
      )}
      {snapGuides?.vertical !== undefined && (
        <div className="avatar-snap-guide avatar-snap-guide--vertical" style={{ left: snapGuides.vertical }} aria-hidden="true" />
      )}
      {snapGuides?.horizontal !== undefined && (
        <div className="avatar-snap-guide avatar-snap-guide--horizontal" style={{ top: snapGuides.horizontal }} aria-hidden="true" />
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
  thumb,
  label,
  onClick,
  disabled = false,
}: {
  icon?: LucideIcon;
  /** A face instead of an icon — the seats carry their portraits,
   *  the way the old toolbar's seat buttons did. */
  thumb?: string;
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
      {thumb ? (
        <img
          className="avatar-command-box__action-thumb"
          src={thumb}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      ) : Icon ? (
        <Icon aria-hidden="true" />
      ) : null}
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
