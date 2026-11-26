/**
 * VIOLET'S SIDE — the pure core (Captain's orders, main chat
 * 2026-11-26 ~14:25 and ~14:31 CST).
 *
 * Violet Hernandez — his sister, Agent 011, I-E-M's Financial
 * Advisor ("boss of the money," back office) — has her OWN
 * login and her own side of the system. Not a smaller operator
 * stage: HER side, walled the way Khadija's is walled. She
 * sees her side only, and her side holds only her tools:
 *
 *   · a NOTEPAD — hers, saved on the core;
 *   · a financial CALCULATOR — built to a banker's standard
 *     (she used to work at a bank);
 *   · the FINANCE RECORDS — the ledgers and balances of the
 *     company's money, read access, as her role carries;
 *   · EMAIL through her god — her own mailbox, connected on
 *     her side; she approves her own sends the way the Captain
 *     approves his: her god drafts, she reads, her word sends;
 *   · the "Ask for something to be added" button — the intake
 *     for anything else she needs wired in.
 *
 * THE COMFORT STANDARD (his standing rule for her side): she
 * works at the post office and does the company's finances on
 * top of it — her side should SAVE her work, never add to it.
 * Anything she needs connected to make the business work
 * easier gets wired for her; the request button is the intake.
 * Her comfort is the standard.
 *
 * HER GOD: the god of finances — gold-working — stands with
 * her as her counterpart. The Captain has NOT spoken its name:
 * the name field (departmentHeads.ts, GOD_FINANCE) stays empty
 * until his word fills it, and every surface reads the name
 * from that one field — when he confirms it, one line changes
 * and her whole side speaks it.
 *
 * Plain TS, no I/O — the store and server doors do the work.
 */
import { GOD_FINANCE, godDisplayName } from "../departmentHeads";

/* ------------------------------------------------------------------ */
/* Who she is                                                          */
/* ------------------------------------------------------------------ */

export const VIOLET_PROFILE = {
  fullName: "Violet Hernandez",
  firstName: "Violet",
  email: "violetmhernandez@gmail.com",
  designation: "Agent 011",
  role: "Financial Advisor — boss of the money, in I-E-M's back office",
} as const;

/** The standing rule for her side, in his words' substance. */
export const VIOLET_SIDE_PRINCIPLE =
  "Her comfort is the standard: this side saves her work, never adds to it. Anything she needs connected to make the business work easier gets wired for her — the “Ask for something to be added” button is the intake.";

/** Her counterpart construct — the finance god; the name waits on his word. */
export const VIOLET_GOD = GOD_FINANCE;

export function violetGodDisplayName(): string {
  return godDisplayName(VIOLET_GOD);
}

/* ------------------------------------------------------------------ */
/* Her tools — the whole set, and nothing else                         */
/* ------------------------------------------------------------------ */

export interface VioletTool {
  id: string;
  label: string;
  blurb: string;
}

export const VIOLET_TOOLS: VioletTool[] = [
  {
    id: "notepad",
    label: "Notepad",
    blurb: "Her own notes, saved on the core — here when she comes back.",
  },
  {
    id: "calculator",
    label: "Calculator",
    blurb: "A banker's calculator: full expressions, parentheses, percents — exact to the cent.",
  },
  {
    id: "finance",
    label: "Finance records",
    blurb: "The company's invoices and payments, read from the core's record — the ledger and the balances.",
  },
  {
    id: "email",
    label: "Email",
    blurb: "Her own mailbox, through her god: he drafts at her word, she reads, her word sends.",
  },
];

/* ------------------------------------------------------------------ */
/* The calculator — a small exact expression engine                    */
/* ------------------------------------------------------------------ */

export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

type Token =
  | { kind: "num"; value: number }
  | { kind: "op"; value: "+" | "-" | "*" | "/" | "(" | ")" | "%" };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === " " || ch === "\t") {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      let dots = 0;
      while (j < input.length && /[0-9.]/.test(input[j]!)) {
        if (input[j] === ".") dots += 1;
        j += 1;
      }
      const raw = input.slice(i, j);
      if (dots > 1) return null;
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      tokens.push({ kind: "num", value });
      i = j;
      continue;
    }
    if (ch === "×") {
      tokens.push({ kind: "op", value: "*" });
      i += 1;
      continue;
    }
    if (ch === "÷") {
      tokens.push({ kind: "op", value: "/" });
      i += 1;
      continue;
    }
    if ("+-*/()%".includes(ch)) {
      tokens.push({ kind: "op", value: ch as "+" | "-" | "*" | "/" | "(" | ")" | "%" });
      i += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

/**
 * A parsed piece of an expression. `percent` carries the raw
 * percentage number when — and only when — the piece was a
 * single bare percent factor ("10%"), so an additive key can
 * apply the banker's rule below. Any other shape: null.
 */
interface Piece {
  value: number;
  percent: number | null;
}

/**
 * Evaluate a calculator expression: numbers, + − × ÷, paren-
 * theses, unary minus, and % the way a banker keys it:
 * standing alone, 50% is 0.5; after an additive key it is a
 * percent OF the running value — 200 + 10% is 220, and
 * 200 − 10% is 180. No eval, no code — a small parser, exact
 * about what it refuses.
 */
export function calculateExpression(input: string): CalcResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Nothing to calculate yet." };
  if (trimmed.length > 120) return { ok: false, error: "That expression is too long." };
  const tokens = tokenize(trimmed);
  if (!tokens || tokens.length === 0) {
    return { ok: false, error: "I could not read that — use numbers and + − × ÷ ( )." };
  }
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const next = (): Token | undefined => tokens[pos++];

  function parseExpr(): Piece {
    let acc = parseTerm();
    for (;;) {
      const t = peek();
      if (t?.kind === "op" && (t.value === "+" || t.value === "-")) {
        next();
        const rhs = parseTerm();
        // Banker's percent: "200 + 10%" adds ten percent OF the running value.
        const rhsValue = rhs.percent !== null ? (acc.value * rhs.percent) / 100 : rhs.value;
        acc = { value: t.value === "+" ? acc.value + rhsValue : acc.value - rhsValue, percent: null };
      } else return acc;
    }
  }
  function parseTerm(): Piece {
    let acc = parseFactor();
    for (;;) {
      const t = peek();
      if (t?.kind === "op" && (t.value === "*" || t.value === "/")) {
        next();
        const rhs = parseFactor();
        if (t.value === "/" && rhs.value === 0) throw new Error("You cannot divide by zero.");
        acc = {
          value: t.value === "*" ? acc.value * rhs.value : acc.value / rhs.value,
          percent: null,
        };
      } else return acc;
    }
  }
  function parseFactor(): Piece {
    const t = next();
    if (!t) throw new Error("That expression ends too soon.");
    if (t.kind === "op" && t.value === "-") {
      const inner = parseFactor();
      return {
        value: -inner.value,
        percent: inner.percent !== null ? -inner.percent : null,
      };
    }
    if (t.kind === "op" && t.value === "(") {
      const inner = parseExpr();
      const close = next();
      if (!(close?.kind === "op" && close.value === ")")) {
        throw new Error("A parenthesis was left open.");
      }
      return { value: inner.value, percent: null };
    }
    if (t.kind === "num") {
      const pct = peek();
      if (pct?.kind === "op" && pct.value === "%") {
        next();
        return { value: t.value / 100, percent: t.value };
      }
      return { value: t.value, percent: null };
    }
    throw new Error("I could not read that expression.");
  }

  try {
    const result = parseExpr();
    if (pos !== tokens.length) {
      return { ok: false, error: "I could not read the whole expression." };
    }
    if (!Number.isFinite(result.value)) return { ok: false, error: "That result is not a number." };
    return { ok: true, value: result.value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "That did not calculate." };
  }
}

/** Money, the banker's way: $1,234.56 — and −$ for a negative. */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${grouped}.${String(rest).padStart(2, "0")}`;
}

/** A plain decimal result for the calculator readout. */
export function formatCalcValue(value: number): string {
  const rounded = Math.round(value * 1e10) / 1e10;
  return String(rounded);
}

/* ------------------------------------------------------------------ */
/* The finance records — invoices and payments, read as a ledger       */
/* ------------------------------------------------------------------ */

export type FinanceRecordKind = "invoice" | "payment";

/**
 * Invoice statuses: open (issued, unpaid), paid.
 * Payment statuses: in-transit (sent, not landed), landed.
 * A payment counts against what is owed only when it has
 * LANDED — money in transit is shown, never spent twice in
 * the math. That is the banker's rule and the Captain's.
 */
export type FinanceRecordStatus = "open" | "paid" | "in-transit" | "landed";

export interface FinanceRecord {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  kind: FinanceRecordKind;
  label: string;
  amountCents: number;
  status: FinanceRecordStatus;
}

const FINANCE_STATUSES: FinanceRecordStatus[] = ["open", "paid", "in-transit", "landed"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function sanitizeFinanceRecord(v: unknown): FinanceRecord | null {
  if (!isRecord(v)) return null;
  const id = typeof v["id"] === "string" && v["id"].trim() ? v["id"].trim().slice(0, 96) : null;
  const label =
    typeof v["label"] === "string" && v["label"].trim() ? v["label"].trim().slice(0, 160) : null;
  const date =
    typeof v["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v["date"]) ? v["date"] : null;
  const amountCents =
    typeof v["amountCents"] === "number" && Number.isFinite(v["amountCents"])
      ? Math.round(v["amountCents"])
      : null;
  const kind = v["kind"];
  const status = v["status"];
  if (!id || !label || !date || amountCents === null) return null;
  if (kind !== "invoice" && kind !== "payment") return null;
  if (typeof status !== "string" || !(FINANCE_STATUSES as string[]).includes(status)) return null;
  return { id, date, kind, label, amountCents, status: status as FinanceRecordStatus };
}

export interface LedgerTotals {
  invoicedCents: number;
  landedCents: number;
  inTransitCents: number;
  /** Invoiced and not yet covered by landed money. */
  outstandingCents: number;
}

export function ledgerTotals(records: FinanceRecord[]): LedgerTotals {
  let invoiced = 0;
  let landed = 0;
  let inTransit = 0;
  for (const r of records) {
    if (r.kind === "invoice") invoiced += r.amountCents;
    else if (r.status === "landed") landed += r.amountCents;
    else if (r.status === "in-transit") inTransit += r.amountCents;
  }
  return {
    invoicedCents: invoiced,
    landedCents: landed,
    inTransitCents: inTransit,
    outstandingCents: invoiced - landed,
  };
}

export interface LedgerRow extends FinanceRecord {
  /** Outstanding balance after this row, oldest to newest. */
  runningOutstandingCents: number;
}

/** The ledger: chronological, each row carrying the running outstanding. */
export function ledgerRows(records: FinanceRecord[]): LedgerRow[] {
  const sorted = [...records].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let outstanding = 0;
  return sorted.map((r) => {
    if (r.kind === "invoice") outstanding += r.amountCents;
    else if (r.status === "landed") outstanding -= r.amountCents;
    return { ...r, runningOutstandingCents: outstanding };
  });
}

/* ------------------------------------------------------------------ */
/* Her mailbox — connected on her side, sends at her word              */
/* ------------------------------------------------------------------ */

export interface VioletMailbox {
  /** Her own mailbox address — hers, not the Captain's. */
  address: string;
  /** True only when a real mailbox connection stands on her side. */
  connected: boolean;
  /** Plain words about the connection state, shown to her as-is. */
  note: string;
}

export type VioletMailStatus = "draft" | "sent" | "waiting-mailbox";

export interface VioletMail {
  id: string;
  at: number;
  to: string;
  subject: string;
  body: string;
  status: VioletMailStatus;
  /** Set when a send truly happened — never before. */
  sentAt: number | null;
}

export function sanitizeVioletMail(v: unknown): VioletMail | null {
  if (!isRecord(v)) return null;
  const id = typeof v["id"] === "string" && v["id"].trim() ? v["id"].trim().slice(0, 96) : null;
  const to = typeof v["to"] === "string" ? v["to"].trim().slice(0, 160) : "";
  const subject = typeof v["subject"] === "string" ? v["subject"].trim().slice(0, 200) : "";
  const body = typeof v["body"] === "string" ? v["body"].slice(0, 8000) : "";
  const at = typeof v["at"] === "number" && Number.isFinite(v["at"]) && v["at"] > 0 ? v["at"] : null;
  const status = v["status"];
  if (!id || at === null) return null;
  if (status !== "draft" && status !== "sent" && status !== "waiting-mailbox") return null;
  return {
    id,
    at,
    to,
    subject,
    body,
    status,
    sentAt: typeof v["sentAt"] === "number" && Number.isFinite(v["sentAt"]) ? v["sentAt"] : null,
  };
}

/* ------------------------------------------------------------------ */
/* The welcome draft — prepared for his approval, never sent by us     */
/* ------------------------------------------------------------------ */

/**
 * The welcome message for Violet, DRAFT — stored on the core
 * for the Captain's review. Nothing sends it: he approves the
 * exact words in the main chat first, and only then does it
 * travel. The default password is filled in by the server door
 * from the credential store at review time — it is never part
 * of this template, never in code, never in a log.
 */
export function buildVioletWelcomeDraft(defaultPassword: string): string {
  const godName = VIOLET_GOD.name;
  const godLine = godName
    ? `Standing with you on your side is ${godName} — the god of finances.`
    : "Standing with you on your side is the god of finances — your counterpart there, who will speak his name when the Captain gives it.";
  return [
    `Hi Violet,`,
    ``,
    `This is your door into I-E-M — your own side of the system Domenick built, made for the work you do as Financial Advisor. Nobody else's tools are on your side, and nobody else sees it.`,
    ``,
    `Where: open the system and choose the Financial Advisor door (the page is /violet).`,
    `Your sign-in email: ${VIOLET_PROFILE.email}`,
    `Your starting password: ${defaultPassword}`,
    ``,
    `That password is a starting key only. The first time you sign in, your side will tell you plainly: you can change it any time you like, and the way to change it is one tap away. Please do change it to one of your own.`,
    ``,
    `What is on your side: your notepad, a banker's calculator, the company's finance records (the invoices and payments, kept straight), and email — you can send email through your god, too: he drafts at your word, you read it, and your word sends it. ${godLine}`,
    ``,
    `If you need anything else connected to make the business work easier, there is a button on your side: “Ask for something to be added.” Tap it, type what you need, and it comes straight to Domenick as a request. Your comfort is the standard — this side is supposed to save you work, never add to it.`,
    ``,
    `One thing to know about the door itself: like any login here, it keeps a record of sign-ins. That is the house rule for every door, his included.`,
    ``,
    `Welcome in.`,
  ].join("\n");
}
