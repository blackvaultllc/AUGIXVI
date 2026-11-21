import { createFileRoute } from "@tanstack/react-router";
import { LearnerGate } from "@/avatar/learner/LearnerGate";
import { RacingGame } from "@/avatar/learner/racing/RacingGame";

/**
 * MULTIPLICATION RACING — /learner/racing (operator order 2026-11-21).
 * A TEST feature on the DIJA'S Academy side: a kart race where
 * answering multiplication questions speeds up her car, pit stops
 * teach the strategy trick behind the facts and bolt on upgrades,
 * and a full pit stop earns a NOS zoom. Reached under HER session
 * through the learner gate, like her Legend of Logic room.
 */
export const Route = createFileRoute("/learner_/racing")({
  ssr: false,
  component: LearnerRacingPage,
});

function LearnerRacingPage() {
  return (
    <LearnerGate roomName="Multiplication Racing Game">
      <div className="learner-game">
        <header className="learner-game__header">
          <a href="/learner">← My Page</a>
          <h1>Multiplication Racing Game</h1>
          <span>TEST — a new DIJA&apos;S Academy game we are trying out.</span>
        </header>
        <RacingGame />
      </div>
    </LearnerGate>
  );
}
