/**
 * DEVICE COMMANDS PANEL — the Universal Command Module at the
 * Devices surface (operator order 2026-11-23). On a device's card:
 *
 *   · No command setup yet → "Commands" offers the setup flow:
 *     1) how Augie reaches it (transport), 2) which command set
 *     fits it (a profile from the library, or his own commands),
 *     3) its address. Each step carries one help line. Saving the
 *     setup adds NO power by itself — the Permission Law still
 *     gates every send from the card's two flags.
 *   · Setup exists → the commands, each with its fields and a Send
 *     button. Control not granted → the refusal stands in words
 *     and Send is closed. Every send (and refusal) lands in the
 *     command log shown under the card.
 *
 * The send paths are local: USB serial through the browser's
 * WebSerial where it exists, or plain requests on his own network.
 * A transport with no browser path says so — configured is not
 * the same as sendable, and the panel never blurs the two.
 */
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Cable, Pause, Plus, Send, Settings2, Trash2, X } from "lucide-react";
import {
  canControl,
  controlMapCommands,
  formatControlPayloadSegment,
  parseControlPayloadSegment,
  profileFromControlMap,
  type DeviceProfile,
} from "./deviceRegistry";
import {
  COMMAND_TRANSPORT_LABELS,
  type CommandTransport,
  type DeviceCommand,
  type DeviceCommandProfile,
} from "./commandProfiles";
import {
  BATTERY_MODES,
  addBatteryEntry,
  batteryModeLabel,
  loadBatteryLog,
  loadSoundOff,
  removeBatteryEntry,
  saveSoundOff,
  type BatteryModeId,
} from "./wepwawetCard";
import {
  allCommandProfiles,
  bindingCommands,
  createFetchHttpChannel,
  createParrotBroadcastChannel,
  loadBindings,
  loadCommandLog,
  logForDevice,
  openWebSerialChannel,
  printGcode,
  removeBinding,
  resolveBindingProfile,
  saveBinding,
  sendDeviceCommand,
  webSerialAvailable,
  type CommandChannel,
  type DeviceCommandBinding,
  type LineChannel,
  type ParrotBroadcastChannel,
  type SendOutcome,
} from "./commandModule";
import { pushDevicesToCore } from "./deviceCoreSync";

type SetupDraft = {
  transport: CommandTransport;
  profileId: string;
  customName: string;
  address: string;
  /** For a custom broadcast command set: the sender script's path
   *  under ~/augie-tools/ on the core (the bridge's allowlist). */
  senderPath: string;
  customCommands: { name: string; literal: string }[];
  newName: string;
  newLiteral: string;
};

const EMPTY_SETUP: SetupDraft = {
  transport: "usb-serial",
  profileId: "printer-gcode",
  customName: "",
  address: "",
  senderPath: "",
  customCommands: [],
  newName: "",
  newLiteral: "",
};

function defaultValues(command: DeviceCommand): Record<string, string> {
  const out: Record<string, string> = {};
  for (const param of command.params) {
    if (param.default !== undefined) out[param.name] = param.default;
  }
  return out;
}

export function DeviceCommandsPanel({ device }: { device: DeviceProfile }) {
  const [bindings, setBindings] = useState(loadBindings);
  const [log, setLog] = useState(loadCommandLog);
  const [showSetup, setShowSetup] = useState(false);
  const [setup, setSetup] = useState<SetupDraft>(EMPTY_SETUP);
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [serialChannel, setSerialChannel] = useState<LineChannel | null>(null);
  const [channelNote, setChannelNote] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, SendOutcome>>({});
  const [gcodeText, setGcodeText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const serialRef = useRef<LineChannel | null>(null);
  serialRef.current = serialChannel;
  // The dog bridge: practice is the standing default — the LIVE
  // switch is the Captain's own hand on the card, per session.
  const [dogLive, setDogLive] = useState(false);
  const [bridgeReceipts, setBridgeReceipts] = useState<string[]>([]);
  // The remote control's last click, so its outcome stands under
  // the remote itself and not only down in the command list.
  const [lastRemoteId, setLastRemoteId] = useState<string | null>(null);
  // The Captain's sound picks (Use / Never use per sound trigger)
  // and his battery-test log — his records, kept on this machine.
  const [soundOff, setSoundOff] = useState(loadSoundOff);
  const [batteryLog, setBatteryLog] = useState(loadBatteryLog);
  const [batteryMode, setBatteryMode] = useState<BatteryModeId>("idle");
  const [batteryMinutes, setBatteryMinutes] = useState("");
  const [batteryNote, setBatteryNote] = useState("");
  const bridgeRef = useRef<{ live: boolean; channel: ParrotBroadcastChannel } | null>(null);
  const bridgeChannel = (live: boolean): ParrotBroadcastChannel => {
    if (!bridgeRef.current || bridgeRef.current.live !== live) {
      // Through the GENERAL bridge, under this device's own id —
      // the core looks up its registered sender (the dog is #1).
      bridgeRef.current = {
        live,
        channel: createParrotBroadcastChannel({ live, deviceId: device.id }),
      };
    }
    return bridgeRef.current.channel;
  };

  const binding = bindings[device.id];
  const profiles = useMemo(() => allCommandProfiles(bindings), [bindings]);
  // ONE CONTROL MAP: with no binding, a device whose registry map
  // carries payloads still has a command set — the profile the map
  // itself generates.
  const mapProfile = useMemo(() => profileFromControlMap(device), [device]);
  const profile = binding ? resolveBindingProfile(binding, profiles) : mapProfile;
  const activeBinding: DeviceCommandBinding | undefined =
    binding ??
    (mapProfile
      ? { deviceId: device.id, profileId: mapProfile.id, address: device.address ?? "" }
      : undefined);
  /** The card furniture this device's profile declares (remote,
   *  groups, sound picks, battery log, how-to) — data, not an id
   *  check: the next device with the same shape gets the same card. */
  const extras = profile?.extras;
  const granted = canControl(device);

  /** The commands this card offers: the profile's, the binding's
   *  own, and the registry control map's payload-carrying entries —
   *  one merged list, deduped by id. */
  const mergedCommands = (
    b: DeviceCommandBinding,
    p: DeviceCommandProfile,
  ): DeviceCommand[] => {
    const out = [...bindingCommands(b, p)];
    for (const command of controlMapCommands(device)) {
      if (!out.some((c) => c.id === command.id)) out.push(command);
    }
    return out;
  };
  const deviceLog = logForDevice(log, device.id).slice(-5).reverse();

  const refreshStores = () => {
    setBindings(loadBindings());
    setLog(loadCommandLog());
    // The core keeps the record now: every change made here is
    // pushed up (best-effort — where no core answers, the local
    // stores stand and nothing pretends otherwise).
    void pushDevicesToCore();
  };

  const openSetup = () => {
    if (binding && profile) {
      setSetup({
        transport: profile.transport,
        profileId: profile.builtin ? profile.id : "custom",
        customName: profile.builtin ? "" : profile.name,
        address: binding.address,
        senderPath: profile.senderPath ?? "",
        customCommands: (binding.extraCommands ?? []).map((c) => ({
          name: c.name,
          literal:
            c.payload.kind === "lines"
              ? c.payload.lines.join("\n")
              : c.payload.kind === "http"
                ? c.payload.path
                : c.payload.kind === "ble-broadcast"
                  ? formatControlPayloadSegment(c.payload).replace(/^frame: /, "")
                  : "",
        })),
        newName: "",
        newLiteral: "",
      });
    } else {
      setSetup(EMPTY_SETUP);
    }
    setShowSetup(true);
  };

  const setupProfiles = profiles.filter((p) => p.transport === setup.transport);

  const saveSetup = () => {
    const slug = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "custom";
    const extras: DeviceCommand[] = setup.customCommands
      .filter((c) => c.name.trim() && c.literal.trim())
      .map((c, i): DeviceCommand | null => {
        // FRAME AUTHORING (plan item C): on the broadcast transport
        // the literal is a frame — command byte, five data bytes in
        // hex, hold in ms ("E0 00 00 00 00 02 500"). A frame that
        // does not parse is dropped, never half-saved.
        const framePayload =
          setup.transport === "bluetooth-broadcast"
            ? parseControlPayloadSegment(`frame: ${c.literal.trim()}`)
            : undefined;
        if (setup.transport === "bluetooth-broadcast" && !framePayload) return null;
        return {
          id: `custom-${slug(c.name)}-${i + 1}`,
          name: c.name.trim(),
          help: "A command the operator defined for this device.",
          params: [],
          payload:
            setup.transport === "network-http"
              ? { kind: "http" as const, method: "GET" as const, path: c.literal.trim() }
              : setup.transport === "bluetooth-broadcast"
                ? framePayload!
                : { kind: "lines" as const, lines: c.literal.split("\n").map((l) => l.trim()).filter(Boolean) },
        };
      })
      .filter((c): c is DeviceCommand => c !== null);
    let next: DeviceCommandBinding;
    if (setup.profileId === "custom") {
      if (!extras.length) return;
      const customProfile: DeviceCommandProfile = {
        id: `custom-${device.id}`,
        name: setup.customName.trim() || `${device.displayName} — his command set`,
        deviceClass: `A command set the operator built for ${device.displayName}`,
        transport: setup.transport,
        ...(setup.transport === "bluetooth-broadcast" && setup.senderPath.trim()
          ? { senderPath: setup.senderPath.trim() }
          : {}),
        addressPattern: "",
        commands: extras,
        setupSteps: [],
        safetyNotes: [],
        builtin: false,
      };
      next = {
        deviceId: device.id,
        profileId: customProfile.id,
        address: setup.address.trim(),
        customProfile,
      };
    } else {
      const chosen = profiles.find((p) => p.id === setup.profileId);
      if (!chosen) return;
      next = {
        deviceId: device.id,
        profileId: chosen.id,
        address: setup.address.trim(),
        extraCommands: extras.length ? extras : undefined,
      };
    }
    saveBinding(next);
    refreshStores();
    setShowSetup(false);
  };

  const channelFor = (p: DeviceCommandProfile): { channel: CommandChannel | null; reason?: string } => {
    if (p.transport === "usb-serial") {
      return serialRef.current
        ? { channel: serialRef.current }
        : {
            channel: null,
            reason: webSerialAvailable()
              ? "The printer is not connected yet — tap “Connect over USB” first, then send. Nothing was sent."
              : "USB serial is UNAVAILABLE in this browser — WebSerial needs Chrome or Edge on a computer or Android. Nothing was sent.",
          };
    }
    if (p.transport === "network-http") {
      return { channel: createFetchHttpChannel() };
    }
    if (p.transport === "bluetooth-broadcast") {
      // The Parrot bridge: Augie's server hands each frame to the
      // staged sender on the Parrot. Practice or LIVE follows the
      // switch on the card — the Captain's hand, never a default.
      return { channel: bridgeChannel(dogLive) };
    }
    return {
      channel: null,
      reason: `The ${COMMAND_TRANSPORT_LABELS[p.transport]} path has no send route in the browser yet. The commands are configured and saved; sending waits for that path (a NODS session or the Parrot bridge). Nothing was sent.`,
    };
  };

  const runSend = async (command: DeviceCommand) => {
    if (!profile || !activeBinding) return;
    setSending(command.id);
    try {
      const { channel, reason } = channelFor(profile);
      const commandValues = { ...defaultValues(command), ...(values[command.id] ?? {}) };
      const outcome =
        command.payload.kind === "file"
          ? await printGcode({
              device,
              profile,
              gcodeText,
              channel,
              channelUnavailableReason: reason,
              onProgress: (done, total) => setProgress({ done, total }),
            })
          : await sendDeviceCommand({
              device,
              profile,
              command,
              values: commandValues,
              address: activeBinding.address,
              channel,
              channelUnavailableReason: reason,
            });
      setOutcomes((current) => ({ ...current, [command.id]: outcome }));
    } finally {
      setSending(null);
      setLog(loadCommandLog());
      void pushDevicesToCore();
      if (profile.transport === "bluetooth-broadcast" && bridgeRef.current) {
        setBridgeReceipts([...bridgeRef.current.channel.receipts].slice(-4));
      }
    }
  };

  const connectSerial = async () => {
    if (!profile) return;
    const result = await openWebSerialChannel(profile.baudRate ?? 115200);
    if ("channel" in result) {
      setSerialChannel(result.channel);
      setChannelNote(`Connected — ${result.channel.transportLabel}. The printer is on the line.`);
    } else {
      setChannelNote(result.unavailable);
    }
  };

  const disconnectSerial = async () => {
    await serialRef.current?.close?.();
    setSerialChannel(null);
    setChannelNote("Disconnected. The printer is off the line.");
  };


  const commandItem = (command: DeviceCommand, extra?: React.ReactNode) => {
    const outcome = outcomes[command.id];
    const silenced =
      extras?.soundTriggerIds?.includes(command.id) === true && soundOff[command.id] === true;
    return (
                <li key={command.id} className="window-commands__item">
                  <div className="window-commands__head">
                    <strong>{command.name}</strong>
                    <button
                      type="button"
                      className="window-btn"
                      disabled={!granted || sending !== null || silenced}
                      onClick={() => void runSend(command)}
                    >
                      <Send aria-hidden="true" />{" "}
                      {sending === command.id ? "Sending…" : "Send"}
                    </button>
                  </div>
                  <p className="window-hint">{command.help}</p>
                  {command.safety && <p className="window-hint">Safety: {command.safety}</p>}
                  {silenced && (
                    <p className="window-hint" role="status">
                      Set to Never use by your sound pick — Send is off for this one.
                    </p>
                  )}
                  {extra}
                  {command.params.map((param) => (
                    <label key={param.name} className="window-commands__param">
                      {param.label}
                      {param.kind === "select" ? (
                        <select
                          value={(values[command.id]?.[param.name] ?? param.default ?? "") as string}
                          onChange={(e) =>
                            setValues((current) => ({
                              ...current,
                              [command.id]: {
                                ...defaultValues(command),
                                ...(current[command.id] ?? {}),
                                [param.name]: e.target.value,
                              },
                            }))
                          }
                        >
                          {(param.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={(values[command.id]?.[param.name] ?? param.default ?? "") as string}
                          inputMode={param.kind === "number" ? "decimal" : undefined}
                          onChange={(e) =>
                            setValues((current) => ({
                              ...current,
                              [command.id]: {
                                ...defaultValues(command),
                                ...(current[command.id] ?? {}),
                                [param.name]: e.target.value,
                              },
                            }))
                          }
                        />
                      )}
                      {param.help && <span className="window-hint">{param.help}</span>}
                    </label>
                  ))}
                  {command.payload.kind === "file" && (
                    <>
                      <label className="window-commands__param">
                        G-code to print
                        <textarea
                          rows={5}
                          value={gcodeText}
                          onChange={(e) => setGcodeText(e.target.value)}
                          placeholder={"G28\nG1 X10 Y10 F3000\nM104 S200"}
                        />
                        <span className="window-hint">
                          Help: paste the file's G-code, or load it from a file — the lines go to
                          the printer one by one.
                        </span>
                      </label>
                      <input
                        type="file"
                        accept=".gcode,.gco,.txt"
                        aria-label="Load a G-code file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void file.text().then(setGcodeText);
                        }}
                      />
                      {progress && sending === command.id && (
                        <p className="window-hint" role="status">
                          Sending: {progress.done} of {progress.total} lines acknowledged.
                        </p>
                      )}
                    </>
                  )}
                  {outcome && (
                    <p className="window-hint" role="status">
                      {outcome.result === "sent" ? "Sent — " : `${outcome.result}: `}
                      {outcome.note}
                    </p>
                  )}
                </li>
    );
  };

  const toggleSoundPick = (command: DeviceCommand) => {
    setSoundOff((current) => {
      const next = { ...current };
      if (next[command.id]) {
        delete next[command.id];
      } else {
        next[command.id] = true;
      }
      saveSoundOff(next);
      return next;
    });
  };

  const soundPickToggle = (command: DeviceCommand) => {
    const off = soundOff[command.id] === true;
    return (
      <div className="window-devices__actions">
        <button
          type="button"
          className="window-btn"
          role="switch"
          aria-checked={!off}
          aria-label={`Sound pick for ${command.name}`}
          onClick={() => toggleSoundPick(command)}
        >
          {off ? "Never use" : "Use"}
        </button>
        <span className="window-hint" role="status">
          {off
            ? "Your pick: never use this sound — its Send is off."
            : "Your pick: this sound may be used."}
        </span>
      </div>
    );
  };

  /**
   * THE REMOTE CONTROL (Captain's order 2026-11-24 ~11:21 EST) —
   * a clickable remote on the dog's card, modeled on the vendor
   * app's Control screen: direction pad with Stop in the middle,
   * trick/action buttons around it, the eight Feed buttons in a
   * row. No talking to anybody: click, and the dog moves. Every
   * click calls runSend — the SAME road as the card's Send
   * buttons (Permission Law, then the Parrot bridge), and the
   * Practice/LIVE switch above governs the remote exactly as it
   * governs the card. Every button carries its name in plain
   * words — no icon-only mystery buttons.
   */
  const renderRemote = () => {
    if (!activeBinding || !profile || !extras?.remote) return null;
    const remoteLayout = extras.remote;
    const byId = new Map(mergedCommands(activeBinding, profile).map((c) => [c.id, c]));
    const remoteButton = (
      command: DeviceCommand | undefined,
      opts?: { className?: string; icon?: React.ReactNode },
    ) => {
      if (!command) return null;
      const silenced = soundOff[command.id] === true;
      return (
        <button
          key={command.id}
          type="button"
          className={`window-commands__remote-btn${opts?.className ? ` ${opts.className}` : ""}`}
          disabled={!granted || sending !== null || silenced}
          aria-label={silenced ? `${command.name} — set to Never use` : command.name}
          onClick={() => {
            setLastRemoteId(command.id);
            void runSend(command);
          }}
        >
          {opts?.icon}
          {sending === command.id ? `${command.name} — sending…` : command.name}
          {silenced ? " (Never use)" : ""}
        </button>
      );
    };
    const padButton = (
      id: string,
      area: string,
      icon: React.ReactNode,
      extraClass = "",
    ) => {
      const command = byId.get(id);
      if (!command) return <span key={id} className={`window-commands__pad-cell window-commands__pad-${area}`} />;
      return (
        <span key={id} className={`window-commands__pad-cell window-commands__pad-${area}`}>
          {remoteButton(command, { icon, className: extraClass })}
        </span>
      );
    };
    const lastRemote = lastRemoteId ? byId.get(lastRemoteId) : undefined;
    const lastOutcome = lastRemoteId ? outcomes[lastRemoteId] : undefined;
    return (
      <section className="window-commands__remote" aria-label={`${device.displayName} remote control`}>
        <h5>Remote control — click to drive him</h5>
        <p className="window-hint">
          No talking needed. Click a button and he does it. Every click goes the same road
          as the Send buttons below — the Permission Law first, then the Parrot bridge — and
          the Practice / LIVE switch above rules this remote just like it rules the whole
          card. Stop sits in the middle of the pad: click it any time.
        </p>
        <p className="window-hint" role="status">
          {dogLive
            ? "Remote is LIVE — clicks go on air and the dog moves."
            : "Remote is in Practice — clicks print the frames, nothing goes on air, the dog does not move."}
        </p>
        <div className="window-commands__remote-body">
          <div className="window-commands__pad" role="group" aria-label="Direction pad">
            {padButton(remoteLayout.pad.up, "up", <ArrowUp aria-hidden="true" />)}
            {padButton(remoteLayout.pad.left, "left", <ArrowLeft aria-hidden="true" />)}
            {padButton(
              remoteLayout.pad.center,
              "center",
              <Pause aria-hidden="true" />,
              "window-commands__remote-stop",
            )}
            {padButton(remoteLayout.pad.right, "right", <ArrowRight aria-hidden="true" />)}
            {padButton(remoteLayout.pad.down, "down", <ArrowDown aria-hidden="true" />)}
          </div>
          <div className="window-commands__remote-actions" role="group" aria-label="Tricks and actions">
            {remoteLayout.actions.map((id) => remoteButton(byId.get(id)))}
          </div>
        </div>
        <div className="window-commands__remote-feed" role="group" aria-label="Feeding buttons">
          <span className="window-commands__remote-feedlabel">Feed him:</span>
          {remoteLayout.feed.map((id) => remoteButton(byId.get(id)))}
        </div>
        {lastRemote && sending === lastRemote.id && (
          <p className="window-hint" role="status">
            Sending {lastRemote.name}…
          </p>
        )}
        {lastRemote && lastOutcome && sending !== lastRemote.id && (
          <p className="window-hint" role="status">
            Remote — {lastRemote.name}: {lastOutcome.result === "sent" ? "Sent — " : `${lastOutcome.result}: `}
            {lastOutcome.note}
          </p>
        )}
      </section>
    );
  };

  const renderCommandLists = () => {
    if (!activeBinding || !profile) return null;
    const commands = mergedCommands(activeBinding, profile);
    if (!extras?.groups) {
      return <ul className="window-commands__list">{commands.map((c) => commandItem(c))}</ul>;
    }
    const byId = new Map(commands.map((c) => [c.id, c]));
    const grouped = new Set<string>();
    const sections = extras.groups.map((group) => {
      const items = group.commandIds
        .map((id) => byId.get(id))
        .filter((c): c is DeviceCommand => c !== undefined);
      items.forEach((c) => grouped.add(c.id));
      if (!items.length) return null;
      if (group.label === extras.soundGroupLabel) {
        return (
          <div key={group.label} className="window-commands__group">
            <h5>{group.label}</h5>
            {extras.soundNote && <p className="window-hint">{extras.soundNote}</p>}
            <ul className="window-commands__list">
              {items.map((c) => commandItem(c, soundPickToggle(c)))}
            </ul>
          </div>
        );
      }
      return (
        <div key={group.label} className="window-commands__group">
          <h5>{group.label}</h5>
          <ul className="window-commands__list">{items.map((c) => commandItem(c))}</ul>
        </div>
      );
    });
    const rest = commands.filter((c) => !grouped.has(c.id));
    return (
      <>
        {sections}
        {rest.length > 0 && (
          <div className="window-commands__group">
            <h5>More commands</h5>
            <ul className="window-commands__list">{rest.map((c) => commandItem(c))}</ul>
          </div>
        )}
      </>
    );
  };

  return (
    <section className="window-commands" aria-label={`Commands for ${device.displayName}`}>
      <h4>Commands — send to this device</h4>
      {!activeBinding || !profile ? (
        <>
          <p className="window-hint">
            No command setup yet for this device. Set it up once — how Augie reaches it, which
            commands it understands, its address — and the commands live here from then on. Adding
            a new kind of device later is the same setup, never a rebuild.
          </p>
          {!showSetup && (
            <button type="button" className="window-btn" onClick={openSetup}>
              <Settings2 aria-hidden="true" /> Set up commands for this device
            </button>
          )}
        </>
      ) : (
        <>
          <p className="window-devices__meta">
            Command set: {profile.name} · {COMMAND_TRANSPORT_LABELS[profile.transport]}
            {activeBinding.address ? ` · address: ${activeBinding.address}` : " · no address set"}
          </p>
          {!granted && (
            <p className="window-devices__unavailable" role="status">
              Control is not granted for this device — commands cannot be sent. The Permission Law:
              Osiris may control a device only when its card is owner-confirmed AND control is
              granted for that exact device. Set both in this card's Edit form, and the commands
              open.
            </p>
          )}
          {profile.transport === "usb-serial" &&
            (serialChannel ? (
              <div className="window-devices__actions">
                <span className="window-hint" role="status">
                  Printer connected over USB serial.
                </span>
                <button type="button" className="window-btn" onClick={() => void disconnectSerial()}>
                  <X aria-hidden="true" /> Disconnect
                </button>
              </div>
            ) : (
              <div className="window-devices__actions">
                <button type="button" className="window-btn" onClick={() => void connectSerial()}>
                  <Cable aria-hidden="true" /> Connect over USB
                </button>
                <span className="window-hint">
                  Help: plug the printer's USB cable in and turn it on first — the browser will
                  ask you to pick its port.
                </span>
              </div>
            ))}
          {channelNote && (
            <p className="window-hint" role="status">
              {channelNote}
            </p>
          )}
          {profile.transport === "bluetooth-broadcast" && (
            <div className="window-commands__bridge">
              <div className="window-devices__actions">
                <button
                  type="button"
                  className="window-btn"
                  role="switch"
                  aria-checked={dogLive}
                  aria-label="Live fire switch"
                  onClick={() => setDogLive((v) => !v)}
                >
                  {dogLive ? "LIVE — taps move the dog" : "Practice — nothing goes on air"}
                </button>
                <span className="window-hint" role="status">
                  {dogLive
                    ? "LIVE: a tap hands the frame to the Parrot sender and it goes on air. The dog will move."
                    : "Practice: a tap makes the Parrot sender print the exact frames — nothing is transmitted, the dog hears nothing."}
                </span>
              </div>
              {extras?.remote && renderRemote()}
              {extras?.howto && (
                <section className="window-commands__howto" aria-label={extras.howto.title}>
                  <h5>{extras.howto.title}</h5>
                  <ol>
                    {extras.howto.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {extras.howto.notes.map((note) => (
                    <p key={note} className="window-hint">
                      {note}
                    </p>
                  ))}
                </section>
              )}
              {bridgeReceipts.length > 0 && (
                <div className="window-commands__receipts">
                  <h5>The Parrot sender printed</h5>
                  {bridgeReceipts.map((receipt, i) => (
                    <pre key={i} className="window-commands__receipt">{receipt}</pre>
                  ))}
                </div>
              )}
            </div>
          )}
          {renderCommandLists()}
          {extras?.batteryLog && (
            <section className="window-commands__battery" aria-label={`${device.displayName} battery test log`}>
              <h5>Battery test — measure him, because he cannot report</h5>
              <p className="window-hint">
                He sends nothing back — there is no battery reading to show, and no runtime
                figure exists in the vendor's materials. His cell is one removable 3.7 V
                battery, charged over USB. The only honest numbers are the ones you time
                yourself:
              </p>
              <ol>
                <li>Charge him full, then take the cell off the charger and put him together.</li>
                <li>
                  Pick ONE mode for the run: Idle (awake, no commands), Walking patrol (send
                  Patrol and let him walk), or Lights on (send Light, then leave him awake).
                </li>
                <li>Start a timer the moment you switch him on.</li>
                <li>Stop the timer when he turns himself off — that is the run's length.</li>
                <li>Write the run in the log below. Three runs, one per mode, give you his real endurance picture.</li>
              </ol>
              {batteryLog.length > 0 ? (
                <ul className="window-commands__list">
                  {[...batteryLog].reverse().map((entry) => (
                    <li key={entry.id} className="window-commands__item">
                      <div className="window-commands__head">
                        <strong>
                          {entry.at} · {batteryModeLabel(entry.mode)} · {entry.minutes} min
                        </strong>
                        <button
                          type="button"
                          className="window-btn"
                          aria-label={`Delete battery run ${entry.at} ${batteryModeLabel(entry.mode)}`}
                          onClick={() => setBatteryLog(removeBatteryEntry(entry.id))}
                        >
                          <Trash2 aria-hidden="true" /> Delete
                        </button>
                      </div>
                      {entry.note && <p className="window-hint">{entry.note}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="window-hint" role="status">
                  No runs logged yet — the log fills in from your watched sessions, never
                  from a guess.
                </p>
              )}
              <form
                className="window-devices__actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  const minutes = Number(batteryMinutes);
                  if (!Number.isFinite(minutes) || minutes <= 0) return;
                  setBatteryLog(
                    addBatteryEntry({
                      at: new Date().toISOString().slice(0, 10),
                      mode: batteryMode,
                      minutes,
                      note: batteryNote.trim() || undefined,
                    }),
                  );
                  setBatteryMinutes("");
                  setBatteryNote("");
                }}
              >
                <label>
                  Mode{" "}
                  <select
                    value={batteryMode}
                    onChange={(e) => setBatteryMode(e.target.value as BatteryModeId)}
                  >
                    {BATTERY_MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Minutes until he turned off{" "}
                  <input
                    value={batteryMinutes}
                    inputMode="decimal"
                    onChange={(e) => setBatteryMinutes(e.target.value)}
                    placeholder="e.g. 47"
                  />
                </label>
                <label>
                  Note (optional){" "}
                  <input
                    value={batteryNote}
                    onChange={(e) => setBatteryNote(e.target.value)}
                    placeholder="floor, room, anything you noticed"
                  />
                </label>
                <button type="submit" className="window-btn">
                  <Plus aria-hidden="true" /> Add run
                </button>
              </form>
            </section>
          )}
          {!showSetup && (
            <div className="window-devices__actions">
              <button type="button" className="window-btn" onClick={openSetup}>
                <Settings2 aria-hidden="true" /> Change command setup
              </button>
              <button
                type="button"
                className="window-btn"
                onClick={() => {
                  removeBinding(device.id);
                  refreshStores();
                }}
              >
                <Trash2 aria-hidden="true" /> Remove command setup
              </button>
            </div>
          )}
        </>
      )}

      {showSetup && (
        <form
          className="window-devices__form"
          onSubmit={(e) => {
            e.preventDefault();
            saveSetup();
          }}
        >
          <h3 className="window-devices__formtitle">Command setup for {device.displayName}</h3>
          <label>
            Step 1 — How does Augie reach it?
            <select
              value={setup.transport}
              onChange={(e) => {
                const transport = e.target.value as CommandTransport;
                const first = profiles.find((p) => p.transport === transport);
                setSetup({
                  ...setup,
                  transport,
                  profileId: first ? first.id : "custom",
                });
              }}
            >
              {(Object.keys(COMMAND_TRANSPORT_LABELS) as CommandTransport[]).map((t) => (
                <option key={t} value={t}>
                  {COMMAND_TRANSPORT_LABELS[t]}
                </option>
              ))}
            </select>
            <span className="window-hint">Help: the wire the commands travel — a USB cable, or your own network.</span>
          </label>
          <label>
            Step 2 — Which command set fits it?
            <select
              value={setup.profileId}
              onChange={(e) => setSetup({ ...setup, profileId: e.target.value })}
            >
              {setupProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="custom">Build his own command set…</option>
            </select>
            <span className="window-hint">
              Help: a command set is the device's vocabulary — the named commands it understands.
            </span>
          </label>
          {setup.profileId === "custom" ? (
            <>
              <label>
                Name for his command set
                <input
                  value={setup.customName}
                  onChange={(e) => setSetup({ ...setup, customName: e.target.value })}
                  placeholder={`e.g. ${device.displayName} — his command set`}
                />
              </label>
              {setup.transport === "bluetooth-broadcast" && (
                <label>
                  Sender script (under ~/augie-tools/ on the Parrot)
                  <input
                    value={setup.senderPath}
                    onChange={(e) => setSetup({ ...setup, senderPath: e.target.value })}
                    placeholder="e.g. wepwawet/wepwawet-send.py"
                  />
                  <span className="window-hint">
                    Help: the program on the Parrot that puts this device's frames on air.
                    The bridge runs only scripts that live under ~/augie-tools/ — a path
                    anywhere else is refused.
                  </span>
                </label>
              )}
            </>
          ) : (
            setupProfiles.find((p) => p.id === setup.profileId) && (
              <div className="window-hint">
                <p>
                  {setupProfiles.find((p) => p.id === setup.profileId)!.deviceClass}. Set it up:
                </p>
                <ol>
                  {setupProfiles
                    .find((p) => p.id === setup.profileId)!
                    .setupSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                </ol>
              </div>
            )
          )}
          <label>
            Step 3 — Its address
            <input
              value={setup.address}
              onChange={(e) => setSetup({ ...setup, address: e.target.value })}
              placeholder={
                setup.profileId !== "custom"
                  ? (setupProfiles.find((p) => p.id === setup.profileId)?.addressPattern ?? "")
                  : "Its address on this transport"
              }
            />
            <span className="window-hint">
              Help:{" "}
              {setup.profileId !== "custom"
                ? setupProfiles.find((p) => p.id === setup.profileId)?.addressPattern
                : "Where the commands go — for a network device, its http:// address."}
            </span>
          </label>
          <fieldset className="window-commands__custom">
            <legend>
              {setup.profileId === "custom" ? "His commands" : "Add this device's commands (optional)"}
            </legend>
            <p className="window-hint">
              Help: one command = a name plus exactly what it sends — a G-code line for a printer,
              a path for a network device (from its manual), or — for a Bluetooth broadcast
              device — a FRAME: the command byte, the five data bytes in hex, and how long
              the frame holds, like this: E0 00 00 00 00 02 500.
            </p>
            {setup.customCommands.map((c, i) => (
              <p key={i} className="window-commands__customrow">
                <strong>{c.name}</strong> — {c.literal}
                <button
                  type="button"
                  className="window-btn"
                  onClick={() =>
                    setSetup({
                      ...setup,
                      customCommands: setup.customCommands.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 aria-hidden="true" /> Remove
                </button>
              </p>
            ))}
            <label>
              Command name
              <input
                value={setup.newName}
                onChange={(e) => setSetup({ ...setup, newName: e.target.value })}
                placeholder="e.g. Move left"
              />
            </label>
            <label>
              {setup.transport === "bluetooth-broadcast" ? "The frame it sends" : "What it sends"}
              <input
                value={setup.newLiteral}
                onChange={(e) => setSetup({ ...setup, newLiteral: e.target.value })}
                placeholder={
                  setup.transport === "network-http"
                    ? "e.g. /ptz?move=left"
                    : setup.transport === "bluetooth-broadcast"
                      ? "e.g. E0 00 00 00 00 02 500"
                      : "e.g. G1 X0 F3000"
                }
              />
              {setup.transport === "bluetooth-broadcast" && (
                <span className="window-hint">
                  Help: command byte, then the five data bytes (D0 D1 D2 D3 D4) in hex, then
                  the hold in milliseconds. This is the dog family's frame shape — the same
                  shape the registry's control map takes with a “frame:” line.
                </span>
              )}
            </label>
            <button
              type="button"
              className="window-btn"
              disabled={
                !setup.newName.trim() ||
                !setup.newLiteral.trim() ||
                (setup.transport === "bluetooth-broadcast" &&
                  !parseControlPayloadSegment(`frame: ${setup.newLiteral.trim()}`))
              }
              onClick={() =>
                setSetup({
                  ...setup,
                  customCommands: [
                    ...setup.customCommands,
                    { name: setup.newName.trim(), literal: setup.newLiteral.trim() },
                  ],
                  newName: "",
                  newLiteral: "",
                })
              }
            >
              <Plus aria-hidden="true" /> Add this command
            </button>
          </fieldset>
          <div className="window-devices__formactions">
            <button type="submit" className="window-btn">
              Save command setup
            </button>
            <button type="button" className="window-btn" onClick={() => setShowSetup(false)}>
              Cancel
            </button>
          </div>
          <p className="window-hint">
            Saving a setup sends nothing. Commands go out only when you tap Send — and only while
            this device's card carries owner-confirmed + control granted.
          </p>
        </form>
      )}

      {deviceLog.length > 0 && (
        <section>
          <h4>Command record for this device</h4>
          <ul className="window-devices__facts">
            {deviceLog.map((entry) => (
              <li key={entry.id}>
                {new Date(entry.at).toLocaleString()} · {entry.commandName} · {entry.result} —{" "}
                {entry.note}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
