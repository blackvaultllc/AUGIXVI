/**
 * DEVICE CORE STATE — the one shape the device system keeps in the
 * CORE (owner order 2026-11-24: Anubis's full device-setup ability).
 *
 * Before this module, the registry, the command bindings, and the
 * command log lived only in one browser's localStorage: the core
 * knew nothing, Anubis could fire nothing, and the dog's card and
 * control grant existed nowhere in code. Now the core holds the
 * state — this shape, in a file under ~/.local/share/augie/ on the
 * core machine (deviceStore.server.ts) — and every surface reads
 * and writes through it. The browser's localStorage remains as a
 * per-surface working cache that syncs with the core; it is no
 * longer the only home.
 *
 * ONE CONTROL MAP: a device's commands come from two authoring
 * surfaces over ONE map — the profile bound to it, and the payload-
 * carrying entries of its registry control map. stateCommandsFor()
 * is the single merge every sender (the Captain's panel, Anubis's
 * tools) reads, so the two can never drift apart again.
 *
 * This module is pure (no node, no DOM) — the server store, the
 * client sync, the construct tools, and the tests all share it.
 */
import {
  DEVICES_STORAGE_KEY,
  controlMapCommands,
  profileFromControlMap,
  sanitizeProfile,
  type DeviceProfile,
} from "./deviceRegistry";
import {
  BUILTIN_COMMAND_PROFILES,
  WEPWAWET_DOG_PROFILE,
  sanitizeCommandProfile,
  type DeviceCommand,
  type DeviceCommandProfile,
} from "./commandProfiles";
import {
  COMMAND_BINDINGS_KEY,
  COMMAND_LOG_KEY,
  MAX_COMMAND_LOG,
  allCommandProfiles,
  bindingCommands,
  resolveBindingProfile,
  sanitizeBinding,
  sanitizeLogEntry,
  type CommandLogEntry,
  type DeviceCommandBinding,
} from "./commandModule";

/* ------------------------------ the shape ------------------------------ */

/**
 * A Permission Law flag change ANUBIS asked for. The construct
 * never writes the flags themselves — a request lands here, the
 * stage surfaces it to the Captain, and only his Confirm applies
 * it (applyFlagRequest). Denied and applied requests stay in the
 * list as the record.
 */
export type DeviceFlagRequest = {
  id: string;
  deviceId: string;
  deviceName: string;
  /** The flag values Anubis proposes. Absent = leave as-is. */
  ownerConfirmed?: boolean | undefined;
  controlGranted?: boolean | undefined;
  /** Why Anubis asks, in its own words. */
  reason: string;
  at: number;
  status: "pending" | "applied" | "denied";
};

export type DeviceCoreState = {
  version: 1;
  registry: DeviceProfile[];
  bindings: Record<string, DeviceCommandBinding>;
  /** Standalone custom profiles (construct-authored, or the
   *  Captain's saved sets not tied to one binding). Builtin
   *  profiles are code seeds — effectiveProfiles() lays them under
   *  this list, so the store starts from the seeds and grows. */
  profiles: DeviceCommandProfile[];
  log: CommandLogEntry[];
  flagRequests: DeviceFlagRequest[];
  updatedAt: number;
};

export function emptyDeviceCoreState(): DeviceCoreState {
  return {
    version: 1,
    registry: [],
    bindings: {},
    profiles: [],
    log: [],
    flagRequests: [],
    updatedAt: 0,
  };
}

/* --------------------------- the dog, seeded --------------------------- */

/** The registry id of the seeded dog — device #1 in the core. */
export const WEPWAWET_DEVICE_ID = "wepwawet";

/** When the Captain granted Augie control of this dog (2026-11-23). */
const WEPWAWET_GRANT_AT = Date.parse("2026-11-23T12:00:00Z");

/** Commands proven on the real dog, watched by the Captain (2026-11-24). */
const WEPWAWET_PROVEN_COMMANDS = new Set(["stop", "forward", "back"]);

/**
 * The dog's registry card as a SEED: before this build the card and
 * its grant lived only in one browser's localStorage — lose that
 * browser and the grant was gone. The seed carries what the record
 * already states (manual, cmdmod-wepwawet): owner-confirmed and
 * control granted by the Captain on 2026-11-23, bound to the dog
 * profile at Augie's AppID. Its control map is generated FROM the
 * profile's commands — one map, two faces — so the registry card
 * and the command set are the same data from birth.
 */
export function wepwawetSeedProfile(): DeviceProfile {
  return {
    id: WEPWAWET_DEVICE_ID,
    displayName: "Wepwawet",
    kind: "other",
    transport: "ble",
    externalId: "",
    ownerConfirmed: true,
    controlGranted: true,
    presence: "unknown",
    presenceEvents: [],
    protocol: "One-way BLE advertising broadcasts — the FENG MA family protocol; no connection, no pairing",
    controls: WEPWAWET_DOG_PROFILE.commands.map((c) => ({
      id: c.id,
      label: c.name,
      kind: "command" as const,
      detail: c.help,
      verified: WEPWAWET_PROVEN_COMMANDS.has(c.id),
      ...(c.payload.kind === "ble-broadcast" ? { payload: c.payload } : {}),
    })),
    source: "manual",
    declaredServices: [],
    capabilities: [
      "Augie can drive him by Bluetooth broadcast: Stop, movement, tricks, the eight feeding items, light, and his built-in sounds",
    ],
    limitations: [
      "He never answers back — no battery level, no sensor, no state can be read from him.",
      "Augie cannot speak words through him — he plays only his own built-in sounds and songs.",
      "The protocol has no authentication — anyone in Bluetooth range with the protocol could command him (the vendor's design).",
    ],
    batteryLevel: null,
    measured: {},
    firstSeen: WEPWAWET_GRANT_AT,
    lastSeen: WEPWAWET_GRANT_AT,
  };
}

export function wepwawetSeedBinding(): DeviceCommandBinding {
  return {
    deviceId: WEPWAWET_DEVICE_ID,
    profileId: WEPWAWET_DOG_PROFILE.id,
    address: "A947C15E",
  };
}

/** The core's first state: the dog, device #1, with his grant. */
export function seedDeviceCoreState(): DeviceCoreState {
  return {
    version: 1,
    registry: [wepwawetSeedProfile()],
    bindings: { [WEPWAWET_DEVICE_ID]: wepwawetSeedBinding() },
    profiles: [],
    log: [],
    flagRequests: [],
    updatedAt: WEPWAWET_GRANT_AT,
  };
}

/* ----------------------------- sanitizing ------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

const MAX_FLAG_REQUESTS = 100;

export function sanitizeFlagRequest(v: unknown): DeviceFlagRequest | null {
  if (!isRecord(v)) return null;
  if (typeof v["id"] !== "string" || typeof v["deviceId"] !== "string") return null;
  if (typeof v["at"] !== "number") return null;
  const status = v["status"];
  return {
    id: v["id"].slice(0, 80),
    deviceId: v["deviceId"].slice(0, 80),
    deviceName: typeof v["deviceName"] === "string" ? v["deviceName"].slice(0, 120) : "",
    ownerConfirmed: typeof v["ownerConfirmed"] === "boolean" ? v["ownerConfirmed"] : undefined,
    controlGranted: typeof v["controlGranted"] === "boolean" ? v["controlGranted"] : undefined,
    reason: typeof v["reason"] === "string" ? v["reason"].slice(0, 500) : "",
    at: v["at"],
    status: status === "applied" || status === "denied" ? status : "pending",
  };
}

export function sanitizeDeviceCoreState(v: unknown): DeviceCoreState {
  if (!isRecord(v)) return emptyDeviceCoreState();
  const registry = Array.isArray(v["registry"])
    ? v["registry"].map(sanitizeProfile).filter((p): p is DeviceProfile => p !== null)
    : [];
  const bindings: Record<string, DeviceCommandBinding> = {};
  if (isRecord(v["bindings"])) {
    for (const value of Object.values(v["bindings"])) {
      const binding = sanitizeBinding(value);
      if (binding) bindings[binding.deviceId] = binding;
    }
  }
  const profiles = Array.isArray(v["profiles"])
    ? v["profiles"]
        .map(sanitizeCommandProfile)
        .filter((p): p is DeviceCommandProfile => p !== null)
        .filter((p) => !BUILTIN_COMMAND_PROFILES.some((b) => b.id === p.id))
    : [];
  const log = Array.isArray(v["log"])
    ? v["log"]
        .map(sanitizeLogEntry)
        .filter((e): e is CommandLogEntry => e !== null)
        .slice(-MAX_COMMAND_LOG)
    : [];
  const flagRequests = Array.isArray(v["flagRequests"])
    ? v["flagRequests"]
        .map(sanitizeFlagRequest)
        .filter((r): r is DeviceFlagRequest => r !== null)
        .slice(-MAX_FLAG_REQUESTS)
    : [];
  return {
    version: 1,
    registry,
    bindings,
    profiles,
    log,
    flagRequests,
    updatedAt: typeof v["updatedAt"] === "number" ? v["updatedAt"] : 0,
  };
}

/* ------------------------- profiles and commands ------------------------ */

/** Every profile the state can speak: the builtin seeds, the
 *  state's own saved profiles, and profiles carried by bindings. */
export function effectiveProfiles(state: DeviceCoreState): DeviceCommandProfile[] {
  const out = allCommandProfiles(state.bindings);
  for (const profile of state.profiles) {
    if (!out.some((p) => p.id === profile.id)) out.push(profile);
  }
  return out;
}

export function resolveStateProfile(
  state: DeviceCoreState,
  device: DeviceProfile,
): { profile: DeviceCommandProfile; binding: DeviceCommandBinding | null } | null {
  const binding = state.bindings[device.id] ?? null;
  if (binding) {
    const profile = resolveBindingProfile(binding, effectiveProfiles(state));
    if (profile) return { profile, binding };
  }
  const fromMap = profileFromControlMap(device);
  if (fromMap) {
    return {
      profile: fromMap,
      binding: binding ?? {
        deviceId: device.id,
        profileId: fromMap.id,
        address: device.address ?? "",
      },
    };
  }
  return null;
}

/**
 * THE ONE MERGE: the commands a device can be sent — its bound
 * profile's commands first, then its binding's own extras, then
 * the payload-carrying entries of its registry control map that
 * are not already there. Every sender reads commands from here.
 */
export function stateCommandsFor(
  state: DeviceCoreState,
  device: DeviceProfile,
): DeviceCommand[] {
  const resolved = resolveStateProfile(state, device);
  const out: DeviceCommand[] = [];
  const seen = new Set<string>();
  const add = (commands: DeviceCommand[]) => {
    for (const command of commands) {
      if (seen.has(command.id)) continue;
      seen.add(command.id);
      out.push(command);
    }
  };
  if (resolved) {
    add(
      resolved.binding
        ? bindingCommands(resolved.binding, resolved.profile)
        : resolved.profile.commands,
    );
  }
  add(controlMapCommands(device));
  return out;
}

/* --------------------- the browser cache <-> the core -------------------- */

type StorageLike = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
};

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Read the browser cache's three device stores as a core state. */
export function localStateFromStorage(storage: StorageLike | null = defaultStorage()): DeviceCoreState {
  const state = emptyDeviceCoreState();
  if (!storage) return state;
  try {
    const rawRegistry = storage.getItem(DEVICES_STORAGE_KEY);
    if (rawRegistry) {
      const parsed: unknown = JSON.parse(rawRegistry);
      if (Array.isArray(parsed)) {
        state.registry = parsed
          .map(sanitizeProfile)
          .filter((p): p is DeviceProfile => p !== null);
      }
    }
    const rawBindings = storage.getItem(COMMAND_BINDINGS_KEY);
    if (rawBindings) {
      const parsed: unknown = JSON.parse(rawBindings);
      if (isRecord(parsed)) {
        for (const value of Object.values(parsed)) {
          const binding = sanitizeBinding(value);
          if (binding) state.bindings[binding.deviceId] = binding;
        }
      }
    }
    const rawLog = storage.getItem(COMMAND_LOG_KEY);
    if (rawLog) {
      const parsed: unknown = JSON.parse(rawLog);
      if (Array.isArray(parsed)) {
        state.log = parsed
          .map(sanitizeLogEntry)
          .filter((e): e is CommandLogEntry => e !== null)
          .slice(-MAX_COMMAND_LOG);
      }
    }
  } catch {
    // a broken cache reads as what parsed — never a throw
  }
  return state;
}

/** Write a core state into the browser cache's three stores. */
export function applyStateToStorage(
  state: DeviceCoreState,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(state.registry));
    storage.setItem(COMMAND_BINDINGS_KEY, JSON.stringify(state.bindings));
    storage.setItem(COMMAND_LOG_KEY, JSON.stringify(state.log.slice(-MAX_COMMAND_LOG)));
  } catch {
    // storage unavailable — the core still holds the state
  }
}

function isDogEntry(device: DeviceProfile, bindings: Record<string, DeviceCommandBinding>): boolean {
  return (
    bindings[device.id]?.profileId === WEPWAWET_DOG_PROFILE.id ||
    /^wepwawet/i.test(device.displayName.trim())
  );
}

/**
 * MERGE a browser cache into the core state — the migration and
 * the steady-state sync in one rule set:
 *   · registry and bindings: union by id; the incoming (local)
 *     entry wins a clash — it carries the Captain's latest edits.
 *   · THE DOG: if the local cache holds his real card (any id),
 *     the core's seed card steps aside for it — his grant, his
 *     name, his map survive exactly as he left them.
 *   · log: union by entry id, oldest dropped past the cap.
 *   · flag requests: union by id; the core's copy wins (requests
 *     are born and resolved against the core's record).
 */
export function mergeLocalIntoCore(
  core: DeviceCoreState,
  local: DeviceCoreState,
): DeviceCoreState {
  const localDog = local.registry.find((d) => isDogEntry(d, local.bindings));
  let coreRegistry = core.registry;
  let coreBindings = core.bindings;
  if (localDog && localDog.id !== WEPWAWET_DEVICE_ID) {
    coreRegistry = coreRegistry.filter((d) => d.id !== WEPWAWET_DEVICE_ID);
    if (core.bindings[WEPWAWET_DEVICE_ID]) {
      coreBindings = { ...core.bindings };
      delete coreBindings[WEPWAWET_DEVICE_ID];
    }
  }
  const registryById = new Map(coreRegistry.map((d) => [d.id, d]));
  for (const device of local.registry) registryById.set(device.id, device);
  const profilesById = new Map(core.profiles.map((p) => [p.id, p]));
  for (const profile of local.profiles) profilesById.set(profile.id, profile);
  const logById = new Map<string, CommandLogEntry>();
  for (const entry of [...core.log, ...local.log]) logById.set(entry.id, entry);
  const log = [...logById.values()].sort((a, b) => a.at - b.at).slice(-MAX_COMMAND_LOG);
  const requestsById = new Map(core.flagRequests.map((r) => [r.id, r]));
  for (const request of local.flagRequests) {
    if (!requestsById.has(request.id)) requestsById.set(request.id, request);
  }
  return {
    version: 1,
    registry: [...registryById.values()],
    bindings: { ...coreBindings, ...local.bindings },
    profiles: [...profilesById.values()],
    log,
    flagRequests: [...requestsById.values()].slice(-MAX_FLAG_REQUESTS),
    updatedAt: Math.max(core.updatedAt, local.updatedAt),
  };
}

/* --------------------------- flag requests ------------------------------ */

let flagRequestCounter = 0;

/**
 * Anubis asks for a Permission Law flag change. THE LAW: this
 * never touches the device's flags — it writes a pending request
 * the Captain confirms or denies. Returns the request, or null
 * when the device is unknown or the proposal changes nothing.
 */
export function proposeFlagChange(
  state: DeviceCoreState,
  args: {
    deviceId: string;
    ownerConfirmed?: boolean | undefined;
    controlGranted?: boolean | undefined;
    reason: string;
    now: number;
  },
): { state: DeviceCoreState; request: DeviceFlagRequest } | null {
  const device = state.registry.find((d) => d.id === args.deviceId);
  if (!device) return null;
  const ownerConfirmed =
    args.ownerConfirmed !== undefined && args.ownerConfirmed !== (device.ownerConfirmed === true)
      ? args.ownerConfirmed
      : undefined;
  const controlGranted =
    args.controlGranted !== undefined && args.controlGranted !== (device.controlGranted === true)
      ? args.controlGranted
      : undefined;
  if (ownerConfirmed === undefined && controlGranted === undefined) return null;
  flagRequestCounter += 1;
  const request: DeviceFlagRequest = {
    id: `flagreq-${args.now}-${flagRequestCounter}`,
    deviceId: device.id,
    deviceName: device.displayName,
    ownerConfirmed,
    controlGranted,
    reason: args.reason.slice(0, 500),
    at: args.now,
    status: "pending",
  };
  return {
    state: {
      ...state,
      flagRequests: [...state.flagRequests, request].slice(-MAX_FLAG_REQUESTS),
      updatedAt: args.now,
    },
    request,
  };
}

/**
 * THE CAPTAIN'S HAND: apply or deny a pending request. Applying is
 * the only road by which a construct-proposed flag ever lands on a
 * card — and it runs only from his confirmation in the Devices
 * window, never from the construct.
 */
export function resolveFlagRequest(
  state: DeviceCoreState,
  requestId: string,
  decision: "applied" | "denied",
  now: number,
): DeviceCoreState {
  const request = state.flagRequests.find((r) => r.id === requestId && r.status === "pending");
  if (!request) return state;
  const flagRequests = state.flagRequests.map((r) =>
    r.id === requestId ? { ...r, status: decision } : r,
  );
  if (decision === "denied") return { ...state, flagRequests, updatedAt: now };
  const registry = state.registry.map((d) => {
    if (d.id !== request.deviceId) return d;
    return {
      ...d,
      ownerConfirmed:
        request.ownerConfirmed !== undefined
          ? request.ownerConfirmed
            ? (true as const)
            : undefined
          : d.ownerConfirmed,
      controlGranted:
        request.controlGranted !== undefined
          ? request.controlGranted
            ? (true as const)
            : undefined
          : d.controlGranted,
    };
  });
  return { ...state, registry, flagRequests, updatedAt: now };
}

/** Pending flag requests, oldest first — what the stage surfaces. */
export function pendingFlagRequests(state: DeviceCoreState): DeviceFlagRequest[] {
  return state.flagRequests.filter((r) => r.status === "pending");
}
