/**
 * ANUBIS'S DEVICE TOOLS — the construct's hands on the device
 * system (owner order 2026-11-24: "Anubis must carry the same
 * capability the assistant used on Wepwawet — when the Captain
 * gets a device he owns, Anubis sets it up for remote control and
 * retains it in the system").
 *
 * Four tools, all working on the CORE state (deviceStoreCore):
 *   · registerDevice — a new device enters the registry with its
 *     earned control map (and a command profile, when one was
 *     authored with it). Registration NEVER sets the Permission
 *     Law flags: a device Anubis registers is mapped, not granted.
 *   · setDeviceFlags — Anubis may ASK for ownerConfirmed /
 *     controlGranted; the ask becomes a pending request the
 *     Captain confirms or denies. The construct never self-grants.
 *   · bindProfile — attach a command profile (and address) to a
 *     registered device.
 *   · sendDeviceCommand — fire one command through the send
 *     engine, which checks canControl BEFORE any channel opens.
 *     Refused when the flags are off; the refusal is logged in the
 *     core like every attempt.
 *
 * The honest limit, stated wherever these tools are described: no
 * tool invents a protocol. A device class's control map is earned
 * once — teardown, capture, or its manual — and from then on it is
 * registered, retained, and fireable.
 *
 * Pure over the state shape (the channel is injected), so the
 * whole surface is unit-testable without hardware.
 */
import {
  canControl,
  newDeviceId,
  retiredDateLabel,
  sanitizeProfile,
  type ControlAction,
  type DeviceKind,
  type DeviceProfile,
  type DeviceTransport,
} from "./deviceRegistry";
import {
  sanitizeCommandProfile,
  type DeviceCommandProfile,
} from "./commandProfiles";
import {
  sendDeviceCommand as engineSend,
  type CommandChannel,
  type SendOutcome,
} from "./commandModule";
import {
  effectiveProfiles,
  proposeFlagChange,
  resolveStateProfile,
  stateCommandsFor,
  type DeviceCoreState,
  type DeviceFlagRequest,
} from "./deviceStoreCore";

/* ----------------------------- register ------------------------------ */

export type RegisterDeviceDraft = {
  displayName: string;
  kind?: DeviceKind | undefined;
  transport?: DeviceTransport | undefined;
  externalId?: string | undefined;
  address?: string | undefined;
  protocol?: string | undefined;
  /** The earned control map — entries may carry payloads. */
  controls?: ControlAction[] | undefined;
  capabilities?: string[] | undefined;
  limitations?: string[] | undefined;
  /** A command profile authored alongside the registration. */
  profile?: DeviceCommandProfile | undefined;
  /** Or the id of an existing profile to bind. */
  bindProfileId?: string | undefined;
  /** The address the binding carries (AppID, http://…, port…). */
  bindingAddress?: string | undefined;
};

export type ToolResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Register a device in the core. The Permission Law is structural
 * here: the profile is built field by field and the two flags are
 * simply never written — a draft that tries to smuggle them in has
 * nowhere to land. Returns the new state and the device.
 */
export function toolRegisterDevice(
  state: DeviceCoreState,
  draft: RegisterDeviceDraft,
  now: number,
): ToolResult<{ state: DeviceCoreState; device: DeviceProfile }> {
  const name = draft.displayName?.trim();
  if (!name) return { ok: false, error: "A device needs a name to be registered." };
  const device = sanitizeProfile({
    id: newDeviceId(),
    displayName: name.slice(0, 120),
    kind: draft.kind ?? "other",
    transport: draft.transport ?? "other",
    externalId: draft.externalId ?? "",
    address: draft.address,
    protocol: draft.protocol,
    controls: draft.controls,
    source: "manual",
    declaredServices: [],
    capabilities: draft.capabilities ?? [],
    limitations: draft.limitations ?? [],
    batteryLevel: null,
    measured: {},
    presence: "unknown",
    presenceEvents: [],
    firstSeen: now,
    lastSeen: now,
  });
  if (!device) return { ok: false, error: "The device draft did not survive validation." };

  let profiles = state.profiles;
  let bindingProfileId: string | null = null;
  if (draft.profile) {
    const profile = sanitizeCommandProfile({ ...draft.profile, builtin: false });
    if (!profile) {
      return { ok: false, error: "The command profile authored with this device is not valid." };
    }
    profiles = [...profiles.filter((p) => p.id !== profile.id), profile];
    bindingProfileId = profile.id;
  } else if (draft.bindProfileId) {
    const known = effectiveProfiles({ ...state, profiles }).some(
      (p) => p.id === draft.bindProfileId,
    );
    if (!known) {
      return { ok: false, error: `No command profile with id "${draft.bindProfileId}" exists.` };
    }
    bindingProfileId = draft.bindProfileId;
  }

  const next: DeviceCoreState = {
    ...state,
    registry: [device, ...state.registry],
    profiles,
    bindings: bindingProfileId
      ? {
          ...state.bindings,
          [device.id]: {
            deviceId: device.id,
            profileId: bindingProfileId,
            address: (draft.bindingAddress ?? draft.address ?? "").slice(0, 300),
          },
        }
      : state.bindings,
    updatedAt: now,
  };
  return { ok: true, value: { state: next, device } };
}

/* ------------------------------- flags -------------------------------- */

/**
 * Anubis asks for a Permission Law flag change. The ask is filed
 * as a pending request for the Captain — the flags themselves do
 * not move. (The Captain's own hand, in the Devices window or by
 * confirming the request, is the only road to a grant.)
 */
export function toolSetDeviceFlags(
  state: DeviceCoreState,
  args: {
    deviceId: string;
    ownerConfirmed?: boolean | undefined;
    controlGranted?: boolean | undefined;
    summonsMe?: boolean | undefined;
    reason: string;
    now: number;
  },
): ToolResult<{ state: DeviceCoreState; request: DeviceFlagRequest }> {
  const proposed = proposeFlagChange(state, args);
  if (!proposed) {
    return {
      ok: false,
      error:
        "No flag request was filed — the device is unknown, or the flags already stand as proposed. Nothing changed.",
    };
  }
  return { ok: true, value: proposed };
}

/* ------------------------------- binding ------------------------------- */

export function toolBindProfile(
  state: DeviceCoreState,
  args: {
    deviceId: string;
    profileId: string;
    address?: string | undefined;
    customProfile?: DeviceCommandProfile | undefined;
    now: number;
  },
): ToolResult<{ state: DeviceCoreState }> {
  const device = state.registry.find((d) => d.id === args.deviceId);
  if (!device) return { ok: false, error: `No device with id "${args.deviceId}" is registered.` };
  let profiles = state.profiles;
  if (args.customProfile) {
    const profile = sanitizeCommandProfile({ ...args.customProfile, builtin: false });
    if (!profile || profile.id !== args.profileId) {
      return { ok: false, error: "The custom profile is not valid for this binding." };
    }
    profiles = [...profiles.filter((p) => p.id !== profile.id), profile];
  } else if (!effectiveProfiles({ ...state, profiles }).some((p) => p.id === args.profileId)) {
    return { ok: false, error: `No command profile with id "${args.profileId}" exists.` };
  }
  return {
    ok: true,
    value: {
      state: {
        ...state,
        profiles,
        bindings: {
          ...state.bindings,
          [args.deviceId]: {
            deviceId: args.deviceId,
            profileId: args.profileId,
            address: (args.address ?? state.bindings[args.deviceId]?.address ?? "").slice(0, 300),
            ...(args.customProfile
              ? { customProfile: sanitizeCommandProfile({ ...args.customProfile, builtin: false }) ?? undefined }
              : {}),
          },
        },
        updatedAt: args.now,
      },
    },
  };
}

/* -------------------------------- send --------------------------------- */

export type ConstructSendArgs = {
  deviceId: string;
  commandId: string;
  values?: Record<string, string> | undefined;
  channel: CommandChannel | null;
  channelUnavailableReason?: string | undefined;
  now: number;
};

/**
 * Fire one command as the construct. The send engine checks the
 * Permission Law before the channel is touched; the attempt's log
 * entry lands in the CORE state's log through the engine's sink.
 */
export async function toolSendDeviceCommand(
  state: DeviceCoreState,
  args: ConstructSendArgs,
): Promise<ToolResult<{ state: DeviceCoreState; outcome: SendOutcome }>> {
  const device = state.registry.find((d) => d.id === args.deviceId);
  if (!device) return { ok: false, error: `No device with id "${args.deviceId}" is registered.` };
  const resolved = resolveStateProfile(state, device);
  if (!resolved) {
    return {
      ok: false,
      error: `${device.displayName} has no command set — no profile is bound and its control map carries no payloads. Nothing was sent.`,
    };
  }
  const command = stateCommandsFor(state, device).find((c) => c.id === args.commandId);
  if (!command) {
    return {
      ok: false,
      error: `${device.displayName} has no command "${args.commandId}" in its command set. Nothing was sent.`,
    };
  }
  let log = state.log;
  const outcome = await engineSend({
    device,
    profile: resolved.profile,
    command,
    values: args.values ?? {},
    address: resolved.binding?.address,
    channel: args.channel,
    channelUnavailableReason: args.channelUnavailableReason,
    allStopActive: state.allStop.active,
    now: args.now,
    onLog: (entry) => {
      log = [...log, { ...entry, id: `cmdlog-${entry.at}-construct` }].slice(-200);
    },
  });
  return {
    ok: true,
    value: { state: { ...state, log, updatedAt: args.now }, outcome },
  };
}

/* ------------------------- intent (his word) --------------------------- */

export type DeviceCommandIntent = {
  deviceId: string;
  deviceName: string;
  commandId: string;
  commandName: string;
};

function normalizeWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function commandKey(text: string): string {
  return normalizeWords(text).replace(/[\s_]+/g, "-");
}

/** The names a device answers to in an order: its display name,
 *  and — for the dog — "the dog"/"dog", the Captain's own words. */
function deviceAliases(state: DeviceCoreState, device: DeviceProfile): string[] {
  const aliases = new Set<string>();
  const name = normalizeWords(device.displayName);
  if (name) aliases.add(name);
  const binding = state.bindings[device.id];
  if (binding?.profileId === "wepwawet-ble-broadcast" || /^wepwawet/.test(name)) {
    aliases.add("the dog");
    aliases.add("dog");
    aliases.add("wepwawet");
  }
  return [...aliases].sort((a, b) => b.length - a.length);
}

/**
 * Read a direct device order out of the Captain's words:
 *   "tell Wepwawet to sit" · "have the dog dance" · "Wepwawet: stop"
 *   "tell the dog to feed 3" · "make Wepwawet lie down"
 * Conservative by design: the device must be named, and what
 * follows must be EXACTLY one of its command names — a near miss
 * is conversation, not an order, and falls through to the brain.
 */
export function parseDeviceCommandIntent(
  text: string,
  state: DeviceCoreState,
): DeviceCommandIntent | null {
  const clean = normalizeWords(text).replace(/^(please\s+)/, "");
  for (const device of state.registry) {
    // A retired device takes no orders — the words fall through
    // to the brain as conversation, where the brief tells Anubis
    // the device is gone.
    if (device.retired) continue;
    const commands = stateCommandsFor(state, device);
    if (!commands.length) continue;
    for (const alias of deviceAliases(state, device)) {
      const rests: string[] = [];
      for (const prefix of [
        `tell ${alias} to `,
        `tell ${alias} `,
        `have ${alias} `,
        `ask ${alias} to `,
        `make ${alias} `,
        `make ${alias} to `,
        `${alias}: `,
        `${alias} — `,
        `${alias} - `,
      ]) {
        if (clean.startsWith(prefix)) rests.push(clean.slice(prefix.length));
      }
      // "<command> the dog" — e.g. "stop the dog".
      if (clean.endsWith(` ${alias}`)) {
        rests.push(clean.slice(0, clean.length - alias.length - 1));
      }
      for (const rest of rests) {
        const wanted = commandKey(rest.replace(/^(to\s+)/, ""));
        const command = commands.find(
          (c) => commandKey(c.name) === wanted || commandKey(c.id) === wanted,
        );
        if (command) {
          return {
            deviceId: device.id,
            deviceName: device.displayName,
            commandId: command.id,
            commandName: command.name,
          };
        }
      }
    }
  }
  return null;
}

/* ------------------------- the generated brief -------------------------- */

/**
 * The capability brief's device lines, GENERATED from the registry
 * — Anubis's knowledge of devices is read from the same state the
 * Captain's Devices window shows, so it can never drift from it.
 * Change the registry and these lines change; remove a device and
 * its line is gone.
 */
export function deviceBriefLines(
  state: DeviceCoreState,
  variant: "full" | "short" = "full",
): string[] {
  const lines: string[] = [];
  if (state.allStop.active) {
    // THE ALL-STOP STANDS: the brief says so first, so no
    // construct ever offers to fire a command the Captain has
    // halted — the refusal would land anyway, but the truth
    // belongs up front.
    lines.push(
      "THE ALL-STOP IS IN FORCE: the Captain has halted every device command. Do not offer to send any device command, and do not try — every send is refused until he releases the stop in the Devices window.",
    );
  }
  for (const device of state.registry) {
    if (device.retired) {
      // RETIRED — stated as gone, in both variants, with no
      // command set and no profile note: Anubis must never offer
      // to drive this device or describe it as a current one.
      const sold = retiredDateLabel(device.retired);
      lines.push(
        variant === "short"
          ? `${device.displayName}: RETIRED — sold ${sold}; no longer the Captain's. Never offer to drive it.`
          : `${device.displayName} (${device.kind}, ${device.transport}): RETIRED — sold on ${sold}. ` +
            "The Captain no longer has this device. Never offer to drive it, never describe it as a current " +
            "device, and never suggest sending it a command. Its card, control map, and command record " +
            "remain in the registry as history only.",
      );
      continue;
    }
    const resolved = resolveStateProfile(state, device);
    const commands = resolved ? stateCommandsFor(state, device) : [];
    const granted = canControl(device);
    const control = granted
      ? "Control is GRANTED by the Captain — you may fire its commands on his order"
      : "control is NOT granted — you may NOT control it, only speak of it as registered";
    const profile = resolved?.profile;
    const note = profile?.briefNote ? ` ${profile.briefNote}` : "";
    if (variant === "short") {
      lines.push(
        `${device.displayName}: ${granted ? "control GRANTED by the Captain" : "registered, control NOT granted"}.${note}`,
      );
    } else {
      lines.push(
        `${device.displayName} (${device.kind}, ${device.transport}): registered in the core. ` +
          (profile
            ? `Its command set is "${profile.name}" — ${commands.length} command${commands.length === 1 ? "" : "s"}. `
            : "It has no command set yet. ") +
          `${control}.${note}`,
      );
    }
  }
  return lines;
}
