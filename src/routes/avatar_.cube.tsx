import { createFileRoute, Link } from "@tanstack/react-router";
import { RoomGate } from "@/avatar/RoomGate";

/**
 * AR CUBE ROOM (operator order 2026-11-20).
 * The standalone Augie AR Cube (MindAR + Three.js) served from the app's
 * own public folder, so it runs on the app's origin — camera access and
 * the operator gate both hold. Point the camera at a face of the MERGE
 * cube; the chosen model (Squishy, Gold Cube, Heart, Castle) pins to it.
 */
export const Route = createFileRoute("/avatar_/cube")({
  component: CubeRoomPage,
});

function CubeRoomPage() {
  return (
    <RoomGate roomName="AR Cube">
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
            <h1 style={{ fontSize: "19px", margin: 0 }}>AR Cube</h1>
            <span style={{ fontSize: "13px", color: "#9fb0c9" }}>
              Point the camera at one face of your cube, then pick a model: Squishy, Gold Cube,
              Heart or Castle.
            </span>
          </header>
          <iframe
            src="/ar-cube/index.html"
            title="Augie AR Cube"
            allow="camera; microphone"
            style={{ flex: 1, width: "100%", border: 0, background: "#000" }}
          />
        </div>
    </RoomGate>
  );
}
