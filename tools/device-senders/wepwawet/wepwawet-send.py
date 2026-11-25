#!/usr/bin/env python3
"""
WEPWAWET SENDER — Augie's mouth to the ATLAS robot dog.

Puts the dog's command frames on air as one-way BLE advertisements
(manufacturer data, company 0x0006, non-connectable) from the
Parrot's hci0, exactly per the teardown protocol
(~/workspace/augie-mission/atlas-dog/atlas-dog-protocol.md §3).

SAFETY SHAPE — read before touching:
  * Without --live this script NEVER transmits. It prints the exact
    frames it would send (dry run) and exits. The first live
    broadcast happens only on the Captain's word, with him watching
    the dog.
  * On every start it re-verifies its encoder against the five
    worked examples in protocol §3.3. A mismatch = it refuses to
    run at all, dry or live.
  * A live send is a session: match frame burst -> command burst ->
    zero frame burst -> silence. Movement commands hold 3000 ms
    (the protocol's voice-command hold); everything else 500 ms.
    --hold overrides.

Usage:
  wepwawet-send.py --list
  wepwawet-send.py stop                      # dry run (default)
  wepwawet-send.py forward --live            # TRANSMITS
  wepwawet-send.py dance --live --appid A947C15E --hold 500
  wepwawet-send.py step-dance --live         # one program-record step
  wepwawet-send.py forward --live --no-match # skip the match frame
  wepwawet-send.py --air-frame <46 hex chars> [--live] [--hold 500]
      # Air ONE exact frame built by Augie's own encoder (the
      # Devices-panel bridge: the app builds the frames, this script
      # is the pipe). Same safety shape: no --live, nothing airs.

Exit codes: 0 ok · 2 encoder self-test failed · 3 no usable
Bluetooth path (the message names the exact step that unblocks it).
"""

import argparse
import subprocess
import sys
import time

COMPANY_ID = 0x0006
ADAPTER = "hci0"
AUGIE_APP_ID = bytes([0xA9, 0x47, 0xC1, 0x5E])
VENDOR_APP_ID = bytes([0x12, 0x34, 0x56, 0x78])

# ---------------------------------------------------------------- encoder
# The protocol §3 chain, identical to the app encoder
# (AUGIXVI src/avatar/devices/wepwawetFrame.ts). Byte-verified below.

XOR_MASK = bytes([0x80, 0xF5, 0x3B, 0x0D, 0x6D, 0x2A, 0xF9, 0xBC,
                  0x51, 0x8E, 0x4C, 0xFD])
CH39_KEY = bytes([0x59, 0xDE, 0xE1, 0x8F, 0x1B, 0xA5, 0xAF, 0x42,
                  0x7B, 0x4E, 0xCD, 0x60, 0xEB, 0x62, 0x22, 0x90,
                  0x2C, 0xEF, 0xF0, 0xC7, 0x8D, 0xD2])


def bit_reverse(b):
    r = 0
    for i in range(8):
        if b & (1 << i):
            r |= 1 << (7 - i)
    return r


def crc16(data):
    crc = 0xFFFF
    for byte in data:
        crc = ((crc << 8) | (crc >> 8)) & 0xFFFF
        crc ^= byte
        crc ^= (crc & 0xFF) >> 4
        crc ^= (crc << 12) & 0xFFFF
        crc ^= ((crc & 0xFF) << 5) & 0xFFFF
    return crc


def build_payload(cmd, data5, app_id=AUGIE_APP_ID):
    f = bytearray(22)
    f[0] = 0xAA
    f[1] = 0x70
    f[2:6] = bytes([0xC3, 0xC2, 0xC1, 0xC0])
    f[6] = 0x3F
    f[7] = 0xC0
    f[8] = cmd
    f[9] = 0x54
    f[10:14] = app_id
    f[14:19] = bytes(data5)
    f[19] = sum(f[8:19]) & 0xFF
    for i in range(12):
        f[8 + i] ^= XOR_MASK[i]
    crc = crc16(bytes(f[1:6]) + bytes(f[8:20]))
    f[20] = (crc >> 8) & 0xFF
    f[21] = crc & 0xFF
    f = bytearray(bit_reverse(b) for b in f)
    f = bytearray(b ^ k for b, k in zip(f, CH39_KEY))
    return bytes([0x00]) + bytes(f)


def hexs(payload):
    return " ".join(f"{b:02x}" for b in payload)


# Protocol §3.3 worked examples (vendor AppID) — the encoder's oath.
DOC_EXAMPLES = {
    "match": (0xD0, [0, 0, 0, 0, 0],
              "00 0c d0 22 cc 98 a6 53 41 71 cb 59 fc 37 28 bd ad a6 9e c2 64 24 44"),
    "zero": (0xE0, [0, 0, 0, 0, 0],
             "00 0c d0 22 cc 98 a6 53 41 7d cb 59 fc 37 28 bd ad a6 9e c2 6a c0 a2"),
    "stop": (0xE0, [0, 0, 0, 0, 1],
             "00 0c d0 22 cc 98 a6 53 41 7d cb 59 fc 37 28 bd ad a6 9e 42 ea 04 aa"),
    "forward": (0xE0, [0, 0, 0, 0, 2],
                "00 0c d0 22 cc 98 a6 53 41 7d cb 59 fc 37 28 bd ad a6 9e 82 2a a2 a6"),
    "dance": (0xE0, [0, 0, 0, 0, 13],
              "00 0c d0 22 cc 98 a6 53 41 7d cb 59 fc 37 28 bd ad a6 9e 72 d2 6d a1"),
}


def self_test():
    for name, (cmd, data, expected) in DOC_EXAMPLES.items():
        got = hexs(build_payload(cmd, data, VENDOR_APP_ID))
        if got != expected:
            print(f"SELF-TEST FAILED on the doc's {name} example.")
            print(f"  expected: {expected}")
            print(f"  built:    {got}")
            print("The encoder does not match the protocol. Nothing was sent.")
            return False
    return True


# ------------------------------------------------------------- command map
# id -> (frame cmd, data D0..D4, default hold ms in THIS sender).
# Mirrors the Augie profile (wepwawet-ble-broadcast) byte for byte;
# movement holds 3000 ms here because this sender is Augie's voice
# path and the protocol's voice movement commands hold 3000 ms (§3.4).

def _a(d4, hold=500):
    return (0xE0, [0, 0, 0, 0, d4], hold)


def _m(d3, hold=500):
    return (0xE0, [0, 0, 0, d3, 0], hold)


def _d2(d2, d3, hold=500):
    return (0xE0, [0, 0, d2, d3, 0], hold)


COMMANDS = {
    "stop": _a(1),
    "match": (0xD0, [0, 0, 0, 0, 0], 500),
    "forward": _a(2, 3000),
    "back": _a(3, 3000),
    "turn-left": _a(4, 3000),
    "turn-right": _a(5, 3000),
    "sit": _a(6),
    "lie-down": _a(7),
    "coquetry": _a(8),
    "pee": _a(9),
    "greet": _a(10),
    "handstand": _a(11),
    "push-ups": _a(12),
    "dance": _a(13),
    "kung-fu": _a(14),
    "swim": _a(15),
    "bless": _a(16),
    "patrol": _a(17),
    "feed-1": _a(19),
    "feed-2": _a(18),
    "feed-3": _a(21),
    "feed-4": _a(20),
    "feed-5": _a(22),
    "feed-6": _a(25),
    "feed-7": _a(24),
    "feed-8": _a(23),
    "light": _m(128),
    "song": _d2(4, 1),
    "ai-content": _m(32),
    "learn": _m(16),
    "fire": _m(8),
    "rotate-left": _d2(128, 0),
    "rotate-right": _d2(64, 0),
    "program-record": _m(2),
    "program-execute": (0xE0, [0, 0, 0, 0, 0], 500),
}

ZERO = (0xE0, [0, 0, 0, 0, 0], 500)
MATCH = COMMANDS["match"]
RECORD_MODE = COMMANDS["program-record"]

# Program-step bases (protocol §6.4 catalog, before the +2 D3 offset).
STEP_BASES = {
    "forward": [0, 0, 0, 0, 2], "back": [0, 0, 0, 0, 3],
    "turn-left": [0, 0, 0, 0, 4], "turn-right": [0, 0, 0, 0, 5],
    "sit": [0, 0, 0, 0, 6], "lie-down": [0, 0, 0, 0, 7],
    "coquetry": [0, 0, 0, 0, 8], "pee": [0, 0, 0, 0, 9],
    "greet": [0, 0, 0, 0, 10], "handstand": [0, 0, 0, 0, 11],
    "push-ups": [0, 0, 0, 0, 12], "dance": [0, 0, 0, 0, 13],
    "kung-fu": [0, 0, 0, 0, 14], "swim": [0, 0, 0, 0, 15],
    "bless": [0, 0, 0, 0, 16], "patrol": [0, 0, 0, 0, 17],
    "ai": [0, 0, 0, 0, 1], "music": [0, 0, 0, 1, 0],
    "learn": [0, 0, 0, 16, 0], "fire": [0, 0, 22, 0, 0],
    "rotate-left": [0, 0, 128, 0, 0], "rotate-right": [0, 0, 64, 0, 0],
}


def plan(command, app_id, hold_override=None, with_match=True):
    """The burst sequence for one invocation: [(role, payload, holdMs)]."""
    frames = []
    if command.startswith("step-"):
        base_id = command[5:]
        if base_id not in STEP_BASES:
            raise SystemExit(f"no program step named {base_id!r} — see --list")
        data = list(STEP_BASES[base_id])
        data[3] = (data[3] + 2) & 0xFF  # the protocol's +2 record offset
        if with_match:
            frames.append(("match", build_payload(*MATCH[:2], app_id), MATCH[2]))
        frames.append((f"step {base_id}", build_payload(0xE0, data, app_id),
                       hold_override or 500))
        # §6.4: the record-mode frame is re-sent after each step.
        frames.append(("record mode", build_payload(*RECORD_MODE[:2], app_id), 500))
        return frames
    if command not in COMMANDS:
        raise SystemExit(f"no command named {command!r} — see --list")
    cmd, data, hold = COMMANDS[command]
    if command == "match":
        return [("match", build_payload(cmd, data, app_id), hold_override or hold)]
    if with_match:
        frames.append(("match", build_payload(*MATCH[:2], app_id), MATCH[2]))
    frames.append((command, build_payload(cmd, data, app_id), hold_override or hold))
    if data != [0, 0, 0, 0, 0]:
        frames.append(("zero", build_payload(*ZERO[:2], app_id), ZERO[2]))
    return frames


# ------------------------------------------------------------ live paths
# Tried in order. Each returns True when the whole sequence aired,
# or raises/returns False with the reason kept for the final report.

class PathUnavailable(Exception):
    pass


def adapter_powered():
    try:
        out = subprocess.run(["bluetoothctl", "show"], capture_output=True,
                             text=True, timeout=10).stdout
    except Exception:
        return None
    for line in out.splitlines():
        if "Powered:" in line:
            return line.strip().endswith("yes")
    return None


def air_via_gio(frames):
    """PyGObject: export an LEAdvertisement1 object and register it
    with BlueZ's LEAdvertisingManager1, once per frame in sequence."""
    try:
        from gi.repository import Gio, GLib
    except ImportError as e:
        raise PathUnavailable(f"PyGObject not importable ({e})")

    adv_xml = """
    <node>
      <interface name="org.bluez.LEAdvertisement1">
        <method name="Release"/>
        <property name="Type" type="s" access="read"/>
        <property name="ManufacturerData" type="a{qv}" access="read"/>
        <property name="MinInterval" type="u" access="read"/>
        <property name="MaxInterval" type="u" access="read"/>
      </interface>
      <interface name="org.freedesktop.DBus.Properties">
        <method name="GetAll">
          <arg name="interface" type="s" direction="in"/>
          <arg name="properties" type="a{sv}" direction="out"/>
        </method>
        <method name="Get">
          <arg name="interface" type="s" direction="in"/>
          <arg name="property" type="s" direction="in"/>
          <arg name="value" type="v" direction="out"/>
        </method>
      </interface>
    </node>
    """
    node = Gio.DBusNodeInfo.new_for_xml(adv_xml)
    iface_adv = node.lookup_interface("org.bluez.LEAdvertisement1")
    iface_props = node.lookup_interface("org.freedesktop.DBus.Properties")
    conn = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
    manager = Gio.DBusProxy.new_sync(
        conn, Gio.DBusProxyFlags.NONE, None, "org.bluez",
        f"/org/bluez/{ADAPTER}", "org.bluez.LEAdvertisingManager1", None)
    if manager is None:
        raise PathUnavailable("BlueZ advertising manager not reachable on D-Bus")

    import threading
    loop = GLib.MainLoop()
    thread = threading.Thread(target=loop.run, daemon=True)
    thread.start()
    path = "/org/bluez/augie/wepwawet0"
    state = {"payload": b""}

    def props_dict():
        return {
            "Type": GLib.Variant("s", "broadcast"),
            "ManufacturerData": GLib.Variant(
                "a{qv}", {COMPANY_ID: GLib.Variant("ay", state["payload"])}),
            "MinInterval": GLib.Variant("u", 100),
            "MaxInterval": GLib.Variant("u", 100),
        }

    def on_method(_conn, _sender, _path, iface, method, params, invocation):
        if iface == "org.freedesktop.DBus.Properties" and method == "GetAll":
            invocation.return_value(GLib.Variant("(a{sv})", (props_dict(),)))
        elif iface == "org.freedesktop.DBus.Properties" and method == "Get":
            _i, prop = params.unpack()
            invocation.return_value(GLib.Variant("(v)", (props_dict()[prop],)))
        elif iface == "org.bluez.LEAdvertisement1" and method == "Release":
            invocation.return_value(None)
        else:
            invocation.return_error_literal(
                Gio.dbus_error_quark(), Gio.DBusError.UNKNOWN_METHOD,
                f"unknown method {method}")

    def on_get(_conn, _sender, _path, _iface, prop):
        return props_dict()[prop]

    reg_ids = [
        conn.register_object(path, iface_adv, on_method, None, None),
        conn.register_object(path, iface_props, on_method, on_get, None),
    ]
    if not all(reg_ids):
        loop.quit()
        raise PathUnavailable("could not export the advertisement object on D-Bus")
    try:
        for role, payload, hold_ms in frames:
            state["payload"] = payload
            manager.call_sync("RegisterAdvertisement",
                              GLib.Variant("(oa{sv})", (path, {})),
                              Gio.DBusCallFlags.NONE, 5000, None)
            print(f"  on air [{role}] {hold_ms} ms: {hexs(payload)}")
            time.sleep(hold_ms / 1000.0)
            manager.call_sync("UnregisterAdvertisement",
                              GLib.Variant("(o)", (path,)),
                              Gio.DBusCallFlags.NONE, 5000, None)
    finally:
        for rid in reg_ids:
            conn.unregister_object(rid)
        loop.quit()
    return True


def air_via_dbus_python(frames):
    """dbus-python: the shape of BlueZ's own example-advertisement."""
    try:
        import dbus
        import dbus.mainloop.glib
        import dbus.service
        from gi.repository import GLib
    except ImportError as e:
        raise PathUnavailable(f"dbus-python/GLib not importable ({e})")

    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
    bus = dbus.SystemBus()
    adapter = bus.get_object("org.bluez", f"/org/bluez/{ADAPTER}")
    manager = dbus.Interface(adapter, "org.bluez.LEAdvertisingManager1")

    import threading

    class Advertisement(dbus.service.Object):
        PATH = "/org/bluez/augie/wepwawet1"

        def __init__(self, bus_conn):
            super().__init__(bus_conn, self.PATH)
            self.payload = b""

        @dbus.service.method("org.freedesktop.DBus.Properties",
                             in_signature="s", out_signature="a{sv}")
        def GetAll(self, _interface):
            return {
                "Type": dbus.String("broadcast"),
                "ManufacturerData": dbus.Dictionary(
                    {dbus.UInt16(COMPANY_ID): dbus.Array(
                        [dbus.Byte(b) for b in self.payload], signature="y")},
                    signature="qv"),
                "MinInterval": dbus.UInt32(100),
                "MaxInterval": dbus.UInt32(100),
            }

        @dbus.service.method("org.bluez.LEAdvertisement1", in_signature="",
                             out_signature="")
        def Release(self):
            pass

    adv = Advertisement(bus)
    loop = GLib.MainLoop()
    thread = threading.Thread(target=loop.run, daemon=True)
    thread.start()
    try:
        for role, payload, hold_ms in frames:
            adv.payload = payload
            manager.RegisterAdvertisement(adv.PATH, {},
                                          dbus_interface="org.bluez.LEAdvertisingManager1")
            print(f"  on air [{role}] {hold_ms} ms: {hexs(payload)}")
            time.sleep(hold_ms / 1000.0)
            manager.UnregisterAdvertisement(adv.PATH,
                                            dbus_interface="org.bluez.LEAdvertisingManager1")
    finally:
        adv.remove_from_connection()
        loop.quit()
    return True


def air_via_bluetoothctl(frames):
    """Last resort: bluetoothctl's advertise menu. Version-dependent —
    a failed menu command aborts this path instead of guessing."""
    try:
        version = subprocess.run(["bluetoothctl", "--version"],
                                 capture_output=True, text=True, timeout=10)
    except Exception as e:
        raise PathUnavailable(f"bluetoothctl not runnable ({e})")
    if version.returncode != 0:
        raise PathUnavailable("bluetoothctl not runnable")
    for role, payload, hold_ms in frames:
        data_args = " ".join(f"0x{b:02x}" for b in payload)
        script = (f"menu advertise\n"
                  f"manufacturer 0x{COMPANY_ID:04x} {data_args}\n"
                  f"back\n"
                  f"advertise on\n")
        run = subprocess.run(["bluetoothctl"], input=script, capture_output=True,
                             text=True, timeout=15)
        out = (run.stdout or "") + (run.stderr or "")
        if "Failed" in out or "not available" in out.lower():
            subprocess.run(["bluetoothctl"], input="advertise off\n",
                           capture_output=True, text=True, timeout=10)
            raise PathUnavailable(
                "bluetoothctl advertise menu refused the manufacturer data "
                f"on this BlueZ ({version.stdout.strip()})")
        print(f"  on air [{role}] {hold_ms} ms: {hexs(payload)} "
              f"(bluetoothctl — connectable-type could not be forced)")
        time.sleep(hold_ms / 1000.0)
        subprocess.run(["bluetoothctl"], input="advertise off\n",
                       capture_output=True, text=True, timeout=10)
    return True


def air_live(frames):
    powered = adapter_powered()
    if powered is False:
        print("The Bluetooth adapter (hci0) reads Powered: no.")
        print("Unblock step:  bluetoothctl power on   "
              "(if that refuses, run it as: sudo bluetoothctl power on)")
        return False
    reasons = []
    for name, fn in [("Gio/D-Bus", air_via_gio),
                     ("dbus-python", air_via_dbus_python),
                     ("bluetoothctl", air_via_bluetoothctl)]:
        try:
            print(f"Broadcast path: {name}")
            return fn(frames)
        except PathUnavailable as e:
            reasons.append(f"{name}: {e}")
            print(f"  path unavailable — {e}")
        except Exception as e:  # permission denied lands here, typically
            reasons.append(f"{name}: {type(e).__name__}: {e}")
            print(f"  path failed — {type(e).__name__}: {e}")
    print("\nNo unprivileged broadcast path worked. The exact unblock:")
    print(f"  sudo python3 {__file__} <command> --live")
    print("(Running this same script as root carries the D-Bus permission "
          "BlueZ asks for. Nothing else about the send changes.)")
    return False


# ------------------------------------------------------------------ main

def main():
    parser = argparse.ArgumentParser(
        description="Wepwawet sender — Augie's frames to the robot dog.")
    parser.add_argument("command", nargs="?",
                        help="a command name (see --list), or step-<action>")
    parser.add_argument("--live", action="store_true",
                        help="TRANSMIT. Without this flag: dry run only.")
    parser.add_argument("--appid", default=None,
                        help="sender AppID, 8 hex chars (default: Augie's A947C15E)")
    parser.add_argument("--hold", type=int, default=None,
                        help="override the command burst hold, ms")
    parser.add_argument("--no-match", action="store_true",
                        help="skip the opening match frame")
    parser.add_argument("--air-frame", default=None, metavar="HEX",
                        help="air ONE exact frame (46 hex chars, spaces ok) "
                             "built by Augie's encoder — the Devices-panel "
                             "bridge mode. Respects --live/--hold.")
    parser.add_argument("--list", action="store_true", help="list commands")
    args = parser.parse_args()

    if not self_test():
        return 2
    if args.list:
        print("Commands (sender holds: movement 3000 ms, others 500 ms):")
        for name in COMMANDS:
            print(f"  {name}")
        print("Program steps: step-<action> for: " + ", ".join(STEP_BASES))
        return 0
    if args.air_frame is not None:
        compact = "".join(c for c in args.air_frame
                          if c in "0123456789abcdefABCDEF")
        if len(compact) != 46:
            print("--air-frame must be exactly 46 hex characters "
                  "(one 23-byte frame). Nothing was sent.")
            return 2
        payload = bytes.fromhex(compact)
        hold = args.hold or 500
        if not args.live:
            print("DRY RUN — nothing transmitted. The bridge frame "
                  "would air:")
            print(f"  [frame] {hold} ms: {hexs(payload)}")
            print("Add --live to transmit — only on the Captain's word, "
                  "with him watching the dog.")
            return 0
        print(f"LIVE — transmitting one bridge frame to Wepwawet "
              f"(company 0x{COMPANY_ID:04x}, {ADAPTER}).")
        return 0 if air_live([("frame", payload, hold)]) else 3

    if not args.command:
        parser.print_usage(sys.stderr)
        return 2

    app_id = AUGIE_APP_ID
    if args.appid:
        compact = "".join(c for c in args.appid if c in "0123456789abcdefABCDEF")
        if len(compact) != 8:
            print("--appid must be exactly 8 hex characters.")
            return 2
        app_id = bytes.fromhex(compact)

    frames = plan(args.command, app_id, args.hold, with_match=not args.no_match)
    if not args.live:
        print(f"DRY RUN — nothing transmitted. Command '{args.command}' "
              f"as AppID {app_id.hex(' ').upper()} would air:")
        for role, payload, hold_ms in frames:
            print(f"  [{role}] {hold_ms} ms: {hexs(payload)}")
        print("Add --live to transmit — only on the Captain's word, "
              "with him watching the dog.")
        return 0

    print(f"LIVE — transmitting '{args.command}' to Wepwawet "
          f"(company 0x{COMPANY_ID:04x}, {ADAPTER}).")
    return 0 if air_live(frames) else 3


if __name__ == "__main__":
    sys.exit(main())
