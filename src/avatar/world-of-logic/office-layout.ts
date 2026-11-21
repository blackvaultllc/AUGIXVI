/**
 * WORLD OF LOGIC — ported from the VoiceWave Command Deck
 * (blackvaultllc/voicewave-command-deck @ 7653d36, src/lib/office-layout.ts).
 * Only the Tile type crosses over: it is the one piece of the deck's
 * layout system the battle engine (battles.ts) names. Verbatim.
 */
export interface Tile {
  x: number;
  y: number;
}
