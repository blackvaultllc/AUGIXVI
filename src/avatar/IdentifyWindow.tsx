/**
 * THE IDENTIFIER WINDOW (cybernetic pass, 2026-11-26 — the
 * survey's Pokédex row): one cabinet, three real lookups, every
 * answer cross-checked against the device registry first
 * (identify.ts holds the law; this window only reads the
 * records and shows the answers):
 *
 *   · HEARD IT — the last sound Sound Watch classified, from
 *     the shared feed (soundWatchFeed.ts). His named sounds
 *     answer with his name; the rest answer as they stand —
 *     the classifier's label, or UNCLASSIFIED.
 *   · SAW ITS SIGNAL — the latest sighting on the watcher's
 *     scan-state, the same record the Signal Map reads. His
 *     registered signal answers "yours — <name>"; anything
 *     else is UNKNOWN, and no scanner means SCAN UNAVAILABLE.
 *   · REMOTE OR DEVICE — a name typed by the Captain, checked
 *     against the registry first, then the RF/IR library.
 *
 * Nothing here scans, listens, or sends. It reads records and
 * answers — and when a record cannot be read, the card says so
 * instead of borrowing an answer from nowhere.
 */
import { useCallback, useEffect, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import {
  heardAnswer,
  registryDeviceForQuery,
  remoteAnswer,
  signalAnswer,
  type RfMatch,
} from "./identify";
import { loadRegistry } from "./devices/deviceRegistry";
import type { ScanStateView, SightingDetail } from "./devices/wifiWatch";
import { loadSoundLibrary, type SoundLibraryEntry } from "./soundWatch";
import {
  currentSoundFeed,
  subscribeSoundFeed,
  type SoundFeedEntry,
} from "./soundWatchFeed";
import { loadRfIndex, searchBrands, loadRfBrandDevices, type RfIndex } from "./remoteCodes";

function browserStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function IdentifyWindow({ onClose }: { onClose: () => void }) {
  /* Heard it — the feed, live. */
  const [feed, setFeed] = useState<SoundFeedEntry[]>(() => currentSoundFeed());
  useEffect(() => subscribeSoundFeed(setFeed), []);
  const [library] = useState<SoundLibraryEntry[]>(() => loadSoundLibrary(browserStorage()));
  const heard = heardAnswer(feed, library);

  /* Saw its signal — the watcher's scan-state, read on open and
   * on the Captain's Refresh; never a scan of our own. */
  const [sightings, setSightings] = useState<SightingDetail[] | null>(null);
  const [scanReadAt, setScanReadAt] = useState<number | null>(null);
  const loadScan = useCallback(async () => {
    try {
      const res = await fetch("/api/devices/scan-state");
      if (!res.ok) throw new Error(`scan-state ${res.status}`);
      const view = (await res.json()) as ScanStateView & { available?: boolean };
      setSightings(view.available === true ? view.sightings : null);
      setScanReadAt(Date.now());
    } catch {
      setSightings(null);
      setScanReadAt(Date.now());
    }
  }, []);
  useEffect(() => {
    void loadScan();
  }, [loadScan]);
  const signal = signalAnswer(sightings, loadRegistry());

  /* Remote or device — registry first, then the library. */
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<ReturnType<typeof remoteAnswer> | null>(null);
  const [searching, setSearching] = useState(false);
  const runRemoteSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const devices = loadRegistry();
      // Registry first: if his own gear answers, the library is
      // never even consulted (remoteAnswer checks it first too,
      // but asking the library only when needed keeps the card's
      // source honest).
      if (registryDeviceForQuery(devices, q)) {
        setRemote(remoteAnswer(q, devices, []));
        return;
      }
      let matches: RfMatch[] | null = null;
      try {
        const index: RfIndex = await loadRfIndex();
        const brandHits = searchBrands(index, q);
        matches = [];
        for (const hit of brandHits.slice(0, 3)) {
          const shelves = index.brandIndex[hit.brand] ?? [];
          for (const shelf of shelves.slice(0, 2)) {
            const list = await loadRfBrandDevices(shelf.category, hit.brand);
            for (const device of list) {
              if (device.model.toLowerCase().includes(q.toLowerCase())) {
                matches.push({ brand: device.brand, device: device.model });
              }
            }
          }
          if (matches.length === 0) {
            matches.push({
              brand: hit.brand,
              device: "brand in the library — its devices stand in Remote Codes",
            });
          }
          if (matches.length >= 5) break;
        }
        matches = matches.slice(0, 5);
      } catch {
        matches = null;
      }
      setRemote(remoteAnswer(q, devices, matches));
    } finally {
      setSearching(false);
    }
  };

  return (
    <FloatingWindow
      id="identify"
      title="Identify — what is that?"
      onClose={onClose}
      initialWidth={480}
      initialHeight={520}
    >
      <div className="window-identify">
        <p className="window-logs__note">
          Three lookups, one law: your registry answers first, the library second, and anything
          else is UNKNOWN — never a guess. Every card names the record it read.
        </p>

        <section className="window-identify__card" aria-label="Heard it">
          <h3>Heard it</h3>
          <p className="window-identify__headline">{heard.headline}</p>
          <p className="window-logs__note">{heard.detail}</p>
          <p className="window-logs__note">Source: Sound Watch's classification record.</p>
        </section>

        <section className="window-identify__card" aria-label="Saw its signal">
          <h3>Saw its signal</h3>
          <p className="window-identify__headline">{signal.headline}</p>
          <p className="window-logs__note">{signal.detail}</p>
          <p className="window-logs__note">
            Source: the watcher's scan record
            {scanReadAt ? `, read at ${new Date(scanReadAt).toLocaleTimeString()}` : ""}.{" "}
            <button type="button" className="window-btn" onClick={() => void loadScan()}>
              Read it again
            </button>
          </p>
        </section>

        <section className="window-identify__card" aria-label="Remote or device">
          <h3>Remote or device</h3>
          <div className="window-identify__search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runRemoteSearch();
              }}
              placeholder="A brand, a model, a device name…"
              aria-label="Name to identify"
              autoComplete="off"
            />
            <button
              type="button"
              className="window-btn"
              disabled={searching || !query.trim()}
              onClick={() => void runRemoteSearch()}
            >
              {searching ? "Checking…" : "Identify"}
            </button>
          </div>
          {remote && (
            <>
              <p className="window-identify__headline">{remote.headline}</p>
              <p className="window-logs__note">{remote.detail}</p>
              <p className="window-logs__note">
                Source: your device registry, then the RF/IR library.
              </p>
            </>
          )}
        </section>
      </div>
    </FloatingWindow>
  );
}
