import type { LocomotionMode } from "./locomotion";

export const MATERIAL_ALIASES = {
  building: ["building", "buildings", "house", "houses"],
  car: ["car", "cars", "vehicle", "vehicles", "automobile"],
  blimp: ["blimp", "blimps", "zeppelin", "airship"],
  balloon: ["air balloon", "hot air balloon", "balloon", "balloons"],
  tree: ["trees", "tree"],
  mountain: ["mountains", "mountain", "peak", "peaks"],
  door: ["door", "doors", "doorway", "portal"],
  room: ["room", "rooms"],
  box: ["boxes", "box", "cube"],
  sphere: ["spheres", "sphere", "ball"],
  light: ["lights", "light", "lamp"],
  pyramid: ["pyramid", "pyramids", "the pyramid", "osiris's pyramid"],
} as const;

export type MaterialKind = keyof typeof MATERIAL_ALIASES;
export type Direction = "left" | "right" | "forward" | "back" | "up" | "down";
export type WorldCommand =
  | { type: "mode"; mode: LocomotionMode }
  | { type: "shrink" | "come-back" | "grow" | "look" | "stop" }
  | { type: "speed"; value: number }
  | { type: "make"; kind: MaterialKind }
  | { type: "make-and-walk-through"; kind: MaterialKind }
  | { type: "move"; target: MaterialKind; direction: Direction }
  | { type: "reshape"; target: MaterialKind; kind: MaterialKind }
  | { type: "remove" | "walk-through" | "drive"; target: MaterialKind }
  | {
      type: "unsupported";
      operation: "make" | "reshape" | "move" | "remove" | "walk-through" | "drive";
      request: string;
    };

function findMaterialKind(name: string): MaterialKind | null {
  const normalized = name
    .toLowerCase()
    .replace(/^(?:a|an|the|some)\s+/, "")
    .trim();
  for (const [kind, names] of Object.entries(MATERIAL_ALIASES) as [
    MaterialKind,
    readonly string[],
  ][]) {
    if (names.some((alias) => normalized === alias || normalized.endsWith(` ${alias}`))) {
      return kind;
    }
  }
  return null;
}

function parseTarget(operation: "remove" | "walk-through" | "drive", value: string): WorldCommand {
  const kind = findMaterialKind(value);
  return kind
    ? { type: operation, target: kind }
    : { type: "unsupported", operation, request: value };
}

export function parseWorldCommand(text: string): WorldCommand | null {
  const command = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
  const exactMode = command.match(/^(?:please\s+)?(idle|walk|run|fly|jump|stop)$/);
  if (exactMode) {
    return exactMode[1] === "stop"
      ? { type: "stop" }
      : { type: "mode", mode: exactMode[1] as LocomotionMode };
  }
  if (/^(?:please\s+)?(?:walk around|explore)$/.test(command))
    return { type: "mode", mode: "walk" };
  if (/^(?:please\s+)?shrink(?:\s+(?:down|small))?$/.test(command)) return { type: "shrink" };
  if (/^(?:please\s+)?(?:come\s+back|return(?:\s+home)?|go\s+back)$/.test(command))
    return { type: "come-back" };
  if (/^(?:please\s+)?(?:grow(?:\s+back)?|full\s+size)$/.test(command)) return { type: "grow" };
  if (/^(?:please\s+)?look around(?:\s+you)?$/.test(command)) return { type: "look" };

  const speedMatch = command.match(/^(?:set\s+)?speed(?:\s+to)?\s+(\d+(?:\.\d+)?)$/);
  if (speedMatch) return { type: "speed", value: Number(speedMatch[1]) };

  const compoundMatch = command.match(
    /^(?:make|build|create|materialize|spawn)\s+(.+?)\s+and\s+walk\s+through\s+(?:it|(?:the\s+)?(.+))$/,
  );
  if (compoundMatch) {
    const request = compoundMatch[1]!.replace(/^(?:me\s+)?(?:a|an|the|some)\s+/, "").trim();
    const kind = findMaterialKind(request);
    return kind
      ? { type: "make-and-walk-through", kind }
      : { type: "unsupported", operation: "make", request };
  }

  const makeMatch = command.match(/^(?:make|build|create|materialize|spawn)\s+(.+)$/);
  if (makeMatch) {
    const request = makeMatch[1]!.replace(/^(?:me\s+)?(?:a|an|the|some)\s+/, "").trim();
    const kind = findMaterialKind(request);
    return kind ? { type: "make", kind } : { type: "unsupported", operation: "make", request };
  }

  const reshapeMatch = command.match(
    /^(?:reshape|change|turn)\s+(?:the\s+|those\s+|these\s+)?(.+?)\s+(?:into|to)\s+(.+)$/,
  );
  if (reshapeMatch) {
    const targetKind = findMaterialKind(reshapeMatch[1]!);
    const kind = findMaterialKind(reshapeMatch[2]!);
    if (targetKind && kind) return { type: "reshape", target: targetKind, kind };
    return { type: "unsupported", operation: "reshape", request: reshapeMatch[2]! };
  }

  const moveMatch = command.match(
    /^(?:move|shift)\s+(?:the\s+|those\s+|these\s+)?(.+?)(?:\s+(left|right|forward|back|up|down))?$/,
  );
  if (moveMatch) {
    const target = findMaterialKind(moveMatch[1]!);
    if (target) {
      return {
        type: "move",
        target,
        direction: (moveMatch[2] as Direction | undefined) || "right",
      };
    }
    return { type: "unsupported", operation: "move", request: moveMatch[1]! };
  }

  const walkThroughMatch = command.match(/^walk\s+through\s+(?:the\s+)?(.+)$/);
  if (walkThroughMatch) return parseTarget("walk-through", walkThroughMatch[1]!);

  const driveMatch = command.match(/^drive\s+(?:the\s+)?(.+)$/);
  if (driveMatch) return parseTarget("drive", driveMatch[1]!);

  const removeMatch = command.match(/^(?:remove|delete|clear)\s+(?:the\s+|those\s+)?(.+)$/);
  if (removeMatch) return parseTarget("remove", removeMatch[1]!);

  return null;
}

export function isCameraVisionRequest(text: string): boolean {
  return /\b(?:what do you see|what can you see|look through (?:the )?camera|describe (?:what(?:'s| is) )?(?:in front of you|the scene|the camera)|look at (?:this|the scene))\b/i.test(
    text,
  );
}
