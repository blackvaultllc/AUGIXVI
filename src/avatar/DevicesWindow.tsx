/**
 * DEVICES WINDOW — the device-understanding sector (operator order
 * 2026-11-21). Every device Augie meets gets a capability card here:
 * what it can do, what is unknown, and the numbers actually measured.
 *
 * Three ways a device lands in the registry:
 *   1. BLE PROFILER — Web Bluetooth, where the browser offers it. The
 *      operator picks a device; Augie reads the services it exposes
 *      and maps them through the adopted catalog (gattCatalog.ts).
 *   2. MANUAL / PROBE ENTRY — for devices BLE cannot see (a Wi-Fi
 *      otoscope, a classic-Bluetooth headset): id, stream type, and
 *      measured constraints, empty until actually measured.
 *   3. Nothing else. No device, capability, or number is ever invented.
 *
 * Operator-only: renders inside the signed-in stage like every other
 * window. Registry persists in this browser only (deviceRegistry.ts).
 * The BLE hardware path is BUILT, NOT YET VERIFIED on real hardware.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Bluetooth, BluetoothOff, Pencil, Plus, Radar, Trash2 } from "lucide-react";
import { FloatingWindow } from "./windows/FloatingWindow";
import {
  DEVICE_KIND_LABELS,
  PLACEMENT_LABELS,
  TRANSPORT_LABELS,
  loadRegistry,
  newDeviceId,
  removeDevice,
  upsertDevice,
  type DeviceKind,
  type DevicePlacement,
  controlSurface,
  formatControlsText,
  formatPortsText,
  parseControlsText,
  parsePortsText,
  type DeviceProfile,
  type DeviceTransport,
  type MeasuredConstraints,
} from "./devices/deviceRegistry";
import { profileBleDevice, webBluetoothAvailable } from "./devices/bleProfiler";
import {
  HEARTBEAT_CHECK_DIVIDER,
  WAND_GREETING,
  getPresenceWatch,
  notePresenceCheck,
  recordPresenceEvent,
  rssiTrend,
  runPresenceCheck,
  scanWifiEnvironment,
  subscribePresenceWatch,
  watchedSsid,
  type PresenceCheckVia,
  type PresenceWatchState,
} from "./devices/presence";
import { HEARTBEAT_PERIOD_MS } from "./heartbeat";
import type { WatcherView } from "./devices/wifiWatch";

/** What the window knows about the local Wi-Fi watcher (the Parrot's ear). */
type WatcherInfo =
  | { kind: "unknown" }
  | { kind: "none" }
  | { kind: "live"; view: WatcherView };

type BleState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "error"; message: string }
  | { kind: "done"; name: string };

const EMPTY_FORM = {
  displayName: "",
  kind: "other" as DeviceKind,
  transport: "wifi" as DeviceTransport,
  externalId: "",
  ssid: "",
  placement: "" as DevicePlacement | "",
  placementNote: "",
  activationSsid: "",
  beaconRole: false,
  ownerConfirmed: false,
  controlGranted: false,
  lastSeenRssi: "",
  streamType: "",
  streamAddress: "",
  streamFps: "",
  latencyMs: "",
  focalDistanceMm: "",
  focalNotes: "",
  lightingNotes: "",
  address: "",
  protocol: "",
  portsText: "",
  controlsText: "",
  capabilities: "",
  limitations: "",
  notes: "",
};

function parseNumber(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString();
}

function measuredRows(measured: MeasuredConstraints): [string, string][] {
  const rows: [string, string][] = [];
  if (measured.streamType) rows.push(["Stream", measured.streamType]);
  if (measured.streamAddress) rows.push(["Stream address", measured.streamAddress]);
  if (measured.streamFps !== undefined)
    rows.push(["Stream frame rate", `${measured.streamFps} fps`]);
  if (measured.latencyMs !== undefined) rows.push(["Latency", `${measured.latencyMs} ms`]);
  if (measured.focalDistanceMm !== undefined)
    rows.push(["Focal distance", `${measured.focalDistanceMm} mm`]);
  if (measured.focalNotes) rows.push(["Focus notes", measured.focalNotes]);
  if (measured.lightingNotes) rows.push(["Lighting notes", measured.lightingNotes]);
  if (measured.notes) rows.push(["Notes", measured.notes]);
  return rows;
}

export function DevicesWindow({
  onClose,
  onActivated,
}: {
  onClose: () => void;
  onActivated?: (deviceName: string) => void;
}) {
  const [devices, setDevices] = useState<DeviceProfile[]>(loadRegistry);
  const devicesRef = useRef(devices);
  devicesRef.current = devices;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [watcher, setWatcher] = useState<WatcherInfo>({ kind: "unknown" });
  const [ble, setBle] = useState<BleState>({ kind: "idle" });
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [watch, setWatch] = useState<PresenceWatchState>(() => getPresenceWatch());
  const [greetingFor, setGreetingFor] = useState<string | null>(null);
  const [markRssi, setMarkRssi] = useState("");
  const bleAvailable = useMemo(() => webBluetoothAvailable(), []);

  const fireActivation = (device: DeviceProfile) => {
    setGreetingFor(device.displayName);
    onActivated?.(device.displayName);
  };

  /**
   * One Wi-Fi presence check — the manual "Check Wi-Fi signals"
   * button and the check on open both land here, through the same
   * pipeline the stage's heartbeat uses. In this web app the scan is
   * honestly unavailable: the note says so, and NO events are
   * recorded from a scan that never happened.
   */
  const runWifiCheck = async (via: PresenceCheckVia = "manual") => {
    const result = await scanWifiEnvironment();
    if (!result.available) {
      notePresenceCheck(result, via, false);
      setScanNote(
        `Check at ${new Date(result.at).toLocaleTimeString()}: ${result.reason} Presence can still be recorded by hand on a device's card.`,
      );
      return;
    }
    const before = devicesRef.current;
    const { devices: next, activated } = runPresenceCheck(before, result, result.at);
    notePresenceCheck(result, via, JSON.stringify(next) !== JSON.stringify(before));
    setDevices(next);
    setScanNote(
      `Check at ${new Date(result.at).toLocaleTimeString()}: ${result.networks.length} network(s) seen.`,
    );
    for (const device of activated) fireActivation(device);
  };

  // The 15-minute timer is GONE (follow-up order 2026-11-21): while
  // Augie is awake on stage, his HEARTBEAT paces the presence checks
  // (AvatarStage), and this window shows the shared watch state —
  // including checks that ran while the window was closed. One check
  // still runs on open, and the subscription keeps the rhythm line
  // and the registry current when a heartbeat check changes it.
  useEffect(() => {
    void runWifiCheck("open");
    return subscribePresenceWatch(() => {
      const next = getPresenceWatch();
      setWatch(next);
      if (next.lastRegistryChanged) setDevices(loadRegistry());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The local Wi-Fi watcher's real state, from the Augie server this
   * page is served by. On the Parrot build a watcher service sweeps
   * the air with nmcli and reports here; on the hosted build this
   * answers "none" and the honest browser text below stands. Polled
   * while the window is open so the state shown is the state now.
   */
  const refreshWatcher = async () => {
    try {
      const response = await fetch("/api/devices/watchlist", { cache: "no-store" });
      if (!response.ok) {
        setWatcher({ kind: "none" });
        return;
      }
      const data: unknown = await response.json();
      const view =
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>)["watcher"]
          : null;
      if (typeof view === "object" && view !== null) {
        setWatcher({ kind: "live", view: view as WatcherView });
      } else {
        setWatcher({ kind: "none" });
      }
    } catch {
      setWatcher({ kind: "none" });
    }
  };

  useEffect(() => {
    void refreshWatcher();
    const timer = setInterval(() => void refreshWatcher(), 20_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Keep the server's watch-list equal to the registry's activation
   * SSIDs, so the Parrot's watcher sweeps for exactly what Augie has
   * registered — the wand included, by its registered name, never
   * hard-coded. Best-effort: where no local server store exists the
   * sync simply goes nowhere and nothing pretends otherwise.
   */
  useEffect(() => {
    const ssids = [
      ...new Set(
        devices.map((d) => watchedSsid(d)).filter((s): s is string => s !== null),
      ),
    ];
    void fetch("/api/devices/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ssids }),
    }).catch(() => undefined);
  }, [devices]);

  const markPresence = (kind: "appeared" | "disappeared") => {
    if (!selected) return;
    const result = recordPresenceEvent(devicesRef.current, selected.id, {
      kind,
      at: Date.now(),
      rssi: kind === "appeared" ? parseNumber(markRssi) : undefined,
      via: "manual",
    });
    setDevices(result.devices);
    if (result.activated) fireActivation(result.activated);
  };

  const selected = devices.find((d) => d.id === selectedId) ?? devices[0] ?? null;

  const runProfile = async () => {
    setBle({ kind: "working" });
    try {
      const profile = await profileBleDevice();
      // Re-profiling the same physical device refreshes its card
      // instead of piling up duplicates — and the name the operator
      // gave it (e.g. "Magic Wand") sticks; the radio's own name
      // never overwrites his.
      const existing = devices.find(
        (d) => d.transport === "ble" && d.externalId !== "" && d.externalId === profile.externalId,
      );
      const toSave = existing
        ? { ...profile, id: existing.id, displayName: existing.displayName }
        : profile;
      setDevices((current) => upsertDevice(current, toSave));
      setSelectedId(toSave.id);
      setBle({ kind: "done", name: toSave.displayName });
    } catch (error) {
      setBle({
        kind: "error",
        message: error instanceof Error ? error.message : "Bluetooth profiling failed.",
      });
    }
  };

  /** Open the form pre-filled with a device's current values, so a
   *  fix never means delete-and-recreate (operator order 2026-11-21). */
  const startEdit = (device: DeviceProfile) => {
    setForm({
      displayName: device.displayName,
      kind: device.kind,
      transport: device.transport,
      externalId: device.externalId,
      ssid: device.ssid ?? "",
      placement: device.placement ?? "",
      placementNote: device.placementNote ?? "",
      activationSsid: device.activationSsid ?? "",
      beaconRole: device.beaconRole === true,
      ownerConfirmed: device.ownerConfirmed === true,
      controlGranted: device.controlGranted === true,
      lastSeenRssi: device.lastSeenRssi !== undefined ? String(device.lastSeenRssi) : "",
      streamType: device.measured.streamType ?? "",
      streamAddress: device.measured.streamAddress ?? "",
      streamFps: device.measured.streamFps !== undefined ? String(device.measured.streamFps) : "",
      latencyMs: device.measured.latencyMs !== undefined ? String(device.measured.latencyMs) : "",
      focalDistanceMm:
        device.measured.focalDistanceMm !== undefined
          ? String(device.measured.focalDistanceMm)
          : "",
      focalNotes: device.measured.focalNotes ?? "",
      lightingNotes: device.measured.lightingNotes ?? "",
      address: device.address ?? "",
      protocol: device.protocol ?? "",
      portsText: formatPortsText(device.ports),
      controlsText: formatControlsText(device.controls),
      capabilities: device.capabilities.join("\n"),
      limitations: device.limitations.join("\n"),
      notes: device.measured.notes ?? "",
    });
    setEditingId(device.id);
    setSelectedId(device.id);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const submitManual = () => {
    const name = form.displayName.trim();
    if (!name) return;
    const measured: MeasuredConstraints = {};
    const streamType = form.streamType.trim();
    if (streamType) measured.streamType = streamType;
    const streamAddress = form.streamAddress.trim();
    if (streamAddress) measured.streamAddress = streamAddress;
    const fps = parseNumber(form.streamFps);
    if (fps !== undefined) measured.streamFps = fps;
    const latency = parseNumber(form.latencyMs);
    if (latency !== undefined) measured.latencyMs = latency;
    const focal = parseNumber(form.focalDistanceMm);
    if (focal !== undefined) measured.focalDistanceMm = focal;
    if (form.focalNotes.trim()) measured.focalNotes = form.focalNotes.trim();
    if (form.lightingNotes.trim()) measured.lightingNotes = form.lightingNotes.trim();
    if (form.notes.trim()) measured.notes = form.notes.trim();
    const formFields = {
      displayName: name,
      kind: form.kind,
      transport: form.transport,
      externalId: form.externalId.trim(),
      ssid: form.ssid.trim() ? form.ssid.trim() : undefined,
      placement: form.placement ? form.placement : undefined,
      placementNote: form.placementNote.trim() ? form.placementNote.trim() : undefined,
      activationSsid: form.activationSsid.trim() ? form.activationSsid.trim() : undefined,
      beaconRole: form.beaconRole ? (true as const) : undefined,
      ownerConfirmed: form.ownerConfirmed ? (true as const) : undefined,
      controlGranted: form.controlGranted ? (true as const) : undefined,
      lastSeenRssi: parseNumber(form.lastSeenRssi),
      address: form.address.trim() ? form.address.trim() : undefined,
      protocol: form.protocol.trim() ? form.protocol.trim() : undefined,
      ports: parsePortsText(form.portsText),
      controls: parseControlsText(form.controlsText),
      capabilities: form.capabilities
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      limitations: form.limitations
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      measured,
    };
    const now = Date.now();
    const existing = editingId ? devicesRef.current.find((d) => d.id === editingId) : undefined;
    if (existing) {
      // Edit in place: everything the form does not own — presence,
      // its event log, declared services, device info, battery,
      // source, first/last seen — survives untouched. An edit is not
      // a sighting, so lastSeen does not move.
      const profile: DeviceProfile = { ...existing, ...formFields };
      setDevices((current) => upsertDevice(current, profile));
      setSelectedId(existing.id);
    } else {
      const profile: DeviceProfile = {
        id: newDeviceId(),
        ...formFields,
        source: "manual",
        declaredServices: [],
        batteryLevel: null,
        presence: "unknown",
        presenceEvents: [],
        firstSeen: now,
        lastSeen: now,
      };
      setDevices((current) => upsertDevice(current, profile));
      setSelectedId(profile.id);
    }
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const removeSelected = () => {
    if (!selected) return;
    if (editingId === selected.id) cancelEdit();
    setDevices((current) => removeDevice(current, selected.id));
    setSelectedId(null);
  };

  const customServices = selected?.declaredServices.filter((s) => !s.known) ?? [];
  const knownServices = selected?.declaredServices.filter((s) => s.known) ?? [];

  return (
    <FloatingWindow
      id="devices"
      title="Devices — what Augie understands"
      onClose={onClose}
      initialWidth={480}
      initialHeight={440}
    >
      <div className="window-devices">
        <p className="window-devices__intro">
          Every device Augie meets gets a card here: what it can do, what is still unknown, and the
          numbers that were actually measured. Nothing is guessed — a capability appears only when
          the device declares it or you measured it.
        </p>

        {watcher.kind === "live" && watcher.view.active ? (
          <p className="window-devices__watcher" role="status">
            Local Wi-Fi watcher is LIVE — this machine's ear is sweeping the air for the names
            Augie watches:{" "}
            {watcher.view.watchedSsids.length > 0
              ? watcher.view.watchedSsids.join(", ")
              : "none registered yet"}
            . Last scan{" "}
            {watcher.view.lastScanAt
              ? new Date(watcher.view.lastScanAt).toLocaleTimeString()
              : "just now"}
            {watcher.view.tool ? ` via ${watcher.view.tool}` : ""}. When a watched name appears,
            its device flips ACTIVE here on its own — and a wand's appearance wakes Augie with
            the greeting. Checks still ride Augie's heartbeat, about every{" "}
            {Math.round((HEARTBEAT_CHECK_DIVIDER * HEARTBEAT_PERIOD_MS) / 1000)} seconds.
          </p>
        ) : (
          <>
            <p className="window-devices__unavailable" role="status">
              Wi-Fi presence watch is UNAVAILABLE in this web app — browsers cannot scan Wi-Fi
              networks, so Augie cannot watch for a hotspot SSID from here. Checks ride Augie's
              heartbeat while he is on stage — about every{" "}
              {Math.round((HEARTBEAT_CHECK_DIVIDER * HEARTBEAT_PERIOD_MS) / 1000)} seconds — and
              also run on demand, and each one reports this honestly instead of faking a scan.
              The registry holds each device's activation SSID, beacon/wand role, and presence
              log for the local Augie build to watch, and presence can be recorded by hand on a
              device's card.
            </p>
            {watcher.kind === "live" && (
              <p className="window-devices__watcher window-devices__watcher--quiet" role="status">
                A local Wi-Fi watcher exists on this machine but is not reporting — last scan{" "}
                {watcher.view.lastScanAt
                  ? new Date(watcher.view.lastScanAt).toLocaleString()
                  : "never"}
                . Until it wakes, presence checks record nothing.
              </p>
            )}
          </>
        )}
        <p className="window-devices__heartbeat" role="status">
          Presence check rides Augie's heartbeat —{" "}
          {watch.lastCheckAt
            ? `last check ${new Date(watch.lastCheckAt).toLocaleTimeString()}`
            : "no check yet this session"}
          {watch.lastCheckVia ? ` (via ${watch.lastCheckVia})` : ""}.
        </p>
        <div className="window-devices__actions">
          <button type="button" className="window-btn" onClick={() => void runWifiCheck()}>
            <Radar aria-hidden="true" /> Check Wi-Fi signals
          </button>
          {scanNote && (
            <span className="window-hint" role="status">
              {scanNote}
            </span>
          )}
        </div>
        {greetingFor && (
          <p className="window-devices__greeting" role="status">
            {greetingFor} appeared — Augie is active. “{WAND_GREETING}”
          </p>
        )}

        <div className="window-devices__actions">
          {bleAvailable ? (
            <button
              type="button"
              className="window-btn"
              onClick={() => void runProfile()}
              disabled={ble.kind === "working"}
            >
              <Bluetooth aria-hidden="true" />{" "}
              {ble.kind === "working" ? "Profiling…" : "Profile a Bluetooth device"}
            </button>
          ) : (
            <p className="window-devices__unavailable" role="status">
              <BluetoothOff aria-hidden="true" /> Bluetooth profiling is UNAVAILABLE in this browser
              — Web Bluetooth needs Chrome or Edge on a computer or Android. Nothing was scanned,
              and no device was guessed at. You can still register a device by hand below.
            </p>
          )}
          <button
            type="button"
            className="window-btn"
            onClick={() => {
              if (!showForm) {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }
              setShowForm((v) => !v);
            }}
          >
            <Plus aria-hidden="true" /> Register a device by hand
          </button>
        </div>
        {ble.kind === "error" && (
          <p className="window-devices__error" role="alert">
            {ble.message}
          </p>
        )}
        {ble.kind === "done" && (
          <p className="window-devices__done" role="status">
            Profiled {ble.name} — its card is below.
          </p>
        )}

        {showForm && (
          <form
            className="window-devices__form"
            onSubmit={(e) => {
              e.preventDefault();
              submitManual();
            }}
          >
            <h3 className="window-devices__formtitle">
              {editingId ? "Edit device" : "Register a device by hand"}
            </h3>
            <label>
              Device name
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="e.g. Wi-Fi otoscope"
                required
              />
            </label>
            <label>
              Kind
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as DeviceKind })}
              >
                {(Object.keys(DEVICE_KIND_LABELS) as DeviceKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {DEVICE_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Transport
              <select
                value={form.transport}
                onChange={(e) => setForm({ ...form, transport: e.target.value as DeviceTransport })}
              >
                {(Object.keys(TRANSPORT_LABELS) as DeviceTransport[]).map((t) => (
                  <option key={t} value={t}>
                    {TRANSPORT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Device ID (serial / MAC)
              <input
                value={form.externalId}
                onChange={(e) => setForm({ ...form, externalId: e.target.value })}
                placeholder="Only if you know it"
              />
            </label>
            <label>
              Placement / role
              <select
                value={form.placement}
                onChange={(e) =>
                  setForm({ ...form, placement: e.target.value as DevicePlacement | "" })
                }
              >
                <option value="">Not set</option>
                {(Object.keys(PLACEMENT_LABELS) as DevicePlacement[]).map((p) => (
                  <option key={p} value={p}>
                    {PLACEMENT_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Role detail
              <input
                value={form.placementNote}
                onChange={(e) => setForm({ ...form, placementNote: e.target.value })}
                placeholder="e.g. forward eye · voice in my ear"
              />
            </label>
            <label>
              Activation SSID (Wi-Fi presence)
              <input
                value={form.activationSsid}
                onChange={(e) => setForm({ ...form, activationSsid: e.target.value })}
                placeholder="The SSID Augie watches for — blank = same as its SSID"
              />
            </label>
            <label>
              Signal at last sighting (dBm)
              <input
                value={form.lastSeenRssi}
                onChange={(e) => setForm({ ...form, lastSeenRssi: e.target.value })}
                inputMode="numeric"
                placeholder="e.g. -52 — empty until recorded"
              />
            </label>
            <label className="window-devices__check">
              <input
                type="checkbox"
                checked={form.beaconRole}
                onChange={(e) => setForm({ ...form, beaconRole: e.target.checked })}
              />
              Beacon / wand role — this device's presence activates Augie
            </label>
            <label className="window-devices__check">
              <input
                type="checkbox"
                checked={form.ownerConfirmed}
                onChange={(e) => setForm({ ...form, ownerConfirmed: e.target.checked })}
              />
              Owner-confirmed — this device is mine (the Permission Law: mapping is free, this
              confirms ownership)
            </label>
            <label className="window-devices__check">
              <input
                type="checkbox"
                checked={form.controlGranted}
                onChange={(e) => setForm({ ...form, controlGranted: e.target.checked })}
              />
              Control granted — Osiris may CONTROL this device (off by default; only I grant
              this, per device)
            </label>
            <label>
              Wi-Fi SSID (hotspot devices)
              <input
                value={form.ssid}
                onChange={(e) => setForm({ ...form, ssid: e.target.value })}
                placeholder="e.g. SOFTISH-1851 — the name it broadcasts"
              />
            </label>
            <label>
              Stream type (cameras)
              <input
                value={form.streamType}
                onChange={(e) => setForm({ ...form, streamType: e.target.value })}
                placeholder="e.g. MJPEG over its own Wi-Fi hotspot"
              />
            </label>
            <label>
              Stream address (measured)
              <input
                value={form.streamAddress}
                onChange={(e) => setForm({ ...form, streamAddress: e.target.value })}
                placeholder="Empty until measured on its network"
              />
            </label>
            <label>
              Stream fps (measured)
              <input
                value={form.streamFps}
                onChange={(e) => setForm({ ...form, streamFps: e.target.value })}
                inputMode="decimal"
                placeholder="Empty until measured"
              />
            </label>
            <label>
              Latency ms (measured)
              <input
                value={form.latencyMs}
                onChange={(e) => setForm({ ...form, latencyMs: e.target.value })}
                inputMode="decimal"
                placeholder="Empty until measured"
              />
            </label>
            <label>
              Focal distance mm (measured)
              <input
                value={form.focalDistanceMm}
                onChange={(e) => setForm({ ...form, focalDistanceMm: e.target.value })}
                inputMode="decimal"
                placeholder="Empty until measured"
              />
            </label>
            <label>
              Focus notes
              <input
                value={form.focalNotes}
                onChange={(e) => setForm({ ...form, focalNotes: e.target.value })}
              />
            </label>
            <label>
              Lighting notes
              <input
                value={form.lightingNotes}
                onChange={(e) => setForm({ ...form, lightingNotes: e.target.value })}
              />
            </label>
            <label>
              Address (as mapped — IP, MAC, or host)
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="empty until mapped"
              />
            </label>
            <label>
              Protocol (as mapped)
              <input
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                placeholder="e.g. UDP app protocol · BLE GATT · 2.4 GHz proprietary RF"
              />
            </label>
            <label>
              Open ports (one per line: port | tcp/udp | what answers)
              <textarea
                value={form.portsText}
                onChange={(e) => setForm({ ...form, portsText: e.target.value })}
                rows={2}
                placeholder={"7099 | udp | app control"}
              />
            </label>
            <label>
              Control map (one per line: name | kind | how it's invoked — add
              "| verified" ONLY when the bench proved the device obeys)
              <textarea
                value={form.controlsText}
                onChange={(e) => setForm({ ...form, controlsText: e.target.value })}
                rows={3}
                placeholder={"Take off | command | UDP packet to the drone hotspot"}
              />
            </label>
            <label>
              Capabilities (one per line — only what you verified)
              <textarea
                value={form.capabilities}
                onChange={(e) => setForm({ ...form, capabilities: e.target.value })}
                rows={3}
              />
            </label>
            <label>
              Limitations / unknowns (one per line)
              <textarea
                value={form.limitations}
                onChange={(e) => setForm({ ...form, limitations: e.target.value })}
                rows={2}
              />
            </label>
            <label>
              Notes
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <div className="window-devices__formactions">
              <button type="submit" className="window-btn">
                {editingId ? "Save changes" : "Save device"}
              </button>
              {editingId && (
                <button type="button" className="window-btn" onClick={cancelEdit}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        )}

        <div className="window-devices__body">
          <div className="window-devices__list">
            <h3>Registered devices</h3>
            {devices.length === 0 ? (
              <p className="window-hint">
                No devices registered yet. Profile a Bluetooth device or register one by hand — the
                cube module, the otoscope, a watch, a headset.
              </p>
            ) : (
              <ul>
                {devices.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={selected?.id === d.id ? "is-active" : undefined}
                      onClick={() => setSelectedId(d.id)}
                    >
                      {d.displayName}
                      <span>
                        {DEVICE_KIND_LABELS[d.kind]} · {TRANSPORT_LABELS[d.transport]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && (
            <article
              className="window-devices__card"
              aria-label={`Capability report for ${selected.displayName}`}
            >
              <header>
                <h3>{selected.displayName}</h3>
                <div className="window-devices__cardactions">
                  <button
                    type="button"
                    className="window-btn"
                    onClick={() => startEdit(selected)}
                  >
                    <Pencil aria-hidden="true" /> Edit
                  </button>
                  <button type="button" className="window-btn" onClick={removeSelected}>
                    <Trash2 aria-hidden="true" /> Remove
                  </button>
                </div>
              </header>
              <p className="window-devices__meta">
                {DEVICE_KIND_LABELS[selected.kind]} · {TRANSPORT_LABELS[selected.transport]}
                {selected.externalId ? ` · ID: ${selected.externalId}` : " · ID: not recorded"}
              </p>
              {selected.ssid && (
                <p className="window-devices__meta">
                  Broadcasts Wi-Fi SSID: {selected.ssid} — seeing this exact SSID means this exact
                  device is here.
                </p>
              )}
              {selected.placement && (
                <p className="window-devices__meta">
                  Placement / role: {PLACEMENT_LABELS[selected.placement]}
                  {selected.placementNote ? ` — ${selected.placementNote}` : ""}
                </p>
              )}
              {(selected.activationSsid ?? selected.ssid) && (
                <p className="window-devices__meta">
                  Activation SSID: {selected.activationSsid ?? selected.ssid} — when this SSID
                  appears, this device is present and on; when it vanishes, it is off or gone.
                </p>
              )}
              {selected.beaconRole && (
                <p className="window-devices__meta">
                  Beacon / wand role: this device's presence activates Augie.
                </p>
              )}
              <p className="window-devices__meta">
                Permission Law: {selected.ownerConfirmed ? "owner-confirmed" : "not owner-confirmed"}{" "}
                · control {selected.controlGranted ? "GRANTED by the operator" : "not granted — observation only"}.
              </p>
              {(selected.address || selected.protocol || selected.ports) && (
                <p className="window-devices__meta">
                  Fingerprint: {selected.address ? `address ${selected.address}` : "no address mapped"}
                  {selected.protocol ? ` · protocol ${selected.protocol}` : ""}
                  {selected.ports
                    ? ` · ports ${selected.ports
                        .map((pt) => `${pt.port}${pt.protocol ? `/${pt.protocol}` : ""}${pt.service ? ` (${pt.service})` : ""}`)
                        .join(", ")}`
                    : ""}
                </p>
              )}
              {(() => {
                const surface = controlSurface(selected);
                if (surface.state === "not-granted") {
                  return surface.mapped.length ? (
                    <div className="window-devices__meta">
                      Control map — recorded for mapping only. Control is not granted for this
                      device, so no control actions are offered.
                      <ul>
                        {surface.mapped.map((c) => (
                          <li key={c.id}>
                            {c.label} ({c.kind}) — {c.detail}
                            {c.verified ? " · bench-verified" : " · mapped, unproven"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="window-devices__meta">
                      Control map: nothing mapped yet — no control surface is claimed for this
                      device.
                    </p>
                  );
                }
                return (
                  <div className="window-devices__meta">
                    Control GRANTED by the operator.
                    {surface.usable.length > 0 && (
                      <>
                        {" "}Osiris may use:
                        <ul>
                          {surface.usable.map((c) => (
                            <li key={c.id}>
                              {c.label} ({c.kind}) — {c.detail}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {surface.usable.length === 0 && " No verified actions yet — the map holds nothing proven to drive."}
                    {surface.unproven.length > 0 && (
                      <>
                        {" "}Mapped but not yet proven (not usable):
                        <ul>
                          {surface.unproven.map((c) => (
                            <li key={c.id}>
                              {c.label} ({c.kind}) — {c.detail}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                );
              })()}
              {selected.lastSeenRssi !== undefined && (
                <p className="window-devices__meta">
                  Signal at last sighting: {selected.lastSeenRssi} dBm.
                </p>
              )}

              <section>
                <h4>Presence</h4>
                <p className="window-devices__facts">
                  Status:{" "}
                  {selected.presence === "active"
                    ? "ACTIVE — present and on"
                    : selected.presence === "gone"
                      ? "GONE — off or out of range"
                      : "Unknown — no sighting recorded yet"}
                </p>
                {selected.lastSeenRssi !== undefined && (
                  <p className="window-devices__facts">
                    Last signal: {selected.lastSeenRssi} dBm · trend: {rssiTrend(selected)}. Signal
                    strength reads as proximity and, on this hardware, battery fade — it is shown as
                    strength and trend only, never as a distance or a battery percentage.
                  </p>
                )}
                {selected.presenceEvents.length > 0 && (
                  <ul className="window-devices__facts">
                    {[...selected.presenceEvents]
                      .slice(-5)
                      .reverse()
                      .map((event, i) => (
                        <li key={`${event.at}-${i}`}>
                          {event.kind === "appeared" ? "Appeared" : "Disappeared"} ·{" "}
                          {formatWhen(event.at)}
                          {event.rssi !== undefined ? ` · ${event.rssi} dBm` : ""} · recorded{" "}
                          {event.via === "scan" ? "by a scan" : "by hand"}
                        </li>
                      ))}
                  </ul>
                )}
                {watchedSsid(selected) && (
                  <div className="window-devices__actions">
                    <input
                      className="window-devices__rssi"
                      value={markRssi}
                      onChange={(e) => setMarkRssi(e.target.value)}
                      inputMode="numeric"
                      placeholder="Signal dBm (optional)"
                      aria-label="Signal strength for this sighting in dBm"
                    />
                    <button
                      type="button"
                      className="window-btn"
                      onClick={() => markPresence("appeared")}
                    >
                      Mark present
                    </button>
                    <button
                      type="button"
                      className="window-btn"
                      onClick={() => markPresence("disappeared")}
                    >
                      Mark gone
                    </button>
                  </div>
                )}
              </section>
              <p className="window-devices__meta">
                {selected.source === "ble-profile"
                  ? "Profiled over Bluetooth"
                  : "Registered by hand"}{" "}
                · first seen {formatWhen(selected.firstSeen)} · last seen{" "}
                {formatWhen(selected.lastSeen)}
              </p>

              {selected.deviceInfo && (
                <section>
                  <h4>Device information</h4>
                  <ul className="window-devices__facts">
                    {selected.deviceInfo.manufacturer && (
                      <li>Manufacturer: {selected.deviceInfo.manufacturer}</li>
                    )}
                    {selected.deviceInfo.model && <li>Model: {selected.deviceInfo.model}</li>}
                    {selected.deviceInfo.firmware && (
                      <li>Firmware: {selected.deviceInfo.firmware}</li>
                    )}
                    {selected.deviceInfo.hardware && (
                      <li>Hardware: {selected.deviceInfo.hardware}</li>
                    )}
                    {selected.deviceInfo.software && (
                      <li>Software: {selected.deviceInfo.software}</li>
                    )}
                  </ul>
                </section>
              )}
              {selected.batteryLevel !== null && (
                <p className="window-devices__facts">
                  Battery reported by the device: {selected.batteryLevel}%
                </p>
              )}

              <section>
                <h4>What it can do</h4>
                {selected.capabilities.length ? (
                  <ul className="window-devices__facts">
                    {selected.capabilities.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="window-hint">
                    No capabilities established yet — nothing has been declared or measured.
                  </p>
                )}
              </section>

              {(knownServices.length > 0 || customServices.length > 0) && (
                <section>
                  <h4>Services it declared</h4>
                  <ul className="window-devices__facts">
                    {knownServices.map((s) => (
                      <li key={s.uuid}>
                        {s.name} <span className="window-devices__uuid">({s.uuid})</span>
                      </li>
                    ))}
                    {customServices.map((s) => (
                      <li key={s.uuid}>
                        Custom service — capabilities need mapping{" "}
                        <span className="window-devices__uuid">({s.uuid})</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h4>What it cannot do / what is unknown</h4>
                {selected.limitations.length || customServices.length ? (
                  <ul className="window-devices__facts">
                    {selected.limitations.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                    {customServices.length > 0 &&
                      !selected.limitations.some((l) => l.includes("custom service")) && (
                        <li>
                          {customServices.length} custom service
                          {customServices.length === 1 ? "" : "s"} — capabilities need mapping.
                        </li>
                      )}
                  </ul>
                ) : (
                  <p className="window-hint">
                    No known limits recorded. Anything not listed above is unmeasured, not
                    impossible.
                  </p>
                )}
              </section>

              <section>
                <h4>Measured numbers</h4>
                {measuredRows(selected.measured).length ? (
                  <ul className="window-devices__facts">
                    {measuredRows(selected.measured).map(([label, value]) => (
                      <li key={label}>
                        {label}: {value}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="window-hint">
                    Nothing measured yet — no numbers are claimed for this device.
                  </p>
                )}
              </section>
            </article>
          )}
        </div>
      </div>
    </FloatingWindow>
  );
}
