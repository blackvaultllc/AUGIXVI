import { createFileRoute } from "@tanstack/react-router";
import { LearnerGate } from "@/avatar/learner/LearnerGate";

/**
 * KHADIJA'S GAME ROOM — /learner/game. The same Legend of Logic game
 * file the operator room serves (/games/legend-of-logic.html, the
 * canonical DIJA'S Academy build, unmodified), reached under HER
 * session instead: the learner gate checks only her sign-in, and the
 * operator's RoomGate is not involved in either direction.
 */
export const Route = createFileRoute("/learner_/game")({
  ssr: false,
  component: LearnerGamePage,
});

function LearnerGamePage() {
  return (
    <LearnerGate roomName="Legend of Logic">
      <div className="learner-game">
        <header className="learner-game__header">
          <a href="/learner">← My Page</a>
          <h1>Legend of Logic</h1>
          <span>
            DIJA&apos;S Academy presents Legend of Logic — your progress saves on this device.
          </span>
        </header>
        <iframe
          src="/games/legend-of-logic.html"
          title="Legend of Logic — DIJA'S Academy"
          className="learner-game__frame"
        />
      </div>
    </LearnerGate>
  );
}
