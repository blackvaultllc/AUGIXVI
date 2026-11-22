/**
 * LAW DESK (Part 11, operator order 2026-11-21) — Augie's legal
 * knowledge is grounded in the Library's Law shelf, and every
 * answer surface names its source. The honest limit, stated
 * wherever the desk appears: this is knowledge from books, not a
 * licensed attorney, and not legal advice for a specific case.
 */

export const LAW_DISCLAIMER =
  "Law Desk — grounded in the Library's Law shelf. Every result names its source book and article. This is knowledge, not a licensed attorney: for a real case, a real lawyer.";

export const LAW_SHELF_ID = "law";

/** One citation line for a law result, in the form the desk shows. */
export function formatLawCitation(bookTitle: string, articleTitle: string): string {
  return `Source: “${articleTitle}” — ${bookTitle} (offline Library, Law shelf)`;
}
