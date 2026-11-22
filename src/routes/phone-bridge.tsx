import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RoomGate } from "@/avatar/RoomGate";
import { getOperatorAccessToken } from "@/avatar/trustedDevice";
import {
  HEART_RATE_MEASUREMENT,
  HEART_RATE_SERVICE,
  parseHeartRateMeasurement,
  type WatchReading,
} from "@/avatar/watchBle";
import { listWatchReadings, saveWatchReading } from "@/avatar/watchVitals.server";

/**
 * GHOST PROTOCOL ONE — the phone bridge (Part 23, with Part 20 as
 * amended). Open Augie ON THE PHONE and this page is the port Augie
 * gets on the device: the watch's heart rate over the standard BLE
 * service where the watch exposes it, with the honest map of what
 * the phone's software allows and what needs the native companion.
 * Local-first: readings go to HIS Augie core (this server), never to
 * third parties.
 */
export const Route = createFileRoute("/phone-bridge")({
  component: PhoneBridgePage,
});

type BleState =
  | { status: "idle" }
  | { status: "unsupported"; reason: string }
  | { status: "connecting" }
  | { status: "connected"; deviceName: string }
  | { status: "error"; reason: string };

function PhoneBridgePage() {
  const [ble, setBle] = useState<BleState>({ status: "idle" });
  const [bpm, setBpm] = useState<number | null>(null);
  const [saved, setSaved] = useState<WatchReading[]>([]);
  const deviceRef = useRef<{ gatt?: { disconnect: () => void } } | null>(null);

  useEffect(() => {
    void (async () => {
      const token = await getOperatorAccessToken();
      if (!token) return;
      const result = await listWatchReadings({ data: { accessToken: token } });
      if (result.authorized) setSaved(result.readings);
    })();
    return () => deviceRef.current?.gatt?.disconnect();
  }, []);

  const connectWatch = async () => {
    const nav = navigator as Navigator & {
      bluetooth?: {
        requestDevice: (options: unknown) => Promise<{
          name?: string;
          gatt?: {
            connect: () => Promise<{
              getPrimaryService: (service: string) => Promise<{
                getCharacteristic: (characteristic: string) => Promise<{
                  startNotifications: () => Promise<unknown>;
                  addEventListener: (type: string, listener: (event: Event) => void) => void;
                }>;
              }>;
            }>;
            disconnect: () => void;
          };
        }>;
      };
    };
    if (!nav.bluetooth) {
      setBle({
        status: "unsupported",
        reason:
          "This browser has no Web Bluetooth (iOS Safari and Firefox don't ship it; Chrome on Android does). On this phone, the watch's data path is the Da Fit app — and the native Ghost Protocol companion (below) reading Health Connect. Nothing is being read right now, and no number will be shown that didn't come from the watch.",
      });
      return;
    }
    setBle({ status: "connecting" });
    try {
      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: [HEART_RATE_SERVICE] }],
      });
      deviceRef.current = device as never;
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(HEART_RATE_SERVICE);
      const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", (event) => {
        const value = (event.target as unknown as { value?: DataView }).value;
        if (!value) return;
        const reading = parseHeartRateMeasurement(value);
        if (reading === null) return;
        setBpm(reading);
        void (async () => {
          const token = await getOperatorAccessToken();
          if (!token) return;
          const entry: WatchReading = { at: Date.now(), bpm: reading, source: "ble-heart-rate-service" };
          const result = await saveWatchReading({ data: { accessToken: token, reading: entry } });
          if (result.saved) setSaved((prev) => [entry, ...prev].slice(0, 60));
        })();
      });
      setBle({ status: "connected", deviceName: device.name ?? "watch" });
    } catch (err) {
      setBle({
        status: "error",
        reason: `The watch did not connect over the standard heart-rate service (${err instanceof Error ? err.message : "cancelled"}). Many Da Fit watches keep their data inside the Da Fit app instead of exposing this service — if yours is one of those, the working path is the native companion reading Health Connect (below), not this button. No reading was faked in the meantime.`,
      });
    }
  };

  return (
    <RoomGate roomName="Ghost Protocol One — Phone Bridge">
      <main className="phone-bridge">
        <h1>Ghost Protocol One — Phone Bridge</h1>
        <p>
          The watch stays paired to this phone. Augie, opened on the phone, takes its sensing
          from here — with your authorization — and sends it to your Augie core over your own
          network. The watch is the primary vitals path; the camera is presence/backup.
        </p>

        <section>
          <h2>The watch — heart rate</h2>
          {ble.status === "connected" ? (
            <p role="status">
              Connected to {ble.status === "connected" ? ble.deviceName : "watch"} over the
              standard BLE heart-rate service.
            </p>
          ) : ble.status === "connecting" ? (
            <p role="status">Connecting — pick your watch in the Bluetooth prompt…</p>
          ) : ble.status === "unsupported" || ble.status === "error" ? (
            <p role="alert">{ble.reason}</p>
          ) : (
            <p>
              Not connected. The button tries the standard BLE heart-rate service (0x180D)
              directly — the honest first path.
            </p>
          )}
          <button type="button" onClick={() => void connectWatch()}>
            Connect the watch (Bluetooth)
          </button>
          <p className="phone-bridge__bpm" aria-live="polite">
            {bpm !== null ? (
              <>
                Heart rate (from the watch): <b>{bpm} BPM</b>
              </>
            ) : (
              "No watch reading yet — this line only ever shows a number the watch actually sent."
            )}
          </p>
          {saved.length > 0 && (
            <>
              <h3>Saved readings (local, in your data core)</h3>
              <ul>
                {saved.slice(0, 10).map((reading, i) => (
                  <li key={i}>
                    {new Date(reading.at).toLocaleString()} — {reading.bpm} BPM ·{" "}
                    {reading.source}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          <h2>What this phone&apos;s software allows — honestly</h2>
          <ul>
            <li>
              <b>Web Bluetooth (this page):</b> standard BLE services only, Chrome/Android.
              Works for the watch IF it exposes the heart-rate service, and for the wand if it
              ever speaks standard BLE.
            </li>
            <li>
              <b>Da Fit:</b> the watch&apos;s rich data lives in the Da Fit app. What Da Fit
              syncs into Health Connect depends on the model and app version — heart rate may
              or may not land there. This page cannot read Da Fit&apos;s private store, and
              will not pretend to.
            </li>
            <li>
              <b>Health Connect:</b> Android&apos;s health store is readable by NATIVE apps
              with your permission — not by web pages. That is the native companion&apos;s
              job (below).
            </li>
            <li>
              <b>Background listening (Part 12&apos;s phone endpoint):</b> the web cannot
              record from the background or with the screen off; a native foreground service
              with a visible notification can — with your authorization, and it must say so
              on screen while it runs.
            </li>
          </ul>
        </section>

        <section>
          <h2>The native companion — designed, not yet built</h2>
          <p>
            Ghost Protocol One as a downloadable Android app: a thin native shell you install
            on your phone that (1) reads Health Connect heart-rate with your permission, (2)
            scans/connects BLE devices (watch, wand) the web can&apos;t reach, (3) hosts the
            listening mode&apos;s phone endpoint as a foreground service with a permanent
            visible indicator, and (4) posts everything ONLY to your Augie core (Parrot, over
            your LAN/Tailscale) — never to third parties. If Android forbids something, the
            app says so in plain words instead of pretending. Building and signing that APK
            is a separate step beyond this web build; this page is the deepest working
            version the web platform allows today.
          </p>
        </section>
      </main>
    </RoomGate>
  );
}
