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
import { Cable, Plus, Send, Settings2, Trash2, X } from "lucide-react";
import { canControl, type DeviceProfile } from "./deviceRegistry";
import {
  COMMAND_TRANSPORT_LABELS,
  WEPWAWET_COMMAND_GROUPS,
  type CommandTransport,
  type DeviceCommand,
  type DeviceCommandProfile,
} from "./commandProfiles";
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

type SetupDraft = {
  transport: CommandTransport;
  profileId: string;
  customName: string;
  address: string;
  customCommands: { name: string; literal: string }[];
  newName: string;
  newLiteral: string;
};

const EMPTY_SETUP: SetupDraft = {
  transport: "usb-serial",
  profileId: "printer-gcode",
  customName: "",
  address: "",
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
  const bridgeRef = useRef<{ live: boolean; channel: ParrotBroadcastChannel } | null>(null);
  const bridgeChannel = (live: boolean): ParrotBroadcastChannel => {
    if (!bridgeRef.current || bridgeRef.current.live !== live) {
      bridgeRef.current = { live, channel: createParrotBroadcastChannel({ live }) };
    }
    return bridgeRef.current.channel;
  };

  const binding = bindings[device.id];
  const profiles = useMemo(() => allCommandProfiles(bindings), [bindings]);
  const profile = binding ? resolveBindingProfile(binding, profiles) : null;
  const granted = canControl(device);
  const deviceLog = logForDevice(log, device.id).slice(-5).reverse();

  const refreshStores = () => {
    setBindings(loadBindings());
    setLog(loadCommandLog());
  };

  const openSetup = () => {
    if (binding && profile) {
      setSetup({
        transport: profile.transport,
        profileId: profile.builtin ? profile.id : "custom",
        customName: profile.builtin ? "" : profile.name,
        address: binding.address,
        customCommands: (binding.extraCommands ?? []).map((c) => ({
          name: c.name,
          literal:
            c.payload.kind === "lines"
              ? c.payload.lines.join("\n")
              : c.payload.kind === "http"
                ? c.payload.path
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
      .map((c, i) => ({
        id: `custom-${slug(c.name)}-${i + 1}`,
        name: c.name.trim(),
        help: "A command the operator defined for this device.",
        params: [],
        payload:
          setup.transport === "network-http"
            ? { kind: "http" as const, method: "GET" as const, path: c.literal.trim() }
            : { kind: "lines" as const, lines: c.literal.split("\n").map((l) => l.trim()).filter(Boolean) },
      }));
    let next: DeviceCommandBinding;
    if (setup.profileId === "custom") {
      if (!extras.length) return;
      const customProfile: DeviceCommandProfile = {
        id: `custom-${device.id}`,
        name: setup.customName.trim() || `${device.displayName} — his command set`,
        deviceClass: `A command set the operator built for ${device.displayName}`,
        transport: setup.transport,
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
    if (!profile || !binding) return;
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
              address: binding.address,
              channel,
              channelUnavailableReason: reason,
            });
      setOutcomes((current) => ({ ...current, [command.id]: outcome }));
    } finally {
      setSending(null);
      setLog(loadCommandLog());
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


  const isDogProfile = profile?.id === "wepwawet-ble-broadcast";

  const commandItem = (command: DeviceCommand) => {
    const outcome = outcomes[command.id];
    return (
                <li key={command.id} className="window-commands__item">
                  <div className="window-commands__head">
                    <strong>{command.name}</strong>
                    <button
                      type="button"
                      className="window-btn"
                      disabled={!granted || sending !== null}
                      onClick={() => void runSend(command)}
                    >
                      <Send aria-hidden="true" />{" "}
                      {sending === command.id ? "Sending…" : "Send"}
                    </button>
                  </div>
                  <p className="window-hint">{command.help}</p>
                  {command.safety && <p className="window-hint">Safety: {command.safety}</p>}
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

  const renderCommandLists = () => {
    if (!binding || !profile) return null;
    const commands = bindingCommands(binding, profile);
    if (!isDogProfile) {
      return <ul className="window-commands__list">{commands.map(commandItem)}</ul>;
    }
    const byId = new Map(commands.map((c) => [c.id, c]));
    const grouped = new Set<string>();
    const sections = WEPWAWET_COMMAND_GROUPS.map((group) => {
      const items = group.commandIds
        .map((id) => byId.get(id))
        .filter((c): c is DeviceCommand => c !== undefined);
      items.forEach((c) => grouped.add(c.id));
      if (!items.length) return null;
      return (
        <div key={group.label} className="window-commands__group">
          <h5>{group.label}</h5>
          <ul className="window-commands__list">{items.map(commandItem)}</ul>
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
            <ul className="window-commands__list">{rest.map(commandItem)}</ul>
          </div>
        )}
      </>
    );
  };

  return (
    <section className="window-commands" aria-label={`Commands for ${device.displayName}`}>
      <h4>Commands — send to this device</h4>
      {!binding || !profile ? (
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
            {binding.address ? ` · address: ${binding.address}` : " · no address set"}
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
              {isDogProfile && (
                <section className="window-commands__howto" aria-label="How to control Wepwawet">
                  <h5>How to control Wepwawet</h5>
                  <ol>
                    <li>
                      Wake him: press-and-hold the switch under the dog until he answers with
                      his voice prompt.
                    </li>
                    <li>
                      Keep him near the Parrot, in the same room — the commands ride the
                      Parrot's Bluetooth, and Augie must be open through the Parrot's own
                      server for the buttons to reach him.
                    </li>
                    <li>
                      Just woke him? Tap “Match / connect” once first — the knock the vendor
                      app sends when it starts.
                    </li>
                    <li>
                      Tap a command below. STOP is always at the top — tap it any time he
                      does something unexpected.
                    </li>
                    <li>
                      Adding your own: “Change command setup” below lets you add commands to
                      his card, and every command on the card runs the same way.
                    </li>
                  </ol>
                  <p className="window-hint">
                    He never answers back: a sent command means the frames went on air — your
                    eyes confirm he obeyed.
                  </p>
                  <p className="window-hint">
                    Talk: Wepwawet speaks only his own built-in sounds and songs (Song, AI
                    content, Learn / story). Augie cannot put your words in his mouth.
                  </p>
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
            <label>
              Name for his command set
              <input
                value={setup.customName}
                onChange={(e) => setSetup({ ...setup, customName: e.target.value })}
                placeholder={`e.g. ${device.displayName} — his command set`}
              />
            </label>
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
              or a path for a network device (from its manual).
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
              What it sends
              <input
                value={setup.newLiteral}
                onChange={(e) => setSetup({ ...setup, newLiteral: e.target.value })}
                placeholder={
                  setup.transport === "network-http" ? "e.g. /ptz?move=left" : "e.g. G1 X0 F3000"
                }
              />
            </label>
            <button
              type="button"
              className="window-btn"
              disabled={!setup.newName.trim() || !setup.newLiteral.trim()}
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
