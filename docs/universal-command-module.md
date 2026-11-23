# Universal Command Module — sending commands to any device he owns

Operator order 2026-11-23: *"Send a module for sending commands to ANY
device — I don't even care if it's a 3D printer. I want my AI to have
control of anything I own… in the configuration of opening and setting
up that configuration. If we can't do it right now, being able to add
it on."* Plus his standing law: dependencies built INTO the system —
offline, grid-down, solar-boot, it still works.

## The shape

- **Profiles are data** (`src/avatar/devices/commandProfiles.ts`). A
  profile = one device class's connection + command vocabulary:
  `{ id, name, deviceClass, transport, addressPattern, baudRate?,
  commands[], setupSteps[], safetyNotes[], builtin }`. A command =
  `{ id, name, help, params[], payload, safety? }`, where the payload
  renders to literal lines on a serial/text channel, to an HTTP
  request, or streams a whole file (a G-code print). Adding a device
  class = adding a profile object. The engine never changes.
- **The engine** (`src/avatar/devices/commandModule.ts`) holds the
  per-device bindings (`augi.devices.command-bindings.v1`), the
  command log (`augi.devices.command-log.v1`, capped at 200, every
  attempt recorded against the device: command, rendered detail,
  time, result, note), the channels, and the send.
- **The surface** (`src/avatar/devices/DeviceCommandsPanel.tsx`) sits
  on each device card in the Devices window: a Commands section with
  the setup flow and the send buttons.

## The Permission Law — unchanged

A command leaves only for a device whose registry card carries
**ownerConfirmed AND controlGranted** (`canControl()` in
`deviceRegistry.ts`). The check runs before the channel is touched;
a refused send puts nothing on any wire, states the refusal in
words, and is itself logged. Setting up commands grants nothing.

## Built-in profiles

1. **3D printer (G-code)** — USB serial, 115200 baud, Marlin-style:
   Home (G28) · Move (G90 + G1 with only the axes given) · Heat
   nozzle (M104) · Heat bed (M140) · Status (M105 + M114, parsed
   back into real temperatures/position — no readable report reads
   UNAVAILABLE, never invented numbers) · Print a file (streams
   G-code line by line with progress) · Pause (M25) · Resume (M24) ·
   Cancel (M25, heaters off, M84).
2. **Network device (web requests)** — generic HTTP: Status check
   (GET a path) and Custom request (method + path + body the
   operator defines). Covers cameras' PTZ-style endpoints, smart
   plugs, and any other gear on his network he configures.

## Send paths — local only (the offline law)

- **USB serial**: WebSerial in his Chromium / Android Chrome — the
  operator picks the port in the browser's own chooser. Where
  WebSerial does not exist, the channel reports UNAVAILABLE in words
  and nothing is faked. A Parrot-side serial bridge is the
  alternative for a browser that cannot — **not built yet**.
- **Network HTTP**: a plain fetch to the device's own address on his
  network.
- **Raw TCP / Bluetooth / NODS-session transports**: profiles can be
  configured and saved for them today; the panel states plainly that
  their send path is not built yet. Configured is never dressed up
  as sendable.

No cloud sits anywhere in the chain. The simulated-path plug test
(tests stub `fetch` to throw) passes with the network gone.

## Proof without hardware

`src/test/device-commands.test.ts` pins the vocabulary against a
simulated Marlin peer that keeps real state (heaters set by M104 /
M140 are what a later M105 reports; moves set the M114 position),
and against a simulated HTTP peer that records requests. The
refusal test proves the peer's received-lines list stays EMPTY for
every missing-flag combination. No test claims a hardware success:
a real printer send still needs a real printer on a USB cable, a
WebSerial browser, and the Captain's eye on the first moves.

## The setup flow (what the Captain sees)

On a device's card → **Commands**:

1. **Set up commands for this device** (or "Change command setup").
2. Step 1 — *How does Augie reach it?* Pick the transport. Help:
   the wire the commands travel.
3. Step 2 — *Which command set fits it?* Pick a profile from the
   library (its own setup steps show), or *Build his own command
   set…*. Help: a command set is the device's vocabulary.
4. Step 3 — *Its address*, with the profile's address pattern as the
   help line.
5. Optional — **Add this device's commands**: a name plus exactly
   what it sends (a G-code line, or a network path from the
   device's manual). Saved onto that device.
6. **Save command setup.** Saving sends nothing.

Then each command shows its fields and a **Send** button; outcomes
and the per-device **Command record** show underneath.

## Text-to-CAD seam

The Captain's text-to-cad bench (`~/workspace/custom-skills/
text-to-cad`) designs parts; this module is the hands that print
them. The seam is `printGcode()` in `commandModule.ts` — feed it
G-code text from any source and it runs the printer profile's
Print-a-file path under the same Permission Law and logging. No CAD
work lives in this module.
