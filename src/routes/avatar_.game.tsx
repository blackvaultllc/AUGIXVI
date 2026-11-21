import { createFileRoute, Link } from "@tanstack/react-router";
import { RoomGate } from "@/avatar/RoomGate";

/**
 * LEGEND OF LOGIC — GAME ROOM (operator order 2026-11-21).
 * The REAL game — DIJA'S Academy presents Legend of Logic, the canonical
 * v54 single-file build — served UNMODIFIED from the app's own public
 * folder and played full-bleed inside Augie, behind the operator gate.
 * Same origin, so the game's own saves/localStorage keys work exactly
 * as they do standalone. Not a walkthrough, not cards: the game itself.
 */
export const Route = createFileRoute("/avatar_/game")({
  component: GameRoomPage,
});

function GameRoomPage() {
  return (
    <RoomGate roomName="Legend of Logic">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100dvh",
            background: "#0b0e14",
            color: "#eef2f7",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.6rem 1rem",
              borderBottom: "2px solid #d4af37",
              background: "#101623",
              flex: "0 0 auto",
            }}
          >
            <Link
              to="/avatar"
              style={{
                color: "#9fb0c9",
                textDecoration: "none",
                border: "1px solid #3a4763",
                padding: "6px 10px",
                borderRadius: "999px",
                fontSize: "14px",
                whiteSpace: "nowrap",
              }}
            >
              ← Augie
            </Link>
            <h1 style={{ fontSize: "19px", margin: 0 }}>Legend of Logic</h1>
            <span style={{ fontSize: "13px", color: "#9fb0c9" }}>
              DIJA'S Academy presents Legend of Logic — the full game, playable right here. Your
              progress saves on this machine.
            </span>
          </header>
          <iframe
            src="/games/legend-of-logic.html"
            title="Legend of Logic — DIJA'S Academy"
            style={{ flex: 1, width: "100%", border: 0, background: "#000" }}
          />
        </div>
    </RoomGate>
  );
}
