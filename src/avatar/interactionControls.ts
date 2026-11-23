export type InteractionCommand =
  | { type: "clear-screen" }
  | { type: "show-screen" }
  | { type: "silence" }
  | { type: "wake"; remainder: string }
  | null;

const normalize = (text: string) =>
  text
    .trim()
    .replace(/[.!?,;:]+$/g, "")
    .trim();

export function parseInteractionCommand(text: string): InteractionCommand {
  const command = normalize(text);
  if (/^(?:please\s+)?(?:clear screen|focus(?: mode)?)$/i.test(command)) {
    return { type: "clear-screen" };
  }
  if (/^(?:please\s+)?(?:show screen|show controls|restore controls)$/i.test(command)) {
    return { type: "show-screen" };
  }
  // Silence must BE the instruction, not a word inside a longer
  // command. The old matcher treated the bare word "wait" ANYWHERE in a
  // command as a silence order, so an ordinary "wait, open the cube"
  // latched silent mode — persisted, so every later session started
  // muted — and swallowed the command (owner defect 2026-11-21: "he's
  // not talking anymore"). Anchored phrases plus the two full explicit
  // instructions below keep every real silence order working.
  if (
    /^(?:please[\s,]+)?(?:stay silent|be quiet|stop answering|stop talking|don't talk|do not speak)\b/i.test(
      command,
    ) ||
    /^(?:please[\s,]+)?wait (?:till|til|until) (?:i|you) (?:call|say|hear)(?: your)? name\b/i.test(
      command,
    ) ||
    /\b(?:don't|do not)\s+talk again until (?:i|you) (?:say|hear)(?: your)? name\b/i.test(
      command,
    ) ||
    /\b(?:i'll|i will) talk to you in a minute\b/i.test(command)
  ) {
    return { type: "silence" };
  }

  // Wake words: "Usir" (oo-SEER — the original ancient Egyptian name of
  // Osiris, from "Dua Usir", Hail Osiris) and "Osiris" as backup.
  const wake = command.match(/^(?:(?:hey|okay|ok)\s+)?(?:usir|osiris)\b[\s,!?;:]*(.*)$/i);
  if (wake) return { type: "wake", remainder: normalize(wake[1] ?? "") };
  return null;
}

const CLEAR_SCREEN_KEY = "augi.avatar.clear-screen.v1";
const SILENT_MODE_KEY = "augi.avatar.silent-mode.v1";

function readPreference(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === "true";
  } catch (error) {
    console.warn("Could not read avatar interface preference.", error);
    return false;
  }
}

function writePreference(key: string, value: boolean): void {
  try {
    globalThis.localStorage?.setItem(key, String(value));
  } catch (error) {
    console.warn("Could not save avatar interface preference.", error);
  }
}

export const loadClearScreenPreference = () => readPreference(CLEAR_SCREEN_KEY);
export const saveClearScreenPreference = (value: boolean) =>
  writePreference(CLEAR_SCREEN_KEY, value);
export function loadSilentModePreference(): boolean {
  // Silence is a state he ORDERS, never a default (owner defect
  // 2026-11-22: "he talks, I hear nothing, the face doesn't move").
  // This loader used to default to TRUE when nothing was saved, so
  // on any machine where he had never happened to save the
  // preference the app booted muted and stayed muted: every spoken
  // line still printed to the chat (onSpeak fires first) but the
  // voice provider was never called and the bridge never entered
  // SPEAKING — no sound, no mouth. An unset preference now means
  // NOT silent; only a saved "true" (his explicit silence order,
  // persisted by saveSilentModePreference) starts him silent.
  try {
    const saved = globalThis.localStorage?.getItem(SILENT_MODE_KEY);
    return saved === "true";
  } catch (error) {
    console.warn("Could not read avatar interface preference.", error);
    return false;
  }
}
export const saveSilentModePreference = (value: boolean) => writePreference(SILENT_MODE_KEY, value);
