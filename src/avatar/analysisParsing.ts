/**
 * Splitting a vision model's answer into a summary + a findings list.
 *
 * The analytic window's prompt asks the model for a short description
 * followed by a "FINDINGS:" section with one item per line. This pure
 * parser does the split so the window can render the picture, the
 * summary and the list of things found as separate pieces (Part 27).
 * If the model ignores the format, the whole answer is the summary
 * and the findings list is honestly empty — nothing is invented here.
 */
export function parseAnalysis(text: string): { summary: string; findings: string[] } {
  const trimmed = text.trim();
  const marker = /findings\s*:/i.exec(trimmed);
  if (!marker) return { summary: trimmed, findings: [] };
  const summary = trimmed.slice(0, marker.index).trim();
  const rest = trimmed.slice(marker.index + marker[0].length);
  const findings = rest
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0);
  return { summary, findings };
}
