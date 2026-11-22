/**
 * DEVICE REGISTRY — every device Augie has met, with what it can do
 * (operator order 2026-11-21: the device-understanding sector — a
 * permanent intake/profiler that future nodes plug into: the cube's
 * Bluetooth module, a Wi-Fi otoscope, his watch, headsets).
 *
 * One registry for every transport: BLE devices profiled live through
 * Web Bluetooth, and non-BLE devices (Wi-Fi otoscope, classic-Bluetooth
 * headsets) entered by hand with their measured numbers. Persistence
 * follows the app's operator-window convention: localStorage, private
 * to this browser, never synced anywhere.
 *
 * Truth rule: a field that was never measured stays absent. Nothing in
 * this module invents a number, a capability, or a service name.
 */
import { describeGattService, normalizeUuid, uuidFromAssignedNumber } from "./gattCatalog";

export type DeviceTransport = "ble" | "classic-bluetooth" | "wifi" | "wifi-ap" | "usb" | "other";

export type DeviceKind =
  | "headset"
  | "watch"
  | "fitness-band"
  | "camera"
  | "cube-node"
  | "controller"
  | "medical"
  | "sensor"
  | "audio"
  | "other";

export const DEVICE_KIND_LABELS: Record<DeviceKind, string> = {
  headset: "Headphones / headset",
  watch: "Watch",
  "fitness-band": "Fitness band",
  camera: "Camera",
  "cube-node": "Cube node",
  controller: "Controller / input",
  medical: "Medical device",
  sensor: "Sensor",
  audio: "Audio device",
  other: "Other device",
};

export const TRANSPORT_LABELS: Record<DeviceTransport, string> = {
  ble: "Bluetooth LE",
  "classic-bluetooth": "Bluetooth Classic",
  wifi: "Wi-Fi",
  "wifi-ap": "Wi-Fi access point (its own hotspot)",
  usb: "USB",
  other: "Other",
};

/**
 * Where a device sits in the node system (operator order 2026-11-21):
 * the otoscope rides on his glasses as a forward eye, the headphones
 * are the voice in his ear, the cube module is a placed node.
 */
export type DevicePlacement = "handheld" | "glasses-mounted" | "cube-node" | "worn" | "fixed";

export const PLACEMENT_LABELS: Record<DevicePlacement, string> = {
  handheld: "Handheld",
  "glasses-mounted": "Glasses-mounted",
  "cube-node": "Cube node",
  worn: "Worn",
  fixed: "Fixed in place",
};

/** One GATT service as the profiler actually found it on the device. */
export type DeclaredService = {
  /** Canonical full UUID, lowercase. */
  uuid: string;
  /** Adopted/vendor name, or null when it is not in the catalog. */
  name: string | null;
  /** True when the service is in the adopted/documented catalog. */
  known: boolean;
  /** Characteristic UUIDs found under it (canonical form). */
  characteristics: string[];
};

/** Numbers measured by hand (probe results). Absent = never measured. */
export type MeasuredConstraints = {
  /** Stream type for cameras, e.g. "MJPEG over its own Wi-Fi hotspot". */
  streamType?: string;
  /** Stream address on the device's private network, once measured —
   *  e.g. "http://192.168.1.1:8080/video". Empty until measured. */
  streamAddress?: string;
  streamFps?: number;
  latencyMs?: number;
  focalDistanceMm?: number;
  focalNotes?: string;
  lightingNotes?: string;
  notes?: string;
};

export type DeviceInfo = {
  manufacturer?: string;
  model?: string;
  firmware?: string;
  hardware?: string;
  software?: string;
};

export type DevicePresence = "active" | "gone" | "unknown";

/** One detection event in a device's presence log. */
export type PresenceEvent = {
  kind: "appeared" | "disappeared";
  at: number;
  /** Signal strength (dBm) at this sighting, when recorded. */
  rssi?: number | undefined;
  /** How the event was recorded: a real scan, or by hand. */
  via: "scan" | "manual";
};

export type DeviceProfile = {
  /** Registry id (ours, stable across sightings). */
  id: string;
  displayName: string;
  kind: DeviceKind;
  transport: DeviceTransport;
  /** The device's own identifier — BLE id, MAC, or serial — as given. */
  externalId: string;
  /**
   * For Wi-Fi-AP devices (field-confirmed 2026-11-21: Domenick's
   * otoscope broadcasts its own hotspot, SSID "SOFTISH-1851", the
   * trailing number distinguishing the unit): the broadcast SSID is
   * the identity the device presents — seeing that exact SSID means
   * that exact device is here, which is also what makes it usable as
   * a physical key. Absent for non-AP devices.
   */
  ssid?: string | undefined;
  /** Placement/role in the node system, when the operator sets one. */
  placement?: DevicePlacement | undefined;
  /** Free-text role detail, e.g. "forward eye" or "voice in my ear". */
  placementNote?: string | undefined;
  /**
   * Presence doctrine for Wi-Fi devices (operator order 2026-11-21):
   * the otoscope's hotspot has no password — on means broadcasting,
   * off means silent. The activation SSID is the name Augie watches
   * for: this SSID appearing in a Wi-Fi scan means the device is
   * present and activated (the physical-key concept); its
   * disappearance means off/gone. Usually the same as `ssid`; kept
   * separate because the watched name is a doctrine field, not just
   * a network fact. NOTE: a web app cannot scan Wi-Fi networks — the
   * registry holds these fields for the local Augie build to watch,
   * and the UI labels the live-scan state unavailable.
   */
  activationSsid?: string | undefined;
  /** Beacon/wand role: this device's presence activates Augie (his
   *  otoscope is the "Magic Wand"). */
  beaconRole?: boolean | undefined;
  /**
   * THE PERMISSION LAW (operator order 2026-11-21, governing the
   * whole device line): any device he owns that speaks Wi-Fi or
   * Bluetooth may be MAPPED on sight — but CONTROL requires his
   * explicit permission, per device. These two flags carry that
   * law on every card. Both default ABSENT (= no): mapping never
   * implies ownership confirmation, and nothing is controllable
   * until he grants it for that exact device.
   */
  ownerConfirmed?: boolean | undefined;
  /** His explicit grant that Osiris may CONTROL this device. */
  controlGranted?: boolean | undefined;
  /** Signal strength (dBm) at the last sighting, when a scan or the
   *  operator recorded one. Absent = never recorded. */
  lastSeenRssi?: number | undefined;
  /**
   * Presence state from detection events: "active" (seen, treated as
   * ON), "gone" (was seen, then disappeared — off/gone), "unknown"
   * (no sighting ever recorded). Never inferred without an event.
   */
  presence: DevicePresence;
  /** Detection log — appeared/disappeared, newest last, capped. */
  presenceEvents: PresenceEvent[];
  /** How this profile got here. */
  source: "ble-profile" | "manual";
  declaredServices: DeclaredService[];
  /** Plain-language capabilities, derived only from declared services
   *  (BLE) or entered by the operator (manual). */
  capabilities: string[];
  /** Honest limits and unknowns for the card. */
  limitations: string[];
  deviceInfo?: DeviceInfo | undefined;
  /** Battery percentage the device itself reported, or null. */
  batteryLevel: number | null;
  measured: MeasuredConstraints;
  firstSeen: number;
  lastSeen: number;
};

export const DEVICES_STORAGE_KEY = "augi.devices.registry.v1";

/* ------------------------- capability derivation ------------------------ */

/**
 * Turn the services a BLE connection actually exposed into the card's
 * facts: named services, plain-language capabilities (deduped, in
 * catalog order of appearance), and the custom services that still
 * need mapping. Nothing not exposed is claimed.
 */
export function summarizeServices(services: DeclaredService[]): {
  capabilities: string[];
  customServices: DeclaredService[];
} {
  const capabilities: string[] = [];
  const customServices: DeclaredService[] = [];
  for (const service of services) {
    const info = describeGattService(service.uuid);
    if (!info) {
      customServices.push(service);
      continue;
    }
    if (info.capability && !capabilities.includes(info.capability)) {
      capabilities.push(info.capability);
    }
  }
  return { capabilities, customServices };
}

/** Build a DeclaredService from a raw UUID + its characteristics. */
export function toDeclaredService(uuid: string, characteristics: string[]): DeclaredService {
  const canonical = normalizeUuid(uuid);
  const info = describeGattService(canonical);
  return {
    uuid: canonical,
    name: info?.name ?? null,
    known: info !== null,
    characteristics: characteristics.map((c) => normalizeUuid(c)),
  };
}

/**
 * Honest limits that follow from what a BLE profile did NOT show.
 * Classic Bluetooth audio (A2DP/HFP) never appears over BLE, so a
 * headset profiled over BLE must say its audio path was not measured —
 * the card reports what the connection exposed, nothing more.
 */
export function bleLimitations(
  profile: Pick<DeviceProfile, "kind" | "declaredServices">,
): string[] {
  const limits: string[] = [];
  const uuids = new Set(profile.declaredServices.map((s) => s.uuid));
  const hasLeAudio = [...uuids].some((u) => describeGattService(u)?.family === "audio");
  if ((profile.kind === "headset" || profile.kind === "audio") && !hasLeAudio) {
    limits.push(
      "No LE Audio services were exposed. Classic Bluetooth audio (A2DP/HFP) does not appear over BLE, so this device's audio path was not measured by this profile.",
    );
  }
  if (profile.declaredServices.length === 0) {
    limits.push(
      "The BLE connection exposed no services at all — nothing can be claimed about this device yet.",
    );
  }
  return limits;
}

/** A best-effort kind guess from exposed services — a suggestion for
 *  the operator to confirm, never a silent fact. */
export function suggestKind(services: DeclaredService[]): DeviceKind {
  const families = new Set(
    services.map((s) => describeGattService(s.uuid)?.family).filter((f) => f !== undefined),
  );
  const uuids = new Set(services.map((s) => s.uuid));
  if (uuids.has(uuidFromAssignedNumber(0x184e)) || uuids.has(uuidFromAssignedNumber(0x1850))) {
    return "headset";
  }
  if (families.has("input")) return "controller";
  if (uuids.has(uuidFromAssignedNumber(0x1810)) || uuids.has(uuidFromAssignedNumber(0x1808))) {
    return "medical";
  }
  if (families.has("health") || families.has("fitness")) return "fitness-band";
  if (families.has("environment")) return "sensor";
  return "other";
}

/* ------------------------------ persistence ----------------------------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function sanitizeService(v: unknown): DeclaredService | null {
  if (!isRecord(v) || typeof v["uuid"] !== "string") return null;
  const uuid = normalizeUuid(v["uuid"]);
  const info = describeGattService(uuid);
  return {
    uuid,
    name: info?.name ?? null,
    known: info !== null,
    characteristics: Array.isArray(v["characteristics"])
      ? v["characteristics"].filter((c): c is string => typeof c === "string").map(normalizeUuid)
      : [],
  };
}

/** Cap the presence log so a chatty scanner cannot grow it forever. */
export const MAX_PRESENCE_EVENTS = 50;

function sanitizePresenceEvents(v: unknown): PresenceEvent[] {
  if (!Array.isArray(v)) return [];
  const out: PresenceEvent[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    if (item["kind"] !== "appeared" && item["kind"] !== "disappeared") continue;
    if (typeof item["at"] !== "number") continue;
    out.push({
      kind: item["kind"],
      at: item["at"],
      rssi:
        typeof item["rssi"] === "number" && item["rssi"] >= -120 && item["rssi"] <= 0
          ? item["rssi"]
          : undefined,
      via: item["via"] === "scan" ? "scan" : "manual",
    });
  }
  return out.slice(-MAX_PRESENCE_EVENTS);
}

function sanitizeMeasured(v: unknown): MeasuredConstraints {
  if (!isRecord(v)) return {};
  const out: MeasuredConstraints = {};
  const num = (key: keyof MeasuredConstraints) => {
    const val = v[key];
    if (typeof val === "number" && Number.isFinite(val)) {
      (out as Record<string, unknown>)[key] = val;
    }
  };
  const str = (key: keyof MeasuredConstraints) => {
    const val = v[key];
    if (typeof val === "string" && val.trim()) {
      (out as Record<string, unknown>)[key] = val;
    }
  };
  num("streamFps");
  num("latencyMs");
  num("focalDistanceMm");
  str("streamType");
  str("streamAddress");
  str("focalNotes");
  str("lightingNotes");
  str("notes");
  return out;
}

const KINDS = new Set<string>(Object.keys(DEVICE_KIND_LABELS));
const TRANSPORTS = new Set<string>(Object.keys(TRANSPORT_LABELS));
const PLACEMENTS = new Set<string>(Object.keys(PLACEMENT_LABELS));

export function sanitizeProfile(v: unknown): DeviceProfile | null {
  if (!isRecord(v) || typeof v["id"] !== "string" || typeof v["displayName"] !== "string")
    return null;
  const declaredServices = Array.isArray(v["declaredServices"])
    ? v["declaredServices"].map(sanitizeService).filter((s): s is DeclaredService => s !== null)
    : [];
  const deviceInfo: DeviceInfo = {};
  if (isRecord(v["deviceInfo"])) {
    for (const key of ["manufacturer", "model", "firmware", "hardware", "software"] as const) {
      const val = v["deviceInfo"][key];
      if (typeof val === "string" && val.trim()) deviceInfo[key] = val;
    }
  }
  return {
    id: v["id"],
    displayName: v["displayName"],
    kind:
      typeof v["kind"] === "string" && KINDS.has(v["kind"]) ? (v["kind"] as DeviceKind) : "other",
    transport:
      typeof v["transport"] === "string" && TRANSPORTS.has(v["transport"])
        ? (v["transport"] as DeviceTransport)
        : "other",
    externalId: typeof v["externalId"] === "string" ? v["externalId"] : "",
    ssid: typeof v["ssid"] === "string" && v["ssid"].trim() ? v["ssid"] : undefined,
    placement:
      typeof v["placement"] === "string" && PLACEMENTS.has(v["placement"])
        ? (v["placement"] as DevicePlacement)
        : undefined,
    placementNote:
      typeof v["placementNote"] === "string" && v["placementNote"].trim()
        ? v["placementNote"]
        : undefined,
    activationSsid:
      typeof v["activationSsid"] === "string" && v["activationSsid"].trim()
        ? v["activationSsid"]
        : undefined,
    beaconRole: v["beaconRole"] === true ? true : undefined,
    ownerConfirmed: v["ownerConfirmed"] === true ? true : undefined,
    controlGranted: v["controlGranted"] === true ? true : undefined,
    lastSeenRssi:
      typeof v["lastSeenRssi"] === "number" && v["lastSeenRssi"] >= -120 && v["lastSeenRssi"] <= 0
        ? v["lastSeenRssi"]
        : undefined,
    presence: v["presence"] === "active" || v["presence"] === "gone" ? v["presence"] : "unknown",
    presenceEvents: sanitizePresenceEvents(v["presenceEvents"]),
    source: v["source"] === "ble-profile" ? "ble-profile" : "manual",
    declaredServices,
    capabilities: Array.isArray(v["capabilities"])
      ? v["capabilities"].filter((c): c is string => typeof c === "string")
      : [],
    limitations: Array.isArray(v["limitations"])
      ? v["limitations"].filter((c): c is string => typeof c === "string")
      : [],
    deviceInfo: Object.keys(deviceInfo).length ? deviceInfo : undefined,
    batteryLevel:
      typeof v["batteryLevel"] === "number" && v["batteryLevel"] >= 0 && v["batteryLevel"] <= 100
        ? v["batteryLevel"]
        : null,
    measured: sanitizeMeasured(v["measured"]),
    firstSeen: typeof v["firstSeen"] === "number" ? v["firstSeen"] : Date.now(),
    lastSeen: typeof v["lastSeen"] === "number" ? v["lastSeen"] : Date.now(),
  };
}

export function loadRegistry(): DeviceProfile[] {
  try {
    const raw = globalThis.localStorage?.getItem(DEVICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeProfile).filter((p): p is DeviceProfile => p !== null);
  } catch {
    return [];
  }
}

export function saveRegistry(devices: DeviceProfile[]): void {
  try {
    globalThis.localStorage?.setItem(DEVICES_STORAGE_KEY, JSON.stringify(devices));
  } catch {
    // storage full/unavailable — the in-memory list keeps working
  }
}

/** Add a new profile, or replace the one with the same registry id
 *  (keeping its firstSeen). Returns the new list. */
export function upsertDevice(devices: DeviceProfile[], profile: DeviceProfile): DeviceProfile[] {
  const existing = devices.find((d) => d.id === profile.id);
  const next = existing
    ? devices.map((d) =>
        d.id === profile.id
          ? { ...profile, firstSeen: existing.firstSeen, lastSeen: profile.lastSeen }
          : d,
      )
    : [profile, ...devices];
  saveRegistry(next);
  return next;
}

export function updateDevice(
  devices: DeviceProfile[],
  id: string,
  patch: Partial<DeviceProfile>,
): DeviceProfile[] {
  const next = devices.map((d) => (d.id === id ? { ...d, ...patch, id: d.id } : d));
  saveRegistry(next);
  return next;
}

export function removeDevice(devices: DeviceProfile[], id: string): DeviceProfile[] {
  const next = devices.filter((d) => d.id !== id);
  saveRegistry(next);
  return next;
}

let idCounter = 0;
export function newDeviceId(): string {
  idCounter += 1;
  return `device-${Date.now()}-${idCounter}`;
}

/**
 * The Permission Law as a check: Osiris may CONTROL a device only
 * when the operator has both confirmed it is his AND granted
 * control for that device. Anything less — mapped, seen, even
 * owner-confirmed without the grant — is observation only.
 */
export function canControl(profile: DeviceProfile): boolean {
  return profile.ownerConfirmed === true && profile.controlGranted === true;
}
