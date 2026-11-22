/**
 * TEST AREA (Part 24) + CAPTURE (Part 15) — operator-only.
 *
 * Every probe is a REAL end-to-end run against the live system —
 * the brain, the vision model, the Wi-Fi watcher, the Library, the
 * bundled Pulse assets, the voice gate, settings persistence. Each
 * result lands in the persistent ledger with its reason and time;
 * a pass older than a day reads STALE, and a probe that has never
 * run reads NOT RUN. Nothing here can be talked into WORKS.
 *
 * Capture bundles the moment — settings, scan-state, recent
 * replies, this ledger — into one labeled JSON download.
 */
import { useCallback, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { loadBrainAddress } from "./brain";
import { CANONICAL_VISION_MODEL } from "./visionModel";
import { loadAvatarSettings } from "./settings";
import { loadReplyHistory } from "./replyHistory";
import {
  displayStatus,
  loadTestLedger,
  saveTestResult,
  type TestLedger,
  type TestResult,
} from "./testArea";
import { buildCaptureBundle, captureFilename } from "./capture";
import { createCoreTransport, recallFromCore } from "./coreLinkClient";
import { askCloud } from "./cloudBrain";

type Probe = {
  id: string;
  label: string;
  run: () => Promise<TestResult>;
};

/** One id per browser session — how the survival probe knows a restart happened. */
function currentTestSession(): string {
  const KEY = "augi.testarea.session";
  let session = sessionStorage.getItem(KEY);
  if (!session) {
    session = `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    sessionStorage.setItem(KEY, session);
  }
  return session;
}

const at = () => Date.now();
const works = (reason: string): TestResult => ({ status: "works", reason, at: at() });
const fails = (reason: string): TestResult => ({ status: "fails", reason, at: at() });

async function brainTags(): Promise<{ names: string[] }> {
  const brain = loadBrainAddress();
  const res = await fetch(`${brain}/api/tags`);
  if (!res.ok) throw new Error(`the brain answered HTTP ${res.status}`);
  const data = (await res.json()) as { models?: { name?: string }[] };
  return {
    names: (data.models ?? []).map((m) => m.name).filter((n): n is string => Boolean(n)),
  };
}

const PROBES: Probe[] = [
  {
    id: "brain",
    label: "Brain (Ollama)",
    run: async () => {
      try {
        const { names } = await brainTags();
        return works(`Ollama answers at ${loadBrainAddress()} — ${names.length} models installed.`);
      } catch (e) {
        return fails(`Brain unreachable: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  },
  {
    id: "vision",
    label: `Vision model (${CANONICAL_VISION_MODEL})`,
    run: async () => {
      try {
        const { names } = await brainTags();
        return names.some((n) => n === CANONICAL_VISION_MODEL || n.startsWith(`${CANONICAL_VISION_MODEL}:`))
          ? works(`${CANONICAL_VISION_MODEL} is installed on the brain.`)
          : fails(
              `Ollama answers, but ${CANONICAL_VISION_MODEL} is not installed (installed: ${names.join(", ") || "none"}).`,
            );
      } catch (e) {
        return fails(`Could not check: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  },
  {
    id: "watcher",
    label: "Wi-Fi watcher (wand presence)",
    run: async () => {
      try {
        const res = await fetch("/api/devices/scan-state");
        if (!res.ok) return fails(`scan-state answered HTTP ${res.status}`);
        const view = (await res.json()) as {
          available?: boolean;
          watcher?: { active?: boolean } | null;
        };
        if (!view.available) return fails("No watcher store on this server (local build only).");
        return view.watcher?.active
          ? works("The watcher is scanning and reporting fresh sightings.")
          : fails("The watcher store answers, but no fresh scan has arrived.");
      } catch (e) {
        return fails(`scan-state unreachable: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  },
  {
    id: "library",
    label: "Library (offline books)",
    run: async () => {
      try {
        const res = await fetch("/api/library/catalog");
        if (!res.ok) return fails(`The Library answered HTTP ${res.status} — its book server is likely down.`);
        return works("The Library catalog answers — the offline books are being served.");
      } catch (e) {
        return fails(`Library unreachable: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  },
  {
    id: "pulse-assets",
    label: "Pulse assets (bundled MediaPipe)",
    run: async () => {
      try {
        const res = await fetch("/mediapipe/face_landmarker.task", {
          headers: { Range: "bytes=0-0" },
        });
        return res.ok || res.status === 206
          ? works("The face model serves from the app itself — Pulse does not need the network.")
          : fails(`The bundled face model answered HTTP ${res.status}.`);
      } catch (e) {
        return fails(`Bundled model unreachable: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  },
  {
    id: "voice-gate",
    label: "Voice gate (ear + voiceprint)",
    run: async () => {
      try {
        const res = await fetch("/api/voiceprint/status");
        if (!res.ok) return fails(`The voiceprint service answered HTTP ${res.status}.`);
        const view = (await res.json().catch(() => null)) as { enrolled?: boolean } | null;
        return works(
          view?.enrolled
            ? "The ear service answers and a voiceprint is enrolled."
            : "The ear service answers; no voiceprint enrolled yet (Settings → Voice calibration).",
        );
      } catch (e) {
        return fails(`Ear service unreachable: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  },
  {
    id: "core-roundtrip",
    label: "Phone-to-core: memory round trip",
    run: async () => {
      try {
        const token = `probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const transport = createCoreTransport();
        const outcome = await transport.append({
          exchangeId: token,
          question: `Test Area core probe ${token}`,
          answer: "core round trip probe",
          provider: "test-area",
          surface: "test-area",
          queuedAt: new Date().toISOString(),
        });
        if (outcome === "unavailable") {
          return fails(
            "The core store did not take the probe exchange (no core store on this server, or no operator session).",
          );
        }
        localStorage.setItem(
          "augi.testarea.core-probe",
          JSON.stringify({ token, sessionId: currentTestSession() }),
        );
        const found = await recallFromCore(token);
        if (!found) return fails("The probe was written but recall could not run.");
        return found.some((r) => r.id === token)
          ? works(`Exchange ${token} was written to the core store and recalled back from it.`)
          : fails("The probe exchange was written but recall did not return it.");
      } catch (e) {
        return fails(`Core round trip failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  },
  {
    id: "core-survives",
    label: "Phone-to-core: memory survives restart",
    run: async () => {
      try {
        const session = currentTestSession();
        const marker = localStorage.getItem("augi.testarea.core-probe");
        if (!marker) {
          return fails(
            "No earlier round-trip token is stored — run the memory round trip probe first, then restart the app and run this.",
          );
        }
        const { token, sessionId } = JSON.parse(marker) as { token: string; sessionId: string };
        if (sessionId === session) {
          return fails(
            "The stored token was written in THIS session — restart the app, then run this probe again for the survival proof.",
          );
        }
        const found = await recallFromCore(token);
        if (!found) return fails("Recall could not run against the core store.");
        return found.some((r) => r.id === token)
          ? works(
              `Exchange ${token} was written before this session began and is still in the core store — memory survived the restart.`,
            )
          : fails("The pre-restart probe exchange is not in the core store.");
      } catch (e) {
        return fails(`Survival check failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  },
  {
    id: "provider-failover",
    label: "Provider failover (Groq → Gemini → OpenRouter → Ollama → simulated)",
    run: async () => {
      try {
        const result = await askCloud("ping — reply with one word");
        if (result.answer) {
          return works(`The failover pipe answered through ${result.provider} — named, as required.`);
        }
        return fails(
          result.notice ??
            `No real provider answered; the pipe fell through to ${result.provider}.`,
        );
      } catch (e) {
        return fails(`Failover probe failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  },
  {
    id: "settings",
    label: "Settings persistence",
    run: async () => {
      try {
        const key = "augi.testarea.probe";
        localStorage.setItem(key, "probe");
        const back = localStorage.getItem(key);
        localStorage.removeItem(key);
        return back === "probe"
          ? works("Local storage writes and reads back — settings can persist here.")
          : fails("Local storage did not return what was written.");
      } catch (e) {
        return fails(`Local storage unavailable: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  },
];

export function TestAreaWindow({ onClose }: { onClose: () => void }) {
  const [ledger, setLedger] = useState<TestLedger>(() => loadTestLedger());
  const [running, setRunning] = useState<string | null>(null);
  const now = Date.now();

  const runProbe = useCallback(async (probe: Probe) => {
    setRunning(probe.id);
    const result = await probe.run();
    setLedger(saveTestResult(probe.id, result));
    setRunning(null);
  }, []);

  const runAll = useCallback(async () => {
    for (const probe of PROBES) {
      await runProbe(probe);
    }
  }, [runProbe]);

  const capture = useCallback(async () => {
    let scanState: unknown = null;
    try {
      const res = await fetch("/api/devices/scan-state");
      scanState = res.ok ? await res.json() : { error: `HTTP ${res.status}` };
    } catch (e) {
      scanState = { error: e instanceof Error ? e.message : String(e) };
    }
    const bundle = buildCaptureBundle({
      now: Date.now(),
      userAgent: navigator.userAgent,
      settings: loadAvatarSettings(),
      scanState,
      recentReplies: loadReplyHistory().slice(-20),
      ledger: loadTestLedger(),
      visibleError: null,
    });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = captureFilename(Date.now());
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <FloatingWindow id="test-area" title="Test Area" onClose={onClose} initialWidth={520} initialHeight={480}>
      <div className="window-logs">
        <div className="window-logs__tabs">
          <button type="button" className="window-btn" onClick={() => void runAll()} disabled={running !== null}>
            Run all tests
          </button>
          <button type="button" className="window-btn" onClick={() => void capture()}>
            Capture this state
          </button>
        </div>
        <ol className="window-logs__list">
          {PROBES.map((probe) => {
            const result = ledger[probe.id];
            const status = displayStatus(result, now);
            return (
              <li key={probe.id} className="window-logs__line" style={{ fontFamily: "inherit" }}>
                <strong>{probe.label}</strong> —{" "}
                <span aria-label={`status ${status}`}>{status}</span>
                {running === probe.id ? " (running…)" : ""}
                <br />
                <span style={{ opacity: 0.85 }}>
                  {result
                    ? `${result.reason} (${new Date(result.at).toLocaleString()})`
                    : "Not run yet — no claim is made about this ability."}
                </span>{" "}
                <button
                  type="button"
                  className="window-btn"
                  onClick={() => void runProbe(probe)}
                  disabled={running !== null}
                >
                  Run
                </button>
              </li>
            );
          })}
        </ol>
        <p className="window-logs__note">
          A result older than a day reads STALE — history, not a current claim. Capture downloads
          one labeled JSON of this moment (settings, scan-state, recent replies, this ledger) to
          hand over for diagnosis.
        </p>
      </div>
    </FloatingWindow>
  );
}
