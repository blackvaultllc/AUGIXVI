import { useEffect, useRef, useState, type FormEvent } from "react";
import { verifyOperatorAccess } from "./operatorAuth.server";
import {
  calculateBitwise,
  convertCubeValue,
  CUBE_LAYERS,
  getCubieBits,
  parseCubeValue,
  type BitOperation,
  type NumberBase,
} from "./cubeReference";

const BASE_OPTIONS: { value: NumberBase; label: string }[] = [
  { value: 2, label: "Binary" },
  { value: 10, label: "Decimal" },
  { value: 16, label: "Hexadecimal" },
];

export function CubePanel({
  onClose,
  onAuthorized,
}: {
  onClose: () => void;
  onAuthorized?: (operatorName: string) => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  const [value, setValue] = useState("42");
  const [base, setBase] = useState<NumberBase>(10);
  const [left, setLeft] = useState("42");
  const [right, setRight] = useState("15");
  const [operation, setOperation] = useState<BitOperation>("AND");
  const [operatorToken, setOperatorToken] = useState("");
  const [operatorStatus, setOperatorStatus] = useState<
    "locked" | "checking" | "open" | "not-configured" | "denied"
  >("locked");
  const converted = convertCubeValue(value, base);
  const parsedValue = parseCubeValue(value, base) ?? 0n;
  const bitwiseResult = calculateBitwise(left, right, operation, base);

  useEffect(() => {
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeHandler.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOperatorStatus("checking");
    try {
      const result = await verifyOperatorAccess({ data: { token: operatorToken } });
      setOperatorToken("");
      if (result.authorized && result.operatorName) onAuthorized?.(result.operatorName);
      setOperatorStatus(
        !result.configured ? "not-configured" : result.authorized ? "open" : "denied",
      );
    } catch (error) {
      setOperatorToken("");
      setOperatorStatus("denied");
      console.error("Operator verification failed.", error);
    }
  }

  return (
    <div className="avatar-cube-backdrop">
      <section
        className="avatar-cube-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-cube-title"
      >
        {operatorStatus !== "open" ? (
          <>
            <header className="avatar-cube-header">
              <div>
                <p className="avatar-cube-eyebrow">Operator verification</p>
                <h2 id="avatar-cube-title">Cube locked</h2>
              </div>
              <button
                ref={closeButton}
                className="avatar-cube-close"
                onClick={onClose}
                type="button"
              >
                Close
              </button>
            </header>
            <p className="avatar-cube-note">
              The operator token is checked on the server and is never stored in this browser.
            </p>
            {operatorStatus === "not-configured" ? (
              <p className="avatar-cube-error" role="status">
                Operator access is not configured on the server. The cube remains locked.
              </p>
            ) : (
              <form className="avatar-cube-unlock" onSubmit={(event) => void unlock(event)}>
                <label>
                  Operator token
                  <input
                    autoComplete="off"
                    type="password"
                    value={operatorToken}
                    onChange={(event) => setOperatorToken(event.target.value)}
                  />
                </label>
                <button type="submit" disabled={!operatorToken || operatorStatus === "checking"}>
                  {operatorStatus === "checking" ? "Verifying…" : "Unlock"}
                </button>
                {operatorStatus === "denied" && (
                  <p className="avatar-cube-error" role="alert">
                    Operator access was not verified.
                  </p>
                )}
              </form>
            )}
          </>
        ) : (
          <>
            <header className="avatar-cube-header">
              <div>
                <p className="avatar-cube-eyebrow">Local reference</p>
                <h2 id="avatar-cube-title">Cube / bit layers</h2>
              </div>
              <button
                ref={closeButton}
                className="avatar-cube-close"
                onClick={onClose}
                type="button"
              >
                Close
              </button>
            </header>
            <p className="avatar-cube-note">
              Values are calculated in this panel only. This reference does not execute code or
              commands.
            </p>

            <section className="avatar-cube-section" aria-labelledby="avatar-cube-convert">
              <h3 id="avatar-cube-convert">Binary ⇄ hex ⇄ decimal</h3>
              <div className="avatar-cube-input-row">
                <label>
                  Value
                  <input
                    autoComplete="off"
                    inputMode={base === 10 ? "numeric" : "text"}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                </label>
                <label>
                  Input base
                  <select
                    value={base}
                    onChange={(event) => setBase(Number(event.target.value) as NumberBase)}
                  >
                    {BASE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {converted ? (
                <dl className="avatar-cube-values" aria-live="polite">
                  <div>
                    <dt>Binary</dt>
                    <dd>{converted.binary}</dd>
                  </div>
                  <div>
                    <dt>Hexadecimal</dt>
                    <dd>0x{converted.hexadecimal}</dd>
                  </div>
                  <div>
                    <dt>Decimal</dt>
                    <dd>{converted.decimal}</dd>
                  </div>
                </dl>
              ) : (
                <p className="avatar-cube-error" role="status">
                  Enter a valid unsigned 32-bit value for the selected base.
                </p>
              )}
            </section>

            <section className="avatar-cube-section" aria-labelledby="avatar-cube-layers">
              <h3 id="avatar-cube-layers">Layers</h3>
              <div className="avatar-cube-layers">
                {CUBE_LAYERS.map((layer) => (
                  <article key={layer.id}>
                    <h4>{layer.name}</h4>
                    <p>{layer.description}</p>
                  </article>
                ))}
              </div>
              <h4 className="avatar-cube-subtitle">Cubie bits · low 8 bits</h4>
              <ul className="avatar-cube-bits" aria-label="Eight cubie bit values">
                {getCubieBits(parsedValue).map((bit) => (
                  <li key={bit.corner} data-active={bit.active ? "true" : "false"}>
                    <span>Corner {bit.corner}</span>
                    <span>XYZ {bit.coordinates}</span>
                    <strong>{bit.active ? "1" : "0"}</strong>
                  </li>
                ))}
              </ul>
            </section>

            <section className="avatar-cube-section" aria-labelledby="avatar-cube-calc">
              <h3 id="avatar-cube-calc">Bitwise calculation</h3>
              <div className="avatar-cube-calc-row">
                <label>
                  Left value
                  <input value={left} onChange={(event) => setLeft(event.target.value)} />
                </label>
                <label>
                  Operation
                  <select
                    value={operation}
                    onChange={(event) => setOperation(event.target.value as BitOperation)}
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                    <option value="XOR">XOR</option>
                  </select>
                </label>
                <label>
                  Right value
                  <input value={right} onChange={(event) => setRight(event.target.value)} />
                </label>
              </div>
              {bitwiseResult ? (
                <p className="avatar-cube-result" aria-live="polite">
                  {bitwiseResult.binary}₂ = 0x{bitwiseResult.hexadecimal} = {bitwiseResult.decimal}
                  ₁₀
                </p>
              ) : (
                <p className="avatar-cube-error" role="status">
                  Enter two valid unsigned 32-bit values in the selected base.
                </p>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  );
}
