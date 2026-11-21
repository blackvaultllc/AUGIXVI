import { createFileRoute, Link } from "@tanstack/react-router";
import { RoomGate } from "@/avatar/RoomGate";
import WorldOfLogic from "@/avatar/world-of-logic/WorldOfLogic";

/**
 * WORLD OF LOGIC — GAME ROOM (operator order 2026-11-21).
 * The cyber security game from the VoiceWave Command Deck — walk the
 * grass and the woods, walk up to a monster, read its lesson, and
 * fight it per-turn with the deck's own battle engine — merged into
 * Augie behind the operator gate, the same standing Legend of Logic
 * got. Source: blackvaultllc/voicewave-command-deck @ 7653d36
 * (src/lib/battles.ts + BattlePanel), ported faithfully; the Captain's
 * record and captured collection keep the deck's own save keys.
 */
export const Route = createFileRoute("/avatar_/world")({
  component: WorldRoomPage,
});

function WorldRoomPage() {
  return (
    <RoomGate roomName="World of Logic">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100dvh",
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
          <h1 style={{ fontSize: "19px", margin: 0 }}>World of Logic</h1>
          <span style={{ fontSize: "13px", color: "#9fb0c9" }}>
            The Captain's outside battles from the VoiceWave Command Deck — walk up, read the
            lesson, fight per-turn. Progress saves on this machine.
          </span>
        </header>
        <WorldOfLogic />
      </div>
    </RoomGate>
  );
}
