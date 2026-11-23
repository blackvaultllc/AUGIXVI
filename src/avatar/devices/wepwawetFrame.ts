/**
 * WEPWAWET FRAME ENCODER — the ATLAS robot dog's control frames,
 * built byte-for-byte from the FENG MA teardown
 * (~/workspace/augie-mission/atlas-dog/atlas-dog-protocol.md, §3).
 *
 * The dog has NO Bluetooth connection, no pairing, no GATT. The
 * vendor app is a one-way BLE advertising broadcaster: every command
 * is a 23-byte manufacturer payload (company ID 0x0006) swapped into
 * a non-connectable advertising set for a timed burst, then replaced
 * by the zero frame. This module builds those payloads. It sends
 * nothing by itself — the send path is the broadcast channel in
 * commandModule.ts, gated by the Permission Law like every send,
 * and the live transmitter is the Parrot-side sender.
 *
 * BYTE TRUTH: the five worked examples in protocol §3.3 (match,
 * zero, stop, forward, dance — default AppID 12 34 56 78) are pinned
 * byte-for-byte in src/test/wepwawet-frame.test.ts. This encoder is
 * correct only while those tests pass.
 */

/** Manufacturer company ID the dog listens under. */
export const WEPWAWET_COMPANY_ID = 0x0006;

/** The fixed frame address — every dog of this family hears it. */
export const WEPWAWET_FRAME_ADDRESS: readonly number[] = [0xc3, 0xc2, 0xc1, 0xc0];

/** Frame command bytes: D0 = match/"connect" frame, E0 = data frame. */
export const WEPWAWET_CMD_MATCH = 0xd0;
export const WEPWAWET_CMD_DATA = 0xe0;

/**
 * The AppID the teardown's worked examples are computed with — the
 * vendor app's factory default before it randomizes its own. Kept
 * for byte-verification only; Augie does not send as the vendor app.
 */
export const VENDOR_DEFAULT_APP_ID: readonly number[] = [0x12, 0x34, 0x56, 0x78];

/**
 * AUGIE'S OWN AppID — generated once (2026-11-23) and kept, the way
 * protocol §11 prescribes: it is the sender name inside every frame
 * Augie broadcasts. Whether the dog filters on AppID at all is a
 * live-capture question (protocol §10.2); until that is answered,
 * Augie always sends under this one name so the dog sees a single
 * consistent sender.
 */
export const AUGIE_APP_ID: readonly number[] = [0xa9, 0x47, 0xc1, 0x5e];

/** XOR mask applied to frame bytes 8–19 (protocol §3.2 step 2). */
const XOR_MASK: readonly number[] = [
  0x80, 0xf5, 0x3b, 0x0d, 0x6d, 0x2a, 0xf9, 0xbc, 0x51, 0x8e, 0x4c, 0xfd,
];

/** Channel-39 key XORed over the whole bit-reversed frame (§3.2 step 5). */
const CHANNEL_39_KEY: readonly number[] = [
  0x59, 0xde, 0xe1, 0x8f, 0x1b, 0xa5, 0xaf, 0x42, 0x7b, 0x4e, 0xcd, 0x60, 0xeb, 0x62, 0x22, 0x90,
  0x2c, 0xef, 0xf0, 0xc7, 0x8d, 0xd2,
];

/** Flip the bit order within one byte (protocol §3.2 step 4). */
export function bitReverseByte(b: number): number {
  let r = 0;
  for (let i = 0; i < 8; i += 1) {
    if (b & (1 << i)) r |= 1 << (7 - i);
  }
  return r & 0xff;
}

/**
 * The code's CRC-16 variant (protocol §3.2 step 3): per byte, swap
 * the two halves, XOR the byte in, then the three shift/XOR folds.
 * Starts from 0xFFFF; the caller stores it big-endian at bytes 20–21.
 */
export function wepwawetCrc16(bytes: readonly number[]): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc = ((crc << 8) | (crc >>> 8)) & 0xffff;
    crc ^= byte & 0xff;
    crc ^= (crc & 0xff) >> 4;
    crc ^= (crc << 12) & 0xffff;
    crc ^= ((crc & 0xff) << 5) & 0xffff;
  }
  return crc & 0xffff;
}

export type WepwawetFrameInput = {
  /** WEPWAWET_CMD_MATCH or WEPWAWET_CMD_DATA. */
  cmd: number;
  /** The five data bytes D0–D4 (protocol §5/§6). */
  data: readonly number[];
  /** The sender's 4 AppID bytes. Defaults to Augie's own. */
  appId?: readonly number[] | undefined;
};

function checkedBytes(values: readonly number[], count: number, what: string): number[] {
  if (values.length !== count) {
    throw new Error(`${what} must be exactly ${count} bytes — got ${values.length}.`);
  }
  return values.map((v) => {
    if (!Number.isInteger(v) || v < 0 || v > 255) {
      throw new Error(`${what} holds a value that is not a byte: ${v}.`);
    }
    return v;
  });
}

/**
 * Build the plain 22-byte frame (protocol §3.1) with the checksum
 * filled in — the state BEFORE the obfuscation pipeline runs.
 * Exposed so tests can pin the layout independently of the cipher.
 */
export function buildWepwawetPlainFrame(input: WepwawetFrameInput): number[] {
  const data = checkedBytes(input.data, 5, "Wepwawet data");
  const appId = checkedBytes(input.appId ?? AUGIE_APP_ID, 4, "Wepwawet AppID");
  const frame = new Array<number>(22).fill(0);
  frame[0] = 0xaa;
  frame[1] = 0x70;
  frame[2] = WEPWAWET_FRAME_ADDRESS[0]!;
  frame[3] = WEPWAWET_FRAME_ADDRESS[1]!;
  frame[4] = WEPWAWET_FRAME_ADDRESS[2]!;
  frame[5] = WEPWAWET_FRAME_ADDRESS[3]!;
  frame[6] = 0x3f;
  frame[7] = 0xc0;
  frame[8] = input.cmd & 0xff;
  frame[9] = 0x54;
  frame[10] = appId[0]!;
  frame[11] = appId[1]!;
  frame[12] = appId[2]!;
  frame[13] = appId[3]!;
  frame[14] = data[0]!;
  frame[15] = data[1]!;
  frame[16] = data[2]!;
  frame[17] = data[3]!;
  frame[18] = data[4]!;
  let sum = 0;
  for (let i = 8; i <= 18; i += 1) sum += frame[i]!;
  frame[19] = sum & 0xff;
  return frame;
}

/**
 * Build the exact 23-byte manufacturer payload that goes on air:
 * plain frame → XOR mask over bytes 8–19 → CRC-16 over bytes 1–5 ‖
 * 8–19 (post-XOR) stored big-endian at 20–21 → bit-reverse every
 * byte → XOR the channel-39 key → prefix one 0x00 byte.
 */
export function buildWepwawetPayload(input: WepwawetFrameInput): Uint8Array {
  const frame = buildWepwawetPlainFrame(input);
  for (let i = 0; i < 12; i += 1) {
    frame[8 + i] = frame[8 + i]! ^ XOR_MASK[i]!;
  }
  const crc = wepwawetCrc16([...frame.slice(1, 6), ...frame.slice(8, 20)]);
  frame[20] = (crc >> 8) & 0xff;
  frame[21] = crc & 0xff;
  const onAir = frame.map((b, i) => bitReverseByte(b) ^ CHANNEL_39_KEY[i]!);
  return new Uint8Array([0x00, ...onAir]);
}

/* ------------------------- command primitives ------------------------- */

/** sendData(x, y) → D3=x, D4=y — almost every action (protocol §5). */
export function sendDataPayload(
  x: number,
  y: number,
  appId?: readonly number[] | undefined,
): Uint8Array {
  return buildWepwawetPayload({ cmd: WEPWAWET_CMD_DATA, data: [0, 0, 0, x, y], appId });
}

/** sendData2(x, y) → D2=x, D3=y, D4=0 — song, fire (pid 1), rotations. */
export function sendData2Payload(
  x: number,
  y: number,
  appId?: readonly number[] | undefined,
): Uint8Array {
  return buildWepwawetPayload({ cmd: WEPWAWET_CMD_DATA, data: [0, 0, x, y, 0], appId });
}

/** controlLeg(leg[4]) → each leg value 1–6 packed as nibbles (§6.5). */
export function controlLegPayload(
  legs: readonly number[],
  appId?: readonly number[] | undefined,
): Uint8Array {
  const [l0, l1, l2, l3] = checkedBytes(legs, 4, "Wepwawet leg pose");
  return buildWepwawetPayload({
    cmd: WEPWAWET_CMD_DATA,
    data: [l0! + 16 * l1!, l2! + 16 * l3!, 0, 0, 0],
    appId,
  });
}

/** The match/"connect" frame: cmd D0, all data zero (§3.4). */
export function matchPayload(appId?: readonly number[] | undefined): Uint8Array {
  return buildWepwawetPayload({ cmd: WEPWAWET_CMD_MATCH, data: [0, 0, 0, 0, 0], appId });
}

/** The zero frame: cmd E0, all data zero — the trailing frame after
 *  every command, and the program-mode run trigger (§3.4, §6.4). */
export function zeroPayload(appId?: readonly number[] | undefined): Uint8Array {
  return buildWepwawetPayload({ cmd: WEPWAWET_CMD_DATA, data: [0, 0, 0, 0, 0], appId });
}

/** Lowercase space-separated hex, the form the protocol doc uses. */
export function payloadHex(payload: Uint8Array | readonly number[]): string {
  return [...payload].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

/**
 * Read an AppID out of a binding address: the operator may set the
 * address to 8 hex characters ("A947C15E", spaces tolerated).
 * Anything else reads as null and the caller falls back to Augie's.
 */
export function parseAppId(text: string | undefined): number[] | null {
  if (!text) return null;
  const compact = text.replace(/[^0-9a-fA-F]/g, "");
  if (compact.length !== 8) return null;
  const out: number[] = [];
  for (let i = 0; i < 8; i += 2) out.push(parseInt(compact.slice(i, i + 2), 16));
  return out;
}

/* --------------------- from a profile command to frames --------------------- */

export type BroadcastFrame = {
  payload: Uint8Array;
  /** How long this frame is held on air before the next, in ms. */
  holdMs: number;
  /** "command" or "zero (trailing)" — for the log and the dry run. */
  role: "match" | "command" | "zero";
};

/**
 * The frames one profile command puts on air (protocol §3.4): the
 * command frame held for its burst, then the zero frame. The match
 * frame and the zero frame themselves go out alone — a second zero
 * after them would be noise.
 */
export function framesForBroadcastCommand(
  payload: { cmd: number; data: readonly number[]; holdMs: number },
  appId?: readonly number[] | undefined,
): BroadcastFrame[] {
  const own = buildWepwawetPayload({ cmd: payload.cmd, data: payload.data, appId });
  if (payload.cmd === WEPWAWET_CMD_MATCH) {
    return [{ payload: own, holdMs: payload.holdMs, role: "match" }];
  }
  const isZero = payload.data.every((b) => b === 0);
  if (isZero) {
    return [{ payload: own, holdMs: payload.holdMs, role: "zero" }];
  }
  return [
    { payload: own, holdMs: payload.holdMs, role: "command" },
    { payload: zeroPayload(appId), holdMs: 500, role: "zero" },
  ];
}
