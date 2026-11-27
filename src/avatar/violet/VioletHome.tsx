/**
 * VIOLET'S SIDE — her own door into the system (Captain's
 * orders 2026-11-26). Violet Hernandez, Agent 011, Financial
 * Advisor. Her sign-in is hers alone (a core-kept credential,
 * a session of her own), and what stands behind it is HER
 * side only: the god who stands with her, her notepad, her
 * calculator, the finance records, her email, and the button
 * that asks for more.
 *
 * The wall runs both ways, like Khadija's: her session is
 * never read by an operator surface, and this page renders
 * nothing from the operator side. Her comfort is the
 * standard — this side saves her work, never adds to it.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SectionRequestButton } from "../SectionRequestButton";
import { AgentContactButtons } from "../AgentContactButtons";
import { MatrixWall } from "../MatrixWall";
import {
  calculateExpression,
  formatCalcValue,
  formatMoney,
  ledgerRows,
  violetGodDisplayName,
  VIOLET_GOD,
  VIOLET_PROFILE,
  VIOLET_SIDE_PRINCIPLE,
  VIOLET_TOOLS,
} from "./violetSide";
import {
  getVioletView,
  violetChangePasswordFn,
  violetSaveNotepad,
  violetSendMail,
  violetSignInFn,
  violetSignOutFn,
  violetSubmitRequest,
  type VioletView,
} from "./violet.server";

const SESSION_KEY = "augi.violet.session.v1";

function loadToken(): string {
  try {
    return globalThis.sessionStorage?.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveToken(token: string): void {
  try {
    if (token) globalThis.sessionStorage?.setItem(SESSION_KEY, token);
    else globalThis.sessionStorage?.removeItem(SESSION_KEY);
  } catch {
    // session storage unavailable — the page still works for this visit
  }
}

type PanelId = "notepad" | "calculator" | "finance" | "email";

export function VioletHome() {
  const [token, setToken] = useState<string>(() => loadToken());
  const [view, setView] = useState<VioletView | null>(null);
  const [panel, setPanel] = useState<PanelId>("finance");

  const refresh = useCallback(async (current: string) => {
    if (!current) {
      setView(null);
      return;
    }
    try {
      const next = await getVioletView({ data: { token: current } });
      if (!next.signedIn) {
        saveToken("");
        setToken("");
        setView(null);
        return;
      }
      setView(next);
    } catch {
      setView(null);
    }
  }, []);

  useEffect(() => {
    void refresh(token);
  }, [refresh, token]);

  if (!token) {
    return (
      <VioletSignIn
        onSignedIn={(fresh) => {
          saveToken(fresh);
          setToken(fresh);
        }}
      />
    );
  }

  if (!view) {
    return (
      <main className="violet-shell">
        <section className="violet-card" aria-live="polite">
          <p>Opening your side…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="violet-shell">
      {/* ONE INTERFACE FOR ALL (owner order 2026-11-27): the
          same Matrix Wall stands behind her side as behind
          his — the same gold binary, tuned to her seat
          (finance: measured tempo, sparser rain). */}
      <MatrixWall role="finance" variant="page" />
      <header className="violet-header">
        <div>
          <h1>{VIOLET_PROFILE.fullName}</h1>
          <p>
            {VIOLET_PROFILE.designation} · {VIOLET_PROFILE.role}
          </p>
        </div>
        <button
          type="button"
          className="violet-leave"
          onClick={() => {
            void violetSignOutFn({ data: { token } }).catch(() => undefined);
            saveToken("");
            setToken("");
          }}
        >
          Sign out
        </button>
      </header>

      <section className="violet-god" aria-label="The god who stands with you">
        <h2>{violetGodDisplayName()}</h2>
        <p>{VIOLET_GOD.domain}</p>
        {VIOLET_GOD.name === null && (
          <p className="violet-note">
            His name waits on the Captain's word — when it is spoken, this card will carry it.
          </p>
        )}
      </section>

      {view.usingDefaultPassword && (
        <section className="violet-banner" role="note">
          <p>
            You are signed in with your <strong>starting password</strong>. You can change it any
            time you like — <a href="#violet-password">change it now</a>, it takes one tap to get
            there and a moment to do.
          </p>
        </section>
      )}

      <nav className="violet-tools" aria-label="Your tools">
        {VIOLET_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className="violet-tool"
            aria-expanded={panel === tool.id}
            onClick={() => setPanel(tool.id as PanelId)}
          >
            <span>{tool.label}</span>
            <small>{tool.blurb}</small>
          </button>
        ))}
      </nav>

      <section className="violet-panel" aria-live="polite">
        {panel === "notepad" && <NotepadPanel token={token} initial={view.notepad} />}
        {panel === "calculator" && <CalculatorPanel />}
        {panel === "finance" && <FinancePanel view={view} />}
        {panel === "email" && (
          <EmailPanel token={token} view={view} onChanged={() => void refresh(token)} />
        )}
      </section>

      <SectionRequestButton
        heading="Need something else on your side?"
        prompt="Anything that would make the business work easier — a tool, a connection, a record kept for you — ask here. It goes straight to the Captain as a request."
        placeholder="Type what you need built into your section…"
        sendLabel="Send it to the Captain"
        onSubmit={async (text) => {
          const result = await violetSubmitRequest({ data: { token, text } });
          return { ok: result.ok, message: result.note };
        }}
      />

      {/* THE THREE BUTTONS (phone fix pass 2026-11-27, items
          11–12): problem, message, emergency — the same doors
          every agent carries, run through her own session door.
          Her emergency is honest about its reach: it files an
          EMERGENCY request into his notifications the moment it
          is sent; her side holds no call door, and the button
          says so before she presses it. */}
      <AgentContactButtons
        captainLabel="the Captain"
        emergencyNote="This files an EMERGENCY request straight into the Captain's notifications — he sees it the moment it lands. It does not place a call; your side has no call door."
        onReportError={async (text) => {
          const result = await violetSubmitRequest({
            data: { token, text: `PROBLEM REPORT — ${text}` },
          });
          return {
            ok: result.ok,
            message: result.ok
              ? "The Captain has it — the problem stands in his notifications now, and he fixes it."
              : result.note,
          };
        }}
        onMessage={async (text) => {
          const result = await violetSubmitRequest({
            data: { token, text: `MESSAGE — ${text}` },
          });
          return { ok: result.ok, message: result.note };
        }}
        onEmergency={async () => {
          const result = await violetSubmitRequest({
            data: {
              token,
              text: "EMERGENCY — Violet pressed her emergency button. She needs the Captain now.",
            },
          });
          return {
            ok: result.ok,
            message: result.ok
              ? "Sent. Your emergency stands in the Captain's notifications right now."
              : result.note,
          };
        }}
      />

      <PasswordPanel token={token} onChanged={() => void refresh(token)} />

      <footer className="violet-footer">
        <p>{VIOLET_SIDE_PRINCIPLE}</p>
        {view.loginLog.length > 0 && (
          <p className="violet-note">
            Your door's record — last sign-in attempt:{" "}
            {new Date(view.loginLog[0]!.at).toLocaleString()} (
            {view.loginLog[0]!.ok ? "let in" : "not let in"}). Every door in this house keeps the
            same record, the Captain's included.
          </p>
        )}
      </footer>
    </main>
  );
}

/* ------------------------------ sign-in ------------------------------ */

function VioletSignIn({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const result = await violetSignInFn({ data: { email: email.trim(), password } });
      setPassword("");
      if (!result.ok) {
        setNote(result.note);
        return;
      }
      onSignedIn(result.token);
    } catch {
      setNote("Sign-in is unavailable from here. Your side lives on the core machine.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="violet-shell">
      <section className="violet-card" aria-labelledby="violet-signin-title">
        <h1 id="violet-signin-title">Financial Advisor sign-in</h1>
        <p>
          This is Violet's door — her own side of the system: her notepad, her calculator, the
          finance records, and her email. Nobody else's tools are here, and nobody else sees it.
        </p>
        <form className="violet-form" onSubmit={(event) => void submit(event)}>
          <label>
            Email
            <input
              autoComplete="username"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {note && (
            <p className="violet-error" role="alert">
              {note}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="violet-note">
          Like every door in this house, this one keeps a record of sign-ins — the Captain's
          included.
        </p>
      </section>
    </main>
  );
}

/* ------------------------------ notepad ------------------------------ */

function NotepadPanel({ token, initial }: { token: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await violetSaveNotepad({ data: { token, text } });
      setNote(result.note);
    } catch {
      setNote("That could not be saved from here. Your words are still on the page.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Notepad</h2>
      <p className="violet-note">Yours alone — saved on the core, here when you come back.</p>
      <textarea
        className="violet-notepad"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={10}
        maxLength={20_000}
        aria-label="Your notepad"
      />
      <div className="violet-row">
        <button type="button" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save my notes"}
        </button>
        {note && (
          <span role="status" className="violet-note">
            {note}
          </span>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- calculator ----------------------------- */

const CALC_KEYS = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "%", "+"];

function CalculatorPanel() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");

  function evaluate() {
    const outcome = calculateExpression(expr);
    if (!outcome.ok) {
      setResult(outcome.error);
      return;
    }
    setResult(
      `${formatCalcValue(outcome.value)}  ·  as money: ${formatMoney(Math.round(outcome.value * 100))}`,
    );
  }

  return (
    <div>
      <h2>Calculator</h2>
      <p className="violet-note">
        Full expressions, parentheses, percents the banker's way — 200 + 10% is 220. Exact to the
        cent on the money line.
      </p>
      <div className="violet-calc">
        <input
          className="violet-calc__display"
          value={expr}
          onChange={(event) => setExpr(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") evaluate();
          }}
          placeholder="Type or tap — e.g. 635 × 7 + 40"
          aria-label="Calculator expression"
          inputMode="decimal"
        />
        <div className="violet-calc__keys">
          {CALC_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setExpr((current) => `${current}${key === "−" ? "-" : key}`)}
            >
              {key}
            </button>
          ))}
          <button type="button" onClick={() => setExpr((current) => current.slice(0, -1))}>
            ⌫
          </button>
          <button type="button" onClick={() => setExpr("")}>
            C
          </button>
          <button type="button" className="violet-calc__equals" onClick={evaluate}>
            =
          </button>
        </div>
        {result && (
          <p className="violet-calc__result" role="status">
            {result}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ finance ------------------------------ */

function FinancePanel({ view }: { view: VioletView }) {
  const totals = view.financeTotals;
  const rows = ledgerRows(view.financeRecords);
  return (
    <div>
      <h2>Finance records</h2>
      <p className="violet-note">
        The company's invoices and payments, read from the core's record. Money counts as received
        only when it has landed — what is in transit is shown, never counted twice.
      </p>
      {view.financeRecords.length === 0 ? (
        <p>
          No finance records stand on the core yet. When the Captain places the company's invoices
          and payments on the record, they will stand here — the ledger, the balances, all of it.
        </p>
      ) : (
        <>
          {totals && (
            <div className="violet-balances">
              <div>
                <span>Invoiced</span>
                <strong>{formatMoney(totals.invoicedCents)}</strong>
              </div>
              <div>
                <span>Received &amp; landed</span>
                <strong>{formatMoney(totals.landedCents)}</strong>
              </div>
              <div>
                <span>In transit</span>
                <strong>{formatMoney(totals.inTransitCents)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>{formatMoney(totals.outstandingCents)}</strong>
              </div>
            </div>
          )}
          <table className="violet-ledger">
            <thead>
              <tr>
                <th>Date</th>
                <th>Record</th>
                <th>Status</th>
                <th className="violet-ledger__num">Amount</th>
                <th className="violet-ledger__num">Outstanding after</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.label}</td>
                  <td>{row.status}</td>
                  <td className="violet-ledger__num">
                    {row.kind === "payment" ? "−" : ""}
                    {formatMoney(row.amountCents)}
                  </td>
                  <td className="violet-ledger__num">{formatMoney(row.runningOutstandingCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/* ------------------------------- email ------------------------------- */

function EmailPanel({
  token,
  view,
  onChanged,
}: {
  token: string;
  view: VioletView;
  onChanged: () => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const mailbox = view.mailbox;

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const result = await violetSendMail({ data: { token, to, subject, body } });
      setNote(result.note);
      if (result.ok) {
        setTo("");
        setSubject("");
        setBody("");
        onChanged();
      }
    } catch {
      setNote("That could not be carried from here. Your words are still on the page.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Email — through {violetGodDisplayName()}</h2>
      <p className="violet-note">
        Your own mailbox, on your side. Write it yourself, or ask your god to draft it at your
        word — either way, nothing sends until you press Send. Your word is the approval, the
        same as the Captain's on his side.
      </p>
      {mailbox && (
        <p className={mailbox.connected ? "violet-device" : "violet-error"} role="status">
          {mailbox.connected
            ? `Your mailbox (${mailbox.address}) is connected on your side.`
            : mailbox.note}
        </p>
      )}
      <form className="violet-form" onSubmit={(event) => void send(event)}>
        <label>
          To
          <input
            type="email"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            required
          />
        </label>
        <label>
          Subject
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={200}
            required
          />
        </label>
        <label>
          Message
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            maxLength={8000}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Working…" : "Send at my word"}
        </button>
      </form>
      {note && (
        <p className="violet-note" role="status">
          {note}
        </p>
      )}
      {view.outbox.length > 0 && (
        <>
          <h3>Your outbox</h3>
          <ol className="violet-outbox">
            {view.outbox.map((mail) => (
              <li key={mail.id}>
                <strong>{mail.subject}</strong> → {mail.to} ·{" "}
                {mail.status === "sent"
                  ? `sent ${mail.sentAt ? new Date(mail.sentAt).toLocaleString() : ""}`
                  : mail.status === "waiting-mailbox"
                    ? "ready draft — waiting for your mailbox connection"
                    : "draft"}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

/* ----------------------------- password ----------------------------- */

function PasswordPanel({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await violetChangePasswordFn({ data: { token, current, next } });
      setNote(result.note);
      if (result.ok) {
        setCurrent("");
        setNext("");
        onChanged();
      }
    } catch {
      setNote("That could not be done from here. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="violet-card violet-password" id="violet-password" aria-label="Change your password">
      <h2>Change your password</h2>
      <p className="violet-note">
        Any time you like. Your new password needs at least 10 characters — make it one of your
        own, and the starting password stops working the moment you change it.
      </p>
      <form className="violet-form" onSubmit={(event) => void submit(event)}>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            minLength={10}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Changing…" : "Change my password"}
        </button>
      </form>
      {note && (
        <p className="violet-note" role="status">
          {note}
        </p>
      )}
    </section>
  );
}
