/**
 * AUGI ANATOMY (Part 17, owner order 2026-11-21) — operator-only.
 * A visual map of Augie's core brain schema with the deep
 * configuration in ONE place (his comparison: a GTA V mod menu), so
 * he tunes Augie himself. Every control here writes through the SAME
 * settings system as Part 14 (settings.ts) — changes persist, sync
 * with the rest of the app, and never silently reset. Versions lock a
 * whole configuration under a name ("I want this version right
 * here") and restore it in one click.
 *
 * LEFT OUT ON PURPOSE (and stated in the window): API keys, Supabase
 * credentials, gate passwords, and service configuration are NOT
 * settings — they never appear here.
 */
import { useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import type { AvatarSettings } from "./settings";
import {
  deleteConfigVersion,
  findConfigVersion,
  loadConfigVersions,
  saveConfigVersion,
  type ConfigVersion,
} from "./configVersions";
import { VISION_MODEL } from "./vision";

const SCHEMA: { title: string; lines: string[] }[] = [
  {
    title: "Brain — local models (Ollama)",
    lines: [
      "Text brain: llama3.1:8b (the Flower's and Law Desk's default; env AUGIE_FLOWER_MODEL / AUGIE_LAW_MODEL can name another installed model)",
      `Vision: ${VISION_MODEL} — the ONE unified vision model (Part 26)`,
      "Embeddings: nomic-embed-text · Sentinel: sentinel:latest",
      "Offline rule: if Ollama is down, answers fall back to the books' own words — never invented",
    ],
  },
  {
    title: "Ears — the local ear",
    lines: [
      "Speech-to-text service on this machine (127.0.0.1:8765, faster-whisper) — audio never leaves the machine",
      "WeSpeaker voice gate: Augie acts on the OPERATOR's voice only; typing is never gated",
      "Other voices are kept in separate labeled stores (Part 13) — never merged into his voiceprint",
    ],
  },
  {
    title: "Eyes — vision, bundled (Part 19)",
    lines: [
      "MediaPipe wasm + face/hand landmarker models ship INSIDE the app (/mediapipe/) — zero internet, zero CDN",
      "Pulse reads presence + a heart-rate ESTIMATE with a quality gate; flat/weak signal reads UNAVAILABLE, never a made-up number",
      "No facial recognition, no person identification — ever",
    ],
  },
  {
    title: "Knowledge — the Library",
    lines: [
      "Kiwix on this machine (127.0.0.1:8180): Simple English Wikipedia, WikiBooks, WikiMed, Appropedia, Alpine — full English Wikipedia joins when its download lands",
      "Her Flower and his Law Desk read from the same shelves, each behind its own wall/gate",
    ],
  },
  {
    title: "Data core — where things live",
    lines: [
      "~/.local/share/augie/: gate-log.jsonl · trusted-devices.json · squishy-maker.json · augie-events.jsonl · listening sessions · watch vitals",
      "Browser side: settings, config versions, reply history, her learner stores — all labeled keys (augi.*)",
    ],
  },
  {
    title: "The wall — Khadija's side",
    lines: [
      "Her learner session reaches ONLY her allowlist (her page, her games, her Flower endpoint, her art)",
      "This window, and every operator room, sits outside it — the wall is tested, not assumed",
    ],
  },
];

const SLIDERS: { key: "maxParticles" | "bloom" | "glitch" | "sensitivity" | "cooldownMs"; label: string; min: number; max: number; step: number }[] = [
  { key: "maxParticles", label: "Particles", min: 20000, max: 120000, step: 5000 },
  { key: "bloom", label: "Bloom", min: 0, max: 2.5, step: 0.05 },
  { key: "glitch", label: "Glitch", min: 0, max: 1, step: 0.05 },
  { key: "sensitivity", label: "Sensor sensitivity", min: 0.1, max: 2, step: 0.1 },
  { key: "cooldownMs", label: "Sensor cooldown (ms)", min: 0, max: 5000, step: 100 },
];

export function AnatomyWindow({
  onClose,
  settings,
  onUpdate,
  onRestoreAll,
}: {
  onClose: () => void;
  settings: AvatarSettings;
  onUpdate: <K extends keyof AvatarSettings>(key: K, value: AvatarSettings[K]) => void;
  onRestoreAll: (next: AvatarSettings) => void;
}) {
  const [versions, setVersions] = useState<ConfigVersion[]>(() => loadConfigVersions());
  const [versionName, setVersionName] = useState("");
  const [note, setNote] = useState("");

  const save = () => {
    const name = versionName.trim();
    if (!name) {
      setNote("Give the version a name first — that name is how you call it back.");
      return;
    }
    setVersions(saveConfigVersion(name, settings));
    setNote(`Version "${name}" saved — the full configuration, exactly as it stands now.`);
    setVersionName("");
  };

  const restore = (name: string) => {
    const version = findConfigVersion(name);
    if (!version) return;
    onRestoreAll(version.settings);
    setNote(`Version "${name}" restored — every setting above now matches it, and it sticks like any other setting.`);
  };

  return (
    <FloatingWindow id="anatomy" title="Augi Anatomy — Core Brain & Tuning" onClose={onClose} initialWidth={620} initialHeight={600} accent="#c084fc">
      <div className="window-anatomy">
        <p className="window-anatomy__intro">
          How Augie is built, and every knob that is safe to turn — in one place. Changes save
          through the same settings system as everywhere else: they stick.
        </p>
        <div className="window-anatomy__map">
          {SCHEMA.map((box) => (
            <section key={box.title} className="window-anatomy__box">
              <h3>{box.title}</h3>
              <ul>
                {box.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <h3 className="window-anatomy__head">Tuning — body &amp; senses</h3>
        {SLIDERS.map((slider) => (
          <label key={slider.key} className="window-anatomy__slider">
            <span>
              {slider.label}: <b>{settings[slider.key]}</b>
            </span>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={settings[slider.key]}
              onChange={(event) => onUpdate(slider.key, Number(event.target.value))}
            />
          </label>
        ))}
        <label className="window-anatomy__slider">
          <span>
            Theme: <b>{settings.theme}</b>
          </span>
          <select
            value={settings.theme}
            onChange={(event) => onUpdate("theme", event.target.value as AvatarSettings["theme"])}
          >
            {["cyan", "gold", "violet", "emerald", "crimson", "custom"].map((theme) => (
              <option key={theme} value={theme}>
                {theme}
              </option>
            ))}
          </select>
        </label>

        <h3 className="window-anatomy__head">Versions — lock this configuration</h3>
        <div className="window-anatomy__version-row">
          <input
            value={versionName}
            onChange={(event) => setVersionName(event.target.value)}
            placeholder="Name this version — e.g. Battle Ready"
            aria-label="Version name"
          />
          <button type="button" onClick={save}>
            Save this version
          </button>
        </div>
        {note && <p className="window-anatomy__note">{note}</p>}
        {versions.length === 0 ? (
          <p className="window-anatomy__note">No versions saved yet.</p>
        ) : (
          <ul className="window-anatomy__versions">
            {versions.map((version) => (
              <li key={version.name}>
                <span>
                  <b>{version.name}</b> — {new Date(version.savedAt).toLocaleString()} · bloom{" "}
                  {version.settings.bloom}, particles {version.settings.maxParticles}, theme{" "}
                  {version.settings.theme}
                </span>
                <span className="window-anatomy__version-actions">
                  <button type="button" onClick={() => restore(version.name)}>
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => setVersions(deleteConfigVersion(version.name))}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="window-anatomy__leftout">
          Not in here, on purpose: API keys, Supabase credentials, gate passwords, and the
          Kiwix/Ollama service setup. Those are credentials and infrastructure, not settings —
          exposing them in a tuning panel would weaken the gate for no benefit.
        </p>
      </div>
    </FloatingWindow>
  );
}
