/**
 * BLE PROFILER — the live intake (operator order 2026-11-21).
 *
 * Uses the Web Bluetooth API where the browser offers it: the operator
 * picks a nearby device from the browser's own chooser, the app
 * connects over GATT, enumerates every service and characteristic the
 * device exposes, maps them through the adopted catalog, and reads the
 * standard Device Information and Battery characteristics when the
 * device makes them readable. The result is a registry profile that
 * states only what the connection actually exposed.
 *
 * Where Web Bluetooth does not exist (Firefox, Safari, iOS), the
 * window says so plainly and this flow never starts — unavailable
 * labeled unavailable, per the operator's truth rule.
 *
 * NOTE: this path cannot be exercised without real Bluetooth hardware
 * in range. It is BUILT, NOT YET VERIFIED on hardware.
 */
import {
  ALL_KNOWN_SERVICE_UUIDS,
  BATTERY_LEVEL_CHARACTERISTIC,
  BATTERY_SERVICE,
  DEVICE_INFO_CHARACTERISTICS,
  DEVICE_INFO_SERVICE,
  normalizeUuid,
} from "./gattCatalog";
import {
  bleLimitations,
  newDeviceId,
  suggestKind,
  summarizeServices,
  toDeclaredService,
  type DeclaredService,
  type DeviceInfo,
  type DeviceProfile,
} from "./deviceRegistry";

/* Minimal Web Bluetooth surface — TypeScript's DOM lib does not ship
 * these types, so the few members used here are declared locally. */
type BluetoothCharacteristic = {
  uuid: string;
  properties: { read?: boolean };
  readValue?: () => Promise<DataView>;
};
type BluetoothService = {
  uuid: string;
  getCharacteristics: () => Promise<BluetoothCharacteristic[]>;
  getCharacteristic: (uuid: string) => Promise<BluetoothCharacteristic>;
};
type BluetoothGattServer = {
  connect: () => Promise<BluetoothGattServer>;
  disconnect: () => void;
  getPrimaryServices: () => Promise<BluetoothService[]>;
};
type BluetoothDevice = {
  id: string;
  name?: string;
  gatt?: BluetoothGattServer;
};
type BluetoothApi = {
  requestDevice: (options: {
    acceptAllDevices: boolean;
    optionalServices?: (string | number)[];
  }) => Promise<BluetoothDevice>;
};

function bluetoothApi(): BluetoothApi | null {
  const nav = globalThis.navigator as unknown as { bluetooth?: BluetoothApi } | undefined;
  return nav?.bluetooth ?? null;
}

/** True only when this browser actually offers Web Bluetooth. */
export function webBluetoothAvailable(): boolean {
  return bluetoothApi() !== null;
}

const UNAVAILABLE_MESSAGE =
  "Bluetooth profiling is UNAVAILABLE in this browser — Web Bluetooth needs Chrome or Edge on a computer or Android. Nothing was scanned, and no device was guessed at.";

export function webBluetoothUnavailableMessage(): string {
  return UNAVAILABLE_MESSAGE;
}

function decodeText(view: DataView): string {
  let out = "";
  for (let i = 0; i < view.byteLength; i += 1) {
    const code = view.getUint8(i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out.trim();
}

async function readDeviceInfo(service: BluetoothService): Promise<DeviceInfo> {
  const info: DeviceInfo = {};
  for (const [uuid, field] of Object.entries(DEVICE_INFO_CHARACTERISTICS)) {
    if (field === "systemId") continue;
    try {
      const characteristic = await service.getCharacteristic(uuid);
      if (!characteristic.properties.read || !characteristic.readValue) continue;
      const text = decodeText(await characteristic.readValue());
      if (text) info[field as keyof DeviceInfo] = text;
    } catch {
      // not readable on this device — stays unknown, never guessed
    }
  }
  return info;
}

async function readBatteryLevel(service: BluetoothService): Promise<number | null> {
  try {
    const characteristic = await service.getCharacteristic(BATTERY_LEVEL_CHARACTERISTIC);
    if (!characteristic.properties.read || !characteristic.readValue) return null;
    const view = await characteristic.readValue();
    if (view.byteLength < 1) return null;
    const level = view.getUint8(0);
    return level >= 0 && level <= 100 ? level : null;
  } catch {
    return null;
  }
}

/**
 * Run one profiling pass. Throws an Error with a plain-language
 * message on any failure (chooser cancelled, connect failed, …) so
 * the window can show exactly what happened.
 */
export async function profileBleDevice(now: number = Date.now()): Promise<DeviceProfile> {
  const api = bluetoothApi();
  if (!api) throw new Error(UNAVAILABLE_MESSAGE);

  const device = await api.requestDevice({
    acceptAllDevices: true,
    optionalServices: [...ALL_KNOWN_SERVICE_UUIDS],
  });
  if (!device.gatt)
    throw new Error("That device has no GATT server — it cannot be profiled over BLE.");

  const server = await device.gatt.connect();
  try {
    const services = await server.getPrimaryServices();
    const declared: DeclaredService[] = [];
    let deviceInfo: DeviceInfo | undefined;
    let batteryLevel: number | null = null;

    for (const service of services) {
      let characteristics: BluetoothCharacteristic[] = [];
      try {
        characteristics = await service.getCharacteristics();
      } catch {
        characteristics = [];
      }
      declared.push(
        toDeclaredService(
          service.uuid,
          characteristics.map((c) => c.uuid),
        ),
      );
      const canonical = normalizeUuid(service.uuid);
      if (canonical === DEVICE_INFO_SERVICE) {
        const read = await readDeviceInfo(service);
        if (Object.keys(read).length) deviceInfo = read;
      }
      if (canonical === BATTERY_SERVICE) {
        batteryLevel = await readBatteryLevel(service);
      }
    }

    const { capabilities, customServices } = summarizeServices(declared);
    const kind = suggestKind(declared);
    const partial: Pick<DeviceProfile, "kind" | "declaredServices"> = {
      kind,
      declaredServices: declared,
    };
    const limitations = bleLimitations(partial);
    if (customServices.length) {
      limitations.push(
        `${customServices.length} custom service${customServices.length === 1 ? "" : "s"} found — capabilities need mapping before Augie can claim anything about them.`,
      );
    }

    return {
      id: newDeviceId(),
      displayName: device.name?.trim() || "Unnamed Bluetooth device",
      kind,
      transport: "ble",
      externalId: device.id,
      source: "ble-profile",
      declaredServices: declared,
      capabilities,
      limitations,
      deviceInfo,
      batteryLevel,
      measured: {},
      // It was just connected to — present, with the sighting logged.
      presence: "active",
      presenceEvents: [{ kind: "appeared", at: now, via: "scan" }],
      firstSeen: now,
      lastSeen: now,
    };
  } finally {
    try {
      server.disconnect();
    } catch {
      // already gone — nothing to clean up
    }
  }
}
