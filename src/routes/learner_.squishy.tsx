import { createFileRoute } from "@tanstack/react-router";
import { LearnerGate } from "@/avatar/learner/LearnerGate";

/**
 * KHADIJA'S SQUISHY MAKER — /learner/squishy. Her game, inside her
 * Augie (owner order 2026-11-21). The built game file is served from
 * the app's own origin at /games/squishy-maker/index.html — the live
 * v4 build of her Squishy Maker artifact, copied unchanged — and its
 * saves are answered by Augie's own server (see
 * avatar/learner/squishyMaker.server.ts), so the game works fully
 * offline on this machine, under HER session only: the learner gate
 * checks her sign-in, and the operator's RoomGate is not involved.
 */
export const Route = createFileRoute("/learner_/squishy")({
  ssr: false,
  component: LearnerSquishyPage,
});

function LearnerSquishyPage() {
  return (
    <LearnerGate roomName="Squishy Maker">
      <div className="learner-game">
        <header className="learner-game__header">
          <a href="/learner">← My Page</a>
          <h1>Squishy Maker</h1>
          <span>Your game — your squishies save right here in Augie.</span>
        </header>
        <iframe
          src="/games/squishy-maker/index.html"
          title="Squishy Maker — Khadija's game"
          className="learner-game__frame"
        />
      </div>
    </LearnerGate>
  );
}
