#!/usr/bin/env node
/**
 * AUGIE WI-FI WATCHER — the Parrot's ear (operator order 2026-11-21).
 *
 * Domenick's order: when he turns the Magic Wand on, Augie notices
 * BY ITSELF. Browsers cannot scan Wi-Fi, but this machine can —
 * Linux scans natively. This watcher is the local ear:
 *
 *   1. Every cycle it reads the watch-list from the local Augie
 *      server (GET /api/devices/watchlist) — the SSIDs the Devices
 *      window synced from Augie's registry. Nothing is hard-coded:
 *      no registry entry, no watching.
 *   2. It sweeps the air with nmcli (the Parrot has no iw/wpa_cli;
 *      NetworkManager is the radio's keeper here).
 *   3. Sightings of watched names are reported back to the server
 *      (POST /api/devices/sightings, loopback only). The server's
 *      scan-state feeds the client's presence pipeline, which flips
 *      devices ACTIVE/GONE via scan and fires the wand greeting.
 *
 * Two honest conversions live here, both documented rather than
 * hidden:
 *   - SSID matching is case-insensitive, and sightings are reported
 *     under the REGISTERED spelling. SSIDs are case-sensitive on
 *     air, but the registered name reached the registry by voice
 *     dictation ("SOFTISH-1851") while the wand broadcasts
 *     "softish-1851" — same physical device, and the watcher says
 *     which name it matched by reporting the registered one.
 *   - nmcli reports signal as a percentage, not dBm. The estimate
 *     uses the standard conversion dBm ≈ percent/2 − 100 (100% →
 *     −50 dBm, 0% → −100 dBm). It is an estimate — good enough for
 *     the proximity/battery-fade trend the card displays, never
 *     presented as a survey measurement.
 *
 * If a scan fails, nothing is reported: the server's watcher state
 * goes stale and the Devices window says so. Silence is honest;
 * a faked sighting would not be.
 */
import { execFile } from "node:child_process";

const SERVER = process.env["AUGIE_SERVER"] ?? "http://127.0.0.1:8081";
const INTERVAL_MS = Number(process.env["WATCH_INTERVAL_MS"] ?? 20_000);
const TOOL = "nmcli";

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function percentToDbm(percent) {
  return Math.round(percent / 2 - 100);
}

async function fetchJson(path, init) {
  const response = await fetch(`${SERVER}${path}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response.json();
}

async function getWatchlist() {
  const data = await fetchJson("/api/devices/watchlist");
  const ssids = Array.isArray(data?.ssids) ? data.ssids.filter((s) => typeof s === "string") : [];
  return ssids;
}

function scanAir() {
  return new Promise((resolve, reject) => {
    execFile(
      "nmcli",
      ["-t", "-f", "SSID,SIGNAL", "dev", "wifi", "list", "--rescan", "yes"],
      { timeout: 45_000, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      },
    );
  });
}

/** Parse nmcli -t output: SSID:SIGNAL per line, ':' escaped as '\:'. */
function parseScan(stdout) {
  const found = new Map();
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const unescaped = line.replace(/\\:/g, "\u0001");
    const cut = unescaped.lastIndexOf(":");
    if (cut < 0) continue;
    const ssid = unescaped.slice(0, cut).replace(/\u0001/g, ":");
    const percent = Number(unescaped.slice(cut + 1));
    if (!ssid || !Number.isFinite(percent)) continue;
    const prev = found.get(ssid);
    if (prev === undefined || percent > prev) found.set(ssid, percent);
  }
  return found;
}

async function cycle() {
  let watchlist;
  try {
    watchlist = await getWatchlist();
  } catch (error) {
    log(`watch-list unavailable (${error.message}) — standing by`);
    return;
  }
  if (watchlist.length === 0) {
    log("watch-list empty — nothing registered to watch for");
    // Still report an empty scan so the window can show the watcher
    // alive; an empty report claims no sightings, which is true.
    try {
      await fetchJson("/api/devices/sightings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ at: Date.now(), tool: TOOL, networks: [] }),
      });
    } catch {
      /* server down; next cycle retries */
    }
    return;
  }
  let stdout;
  try {
    stdout = await scanAir();
  } catch (error) {
    log(`scan FAILED (${error.message}) — reporting nothing`);
    return;
  }
  const found = parseScan(stdout);
  const networks = [];
  for (const wanted of watchlist) {
    for (const [ssid, percent] of found) {
      if (ssid.toLowerCase() === wanted.toLowerCase()) {
        networks.push({ ssid: wanted, rssi: percentToDbm(percent) });
      }
    }
  }
  try {
    await fetchJson("/api/devices/sightings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ at: Date.now(), tool: TOOL, networks }),
    });
    log(
      networks.length
        ? `saw ${networks.map((n) => `${n.ssid} @ ${n.rssi} dBm (est.)`).join(", ")}`
        : `swept — none of [${watchlist.join(", ")}] on the air`,
    );
  } catch (error) {
    log(`sighting report failed (${error.message})`);
  }
}

log(`augie wifi watcher up — server ${SERVER}, every ${INTERVAL_MS / 1000}s, tool ${TOOL}`);
for (;;) {
  await cycle();
  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
}
