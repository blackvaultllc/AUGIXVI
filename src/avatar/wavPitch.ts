/**
 * WAV PITCH SHIFT — the tuning half of the construct's voice
 * (owner order 2026-11-26). Piper has no pitch control; the depth
 * is made here, on the generated audio itself: the PCM samples are
 * resampled by the voice's pitch factor. Below 1 the pitch drops
 * (and the line runs a touch longer — the measured pace of the
 * disciplined delivery). Pure buffer math, unit-testable, and
 * honest about its limits: anything that is not 16-bit PCM WAV
 * passes through untouched rather than being mangled.
 */

function readTag(buffer: Buffer, offset: number): string {
  return buffer.toString("ascii", offset, offset + 4);
}

/**
 * Shift a WAV buffer's pitch by `factor` (0.5..1 — deeper). Returns
 * the input unchanged when the factor is 1, out of range, or the
 * buffer is not a 16-bit PCM WAV this code can read safely.
 */
export function shiftWavPitch(wav: Buffer, factor: number): Buffer {
  if (!Number.isFinite(factor) || factor >= 1 || factor < 0.5) return wav;
  if (wav.length < 44 || readTag(wav, 0) !== "RIFF" || readTag(wav, 8) !== "WAVE") {
    return wav;
  }
  // Walk the chunks to find fmt + data; never trust fixed offsets.
  let fmtOffset = -1;
  let dataOffset = -1;
  let dataLength = 0;
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const tag = readTag(wav, offset);
    const size = wav.readUInt32LE(offset + 4);
    if (tag === "fmt ") fmtOffset = offset + 8;
    if (tag === "data") {
      dataOffset = offset + 8;
      dataLength = Math.min(size, wav.length - dataOffset);
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (fmtOffset < 0 || dataOffset < 0 || dataLength <= 0) return wav;
  const audioFormat = wav.readUInt16LE(fmtOffset);
  const channels = wav.readUInt16LE(fmtOffset + 2);
  const bitsPerSample = wav.readUInt16LE(fmtOffset + 14);
  if (audioFormat !== 1 || bitsPerSample !== 16 || channels < 1) return wav;

  const frameSize = 2 * channels;
  const frameCount = Math.floor(dataLength / frameSize);
  if (frameCount < 2) return wav;
  const outFrames = Math.floor(frameCount / factor);
  const outDataLength = outFrames * frameSize;
  const header = Buffer.from(wav.subarray(0, dataOffset));
  // The data chunk size fields must tell the truth about the new length.
  header.writeUInt32LE(outDataLength, dataOffset - 4);
  header.writeUInt32LE(dataOffset - 8 + outDataLength + (outDataLength % 2), 4);
  const out = Buffer.alloc(outDataLength);
  for (let frame = 0; frame < outFrames; frame += 1) {
    const sourcePosition = frame * factor;
    const sourceFrame = Math.floor(sourcePosition);
    const fraction = sourcePosition - sourceFrame;
    const nextFrame = Math.min(sourceFrame + 1, frameCount - 1);
    for (let channel = 0; channel < channels; channel += 1) {
      const a = wav.readInt16LE(dataOffset + (sourceFrame * channels + channel) * 2);
      const b = wav.readInt16LE(dataOffset + (nextFrame * channels + channel) * 2);
      const value = Math.round(a + (b - a) * fraction);
      out.writeInt16LE(Math.max(-32768, Math.min(32767, value)), (frame * channels + channel) * 2);
    }
  }
  return Buffer.concat([header, out]);
}
