/**
 * REPORT ATTRIBUTION — which god signs a report in the record.
 *
 * This module used to also carry the god pop-up's placement
 * math and measures. THE POP-UP IS REMOVED
 * (owner order 2026-11-24 ~09:57 EST): "I see Anubis keeps
 * popping up on the side and his scepter is getting in the way
 * of the actual Anubis. Stop having that pop up. I don't want to
 * see that anymore." No god's face pops up on the stage for a
 * report or a reply, ever; a report reaches the Captain by the
 * god's voice and waits in the conversation record (notify() in
 * AvatarStage writes it there under the reporting god's name).
 *
 * What remains is the attribution: a report surfaces under the
 * god whose department it belongs to. Defense and security
 * reports are signed by Montu, commander of the army; everything
 * else by Anubis, in overall command — the face the Captain
 * talks with day to day.
 *
 * Plain TS, no three.js, no DOM — unit-testable per the repo rules.
 */

export type ReportGodId = "anubis" | "montu";

/** Which god signs a report on this topic in the record. */
export function godForReportTopic(topic: string): ReportGodId {
  const words = topic.toLowerCase();
  if (
    words.includes("montu") ||
    words.includes("secur") ||
    words.includes("defen") ||
    words.includes("war") ||
    words.includes("guard")
  ) {
    return "montu";
  }
  return "anubis";
}
