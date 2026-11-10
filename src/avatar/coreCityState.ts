export type CoreCityState = { mode: "CORE_FULL" } | { mode: "CORE_SMALL"; view: "CITY" };
export type CoreCityAction = "SHOW_CITY" | "BACK_TO_CORE" | "WAKE_CORE";
export type ParsedCoreCommand = {
  action: CoreCityAction | null;
  message: string;
};

export function parseCoreCommand(text: string): ParsedCoreCommand {
  const command = text.trim();
  const wakeMatch = command.match(/^(?:hey\s+)?core\b[\s,.:!-]*/i);
  const remainder = wakeMatch ? command.slice(wakeMatch[0].length).trim() : command;

  if (/^(back to core|return to core)$/i.test(remainder)) {
    return { action: "BACK_TO_CORE", message: "" };
  }
  if (/\b(show|open|go to|take me to)\b.*\bcity\b|\bmy city\b/i.test(remainder)) {
    return { action: "SHOW_CITY", message: "" };
  }
  if (wakeMatch) {
    return { action: "WAKE_CORE", message: remainder };
  }
  return { action: null, message: remainder };
}

export function reduceCoreCityState(state: CoreCityState, action: CoreCityAction): CoreCityState {
  switch (action) {
    case "SHOW_CITY":
      return { mode: "CORE_SMALL", view: "CITY" };
    case "BACK_TO_CORE":
    case "WAKE_CORE":
      return { mode: "CORE_FULL" };
  }
}
