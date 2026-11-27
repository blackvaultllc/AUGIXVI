/**
 * BINARY WINDOW — his page for the code (owner order 2026-11-27).
 *
 * The teaching, in his own method:
 *   1. A bit is one switch — 0 is off, 1 is on.
 *   2. A byte is eight bits. The places read right to left:
 *      1, 2, 4, 8, 16, 32, 64, 128. Add the places where a 1
 *      sits and you have the number; the number names the letter.
 *   3. A working translator — binary in, letters out; letters in,
 *      binary out — so he can translate by himself, both ways.
 *   4. The full character chart: space, the numbers, A–Z, a–z.
 *      Every byte he meets, he can look up here.
 *
 * His binary stands in the background of the page itself — the
 * rain, dim behind the lesson, the way it stands behind his work.
 * All logic lives in binaryCode.ts (pure, unit-tested); this
 * window only renders it. Operator surface only.
 */
import { useMemo, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import {
  BINARY_CHART,
  BIT_PLACES,
  COUNTING_CHART,
  byteBreakdown,
  byteSumWords,
  byteToChar,
  decodeBinary,
  encodeText,
} from "./binaryCode";

/** Deterministic rain for the backdrop — the same wall every open. */
function rainText(rows: number, cols: number): string {
  let seed = 987654321;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % 2 === 0 ? "0" : "1";
  };
  const lines: string[] = [];
  for (let r = 0; r < rows; r += 1) {
    let line = "";
    for (let c = 0; c < cols; c += 1) line += next();
    lines.push(line);
  }
  return lines.join("\n");
}

export function BinaryWindow({ onClose }: { onClose: () => void }) {
  const [bits, setBits] = useState("01001000");
  const [binaryIn, setBinaryIn] = useState("");
  const [textIn, setTextIn] = useState("");

  const breakdown = byteBreakdown(bits);
  const sumWords = byteSumWords(bits);
  const builtChar = byteToChar(bits);

  const decoded = useMemo(() => decodeBinary(binaryIn), [binaryIn]);
  const encoded = useMemo(() => encodeText(textIn), [textIn]);
  const rain = useMemo(() => rainText(28, 64), []);

  function flip(index: number) {
    setBits((current) => {
      const chars = current.split("");
      chars[index] = chars[index] === "1" ? "0" : "1";
      return chars.join("");
    });
  }

  return (
    <FloatingWindow
      id="binary"
      title="Binary — Read the Code"
      onClose={onClose}
      initialWidth={580}
      initialHeight={660}
    >
      <div className="binary-window">
        <pre className="binary-window__rain" aria-hidden="true">
          {rain}
        </pre>
        <div className="binary-window__body">
          <section aria-labelledby="binary-states">
            <h3 id="binary-states">The two states</h3>
            <p>
              A <strong>bit</strong> is one switch. <strong>0 is off. 1 is on.</strong> Everything
              the system says — every letter, every order — is built from those two, nothing else.
            </p>
            <p>
              Eight bits in a row make a <strong>byte</strong>. Each place in the byte is worth a
              number. Read the places <strong>right to left: 1, 2, 4, 8, 16, 32, 64, 128</strong>.
              Where a 1 sits, that place counts. Add the counted places — that is the byte&apos;s
              number, and the number names a character.
            </p>
          </section>

          <section aria-labelledby="binary-build">
            <h3 id="binary-build">Build a byte — tap the bits</h3>
            <div className="binary-window__byte" role="group" aria-label="Byte builder">
              {BIT_PLACES.map((place, i) => (
                <button
                  key={place}
                  type="button"
                  className="binary-window__bit"
                  aria-pressed={bits[i] === "1"}
                  aria-label={`Place ${place}, bit ${bits[i]}`}
                  onClick={() => flip(i)}
                >
                  <span className="binary-window__place">{place}</span>
                  <span className="binary-window__digit">{bits[i]}</span>
                </button>
              ))}
            </div>
            <p className="binary-window__sum" role="status">
              {sumWords}
              {builtChar
                ? builtChar === " "
                  ? " — that byte is the space."
                  : ` — that byte is the letter ${builtChar}.`
                : " — that number names no letter on the chart below."}
            </p>
            {breakdown && (
              <p className="binary-window__bits-line" aria-hidden="true">
                {bits}
              </p>
            )}
          </section>

          <section aria-labelledby="binary-translator">
            <h3 id="binary-translator">The translator — read it yourself</h3>
            <label className="binary-window__label">
              Binary in — letters out
              <textarea
                className="binary-window__input"
                value={binaryIn}
                onChange={(event) => setBinaryIn(event.target.value)}
                placeholder="01001000 01101001"
                rows={3}
                spellCheck={false}
              />
            </label>
            <p className="binary-window__output" role="status" aria-label="Translated letters">
              {binaryIn.trim()
                ? decoded.text || "Nothing readable yet — check the groups of eight."
                : "Type or paste binary above and the letters appear here."}
            </p>
            {decoded.badGroups.length > 0 && (
              <p className="binary-window__warn">Not read: {decoded.badGroups.join(" · ")}</p>
            )}
            <label className="binary-window__label">
              Letters in — binary out
              <textarea
                className="binary-window__input"
                value={textIn}
                onChange={(event) => setTextIn(event.target.value)}
                placeholder="Hi"
                rows={2}
                spellCheck={false}
              />
            </label>
            <p
              className="binary-window__output binary-window__output--mono"
              aria-label="Translated binary"
            >
              {textIn
                ? encoded.binary || "Nothing to translate yet."
                : "Type letters above and their bytes appear here."}
            </p>
            {encoded.unsupported.length > 0 && (
              <p className="binary-window__warn">
                No byte on this chart for: {encoded.unsupported.join(" ")}
              </p>
            )}
          </section>

          <section aria-labelledby="binary-counting">
            <h3 id="binary-counting">Counting — the numbers themselves, 0 to 20</h3>
            <p>
              Count the slow way. Write the places — for this range, <strong>16, 8, 4, 2, 1</strong>
              . Take the biggest place that fits, subtract it, and keep going with what&apos;s left
              until nothing remains. The places you took are where the 1s sit.
            </p>
            <p>
              Worked out loud: <strong>5 = 4 + 1 = 101</strong> ·{" "}
              <strong>7 = 4 + 2 + 1 = 111</strong> · <strong>9 = 8 + 1 = 1001</strong> ·{" "}
              <strong>17 = 16 + 1 = 10001</strong>.
            </p>
            <div className="binary-window__counting">
              {COUNTING_CHART.map((entry) => (
                <div key={entry.value} className="binary-window__count-row">
                  <span className="binary-window__count-value">{entry.value}</span>
                  <span className="binary-window__count-bits">{entry.placed}</span>
                  <span className="binary-window__count-sum">{entry.sum}</span>
                  <span className="binary-window__count-plain">{entry.bits}</span>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="binary-chart">
            <h3 id="binary-chart">The character chart — every byte, its letter</h3>
            <p>
              <strong>Keep the two apart:</strong> the number 5 by itself is <strong>101</strong>.
              The character <strong>&apos;5&apos;</strong> — the one you type on a screen — is the
              byte <strong>00110101</strong>. The counting chart above is the numbers; this chart is
              the typed characters.
            </p>
            <p>Tap any character to load its byte into the builder above.</p>
            {BINARY_CHART.map((group) => (
              <div key={group.group} className="binary-window__chart-group">
                <h4>{group.group}</h4>
                <p className="binary-window__chart-note">{group.note}</p>
                <div className="binary-window__chart">
                  {group.entries.map((entry) => (
                    <button
                      key={entry.code}
                      type="button"
                      className="binary-window__cell"
                      onClick={() => setBits(entry.bits)}
                      aria-label={`${entry.label}, number ${entry.code}, binary ${entry.bits}`}
                    >
                      <span className="binary-window__cell-char">
                        {entry.char === " " ? "␣" : entry.char}
                      </span>
                      <span className="binary-window__cell-bits">{entry.bits}</span>
                      <span className="binary-window__cell-code">{entry.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </FloatingWindow>
  );
}
