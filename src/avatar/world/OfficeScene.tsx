/**
 * THE OFFICE SCENE — walk-in transition and interior (owner order).
 * Fade to black with a sparkle of sand splashing, then Osiris walks in and
 * looks around. The operator can spawn in as the Black Hatter (wolf-type)
 * and walk / fly / sit / talk to the workers / open panels alongside him.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BLACK_HATTER,
  CITY_BUILDINGS,
  CITY_STREETS,
  FADE_MS,
  HOLD_MS,
  OFFICE_ROOMS,
  REVEAL_MS,
  phaseAt,
  sandSparkle,
} from "./office";
import type { OfficePhase } from "./office";
import { DEPARTMENTS, ROSTER, TOTAL_WORKERS, departmentOf } from "./workers";

const WORKERS_BY_ROOM: Record<string, number> = Object.fromEntries(
  DEPARTMENTS.map((d) => [OFFICE_ROOMS.find((r) => r.departmentId === d.id)?.id ?? "", d.count]),
);

export function OfficeScene({ active, onExit }: { active: boolean; onExit: () => void }) {
  const [phase, setPhase] = useState<Exclude<OfficePhase, "outside">>(() =>
    active ? (phaseAt(0) as Exclude<OfficePhase, "outside">) : "inside",
  );
  const [sparkle, setSparkle] = useState(0);
  const [hatterOut, setHatterOut] = useState(false);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const frame = () => {
      const elapsed = Date.now() - start;
      setPhase(phaseAt(elapsed) as Exclude<OfficePhase, "outside">);
      setSparkle(sandSparkle(elapsed));
      if (elapsed < FADE_MS + HOLD_MS + REVEAL_MS) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setSparkle(0);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  const city = useMemo(() => CITY_BUILDINGS, []);
  if (!active) return null;

  return (
    <section className="office-scene" aria-label="Osiris's office">
      {/* SAND FADE OVERLAY: black with a splash of golden sand sparkles. */}
      {phase !== "inside" && (
        <div
          className={`office-scene__fade${phase === "entering" ? " is-holding" : ""}`}
          style={{ opacity: phase === "fade-out" ? Math.min(1, 0.2 + sparkle) : 1 }}
          data-phase={phase}
        >
          <div className="office-scene__sand" style={{ opacity: sparkle }} aria-hidden="true">
            {Array.from({ length: 28 }, (_, i) => (
              <span
                key={i}
                style={{
                  left: `${(i * 37 + 13) % 100}%`,
                  top: `${(i * 53 + 7) % 100}%`,
                  animationDelay: `${(i % 9) * 0.12}s`,
                }}
              />
            ))}
          </div>
          <p className="office-scene__fade-caption">{phase === "fade-out" ? "Walking in…" : "…"}</p>
        </div>
      )}

      {phase === "inside" && (
        <>
          <header className="office-scene__header">
            <h2>Osiris&apos;s Office — {TOTAL_WORKERS} workers on staff</h2>
            <div className="office-scene__city" aria-label="The city outside">
              <span className="office-scene__streets">{CITY_STREETS.join(" · ")}</span>
              <span className="office-scene__buildings">
                {city.map((b) => (
                  <i key={b.id} data-hue={b.hue} title={`${b.name} (${b.height} floors)`} />
                ))}
              </span>
            </div>
            <button type="button" className="office-scene__exit" onClick={onExit}>
              Back to the world
            </button>
          </header>

          <div className="office-scene__floor" data-floor="layout">
            {OFFICE_ROOMS.map((room) => (
              <button
                key={room.id}
                type="button"
                className="office-scene__room"
                data-room={room.id}
                title={`${room.name} — floor ${room.floor}: ${room.purpose}`}
              >
                <strong>{room.name}</strong>
                <span>Floor {room.floor}</span>
                {WORKERS_BY_ROOM[room.id] ? (
                  <em>
                    {WORKERS_BY_ROOM[room.id]} workers ·{" "}
                    {
                      departmentOf(
                        ROSTER.find((w) => w.departmentId === room.departmentId!) ?? ROSTER[0]!,
                      )?.name
                    }
                  </em>
                ) : (
                  <em>{room.purpose}</em>
                )}
              </button>
            ))}
          </div>

          {/* OSIRIS walks in and looks around; the Black Hatter can join. */}
          <div className="office-scene__figures">
            <figure className="office-figure office-figure--osiris">
              <span className="office-figure__glyph" aria-hidden="true">
                𓁹
              </span>
              <figcaption>Osiris — walking in, looking around</figcaption>
            </figure>
            {hatterOut ? (
              <figure className="office-figure office-figure--hatter">
                <span className="office-figure__glyph" aria-hidden="true">
                  🐺
                </span>
                <figcaption>
                  {BLACK_HATTER.name} — you. Walk, fly, sit, talk, open panels.
                </figcaption>
                <button
                  type="button"
                  className="office-figure__dismiss"
                  onClick={() => setHatterOut(false)}
                >
                  Step back
                </button>
              </figure>
            ) : (
              <button
                type="button"
                className="office-scene__summon-hatter"
                onClick={() => setHatterOut(true)}
              >
                Bring me out — the Black Hatter
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
