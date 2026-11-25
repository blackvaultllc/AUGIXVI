/**
 * DEVICE COMMAND PROFILES — the configuration core of the Universal
 * Command Module (operator order 2026-11-23: "send a module for
 * sending commands to ANY device — I don't even care if it's a 3D
 * printer… anything I need, in the configuration of opening and
 * setting up that configuration; if we can't do it right now, being
 * able to add it on").
 *
 * A PROFILE is data, not code: a device class's connection shape
 * (transport + address pattern) and its command vocabulary (named
 * commands with parameter shapes, each rendering to literal lines on
 * a serial/text channel or to an HTTP request). Adding a new device
 * class later = adding a profile object — in this registry, or by
 * the operator in the Devices window, where his profiles persist in
 * local storage beside the device registry. The send engine
 * (commandModule.ts) never changes when a profile is added.
 *
 * TEXT-TO-CAD SEAM: the Captain's text-to-cad bench
 * (~/workspace/custom-skills/text-to-cad) designs the parts; this
 * module's printer profile is the hands that print them. The seam is
 * `printGcode()` in commandModule.ts — feed it G-code text from any
 * source and it runs the printer profile's file path. No CAD work
 * lives in this module.
 *
 * Truth rule, same as the device registry: a command claims only
 * what its template renders; a response is parsed only when the
 * device actually answered. Nothing here invents a device reply.
 */
import {
  WEPWAWET_REMOTE_ACTIONS,
  WEPWAWET_REMOTE_FEED,
  WEPWAWET_REMOTE_PAD,
} from "./wepwawetRemote";

export type CommandTransport =
  | "usb-serial"
  | "network-http"
  | "network-tcp"
  | "bluetooth"
  | "bluetooth-broadcast"
  | "nods-session";

export const COMMAND_TRANSPORT_LABELS: Record<CommandTransport, string> = {
  "usb-serial": "USB serial cable",
  "network-http": "Network (web requests, HTTP)",
  "network-tcp": "Network (raw TCP socket)",
  bluetooth: "Bluetooth",
  "bluetooth-broadcast": "Bluetooth broadcast (one-way advertising — no connection)",
  "nods-session": "Through a NODS session",
};

export type CommandParamKind = "number" | "text" | "select";

export type CommandParam = {
  /** Placeholder name used in templates: "{temp}". */
  name: string;
  /** Plain label the operator sees. */
  label: string;
  kind: CommandParamKind;
  required?: boolean | undefined;
  /** Numeric bounds — a value outside them is refused before sending. */
  min?: number | undefined;
  max?: number | undefined;
  /** Pre-filled value, in words/numbers as the operator would type it. */
  default?: string | undefined;
  /** Choices for kind "select". */
  options?: string[] | undefined;
  /**
   * How the value appears in a line template: "X{v}" renders the
   * value 10 as "X10". Without a format the bare value is used.
   * When an optional param is left empty, its whole word vanishes
   * from the rendered line (a move with no Z renders no Z word).
   */
  format?: string | undefined;
  /** One plain help line for this field. */
  help?: string | undefined;
};

/** What one command puts on the wire. */
export type CommandPayload =
  | {
      kind: "lines";
      /** One template per line; "{param}" placeholders substituted. */
      lines: string[];
    }
  | {
      kind: "http";
      method: "GET" | "POST" | "PUT" | "DELETE";
      /** Path template, appended to the device address: "/ptz?move={direction}". */
      path: string;
      /** Optional body template. */
      body?: string | undefined;
    }
  | {
      /**
       * A whole file of lines supplied at send time (a G-code print
       * file). The sender streams the file's lines one by one and
       * reports progress; `before`/`after` lines wrap the file.
       */
      kind: "file";
      before?: string[] | undefined;
      after?: string[] | undefined;
    }
  | {
      /**
       * One binary frame on a one-way Bluetooth broadcast transport
       * (the Wepwawet dog profile): the frame command byte and the
       * five data bytes D0–D4 of the device's frame format. The
       * encoder (wepwawetFrame.ts) turns this into the exact on-air
       * payload; the send engine follows it with the zero frame,
       * the protocol's trailing frame after every command.
       */
      kind: "ble-broadcast";
      /** Frame command byte (0xD0 match / 0xE0 data, for this family). */
      cmd: number;
      /** The five data bytes D0–D4. */
      data: [number, number, number, number, number];
      /** How long the frame is held on air before the zero frame. */
      holdMs: number;
    };

export type DeviceCommand = {
  id: string;
  /** The name the operator taps: "Home", "Heat nozzle". */
  name: string;
  /** One plain line: what this command does. */
  help: string;
  params: CommandParam[];
  payload: CommandPayload;
  /** Plain safety note shown before sending, when one applies. */
  safety?: string | undefined;
};

/**
 * CARD EXTRAS — the furniture a device's card grows when its
 * profile declares it (owner order 2026-11-24: Anubis's full
 * device-setup ability). The clickable remote, the command groups,
 * the sound pick list, the battery-test log, and the how-to block
 * used to be hard-coded to the one dog profile's id. They are
 * profile DATA now: any profile that declares the same shape gets
 * the same furniture on its card, with no new code.
 */
export type ProfileCardExtras = {
  /** Command groups for the card, in order. Every command on the
   *  profile should appear in exactly one group. */
  groups?: { label: string; commandIds: string[] }[] | undefined;
  /** The sounds group's label + the trigger ids that carry his
   *  Use / Never use picks. */
  soundGroupLabel?: string | undefined;
  soundTriggerIds?: string[] | undefined;
  /** The honest-limit note that stands over the sounds group. */
  soundNote?: string | undefined;
  /** The clickable remote's layout: a direction pad (command ids)
   *  and the action + feed button rows. */
  remote?:
    | {
        pad: { up: string; left: string; center: string; right: string; down: string };
        actions: string[];
        feed: string[];
      }
    | undefined;
  /** Show the measured battery-test log on the card (for devices
   *  that report nothing back, so endurance is timed, not read). */
  batteryLog?: boolean | undefined;
  /** The plain how-to block that stands on the card. */
  howto?: { title: string; steps: string[]; notes: string[] } | undefined;
};

export type DeviceCommandProfile = {
  id: string;
  /** "3D printer (G-code)", "Network device (web requests)". */
  name: string;
  /** The class of device this profile speaks to, in plain words. */
  deviceClass: string;
  transport: CommandTransport;
  /**
   * For bridge-fired profiles (Bluetooth broadcast): the sender
   * script's path UNDER ~/augie-tools/ on the core machine — the
   * general bridge refuses any path outside that directory. The
   * dog's is "wepwawet/wepwawet-send.py". Absent = this profile has
   * no staged sender and the bridge cannot fire it.
   */
  senderPath?: string | undefined;
  /**
   * A proven fact about this device class the capability brief may
   * state (its live proof, in plain words). Read from the profile,
   * never hand-copied into the brief — when the profile changes,
   * the brief follows.
   */
  briefNote?: string | undefined;
  /** Card furniture this profile declares (remote, groups, …). */
  extras?: ProfileCardExtras | undefined;
  /**
   * How the address for this transport reads, as a pattern the
   * operator copies: "the USB port the printer enumerates as, at
   * 115200 baud" / "http://192.168.1.50". Shown in the setup flow.
   */
  addressPattern: string;
  /** Serial baud rate for usb-serial profiles. */
  baudRate?: number | undefined;
  commands: DeviceCommand[];
  /** Setup, step by step, in the operator's words. */
  setupSteps: string[];
  safetyNotes: string[];
  /** True for the profiles shipped in code; false for his own. */
  builtin: boolean;
};

/* ------------------------- template rendering ------------------------ */

function formatValue(param: CommandParam, raw: string): string {
  return param.format ? param.format.replace("{v}", raw) : raw;
}

/**
 * Render one template line: each "{param}" word is replaced by the
 * param's formatted value, or removed entirely when an optional
 * param is empty. Leftover whitespace collapses. A required param
 * left empty makes the line unrenderable — null, and the caller
 * refuses the send in words.
 */
export function renderTemplateLine(
  template: string,
  command: DeviceCommand,
  values: Record<string, string>,
): string | null {
  let missing = false;
  const rendered = template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_whole, name: string) => {
    const param = command.params.find((p) => p.name === name);
    const raw = (values[name] ?? param?.default ?? "").trim();
    if (!raw) {
      if (param?.required) missing = true;
      return "";
    }
    return param ? formatValue(param, raw) : raw;
  });
  if (missing) return null;
  return rendered.replace(/\s+/g, " ").trim();
}

/** Render a command's line payload. Null = a required value is missing. */
export function renderCommandLines(
  command: DeviceCommand,
  values: Record<string, string>,
): string[] | null {
  if (command.payload.kind !== "lines") return null;
  const out: string[] = [];
  for (const template of command.payload.lines) {
    const line = renderTemplateLine(template, command, values);
    if (line === null) return null;
    if (line) out.push(line);
  }
  return out;
}

/** Render a command's HTTP payload. Null = a required value is missing. */
export function renderCommandHttp(
  command: DeviceCommand,
  values: Record<string, string>,
): { method: string; path: string; body?: string | undefined } | null {
  if (command.payload.kind !== "http") return null;
  const path = renderTemplateLine(command.payload.path, command, values);
  if (path === null) return null;
  // A command may carry its method as a parameter (the generic
  // profile's Custom request) — the operator's choice wins then.
  const methodParam = command.params.find((p) => p.name === "method");
  const method =
    methodParam && values["method"] ? values["method"].trim().toUpperCase() : command.payload.method;
  let body: string | undefined;
  if (command.payload.body !== undefined) {
    body = renderTemplateLine(command.payload.body, command, values) ?? undefined;
  }
  return { method, path, body };
}

/**
 * Check the operator's values against the parameter shapes BEFORE
 * anything is sent: required present, numbers numeric and inside
 * their bounds, selects among their options. Returns the first
 * problem in plain words, or null when the values are fit to send.
 */
export function validateCommandValues(
  command: DeviceCommand,
  values: Record<string, string>,
): string | null {
  for (const param of command.params) {
    const raw = (values[param.name] ?? param.default ?? "").trim();
    if (!raw) {
      if (param.required) return `${param.label} is needed before this can be sent.`;
      continue;
    }
    if (param.kind === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return `${param.label} must be a number — "${raw}" is not one.`;
      if (param.min !== undefined && n < param.min)
        return `${param.label} cannot be below ${param.min}.`;
      if (param.max !== undefined && n > param.max)
        return `${param.label} cannot be above ${param.max}.`;
    }
    if (param.kind === "select" && param.options && !param.options.includes(raw)) {
      return `${param.label} must be one of: ${param.options.join(", ")}.`;
    }
  }
  return null;
}

/** Split a print file into sendable lines: blanks and ";" comments go. */
export function gcodeFileLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const cut = line.indexOf(";");
      return (cut >= 0 ? line.slice(0, cut) : line).trim();
    })
    .filter(Boolean);
}

/* --------------------------- built-in: 3D printer --------------------------- */

const PRINTER_COMMANDS: DeviceCommand[] = [
  {
    id: "home",
    name: "Home",
    help: "Send the print head to its home position on every axis.",
    params: [],
    payload: { kind: "lines", lines: ["G28"] },
  },
  {
    id: "move",
    name: "Move",
    help: "Move the head (and bed, on Y) to a position, in millimetres. Leave an axis blank to hold it where it is.",
    params: [
      { name: "x", label: "X position (mm)", kind: "number", min: 0, max: 1000, format: "X{v}" },
      { name: "y", label: "Y position (mm)", kind: "number", min: 0, max: 1000, format: "Y{v}" },
      { name: "z", label: "Z height (mm)", kind: "number", min: 0, max: 1000, format: "Z{v}" },
      {
        name: "feed",
        label: "Speed (mm/min)",
        kind: "number",
        min: 1,
        max: 30000,
        default: "3000",
        format: "F{v}",
      },
    ],
    payload: { kind: "lines", lines: ["G90", "G1 {x} {y} {z} {feed}"] },
    safety: "Watch the printer while it moves — a wrong number drives the head into the frame.",
  },
  {
    id: "heat-nozzle",
    name: "Heat nozzle",
    help: "Set the nozzle temperature and start heating. Status reads the real temperature back.",
    params: [
      {
        name: "temp",
        label: "Nozzle temperature (°C)",
        kind: "number",
        required: true,
        min: 0,
        max: 300,
      },
    ],
    payload: { kind: "lines", lines: ["M104 S{temp}"] },
    safety: "A hot nozzle burns. 0 turns the heater off.",
  },
  {
    id: "heat-bed",
    name: "Heat bed",
    help: "Set the bed temperature and start heating. Status reads the real temperature back.",
    params: [
      { name: "temp", label: "Bed temperature (°C)", kind: "number", required: true, min: 0, max: 150 },
    ],
    payload: { kind: "lines", lines: ["M140 S{temp}"] },
    safety: "0 turns the bed heater off.",
  },
  {
    id: "status",
    name: "Status",
    help: "Ask the printer where it stands: nozzle and bed temperatures, head position. What comes back is the printer's own answer — nothing answers, status reads UNAVAILABLE.",
    params: [],
    payload: { kind: "lines", lines: ["M105", "M114"] },
  },
  {
    id: "print-file",
    name: "Print a file",
    help: "Send a G-code file to the printer line by line and print it. This is the entry point the CAD bench will feed — any G-code text can be printed through here.",
    params: [],
    payload: { kind: "file" },
    safety: "The printer starts moving and heating as the file commands it. Stay with it for the first layer.",
  },
  {
    id: "pause",
    name: "Pause print",
    help: "Pause the print that is running from the printer's card/host stream.",
    params: [],
    payload: { kind: "lines", lines: ["M25"] },
  },
  {
    id: "resume",
    name: "Resume print",
    help: "Resume a paused print.",
    params: [],
    payload: { kind: "lines", lines: ["M24"] },
  },
  {
    id: "cancel",
    name: "Cancel print",
    help: "Stop the print, turn both heaters off, and release the motors.",
    params: [],
    payload: { kind: "lines", lines: ["M25", "M104 S0", "M140 S0", "M84"] },
    safety: "The print is lost. The heaters go cold.",
  },
];

export const PRINTER_GCODE_PROFILE: DeviceCommandProfile = {
  id: "printer-gcode",
  name: "3D printer (G-code)",
  deviceClass: "A G-code 3D printer — Marlin-style firmware, the common kind",
  transport: "usb-serial",
  addressPattern: "The USB port the printer appears as when its cable is plugged in, at 115200 baud",
  baudRate: 115200,
  commands: PRINTER_COMMANDS,
  setupSteps: [
    "Plug the printer's USB cable into this device (or into the Parrot, for the bridge path).",
    "Turn the printer on. Its screen should light and it should answer as a serial port.",
    "Pick this profile, tap Connect, and choose the printer's port in the browser's list.",
    "Send Status first. Real temperatures back = the printer is truly on the line.",
  ],
  safetyNotes: [
    "Heaters and moving axes are real. Commands here move a physical machine — the operator stays where he can see it for motion and heat.",
    "Nothing in this profile warms a heater or moves an axis on its own: every line goes out only when the operator sends it.",
  ],
  builtin: true,
};

/* --------------------- built-in: generic network HTTP --------------------- */

export const GENERIC_HTTP_PROFILE: DeviceCommandProfile = {
  id: "network-http-generic",
  name: "Network device (web requests)",
  deviceClass: "Any device on your own network that takes web (HTTP) commands — cameras, smart plugs, controllers",
  transport: "network-http",
  addressPattern: "The device's address on your network, like http://192.168.1.50 — commands ride on the end of it",
  commands: [
    {
      id: "status-check",
      name: "Status check",
      help: "Ask the device at its address and show what it answers. An answer means it is on the network; silence reads UNAVAILABLE.",
      params: [
        {
          name: "path",
          label: "Path to ask",
          kind: "text",
          default: "/",
          help: "The part after the address — many devices answer at / or a status path from their manual.",
        },
      ],
      payload: { kind: "http", method: "GET", path: "{path}" },
    },
    {
      id: "custom-request",
      name: "Custom request",
      help: "Send one web request you define: a method, a path on the device, and a body when the command carries one. This is how a camera's move command or a plug's switch command is expressed — the device's manual names the path.",
      params: [
        {
          name: "method",
          label: "Method",
          kind: "select",
          required: true,
          default: "GET",
          options: ["GET", "POST", "PUT", "DELETE"],
        },
        {
          name: "path",
          label: "Path",
          kind: "text",
          required: true,
          help: "The part after the device address, e.g. /cgi-bin/ptz.cgi?action=start&channel=0",
        },
        {
          name: "body",
          label: "Body (when the command carries one)",
          kind: "text",
          help: "Sent exactly as written. Leave blank for commands that carry nothing.",
        },
      ],
      payload: { kind: "http", method: "GET", path: "{path}", body: "{body}" },
    },
  ],
  setupSteps: [
    "Put the device on your own network and find its address (its app or your router's client list shows it).",
    "Pick this profile and write the address, e.g. http://192.168.1.50.",
    "Send Status check. An answer of any kind = the device hears you at that address.",
    "Add the device's own commands from its manual with “Add this device's commands” — each one is a name plus the path it sends.",
  ],
  safetyNotes: [
    "Only devices on your own network, and only ones the Permission Law has cleared for control on their registry card.",
    "A command is a real request to a real device: a path from a manual, sent once, when the operator taps Send.",
  ],
  builtin: true,
};

/* ----------------- built-in: Wepwawet, the robot dog ----------------- */

/**
 * One dog action as profile data: sendData(0, N) → D3=0, D4=N,
 * the protocol's §6.1 encoding. Burst 500 ms, then the zero frame —
 * the send engine appends the trailing zero itself. Movement
 * bursts hold 3000 ms: the protocol's voice-command hold (§3.4),
 * and the hold the first live test proved on the real dog
 * (2026-11-24) — a shorter movement burst is unproven.
 */
function dogAction(
  id: string,
  name: string,
  d4: number,
  help: string,
  safety?: string,
  holdMs = 500,
): DeviceCommand {
  return {
    id,
    name,
    help,
    params: [],
    payload: { kind: "ble-broadcast", cmd: 0xe0, data: [0, 0, 0, 0, d4], holdMs },
    ...(safety ? { safety } : {}),
  };
}

/** A §6.2 mode/content code: sendData(x, 0) → D3=x, D4=0. */
function dogMode(id: string, name: string, d3: number, help: string): DeviceCommand {
  return {
    id,
    name,
    help,
    params: [],
    payload: { kind: "ble-broadcast", cmd: 0xe0, data: [0, 0, 0, d3, 0], holdMs: 500 },
  };
}

/** A sendData2 code: D2=x, D3=y, D4=0 (song, rotations). */
function dogData2(
  id: string,
  name: string,
  d2: number,
  d3: number,
  help: string,
): DeviceCommand {
  return {
    id,
    name,
    help,
    params: [],
    payload: { kind: "ble-broadcast", cmd: 0xe0, data: [0, 0, d2, d3, 0], holdMs: 500 },
  };
}

const FEED_CODES: [string, number][] = [
  ["feed-1", 19],
  ["feed-2", 18],
  ["feed-3", 21],
  ["feed-4", 20],
  ["feed-5", 22],
  ["feed-6", 25],
  ["feed-7", 24],
  ["feed-8", 23],
];

const WEPWAWET_COMMANDS: DeviceCommand[] = [
  // STOP IS ALWAYS FIRST — the profile's standing safety shape.
  dogAction(
    "stop",
    "Stop",
    1,
    "Stop — the command that stills the dog. It is the first command on this profile on purpose: whatever else is happening, this is the one in reach.",
    "Send Stop first in any test, and any time the dog does something unexpected.",
  ),
  {
    id: "match",
    name: "Match / connect",
    help: "The match frame — the knock the vendor app sends when its advertising starts, before any command. Whether the dog requires it after power-on is a live-test question; the Parrot sender opens every session with it.",
    params: [],
    payload: { kind: "ble-broadcast", cmd: 0xd0, data: [0, 0, 0, 0, 0], holdMs: 500 },
  },
  dogAction("forward", "Forward", 2, "Walk forward. A timed burst, then the zero frame — the dog walks for the burst, it does not latch on.", "Movement. The dog must be in sight, on the floor, with room ahead of it.", 3000),
  dogAction("back", "Back", 3, "Walk backward, one timed burst, then the zero frame.", "Movement. The dog cannot see behind itself — neither can this protocol. Clear the space behind it first.", 3000),
  dogAction("turn-left", "Turn left", 4, "Turn left, one timed burst, then the zero frame.", "Movement. Keep the dog in sight while it turns.", 3000),
  dogAction("turn-right", "Turn right", 5, "Turn right, one timed burst, then the zero frame.", "Movement. Keep the dog in sight while it turns.", 3000),
  dogAction("sit", "Sit", 6, "Sit down."),
  dogAction("lie-down", "Lie down", 7, "Lie down (get down)."),
  dogAction("coquetry", "Act cute", 8, "Act coquettishly — the dog's act-cute routine."),
  dogAction("pee", "Pee", 9, "The pee routine — a leg-lift act, no actual water involved."),
  dogAction("greet", "Greet", 10, "Greet / say hello — the dog's greeting routine."),
  dogAction("handstand", "Handstand", 11, "Handstand.", "Give the dog floor room on every side before this one."),
  dogAction("push-ups", "Push-ups", 12, "Push-ups."),
  dogAction("dance", "Dance", 13, "Dance — the dog performs a built-in dance with its own music."),
  dogAction("kung-fu", "Kung fu", 14, "Kung fu routine.", "Give the dog floor room on every side before this one."),
  dogAction("swim", "Swim", 15, "Swimming routine — performed on dry land; this dog does not go in water for it."),
  dogAction("bless", "Bless", 16, "Blessing routine."),
  dogAction("patrol", "Patrol", 17, "Patrol — the dog walks its patrol routine on its own until stopped.", "Patrol keeps moving on its own. Stay where you can reach Stop, and watch where it goes."),
  ...FEED_CODES.map(([id, d4]) =>
    dogAction(
      id,
      `Feed ${id.slice(5)}`,
      d4,
      "A feeding item — the dog makes its eating sounds and motions for one pictured item. The eight codes are proven from the vendor app's code; which pictured item each code triggers is not named in the app and is confirmed at the first live session.",
    ),
  ),
  dogMode(
    "light",
    "Light",
    128,
    "The light command — the vendor app's light toggle frame, the only light frame the protocol has. It carries NO colour code: there is no 'steady red' frame to send. Whether one tap latches the light on, blinks it, or steps it through colours is an open question (protocol §10.6) that only a watched live session can answer — see the Light test note on this card.",
  ),
  dogMode(
    "music",
    "Music step",
    1,
    "Music — in the vendor app this frame (D3=1) appears as a step inside a recorded program. Sent on its own it is the dog's music trigger; which music he plays is his own built-in choice.",
  ),
  dogData2(
    "song",
    "Song",
    4,
    1,
    "Song — the dog plays one of its own built-in songs. The protocol carries no track number; which song plays is the dog's own choice.",
  ),
  dogMode("ai-content", "AI content", 32, "AI mode/content — the dog runs its built-in AI content."),
  dogMode("learn", "Learn / story", 16, "Learn — the dog plays its built-in learning/story content."),
  dogMode("fire", "Fire / combat", 8, "Fire / combat mode — the base dog's combat routine."),
  dogData2("rotate-left", "Rotate left", 128, 0, "Rotate left in place."),
  dogData2("rotate-right", "Rotate right", 64, 0, "Rotate right in place."),
  dogMode(
    "program-record",
    "Program — record mode",
    2,
    "Enter program-record mode: the dog records the steps sent after this, in its own memory. Steps sent in record mode carry the protocol's +2 offset — the Parrot sender's program sequence handles that shape; sending plain commands here records them as heard, which the first live session will verify.",
  ),
  {
    id: "program-execute",
    name: "Program — execute",
    help: "Run the recorded program. In record state the zero frame is the run trigger — this command IS the zero frame, sent on purpose. (Inferred from the vendor app's flow; confirmed at the first live session.)",
    params: [],
    payload: { kind: "ble-broadcast", cmd: 0xe0, data: [0, 0, 0, 0, 0], holdMs: 500 },
  },
];

/**
 * The dog's commands grouped for his card, in plain words (owner
 * order 2026-11-24: the full function set, grouped and labeled so
 * he can run the dog himself). Stop stands first, always. Every
 * command on the profile appears in exactly one group — a test
 * pins the coverage, so a command added to the profile without a
 * group fails loudly instead of vanishing from the card.
 */
/**
 * The Sounds group label and its triggers — the pick list (owner
 * order 2026-11-24): every built-in sound/content trigger the
 * protocol defines, each one individually sendable, each carrying
 * his Use / Never use pick on the card. The honest limit rides
 * with it: the vendor app's content lists (Dance ×5, Song ×5,
 * Story ×5, AI ×5) never encoded which item was tapped — each
 * category sends ONE frame and the dog picks the track inside.
 */
export const WEPWAWET_SOUND_GROUP_LABEL = "Sounds — everything he can say";
export const WEPWAWET_SOUND_TRIGGER_IDS = ["dance", "song", "learn", "ai-content", "music"];

export const WEPWAWET_COMMAND_GROUPS: { label: string; commandIds: string[] }[] = [
  { label: "Stop & connect", commandIds: ["stop", "match"] },
  {
    label: "Move",
    commandIds: ["forward", "back", "turn-left", "turn-right", "rotate-left", "rotate-right"],
  },
  {
    label: "Tricks & poses",
    commandIds: [
      "sit",
      "lie-down",
      "coquetry",
      "pee",
      "greet",
      "handstand",
      "push-ups",
      "kung-fu",
      "swim",
      "bless",
      "patrol",
    ],
  },
  {
    label: "Feeding — the eight pictured items",
    commandIds: ["feed-1", "feed-2", "feed-3", "feed-4", "feed-5", "feed-6", "feed-7", "feed-8"],
  },
  { label: WEPWAWET_SOUND_GROUP_LABEL, commandIds: WEPWAWET_SOUND_TRIGGER_IDS },
  { label: "Light & modes", commandIds: ["light", "fire"] },
  { label: "Program", commandIds: ["program-record", "program-execute"] },
];

export const WEPWAWET_DOG_PROFILE: DeviceCommandProfile = {
  id: "wepwawet-ble-broadcast",
  name: "Wepwawet — robot dog (Bluetooth broadcast)",
  deviceClass:
    "The ATLAS robotic dog of the FENG MA family — Augie's body. It takes no Bluetooth connection at all: it listens for one-way BLE advertising broadcasts and obeys them.",
  transport: "bluetooth-broadcast",
  senderPath: "wepwawet/wepwawet-send.py",
  briefNote:
    "His broadcast control is byte-verified and PROVEN LIVE — on 2026-11-24, on the Captain's " +
    "order with him watching the dog in his hand, Augie's frames fired Stop, Forward, Stop " +
    "from the Parrot sender and the dog moved. The dog reports nothing back, and Augie cannot " +
    "speak words through him; Augie triggers his built-in sounds and actions only.",
  extras: {
    groups: WEPWAWET_COMMAND_GROUPS,
    soundGroupLabel: WEPWAWET_SOUND_GROUP_LABEL,
    soundTriggerIds: WEPWAWET_SOUND_TRIGGER_IDS,
    soundNote:
      "These are all the sounds he has — nothing beyond this list exists. Inside each " +
      "one, the dog picks the track himself: the vendor app's lists (five dances, five " +
      "songs, five stories, five AI pieces) never encoded which item was tapped — every " +
      "tap sent this one frame — so Augie cannot pick the track either. His trick " +
      "noises ride with the tricks themselves, under Tricks & poses. Set each one " +
      "Use or Never use — that pick is yours and it sticks on this machine.",
    remote: {
      pad: { ...WEPWAWET_REMOTE_PAD },
      actions: WEPWAWET_REMOTE_ACTIONS,
      feed: WEPWAWET_REMOTE_FEED,
    },
    batteryLog: true,
    howto: {
      title: "How to control Wepwawet",
      steps: [
        "Wake him: press-and-hold the switch under the dog until he answers with his voice prompt.",
        "Keep him near the Parrot, in the same room — the commands ride the Parrot's Bluetooth, and Augie must be open through the Parrot's own server for the buttons to reach him.",
        "Just woke him? Tap “Match / connect” once first — the knock the vendor app sends when it starts.",
        "Tap a command below. STOP is always at the top — tap it any time he does something unexpected.",
        "Or drive him with the remote above — no talking needed: click the pad to walk and turn him, click a trick or Feed button, and click Stop in the middle of the pad to stop him. The remote follows the same Practice / LIVE switch as everything else on this card.",
        "Adding your own: “Change command setup” below lets you add commands to his card, and every command on the card runs the same way.",
      ],
      notes: [
        "He never answers back: a sent command means the frames went on air — your eyes confirm he obeyed.",
        "Talk: Wepwawet speaks only his own built-in sounds and songs (Song, AI content, Learn / story). Augie cannot put your words in his mouth.",
        "Light test — still an open question: the light has ONE toggle frame and no colour code anywhere in the protocol, so there is no “steady red” frame to send. At the next watched session we step Light while you watch and write down what it does — latch on, blink, or step through colours — until a steady red is found or proven absent. Nothing about the light is guessed before that session.",
      ],
    },
  },
  addressPattern:
    "Augie's AppID for the dog — 8 hex characters (his is A947C15E). It is the sender name carried inside every frame. The dog's own frame address is fixed in the protocol; there is no per-dog address to enter.",
  commands: WEPWAWET_COMMANDS,
  setupSteps: [
    "The dog's registry card carries the grant: owner-confirmed, and control granted by the Captain on 2026-11-23 — his standing order that Augie control this dog directly.",
    "Bind this profile to the dog's card. The address is Augie's AppID: A947C15E.",
    "Sending runs from inside Augie now: tap a command on this card and Augie's server hands the frame to the sender at ~/augie-tools/wepwawet/ on the Parrot, which puts it on air from the Parrot's Bluetooth (the bridge — a browser cannot advertise, so the Parrot fires). The card's switch chooses Practice (the sender prints the frames, nothing on air) or LIVE (the dog moves). Augie must be open through the Parrot's own server for the buttons to reach the sender.",
    "First live test happened on the Captain's word on 2026-11-24 — Stop, one Forward burst, Stop — and he watched the dog move. The full procedure is written in the manual's Wepwawet entry.",
  ],
  safetyNotes: [
    "TRANSMIT-ONLY: the dog never answers. A command marked sent means the frames went on air — never that the dog obeyed. The dog itself, watched, is the only confirmation there is.",
    "Every movement command is a timed burst followed by the zero frame; nothing latches. Stop is the first command on the profile and the sender leads with it in every test.",
    "The protocol has NO authentication — fixed address, fixed keys (protocol §4/§9). Anyone in Bluetooth range with this protocol can command the dog. That is the vendor's design, recorded plainly, not Augie's choice.",
    "LIGHT: one toggle frame, and no colour selection exists anywhere in the protocol — a steady red cannot be commanded, only discovered. If repeated Light taps cycle the light's colours, a watched session will find the red; if they only blink it, no frame Augie can send will hold it steady (protocol §10.6).",
    "Augie cannot hear the dog, read its battery, or speak words through it — the protocol only triggers the dog's built-in actions and sounds (protocol §8).",
  ],
  builtin: true,
};

export const BUILTIN_COMMAND_PROFILES: DeviceCommandProfile[] = [
  PRINTER_GCODE_PROFILE,
  GENERIC_HTTP_PROFILE,
  WEPWAWET_DOG_PROFILE,
];

/* ------------------------------ sanitizing ------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

const TRANSPORTS = new Set<string>(Object.keys(COMMAND_TRANSPORT_LABELS));
const PARAM_KINDS = new Set<string>(["number", "text", "select"]);
const MAX_COMMANDS_PER_PROFILE = 48;
const MAX_PARAMS_PER_COMMAND = 12;

function cleanString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function sanitizeParam(v: unknown): CommandParam | null {
  if (!isRecord(v)) return null;
  const name = cleanString(v["name"], 32)?.replace(/[^a-zA-Z0-9_-]/g, "");
  const label = cleanString(v["label"], 80);
  if (!name || !label) return null;
  const kind =
    typeof v["kind"] === "string" && PARAM_KINDS.has(v["kind"])
      ? (v["kind"] as CommandParamKind)
      : "text";
  return {
    name,
    label,
    kind,
    required: v["required"] === true ? true : undefined,
    min: typeof v["min"] === "number" && Number.isFinite(v["min"]) ? v["min"] : undefined,
    max: typeof v["max"] === "number" && Number.isFinite(v["max"]) ? v["max"] : undefined,
    default: cleanString(v["default"], 200),
    options: Array.isArray(v["options"])
      ? v["options"]
          .filter((o): o is string => typeof o === "string" && o.trim() !== "")
          .map((o) => o.trim().slice(0, 40))
          .slice(0, 12)
      : undefined,
    format: cleanString(v["format"], 24),
    help: cleanString(v["help"], 200),
  };
}

/** Validate one command payload — shared with the device registry,
 *  whose control-map entries may carry an executable payload. */
export function sanitizeCommandPayload(v: unknown): CommandPayload | null {
  if (!isRecord(v)) return null;
  if (v["kind"] === "lines") {
    const lines = Array.isArray(v["lines"])
      ? v["lines"]
          .filter((l): l is string => typeof l === "string" && l.trim() !== "")
          .map((l) => l.trim().slice(0, 300))
          .slice(0, 32)
      : [];
    return lines.length ? { kind: "lines", lines } : null;
  }
  if (v["kind"] === "http") {
    const method = ["GET", "POST", "PUT", "DELETE"].includes(String(v["method"]))
      ? (v["method"] as "GET" | "POST" | "PUT" | "DELETE")
      : "GET";
    const path = cleanString(v["path"], 400);
    if (!path) return null;
    return { kind: "http", method, path, body: cleanString(v["body"], 1000) };
  }
  if (v["kind"] === "file") {
    return { kind: "file" };
  }
  if (v["kind"] === "ble-broadcast") {
    const cmd = v["cmd"];
    const holdMs = v["holdMs"];
    const data = v["data"];
    const byte = (n: unknown): n is number =>
      typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255;
    if (!byte(cmd)) return null;
    if (!Array.isArray(data) || data.length !== 5 || !data.every(byte)) return null;
    if (
      typeof holdMs !== "number" ||
      !Number.isInteger(holdMs) ||
      holdMs < 50 ||
      holdMs > 10000
    ) {
      return null;
    }
    return {
      kind: "ble-broadcast",
      cmd,
      data: [data[0]!, data[1]!, data[2]!, data[3]!, data[4]!],
      holdMs,
    };
  }
  return null;
}

export function sanitizeCommand(v: unknown): DeviceCommand | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 48);
  const name = cleanString(v["name"], 80);
  const payload = sanitizeCommandPayload(v["payload"]);
  if (!id || !name || !payload) return null;
  const params = Array.isArray(v["params"])
    ? v["params"]
        .map(sanitizeParam)
        .filter((p): p is CommandParam => p !== null)
        .slice(0, MAX_PARAMS_PER_COMMAND)
    : [];
  return {
    id,
    name,
    help: cleanString(v["help"], 300) ?? "",
    params,
    payload,
    safety: cleanString(v["safety"], 300),
  };
}

const MAX_EXTRA_GROUPS = 12;
const MAX_EXTRA_IDS = 64;

function sanitizeExtras(v: unknown): ProfileCardExtras | undefined {
  if (!isRecord(v)) return undefined;
  const idList = (raw: unknown): string[] =>
    Array.isArray(raw)
      ? raw
          .filter((s): s is string => typeof s === "string" && s.trim() !== "")
          .map((s) => s.trim().slice(0, 48))
          .slice(0, MAX_EXTRA_IDS)
      : [];
  const groups = Array.isArray(v["groups"])
    ? v["groups"]
        .filter(isRecord)
        .map((g) => ({
          label: cleanString(g["label"], 80) ?? "",
          commandIds: idList(g["commandIds"]),
        }))
        .filter((g) => g.label && g.commandIds.length)
        .slice(0, MAX_EXTRA_GROUPS)
    : [];
  const remoteRaw = isRecord(v["remote"]) ? v["remote"] : null;
  const padRaw = remoteRaw && isRecord(remoteRaw["pad"]) ? remoteRaw["pad"] : null;
  const padId = (key: string): string => cleanString(padRaw?.[key], 48) ?? "";
  const remote =
    padRaw && padId("up") && padId("left") && padId("center") && padId("right") && padId("down")
      ? {
          pad: {
            up: padId("up"),
            left: padId("left"),
            center: padId("center"),
            right: padId("right"),
            down: padId("down"),
          },
          actions: idList(remoteRaw?.["actions"]),
          feed: idList(remoteRaw?.["feed"]),
        }
      : undefined;
  const howtoRaw = isRecord(v["howto"]) ? v["howto"] : null;
  const howtoList = (raw: unknown): string[] =>
    Array.isArray(raw)
      ? raw
          .filter((s): s is string => typeof s === "string" && s.trim() !== "")
          .map((s) => s.trim().slice(0, 600))
          .slice(0, 12)
      : [];
  const howto =
    howtoRaw && cleanString(howtoRaw["title"], 80)
      ? {
          title: cleanString(howtoRaw["title"], 80)!,
          steps: howtoList(howtoRaw["steps"]),
          notes: howtoList(howtoRaw["notes"]),
        }
      : undefined;
  const extras: ProfileCardExtras = {
    groups: groups.length ? groups : undefined,
    soundGroupLabel: cleanString(v["soundGroupLabel"], 80),
    soundNote: cleanString(v["soundNote"], 900),
    soundTriggerIds: idList(v["soundTriggerIds"]).length
      ? idList(v["soundTriggerIds"])
      : undefined,
    remote,
    batteryLog: v["batteryLog"] === true ? true : undefined,
    howto,
  };
  return Object.values(extras).some((x) => x !== undefined) ? extras : undefined;
}

export function sanitizeCommandProfile(v: unknown): DeviceCommandProfile | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const name = cleanString(v["name"], 100);
  if (!id || !name) return null;
  const transport =
    typeof v["transport"] === "string" && TRANSPORTS.has(v["transport"])
      ? (v["transport"] as CommandTransport)
      : "network-http";
  const commands = Array.isArray(v["commands"])
    ? v["commands"]
        .map(sanitizeCommand)
        .filter((c): c is DeviceCommand => c !== null)
        .slice(0, MAX_COMMANDS_PER_PROFILE)
    : [];
  if (!commands.length) return null;
  const stringList = (key: string, max: number, cap: number) =>
    Array.isArray(v[key])
      ? v[key]
          .filter((s): s is string => typeof s === "string" && s.trim() !== "")
          .map((s) => s.trim().slice(0, max))
          .slice(0, cap)
      : [];
  return {
    id,
    name,
    deviceClass: cleanString(v["deviceClass"], 200) ?? "A device the operator configured",
    transport,
    senderPath: cleanString(v["senderPath"], 200),
    briefNote: cleanString(v["briefNote"], 600),
    extras: sanitizeExtras(v["extras"]),
    addressPattern: cleanString(v["addressPattern"], 300) ?? "",
    baudRate:
      typeof v["baudRate"] === "number" && Number.isInteger(v["baudRate"]) && v["baudRate"] > 0
        ? v["baudRate"]
        : undefined,
    commands,
    setupSteps: stringList("setupSteps", 300, 10),
    safetyNotes: stringList("safetyNotes", 300, 10),
    builtin: v["builtin"] === true,
  };
}
