import { createFileRoute, Link } from "@tanstack/react-router";
import { RoomGate } from "@/avatar/RoomGate";
import { PictureAnalysis } from "@/avatar/PictureAnalysis";

/**
 * PICTURE ANALYSIS ROOM — the analytic window (operator order 2026-11-20).
 * Scan the room with the live camera or analyze a picture file; the
 * Parrot's local Ollama vision model answers as text on the page.
 */
export const Route = createFileRoute("/avatar_/analyze")({
  component: PictureAnalysisPage,
});

function PictureAnalysisPage() {
  return (
    <RoomGate roomName="Picture Analysis — Analytic Window">
        <div
          style={{
            minHeight: "100dvh",
            background: "#0b0e14",
            color: "#eef2f7",
            display: "flex",
            flexDirection: "column",
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
            <h1 style={{ fontSize: "19px", margin: 0 }}>Picture Analysis — Analytic Window</h1>
            <span style={{ fontSize: "13px", color: "#9fb0c9" }}>
              Scan the room with the camera, or analyze a picture. Answered locally on the Parrot.
            </span>
          </header>
          <main style={{ padding: "12px", overflowY: "auto" }}>
            <PictureAnalysis />
          </main>
        </div>
    </RoomGate>
  );
}
