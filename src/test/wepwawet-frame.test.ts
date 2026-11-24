import { beforeEach, describe, expect, it } from "vitest";
import {
  AUGIE_APP_ID,
  VENDOR_DEFAULT_APP_ID,
  WEPWAWET_CMD_DATA,
  WEPWAWET_CMD_MATCH,
  WEPWAWET_COMPANY_ID,
  bitReverseByte,
  buildWepwawetPayload,
  buildWepwawetPlainFrame,
  controlLegPayload,
  framesForBroadcastCommand,
  matchPayload,
  parseAppId,
  payloadHex,
  sendData2Payload,
  sendDataPayload,
  wepwawetCrc16,
  zeroPayload,
} from "@/avatar/devices/wepwawetFrame";
import {
  WEPWAWET_COMMAND_GROUPS,
  WEPWAWET_DOG_PROFILE,
  sanitizeCommandProfile,
  type DeviceCommand,
} from "@/avatar/devices/commandProfiles";
import {
  createSimulatedBroadcastChannel,
  createSimulatedPrinterChannel,
  loadCommandLog,
  logForDevice,
  sendDeviceCommand,
} from "@/avatar/devices/commandModule";
import type { DeviceProfile } from "@/avatar/devices/deviceRegistry";

/**
 * WEPWAWET BROADCAST CONTROL (Captain's order 2026-11-23: build the
 * FENG MA protocol into Augie so Augie controls the ATLAS dog —
 * "give my AI a body"; his per-device control grant for this dog
 * stands from the same day).
 *
 * THE BYTE TRUTH: the five worked examples of the teardown doc
 * (atlas-dog-protocol.md §3.3) are pinned below byte-for-byte. An
 * encoder that does not reproduce them exactly is wrong, whatever
 * else it does. Every other command is proven by DECODING: the
 * decoder here is written from the doc's constants, independently
 * of the encoder, and reverses the obfuscation chain to check the
 * plain frame inside.
 *
 * No hardware is touched and NO frame is transmitted anywhere in
 * this file — the simulated broadcast peer models the air, not a
 * dog, and the live first broadcast waits for the Captain's word.
 */

/* ------- the doc's worked examples (§3.3, AppID 12 34 56 78) ------- */

const DOC_EXAMPLES: Record<string, string> = {
  match: "00 0c d0 22 cc 98 a6 53 41 71 cb 59 fc 37 28 bd ad a6 9e c2 64 24 44",
  zero: "00 0c d0 22 cc 98 a6 53 41 7d cb 59 fc 37 28 bd ad a6 9e c2 6a c0 a2",
  stop: "00 0c d0 22 cc 98 a6 53 41 7d cb 59 fc 37 28 bd ad a6 9e 42 ea 04 aa",
  forward: "00 0c d0 22 cc 98 a6 53 41 7d cb 59 fc 37 28 bd ad a6 9e 82 2a a2 a6",
  dance: "00 0c d0 22 cc 98 a6 53 41 7d cb 59 fc 37 28 bd ad a6 9e 72 d2 6d a1",
};

/* ------- an independent decoder, from the doc's constants ------- */

const DOC_XOR_MASK = [
  0x80, 0xf5, 0x3b, 0x0d, 0x6d, 0x2a, 0xf9, 0xbc, 0x51, 0x8e, 0x4c, 0xfd,
];
const DOC_CH39_KEY = [
  0x59, 0xde, 0xe1, 0x8f, 0x1b, 0xa5, 0xaf, 0x42, 0x7b, 0x4e, 0xcd, 0x60, 0xeb, 0x62, 0x22,
  0x90, 0x2c, 0xef, 0xf0, 0xc7, 0x8d, 0xd2,
];

type DecodedFrame = {
  cmd: number;
  appId: number[];
  data: number[];
};

/** Reverse §3.2: strip the 0x00 prefix, un-XOR the channel key,
 *  un-reverse the bits, verify the CRC, un-XOR the mask, verify
 *  the checksum and the fixed template bytes. Throws on any break. */
function decodePayload(payload: Uint8Array): DecodedFrame {
  expect(payload.length).toBe(23);
  expect(payload[0]).toBe(0x00);
  const frame = [...payload.slice(1)].map((b, i) => bitReverseByte(b ^ DOC_CH39_KEY[i]!));
  const storedCrc = (frame[20]! << 8) | frame[21]!;
  expect(wepwawetCrc16([...frame.slice(1, 6), ...frame.slice(8, 20)])).toBe(storedCrc);
  const plain = frame.map((b, i) => (i >= 8 && i <= 19 ? b ^ DOC_XOR_MASK[i - 8]! : b));
  let sum = 0;
  for (let i = 8; i <= 18; i += 1) sum += plain[i]!;
  expect(plain[19]).toBe(sum & 0xff);
  expect(plain[0]).toBe(0xaa);
  expect(plain[1]).toBe(0x70);
  expect(plain.slice(2, 6)).toEqual([0xc3, 0xc2, 0xc1, 0xc0]);
  expect(plain[6]).toBe(0x3f);
  expect(plain[7]).toBe(0xc0);
  expect(plain[9]).toBe(0x54);
  return { cmd: plain[8]!, appId: plain.slice(10, 14), data: plain.slice(14, 19) };
}

describe("the frame encoder — byte-verified against the teardown doc", () => {
  it("reproduces the doc's MATCH example byte-for-byte", () => {
    expect(payloadHex(matchPayload(VENDOR_DEFAULT_APP_ID))).toBe(DOC_EXAMPLES["match"]);
  });

  it("reproduces the doc's ZERO example byte-for-byte", () => {
    expect(payloadHex(zeroPayload(VENDOR_DEFAULT_APP_ID))).toBe(DOC_EXAMPLES["zero"]);
  });

  it("reproduces the doc's STOP example byte-for-byte (sendData(0,1))", () => {
    expect(payloadHex(sendDataPayload(0, 1, VENDOR_DEFAULT_APP_ID))).toBe(DOC_EXAMPLES["stop"]);
  });

  it("reproduces the doc's FORWARD example byte-for-byte (sendData(0,2))", () => {
    expect(payloadHex(sendDataPayload(0, 2, VENDOR_DEFAULT_APP_ID))).toBe(
      DOC_EXAMPLES["forward"],
    );
  });

  it("reproduces the doc's DANCE example byte-for-byte (sendData(0,13))", () => {
    expect(payloadHex(sendDataPayload(0, 13, VENDOR_DEFAULT_APP_ID))).toBe(DOC_EXAMPLES["dance"]);
  });

  it("builds the plain frame in the doc's layout (§3.1), checksum included", () => {
    const plain = buildWepwawetPlainFrame({
      cmd: WEPWAWET_CMD_DATA,
      data: [0, 0, 0, 0, 2],
      appId: VENDOR_DEFAULT_APP_ID,
    });
    expect(plain.slice(0, 10)).toEqual([
      0xaa, 0x70, 0xc3, 0xc2, 0xc1, 0xc0, 0x3f, 0xc0, 0xe0, 0x54,
    ]);
    expect(plain.slice(10, 14)).toEqual([...VENDOR_DEFAULT_APP_ID]);
    expect(plain.slice(14, 19)).toEqual([0, 0, 0, 0, 2]);
    let sum = 0;
    for (let i = 8; i <= 18; i += 1) sum += plain[i]!;
    expect(plain[19]).toBe(sum & 0xff);
  });

  it("the primitives place their bytes where the doc puts them (§5)", () => {
    expect(decodePayload(sendDataPayload(128, 0))).toEqual({
      cmd: WEPWAWET_CMD_DATA,
      appId: [...AUGIE_APP_ID],
      data: [0, 0, 0, 128, 0],
    });
    expect(decodePayload(sendData2Payload(4, 1)).data).toEqual([0, 0, 4, 1, 0]);
    // controlLeg packs leg values as nibbles: D0 = leg0 + 16·leg1, D1 = leg2 + 16·leg3
    expect(decodePayload(controlLegPayload([1, 2, 3, 4])).data).toEqual([
      1 + 16 * 2,
      3 + 16 * 4,
      0,
      0,
      0,
    ]);
    expect(decodePayload(matchPayload()).cmd).toBe(WEPWAWET_CMD_MATCH);
    expect(decodePayload(zeroPayload()).data).toEqual([0, 0, 0, 0, 0]);
  });

  it("a different AppID changes the payload from byte 10 onward — and only there (§3.3)", () => {
    const vendor = buildWepwawetPayload({
      cmd: WEPWAWET_CMD_DATA,
      data: [0, 0, 0, 0, 2],
      appId: VENDOR_DEFAULT_APP_ID,
    });
    const augie = buildWepwawetPayload({
      cmd: WEPWAWET_CMD_DATA,
      data: [0, 0, 0, 0, 2],
      appId: AUGIE_APP_ID,
    });
    // Header bytes 1–9 (payload indexes 1..9 incl. the 0x00 prefix) are
    // AppID-independent in the PLAIN frame; the CRC covers the AppID,
    // so on air the tail differs — what must hold is the decode.
    expect(decodePayload(augie)).toEqual({
      cmd: WEPWAWET_CMD_DATA,
      appId: [...AUGIE_APP_ID],
      data: [0, 0, 0, 0, 2],
    });
    expect(payloadHex(augie)).not.toBe(payloadHex(vendor));
  });

  it("parseAppId reads a binding address as Augie's sender name, or falls back", () => {
    expect(parseAppId("A947C15E")).toEqual([...AUGIE_APP_ID]);
    expect(parseAppId("12 34 56 78")).toEqual([...VENDOR_DEFAULT_APP_ID]);
    expect(parseAppId("the dog, by the desk")).toBeNull();
    expect(parseAppId(undefined)).toBeNull();
  });
});

describe("frames for a command — the burst shape (§3.4)", () => {
  it("a command goes out as its burst, then the zero frame", () => {
    const forward = WEPWAWET_DOG_PROFILE.commands.find((c) => c.id === "forward")!;
    if (forward.payload.kind !== "ble-broadcast") throw new Error("wrong payload kind");
    const frames = framesForBroadcastCommand(forward.payload, VENDOR_DEFAULT_APP_ID);
    expect(frames.map((f) => f.role)).toEqual(["command", "zero"]);
    expect(payloadHex(frames[0]!.payload)).toBe(DOC_EXAMPLES["forward"]);
    expect(payloadHex(frames[1]!.payload)).toBe(DOC_EXAMPLES["zero"]);
    // Movement holds 3000 ms — the protocol's voice-command hold
    // (§3.4) and the burst the first live test proved (2026-11-24).
    expect(frames[0]!.holdMs).toBe(3000);
  });

  it("Stop is trailed by the zero frame like every command — and Stop itself is D4=1", () => {
    const stop = WEPWAWET_DOG_PROFILE.commands.find((c) => c.id === "stop")!;
    if (stop.payload.kind !== "ble-broadcast") throw new Error("wrong payload kind");
    const frames = framesForBroadcastCommand(stop.payload, VENDOR_DEFAULT_APP_ID);
    expect(payloadHex(frames[0]!.payload)).toBe(DOC_EXAMPLES["stop"]);
    expect(frames[1]!.role).toBe("zero");
  });

  it("the match frame and the zero frame go out alone", () => {
    const match = WEPWAWET_DOG_PROFILE.commands.find((c) => c.id === "match")!;
    const execute = WEPWAWET_DOG_PROFILE.commands.find((c) => c.id === "program-execute")!;
    if (match.payload.kind !== "ble-broadcast" || execute.payload.kind !== "ble-broadcast") {
      throw new Error("wrong payload kind");
    }
    expect(framesForBroadcastCommand(match.payload)).toHaveLength(1);
    expect(framesForBroadcastCommand(execute.payload)).toHaveLength(1);
  });
});

describe("the Wepwawet profile — the full command map as data", () => {
  it("is a bluetooth-broadcast profile whose FIRST command is Stop", () => {
    expect(WEPWAWET_DOG_PROFILE.transport).toBe("bluetooth-broadcast");
    expect(WEPWAWET_DOG_PROFILE.commands[0]!.id).toBe("stop");
    expect(WEPWAWET_DOG_PROFILE.builtin).toBe(true);
  });

  it("carries the full map: movement, actions, feeding, light, song, program", () => {
    const ids = WEPWAWET_DOG_PROFILE.commands.map((c) => c.id);
    for (const id of [
      "stop",
      "match",
      "forward",
      "back",
      "turn-left",
      "turn-right",
      "sit",
      "lie-down",
      "coquetry",
      "pee",
      "greet",
      "handstand",
      "push-ups",
      "dance",
      "kung-fu",
      "swim",
      "bless",
      "patrol",
      "feed-1",
      "feed-2",
      "feed-3",
      "feed-4",
      "feed-5",
      "feed-6",
      "feed-7",
      "feed-8",
      "light",
      "song",
      "program-record",
      "program-execute",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("the card's groups cover every command exactly once, Stop's group first", () => {
    const grouped = WEPWAWET_COMMAND_GROUPS.flatMap((g) => g.commandIds);
    const ids = WEPWAWET_DOG_PROFILE.commands.map((c) => c.id);
    expect([...grouped].sort()).toEqual([...ids].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(WEPWAWET_COMMAND_GROUPS[0]!.commandIds[0]).toBe("stop");
  });

  it("every command's frame decodes back to exactly the bytes its entry claims", () => {
    for (const command of WEPWAWET_DOG_PROFILE.commands) {
      if (command.payload.kind !== "ble-broadcast") {
        throw new Error(`${command.id} is not a ble-broadcast command`);
      }
      const decoded = decodePayload(
        buildWepwawetPayload({
          cmd: command.payload.cmd,
          data: command.payload.data,
          appId: AUGIE_APP_ID,
        }),
      );
      expect(decoded.cmd).toBe(command.payload.cmd);
      expect(decoded.data).toEqual([...command.payload.data]);
      expect(decoded.appId).toEqual([...AUGIE_APP_ID]);
    }
  });

  it("the action codes match the doc's §6.1 table, the feeding codes §6.3", () => {
    const d4 = (id: string) => {
      const c = WEPWAWET_DOG_PROFILE.commands.find((x) => x.id === id)!;
      if (c.payload.kind !== "ble-broadcast") throw new Error("wrong payload kind");
      return c.payload.data[4];
    };
    expect(d4("forward")).toBe(2);
    expect(d4("back")).toBe(3);
    expect(d4("turn-left")).toBe(4);
    expect(d4("turn-right")).toBe(5);
    expect(d4("sit")).toBe(6);
    expect(d4("lie-down")).toBe(7);
    expect(d4("coquetry")).toBe(8);
    expect(d4("pee")).toBe(9);
    expect(d4("greet")).toBe(10);
    expect(d4("handstand")).toBe(11);
    expect(d4("push-ups")).toBe(12);
    expect(d4("dance")).toBe(13);
    expect(d4("kung-fu")).toBe(14);
    expect(d4("swim")).toBe(15);
    expect(d4("bless")).toBe(16);
    expect(d4("patrol")).toBe(17);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => d4(`feed-${n}`))).toEqual([
      19, 18, 21, 20, 22, 25, 24, 23,
    ]);
  });

  it("survives the profile sanitizer — an operator-saved copy loses nothing", () => {
    const clean = sanitizeCommandProfile(
      JSON.parse(JSON.stringify(WEPWAWET_DOG_PROFILE)) as unknown,
    );
    expect(clean?.id).toBe(WEPWAWET_DOG_PROFILE.id);
    expect(clean?.transport).toBe("bluetooth-broadcast");
    expect(clean?.commands.map((c) => c.id)).toEqual(
      WEPWAWET_DOG_PROFILE.commands.map((c) => c.id),
    );
    const forward = clean?.commands.find((c) => c.id === "forward");
    expect(forward?.payload).toEqual({
      kind: "ble-broadcast",
      cmd: 0xe0,
      data: [0, 0, 0, 0, 2],
      holdMs: 3000,
    });
  });
});

/* ------------------------- the send path ------------------------- */

function dog(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
  return {
    id: "device-wepwawet",
    displayName: "Wepwawet",
    kind: "other",
    transport: "ble",
    externalId: "ATLAS-DOG",
    source: "manual",
    declaredServices: [],
    capabilities: [],
    limitations: [],
    batteryLevel: null,
    measured: {},
    presence: "unknown",
    presenceEvents: [],
    firstSeen: 1000,
    lastSeen: 2000,
    ownerConfirmed: true,
    controlGranted: true,
    ...overrides,
  };
}

const profileCommand = (id: string): DeviceCommand => {
  const found = WEPWAWET_DOG_PROFILE.commands.find((c) => c.id === id);
  if (!found) throw new Error(`no dog command ${id}`);
  return found;
};

describe("sending under the Permission Law — simulated broadcast peer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("a granted Forward airs the doc's exact frames: forward burst, then zero", async () => {
    const channel = createSimulatedBroadcastChannel(WEPWAWET_COMPANY_ID);
    const outcome = await sendDeviceCommand({
      device: dog(),
      profile: WEPWAWET_DOG_PROFILE,
      command: profileCommand("forward"),
      values: {},
      address: "12345678",
      channel,
      now: 5000,
    });
    expect(outcome.result).toBe("sent");
    expect(channel.aired.map((a) => a.hex)).toEqual([
      DOC_EXAMPLES["forward"],
      DOC_EXAMPLES["zero"],
    ]);
    expect(channel.aired.map((a) => a.holdMs)).toEqual([3000, 500]);
    // One-way protocol: the note must never claim the dog obeyed.
    expect(outcome.note).toMatch(/never that the dog obeyed/i);
    const log = logForDevice(loadCommandLog(), "device-wepwawet");
    expect(log.at(-1)).toMatchObject({ commandName: "Forward", result: "sent", at: 5000 });
  });

  it("REFUSAL: without the grant the air stays EMPTY, and the refusal is logged in words", async () => {
    const channel = createSimulatedBroadcastChannel(WEPWAWET_COMPANY_ID);
    const outcome = await sendDeviceCommand({
      device: dog({ controlGranted: undefined }),
      profile: WEPWAWET_DOG_PROFILE,
      command: profileCommand("forward"),
      values: {},
      channel,
      now: 6000,
    });
    expect(outcome.result).toBe("refused");
    expect(channel.aired).toEqual([]);
    expect(logForDevice(loadCommandLog(), "device-wepwawet").at(-1)?.result).toBe("refused");
  });

  it("a line channel cannot carry a broadcast command — failed in words, nothing aired", async () => {
    const printer = createSimulatedPrinterChannel();
    const outcome = await sendDeviceCommand({
      device: dog(),
      profile: WEPWAWET_DOG_PROFILE,
      command: profileCommand("dance"),
      values: {},
      channel: printer,
      now: 7000,
    });
    expect(outcome.result).toBe("failed");
    expect(printer.received).toEqual([]);
  });

  it("no channel = UNAVAILABLE, logged, nothing sent", async () => {
    const outcome = await sendDeviceCommand({
      device: dog(),
      profile: WEPWAWET_DOG_PROFILE,
      command: profileCommand("stop"),
      values: {},
      channel: null,
      channelUnavailableReason: "The broadcast path lives on the Parrot.",
      now: 8000,
    });
    expect(outcome.result).toBe("unavailable");
    expect(outcome.note).toMatch(/Parrot/);
  });
});
