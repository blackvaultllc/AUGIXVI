/**
 * THE TWO WOLVES — Demon Wolf and Thunder Wolf (owner order 2026-11-10).
 * Osiris's familiars, built from wolf_with_animations.glb, walking beside
 * him in his world at all times. Pure logic here (unit-testable): orders,
 * roles, protection rules. The GLB load + particle tinting lives in the
 * renderer glue.
 *
 * ROLES:
 * - Demon Wolf  → attack / protect
 * - Thunder Wolf → scout / speed
 * Both obey Osiris AND the operator (Anubis). They NEVER attack the
 * operator, his daughter, or anyone the operator marks safe — ever.
 * Lawful defense on his own property only; never hack-back.
 */

export type WolfName = "demon" | "thunder";
export type WolfRole = "attack-protect" | "scout-speed";
export type WolfOrder = "attack" | "protect" | "scout" | "check" | "come" | "stay";

export type FamiliarOrder = {
  wolf: WolfName;
  order: Exclude<WolfOrder, "attack" | "protect"> | (WolfOrder & ("attack" | "protect"));
  target: string | null;
};

/** Colors the familiars cycle through randomly over time. */
export const WOLF_COLOR_CYCLE = [
  "#ff2a2a", // demon red
  "#7a00ff", // abyss purple
  "#00e0ff", // thunder cyan
  "#ffd200", // storm gold
  "#ff7a00", // ember
  "#7cff5a", // toxic green
] as const;

const SAFE_TITLES = /\b(anubis|operator|my daughter|daughter)\b/i;

/** Parse "demon wolf go attack the intruder" / "thunder wolf, scout ahead". */
export function parseWolfCommand(text: string): FamiliarOrder | null {
  const match = text.match(
    /\b(demon|thunder)\s+wolf\s*,?\s+(?:go\s+)?(attack|protect|scout|check|come|stay)(?:\s+(?:to|on|that|the|at))?\s*([\s\S]*)$/i,
  );
  if (!match) {
    // Bare "go attack" defaults to the Demon Wolf; "go check" to Thunder.
    const bare = text.match(
      /^(?:please\s+)?(?:go\s+)?(attack|protect|scout|check|come|stay)\b(?:[\s,:]+(?:that|the|to))?\s*([\s\S]*)$/i,
    );
    if (!bare) return null;
    const order = bare[1]!.toLowerCase() as WolfOrder;
    const wolf: WolfName = order === "attack" || order === "protect" ? "demon" : "thunder";
    return { wolf, order, target: bare[2]?.trim() || null };
  }
  return {
    wolf: match[1]!.toLowerCase() as WolfName,
    order: match[2]!.toLowerCase() as WolfOrder,
    target: match[3]?.trim().replace(/^(?:the|that|to)\s+/i, "") || null,
  };
}

/** Refusal rule: protected names are never targets. */
export function isProtectedTarget(
  target: string | null,
  safeNames: readonly string[] = [],
): boolean {
  if (!target) return false;
  if (SAFE_TITLES.test(target)) return true;
  return safeNames.some(
    (name) => name.length > 1 && target.toLowerCase().includes(name.toLowerCase()),
  );
}

export function evaluateWolfCommand(
  order: FamiliarOrder,
  safeNames: readonly string[] = [],
): { accepted: boolean; reason: string | null } {
  if (isProtectedTarget(order.target, safeNames)) {
    return {
      accepted: false,
      reason: "That is family or marked safe. The wolves will never turn on them.",
    };
  }
  const role: WolfRole = order.wolf === "demon" ? "attack-protect" : "scout-speed";
  const fits =
    (role === "attack-protect" && (order.order === "attack" || order.order === "protect")) ||
    (role === "scout-speed" && (order.order === "scout" || order.order === "check"));
  if (
    !fits &&
    (order.order === "attack" || order.order === "protect") &&
    order.wolf === "thunder"
  ) {
    return {
      accepted: false,
      reason:
        "Thunder Wolf scouts and runs — attacking is the Demon Wolf's work. Say 'demon wolf go attack' and it is done.",
    };
  }
  return { accepted: true, reason: null };
}

/** Verbal confirmation Osiris speaks when a familiar is dispatched. */
export function wolfDispatchLine(order: FamiliarOrder): string {
  const name = order.wolf === "demon" ? "Demon Wolf" : "Thunder Wolf";
  const verb =
    order.order === "attack"
      ? "moves to attack"
      : order.order === "protect"
        ? "stands guard"
        : order.order === "scout"
          ? "runs scouting"
          : order.order === "check"
            ? "goes to check"
            : order.order === "come"
              ? "falls in beside me"
              : "holds position";
  return order.target ? `${name} ${verb} ${order.target}.` : `${name} ${verb}.`;
}
