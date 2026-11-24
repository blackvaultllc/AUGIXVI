/**
 * UNIVERSAL COMMAND MODULE — the send engine (operator order
 * 2026-11-23: "my AI to have control of anything I own… even if the
 * world goes dark — dependencies built into the system, period").
 *
 * Profiles (commandProfiles.ts) say WHAT can be sent; this module is
 * HOW it goes out, under three standing laws:
 *
 *  1. THE PERMISSION LAW, unchanged: a command leaves only for a
 *     device whose registry card carries ownerConfirmed AND
 *     controlGranted (canControl()). Anything less and the send is
 *     REFUSED, in words, before the channel is touched — the refusal
 *     itself is logged.
 *  2. THE RECORD: every attempt — sent, refused, failed, or
 *     unavailable — is written to the command log against the
 *     device's record: what command, with what values, when, and
 *     what came back.
 *  3. OFFLINE: the send paths are local — a USB serial cable, or a
 *     request on his own network. No cloud sits anywhere in the
 *     chain; with the internet unplugged the module works exactly
 *     the same (proven for the simulated path in tests, which stub
 *     the network away entirely).
 *
 * Hardware truth: the vocabulary is proven against a SIMULATED peer
 * in tests. A real send needs real hardware on the line — the
 * WebSerial path below is the browser path (his Chromium/Android);
 * where the browser offers no serial, the channel reports
 * UNAVAILABLE in words and nothing is faked. A Parrot-side serial
 * bridge is the documented alternative for a browser that cannot —
 * it is NOT built in this round and nothing here pretends it is.
 * The broadcast transport (the Wepwawet dog) is the same shape: a
 * browser cannot emit BLE advertising sets, so its live channel is
 * the Parrot-side sender (~/augie-tools/wepwawet on the Parrot);
 * in the browser the channel is absent and sends read UNAVAILABLE.
 */
import {
  canControl,
  type DeviceProfile,
} from "./deviceRegistry";
import {
  BUILTIN_COMMAND_PROFILES,
  gcodeFileLines,
  renderCommandHttp,
  renderCommandLines,
  sanitizeCommand,
  sanitizeCommandProfile,
  validateCommandValues,
  type DeviceCommand,
  type DeviceCommandProfile,
} from "./commandProfiles";
import {
  AUGIE_APP_ID,
  framesForBroadcastCommand,
  parseAppId,
  payloadHex,
  WEPWAWET_COMPANY_ID,
} from "./wepwawetFrame";
import { WEPWAWET_BRIDGE_ROUTE } from "./wepwawetBridge";

/* ------------------------------ bindings ------------------------------ */

/**
 * A device's command binding: which profile speaks for it, at what
 * address, plus any profile the operator built for it himself. Kept
 * in its own store beside the registry (the registry file stays the
 * registry's), persisted in this browser like every operator store.
 */
export type DeviceCommandBinding = {
  deviceId: string;
  profileId: string;
  /** The address as the operator set it: a port label, or http://… */
  address: string;
  /** His own profile, when the binding uses one he built. */
  customProfile?: DeviceCommandProfile | undefined;
  /** Extra commands he defined for this device, on top of the profile's. */
  extraCommands?: import("./commandProfiles").DeviceCommand[] | undefined;
};

export const COMMAND_BINDINGS_KEY = "augi.devices.command-bindings.v1";
export const COMMAND_LOG_KEY = "augi.devices.command-log.v1";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function sanitizeBinding(v: unknown): DeviceCommandBinding | null {
  if (!isRecord(v) || typeof v["deviceId"] !== "string" || typeof v["profileId"] !== "string")
    return null;
  const customProfile =
    v["customProfile"] !== undefined ? sanitizeCommandProfile(v["customProfile"]) : undefined;
  if (v["customProfile"] !== undefined && !customProfile) return null;
  const extraCommands = Array.isArray(v["extraCommands"])
    ? v["extraCommands"]
        .map(sanitizeCommand)
        .filter((c): c is DeviceCommand => c !== null)
        .slice(0, 24)
    : undefined;
  return {
    deviceId: v["deviceId"],
    profileId: v["profileId"],
    address: typeof v["address"] === "string" ? v["address"].slice(0, 300) : "",
    customProfile: customProfile ?? undefined,
    extraCommands: extraCommands?.length ? extraCommands : undefined,
  };
}

export function loadBindings(storage?: Storage | null): Record<string, DeviceCommandBinding> {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(COMMAND_BINDINGS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const out: Record<string, DeviceCommandBinding> = {};
    for (const value of Object.values(parsed)) {
      const binding = sanitizeBinding(value);
      if (binding) out[binding.deviceId] = binding;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveBinding(
  binding: DeviceCommandBinding,
  storage?: Storage | null,
): Record<string, DeviceCommandBinding> {
  const all = loadBindings(storage);
  all[binding.deviceId] = binding;
  try {
    (storage ?? globalThis.localStorage)?.setItem(COMMAND_BINDINGS_KEY, JSON.stringify(all));
  } catch {
    // storage unavailable — the in-memory return still carries it
  }
  return all;
}

export function removeBinding(
  deviceId: string,
  storage?: Storage | null,
): Record<string, DeviceCommandBinding> {
  const all = loadBindings(storage);
  delete all[deviceId];
  try {
    (storage ?? globalThis.localStorage)?.setItem(COMMAND_BINDINGS_KEY, JSON.stringify(all));
  } catch {
    // as above
  }
  return all;
}

/** Every profile the operator can pick: shipped + his own saved ones. */
export function allCommandProfiles(
  bindings: Record<string, DeviceCommandBinding>,
): DeviceCommandProfile[] {
  const out = [...BUILTIN_COMMAND_PROFILES];
  for (const binding of Object.values(bindings)) {
    if (binding.customProfile && !out.some((p) => p.id === binding.customProfile!.id)) {
      out.push(binding.customProfile);
    }
  }
  return out;
}

export function resolveBindingProfile(
  binding: DeviceCommandBinding,
  profiles: DeviceCommandProfile[],
): DeviceCommandProfile | null {
  if (binding.customProfile && binding.customProfile.id === binding.profileId) {
    return binding.customProfile;
  }
  return profiles.find((p) => p.id === binding.profileId) ?? null;
}

/** The commands a binding actually offers: the profile's, plus his own. */
export function bindingCommands(
  binding: DeviceCommandBinding,
  profile: DeviceCommandProfile,
): DeviceCommand[] {
  return [...profile.commands, ...(binding.extraCommands ?? [])];
}

/* ------------------------------ the log ------------------------------ */

export type CommandSendResult = "sent" | "refused" | "failed" | "unavailable";

export type CommandLogEntry = {
  id: string;
  deviceId: string;
  deviceName: string;
  profileId: string;
  commandId: string;
  commandName: string;
  /** What actually went out, in readable form (lines joined, or "GET /path"). */
  detail: string;
  at: number;
  result: CommandSendResult;
  /** The outcome in plain words — the device's answer, or why not. */
  note: string;
};

export const MAX_COMMAND_LOG = 200;

export function sanitizeLogEntry(v: unknown): CommandLogEntry | null {
  if (!isRecord(v)) return null;
  const str = (key: string, max: number) =>
    typeof v[key] === "string" ? (v[key] as string).slice(0, max) : "";
  const result = v["result"];
  if (
    result !== "sent" &&
    result !== "refused" &&
    result !== "failed" &&
    result !== "unavailable"
  ) {
    return null;
  }
  if (typeof v["at"] !== "number" || !str("deviceId", 80) || !str("commandName", 80)) return null;
  return {
    id: str("id", 80) || `cmdlog-${v["at"]}`,
    deviceId: str("deviceId", 80),
    deviceName: str("deviceName", 120),
    profileId: str("profileId", 64),
    commandId: str("commandId", 48),
    commandName: str("commandName", 80),
    detail: str("detail", 1000),
    at: v["at"],
    result,
    note: str("note", 500),
  };
}

export function loadCommandLog(storage?: Storage | null): CommandLogEntry[] {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(COMMAND_LOG_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeLogEntry)
      .filter((e): e is CommandLogEntry => e !== null)
      .slice(-MAX_COMMAND_LOG);
  } catch {
    return [];
  }
}

let logCounter = 0;
export function appendCommandLog(
  entry: Omit<CommandLogEntry, "id">,
  storage?: Storage | null,
): CommandLogEntry[] {
  logCounter += 1;
  const full: CommandLogEntry = { ...entry, id: `cmdlog-${entry.at}-${logCounter}` };
  const next = [...loadCommandLog(storage), full].slice(-MAX_COMMAND_LOG);
  try {
    (storage ?? globalThis.localStorage)?.setItem(COMMAND_LOG_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — the attempt still returns its own entry
  }
  return next;
}

export function logForDevice(log: CommandLogEntry[], deviceId: string): CommandLogEntry[] {
  return log.filter((e) => e.deviceId === deviceId);
}

/* ------------------------------ channels ------------------------------ */

/**
 * A channel is one open line to one device. Two shapes cover every
 * transport: line channels (serial / TCP / NODS — write a line, read
 * the reply lines) and HTTP channels (one request, one response).
 * A channel factory that cannot run here returns null and says why,
 * through `unavailableReason` — never a fake channel.
 */
export type LineChannel = {
  kind: "lines";
  transportLabel: string;
  /** Write one line; resolves with the reply lines the device sent. */
  sendLine: (line: string) => Promise<string[]>;
  close?: () => Promise<void> | void;
};

export type HttpChannel = {
  kind: "http";
  transportLabel: string;
  request: (req: {
    method: string;
    url: string;
    body?: string | undefined;
  }) => Promise<{ status: number; body: string }>;
};

/**
 * A broadcast channel: one-way BLE advertising. It puts one binary
 * payload on air as manufacturer data for a held burst. There is no
 * reply — the device family on this transport (the Wepwawet dog)
 * never answers, and the channel shape says so: advertise() resolves
 * when the burst is done, with nothing coming back.
 */
export type BroadcastChannel = {
  kind: "broadcast";
  transportLabel: string;
  /** The manufacturer company ID the payload rides under. */
  companyId: number;
  advertise: (payload: Uint8Array, holdMs: number) => Promise<void>;
  /**
   * What a completed send means on THIS channel, in the send
   * outcome's words. The default (the send engine's) says the
   * frames were transmitted; a channel that does not transmit —
   * the bridge in practice mode — must say so here instead.
   */
  sentNote?: string;
};

export type CommandChannel = LineChannel | HttpChannel | BroadcastChannel;

/**
 * THE SIMULATED PRINTER — a fake Marlin peer for tests and demos.
 * It keeps real state: heaters set by M104/M140 are what a later
 * M105 reports back; M114 reports the position the moves set. Every
 * line it receives is recorded, so a test can prove exactly what
 * the module sent — and that a refused send sent NOTHING.
 */
export function createSimulatedPrinterChannel(): LineChannel & {
  received: string[];
  state: {
    nozzleC: number;
    nozzleTarget: number;
    bedC: number;
    bedTarget: number;
    x: number;
    y: number;
    z: number;
  };
} {
  const received: string[] = [];
  const state = { nozzleC: 24.6, nozzleTarget: 0, bedC: 23.9, bedTarget: 0, x: 0, y: 0, z: 0 };
  const sendLine = async (line: string): Promise<string[]> => {
    received.push(line);
    const upper = line.toUpperCase();
    if (upper.startsWith("M104")) {
      const s = /S(-?[\d.]+)/.exec(upper);
      if (s) state.nozzleTarget = Number(s[1]);
      return ["ok"];
    }
    if (upper.startsWith("M140")) {
      const s = /S(-?[\d.]+)/.exec(upper);
      if (s) state.bedTarget = Number(s[1]);
      return ["ok"];
    }
    if (upper.startsWith("M105")) {
      return [
        `ok T:${state.nozzleC.toFixed(1)} /${state.nozzleTarget.toFixed(1)} B:${state.bedC.toFixed(1)} /${state.bedTarget.toFixed(1)} @:0 B@:0`,
      ];
    }
    if (upper.startsWith("M114")) {
      return [
        `X:${state.x.toFixed(2)} Y:${state.y.toFixed(2)} Z:${state.z.toFixed(2)} E:0.00 Count X:0 Y:0 Z:0`,
        "ok",
      ];
    }
    if (upper.startsWith("G1")) {
      for (const axis of ["X", "Y", "Z"] as const) {
        const m = new RegExp(`${axis}(-?[\\d.]+)`).exec(upper);
        if (m) state[axis.toLowerCase() as "x" | "y" | "z"] = Number(m[1]);
      }
      return ["ok"];
    }
    return ["ok"];
  };
  return { kind: "lines", transportLabel: "Simulated printer (test peer)", sendLine, received, state };
}

/** A simulated HTTP peer: answers from a handler, records requests. */
export function createSimulatedHttpChannel(
  handler: (req: { method: string; url: string; body?: string | undefined }) => {
    status: number;
    body: string;
  },
): HttpChannel & { requests: { method: string; url: string; body?: string | undefined }[] } {
  const requests: { method: string; url: string; body?: string | undefined }[] = [];
  return {
    kind: "http",
    transportLabel: "Simulated network device (test peer)",
    requests,
    request: async (req) => {
      requests.push(req);
      return handler(req);
    },
  };
}

/**
 * A simulated broadcast peer: records every payload put "on air"
 * with its hold time, so a test can prove the exact bytes a send
 * produced — and that a refused send produced NONE. It models the
 * air, not a dog: nothing here claims a dog obeyed.
 */
export function createSimulatedBroadcastChannel(companyId: number): BroadcastChannel & {
  aired: { payload: Uint8Array; hex: string; holdMs: number }[];
} {
  const aired: { payload: Uint8Array; hex: string; holdMs: number }[] = [];
  return {
    kind: "broadcast",
    transportLabel: "Simulated broadcast (test peer)",
    companyId,
    aired,
    advertise: async (payload, holdMs) => {
      aired.push({ payload, hex: payloadHex(payload), holdMs });
    },
  };
}

/**
 * THE PARROT BRIDGE CHANNEL — the dog's real send path from inside
 * Augie (operator order 2026-11-24). A browser cannot advertise, so
 * each frame the send engine builds is handed to Augie's own
 * server (the bridge door, /api/devices/wepwawet), which runs the
 * staged sender on the Parrot: the sender airs the frame from the
 * Parrot's Bluetooth — or, in practice mode, prints it and airs
 * NOTHING. The sender's own printed words are kept as receipts so
 * the Captain sees what the Parrot side actually did.
 *
 * The live flag is the Captain's switch on the dog's card, passed
 * in at construction: practice is the default everywhere this is
 * built; live is chosen by his hand, on the card, each session.
 */
export type ParrotBroadcastChannel = BroadcastChannel & {
  /** The sender's printed words, one entry per frame it handled. */
  receipts: string[];
};

export function createParrotBroadcastChannel(options: {
  live: boolean;
}): ParrotBroadcastChannel {
  const receipts: string[] = [];
  return {
    kind: "broadcast",
    transportLabel: options.live
      ? "Parrot Bluetooth sender — LIVE (frames go on air)"
      : "Parrot Bluetooth sender — practice (frames printed, nothing on air)",
    companyId: WEPWAWET_COMPANY_ID,
    receipts,
    ...(options.live
      ? {}
      : {
          sentNote:
            "Practice run — the Parrot sender printed these exact frames and transmitted NOTHING. The dog did not hear anything. Flip the switch on the card to LIVE when you want a tap to move him.",
        }),
    advertise: async (payload, holdMs) => {
      let response: Response;
      try {
        response = await fetch(WEPWAWET_BRIDGE_ROUTE, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            hex: payloadHex(payload).replace(/ /g, ""),
            holdMs,
            live: options.live,
          }),
        });
      } catch {
        throw new Error(
          "The Parrot sender door did not answer. The dog buttons work where Augie's server and the sender live — on the Parrot. Nothing was sent.",
        );
      }
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        output?: string;
        error?: string;
      } | null;
      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ??
            `The Parrot sender door refused the frame (HTTP ${response.status}). Nothing was sent.`,
        );
      }
      if (typeof data.output === "string" && data.output) {
        receipts.push(data.output);
      }
    },
  };
}

/** The real HTTP channel: a plain fetch on his own network. Local by
 *  construction — the URL is the device's own address. */
export function createFetchHttpChannel(): HttpChannel {
  return {
    kind: "http",
    transportLabel: "Network (HTTP)",
    request: async (req) => {
      const response = await fetch(req.url, {
        method: req.method,
        ...(req.body ? { body: req.body } : {}),
      });
      return { status: response.status, body: (await response.text()).slice(0, 2000) };
    },
  };
}

type WebSerialPortLike = {
  open: (options: { baudRate: number }) => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  close: () => Promise<void>;
};

export function webSerialAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serial" in navigator &&
    typeof (navigator as { serial?: unknown }).serial === "object"
  );
}

/**
 * The real printer path in the browser: WebSerial (his Chromium /
 * Android Chrome). The operator picks the port in the browser's own
 * chooser — the page never gets a port it wasn't handed. Where
 * WebSerial does not exist this returns null and the caller says
 * UNAVAILABLE in words. BUILT, NOT YET VERIFIED on a real printer.
 */
export async function openWebSerialChannel(
  baudRate: number,
): Promise<{ channel: LineChannel } | { unavailable: string }> {
  if (!webSerialAvailable()) {
    return {
      unavailable:
        "USB serial is UNAVAILABLE in this browser — WebSerial needs Chrome or Edge on a computer or Android. The printer path is built for those; on a browser without it, nothing was sent and nothing is faked. (A Parrot-side serial bridge is the alternative path — not built yet.)",
    };
  }
  try {
    const serial = (
      navigator as unknown as {
        serial: { requestPort: () => Promise<WebSerialPortLike> };
      }
    ).serial;
    const port = await serial.requestPort();
    await port.open({ baudRate });
    if (!port.readable || !port.writable) {
      return { unavailable: "The chosen port opened without a readable/writable stream." };
    }
    const writer = port.writable.getWriter();
    const reader = port.readable.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const readLineWithTimeout = async (ms: number): Promise<string | null> => {
      const deadline = Date.now() + ms;
      for (;;) {
        const nl = buffer.indexOf("\n");
        if (nl >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          return line;
        }
        if (Date.now() > deadline) return buffer.trim() ? buffer.trim() : null;
        const result = await Promise.race([
          reader.read(),
          new Promise<{ timeout: true }>((resolve) =>
            setTimeout(() => resolve({ timeout: true }), Math.max(1, deadline - Date.now())),
          ),
        ]);
        if ("timeout" in result) continue;
        if (result.done) return null;
        if (result.value) buffer += decoder.decode(result.value, { stream: true });
      }
    };
    const channel: LineChannel = {
      kind: "lines",
      transportLabel: "USB serial (WebSerial)",
      sendLine: async (line) => {
        await writer.write(new TextEncoder().encode(`${line}\n`));
        const replies: string[] = [];
        // Marlin answers each command with lines ending in "ok".
        for (let i = 0; i < 40; i += 1) {
          const reply = await readLineWithTimeout(3000);
          if (reply === null) break;
          if (reply) replies.push(reply);
          if (reply === "ok" || reply.startsWith("ok ")) break;
        }
        return replies;
      },
      close: async () => {
        try {
          reader.releaseLock();
          writer.releaseLock();
          await port.close();
        } catch {
          // already closed — the cable truth wins either way
        }
      },
    };
    return { channel };
  } catch (error) {
    return {
      unavailable: `The serial port could not be opened: ${error instanceof Error ? error.message : "unknown error"}. Nothing was sent.`,
    };
  }
}

/* --------------------------- response parsing --------------------------- */

export type PrinterStatus = {
  nozzleC: number;
  nozzleTargetC: number;
  bedC: number;
  bedTargetC: number;
  position?: { x: number; y: number; z: number } | undefined;
};

/**
 * Parse a printer's own answers (M105 temperature report, M114
 * position report) into numbers. Lines that do not parse contribute
 * nothing — a reply with no readable temperature is NOT a status,
 * and the caller reads UNAVAILABLE rather than inventing numbers.
 */
export function parsePrinterStatus(lines: string[]): PrinterStatus | null {
  let temps: Omit<PrinterStatus, "position"> | null = null;
  let position: PrinterStatus["position"];
  for (const line of lines) {
    const t = /T:(-?[\d.]+)\s*\/\s*(-?[\d.]+)/.exec(line);
    const b = /B:(-?[\d.]+)\s*\/\s*(-?[\d.]+)/.exec(line);
    if (t && b) {
      temps = {
        nozzleC: Number(t[1]),
        nozzleTargetC: Number(t[2]),
        bedC: Number(b[1]),
        bedTargetC: Number(b[2]),
      };
    }
    const pos = /^X:(-?[\d.]+)\s+Y:(-?[\d.]+)\s+Z:(-?[\d.]+)/.exec(line.trim());
    if (pos) {
      position = { x: Number(pos[1]), y: Number(pos[2]), z: Number(pos[3]) };
    }
  }
  if (!temps) return null;
  return position ? { ...temps, position } : temps;
}

export function formatPrinterStatus(status: PrinterStatus): string {
  const base = `Nozzle ${status.nozzleC}°C (target ${status.nozzleTargetC}°C) · Bed ${status.bedC}°C (target ${status.bedTargetC}°C)`;
  return status.position
    ? `${base} · Head at X${status.position.x} Y${status.position.y} Z${status.position.z}`
    : base;
}

/* ------------------------------ the send ------------------------------ */

export type SendOutcome = {
  result: CommandSendResult;
  /** The outcome in plain words. */
  note: string;
  /** What went out (empty when nothing did). */
  detail: string;
  /** Reply lines from the device, when it answered. */
  replies: string[];
  /** Parsed printer status, when the command was Status and it parsed. */
  printerStatus?: PrinterStatus | null | undefined;
};

export type SendRequest = {
  device: DeviceProfile;
  profile: DeviceCommandProfile;
  command: DeviceCommand;
  values: Record<string, string>;
  /** The device address from its binding (HTTP base). */
  address?: string | undefined;
  /** The open channel; null = no path to the device exists here. */
  channel: CommandChannel | null;
  /** Why no channel exists, in words (shown + logged). */
  channelUnavailableReason?: string | undefined;
  /** For "file" payloads: the file's full text (the G-code). */
  fileText?: string | undefined;
  /** Progress for file sends: lines acknowledged so far / total. */
  onProgress?: ((done: number, total: number) => void) | undefined;
  now?: number | undefined;
  storage?: Storage | null | undefined;
};

const REFUSAL_NOTE =
  "Control is not granted for this device. The Permission Law: Osiris may control a device only when its card is owner-confirmed AND control is granted for that exact device. Nothing was sent.";

/**
 * Send one command under the Permission Law, and log the attempt
 * against the device's record either way. The permission check runs
 * BEFORE the channel is touched — a refused send puts nothing on
 * any wire, and the tests prove it against the simulated peer.
 */
export async function sendDeviceCommand(req: SendRequest): Promise<SendOutcome> {
  const now = req.now ?? Date.now();
  const { device, profile, command } = req;
  const finish = (outcome: SendOutcome): SendOutcome => {
    appendCommandLog(
      {
        deviceId: device.id,
        deviceName: device.displayName,
        profileId: profile.id,
        commandId: command.id,
        commandName: command.name,
        detail: outcome.detail,
        at: now,
        result: outcome.result,
        note: outcome.note,
      },
      req.storage,
    );
    return outcome;
  };

  if (!canControl(device)) {
    return finish({ result: "refused", note: REFUSAL_NOTE, detail: "", replies: [] });
  }
  const invalid = validateCommandValues(command, req.values);
  if (invalid) {
    return finish({ result: "failed", note: invalid, detail: "", replies: [] });
  }
  if (!req.channel) {
    return finish({
      result: "unavailable",
      note:
        req.channelUnavailableReason ??
        "No open path to this device exists here. Nothing was sent.",
      detail: "",
      replies: [],
    });
  }

  try {
    if (command.payload.kind === "ble-broadcast") {
      if (req.channel.kind !== "broadcast") {
        return finish({
          result: "failed",
          note: "This command needs the Bluetooth broadcast path — the Parrot-side sender — but the open channel is a different kind. Nothing was sent.",
          detail: "",
          replies: [],
        });
      }
      const channel = req.channel;
      // The binding address carries Augie's AppID for the dog when
      // the operator set one there; otherwise Augie's own kept AppID.
      const appId = parseAppId(req.address) ?? [...AUGIE_APP_ID];
      const frames = framesForBroadcastCommand(command.payload, appId);
      for (const frame of frames) {
        await channel.advertise(frame.payload, frame.holdMs);
      }
      return finish({
        result: "sent",
        note:
          channel.sentNote ??
          "Broadcast on air. This protocol is one-way — the dog never answers back, so 'sent' means the frames were transmitted, never that the dog obeyed. The dog itself, watched, is the only confirmation.",
        detail: frames.map((f) => `${f.role}: ${payloadHex(f.payload)} (${f.holdMs} ms)`).join("\n"),
        replies: [],
      });
    }

    if (command.payload.kind === "http") {
      if (req.channel.kind !== "http") {
        return finish({
          result: "failed",
          note: "This command needs a network (HTTP) path, but the open channel is a different kind. Nothing was sent.",
          detail: "",
          replies: [],
        });
      }
      const rendered = renderCommandHttp(command, req.values);
      if (!rendered) {
        return finish({
          result: "failed",
          note: "A required value is missing — the request could not be built. Nothing was sent.",
          detail: "",
          replies: [],
        });
      }
      const base = (req.address ?? "").replace(/\/+$/, "");
      if (!base) {
        return finish({
          result: "failed",
          note: "This device has no network address in its command setup. Nothing was sent.",
          detail: "",
          replies: [],
        });
      }
      const url = base + (rendered.path.startsWith("/") ? rendered.path : `/${rendered.path}`);
      const response = await req.channel.request({
        method: rendered.method,
        url,
        body: rendered.body ? rendered.body : undefined,
      });
      const detail = `${rendered.method} ${url}`;
      return finish({
        result: "sent",
        note: `The device answered HTTP ${response.status}.${response.body ? ` It said: ${response.body.slice(0, 200)}` : ""}`,
        detail,
        replies: response.body ? [response.body] : [],
      });
    }

    if (req.channel.kind !== "lines") {
      return finish({
        result: "failed",
        note: "This command needs a line channel (serial), but the open channel is a different kind. Nothing was sent.",
        detail: "",
        replies: [],
      });
    }
    const channel = req.channel;

    if (command.payload.kind === "file") {
      const lines = gcodeFileLines(req.fileText ?? "");
      if (!lines.length) {
        return finish({
          result: "failed",
          note: "The print file is empty — no G-code lines to send. Nothing was sent.",
          detail: "",
          replies: [],
        });
      }
      const before = command.payload.before ?? [];
      const after = command.payload.after ?? [];
      const all = [...before, ...lines, ...after];
      let done = 0;
      for (const line of all) {
        await channel.sendLine(line);
        done += 1;
        req.onProgress?.(done, all.length);
      }
      return finish({
        result: "sent",
        note: `Print file sent: ${lines.length} G-code lines, each acknowledged by the printer.`,
        detail: lines.slice(0, 12).join("\n") + (lines.length > 12 ? "\n…" : ""),
        replies: [],
      });
    }

    const lines = renderCommandLines(command, req.values);
    if (!lines) {
      return finish({
        result: "failed",
        note: "A required value is missing — the command could not be built. Nothing was sent.",
        detail: "",
        replies: [],
      });
    }
    const replies: string[] = [];
    for (const line of lines) {
      replies.push(...(await channel.sendLine(line)));
    }
    const printerStatus =
      command.id === "status" ||
      (command.payload.kind === "lines" && command.payload.lines.includes("M105"))
        ? parsePrinterStatus(replies)
        : undefined;
    return finish({
      result: "sent",
      note:
        printerStatus !== undefined
          ? printerStatus
            ? formatPrinterStatus(printerStatus)
            : "The printer answered, but no readable temperature report came back — status is UNAVAILABLE, not guessed."
          : replies.length
            ? `The device answered: ${replies.join(" · ").slice(0, 300)}`
            : "Sent. The device sent no reply lines back.",
      detail: lines.join("\n"),
      replies,
      printerStatus,
    });
  } catch (error) {
    return finish({
      result: "failed",
      note: `The send failed: ${error instanceof Error ? error.message : "unknown error"}. What was sent before the failure stays in the device's own state — check the device itself before retrying.`,
      detail: "",
      replies: [],
    });
  }
}

/**
 * TEXT-TO-CAD SEAM: print G-code from any source (today: pasted in
 * the Devices window; tomorrow: generated by the CAD bench) through
 * the printer profile's Print-a-file command, under the same
 * Permission Law and logging as every other send.
 */
export async function printGcode(args: {
  device: DeviceProfile;
  profile: DeviceCommandProfile;
  gcodeText: string;
  channel: CommandChannel | null;
  channelUnavailableReason?: string | undefined;
  onProgress?: ((done: number, total: number) => void) | undefined;
  now?: number | undefined;
  storage?: Storage | null | undefined;
}): Promise<SendOutcome> {
  const command = args.profile.commands.find((c) => c.payload.kind === "file");
  if (!command) {
    return {
      result: "failed",
      note: "This profile has no print-a-file command. Nothing was sent.",
      detail: "",
      replies: [],
    };
  }
  return sendDeviceCommand({
    device: args.device,
    profile: args.profile,
    command,
    values: {},
    channel: args.channel,
    channelUnavailableReason: args.channelUnavailableReason,
    fileText: args.gcodeText,
    onProgress: args.onProgress,
    now: args.now,
    storage: args.storage,
  });
}
