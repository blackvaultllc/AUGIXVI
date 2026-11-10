/**
 * Room-analyze requests (Command scope, owner order 2026-11-10):
 * phrases that should open the on-screen Room Analyzer pop-up.
 * Pure parsing — unit-testable, no DOM.
 */
export function parseRoomAnalyzeRequest(text: string): boolean {
  return (
    /\b(?:analyze|scan|check)\s+(?:the\s+)?room\b/i.test(text) ||
    /\b(?:what(?:'s| is)\s+(?:in\s+)?(?:my|the)\s+room)\b/i.test(text) ||
    /\b(?:analyze|assess)\s+(?:the\s+)?(?:room|area|surroundings|environment)\b/i.test(text)
  );
}
