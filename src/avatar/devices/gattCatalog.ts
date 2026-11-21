/**
 * GATT SERVICE CATALOG — the whole adopted Bluetooth catalog, mapped to
 * plain language (operator order 2026-11-21: "whenever I connect any
 * Bluetooth device AUGI will be able to understand what its
 * capabilities are… go through everything that exists until there's
 * nothing more to get").
 *
 * Every entry is an adopted Bluetooth SIG service (16-bit assigned
 * number) or a widely deployed vendor service whose UUID and meaning
 * are publicly documented (Nordic UART, the FFE0 serial-module service,
 * Apple ANCS/AMS). A service that is NOT in this catalog is never
 * guessed at: it lands in the honest "custom service — capabilities
 * need mapping" bucket on the device's card.
 *
 * `capability` is the plain-language sentence fragment the card shows
 * ("can measure heart rate"). Services that carry no user-facing
 * capability of their own (infrastructure like Generic Access) get
 * `capability: null` and are listed by name only — being named is a
 * fact; inventing a talent for them would not be.
 */

export type GattServiceInfo = {
  /** Canonical full UUID, lowercase. */
  uuid: string;
  /** Adopted (or documented vendor) service name. */
  name: string;
  /** Plain-language capability for the device card, or null. */
  capability: string | null;
  /** Family the service belongs to, for grouping on the card. */
  family:
    | "health"
    | "fitness"
    | "audio"
    | "input"
    | "device"
    | "environment"
    | "alerts"
    | "time"
    | "location"
    | "mesh"
    | "data"
    | "system";
};

/** The Bluetooth base UUID suffix every 16-bit assigned number fills. */
const BASE_SUFFIX = "-0000-1000-8000-00805f9b34fb";

export function uuidFromAssignedNumber(n: number): string {
  return `0000${n.toString(16).padStart(4, "0")}${BASE_SUFFIX}`;
}

/**
 * Normalize any UUID spelling to the canonical lowercase full form:
 * "180d", "0x180D", "0000180d", and the full 128-bit string all become
 * the same key. Non-standard 128-bit UUIDs pass through lowercased.
 */
export function normalizeUuid(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{4}$/.test(cleaned)) return uuidFromAssignedNumber(parseInt(cleaned, 16));
  if (/^[0-9a-f]{8}$/.test(cleaned)) return `${cleaned}${BASE_SUFFIX}`;
  return cleaned;
}

type Entry = [number, string, string | null, GattServiceInfo["family"]];

/**
 * Adopted services (Bluetooth SIG assigned numbers). Ordered by number.
 * Capability wording is deliberately plain — it is what the operator
 * reads on the card.
 */
const ADOPTED: Entry[] = [
  [0x1800, "Generic Access", null, "system"],
  [0x1801, "Generic Attribute", null, "system"],
  [0x1802, "Immediate Alert", "can be made to signal right away (find-me alert)", "alerts"],
  [0x1803, "Link Loss", "can alert when its connection drops", "alerts"],
  [0x1804, "Tx Power", "transmit power readable (signal-strength clues)", "device"],
  [0x1805, "Current Time", "can share the current time", "time"],
  [0x1806, "Reference Time Update", null, "time"],
  [0x1807, "Next DST Change", null, "time"],
  [0x1808, "Glucose", "can measure blood glucose", "health"],
  [0x1809, "Health Thermometer", "can measure body temperature", "health"],
  [0x180a, "Device Information", "manufacturer, model and firmware readable", "device"],
  [0x180d, "Heart Rate", "can measure heart rate", "health"],
  [0x180e, "Phone Alert Status", "can report the phone's alert/ringer state", "alerts"],
  [0x180f, "Battery", "battery level readable", "device"],
  [0x1810, "Blood Pressure", "can measure blood pressure", "health"],
  [0x1811, "Alert Notification", "can receive phone alerts and notifications", "alerts"],
  [
    0x1812,
    "Human Interface Device",
    "acts as an input device (keyboard, mouse, game controller, remote)",
    "input",
  ],
  [0x1813, "Scan Parameters", null, "system"],
  [
    0x1814,
    "Running Speed and Cadence",
    "can measure running speed, cadence and step data",
    "fitness",
  ],
  [0x1815, "Automation IO", "can read and switch connected inputs/outputs", "data"],
  [0x1816, "Cycling Speed and Cadence", "can measure cycling speed and cadence", "fitness"],
  [0x1818, "Cycling Power", "can measure cycling power in watts", "fitness"],
  [0x1819, "Location and Navigation", "can share location and navigation data", "location"],
  [
    0x181a,
    "Environmental Sensing",
    "can sense its environment (temperature, humidity, pressure and more)",
    "environment",
  ],
  [
    0x181b,
    "Body Composition",
    "can measure body composition (body fat, muscle mass and more)",
    "health",
  ],
  [0x181c, "User Data", null, "data"],
  [0x181d, "Weight Scale", "can measure body weight", "health"],
  [0x181e, "Bond Management", null, "system"],
  [0x181f, "Continuous Glucose Monitoring", "can monitor blood glucose continuously", "health"],
  [0x1820, "Internet Protocol Support", "can carry IP networking over Bluetooth", "data"],
  [0x1821, "Indoor Positioning", "can help locate itself indoors", "location"],
  [0x1822, "Pulse Oximeter", "can measure blood oxygen (SpO2) and pulse rate", "health"],
  [0x1823, "HTTP Proxy", "can proxy web requests over Bluetooth", "data"],
  [0x1824, "Transport Discovery", null, "system"],
  [0x1825, "Object Transfer", "can transfer files and objects", "data"],
  [
    0x1826,
    "Fitness Machine",
    "can report workout data from gym equipment (treadmills, bikes, rowers)",
    "fitness",
  ],
  [0x1827, "Mesh Provisioning", "can join a Bluetooth mesh network", "mesh"],
  [0x1828, "Mesh Proxy", "can relay Bluetooth mesh network traffic", "mesh"],
  [0x1829, "Reconnection Configuration", null, "system"],
  [0x183a, "Insulin Delivery", "can deliver insulin (medical pump)", "health"],
  [0x183b, "Binary Sensor", "can report simple on/off sensor states", "environment"],
  [0x183c, "Emergency Configuration", "can be configured for emergency alerts", "alerts"],
  [0x183d, "Authorization Control", null, "system"],
  [0x183e, "Physical Activity Monitor", "can monitor physical activity", "fitness"],
  [0x183f, "Elapsed Time", null, "time"],
  [0x1840, "Generic Health Sensor", "can report health sensor readings", "health"],
  [0x1843, "Audio Input Control", "can control an audio input (mute, gain) over LE Audio", "audio"],
  [0x1844, "Volume Control", "volume can be controlled over Bluetooth", "audio"],
  [0x1845, "Volume Offset Control", null, "audio"],
  [
    0x1846,
    "Coordinated Set Identification",
    "can pair with a matching earbud/device as a set",
    "audio",
  ],
  [0x1847, "Device Time", "can share and sync its clock", "time"],
  [
    0x1848,
    "Media Control",
    "media playback controls work over Bluetooth (play, pause, skip)",
    "audio",
  ],
  [
    0x1849,
    "Generic Media Control",
    "media playback controls work over Bluetooth (play, pause, skip)",
    "audio",
  ],
  [0x184a, "Constant Tone Extension", null, "audio"],
  [0x184b, "Telephone Bearer", "can carry phone calls over LE Audio", "audio"],
  [0x184c, "Generic Telephone Bearer", "can carry phone calls over LE Audio", "audio"],
  [0x184d, "Microphone Control", "has a microphone controllable over LE Audio", "audio"],
  [0x184e, "Audio Stream Control", "can stream audio over Bluetooth LE (LE Audio)", "audio"],
  [0x184f, "Broadcast Audio Scan", "can receive LE Audio broadcasts", "audio"],
  [0x1850, "Published Audio Capabilities", "declares its LE Audio playback capabilities", "audio"],
  [0x1851, "Basic Audio Announcement", null, "audio"],
  [0x1852, "Broadcast Audio Announcement", null, "audio"],
  [0x1853, "Common Audio", null, "audio"],
  [0x1854, "Hearing Access", "supports hearing-aid audio (LE Audio hearing access)", "audio"],
  [
    0x1855,
    "Telephony and Media Audio",
    "declares telephony and media audio support (LE Audio)",
    "audio",
  ],
  [0x1856, "Public Broadcast Announcement", null, "audio"],
  [0x1857, "Electronic Shelf Label", "is an electronic shelf label / price tag", "data"],
  [0x1859, "Mesh Proxy Solicitation", "can solicit Bluetooth mesh proxy connections", "mesh"],
];

/**
 * Widely deployed vendor services with publicly documented UUIDs and
 * meanings. They are not SIG-adopted; the card names them as vendor
 * services so nothing is dressed up as a standard.
 */
const VENDOR: {
  uuid: string;
  name: string;
  capability: string | null;
  family: GattServiceInfo["family"];
}[] = [
  {
    uuid: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    name: "Nordic UART (vendor)",
    capability: "serial data channel (Nordic UART) — can send and receive raw data",
    family: "data",
  },
  {
    uuid: uuidFromAssignedNumber(0xffe0),
    name: "Serial module FFE0 (vendor)",
    capability: "serial data channel (FFE0 module) — can send and receive raw data",
    family: "data",
  },
  {
    uuid: "7905f431-b5ce-4e99-a40f-4b1e122d00d0",
    name: "Apple Notification Center (vendor)",
    capability: "can receive iPhone notifications (Apple ANCS)",
    family: "alerts",
  },
  {
    uuid: "89d3502b-0f36-433a-8ef4-c502ad55f8dc",
    name: "Apple Media Service (vendor)",
    capability: "can control iPhone media playback (Apple AMS)",
    family: "audio",
  },
  {
    uuid: uuidFromAssignedNumber(0xfeaa),
    name: "Eddystone beacon (vendor)",
    capability: "acts as a beacon (Eddystone)",
    family: "data",
  },
];

const CATALOG = new Map<string, GattServiceInfo>();
for (const [n, name, capability, family] of ADOPTED) {
  const uuid = uuidFromAssignedNumber(n);
  CATALOG.set(uuid, { uuid, name, capability, family });
}
for (const v of VENDOR) {
  CATALOG.set(normalizeUuid(v.uuid), {
    uuid: normalizeUuid(v.uuid),
    name: v.name,
    capability: v.capability,
    family: v.family,
  });
}

/** Every UUID the BLE profiler asks permission to see (Web Bluetooth
 *  only exposes services named up front in `optionalServices`). */
export const ALL_KNOWN_SERVICE_UUIDS: readonly (string | number)[] = [
  ...ADOPTED.map(([n]) => n),
  ...VENDOR.map((v) => normalizeUuid(v.uuid)),
];

/** Look a service up in the catalog. Null = not in the adopted catalog. */
export function describeGattService(rawUuid: string): GattServiceInfo | null {
  return CATALOG.get(normalizeUuid(rawUuid)) ?? null;
}

/** Adopted characteristic names used by the profiler's reads. */
export const DEVICE_INFO_CHARACTERISTICS: Record<string, string> = {
  [uuidFromAssignedNumber(0x2a29)]: "manufacturer",
  [uuidFromAssignedNumber(0x2a24)]: "model",
  [uuidFromAssignedNumber(0x2a26)]: "firmware",
  [uuidFromAssignedNumber(0x2a27)]: "hardware",
  [uuidFromAssignedNumber(0x2a28)]: "software",
  [uuidFromAssignedNumber(0x2a23)]: "systemId",
};

export const BATTERY_LEVEL_CHARACTERISTIC = uuidFromAssignedNumber(0x2a19);
export const DEVICE_INFO_SERVICE = uuidFromAssignedNumber(0x180a);
export const BATTERY_SERVICE = uuidFromAssignedNumber(0x180f);
