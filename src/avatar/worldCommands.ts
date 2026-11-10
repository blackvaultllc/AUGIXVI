export type MaterialKind =
  "car" | "blimp" | "balloon" | "mountain" | "tree" | "box" | "sphere" | "light";

export type WorldCommand =
  | { type: "shrink" | "walk" | "come-back" | "grow" | "drive" | "stop" }
  | { type: "look" }
  | { type: "make"; kind: MaterialKind }
  | {
      type: "move";
      target: MaterialKind;
      direction: "left" | "right" | "forward" | "back" | "up" | "down";
    }
  | { type: "reshape"; target: MaterialKind; kind: MaterialKind }
  | { type: "remove"; target: MaterialKind }
  | { type: "unsupported"; operation: "make" | "reshape" | "move" | "remove"; request: string };

type Direction = "left" | "right" | "forward" | "back" | "up" | "down";

const aliases: Record<MaterialKind, string[]> = {
  car: ["car", "vehicle", "automobile"],
  blimp: ["blimp", "zeppelin", "airship"],
  balloon: ["air balloon", "hot air balloon", "balloon"],
  mountain: ["mountains", "mountain", "peak", "peaks"],
  tree: ["trees", "tree"],
  box: ["boxes", "box", "cube"],
  sphere: ["spheres", "sphere", "ball"],
  light: ["lights", "light", "lamp"],
};

function findMaterialKind(name: string): MaterialKind | null {
  const normalized = name
    .toLowerCase()
    .replace(/^(?:a|an|the|some)\s+/, "")
    .trim();
  return (
    (Object.entries(aliases).find(([, names]) =>
      names.some((alias) => normalized === alias || normalized.endsWith(` ${alias}`)),
    )?.[0] as MaterialKind | undefined) ?? null
  );
}

export function parseWorldCommand(text: string): WorldCommand | null {
  const command = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
  if (/^(?:please\s+)?shrink(?:\s+(?:down|small))?$/.test(command)) return { type: "shrink" };
  if (/^(?:please\s+)?(?:walk(?:\s+around)?|explore)$/.test(command)) return { type: "walk" };
  if (/^(?:please\s+)?(?:come\s+back|return(?:\s+home)?|go\s+back)$/.test(command))
    return { type: "come-back" };
  if (/^(?:please\s+)?(?:grow(?:\s+back)?|full\s+size)$/.test(command)) return { type: "grow" };
  if (/^(?:please\s+)?look around(?:\s+you)?$/.test(command)) return { type: "look" };
  if (/^(?:please\s+)?(?:drive(?:\s+the)?\s+car|drive\s+it)$/.test(command))
    return { type: "drive" };
  if (/^(?:please\s+)?(?:stop(?:\s+walking|\s+driving)?|stay)$/.test(command))
    return { type: "stop" };

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
  if (/^(?:reshape|change|turn)\b/.test(command)) {
    return {
      type: "unsupported",
      operation: "reshape",
      request: command.replace(/^(?:reshape|change|turn)\s*/, ""),
    };
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

  const removeMatch = command.match(/^(?:remove|delete|clear)\s+(?:the\s+|those\s+)?(.+)$/);
  if (removeMatch) {
    const target = findMaterialKind(removeMatch[1]!);
    if (target) return { type: "remove", target };
    return { type: "unsupported", operation: "remove", request: removeMatch[1]! };
  }

  if (/^(?:make|build|create|materialize|spawn)\b/.test(command)) {
    return {
      type: "unsupported",
      operation: "make",
      request: command.replace(/^(?:make|build|create|materialize|spawn)\s*/, ""),
    };
  }
  return null;
}

export function isCameraVisionRequest(text: string): boolean {
  return /\b(?:what do you see|what can you see|look through (?:the )?camera|describe (?:what(?:'s| is) )?(?:in front of you|the scene|the camera)|look at (?:this|the scene))\b/i.test(
    text,
  );
}
