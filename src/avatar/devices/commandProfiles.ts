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

export type CommandTransport =
  | "usb-serial"
  | "network-http"
  | "network-tcp"
  | "bluetooth"
  | "nods-session";

export const COMMAND_TRANSPORT_LABELS: Record<CommandTransport, string> = {
  "usb-serial": "USB serial cable",
  "network-http": "Network (web requests, HTTP)",
  "network-tcp": "Network (raw TCP socket)",
  bluetooth: "Bluetooth",
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

export type DeviceCommandProfile = {
  id: string;
  /** "3D printer (G-code)", "Network device (web requests)". */
  name: string;
  /** The class of device this profile speaks to, in plain words. */
  deviceClass: string;
  transport: CommandTransport;
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

export const BUILTIN_COMMAND_PROFILES: DeviceCommandProfile[] = [
  PRINTER_GCODE_PROFILE,
  GENERIC_HTTP_PROFILE,
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

function sanitizePayload(v: unknown): CommandPayload | null {
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
  return null;
}

export function sanitizeCommand(v: unknown): DeviceCommand | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 48);
  const name = cleanString(v["name"], 80);
  const payload = sanitizePayload(v["payload"]);
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
