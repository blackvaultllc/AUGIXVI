import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import * as THREE from "three";
import {
  Activity,
  Anchor,
  ArrowLeftRight,
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
  Bell,
  ChevronDown,
  CircleDot,
  Coffee,
  DoorOpen,
  Ear,
  Expand,
  Eye,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Globe,
  Hammer,
  Hexagon,
  History,
  Home,
  Image as ImageIcon,
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
  Radio,
  Save,
  Scale,
  ScanSearch,
  ScrollText,
  Settings2,
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
import { backdropById as builderBackdropById } from "./builder/backdrops";
import { DEFAULT_SYSTEM as DEFAULT_SYSTEM_PROMPT } from "./ollamaAI";
import {
  CommandBox,
  COMMAND_BOX_PHONE_BREAKPOINT,
  COMMAND_TAB_ICONS,
  type CommandTab,
} from "./CommandBox";
import "./stage-fix-round.css";
import "./god-presence.css";
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
  startingSurfaces,
  surfaceIsLight,
  unclaimPlot,
  updateItemVariant,
  withLayoutRoom,
  type BackdropFit,
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
import { speakingMsForText } from "./LivingPortrait";
import { AnubisPresence } from "./AnubisPresence";
import { BlackHatterPresence } from "./BlackHatterPresence";
// MontuPresence (his big front presence) is retired from the
// stage render by the one-god order of 2026-11-26 — Montu
// stands as the call pop-up now (CalledGodPopUp). The component
// itself stands in the codebase, unrendered — hidden, not
// deleted, like the god himself.
import {
  DEFAULT_STAGE_PERSPECTIVE,
  conversationViewFor,
  isGodPerspective,
  perspectiveAfterClose,
  type GodPerspective,
  type StagePerspective,
} from "./stagePerspective";
import { loadStageView, saveStageView, type StageView } from "./stageView";
import { stageViewAfterSwipe, swipeDirection } from "./stageSwipe";
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
  centeredMedallionGeometry,
  clearMedallionSpot,
  loadOrDefaultMedallionGeometry,
  saveMedallionGeometry,
} from "./medallionAnchor";
import { ANUBIS_BINDING, MONTU_BINDING } from "./medallionPortraits";
import {
  FRONT_FACE_SIZE,
  GOD_GREETINGS,
  RESTING_FRONT,
  frontAfterDismiss,
  frontAfterSummon,
  type FrontGod,
} from "./godStage";
import { CalledGodPopUp } from "./CalledGodPopUp";
import { SpeechBubble } from "./SpeechBubble";
import {
  COUNCIL_BACKGROUND,
  COUNCIL_CLOSE_LINE,
  councilOpenLineFor,
  godBackground,
  godInPerspective,
  helperLeaveLine,
  HELPER_GREETINGS,
  parseCouncilCall,
  parseCouncilEnd,
  parseHelperCall,
  speechBubbleFor,
  type CouncilMember,
  type PresenceGodId,
} from "./godPresence";
import { stashChatAttachment } from "./chatAttachment";
import { OsirisMedallion } from "./OsirisMedallion";
import { WallpaperPicker } from "./WallpaperPicker";
import { closeWithBlessing } from "./etiquette";
import {
  applyNotificationInstruction,
  describeNotificationInstruction,
  loadNotificationPrefs,
  parseNotificationInstruction,
  saveNotificationPrefs,
  shouldNotify,
} from "./notificationPrefs";
import { godForReportTopic } from "./godPopUp";
import { capabilitiesBrief } from "./capabilities";
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
import { HexoWindow } from "./HexoWindow";
import { EmulatorWindow } from "./EmulatorWindow";
import { PulseWindow } from "./PulseWindow";
import { SoundWatchWindow } from "./SoundWatchWindow";
import { AnalyticWindow } from "./AnalyticWindow";
import { GateLogWindow } from "./GateLogWindow";
import { SignalMapWindow } from "./SignalMapWindow";
import { IdentifyWindow } from "./IdentifyWindow";
import { FormationWindow } from "./FormationWindow";
import { LogsWindow } from "./LogsWindow";
import { TestAreaWindow } from "./TestAreaWindow";
import { ListeningWindow } from "./ListeningWindow";
import { AnatomyWindow } from "./AnatomyWindow";
import { DepartmentsWindow } from "./DepartmentsWindow";
import { CaptainsLogWindow } from "./CaptainsLogWindow";
import { SandboxWindow } from "./SandboxWindow";
import { LibraryWindow } from "./LibraryWindow";
import { DevicesWindow } from "./DevicesWindow";
import { RemoteCodesWindow } from "./RemoteCodesWindow";
import { CamerasWindow } from "./CamerasWindow";
import {
  WAND_GREETING,
  createHeartbeatCheckPacer,
  notePresenceCheck,
  runPresenceCheck,
  scanWifiEnvironment,
  summonsLine,
  summonsTransitions,
} from "./devices/presence";
import { recordSummonsInCore } from "./devices/summonsClient";
import { loadRegistry } from "./devices/deviceRegistry";
import {
  createFetchHttpChannel,
  createParrotBroadcastChannel,
} from "./devices/commandModule";
import {
  currentDeviceState,
  pushDevicesToCore,
  rememberDeviceState,
  syncDevicesWithCore,
} from "./devices/deviceCoreSync";
import {
  applyStateToStorage,
  pendingFlagRequests,
  resolveStateProfile,
} from "./devices/deviceStoreCore";
import { parseDeviceCommandIntent, toolSendDeviceCommand } from "./devices/deviceTools";
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
import { VoiceLabPanel } from "./VoiceLabPanel";
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
import { brainStateLine } from "./brainState";
import { fetchCoreFacts, getCoreLink } from "./coreLinkClient";
import { fetchDaddyInboxView, operatorAccessToken } from "./learner/daddyInboxClient";
import { getCameraSpeech, markCameraSpeechRouted } from "./cameraPresence.server";
import { getSectorAlertState } from "./sectorWatch.server";
import { getInboxState, getNotifications } from "./notifications.server";
import { isSeriousSystemEntry, seriousSpeechLine } from "./seriousSpeech";
import { NotificationsWindow } from "./NotificationsWindow";
import { ExchangeWindow } from "./ExchangeWindow";
import { DeitiesWindow } from "./DeitiesWindow";
import { PersonalVaultWindow } from "./PersonalVaultWindow";
import { ProjectsWindow } from "./ProjectsWindow";
import { StopSafetyWindow } from "./StopSafetyWindow";
import { DarkHoleWindow } from "./DarkHoleWindow";
import { LearningWindow } from "./learning/LearningWindow";
import { TrainingWindow } from "./learning/TrainingWindow";
import { SightLogWindow } from "./learning/SightLogWindow";
import { getPrayer } from "./learning/learning.server";
import { quoteForInstant, quoteShown, markQuoteShown, quoteSlotForHour, spokenQuote } from "./learning/quotes";
import {
  duePrayerSlot,
  loadPrayerDone,
  savePrayerDone,
  markPrayerHeard,
  prayerTimeLine,
  type PrayerSlot,
} from "./learning/prayerTime";
import { chicagoDateISO, chicagoParts } from "./learning/time";
import { alertRingReading } from "./alertRing";
import {
  currentSoundFeed,
  subscribeSoundFeed,
  type SoundFeedEntry,
} from "./soundWatchFeed";
import { currentRenderCaps } from "./deviceProfile";

type Settings = RenderSettings & {
  sensitivity: number;
  cooldownMs: number;
  // The backdrop sync fields (settings.ts carries the full
  // AvatarSettings shape; the stage's working type matches it).
  backdropImage: string | null;
  backdropFit: BackdropFit;
  backdropSynced: boolean;
};
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
  backdropImage: null,
  backdropFit: "contain",
  backdropSynced: false,
};

const WORLD_SCENE_ICONS: Record<WorldSceneId, LucideIcon> = {
  room: LayoutGrid,
  office: Building2,
  beach: Waves,
  desert: Sun,
  park: TreePine,
  coffee: Coffee,
};

/** Reduced motion, read the way LivingPortrait reads it: the
 *  pop-up tails below are instant for a Captain who asked his
 *  device for stillness. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** How long a call pop-up's leaving tail lasts — a breath, at
 *  the gods' animation standard (section 40 of the fix sheet
 *  carries the matching keyframes). */
const POPUP_EXIT_MS = 260;

/**
 * THE CALL POP-UP'S MOUNT (owner order 2026-11-26 — one god on
 * the screen): a called god's pop-up appears when his call
 * rises and goes away when it ends. The end is ANIMATED, not
 * cut: when the call drops, the pop-up stays mounted for one
 * leaving tail wearing its leaving state, then unmounts.
 * Under reduced motion there is no tail — it is simply gone.
 * (Montu's dismissal needs no tail: his bow holds him on the
 * stage for its own 1.6 seconds before the call state drops.)
 */
function usePopUpPresence(active: boolean): { shown: boolean; leaving: boolean } {
  const [shown, setShown] = useState(active);
  const [leaving, setLeaving] = useState(false);
  const exitTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    },
    [],
  );
  useEffect(() => {
    if (active) {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setLeaving(false);
      setShown(true);
      return;
    }
    if (!shown) return;
    if (prefersReducedMotion()) {
      setShown(false);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      setShown(false);
      setLeaving(false);
    }, POPUP_EXIT_MS);
  }, [active, shown]);
  return { shown, leaving };
}

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
  // HEXO + EMULATORS (owner order 2026-11-25): the HEXO cube is back
  // in his area, and Battle Box emulators live here and in Khadija's
  // space — click and play.
  const [hexoOpen, setHexoOpen] = useState(false);
  const [emulatorOpen, setEmulatorOpen] = useState(false);
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
  // STAGE VIEW (owner eye-check 2026-11-23 — perspective by
  // button): where the stage's camera stands — front, left, or
  // right — switched from Anubis's menu. The view moves around
  // him; his geometry is never touched by it. The choice persists
  // (stageView.ts) and the renderer is told on every change and
  // once when it is created (the mount effect below).
  const [stageView, setStageView] = useState<StageView>(() => loadStageView());
  const stageViewRef = useRef(stageView);
  stageViewRef.current = stageView;
  const changeStageView = useCallback((view: StageView) => {
    setStageView(view);
    saveStageView(view);
    rendRef.current?.setStageView(view);
  }, []);
  // THE ADDRESSEE — A ROUTING STATE (owner order 2026-11-23;
  // rules in addressee.ts): who the Captain is talking to. Anubis
  // by default; naming a god in address switches the conversation
  // to him until another is addressed. THREE readers, one state:
  // the reply prompt carries it per message (speakerDirective),
  // the thread's speaker label renders it, and the reply is spoken
  // in the addressed god's voice — so the label and the words can
  // never disagree again (the 2026-11-23 screenshots: a reply
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
  // summoned for a conversation or bowing out under dismissal.
  // (Reports used to pop a god in for 14 seconds; the pop-up
  // removal of 2026-11-24 ended that — reportGod is never set by a
  // report anymore and stands in the residency only so dismissal
  // can clear it.)
  const [ownerPresent, setOwnerPresent] = useState(false);
  const [summonedGods, setSummonedGods] = useState<GodPerspective[]>([]);
  const [reportGod, setReportGod] = useState<GodPerspective | null>(null);
  const [bowingGod, setBowingGod] = useState<GodPerspective | null>(null);
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
  // THE CALL (owner order 2026-11-26 ~04:32 CST — the law in
  // godStage.ts, superseding the front law of 2026-11-24): the
  // stage RESTS WITH ANUBIS ALONE AT THE CENTER — frontGod
  // starts on him, and no other god is rendered at rest. The
  // state names the god who holds the Captain's CALL beside
  // Anubis: a called god stands as a small pop-up (Montu's
  // circle at the lower-right; Osiris's pop-up follows the
  // addressee state instead, as he has always been addressed
  // in place), and when the call ends the pop-up goes away and
  // the stage is Anubis-only again. frontGod is null only
  // while the Owner seat stands. The greeting is the called
  // god's allegiance line, shown on the stage while he holds
  // the call. The ref mirrors the state for the callbacks that
  // must know the call synchronously.
  const [frontGod, setFrontGod] = useState<FrontGod>(RESTING_FRONT);
  const frontGodRef = useRef<FrontGod>(RESTING_FRONT);
  const [frontGreeting, setFrontGreeting] = useState<string | null>(null);
  // THE POP-UPS' MOUNTS (same order): each pop-up's leaving
  // tail is held by usePopUpPresence, so a call's end fades
  // the pop-up out instead of cutting it. Osiris's call IS the
  // addressee state; Montu's is the call state (or his bow,
  // which holds him while the dismissal lands).
  const osirisPop = usePopUpPresence(addressee === "osiris");
  const montuPop = usePopUpPresence(frontGod === "montu" || bowingGod === "montu");
  // THE HELPER's state stands below, beside `say` — its
  // dismissal speaks the allegiance line through that channel
  // (God Presence doctrine, 2026-11-26 — godPresence.ts).
  const perspectiveRef = useRef(perspective);
  perspectiveRef.current = perspective;
  // A god answers a summon: he comes onto the stage and stays for
  // the conversation. Under the no-overlap law he takes a clear
  // spot — if the spot he was left at would overlap someone already
  // standing, a clear spot is written for him BEFORE he mounts, so
  // he never appears on top of another face. A FRONT summon (owner
  // order 2026-11-24 ~16:57 EST) seats him at the center, big,
  // instead: the clear-spot law yields to the front, because at
  // the front he stands ALONE — whoever held it has stepped back
  // to his resting circle.
  const summonGod = useCallback((god: GodPerspective, seat: "clear" | "front" = "clear") => {
    if (god !== "anubis") {
      const stageW = typeof window === "undefined" ? 0 : window.innerWidth;
      const stageH = typeof window === "undefined" ? 0 : window.innerHeight;
      if (stageW > 0 && stageH > 0) {
        const others = [loadOrDefaultMedallionGeometry("anubis", stageW, stageH)];
        if (ownerPresent) others.push(loadOrDefaultMedallionGeometry("black-hatter", stageW, stageH));
        const standing = loadOrDefaultMedallionGeometry(god, stageW, stageH);
        const spot =
          seat === "front"
            ? centeredMedallionGeometry({ ...standing, size: FRONT_FACE_SIZE }, stageW, stageH)
            : clearMedallionSpot(standing, others, stageW, stageH);
        if (spot.x !== standing.x || spot.y !== standing.y || spot.size !== standing.size) {
          saveMedallionGeometry(god, spot);
        }
      }
    }
    setSummonedGods((current) => (current.includes(god) ? current : [...current, god]));
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
  // THE COUNCIL SESSION's close, reached by ref from the
  // paths defined before it (the council state itself stands
  // with the helper, below): turning to one god, to the Owner
  // seat, or to the construct ends a sitting council silently
  // — the meeting is over when he turns elsewhere.
  const councilCloseRef = useRef<((speak: boolean) => void) | null>(null);
  // SUMMON — THE CALL PASSES (owner order 2026-11-26 ~04:32
  // CST — the law in godStage.ts; this SUPERSEDES the
  // summon-to-the-front of 2026-11-24 for taps): a call on a
  // god — his name addressed, the summon-by-name command, his
  // seat in the Scene tab, his builder figure — turns the
  // conversation to him (the routing law) and raises his CALL:
  // his small pop-up stands beside Anubis, who does NOT leave
  // the center. Whoever held the call before steps down. On
  // arrival he shows allegiance and asks what the Captain
  // needs — the greeting shows on the stage, and on a TAP
  // summon it is spoken in his voice; a routing summon (his
  // name heading a typed line, the summon-by-name command)
  // shows it without speaking, because the answer to his line
  // is the reply. Anubis is first among the gods and the
  // conversation's default — and the stage RESTS with him
  // alone at the center (his resting rule, godStage.ts).
  const selectGod = useCallback(
    (god: GodPerspective, opts?: { speakGreeting?: boolean }) => {
      // Turning to a god turns the CONVERSATION to him too
      // (routing law): his name tapped is his name addressed.
      applyAddressee(god);
      // Residency first: a non-resident god tapped by name is
      // SUMMONED onto the stage — to the FRONT seat (center,
      // big). Returning to Anubis puts the Black Hatter away
      // again — the resident holds his place.
      if (god === "anubis") setOwnerPresent(false);
      else summonGod(god, "front");
      const changed = frontGodRef.current !== god;
      frontGodRef.current = frontAfterSummon(frontGodRef.current, god);
      setFrontGod(frontGodRef.current);
      if (changed) {
        setFrontGreeting(GOD_GREETINGS[god]);
        if (opts?.speakGreeting) {
          // After applyAddressee, the voice speaking is his.
          aiRef.current?.speak(GOD_GREETINGS[god]);
        }
      }
      // One god holds the front at a time: a tap no longer seats
      // a council beside the commander (superseded above).
      setCouncil([]);
      councilCloseRef.current?.(false);
      setPerspective(god);
    },
    [applyAddressee, summonGod],
  );
  const selectOwner = useCallback(() => {
    // The Owner seat brings the Black Hatter BACK onto the stage
    // from put-away — at his saved placement, with the perspective.
    // The front empties with him: the gods step back to their
    // resting circles while the Owner stands.
    setOwnerPresent(true);
    frontGodRef.current = null;
    setFrontGod(null);
    setFrontGreeting(null);
    setCouncil([]);
    councilCloseRef.current?.(false);
    setPerspective("black-hatter");
  }, []);
  const selectGodRef = useRef(selectGod);
  selectGodRef.current = selectGod;
  // RETURN TO HIS PLACE (owner order 2026-11-24 ~16:57 EST;
  // the call law of 2026-11-26): the called god's pop-up goes
  // away and the call returns to ANUBIS, the default — the
  // stage Anubis-only again. For Anubis himself there is
  // nothing to do: the center IS his place. A summoned Montu's
  // residency is NOT ended by this: he stands down through the
  // doctrine's own doors (the dismissal words), not by
  // stepping back — only his pop-up follows the call.
  const returnGodToSlot = useCallback((god: GodPerspective) => {
    if (frontGodRef.current !== god) return;
    frontGodRef.current = frontAfterDismiss(frontGodRef.current, god);
    setFrontGod(frontGodRef.current);
    setFrontGreeting(null);
  }, []);
  // PULSE WINDOW: presence + motion, the rPPG heart-rate estimate and
  // the room-frequency readout in a small floating box (operator order
  // 2026-11-21). Opens from Tools → Rooms and from "open pulse".
  const [pulseOpen, setPulseOpen] = useState(false);
  // THE STATUS TAB (clean-screen round, owner order 2026-11-24
  // ~10:40 EST): the two HUD panels — CORE/PHONE/VOICE/FPS/sensors
  // on the left, STATUS/INTENSITY/hearing on the right — are OFF
  // the main screen. All of it lives behind this one tab; the
  // stage at rest carries none of it. Session-only, like the
  // other panels: the stage opens clean every load.
  const [statusOpen, setStatusOpen] = useState(false);
  // THE CHAT BOX'S CONTROLS, HELD FOR THE GODS (same order —
  // every god his own chat): CommandBox registers its minimize /
  // restore here, and a god's medallion tap restores the box so
  // the conversation he just routed to that god has its window.
  const chatControlsRef = useRef<{ minimize: () => void; restore: () => void } | null>(null);
  const openChatBox = useCallback(() => {
    chatControlsRef.current?.restore();
  }, []);
  // THE WINDOW'S KEYS, HELD FOR OSIRIS (owner order 2026-11-24
  // ~16:57 EST): the chat window registers its anchor / reset /
  // menu machinery here, and Osiris's three-lines menu drives
  // it from his own medallion — the keys are his; the window is
  // the Captain's. The anchor state rides as state so his menu
  // reads it true.
  const chatWindowControlsRef = useRef<{
    toggleAnchored: () => void;
    resetLayout: () => void;
    toggleMenu: () => void;
    anchored: boolean;
  } | null>(null);
  const [chatWindowAnchored, setChatWindowAnchored] = useState(true);
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
  // REMOTE CODES WINDOW (operator order 2026-11-24): the RF/IR
  // knowledge load — every public TV/remote code Augie holds, in a
  // lookup with a remote surface. Lookup + display + copy only;
  // sending waits for the blaster hardware.
  const [remoteCodesOpen, setRemoteCodesOpen] = useState(false);
  // IDENTIFY WINDOW (cybernetic pass, 2026-11-26): the
  // Identifier cabinet — Heard it / Saw its signal / Remote or
  // device, cross-checked against the registry. Opens from
  // Tools → Senses & analysis.
  const [identifyOpen, setIdentifyOpen] = useState(false);
  // THE FORMATION WINDOW (cybernetic pass, 2026-11-26): every
  // surface of the one core, probed live — Parrot core, this
  // surface, the online copy, the Osiris node, the phone copy.
  // Opens from Tools → Connections & keys.
  const [formationOpen, setFormationOpen] = useState(false);
  // CAMERAS WINDOW (operator order 2026-11-23): his own cameras on
  // his own network — both lenses live, PTZ under his grant. Opens
  // from Tools → Senses & analysis.
  const [camerasOpen, setCamerasOpen] = useState(false);
  // NOTIFICATIONS (owner orders 2026-11-26): Anubis's inbox —
  // his suggestions, the system's own activity, and the
  // pictures he kept with their reasoning. The stage button
  // carries the real unread count from the core store, read
  // on the poll below; the window is NotificationsWindow.
  const [inboxOpen, setInboxOpen] = useState(false);
  // THE LEFT RAIL (owner order 2026-11-26 ~13:48 CST): the
  // NOTIFICATIONS pill moved from the top-right to the
  // top-LEFT, and directly under it his SETTINGS quick-access —
  // press the button and a drop-down of his settings and
  // options falls open; he picks what he needs and it opens.
  // The drop-down's categories fold (one open at a time) and
  // every row is one line at one height — the same accordion
  // and symmetry rules as the tools list.
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [quickMenuGroup, setQuickMenuGroup] = useState<string | null>(null);
  const [deitiesOpen, setDeitiesOpen] = useState(false);
  // Personal safety pass (owner order 2026-11-26): his papers
  // in the vault, and the law base + stop mode. Owner surface
  // only — these windows open from the operator's own Tools.
  const [vaultOpen, setVaultOpen] = useState(false);
  const [stopSafetyOpen, setStopSafetyOpen] = useState(false);
  // Projects pass (owner order 2026-11-26): his websites inside
  // IEM — the registry, the editor view, and the marks he saves.
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [inboxUnread, setInboxUnread] = useState(0);
  // THE DARK HOLE (owner order 2026-11-26): his library —
  // files broken down to pieces on the core, filed under his
  // own categories, reassembled only through the manifest.
  // Opens from Tools → Records & safety; the window is
  // DarkHoleWindow. Owner surface only, never the learner's.
  const [darkHoleOpen, setDarkHoleOpen] = useState(false);
  // GRID-DOWN EXCHANGE (owner order 2026-11-26): the secure
  // file door (SFTP) for when the network is down — his switch,
  // his per-person keys, the Outbox and the Inbox. Owner stage
  // only; the window is ExchangeWindow.
  const [exchangeOpen, setExchangeOpen] = useState(false);
  // THE CAPTAIN'S LEARNING (owner orders 2026-11-26): his
  // shelves (Psychology, Dark Psychology, The Art of War),
  // Daily Training, and the Sight Log — owner surfaces,
  // opened from Tools → Workshop & study. The quote of the
  // day/night is read aloud once per slot on opening (effect
  // below); Prayer Time surfaces as a pill under the
  // notifications pill when a prayer slot comes due.
  const [learningOpen, setLearningOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [sightLogOpen, setSightLogOpen] = useState(false);
  const [prayerDue, setPrayerDue] = useState<PrayerSlot | null>(null);
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
  // REPORTS (owner order 2026-11-22; PRESENTATION SETTLED by the
  // Captain 2026-11-24 ~09:57 EST, voice call, SUPERSEDING the
  // 2026-11-23 medallion + comic-box presentation and the
  // 2026-11-24 presence gate): "I see Anubis keeps popping up on
  // the side and his scepter is getting in the way of the actual
  // Anubis. Stop having that pop up. I don't want to see that
  // anymore." So NO pop-up of a god's face renders on the stage,
  // ever — not for a report, not for a reply, not at boot. The
  // GodReportPopUp component, its state, and the was-scepter
  // overlay are gone entirely. A report's whole delivery is:
  // the god's voice (the proactive path speaks it) and the
  // record — notify() writes it into the conversation record
  // under its god's own name, where it waits in the thread and
  // History. The report is gated by his standing notification
  // rules (notificationPrefs.ts) at raise time.
  const notify = useCallback((topic: string, text: string, god?: GodPerspective) => {
    if (!shouldNotify(loadNotificationPrefs(), topic, Date.now())) return;
    // Attribution: an explicitly attributed god wins; otherwise
    // the topic decides (Montu for defense and security, Anubis
    // in command for the rest) — the name signs the record entry.
    const reportingGod = god ?? godForReportTopic(topic);
    // THE REPORT WAITS IN THE RECORD (owner order 2026-11-24):
    // every report is written into the conversation record under
    // its god's own name — no question, dated like every entry —
    // so what arrived while he was in another tab, or doing
    // anything else, is waiting in the thread when he comes back
    // to chat. It is NOT a reply and never poses as one: the
    // entry carries no question, and its speaker is the god who
    // reported, not an answer to anything he typed.
    setTranscript((prev) =>
      appendReplyHistory(prev, {
        at: Date.now(),
        question: "",
        answer: text,
        speaker: ADDRESSEE_NAMES[reportingGod],
      }),
    );
  }, []);

  /**
   * KHADIJA'S LINE (owner order 2026-11-24 ~17:13 CST): while the
   * Captain is at his Augie, the stage polls his Daddy Inbox every
   * 25 seconds. The poll itself stamps his presence on the core —
   * that stamp is what her side reads as "Daddy is online". A new
   * message from her, and a call from her, are raised here the
   * moment they are seen: written into his record by notify() (and
   * spoken by the proactive voice path like every report), waiting
   * in his thread and History. The full thread, his reply box, and
   * the call's Answer button live in the Logs window's Khadija tab.
   * Seen ids are kept in refs so one arrival is raised once.
   */
  const daddySeenMessagesRef = useRef<Set<string> | null>(null);
  const daddySeenCallRef = useRef<string | null>(null);
  /**
   * THE ALERT RING's stage inputs (cybernetic pass, 2026-11-26;
   * Sector Watch added its record the same day): Khadija's call
   * ringing right now (kept by the inbox poll below, from its
   * real view), the Sound Watch feed (its own subscription), and
   * the Sector Watch events waiting unacknowledged (kept by the
   * sector poll beside the camera-speech poll — alertRing.ts
   * reads the three records and nothing else). The reading
   * drives Anubis's ring ALERT state.
   */
  const [daddyCallRinging, setDaddyCallRinging] = useState(false);
  const [soundFeed, setSoundFeed] = useState<SoundFeedEntry[]>(() => currentSoundFeed());
  useEffect(() => subscribeSoundFeed(setSoundFeed), []);
  const [sectorAlertsWaiting, setSectorAlertsWaiting] = useState(0);
  const alertReading = alertRingReading({ soundFeed, daddyCallRinging, sectorAlertsWaiting });
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const view = await fetchDaddyInboxView().catch(() => null);
      if (stopped || !view) return;
      setDaddyCallRinging(view.call?.state === "ringing");
      if (daddySeenMessagesRef.current === null) {
        // First poll: everything already read is history; only her
        // still-unread words are news.
        daddySeenMessagesRef.current = new Set(
          view.messages.filter((m) => m.from === "daddy" || m.readByDaddy).map((m) => m.id),
        );
      }
      for (const message of view.unread) {
        if (daddySeenMessagesRef.current.has(message.id)) continue;
        daddySeenMessagesRef.current.add(message.id);
        notify("family", `Message from Khadija: “${message.text}”`);
      }
      const call = view.call;
      if (call && call.state === "ringing" && daddySeenCallRef.current !== call.id) {
        daddySeenCallRef.current = call.id;
        notify(
          "family",
          "Khadija is calling you. Open the Logs window — the Khadija tab — and tap Answer to be with her.",
        );
      }
      if (!call || call.state !== "ringing") {
        if (call?.state === "answered") daddySeenCallRef.current = call.id;
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 25_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [notify]);
  /**
   * THE DEVICE CORE SYNC (owner order 2026-11-24): the stage keeps
   * this surface's device cache merged with the core's store, so
   * the capability brief and Anubis's device tools read the same
   * registry the Devices window shows. A Permission Law flag
   * request Anubis has filed is raised here the moment it is seen —
   * it waits for the Captain's hand in the Devices window, and is
   * never applied by anyone else.
   */
  const flagRequestSeenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const state = await syncDevicesWithCore().catch(() => null);
      if (stopped || !state) return;
      for (const request of pendingFlagRequests(state)) {
        if (flagRequestSeenRef.current.has(request.id)) continue;
        flagRequestSeenRef.current.add(request.id);
        notify(
          "devices",
          `Anubis asks a Permission Law change for ${request.deviceName} — it waits for your hand in the Devices window. Nothing was granted.`,
        );
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 60_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [notify]);
  /**
   * THE RESPONSE MODEL (owner order 2026-11-22 ~20:02 EST;
   * PRESENTATION SETTLED 2026-11-24 ~09:57 EST; THE BUBBLE
   * REFINED 2026-11-26 ~13:48 CST): a REPLY reaches the Captain
   * by the god's VOICE and by the chat thread — the record of
   * it waits in the thread and behind History. The pop-up
   * delivery that used to raise the speaking god's face beside
   * a comic bubble was REMOVED by his order ("Stop having that
   * pop up. I don't want to see that anymore") — and it stays
   * removed: no second face ever appears for a reply. What the
   * 2026-11-26 order brings back is the BUBBLE ALONE, hung on
   * the god's own standing presence: while Anubis (or a called
   * god) is actually speaking, a comic-book speech bubble
   * stands beside HIS head showing the words he is saying —
   * like talking to a character in a comic-book game
   * (godPresence.ts, speechBubbleFor; SpeechBubble.tsx). The
   * resident medallion's own mouth still moves while its god
   * speaks — that is the face he seated, not a pop-up.
   */
  /**
   * THE RESPECT ASK (owner order 2026-11-23 ~07:22 EST): when a
   * god's face is handled past the threshold, the god himself
   * speaks the polite line — once per session per god (the anchor
   * hook keeps the count and the spent set). Voice only: since
   * the pop-up removal (2026-11-24) the line raises nothing on
   * the stage.
   */
  const respectAsk = useCallback((god: "anubis" | "montu") => {
    void god;
    const line = "Please — I am not to be handled. Speak, and I will answer.";
    aiRef.current?.speak(line);
  }, []);
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

  // THE HELPER (God Presence doctrine, owner order 2026-11-26
  // ~13:51 CST — godPresence.ts): a god called BY a god, while a
  // conversation is already live, stands SMALLER — the Osiris
  // medallion scale — on the stage's lower-left field. He is
  // not the call and not the addressee: he stands WITH the god
  // who holds the conversation, and when he is done he bows
  // (the same 1.6 seconds a dismissal has always held) and is
  // gone back to his work. Only Montu and Osiris can stand as
  // helpers — Anubis is already on the screen, at the center.
  const [helperGod, setHelperGod] = useState<"montu" | "osiris" | null>(null);
  const helperGodRef = useRef<"montu" | "osiris" | null>(null);
  const [helperBowing, setHelperBowing] = useState(false);
  const helperPop = usePopUpPresence(helperGod !== null);
  const helperBowTimerRef = useRef<number | null>(null);
  const raiseHelper = useCallback((god: "montu" | "osiris") => {
    if (helperBowTimerRef.current !== null) window.clearTimeout(helperBowTimerRef.current);
    helperBowTimerRef.current = null;
    setHelperBowing(false);
    helperGodRef.current = god;
    setHelperGod(god);
  }, []);
  const dismissHelper = useCallback(() => {
    const god = helperGodRef.current;
    if (!god) return;
    const name = god === "montu" ? MONTU_BINDING.name : "Osiris";
    setHelperBowing(true);
    say(closeWithBlessing(helperLeaveLine(name)));
    if (helperBowTimerRef.current !== null) window.clearTimeout(helperBowTimerRef.current);
    helperBowTimerRef.current = window.setTimeout(() => {
      helperBowTimerRef.current = null;
      helperGodRef.current = null;
      setHelperGod(null);
      setHelperBowing(false);
    }, 1600);
  }, [say]);

  // THE COUNCIL (God Presence doctrine point 7, owner order
  // 2026-11-26 ~13:54 CST — godPresence.ts): a meeting mode.
  // While it sits, the seated gods stand at PRESENCE scale
  // beside Anubis, who chairs from the center; the background
  // settles to the council setting; whoever he names answers
  // (the standing addressee routing), Anubis otherwise. It is
  // an Egyptian seat — El Consejo is its second name — and
  // no other mythology's court stands in it. Ending it returns the
  // stage to its rest: Anubis alone. PERFORMANCE LAW: the
  // council reuses the standing pop-up components — no new
  // render loop, no new animation system; the seated gods
  // render only while the session is open, at zero cost at
  // rest.
  const [councilSession, setCouncilSession] = useState<readonly CouncilMember[] | null>(null);
  const councilRef = useRef<readonly CouncilMember[] | null>(null);
  const openCouncil = useCallback(
    (members: readonly CouncilMember[]) => {
      councilRef.current = members;
      setCouncilSession(members);
      // The chair is Anubis: the conversation returns to him
      // as the council seats.
      applyAddressee("anubis");
      say(councilOpenLineFor(members));
    },
    [applyAddressee, say],
  );
  const closeCouncil = useCallback(
    (speak: boolean) => {
      if (councilRef.current === null) return;
      councilRef.current = null;
      setCouncilSession(null);
      if (speak) say(COUNCIL_CLOSE_LINE);
    },
    [say],
  );
  councilCloseRef.current = closeCouncil;
  // The seated gods' pop-up presence (the same fade law as
  // every call): Montu's council pop-up is separate from his
  // call pop-up — while he HOLDS the call the call pop-up
  // stands; in council he stands by his seat in the session.
  const councilMontuPop = usePopUpPresence(
    councilSession?.includes("montu") ?? false,
  );
  const councilOsirisPop = usePopUpPresence(
    councilSession?.includes("osiris") ?? false,
  );

  // THE CHAT BOX'S ATTACHMENT ROUTER (owner order, voice call
  // 2026-11-26 ~13:48 CST): a picture picked in the chat box
  // goes to Picture Analysis (stashed, the window opens, the
  // analyzer takes it — chatAttachment.ts); a text or Markdown
  // file goes into Knowledge by the panel's own import path;
  // anything else is answered plainly — no file is ever dropped
  // in silence.
  const handleChatAttachment = useCallback(
    (file: File) => {
      if (file.type.startsWith("image/")) {
        stashChatAttachment(file);
        setAnalyzeOpen(true);
        say(`Your picture is in Picture Analysis, Captain — ${file.name}.`);
      } else if (
        /\.(txt|md)$/i.test(file.name) ||
        file.type === "text/plain" ||
        file.type === "text/markdown"
      ) {
        void importKnowledgeFile(file);
        say(`Filed into your knowledge, Captain — ${file.name}.`);
      } else {
        say(
          "That kind of file has no home here yet, Captain — pictures go to Picture Analysis, and text files go to Knowledge.",
        );
      }
    },
    [say],
  );

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
  // THE GOD'S OWN BACKGROUND (God Presence doctrine, owner
  // order 2026-11-26 ~13:50 CST): while a god holds the call,
  // HIS picture stands over the Captain's wallpaper — the
  // wallpaper choice itself is never touched. A god whose
  // picture is not placed yet (godPresence.ts names them all)
  // or whose file fails to load keeps the wallpaper: the
  // failed god is remembered here so a broken file never
  // flickers, and never wears a substitute.
  const [godBackdropFailedFor, setGodBackdropFailedFor] = useState<PresenceGodId | null>(null);
  // CHANGE WALLPAPER (owner order 2026-11-24 ~17:26 EST): he went
  // looking in the menu for the wallpaper and could not find it —
  // the Scene tab now opens with a plainly labeled "Change
  // wallpaper" entry, and this state is its picker standing open.
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
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
    closeCouncil(false);
    setPerspective("construct");
  }, [closeCouncil]);
  const closeConstruct = useCallback(() => {
    setConstructOpen(false);
    setConstructDock(null);
    setConstructOnStage(false);
    setCouncil([]);
    closeCouncil(false);
    setPerspective(perspectiveAfterClose());
  }, [closeCouncil]);

  // THE LAYERING LAW (owner order 2026-11-24): the sand
  // construct renders NOWHERE on the main stage by default —
  // behind Anubis is wallpaper only. He stands when he has been
  // brought on (called onto the stage), and in his own box while
  // it is open and docked. Nothing else raises him: not the
  // space view, not the builder being open. The rule itself
  // lives in presenceDoctrine.ts.
  useEffect(() => {
    rendRef.current?.setConstructVisible(
      constructStandsOnStage({
        constructOnStage,
        constructOpen,
        constructDocked: constructDock !== null,
      }),
    );
  }, [constructOpen, constructDock, constructOnStage]);

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

  // BUILDING NEEDS THE STAGE CLEAR (owner order 2026-11-24): the
  // big chat box sits over the stage and leaves him no room to
  // place or move pieces. Entering the builder folds the chat
  // box away (the clean-screen fold: Osiris's head alone);
  // leaving the builder restores it. The
  // fold is the stage's doing, so the stage remembers it folded
  // the box and only then restores — a box he folded himself, or
  // opened himself mid-build, is never fought. On phone widths
  // the chat already lives as the bottom bar, so there is
  // nothing to fold and nothing to restore.
  const chatBoxControlsRef = useRef<{ minimize: () => void; restore: () => void } | null>(null);
  const builderFoldedChatRef = useRef(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth <= COMMAND_BOX_PHONE_BREAKPOINT) {
      return;
    }
    if (builderOpen) {
      builderFoldedChatRef.current = true;
      chatBoxControlsRef.current?.minimize();
    } else if (builderFoldedChatRef.current) {
      builderFoldedChatRef.current = false;
      chatBoxControlsRef.current?.restore();
    }
  }, [builderOpen]);

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

  /**
   * THE BACKDROP SYNC (owner decision 2026-11-23 ~07:27 EST):
   * the backdrop picture + fit follow the operator's account
   * (settings.ts + settingsSync.ts) — phone, tablet, PC, the same
   * background. Applying a pick writes it into the active room,
   * whose layout store is this device's cached copy: the offline
   * Parrot keeps showing the last-synced picture with no network.
   */
  const applyBackdropPick = useCallback((image: string | null, fit: BackdropFit) => {
    const room = activeLayout(layoutStoreRef.current).room;
    if (room.surfaces.backdropImage === image && room.surfaces.backdropFit === fit) return;
    updateRoom(
      setRoomSurfaces(room, { ...room.surfaces, backdropImage: image, backdropFit: fit }),
    );
  }, [updateRoom]);

  // The menu's wallpaper pick: applies at once (the room follows
  // immediately) and syncs exactly like the builder's pick — the
  // settings carry it to his other devices (owner decision
  // 2026-11-23, surfaced in the menu 2026-11-24 ~17:26 EST).
  const pickWallpaper = useCallback(
    (image: string | null) => {
      const fit = activeLayout(layoutStoreRef.current).room.surfaces.backdropFit;
      applyBackdropPick(image, fit);
      const current = settingsRef.current;
      if (current.backdropImage !== image || current.backdropFit !== fit || !current.backdropSynced) {
        persistSettings({
          ...current,
          backdropImage: image,
          backdropFit: fit,
          backdropSynced: true,
        });
      }
    },
    [applyBackdropPick, persistSettings],
  );

  // On load, this device's own settings copy may already carry
  // the last-synced pick (saved on this device or pulled from the
  // account on a previous visit) — the room follows it.
  useEffect(() => {
    const saved = settingsRef.current;
    if (saved.backdropSynced) {
      applyBackdropPick(saved.backdropImage, saved.backdropFit);
      return;
    }
    // THE STARTING PICTURES (owner order 2026-11-26): no pick
    // has ever been made — not on this device, not on his
    // account — so the stage sets his shipped defaults for him
    // (room.ts startingSurfaces: a picture for the top, a
    // picture for the bottom), written into the room through
    // the same surfaces write every pick travels. Deliberately
    // NOT stamped into the account settings here: a default
    // must never outrank a real pick, and the first pick he
    // makes anywhere takes over through the normal path —
    // backdropSynced turns true and this branch never runs
    // again. Each of his devices lays the same defaults at its
    // own boot until then, so every screen opens dressed.
    const room = activeLayout(layoutStoreRef.current).room;
    const surfaces = startingSurfaces(room.surfaces);
    if (surfaces !== room.surfaces) {
      updateRoom(setRoomSurfaces(room, surfaces));
    }
    // Mounted once: the boot application of the device's copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // A helper who stood with the dismissed god leaves with
        // him (God Presence doctrine): his bow is this bow — no
        // second ceremony, and no helper is left standing over
        // an empty call.
        if (helperBowTimerRef.current !== null) window.clearTimeout(helperBowTimerRef.current);
        helperBowTimerRef.current = null;
        helperGodRef.current = null;
        setHelperGod(null);
        setHelperBowing(false);
        setBowingGod((current) => (current === god ? null : current));
        setSummonedGods((current) => current.filter((entry) => entry !== god));
        setReportGod((current) => (current === god ? null : current));
        setCouncil((current) => current.filter((entry) => entry !== god));
        setPerspective((current) => (current === god ? DEFAULT_STAGE_PERSPECTIVE : current));
        // The dismissed god's CALL ends with his bow (owner
        // order 2026-11-26): when the bow ends his pop-up is
        // gone, and the call is ANUBIS's again — the stage's
        // default, never an empty wallpaper. His greeting goes
        // with the dismissed god.
        frontGodRef.current = frontAfterDismiss(frontGodRef.current, god);
        setFrontGod(frontGodRef.current);
        setFrontGreeting(null);
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
      // all read the new addressee for this very message. THE CALL
      // FOLLOWS THE CONVERSATION (owner order 2026-11-26 — one god
      // on the screen): addressing Montu raises his call (his
      // pop-up stands beside Anubis, who never leaves the center);
      // addressing Osiris raises his pop-up at the top-left, in
      // place, the way he has always been addressed; and turning
      // the conversation AWAY from Montu — to Anubis or to Osiris —
      // ends his call, so his pop-up goes away and the stage is
      // Anubis's again. (His residency stands until a dismissal,
      // as ever — only the pop-up follows the call.) A passing
      // mention never routes (detectAddressee is conservative by
      // design).
      const addressedGod = detectAddressee(text);
      if (addressedGod && addressedGod !== addresseeRef.current) {
        applyAddressee(addressedGod);
        if (addressedGod === "montu") {
          if (frontGodRef.current !== "montu") selectGodRef.current("montu");
        } else if (frontGodRef.current === "montu") {
          returnGodToSlot("montu");
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
      // THE COUNCIL (God Presence doctrine point 7): a call to
      // council seats the gods beside Anubis for a meeting —
      // "call everybody" seats them all. A council-end word
      // closes it. Both are checked before every other call
      // form, and while the council sits, a dismissal word
      // ends the council first (in the dismissal block below).
      if (councilRef.current !== null && parseCouncilEnd(avatarRequest)) {
        closeCouncil(true);
        return;
      }
      const councilCall = parseCouncilCall(avatarRequest);
      if (councilCall) {
        if (councilRef.current !== null) {
          say("The council already sits, Captain.");
        } else {
          openCouncil(councilCall);
        }
        return;
      }
      // A CALL FOR A SECOND GOD (God Presence doctrine, owner
      // order 2026-11-26 ~13:51 CST): while a god already holds
      // the call or the conversation, a call form naming ANOTHER
      // god raises him as a HELPER — smaller, standing with the
      // god who holds the conversation (godPresence.ts,
      // parseHelperCall). With nobody called, the line is a main
      // summon and falls to the standing path below. A helper
      // already standing is not raised twice.
      const helperCall = parseHelperCall(avatarRequest, addresseeRef.current);
      const callHolder: PresenceGodId | null =
        frontGodRef.current !== null && frontGodRef.current !== "anubis"
          ? frontGodRef.current
          : addresseeRef.current !== "anubis"
            ? addresseeRef.current
            : null;
      if (
        helperCall &&
        callHolder !== null &&
        helperCall !== callHolder &&
        helperGodRef.current !== helperCall
      ) {
        raiseHelper(helperCall);
        say(HELPER_GREETINGS[helperCall]);
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
        // A sitting council ends FIRST (God Presence doctrine
        // point 7): the gods return to their work and the stage
        // returns to its rest.
        if (councilRef.current !== null) {
          closeCouncil(true);
          return;
        }
        // A helper standing with the call is sent back FIRST
        // (God Presence doctrine): he shows his allegiance and
        // returns to his work, and the god who holds the
        // conversation stays.
        if (helperGodRef.current !== null && !helperBowing) {
          dismissHelper();
          return;
        }
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
      // ANUBIS'S DEVICE HANDS (owner order 2026-11-24): a direct
      // device order in the Captain's words — "tell Wepwawet to
      // sit", "stop the dog" — is fired by the construct itself,
      // from the core state, through the general bridge. His word
      // is the order, so a broadcast send is LIVE; the Permission
      // Law still gates it before anything is touched, a refusal
      // sends nothing, and the outcome is spoken in plain words
      // either way. The attempt lands in the core's command log.
      const deviceIntent = parseDeviceCommandIntent(commandText, currentDeviceState());
      if (deviceIntent) {
        setResponseSource("device command");
        const state = currentDeviceState();
        const device = state.registry.find((d) => d.id === deviceIntent.deviceId);
        const resolved = device ? resolveStateProfile(state, device) : null;
        const channel =
          resolved?.profile.transport === "bluetooth-broadcast"
            ? createParrotBroadcastChannel({ live: true, deviceId: deviceIntent.deviceId })
            : resolved?.profile.transport === "network-http"
              ? createFetchHttpChannel()
              : null;
        const sent = await toolSendDeviceCommand(state, {
          deviceId: deviceIntent.deviceId,
          commandId: deviceIntent.commandId,
          channel,
          channelUnavailableReason:
            "That command's road does not run from the stage — its card in Devices is the road. Nothing was sent.",
          now: Date.now(),
        });
        if (sent.ok) {
          rememberDeviceState(sent.value.state);
          applyStateToStorage(sent.value.state);
          void pushDevicesToCore();
          say(`${deviceIntent.deviceName} — ${deviceIntent.commandName}: ${sent.value.outcome.note}`);
        } else {
          say(sent.error);
        }
        return;
      }
      await aiRef.current?.handleText(commandText);
    },
    // operatorMemory is a stable ref-backed singleton; excluding it keeps
    // sendCommand referentially stable across saves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enterLiveMode, executeWorldCommand, navigate, operatorName, returnToSpace, say],
  );

  /**
   * CAMERA SPEECH (Camera Presence pass, 2026-11-26): the cameras
   * hear on the core; what they hear lands in the core's presence
   * record. This poll is the last step of that road — a name heard
   * through a camera raises a notification here, and speech a
   * camera was armed to forward is fed to Anubis through the very
   * same sendCommand(text, "voice") path the local ear uses, then
   * marked routed on the record so it is never fed twice. Camera
   * COMMANDS never pass through here: they already executed (or
   * were refused) on the core, behind the Permission Law and the
   * ALL-STOP, at the moment they were heard.
   */
  const cameraSpeechSeenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const accessToken = await operatorAccessToken().catch(() => null);
      if (stopped || !accessToken) return;
      const view = await getCameraSpeech({ data: { accessToken } }).catch(() => null);
      if (stopped || !view?.authorized) return;
      if (cameraSpeechSeenRef.current === null) {
        // First poll: name events already on the record are
        // history; only new ones raise him. Unrouted speech is
        // still owed to Anubis — it was spoken to be heard.
        cameraSpeechSeenRef.current = new Set(
          view.events.filter((e) => e.kind === "name").map((e) => e.id),
        );
      }
      const routedIds: string[] = [];
      for (const event of view.events) {
        if (event.kind === "name") {
          if (cameraSpeechSeenRef.current.has(event.id)) continue;
          cameraSpeechSeenRef.current.add(event.id);
          notify("cameras", `The ${event.cameraName} camera heard you call Anubis: “${event.text}”`);
        } else if (event.kind === "speech" && !event.routed) {
          routedIds.push(event.id);
          void sendCommand(event.text, "voice");
        }
      }
      if (routedIds.length > 0) {
        await markCameraSpeechRouted({ data: { accessToken, ids: routedIds } }).catch(() => null);
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 20_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [notify, sendCommand]);

  /**
   * SECTOR WATCH ALERTS (Sector Watch pass, 2026-11-26): Anubis
   * watches the cameras on the core; a confirmed reading raises
   * a security event in the sector record. This poll is how the
   * stage learns of it — the unacknowledged count feeds the
   * Alert Ring, and each NEW event is raised once here as a
   * notification (his acknowledgment in the Cameras window is
   * what clears it). The first poll treats everything already
   * waiting as standing history for the ring — it does not
   * re-announce old events; only events raised while he is at
   * his Augie are announced the moment they are seen.
   */
  const sectorSeenRef = useRef<Set<string> | null>(null);
  const sectorJudgmentSeenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const accessToken = await operatorAccessToken().catch(() => null);
      if (stopped || !accessToken) return;
      const view = await getSectorAlertState({ data: { accessToken } }).catch(() => null);
      if (stopped || !view?.authorized) return;
      setSectorAlertsWaiting(view.events.length);
      if (sectorSeenRef.current === null) {
        sectorSeenRef.current = new Set(view.events.map((e) => e.id));
        sectorJudgmentSeenRef.current = new Set(view.judgments.map((j) => j.id));
        return;
      }
      for (const event of view.events) {
        if (sectorSeenRef.current.has(event.id)) continue;
        sectorSeenRef.current.add(event.id);
        notify("cameras", `Sector Watch: ${event.summary}`);
      }
      // Judgment items ride the same poll but are NOT alerts —
      // they are Anubis's "look at this", raised once each.
      for (const judgment of view.judgments) {
        if (sectorJudgmentSeenRef.current?.has(judgment.id)) continue;
        sectorJudgmentSeenRef.current?.add(judgment.id);
        notify("cameras", judgment.text);
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 25_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [notify]);

  /**
   * NOTIFICATIONS POLL (owner orders 2026-11-26): on the same
   * 25-second beat as the sector poll, the stage reads Anubis's
   * inbox state — the read reconciles the inbox and the
   * property feed from the core's real records server-side —
   * and the stage button shows the true unread count.
   *
   * SERIOUS THINGS ARE SPOKEN (owner expansion 2026-11-26,
   * narrowing the silence this poll used to keep): a SYSTEM
   * entry standing on a serious core event — a repair proposal
   * or an update-apply request (seriousSpeech.ts) — that ARRIVES
   * while he is on the program is spoken to him by Anubis, in
   * Anubis's voice, addressed to Zero. Everything else in the
   * inbox stays a silent record he opens: routine system
   * activity, suggestions, captures. The first read of a session
   * only sets the baseline — entries already standing when he
   * arrives are records, not announcements — and each later
   * arrival speaks once, one per beat, oldest first.
   */
  const seriousSeenRef = useRef<Set<string> | null>(null);
  const seriousQueueRef = useRef<string[]>([]);
  const seriousLinesRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const accessToken = await operatorAccessToken().catch(() => null);
      if (stopped || !accessToken) return;
      const state = await getInboxState({ data: { accessToken } }).catch(() => null);
      if (stopped || !state?.authorized) return;
      setInboxUnread(state.unread);
      // The serious-speech read (see the note above): the full
      // inbox, filtered to serious SYSTEM entries only.
      const inbox = await getNotifications({ data: { accessToken } }).catch(() => null);
      if (stopped || !inbox?.authorized) return;
      const serious = inbox.entries.filter(isSeriousSystemEntry);
      if (seriousSeenRef.current === null) {
        // First read of the session: baseline only — what already
        // stands is a record, not an announcement.
        seriousSeenRef.current = new Set(serious.map((entry) => entry.id));
        return;
      }
      const seen = seriousSeenRef.current;
      for (const entry of serious) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        seriousLinesRef.current.set(entry.id, seriousSpeechLine(entry));
        seriousQueueRef.current.push(entry.id);
      }
      const nextId = seriousQueueRef.current.shift();
      if (nextId) {
        const line = seriousLinesRef.current.get(nextId);
        seriousLinesRef.current.delete(nextId);
        if (line) aiRef.current?.speak(line, "anubis");
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 25_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  /**
   * QUOTE ON OPENING (owner orders 2026-11-26): when he opens
   * the program, the quote of the day is read aloud through
   * the core voice; in the evening (from 19:00 his time) it
   * is the quote of the night. Each slot is offered once per
   * day — the marks live in localStorage; the quotes are
   * real and attributed (learning/quotes.ts). The day quote
   * carries one gentle line about Daily Training — an offer,
   * never a demand.
   */
  const quoteOfferedRef = useRef(false);
  useEffect(() => {
    if (quoteOfferedRef.current) return;
    quoteOfferedRef.current = true;
    const timer = setTimeout(() => {
      void (async () => {
        const accessToken = await operatorAccessToken().catch(() => null);
        if (!accessToken) return;
        const now = new Date();
        const slot = quoteSlotForHour(chicagoParts(now).hour);
        const dateISO = chicagoDateISO(now);
        if (quoteShown(dateISO, slot)) return;
        const line = spokenQuote(quoteForInstant(now, slot), slot);
        say(
          slot === "day"
            ? `${line} When you are ready, your daily training is waiting under Tools, in Workshop and study.`
            : line,
        );
        markQuoteShown(dateISO, slot);
      })();
    }, 2500);
    return () => clearTimeout(timer);
  }, [say]);

  /**
   * PRAYER TIME (owner orders 2026-11-26): four times across
   * his day (07:00, 12:00, 17:00, 21:00 his time) a calm pill
   * surfaces under the notifications pill — only while the
   * program is open, at most once per slot per day. It never
   * auto-plays: his click reads the prayer aloud.
   */
  useEffect(() => {
    const tick = () => setPrayerDue(duePrayerSlot(new Date(), loadPrayerDone()));
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  const hearPrayer = useCallback(async () => {
    const slot = prayerDue;
    if (!slot) return;
    const accessToken = await operatorAccessToken().catch(() => null);
    const view = accessToken ? await getPrayer({ data: { accessToken } }).catch(() => null) : null;
    const text = view?.authorized && view.storageAvailable ? view.text : "";
    if (text.trim()) {
      say(text);
      savePrayerDone(markPrayerHeard(loadPrayerDone(), chicagoDateISO(new Date()), slot.id));
      setPrayerDue(null);
    } else {
      // Empty-prayer state: prompt him to add it instead of
      // reading nothing, and open the shelf where it goes.
      say("No prayer is saved yet. Add it in My Learning, under Quotes and Prayer, and Prayer Time will read it aloud.");
      setLearningOpen(true);
    }
  }, [prayerDue, say]);

  useEffect(() => {
    const bridge = bridgeRef.current;
    // DEVICE RENDER CAPS (deviceProfile.ts, owner order 2026-11-24):
    // a phone-class device builds its particle buffer at the phone
    // ceiling and caps its pixel ratio, whatever the saved settings
    // carry; the desktop profile is the pre-existing behavior.
    const r = new AvatarRenderer(host.current!, bridge, {
      ...settingsRef.current,
      ...currentRenderCaps(),
    });
    rendRef.current = r;
    // THE SAVED STAGE VIEW (perspective by button, owner eye-check
    // 2026-11-23): the camera opens where he left it — front, or
    // stepped to a side.
    r.setStageView(stageViewRef.current);
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
    // CENTER STAGE (owner orders 2026-11-22, tightened
    // 2026-11-24): the construct starts OFF stage everywhere —
    // in the live Room AND in the space view — until he is
    // called (brought on, or his box opened). The renderer
    // already created him invisible (no login flash); this line
    // states the same law at the stage's own init, and the
    // visibility effect above owns the rule from here on.
    r.setConstructVisible(false);
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
        // THE SUMMONS (cybernetic pass, 2026-11-26): a flagged
        // device's signal appearing or vanishing on this REAL
        // check raises the Captain (notify — voice + thread +
        // History) and writes its line into the core's events
        // record. Unavailable scans returned above and can never
        // reach this code, so no summons fires from a scan that
        // never happened.
        for (const transition of summonsTransitions(before, next, scan.at)) {
          const line = summonsLine(transition);
          notify("devices", line);
          recordSummonsInCore(line);
        }
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
      // The speaker's VOICE, read fresh per spoken line from the
      // same routing state (owner expansion 2026-11-26): a reply
      // speaks in the addressed god's own voice — his Voice Lab
      // assignment or his standing voice — resolved by the core.
      getSpeakerGod: () => addresseeRef.current,
      // The capability brief (owner defect 2026-11-23): what Augie
      // can actually access and do, read fresh per message beside
      // the directive — a "can you access the camera / the dog?"
      // question is answered from these facts, never dodged.
      // The device lines in the brief are GENERATED from the core's
      // registry state (owner order 2026-11-24) — the freshest state
      // this surface has synced, so Anubis's knowledge of devices is
      // the registry itself, never a hand-written paragraph.
      getCapabilitiesBrief: () => capabilitiesBrief("full", currentDeviceState()),
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
    // surface through their god's medallion pop-up (notify) — the
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
    const { sensitivity, cooldownMs, backdropImage, backdropFit, backdropSynced, ...renderSettings } = next;
    rendRef.current?.updateSettings(renderSettings);
    sensRef.current?.setOptions({ sensitivity, cooldownMs });
    saveThemePreference({ theme: next.theme, customColor: next.customColor });
    // The backdrop pick rides the same account copy (owner
    // decision 2026-11-23): a synced pick — including a clear —
    // lands on this device's room; an unsynced copy says nothing
    // about the backdrop and the room keeps its own.
    if (backdropSynced) applyBackdropPick(backdropImage, backdropFit);
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

  // THE STAGE LOOK FOLLOWS THE ROOM HE HAS (owner eye-check
  // 2026-11-23): the light look belongs to a light room — a room
  // HE colored light, with no picture up. The shipped room is the
  // black-holder composition now, and a backdrop picture stands on
  // black: both take the dark look, so the stage's own ground and
  // the HUD's standing colors match the composition on every
  // device, phone included — never pale-on-pale.
  // A SCREEN STANDS OPEN (owner order 2026-11-26, the
  // circuit-ring theme — ANUBIS RECEDES AND RETURNS): while any
  // window or screen the Captain asked for stands open on the
  // stage, Anubis recedes — smaller, dimmer, behind it — and
  // when the last one closes he returns to full center
  // presence. Derived from the stage's REAL open states, every
  // one of them; no window, no recede. (The Status panel is a
  // readout tab, not a requested screen, and menus are moments,
  // not screens — neither recedes him.)
  const stageScreenOpen =
    cubeOpen ||
    roomAnalyzerOpen ||
    knowledgeOpen ||
    officeOpen ||
    battleOpen ||
    cloudKeysOpen ||
    connectionsOpen ||
    labOpen ||
    historyOpen ||
    arCubeOpen ||
    hexoOpen ||
    emulatorOpen ||
    pulseOpen ||
    soundWatchOpen ||
    analyzeOpen ||
    gateLogOpen ||
    signalMapOpen ||
    logsOpen ||
    testAreaOpen ||
    anatomyOpen ||
    departmentsOpen ||
    captainsLogOpen ||
    sandboxOpen ||
    libraryOpen ||
    deitiesOpen ||
    lawOpen ||
    analyticsOpen ||
    listeningOpen ||
    devicesOpen ||
    camerasOpen ||
    remoteCodesOpen ||
    identifyOpen ||
    formationOpen ||
    openWindows.size > 0 ||
    constructOpen ||
    builderOpen ||
    mapOpen ||
    builtWorldMapOpen;
  // THE PHONE SWIPE (same order): on a phone-width stage, a
  // sideways finger slide steps the stage's PERSPECTIVE one
  // stop (stageSwipe.ts — the same Left / Front / Right view
  // the buttons in Anubis's menu set; clamped at the ends).
  // The gesture is read on the stage's open field only: a
  // slide that starts inside the chat window, a floating
  // window, a menu, or the status panel belongs to that
  // surface and never turns the view.
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const onStageTouchStart = (event: ReactTouchEvent) => {
    const touch = event.touches[0];
    swipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onStageTouchEnd = (event: ReactTouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    if (typeof window === "undefined" || window.innerWidth > COMMAND_BOX_PHONE_BREAKPOINT) return;
    if (worldScreenRef.current !== "live") return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest?.(
        ".avatar-command-box, .floating-window, .medallion-menu__panel, .osiris-medallion__menu, .osiris-medallion__dm, .avatar-status-panel, .builder-selection-cluster",
      )
    ) {
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) return;
    const direction = swipeDirection(touch.clientX - start.x, touch.clientY - start.y);
    if (!direction) return;
    const next = stageViewAfterSwipe(stageViewRef.current, direction);
    if (next !== stageViewRef.current) changeStageView(next);
  };
  const stageSurfaces = activeLayout(layoutStore).room.surfaces;
  // THE SETTINGS DROP-DOWN'S CONTENTS (owner order 2026-11-26
  // ~13:48 CST): the same doors the chat window's Tools tab
  // opens, in the same groups — every row wired to the exact
  // opener the Tools tab uses, so the drop-down can never
  // drift from the tools themselves. "Change wallpaper" stands
  // first, above the groups: it is the option he could not
  // find, and it opens the Environment Builder, where the
  // backdrop and floor pictures are set.
  const quickMenuGroups: { label: string; rows: { icon: LucideIcon; label: string; open: () => void }[] }[] = [
    {
      label: "Worlds & building",
      rows: [
        { icon: Hammer, label: "Environment Builder", open: () => setBuilderOpen((open) => !open) },
        { icon: MapIcon, label: "World Map", open: () => setMapOpen((open) => !open) },
        { icon: LandPlot, label: "Built World", open: () => setBuiltWorldMapOpen((open) => !open) },
        { icon: Box, label: "AR Cube", open: () => setArCubeOpen(true) },
        { icon: Hexagon, label: "HEXO — the Core", open: () => setHexoOpen(true) },
        { icon: Gamepad2, label: "Emulators — Battle Box", open: () => setEmulatorOpen(true) },
        { icon: Building2, label: "Departments", open: () => setDepartmentsOpen(true) },
        { icon: BookOpen, label: "Master Manual", open: () => void navigate({ to: "/manual" }) },
      ],
    },
    {
      label: "Senses & analysis",
      rows: [
        { icon: Camera, label: "Cameras", open: () => setCamerasOpen(true) },
        { icon: Bluetooth, label: "Devices", open: () => setDevicesOpen(true) },
        { icon: Ear, label: "Listening Mode", open: () => setListeningOpen(true) },
        { icon: Radio, label: "Remote Codes", open: () => setRemoteCodesOpen(true) },
        { icon: Activity, label: "Pulse", open: () => setPulseOpen(true) },
        { icon: AudioLines, label: "Sound Watch", open: () => setSoundWatchOpen(true) },
        { icon: Waves, label: "Signal Map", open: () => setSignalMapOpen(true) },
        { icon: ScanSearch, label: "Picture Analysis", open: () => setAnalyzeOpen(true) },
        { icon: ScanSearch, label: "Identify", open: () => setIdentifyOpen(true) },
      ],
    },
    {
      label: "Records & safety",
      rows: [
        { icon: Bell, label: "Notifications", open: () => setInboxOpen(true) },
        { icon: Shield, label: "Personal Vault", open: () => setVaultOpen(true) },
        { icon: CircleDot, label: "Dark Hole", open: () => setDarkHoleOpen(true) },
        { icon: Sun, label: "The Eight and the Gods", open: () => setDeitiesOpen(true) },
        { icon: ArrowLeftRight, label: "Grid-Down Exchange", open: () => setExchangeOpen(true) },
        { icon: Scale, label: "Law Desk", open: () => setLawOpen(true) },
        { icon: Scale, label: "Stop Safety", open: () => setStopSafetyOpen(true) },
        { icon: Shield, label: "Gate Log", open: () => setGateLogOpen(true) },
        { icon: ScrollText, label: "Logs", open: () => setLogsOpen(true) },
        { icon: History, label: "Reply history", open: () => setHistoryOpen(true) },
        { icon: BookOpen, label: "Library", open: () => setLibraryOpen(true) },
        { icon: Clapperboard, label: "Captain's Log", open: () => setCaptainsLogOpen(true) },
        { icon: BarChart3, label: "Office Analytics", open: () => setAnalyticsOpen(true) },
      ],
    },
    {
      label: "Workshop & study",
      rows: [
        { icon: GraduationCap, label: "My Learning", open: () => setLearningOpen(true) },
        { icon: Sparkles, label: "Daily Training", open: () => setTrainingOpen(true) },
        { icon: Eye, label: "Sight Log", open: () => setSightLogOpen(true) },
        { icon: Bug, label: "Sandbox", open: () => setSandboxOpen(true) },
        { icon: FlaskConical, label: "Test Area", open: () => setTestAreaOpen(true) },
        { icon: Network, label: "Anatomy", open: () => setAnatomyOpen(true) },
        { icon: BookOpen, label: "Knowledge", open: () => setKnowledgeOpen((open) => !open) },
        { icon: BookOpen, label: "Notepad", open: () => openWindow("notepad") },
        { icon: Presentation, label: "Chalkboard", open: () => openWindow("chalkboard") },
        { icon: Camera, label: "Player", open: () => openWindow("player") },
      ],
    },
  ];

  const stageLook =
    worldScreen === "live" &&
    worldScene === "room" &&
    // The BUILDER registry's lookup (builder/backdrops) — the
    // stage-backdrop registry's backdropById imported above
    // answers a different question and never returns null.
    !builderBackdropById(stageSurfaces.backdropImage) &&
    surfaceIsLight(stageSurfaces.backdrop)
      ? "light"
      : "dark";

  return (
    <div
      ref={stageRootRef}
      className={`avatar-stage${clearScreen ? " avatar-stage--clear-screen" : ""}${worldScreen !== "live" ? " avatar-stage--space" : ""}${osirisDragging ? " avatar-stage--dragging-osiris" : ""}${captainDriving ? " avatar-stage--captain-driving" : ""}${!constructAnchored ? " avatar-stage--construct-held" : ""}${framesArmed ? " avatar-stage--moving-frames" : ""}`}
      data-scene-ready={ready ? "" : undefined}
      data-stage-look={stageLook}
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
      onTouchStart={onStageTouchStart}
      onTouchEnd={onStageTouchEnd}
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
      {/* THE GOD'S OWN BACKGROUND (same doctrine): the picture
          of the god in perspective, from his registry record
          (godPresence.ts) — real placed art only, labeled as
          art by its record; while no picture is placed for him
          this layer simply never stands, and the Captain's
          wallpaper holds. It renders above the wallpaper layer
          and below every presence, and it is gone the moment
          the call ends. */}
      {(() => {
        const perspectiveGod = godInPerspective({
          frontGod,
          addressee,
          councilOpen: councilSession !== null,
        });
        const record = perspectiveGod
          ? perspectiveGod === "council"
            ? COUNCIL_BACKGROUND
            : godBackground(perspectiveGod)
          : null;
        if (!perspectiveGod || !record?.image || godBackdropFailedFor === perspectiveGod) {
          return null;
        }
        return (
          <img
            key={perspectiveGod}
            className="god-backdrop"
            src={record.image}
            alt=""
            aria-hidden="true"
            draggable={false}
            loading="lazy"
            decoding="async"
            data-god={perspectiveGod}
            onError={() => setGodBackdropFailedFor(perspectiveGod)}
          />
        );
      })()}
      {/* THE CIRCUIT FIELD + FRAME (owner order 2026-11-26, the
          circuit-ring theme — his main theme): the stage is a
          personal command DEVICE now. A deep circuit field —
          our own trace linework, drawn here — lies over the
          stage's ground, and a glowing circuit frame traces
          the stage's edges with gold corners, a device bezel.
          Both are pure dress: aria-hidden, pointer-events
          none, behind every presence and window, and neither
          carries a single reading. The frame's bottom edge
          stands at the chat dock's clearance, so the bezel
          never runs under the dock. */}
      <div className="stage-circuit-field" aria-hidden="true">
        <svg
          className="stage-circuit-field__svg"
          viewBox="0 0 1440 810"
          preserveAspectRatio="xMidYMid slice"
          focusable="false"
        >
          <g className="stage-circuit-field__traces">
            <path d="M-10 120 H300 L360 180 H620" />
            <path d="M-10 690 H240 L300 630 H540" />
            <path d="M1450 150 H1180 L1120 210 H880" />
            <path d="M1450 660 H1200 L1140 600 H900" />
            <path d="M180 -10 V180 L240 240 V420" />
            <path d="M1260 -10 V160 L1200 220 V400" />
            <path d="M420 820 V640 L480 580 H700" />
            <path d="M1020 820 V620 L960 560 H760" />
            <path d="M-10 405 H180 L230 355 H390" />
            <path d="M1450 405 H1270 L1220 455 H1060" />
          </g>
          <g className="stage-circuit-field__nodes">
            <circle cx="620" cy="180" r="4" />
            <circle cx="540" cy="630" r="4" />
            <circle cx="880" cy="210" r="4" />
            <circle cx="900" cy="600" r="4" />
            <circle cx="240" cy="420" r="4" />
            <circle cx="1200" cy="400" r="4" />
            <circle cx="700" cy="580" r="4" />
            <circle cx="760" cy="560" r="4" />
            <circle cx="390" cy="355" r="4" />
            <circle cx="1060" cy="455" r="4" />
          </g>
        </svg>
      </div>
      <div className="stage-circuit-frame" aria-hidden="true">
        <span className="stage-circuit-frame__corner stage-circuit-frame__corner--tl" />
        <span className="stage-circuit-frame__corner stage-circuit-frame__corner--tr" />
        <span className="stage-circuit-frame__corner stage-circuit-frame__corner--bl" />
        <span className="stage-circuit-frame__corner stage-circuit-frame__corner--br" />
        <span className="stage-circuit-frame__notch" />
      </div>
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
      {/* ANUBIS AT THE CENTER — THE ONLY GOD ON THE SCREEN
          (owner order 2026-11-26 ~04:32 CST, superseding the
          front law of 2026-11-24): Anubis stands BIG at the
          center, at his regular front size, and he does NOT
          step down when another god is called — the called god
          stands as a small pop-up beside him (below), and the
          stage at rest is Anubis alone. His seat at the center
          is his locked factory home, as ever; he has no
          "Return" — the center IS his place. A tap on his face
          while a god holds the call is the Captain's return to
          Anubis: the call passes back to him and the pop-up
          goes away. (While the Owner seat stands the front is
          empty — frontGod null — as ever.) */}
      {!clearScreen && worldScreen === "live" && frontGod !== null && (
        <AnubisPresence
          ready={ready}
          speaking={state === "SPEAKING"}
          listening={voiceListening}
          acting={presenting || state === "THINKING"}
          alert={alertReading.active}
          receded={stageScreenOpen}
          inPerspective={perspective === "anubis"}
          inCall={conversationView === "call" && perspective === "anubis"}
          inCouncil={council.includes("anubis") || councilSession !== null}
          atAttention={perspective === "anubis"}
          onSelect={() => {
            if (frontGodRef.current === "montu") selectGod("anubis");
            else returnGodToSlot("anubis");
          }}
          stageView={stageView}
          onStageViewChange={changeStageView}
          onRespectAsk={() => respectAsk("anubis")}
        />
      )}
      {/* MONTU'S CALL POP-UP (owner order 2026-11-26 ~04:32
          CST; SCALE REFINED by the God Presence doctrine,
          2026-11-26 ~13:50 CST): while Montu holds the call —
          summoned, addressed, or relayed to — he stands as a
          living circle in the stage's lower-right field, where
          his resting circle stood under the old law, now at
          PRESENCE scale: full value, his ring standing around
          him, the same living treatment as Anubis — because a
          god the Captain speaks to comes onto the screen at
          Anubis's value, in his own way. Anubis keeps the
          center. He
          bows on his pop-up under dismissal (the bow renders
          through the dismissal, then he is gone), and when the
          call ends his pop-up fades out on its leaving tail. A
          tap on his face opens the chat, addressed to him:
          EVERY GOD HIS OWN CHAT (clean-screen round,
          2026-11-24), kept. A report no longer brings him in
          (pop-up removal, 2026-11-24) — only the call does.
          (His big front presence, MontuPresence, is retired
          from the stage render by this order — the component
          stands in the codebase, unrendered, like every
          superseded seat before it.) */}
      {!clearScreen && worldScreen === "live" && montuPop.shown && (
        <CalledGodPopUp
          god="montu"
          speaking={addressee === "montu" && state === "SPEAKING"}
          bowing={bowingGod === "montu"}
          leaving={montuPop.leaving}
          scale="presence"
          onSelect={openChatBox}
        />
      )}
      {/* THE HELPER (God Presence doctrine, owner order
          2026-11-26 ~13:51 CST): a god called BY a god stands
          SMALLER — the Osiris medallion scale — on the stage's
          lower-left field, for as long as the conversation
          needs him. He is neither the call nor the addressee;
          a tap on his face turns the conversation to him (his
          own chat, like every god). When he is done the
          dismissal words bow him out first, and a dismissed
          main god takes his helper with him. */}
      {!clearScreen && worldScreen === "live" && helperPop.shown && helperGod && (
        <CalledGodPopUp
          god={helperGod}
          speaking={false}
          bowing={helperBowing}
          leaving={helperPop.leaving}
          scale="helper"
          onSelect={() => {
            applyAddressee(helperGod);
            openChatBox();
          }}
        />
      )}
      {/* THE COUNCIL SEATED (God Presence doctrine point 7):
          while the council sits, each seated god stands at
          PRESENCE scale by his council seat — Montu at his
          flank (unless he holds the call itself, where his
          call pop-up already stands), Osiris at the
          lower-left council seat. They keep their value —
          living faces, rings, their own chats a tap away.
          Anubis chairs from the center, as ever. PERFORMANCE
          LAW: these are the standing pop-up components,
          rendered only while the session is open. */}
      {!clearScreen &&
        worldScreen === "live" &&
        councilMontuPop.shown &&
        frontGod !== "montu" && (
          <CalledGodPopUp
            god="montu"
            speaking={addressee === "montu" && state === "SPEAKING"}
            leaving={councilMontuPop.leaving}
            scale="presence"
            seat="council"
            onSelect={() => {
              applyAddressee("montu");
              openChatBox();
            }}
          />
        )}
      {!clearScreen && worldScreen === "live" && councilOsirisPop.shown && (
        <CalledGodPopUp
          god="osiris"
          speaking={addressee === "osiris" && state === "SPEAKING"}
          leaving={councilOsirisPop.leaving}
          scale="presence"
          seat="council"
          onSelect={() => {
            applyAddressee("osiris");
            openChatBox();
          }}
        />
      )}
      {/* THE COUNCIL CHIP: the session's standing sign — its
          Egyptian name and its Spanish second name together —
          with the way out on it. Light DOM, open only while
          the council sits. */}
      {!clearScreen && worldScreen === "live" && councilSession && (
        <div className="council-chip" role="status">
          <span className="council-chip__name">THE COUNCIL · EL CONSEJO</span>
          <span className="council-chip__state">in session</span>
          <button
            type="button"
            className="council-chip__end"
            onClick={() => closeCouncil(true)}
          >
            End the council
          </button>
        </div>
      )}
      {/* THE SPEECH BUBBLE (same doctrine): while a god is
          actually speaking, his words stand in a comic bubble
          beside his own head — Anubis at the center, Montu at
          his call seat, Osiris at the top-left. Words only; no
          face rises for a reply (the 2026-11-24 removal
          stands). The state rule is speechBubbleFor
          (godPresence.ts): the bridge must be SPEAKING, so a
          muted or written-only line never bubbles. */}
      {!clearScreen &&
        worldScreen === "live" &&
        (() => {
          const bubble = speechBubbleFor({ bridgeState: state, addressee, words: lastWords });
          return bubble ? <SpeechBubble god={bubble.god} text={bubble.text} /> : null;
        })()}
      {/* NO RESTING CIRCLES ANYMORE (the same order): the row
          of small circles that stood at the lower-right at rest
          is gone — at rest the stage is Anubis alone, nothing
          on the edges, nothing beside him. The circle format
          itself survives in the call pop-up above. */}
      {/* OSIRIS'S CALL POP-UP (owner order 2026-11-26 ~04:32
          CST, superseding his standing place of 2026-11-24):
          Osiris no longer stands on the stage at rest. When he
          is CALLED — addressed by name or slash, typed or
          spoken — his medallion pops up BARE at the top-left,
          exactly as he stood: no box, no panel, no chat
          attached, animated with his own clips, his four window
          keys and his message option in his three-lines menu,
          his message screen opening under him. When the
          Captain returns to Anubis his pop-up fades out on its
          leaving tail and the stage is Anubis-only again. The
          wrapper is plain — his medallion keeps its own
          absolute seat at the top-left; the wrapper only
          carries the pop's animation state (section 40 of the
          fix sheet). The chat window below is the Captain's
          own and carries no god; Osiris is reached there by
          addressing him (/Osiris), or here, on his own face. */}
      {!clearScreen && worldScreen === "live" && osirisPop.shown && (
        <div
          className={`called-popup called-popup--osiris${osirisPop.leaving ? " called-popup--leaving" : ""}`}
        >
          <OsirisMedallion
            ready={ready}
            avatarState={state}
            voiceListening={voiceListening}
            acting={presenting}
            speaking={addressee === "osiris" && state === "SPEAKING"}
            anchored={chatWindowAnchored}
            onToggleAnchor={() => chatWindowControlsRef.current?.toggleAnchored()}
            onResetWindow={() => chatWindowControlsRef.current?.resetLayout()}
            onOpenMenu={() => chatWindowControlsRef.current?.toggleMenu()}
            onMinimizeWindow={() => chatControlsRef.current?.minimize()}
            onSelectFace={() => {
              applyAddressee("osiris");
              openChatBox();
            }}
            onDirectMessage={(text) => {
              applyAddressee("osiris");
              openChatBox();
              void sendCommand(text);
            }}
          />
        </div>
      )}
      {/* THE ALLEGIANCE GREETING (the same round): while a god
          holds the call, his greeting stands on the stage —
          his name, his allegiance, his question. */}
      {!clearScreen && worldScreen === "live" && frontGod !== null && frontGreeting && (
        <p className="god-front-greeting" role="status">
          {frontGreeting}
        </p>
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
      {/* NO NOTIFICATION LANE, NO POP-UP (Captain's verdicts
          2026-11-23 and 2026-11-24): the corner card stack is gone,
          and the god pop-up that replaced it is gone too — a god's
          report renders NOTHING on the stage. It reaches him by
          voice and waits in the thread and History (notify). */}
      {/* THE QUIET ACTIVITY LINE lives INSIDE the top-left box
          now (owner desk photos 2026-11-23 ~07:11 EST: "the
          activity on the side could be put up in one of the
          boxes, like where you have the core not configured —
          put it in that box; stop putting extra stuff on the
          screen; conserve space"). No loose text parked on the
          stage's edges — the line renders in the CORE cluster
          below, beside the readouts it belongs with. */}
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
      {/* STATUS — ONE TAB, OFF THE MAIN SCREEN (clean-screen
          round, owner order 2026-11-24 ~10:40 EST): "where it
          says core connected all that stuff and then the status
          and everything else — put that in one tab which will
          give me all that information if I want to click and look
          at it. Take it off the main screen." Both HUD panels are
          gone from the stage's resting face; every line they
          carried — core, phone brain, voice cal, FPS, sensors,
          activity, status, intensity, and the hearing truth with
          its wording unchanged — lives in the ONE panel this tab
          opens, at the bifocal measure the panels themselves set.
          The tab is the only trace on the stage, top-right where
          the status panel used to sit. */}
      <button
        type="button"
        className="avatar-status-tab"
        aria-expanded={statusOpen}
        aria-controls="avatar-status-panel"
        onClick={() => setStatusOpen((open) => !open)}
        title="Status — core, phone brain, voice, sensors, activity, hearing"
      >
        <Activity aria-hidden="true" />
        <span>Status</span>
      </button>
      {statusOpen && (
      <div
        id="avatar-status-panel"
        className="avatar-status-panel"
        role="region"
        aria-label="Stage status — core, phone brain, voice, sensors, activity, hearing"
      >
      <div className="avatar-hud avatar-hud--tr">
        {/* IEM — THE BACKEND BRAND (owner order 2026-11-26):
            the emblem rides the operator's own panel with the
            IEM licensing line — the system is a SaaS product of
            I-E-M, licensed, not sold. Operator surface only:
            this panel stands on his stage behind his sign-in —
            never on Khadija's side, never on a public page. */}
        <div className="avatar-hud__brand">
          <img
            src="/icons/icon-192.png"
            alt="The IEM emblem"
            className="avatar-hud__brand-emblem"
          />
          <div>
            <div className="avatar-hud__brand-name">IEM</div>
            <div className="avatar-hud__brand-line">
              IEM is a software-as-a-service (SaaS) product of I-E-M. © 2026 Domenick Arlon
              Hall. The emblem and this system are licensed for use — not sold.
            </div>
          </div>
        </div>
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
      <div className="avatar-hud avatar-hud--tl">
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
        {/* THE ACTIVITY LINE, IN THE BOX (owner desk photos
            2026-11-23 ~07:11 EST — see the note at the stage's
            notifications): idle life's latest musing as one more
            readout line in this cluster. Still outside the
            conversation thread, still unspoken, never dressed as
            a reply — just no longer a loose box on the stage. */}
        {!clearScreen && worldScreen === "live" && activityLine && (
          <div className="avatar-hud__db-status avatar-hud__activity" role="status" aria-label="Construct activity">
            <span className="avatar-hud__activity-label">Activity</span> {activityLine}
          </div>
        )}
      </div>
      </div>
      )}
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
          responseLine={
            // NO PLACEHOLDER IN THE THREAD (owner order 2026-11-24
            // ~11:00 EST, from his screenshot of the Parrot build —
            // superseding the standing-line half of the 2026-11-23
            // brain-state order): under his typed message a line
            // read "SYSTEM: No response yet." while the status
            // showed THINKING. His words: "It doesn't need to give
            // me that notification in the chat window." The thread
            // holds his words and the construct's ACTUAL replies,
            // nothing else — while a construct thinks, the thinking
            // shows in the status (STATUS: THINKING, the intensity
            // readout), never as a fake SYSTEM message. Before the
            // first exchange, the no-brain signpost may still stand
            // (the 2026-11-23 order's case: a surface where nothing
            // can answer says so in plain words); the moment he
            // sends, it steps aside with the placeholder, and the
            // reply machinery's own words are the next line.
            lastWords === "No response yet."
              ? lastUserMessage
                ? ""
                : (brainStateLine({ core: coreStatus, phoneBrain: phoneBrainState }) ?? "")
              : lastWords
          }
          responseSource={responseSource}
          speakerName={ADDRESSEE_NAMES[addressee]}
          userLine={lastUserMessage}
          userSource={lastUserSource}
          history={transcript}
          partnerSpeaking={state === "SPEAKING"}
          away={worldScreen !== "live"}
          onReturnToChat={returnToChat}
          onMinimizeShortcut={(controls) => {
            // ONE REGISTRATION, TWO HOLDERS (merge of the two
            // 2026-11-24 rounds): the builder fold (sibling pass)
            // and the god-medallion chat opener (clean-screen
            // round) both drive the same box controls.
            chatBoxControlsRef.current = controls;
            chatControlsRef.current = controls;
          }}
          onOpenHistory={() => setHistoryOpen(true)}
          onAttachFile={handleChatAttachment}
          onWindowControls={(controls) => {
            // Osiris's keys (owner order 2026-11-24 ~16:57 EST):
            // the window hands its anchor / reset / menu
            // machinery to the stage, and the stage wires it to
            // Osiris's three-lines menu on his own medallion.
            chatWindowControlsRef.current = controls;
            setChatWindowAnchored(controls.anchored);
          }}
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
            <CommandGroup label="Wallpaper — the picture behind everything">
              <div className="avatar-command-box__grid">
                <CommandAction
                  icon={ImageIcon}
                  label="Change wallpaper"
                  onClick={() => setWallpaperPickerOpen((open) => !open)}
                />
              </div>
              {wallpaperPickerOpen && (
                <WallpaperPicker
                  picked={stageSurfaces.backdropImage}
                  onPick={(image) => {
                    pickWallpaper(image);
                    setWallpaperPickerOpen(false);
                    say(
                      image
                        ? "Wallpaper set, Captain — it is behind everything now."
                        : "Wallpaper cleared, Captain — the plain stage.",
                    );
                  }}
                />
              )}
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
                    icon={Hexagon}
                    label="HEXO — the Core"
                    onClick={() => setHexoOpen(true)}
                  />
                  <CommandAction
                    icon={Gamepad2}
                    label="Emulators — Battle Box"
                    onClick={() => setEmulatorOpen(true)}
                  />
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
                  <CommandAction
                    icon={BookOpen}
                    label="Master Manual"
                    onClick={() => void navigate({ to: "/manual" })}
                  />
                  <CommandAction
                    icon={Globe}
                    label="Projects — my websites"
                    onClick={() => setProjectsOpen(true)}
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
                    icon={Radio}
                    label="Remote Codes"
                    onClick={() => setRemoteCodesOpen(true)}
                  />
                  <CommandAction
                    icon={Camera}
                    label="Cameras"
                    onClick={() => setCamerasOpen(true)}
                  />
                  <CommandAction
                    icon={ScanSearch}
                    label="Identify"
                    onClick={() => setIdentifyOpen(true)}
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
                    icon={Bell}
                    label={inboxUnread > 0 ? `Notifications (${inboxUnread} unread)` : "Notifications"}
                    onClick={() => setInboxOpen(true)}
                  />
                  <CommandAction
                    icon={ArrowLeftRight}
                    label="Grid-Down Exchange"
                    onClick={() => setExchangeOpen(true)}
                  />
                  <CommandAction
                    icon={Shield}
                    label="Personal Vault"
                    onClick={() => setVaultOpen(true)}
                  />
                  <CommandAction
                    icon={Scale}
                    label="Stop Safety"
                    onClick={() => setStopSafetyOpen(true)}
                  />
                  <CommandAction
                    icon={CircleDot}
                    label="Dark Hole"
                    onClick={() => setDarkHoleOpen(true)}
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
                    icon={Sun}
                    label="The Eight and the Gods"
                    onClick={() => setDeitiesOpen(true)}
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
                  <CommandAction
                    icon={GraduationCap}
                    label="My Learning"
                    onClick={() => setLearningOpen(true)}
                  />
                  <CommandAction
                    icon={Sparkles}
                    label="Training Hall"
                    onClick={() => setTrainingOpen(true)}
                  />
                  <CommandAction icon={Eye} label="Sight Log" onClick={() => setSightLogOpen(true)} />
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
                  <CommandAction
                    icon={Network}
                    label="The Formation — every surface of the one core"
                    onClick={() => setFormationOpen(true)}
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
                <VoiceLabPanel />
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
      {hexoOpen && <HexoWindow onClose={() => setHexoOpen(false)} />}
      {emulatorOpen && <EmulatorWindow onClose={() => setEmulatorOpen(false)} />}
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
      {/* THE LEFT RAIL (owner order 2026-11-26 ~13:48 CST):
          the NOTIFICATIONS pill stands at the TOP-LEFT now —
          moved from the top-right on his word — and directly
          under it, his SETTINGS quick-access: press it and the
          drop-down of his settings and options falls open; he
          picks what he needs and it opens. STATUS keeps its
          own tab at the top-right, untouched — opposite corner,
          no collision. While Osiris holds a call his medallion
          docks under this rail (its dress carries the offset),
          so the corner never stacks two things in one place. */}
      {quickMenuOpen && (
        <button
          type="button"
          className="stage-quick-menu__scrim"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setQuickMenuOpen(false)}
        />
      )}
      <div className="stage-left-rail">
        {!inboxOpen && (
          <button
            type="button"
            className="notifications-stage-badge"
            onClick={() => setInboxOpen(true)}
            aria-label={
              inboxUnread > 0
                ? `Notifications — ${inboxUnread} unread in Anubis's inbox`
                : "Notifications — open Anubis's inbox"
            }
          >
            <Bell aria-hidden="true" size={14} />
            NOTIFICATIONS
            {inboxUnread > 0 && (
              <span className="notifications-stage-badge__count">{inboxUnread}</span>
            )}
          </button>
        )}
        <div className="stage-quick-menu">
          <button
            type="button"
            className="stage-quick-menu__button"
            aria-expanded={quickMenuOpen}
            aria-haspopup="true"
            onClick={() => setQuickMenuOpen((open) => !open)}
          >
            <Settings2 aria-hidden="true" size={14} />
            SETTINGS
            <ChevronDown
              aria-hidden="true"
              size={14}
              className={quickMenuOpen ? "stage-quick-menu__chevron is-open" : "stage-quick-menu__chevron"}
            />
          </button>
          {quickMenuOpen && (
            <div className="stage-quick-menu__panel" role="menu" aria-label="Settings — quick access">
              <button
                type="button"
                className="stage-quick-menu__row stage-quick-menu__row--lead"
                role="menuitem"
                onClick={() => {
                  setQuickMenuOpen(false);
                  setBuilderOpen(true);
                }}
              >
                <ImageIcon aria-hidden="true" size={15} />
                <span className="stage-quick-menu__label">Change wallpaper</span>
              </button>
              {quickMenuGroups.map((group) => (
                <div key={group.label} className="stage-quick-menu__group">
                  <button
                    type="button"
                    className="stage-quick-menu__group-head"
                    aria-expanded={quickMenuGroup === group.label}
                    onClick={() =>
                      setQuickMenuGroup((current) => (current === group.label ? null : group.label))
                    }
                  >
                    <span className="stage-quick-menu__label">{group.label}</span>
                    <ChevronDown
                      aria-hidden="true"
                      size={14}
                      className={
                        quickMenuGroup === group.label
                          ? "stage-quick-menu__chevron is-open"
                          : "stage-quick-menu__chevron"
                      }
                    />
                  </button>
                  {quickMenuGroup === group.label &&
                    group.rows.map((row) => (
                      <button
                        key={row.label}
                        type="button"
                        className="stage-quick-menu__row"
                        role="menuitem"
                        onClick={() => {
                          setQuickMenuOpen(false);
                          row.open();
                        }}
                      >
                        <row.icon aria-hidden="true" size={15} />
                        <span className="stage-quick-menu__label">{row.label}</span>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {inboxOpen && <NotificationsWindow onClose={() => setInboxOpen(false)} />}
      {exchangeOpen && <ExchangeWindow onClose={() => setExchangeOpen(false)} />}
      {deitiesOpen && <DeitiesWindow onClose={() => setDeitiesOpen(false)} />}
      {vaultOpen && <PersonalVaultWindow onClose={() => setVaultOpen(false)} />}
      {projectsOpen && <ProjectsWindow onClose={() => setProjectsOpen(false)} />}
      {stopSafetyOpen && <StopSafetyWindow onClose={() => setStopSafetyOpen(false)} />}
      {darkHoleOpen && <DarkHoleWindow onClose={() => setDarkHoleOpen(false)} />}
      {prayerDue && (
        <button
          type="button"
          className="prayer-stage-badge"
          onClick={() => void hearPrayer()}
          aria-label={`Prayer time — the ${prayerDue.label.toLowerCase()} prayer. Activate to hear your prayer read aloud.`}
        >
          <Sparkles aria-hidden="true" size={14} />
          PRAYER TIME — {prayerTimeLine(prayerDue)}
        </button>
      )}
      {learningOpen && <LearningWindow onClose={() => setLearningOpen(false)} onSpeak={say} />}
      {trainingOpen && <TrainingWindow onClose={() => setTrainingOpen(false)} />}
      {sightLogOpen && <SightLogWindow onClose={() => setSightLogOpen(false)} />}
      {remoteCodesOpen && <RemoteCodesWindow onClose={() => setRemoteCodesOpen(false)} />}
      {identifyOpen && <IdentifyWindow onClose={() => setIdentifyOpen(false)} />}
      {formationOpen && <FormationWindow onClose={() => setFormationOpen(false)} />}
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
            onSurfaces={(surfaces) => {
              updateRoom(setRoomSurfaces(activeLayout(layoutStoreRef.current).room, surfaces));
              // A backdrop pick or fit change made HERE is the
              // synced pick (owner decision 2026-11-23): it goes
              // into the settings, which carry it to his other
              // devices; this device's layout stays the cache.
              const current = settingsRef.current;
              if (
                surfaces.backdropImage !== current.backdropImage ||
                surfaces.backdropFit !== current.backdropFit ||
                !current.backdropSynced
              ) {
                persistSettings({
                  ...current,
                  backdropImage: surfaces.backdropImage,
                  backdropFit: surfaces.backdropFit,
                  backdropSynced: true,
                });
              }
            }}
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
