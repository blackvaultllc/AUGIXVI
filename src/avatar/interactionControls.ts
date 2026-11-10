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
  if (
    /\b(?:don't|do not)\s+talk again until (?:i|you) (?:say|hear)(?: your)? name\b/i.test(
      command,
    ) ||
    /\b(?:wait|stay silent|be quiet|stop answering|stop talking|don't talk|do not speak)\b/i.test(
      command,
    ) ||
    /\b(?:i'll|i will) talk to you in a minute\b/i.test(command)
  ) {
    return { type: "silence" };
  }

  const wake = command.match(/^(?:(?:hey|okay|ok)\s+)?osiris\b[\s,!?;:]*(.*)$/i);
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
  try {
    const saved = globalThis.localStorage?.getItem(SILENT_MODE_KEY);
    return saved === null || saved === undefined ? true : saved === "true";
  } catch (error) {
    console.warn("Could not read avatar interface preference.", error);
    return true;
  }
}
export const saveSilentModePreference = (value: boolean) => writePreference(SILENT_MODE_KEY, value);
