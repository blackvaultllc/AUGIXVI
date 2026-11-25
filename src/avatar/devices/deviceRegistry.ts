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
import {
  sanitizeCommandPayload,
  type CommandPayload,
  type CommandTransport,
  type DeviceCommand,
  type DeviceCommandProfile,
} from "./commandProfiles";

export type DeviceTransport = "ble" | "classic-bluetooth" | "wifi" | "wifi-ap" | "usb" | "other";

export type DeviceKind =
  | "headset"
  | "watch"
  | "fitness-band"
  | "camera"
  | "cube-node"
  | "controller"
  | "drone"
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
  drone: "Drone / quadcopter",
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

/**
 * DEVICE MASTERY (operator doctrine, 2026-11-21): on first contact a
 * device is mapped COMPLETELY — identity, address, ports, protocol,
 * and the full control map — and the fingerprint below is where that
 * map lives. A field that was never mapped stays ABSENT: the card
 * claims only what contact actually proved. The bench work that
 * fills these fields (drone RF / app-protocol mapping) is hardware
 * work; this schema is its home.
 */

/** One open port found on the device during mapping. */
export type DevicePort = {
  port: number;
  /** tcp / udp / … as found. */
  protocol?: string | undefined;
  /** What answers there, in plain words ("RTSP stream", "app control"). */
  service?: string | undefined;
};

export type ControlActionKind = "command" | "stick" | "toggle" | "range" | "other";

/** One entry of a device's control map — a thing Osiris can make it do. */
export type ControlAction = {
  id: string;
  /** Plain name: "Take off", "Left stick — pitch", "Light color". */
  label: string;
  kind: ControlActionKind;
  /**
   * How the action is actually invoked, as mapped: the packet, the
   * endpoint, the GATT characteristic, the RF frame. A claim without
   * this is not a control — it is a wish.
   */
  detail: string;
  /**
   * Proven on the bench (sent and the device obeyed) vs mapped-only
   * (inferred from a capture or a manual, never yet driven). Only
   * verified actions may ever be represented as usable control.
   */
  verified: boolean;
  /**
   * THE EXECUTABLE HALF (owner order 2026-11-24: one control map).
   * When a control entry carries the actual payload — the frame
   * bytes, the lines, the request — the entry IS a command: the
   * send engine runs it under the Permission Law like any profile
   * command. An entry without a payload stays descriptive: it says
   * what the device can do, and nothing pretends it can be fired.
   */
  payload?: CommandPayload | undefined;
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
  /* ---- the first-contact map (device mastery) ---- */
  /** Network address as mapped: IP, MAC, or host — as found. */
  address?: string | undefined;
  /** The protocol the device speaks, as mapped ("UDP app protocol",
   * "BLE GATT", "2.4 GHz proprietary RF", "RTSP/ONVIF"…). */
  protocol?: string | undefined;
  /** Open ports found on the device. Absent = never port-mapped. */
  ports?: DevicePort[] | undefined;
  /** The full control map. Absent = no control surface mapped yet. */
  controls?: ControlAction[] | undefined;
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

const CONTROL_KINDS = new Set<string>(["command", "stick", "toggle", "range", "other"]);
const MAX_PORTS = 64;
const MAX_CONTROLS = 64;

function sanitizePorts(v: unknown): DevicePort[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: DevicePort[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    const port = item["port"];
    if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) continue;
    out.push({
      port,
      protocol:
        typeof item["protocol"] === "string" && item["protocol"].trim()
          ? item["protocol"].trim().slice(0, 16)
          : undefined,
      service:
        typeof item["service"] === "string" && item["service"].trim()
          ? item["service"].trim().slice(0, 80)
          : undefined,
    });
    if (out.length >= MAX_PORTS) break;
  }
  return out.length ? out : undefined;
}

function sanitizeControls(v: unknown): ControlAction[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: ControlAction[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    const label = typeof item["label"] === "string" ? item["label"].trim().slice(0, 80) : "";
    const detail = typeof item["detail"] === "string" ? item["detail"].trim().slice(0, 300) : "";
    if (!label || !detail) continue;
    const payload =
      item["payload"] !== undefined ? sanitizeCommandPayload(item["payload"]) : undefined;
    out.push({
      id:
        typeof item["id"] === "string" && item["id"].trim()
          ? item["id"].trim().slice(0, 48)
          : label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "control",
      label,
      kind:
        typeof item["kind"] === "string" && CONTROL_KINDS.has(item["kind"])
          ? (item["kind"] as ControlActionKind)
          : "other",
      detail,
      verified: item["verified"] === true,
      ...(payload ? { payload } : {}),
    });
    if (out.length >= MAX_CONTROLS) break;
  }
  return out.length ? out : undefined;
}

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
    address:
      typeof v["address"] === "string" && v["address"].trim()
        ? v["address"].trim().slice(0, 120)
        : undefined,
    protocol:
      typeof v["protocol"] === "string" && v["protocol"].trim()
        ? v["protocol"].trim().slice(0, 120)
        : undefined,
    ports: sanitizePorts(v["ports"]),
    controls: sanitizeControls(v["controls"]),
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


/* ---------------- the control map as text (form <-> profile) -------- */

/** Ports, one per line: "7099 | udp | app control". */
export function parsePortsText(text: string): DevicePort[] | undefined {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return sanitizePorts(
    lines.map((line) => {
      const [portRaw, protocol, service] = line.split("|").map((p) => p?.trim() ?? "");
      return { port: Number(portRaw), protocol, service };
    }),
  );
}

export function formatPortsText(ports: DevicePort[] | undefined): string {
  if (!ports) return "";
  return ports
    .map((p) => [String(p.port), p.protocol ?? "", p.service ?? ""].join(" | ").replace(/\s\|\s$/, ""))
    .join("\n");
}

/**
 * Parse the payload segment of a control-map line, when it carries
 * one: "frame: E0 00 00 00 00 02 3000" (command byte, the five data
 * bytes in hex, hold in ms — the broadcast frame shape) or
 * "http: GET /path" (a web request). Anything else reads as no
 * payload — the entry stays descriptive, never half-parsed.
 */
export function parseControlPayloadSegment(segment: string): CommandPayload | undefined {
  const frame = /^frame:\s*([0-9a-fA-F]{1,2})((?:\s+[0-9a-fA-F]{2}){5})\s+(\d{1,5})$/.exec(segment);
  if (frame) {
    const data = (frame[2] ?? "").trim().split(/\s+/).map((h) => parseInt(h, 16));
    return sanitizeCommandPayload({
      kind: "ble-broadcast",
      cmd: parseInt(frame[1] ?? "0", 16),
      data,
      holdMs: Number(frame[3]),
    }) ?? undefined;
  }
  const http = /^http:\s*(GET|POST|PUT|DELETE)\s+(\S+)$/i.exec(segment);
  if (http) {
    return sanitizeCommandPayload({
      kind: "http",
      method: (http[1] ?? "GET").toUpperCase(),
      path: http[2] ?? "",
    }) ?? undefined;
  }
  return undefined;
}

/** The payload segment as text, for the control-map form. */
export function formatControlPayloadSegment(payload: CommandPayload): string {
  if (payload.kind === "ble-broadcast") {
    const hex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
    return `frame: ${hex(payload.cmd)} ${payload.data.map(hex).join(" ")} ${payload.holdMs}`;
  }
  if (payload.kind === "http") return `http: ${payload.method} ${payload.path}`;
  if (payload.kind === "lines") return `lines: ${payload.lines.join(" ⏎ ")}`;
  return "";
}

/** Controls, one per line: "Take off | command | UDP packet … | verified".
 * The trailing "| verified" is the bench proof flag — without it the
 * action is mapped-only and may never be represented as usable. A
 * line may also carry ONE payload segment ("frame: …" or "http: …")
 * — that segment is what makes the entry executable (one map). */
export function parseControlsText(text: string): ControlAction[] | undefined {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return sanitizeControls(
    lines.map((line, i) => {
      const parts = line.split("|").map((p) => p.trim());
      const verified = parts.some((p) => p.toLowerCase() === "verified");
      let payload: CommandPayload | undefined;
      const kept: string[] = [];
      for (const part of parts) {
        if (part.toLowerCase() === "verified") continue;
        const parsed = parseControlPayloadSegment(part);
        if (parsed) {
          payload = parsed;
          continue;
        }
        kept.push(part);
      }
      return {
        id: `control-${i + 1}`,
        label: kept[0] ?? "",
        kind: kept[1] ?? "other",
        detail: kept.slice(2).join(" | "),
        verified,
        ...(payload ? { payload } : {}),
      };
    }),
  );
}

export function formatControlsText(controls: ControlAction[] | undefined): string {
  if (!controls) return "";
  return controls
    .map((c) => {
      const segment = c.payload ? formatControlPayloadSegment(c.payload) : "";
      return `${c.label} | ${c.kind} | ${c.detail}${segment ? ` | ${segment}` : ""}${c.verified ? " | verified" : ""}`;
    })
    .join("\n");
}

/* ----------------- the control map IS the command set ----------------- */

/** The commands a device's own control map can fire: every entry
 *  that carries a payload, as a send-engine command. */
export function controlMapCommands(profile: DeviceProfile): DeviceCommand[] {
  return (profile.controls ?? [])
    .filter((c) => c.payload !== undefined)
    .map((c) => ({
      id: c.id,
      name: c.label,
      help: c.detail,
      params: [],
      payload: c.payload!,
    }));
}

const TRANSPORT_FOR_PAYLOAD: Record<CommandPayload["kind"], CommandTransport> = {
  "ble-broadcast": "bluetooth-broadcast",
  http: "network-http",
  lines: "usb-serial",
  file: "usb-serial",
};

/**
 * A device with payload-carrying control entries but no bound
 * profile still has a command set: this generated profile, built
 * from the map itself. The map is the single source — edit the map
 * on the registry card and the commands follow.
 */
export function profileFromControlMap(profile: DeviceProfile): DeviceCommandProfile | null {
  const commands = controlMapCommands(profile);
  if (!commands.length) return null;
  const first = commands[0]!;
  return {
    id: `control-map-${profile.id}`.slice(0, 64),
    name: `${profile.displayName} — its control map`,
    deviceClass: `The executable half of ${profile.displayName}'s registry control map`,
    transport: TRANSPORT_FOR_PAYLOAD[first.payload.kind],
    addressPattern: "",
    commands,
    setupSteps: [],
    safetyNotes: [],
    builtin: false,
  };
}

/* ---------------- what a control surface may show ------------------- */

export type ControlSurface =
  | { state: "not-granted"; mapped: ControlAction[] }
  | { state: "granted"; usable: ControlAction[]; unproven: ControlAction[] };

/**
 * The Permission Law at the surface (operator order 2026-11-21):
 * control NOT granted → the surface shows the map only, no control
 * actions. Granted → the surface may present control, and even then
 * only VERIFIED actions are usable; mapped-but-unproven entries
 * stay labeled unproven. A surface that skips this gate is lying.
 */
export function controlSurface(profile: DeviceProfile): ControlSurface {
  const mapped = profile.controls ?? [];
  if (!canControl(profile)) return { state: "not-granted", mapped };
  return {
    state: "granted",
    usable: mapped.filter((c) => c.verified),
    unproven: mapped.filter((c) => !c.verified),
  };
}
