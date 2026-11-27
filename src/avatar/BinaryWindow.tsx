/**
 * BINARY WINDOW — the full learning program (owner orders
 * 2026-11-27: the chart + translator first, then "a very
 * extensive learning program in my system so I can make sure I
 * know everything about binary — every single aspect").
 *
 * Fifteen modules, in his order: foundations · places & counting ·
 * converting · bytes & sizes · characters · the translator ·
 * arithmetic · negatives · logic & gates · bitwise work · hex &
 * octal · real-world binary · floating point · error detection ·
 * practice & mastery.
 *
 * Plain layman steps. A slow pace toggle walks the worked
 * examples one step at a time. Every module carries drills that
 * check the answer and show the working; his progress is saved
 * in his area (binaryCourse.ts) so it is waiting every login.
 * His binary stands dim in the background of the page itself.
 * All math lives in binaryCode.ts + binaryCourse.ts (pure,
 * unit-tested) — this window only teaches from them.
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
  countingSteps,
  decodeBinary,
  encodeText,
  numberToBinary,
} from "./binaryCode";
import {
  BASE_CHART,
  BINARY_MODULES,
  GATES,
  SIZE_UNITS,
  addBytes,
  bitwise,
  byteToHex,
  byteToOctal,
  checksum,
  divisionSteps,
  flipBits,
  fromTwosComplement,
  loadBinaryProgress,
  makeDrill,
  multiplyBytes,
  negateByte,
  normalizeAnswer,
  parityBit,
  readByte,
  saveBinaryProgress,
  seededRandom,
  setBit,
  shiftLeft,
  shiftRight,
  subtractBytes,
  toTwosComplement,
  type BinaryProgress,
  type Drill,
} from "./binaryCourse";

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

/** Worked steps: all at once normally, one at a time at slow pace. */
function SlowSteps({ steps, slow }: { steps: string[]; slow: boolean }) {
  const [shown, setShown] = useState(1);
  const visible = slow ? steps.slice(0, shown) : steps;
  return (
    <div>
      <ol className="binary-window__steps">
        {visible.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {slow && shown < steps.length && (
        <button type="button" className="window-btn" onClick={() => setShown((n) => n + 1)}>
          Next step ({shown} of {steps.length})
        </button>
      )}
      {slow && shown >= steps.length && steps.length > 1 && (
        <button type="button" className="window-btn" onClick={() => setShown(1)}>
          Walk it again
        </button>
      )}
    </div>
  );
}

/** One module's drill: answer, check, see the working, move on. */
function DrillBox({
  moduleId,
  onResult,
}: {
  moduleId: string;
  onResult: (moduleId: string, correct: boolean) => void;
}) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000) + 1);
  const [drill, setDrill] = useState<Drill>(() => makeDrill(moduleId, seededRandom(seed)));
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<null | boolean>(null);

  function next() {
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    setDrill(makeDrill(moduleId, seededRandom(nextSeed * 31 + moduleId.length)));
    setAnswer("");
    setVerdict(null);
  }

  function check() {
    const correct = normalizeAnswer(answer) === drill.answer;
    setVerdict(correct);
    onResult(moduleId, correct);
  }

  return (
    <div className="binary-window__drill">
      <h4>Practice</h4>
      <p className="binary-window__drill-prompt">{drill.prompt}</p>
      {drill.choices ? (
        <div className="binary-window__choices">
          {drill.choices.map((choice) => (
            <button
              key={choice}
              type="button"
              className="window-btn"
              aria-pressed={answer === choice.slice(0, 1)}
              onClick={() => setAnswer(choice.slice(0, 1))}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <input
          className="binary-window__input"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          aria-label="Your answer"
          spellCheck={false}
        />
      )}
      <div className="binary-window__drill-actions">
        <button type="button" className="window-btn" onClick={check} disabled={verdict !== null}>
          Check my answer
        </button>
        <button type="button" className="window-btn" onClick={next}>
          New question
        </button>
      </div>
      {verdict !== null && (
        <p className="binary-window__verdict" role="status">
          {verdict ? "Right. " : "Not yet — here is the working: "}
          {drill.working}
        </p>
      )}
    </div>
  );
}

/** The tap-the-bits byte builder (module 2, and the chart loads it). */
function ByteBuilder({ bits, setBits }: { bits: string; setBits: (bits: string) => void }) {
  const breakdown = byteBreakdown(bits);
  const sumWords = byteSumWords(bits);
  const builtChar = byteToChar(bits);
  function flip(index: number) {
    const chars = bits.split("");
    chars[index] = chars[index] === "1" ? "0" : "1";
    setBits(chars.join(""));
  }
  return (
    <div>
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
          : " — that number names no letter on the chart."}
      </p>
      {breakdown && (
        <p className="binary-window__bits-line" aria-hidden="true">
          {bits}
        </p>
      )}
    </div>
  );
}

export function BinaryWindow({ onClose }: { onClose: () => void }) {
  const [moduleId, setModuleId] = useState("foundations");
  const [slow, setSlow] = useState(false);
  const [progress, setProgress] = useState<BinaryProgress>(() => loadBinaryProgress());
  const [bits, setBits] = useState("01001000");
  const [binaryIn, setBinaryIn] = useState("");
  const [textIn, setTextIn] = useState("");
  const [addA, setAddA] = useState("00101100");
  const [addB, setAddB] = useState("00011110");
  const [negIn, setNegIn] = useState(-5);
  const [bwA, setBwA] = useState("01001100");
  const [bwB, setBwB] = useState("00001111");
  const [bwOp, setBwOp] = useState<"AND" | "OR" | "XOR">("AND");
  const [rgb, setRgb] = useState({ r: 212, g: 175, b: 55 });
  const [masteryRun, setMasteryRun] = useState<null | { index: number; score: number }>(null);
  const [masteryDrill, setMasteryDrill] = useState<Drill | null>(null);
  const [masteryAnswer, setMasteryAnswer] = useState("");
  const [masteryVerdict, setMasteryVerdict] = useState<null | boolean>(null);

  const rain = useMemo(() => rainText(28, 64), []);
  const decoded = useMemo(() => decodeBinary(binaryIn), [binaryIn]);
  const encoded = useMemo(() => encodeText(textIn), [textIn]);
  const decodedReadings = useMemo(() => {
    const digits = binaryIn.replace(/[^01]/g, "");
    const readings = [];
    for (let i = 0; i + 8 <= digits.length; i += 8) readings.push(readByte(digits.slice(i, i + 8)));
    return readings;
  }, [binaryIn]);
  const added = useMemo(() => addBytes(addA, addB), [addA, addB]);
  const negBits = toTwosComplement(negIn);
  const bwResult = bitwise(bwA, bwB, bwOp);

  function record(moduleIdDone: string, correct: boolean, nextProgress?: BinaryProgress) {
    setProgress((current) => {
      const updated: BinaryProgress = nextProgress ?? {
        ...current,
        attempts: current.attempts + 1,
        correct: current.correct + (correct ? 1 : 0),
        done:
          correct && moduleIdDone !== "mastery" && !current.done.includes(moduleIdDone)
            ? [...current.done, moduleIdDone]
            : current.done,
      };
      saveBinaryProgress(updated);
      return updated;
    });
  }

  function markLearned(id: string) {
    setProgress((current) => {
      const updated = current.done.includes(id)
        ? current
        : { ...current, done: [...current.done, id] };
      saveBinaryProgress(updated);
      return updated;
    });
  }

  function startMastery() {
    setMasteryRun({ index: 0, score: 0 });
    setMasteryDrill(makeDrill("mastery", seededRandom(Date.now() % 100000)));
    setMasteryAnswer("");
    setMasteryVerdict(null);
  }

  function checkMastery() {
    if (!masteryDrill || !masteryRun) return;
    const correct = normalizeAnswer(masteryAnswer) === masteryDrill.answer;
    setMasteryVerdict(correct);
    record("mastery", correct);
    setMasteryRun({ ...masteryRun, score: masteryRun.score + (correct ? 1 : 0) });
  }

  function nextMastery() {
    if (!masteryRun) return;
    const nextIndex = masteryRun.index + 1;
    if (nextIndex >= 10) {
      const best = Math.max(progress.masteryBest, masteryRun.score);
      const updated = { ...progress, masteryBest: best };
      setProgress(updated);
      saveBinaryProgress(updated);
      setMasteryRun(null);
      setMasteryDrill(null);
    } else {
      setMasteryRun({ ...masteryRun, index: nextIndex });
      setMasteryDrill(makeDrill("mastery", seededRandom((Date.now() % 100000) + nextIndex * 7)));
    }
    setMasteryAnswer("");
    setMasteryVerdict(null);
  }

  const learnedCount = BINARY_MODULES.filter(
    (m) => m.id !== "mastery" && progress.done.includes(m.id),
  ).length;

  return (
    <FloatingWindow
      id="binary"
      title="Binary — The Full Program"
      onClose={onClose}
      initialWidth={640}
      initialHeight={700}
    >
      <div className="binary-window">
        <pre className="binary-window__rain" aria-hidden="true">
          {rain}
        </pre>
        <div className="binary-window__body">
          <p className="binary-window__progress" role="status">
            Modules learned: {learnedCount} of 14 · Drills: {progress.correct} right of{" "}
            {progress.attempts}
            {progress.masteryBest > 0 ? ` · Best mastery pass: ${progress.masteryBest} of 10` : ""}
          </p>
          <label className="binary-window__slow">
            <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} />{" "}
            Slow pace — walk the worked examples one step at a time
          </label>
          <nav className="binary-window__rail" aria-label="Binary modules">
            {BINARY_MODULES.map((mod, i) => (
              <button
                key={mod.id}
                type="button"
                className="binary-window__rail-btn"
                aria-pressed={moduleId === mod.id}
                onClick={() => setModuleId(mod.id)}
              >
                {i + 1}. {mod.title}
                {progress.done.includes(mod.id) ? " ✓" : ""}
              </button>
            ))}
          </nav>

          {moduleId === "foundations" && (
            <section aria-labelledby="binary-foundations">
              <h3 id="binary-foundations">1 · Foundations</h3>
              <p>
                A <strong>bit</strong> is one switch — the smallest piece of information there is.{" "}
                <strong>0 is off. 1 is on.</strong> That is the whole alphabet: two letters, and
                everything else is built from them.
              </p>
              <p>
                <strong>Why two states?</strong> A switch is never confused. A wire either carries
                the signal or it does not; a spot on a disk is either magnetized one way or the
                other. With only two states there is no "maybe" — the machine can always tell which
                one it is looking at, even with noise and wear. Ten states would be faster to write
                and forever being misread. Two is slow and certain, so everything is built on two.
              </p>
              <p>
                Stack bits and the counting explodes: 1 bit makes 2 values, 2 bits make 4, 3 bits
                make 8 — every added bit doubles what you can say. Module 2 puts numbers on that.
              </p>
              <DrillBox moduleId="foundations" onResult={record} />
            </section>
          )}

          {moduleId === "places" && (
            <section aria-labelledby="binary-places">
              <h3 id="binary-places">2 · Place Values & Counting</h3>
              <p>
                Eight bits in a row make a <strong>byte</strong>. Each place in the byte is worth a
                number. Read the places <strong>right to left: 1, 2, 4, 8, 16, 32, 64, 128</strong>.
                Where a 1 sits, that place counts. Add the counted places — that is the byte's
                number. A byte counts from <strong>0 to 255</strong> — 256 values in all.
              </p>
              <h4>Build a byte — tap the bits</h4>
              <ByteBuilder bits={bits} setBits={setBits} />
              <h4>Counting — the numbers themselves, 0 to 20</h4>
              <p>
                Count the slow way: write the places (16, 8, 4, 2, 1 for this range), take the
                biggest place that fits, subtract, keep going. Worked out loud:{" "}
                <strong>5 = 4 + 1 = 101</strong> · <strong>7 = 4 + 2 + 1 = 111</strong> ·{" "}
                <strong>9 = 8 + 1 = 1001</strong> · <strong>17 = 16 + 1 = 10001</strong>.
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
              <h4>The whole byte range — 0 to 255</h4>
              <div className="binary-window__range">
                {Array.from({ length: 256 }, (_, n) => (
                  <span key={n} className="binary-window__range-cell">
                    {n} · {numberToBinary(n).padStart(8, "0")}
                  </span>
                ))}
              </div>
              <DrillBox moduleId="places" onResult={record} />
            </section>
          )}

          {moduleId === "converting" && (
            <section aria-labelledby="binary-converting">
              <h3 id="binary-converting">3 · Converting: Decimal → Binary</h3>
              <p>
                Two roads, same answer. Take <strong>43</strong>.
              </p>
              <h4>Road one — biggest place, subtract, keep going</h4>
              <SlowSteps
                slow={slow}
                steps={countingSteps(43).map(
                  (s) =>
                    `Take ${s.place} — ${s.place + s.remaining} − ${s.place} = ${s.remaining} left.`,
                )}
              />
              <p>
                The places taken are 32, 8, 2, 1 — so under the places 128 64 32 16 8 4 2 1 the 1s
                sit at 32, 8, 2, 1: <strong>43 = 00101011</strong>.
              </p>
              <h4>Road two — divide by 2, keep the remainders</h4>
              <SlowSteps
                slow={slow}
                steps={divisionSteps(43).map(
                  (s) => `${s.dividend} ÷ 2 = ${s.quotient}, remainder ${s.remainder}.`,
                )}
              />
              <p>
                Read the remainders from the bottom up: 1 0 1 0 1 1 — <strong>43 = 101011</strong>,
                the same answer (the byte writes it 00101011).
              </p>
              <DrillBox moduleId="converting" onResult={record} />
            </section>
          )}

          {moduleId === "sizes" && (
            <section aria-labelledby="binary-sizes">
              <h3 id="binary-sizes">4 · Bytes & Sizes</h3>
              <p>
                <strong>8 bits = 1 byte.</strong> A byte holds one character, or any number from 0
                to 255. Half a byte — 4 bits — is a <strong>nibble</strong>: 0 to 15, exactly one
                hex digit (module 11).
              </p>
              <p>Sizes climb by 1024 — that is 2^10, the binary thousand:</p>
              <ul className="binary-window__sizes">
                {SIZE_UNITS.map((unit) => (
                  <li key={unit.short}>
                    <strong>
                      1 {unit.name} ({unit.short})
                    </strong>{" "}
                    = {unit.bytes.toLocaleString()} bytes — {unit.plain}.
                  </li>
                ))}
              </ul>
              <p>
                One honest wrinkle: drive makers often count by 1000 instead of 1024 (1 "TB" on a
                box is 1000^4 bytes), which is why a new drive always looks a little smaller in the
                system than on its box. Both counts are real; know which one you are reading.
              </p>
              <DrillBox moduleId="sizes" onResult={record} />
            </section>
          )}

          {moduleId === "characters" && (
            <section aria-labelledby="binary-characters">
              <h3 id="binary-characters">5 · Characters (ASCII)</h3>
              <p>
                <strong>Keep the two apart:</strong> the number 5 by itself is <strong>101</strong>.
                The character <strong>'5'</strong> — the one you type — is the byte{" "}
                <strong>00110101</strong>. ASCII is the chart that gives every typed character a
                number, and the number's binary is its byte.
              </p>
              <p>
                Reading a word is splitting it in 8s: <strong>ZERO</strong> is{" "}
                <strong>01011010 01000101 01010010 01001111</strong> — Z, E, R, O — one byte per
                letter, read left to right.
              </p>
              <p>
                ASCII holds 128 characters — enough for English, not for the world.{" "}
                <strong>Unicode</strong> is the bigger chart: every character of every language gets
                a number. <strong>UTF-8</strong> is how Unicode is written in bytes: plain ASCII
                text stays exactly one byte per character, and characters beyond ASCII take two,
                three, or four bytes. Same road, longer chart.
              </p>
              <p>Tap any character to load its byte into the builder in module 2.</p>
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
                        onClick={() => {
                          setBits(entry.bits);
                          setModuleId("places");
                        }}
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
              <DrillBox moduleId="characters" onResult={record} />
            </section>
          )}

          {moduleId === "translator" && (
            <section aria-labelledby="binary-translator">
              <h3 id="binary-translator">6 · The Translator</h3>
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
              {decodedReadings.length > 0 && (
                <ul className="binary-window__readings">
                  {decodedReadings.map((reading, i) => (
                    <li key={i}>
                      <strong>{reading.bits}</strong> → {reading.sum} = {reading.value}
                      {reading.char
                        ? reading.char === " "
                          ? " → the space"
                          : ` → '${reading.char}'`
                        : " → no character on the chart"}
                    </li>
                  ))}
                </ul>
              )}
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
          )}

          {moduleId === "arithmetic" && (
            <section aria-labelledby="binary-arithmetic">
              <h3 id="binary-arithmetic">7 · Binary Arithmetic</h3>
              <p>
                Addition works exactly like decimal, with one change: the columns carry at{" "}
                <strong>2</strong>, not 10. 0+0=0, 0+1=1, 1+1=0 and carry 1, 1+1+1=1 and carry 1.
                Try it — change either byte and watch the carries:
              </p>
              <div className="binary-window__arith-inputs">
                <label>
                  First byte
                  <input
                    className="binary-window__input"
                    value={addA}
                    onChange={(e) => setAddA(e.target.value.replace(/[^01]/g, "").slice(0, 8))}
                    aria-label="First byte"
                    spellCheck={false}
                  />
                </label>
                <label>
                  Second byte
                  <input
                    className="binary-window__input"
                    value={addB}
                    onChange={(e) => setAddB(e.target.value.replace(/[^01]/g, "").slice(0, 8))}
                    aria-label="Second byte"
                    spellCheck={false}
                  />
                </label>
              </div>
              {added && added.columns.length === 8 && addA.length === 8 && addB.length === 8 ? (
                <div>
                  <table className="binary-window__table" aria-label="Addition walk">
                    <thead>
                      <tr>
                        <th>Place</th>
                        <th>Carry in</th>
                        <th>Bits</th>
                        <th>Written</th>
                        <th>Carry out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {added.columns.map((col) => (
                        <tr key={col.place}>
                          <td>{col.place}</td>
                          <td>{col.carryIn}</td>
                          <td>
                            {col.a} + {col.b}
                          </td>
                          <td>{col.written}</td>
                          <td>{col.carryOut}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="binary-window__sum">
                    = {added.result} ({added.sum}
                    {added.overflow
                      ? " — the true sum needs a ninth bit; the byte alone keeps the low eight"
                      : ""}
                    )
                  </p>
                </div>
              ) : (
                <p>Give both bytes their full eight bits to see the walk.</p>
              )}
              <p>
                <strong>Subtraction</strong> borrows the same way, in 2s:{" "}
                {subtractBytes("00111010", "00011110")?.result} is 58 − 30 = 28 written as a byte.
                (Module 8 shows the road computers actually take: add the negative.)
              </p>
              <p>
                <strong>Multiplication</strong> is shift-and-add — one shifted row per 1 in the
                second number. 6 × 5: rows 6 and 24, total{" "}
                {multiplyBytes("00000110", "00000101")?.product} ={" "}
                {multiplyBytes("00000110", "00000101")?.result}.
              </p>
              <p>
                <strong>Division</strong> asks how many times the divisor fits: 43 ÷ 5 = 8 with 3
                left over — the quotient in binary is 1000, the remainder 11.
              </p>
              <DrillBox moduleId="arithmetic" onResult={record} />
            </section>
          )}

          {moduleId === "negatives" && (
            <section aria-labelledby="binary-negatives">
              <h3 id="binary-negatives">8 · Negative Numbers</h3>
              <p>
                A byte has no minus sign, so the sign has to live in the bits. The first try was the{" "}
                <strong>sign bit</strong>: top bit 1 means negative, the rest is the number. It
                limps — it makes two zeros (+0 and −0) and the arithmetic breaks.
              </p>
              <p>
                <strong>Ones' complement</strong> flips every bit to negate. Better, still two
                zeros. <strong>Two's complement</strong> is the real one, the one computers use:{" "}
                <strong>flip every bit, then add 1</strong>. One zero, and addition just works — 5 +
                (−5) walks off the top of the byte and leaves 00000000.
              </p>
              <label className="binary-window__label">
                A number from −128 to 127
                <input
                  className="binary-window__input"
                  type="number"
                  min={-128}
                  max={127}
                  value={negIn}
                  onChange={(e) =>
                    setNegIn(Math.max(-128, Math.min(127, Number(e.target.value) || 0)))
                  }
                  aria-label="Signed number"
                />
              </label>
              {negBits && (
                <SlowSteps
                  slow={slow}
                  steps={[
                    `${negIn} lives in the byte as ${negBits}.`,
                    ...(negIn < 0
                      ? [
                          `Start with ${-negIn}: ${toTwosComplement(-negIn)}.`,
                          `Flip every bit: ${flipBits(toTwosComplement(-negIn) ?? "")}.`,
                          `Add 1: ${negateByte(toTwosComplement(-negIn) ?? "")} — that is ${negIn}.`,
                        ]
                      : [
                          `Read back: the top bit is 0, so it is plain ${fromTwosComplement(negBits)}.`,
                        ]),
                  ]}
                />
              )}
              <p>
                The 8-bit signed range is <strong>−128 to 127</strong>. Push past it and you get{" "}
                <strong>overflow</strong>: 100 + 50 in signed bytes lands on a byte that reads back
                negative — the answer ran off the edge, and the system has to notice the signs to
                catch it.
              </p>
              <DrillBox moduleId="negatives" onResult={record} />
            </section>
          )}

          {moduleId === "gates" && (
            <section aria-labelledby="binary-gates">
              <h3 id="binary-gates">9 · Logic & Gates</h3>
              <p>
                Under the arithmetic sits the layer that does it: <strong>gates</strong> — tiny
                circuits that take bits in and put a bit out by a fixed rule. Every gate's whole
                truth fits in its table:
              </p>
              {GATES.map((gate) => (
                <div key={gate.name} className="binary-window__gate">
                  <h4>{gate.name}</h4>
                  <p>{gate.plain}</p>
                  <table className="binary-window__table" aria-label={`${gate.name} truth table`}>
                    <thead>
                      <tr>
                        <th>In</th>
                        {gate.inputs === 2 && <th>In</th>}
                        <th>Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(gate.inputs === 1
                        ? ([[0], [1]] as const)
                        : ([
                            [0, 0],
                            [0, 1],
                            [1, 0],
                            [1, 1],
                          ] as const)
                      ).map((row) => (
                        <tr key={row.join("")}>
                          <td>{row[0]}</td>
                          {gate.inputs === 2 && <td>{row[1]}</td>}
                          <td>{gate.run(row[0] as 0 | 1, (row[1] ?? 0) as 0 | 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <p>
                Gates make circuits, and circuits make arithmetic: add two bits and the sum bit is
                their <strong>XOR</strong>, the carry bit is their <strong>AND</strong>. That pair
                is a half adder — the seed the whole adding machine grows from.
              </p>
              <DrillBox moduleId="gates" onResult={record} />
            </section>
          )}

          {moduleId === "bitwise" && (
            <section aria-labelledby="binary-bitwise">
              <h3 id="binary-bitwise">10 · Bitwise Work</h3>
              <p>Run a gate down two whole bytes at once — column by column. Pick the operation:</p>
              <div className="binary-window__choices" role="group" aria-label="Bitwise operation">
                {(["AND", "OR", "XOR"] as const).map((op) => (
                  <button
                    key={op}
                    type="button"
                    className="window-btn"
                    aria-pressed={bwOp === op}
                    onClick={() => setBwOp(op)}
                  >
                    {op}
                  </button>
                ))}
              </div>
              <p className="binary-window__bits-line">
                {bwA}
                <br />
                {bwB}
                <br />
                {bwResult ?? "········"}
              </p>
              <label className="binary-window__label">
                First byte
                <input
                  className="binary-window__input"
                  value={bwA}
                  onChange={(e) => setBwA(e.target.value.replace(/[^01]/g, "").slice(0, 8))}
                  aria-label="Bitwise first byte"
                  spellCheck={false}
                />
              </label>
              <label className="binary-window__label">
                Second byte
                <input
                  className="binary-window__input"
                  value={bwB}
                  onChange={(e) => setBwB(e.target.value.replace(/[^01]/g, "").slice(0, 8))}
                  aria-label="Bitwise second byte"
                  spellCheck={false}
                />
              </label>
              <p>
                <strong>Shifting</strong> slides every bit one place. Left shift doubles:{" "}
                {shiftLeft("00010100")} is 40, twice 20. Right shift halves, rounding down:{" "}
                {shiftRight("00010100")} is 10.
              </p>
              <p>
                A <strong>mask</strong> is a byte with one bit on, used as a tool: OR with it to
                turn that bit on ({setBit("01000000", 3)} — the 8s bit lit), AND with its flip to
                turn a bit off, XOR with it to flip a bit. One bit at a time, exactly the one you
                mean — that is how single switches inside a byte get worked.
              </p>
              <DrillBox moduleId="bitwise" onResult={record} />
            </section>
          )}

          {moduleId === "bases" && (
            <section aria-labelledby="binary-bases">
              <h3 id="binary-bases">11 · Hexadecimal & Octal</h3>
              <p>
                Long binary is hard to read, so it gets shorthand. <strong>Hexadecimal</strong>{" "}
                (base 16) groups the bits in <strong>fours</strong> — one hex digit per nibble,
                digits 0–9 then A–F for 10–15. <strong>Octal</strong> (base 8) groups in{" "}
                <strong>threes</strong>. The chart is the whole dictionary:
              </p>
              <table className="binary-window__table" aria-label="Decimal, binary, hex, octal">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Binary</th>
                    <th>Hex</th>
                    <th>Octal</th>
                  </tr>
                </thead>
                <tbody>
                  {BASE_CHART.map((row) => (
                    <tr key={row.value}>
                      <td>{row.value}</td>
                      <td>{row.binary}</td>
                      <td>{row.hex}</td>
                      <td>{row.octal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                The builder's byte, {bits}, reads in hex as <strong>{byteToHex(bits)}</strong> and
                in octal as <strong>{byteToOctal(bits)}</strong> — group it in fours from the right
                for hex, in threes for octal, and convert each group on its own.
              </p>
              <DrillBox moduleId="bases" onResult={record} />
            </section>
          )}

          {moduleId === "realworld" && (
            <section aria-labelledby="binary-realworld">
              <h3 id="binary-realworld">12 · Real-World Binary</h3>
              <p>
                Everything digital is bytes underneath. A <strong>picture</strong> is a grid of
                pixels; each pixel is three bytes — how much red, green, and blue (0–255 each). Mix
                them here:
              </p>
              <div className="binary-window__rgb">
                {(["r", "g", "b"] as const).map((channel) => (
                  <label key={channel}>
                    {channel === "r" ? "Red" : channel === "g" ? "Green" : "Blue"}
                    <input
                      className="binary-window__input"
                      type="number"
                      min={0}
                      max={255}
                      value={rgb[channel]}
                      aria-label={`${channel === "r" ? "Red" : channel === "g" ? "Green" : "Blue"} value`}
                      onChange={(e) =>
                        setRgb((current) => ({
                          ...current,
                          [channel]: Math.max(0, Math.min(255, Number(e.target.value) || 0)),
                        }))
                      }
                    />
                  </label>
                ))}
                <div
                  className="binary-window__swatch"
                  style={{ background: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }}
                  aria-label="Color swatch"
                />
              </div>
              <p className="binary-window__bits-line">
                bytes: {rgb.r.toString(2).padStart(8, "0")} {rgb.g.toString(2).padStart(8, "0")}{" "}
                {rgb.b.toString(2).padStart(8, "0")} · hex: #
                {byteToHex(rgb.r.toString(2).padStart(8, "0"))}
                {byteToHex(rgb.g.toString(2).padStart(8, "0"))}
                {byteToHex(rgb.b.toString(2).padStart(8, "0"))}
              </p>
              <p>
                <strong>Sound</strong> is numbers too — the height of the wave, measured thousands
                of times a second, each measurement stored as bytes. <strong>Video</strong> is
                pictures in a fast row, each one bytes. A <strong>file</strong> is bytes with a
                name; the first bytes often say what kind it is. And a computer's{" "}
                <strong>memory addresses</strong> — the numbered shelves the bytes sit on — are
                written in hex, because an address is just a long binary number wearing its
                shorthand.
              </p>
              <DrillBox moduleId="realworld" onResult={record} />
            </section>
          )}

          {moduleId === "floating" && (
            <section aria-labelledby="binary-floating">
              <h3 id="binary-floating">13 · Floating Point</h3>
              <p>
                Whole numbers are easy. Fractions need a trick, and the trick is the same one
                science uses: write the number as a small piece times a power. <strong>5.75</strong>{" "}
                in binary is 101.11 — slide the point two places and it is{" "}
                <strong>1.0111 × 2^2</strong>. Three parts get stored: the <strong>sign</strong>{" "}
                (one bit), the <strong>exponent</strong> (the power — how far the point slid), and
                the <strong>fraction</strong> (the digits after the point). That layout is the
                standard called <strong>IEEE 754</strong>.
              </p>
              <p>
                The honest limit: some fractions never finish in binary. 0.1 in decimal is 1/10; in
                binary it repeats forever, like 1/3 does in decimal (0.333…). The computer keeps as
                many bits as it has and rounds — which is why a long chain of small additions can
                land a hair off the true answer. Close enough to fly by, never exact, and worth
                knowing before you trust a total.
              </p>
              <DrillBox moduleId="floating" onResult={record} />
            </section>
          )}

          {moduleId === "errors" && (
            <section aria-labelledby="binary-errors">
              <h3 id="binary-errors">14 · Error Detection</h3>
              <p>
                Bytes travel and bytes rot — a flipped bit on a wire or a disk. The simplest guard
                is a <strong>parity bit</strong>: one extra bit sent with the byte, chosen so the
                total count of 1s comes out <strong>even</strong>. The builder's byte {bits} has{" "}
                {bits.split("").filter((c) => c === "1").length} ones, so its even parity bit is{" "}
                <strong>{parityBit(bits)}</strong>. If a byte arrives and the count is odd,
                something flipped — the receiver knows to ask again. Parity catches any single flip;
                two flips in the same byte slip past it, which is why stronger guards exist.
              </p>
              <p>
                A <strong>checksum</strong> guards a whole run of bytes: add them all, keep only the
                lowest byte, and send that with the data. Bytes 10, 20, 30 check to{" "}
                {checksum([10, 20, 30])}. The receiver adds again and compares — a mismatch means
                the data changed on the road.
              </p>
              <DrillBox moduleId="errors" onResult={record} />
            </section>
          )}

          {moduleId === "mastery" && (
            <section aria-labelledby="binary-mastery">
              <h3 id="binary-mastery">15 · Practice & Mastery — the know-everything pass</h3>
              <p>
                The review pass draws ten questions from across all the modules — reading,
                converting, characters, arithmetic, negatives, gates, bitwise, hex, errors. Wrong
                answers show the working, same as everywhere. Your best score is saved.
              </p>
              <ul className="binary-window__review">
                {BINARY_MODULES.filter((m) => m.id !== "mastery").map((mod, i) => (
                  <li key={mod.id}>
                    {i + 1}. {mod.title} —{" "}
                    {progress.done.includes(mod.id) ? "learned ✓" : "not yet"}
                    {!progress.done.includes(mod.id) && (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="window-btn"
                          onClick={() => markLearned(mod.id)}
                        >
                          Mark learned
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {!masteryRun && (
                <button type="button" className="window-btn" onClick={startMastery}>
                  Start the mastery pass (10 questions)
                </button>
              )}
              {masteryRun && masteryDrill && (
                <div className="binary-window__drill">
                  <p className="binary-window__drill-prompt">
                    Question {masteryRun.index + 1} of 10 — score so far: {masteryRun.score}.{" "}
                    {masteryDrill.prompt}
                  </p>
                  {masteryDrill.choices ? (
                    <div className="binary-window__choices">
                      {masteryDrill.choices.map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          className="window-btn"
                          aria-pressed={masteryAnswer === choice.slice(0, 1)}
                          onClick={() => setMasteryAnswer(choice.slice(0, 1))}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="binary-window__input"
                      value={masteryAnswer}
                      onChange={(e) => setMasteryAnswer(e.target.value)}
                      aria-label="Your mastery answer"
                      spellCheck={false}
                    />
                  )}
                  <div className="binary-window__drill-actions">
                    <button
                      type="button"
                      className="window-btn"
                      onClick={checkMastery}
                      disabled={masteryVerdict !== null}
                    >
                      Check my answer
                    </button>
                    {masteryVerdict !== null && (
                      <button type="button" className="window-btn" onClick={nextMastery}>
                        {masteryRun.index + 1 >= 10 ? "Finish the pass" : "Next question"}
                      </button>
                    )}
                  </div>
                  {masteryVerdict !== null && (
                    <p className="binary-window__verdict" role="status">
                      {masteryVerdict ? "Right. " : "Not yet — here is the working: "}
                      {masteryDrill.working}
                    </p>
                  )}
                </div>
              )}
              {!masteryRun && progress.masteryBest > 0 && (
                <p role="status">Best mastery pass so far: {progress.masteryBest} of 10.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </FloatingWindow>
  );
}
