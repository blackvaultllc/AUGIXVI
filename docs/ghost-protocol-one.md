# Ghost Protocol One — the phone-side bridge (Part 23)

Operator order 2026-11-21: *"I don't give a damn about what a browser
can do."* The phone path is their OWN APP — installed and embedded on
the phone, holding the permissions the phone allows, talking straight
to the phone's radios and health store, and tunneling what it sees to
the Augie core on the Parrot. The browser is passive and irrelevant
to this design.

## What it is

An Android companion app (`ghost-protocol-one/android/`) that turns
the owner's phone into Augie's second set of senses:

1. **Wi-Fi watch** — scans the air (with the location permission
   Android requires for scans) and reports watched SSIDs — above all
   the wand's hotspot **SOFTISH-1851** — up/down + signal strength to
   the core. When the wand activates within the phone's reach, the
   core knows within one scan cycle, exactly like the Parrot's own
   watcher: signal up = summons (the Batman-signal doctrine).
2. **Bluetooth** — scans for BLE advertisements (device names are the
   identity; BLE MACs are often randomized) for the device line:
   wand-class devices, the watch, future cube nodes.
3. **Watch vitals** — reads the phone's health store (Health Connect)
   for what the watch's app writes there: heart rate, blood pressure,
   oxygen saturation. This is the pipe Part 20's watch source in
   Pulse is waiting on. Nothing is displayed anywhere until a real
   reading has actually flowed through it.

## How it reaches the core

- The app POSTs the same watcher payload the Parrot's nmcli watcher
  uses — `{ at, networks: [{ ssid, rssi }] }` — to
  **`POST /api/devices/phone-sightings`** on the core
  (`http://100.67.177.55:8081` on the tailnet, or the LAN address).
- That door is deliberately narrower than the watcher's own:
  - source IP must be a private LAN or tailnet (100.64.0.0/10)
    address — the public internet cannot report sightings;
  - the request must carry the **pairing token** in the
    `x-ghost-token` header. The operator creates it once on the
    Parrot (`openssl rand -hex 16 > ~/.local/share/augie/ghost-token.txt`)
    and types it into the app once.
- Phone reports land in a **separate store slot** and merge into
  `/api/devices/scan-state` next to the Parrot watcher's own report —
  the phone can extend Augie's ears, never rewrite what the Parrot's
  own radio saw. Each report expires on the same 75-second grace
  window: disappearance is a conclusion, not a flicker.
- Local-first, always: data flows phone → the owner's own core over
  the owner's own network. No third-party servers, no analytics, no
  accounts.

## OS limits — stated plainly (Android binds where it binds)

- **Wi-Fi scan throttling:** Android allows a foreground app **4
  scans per 2 minutes**; background scans are far more restricted
  (and on many builds effectively once per ~30 minutes). The app
  scans on a 30-second cadence in the foreground and degrades
  honestly: the core judges presence by report age, so a throttled
  phone widens the detection window — it never fakes freshness.
- **Location permission** is required for Wi-Fi scan results on
  modern Android. Without it, scans return empty and the app says so.
- **Joining the wand's hotspot** from the app uses
  `WifiNetworkSpecifier`, which shows a **system approval dialog the
  user must tap** (Android 10+). The app can ask; it cannot silently
  join. Detection needs no join — only the camera feed would.
- **BLE scanning** needs `BLUETOOTH_SCAN` (Android 12+) or location
  permission on older versions. `neverForLocation` is declared: the
  app does not derive location from beacons.
- **Health Connect** reads require per-data-type permissions the
  user grants in the Health Connect UI. **The open question is the
  watch, not the API:** whether the Da Fit app writes blood pressure /
  stress / oxygen into Health Connect at all is unproven — many
  budget watch apps keep data in their own silo. If it doesn't write,
  this path reads nothing and Pulse's watch source stays UNAVAILABLE
  until a pipe that works is found (e.g., the watch's Bluetooth link
  itself). "Stress" is not a Health Connect record type; if the
  watch app exposes it, it arrives as its own field or not at all.

## Build state — honest

- **Core side: BUILT and tested** (this repo): the phone-sightings
  door, pairing authorization, the merged scan-state, and unit tests
  (`src/test/ghost-protocol.test.ts`).
- **Android app: SOURCE COMPLETE, NOT YET COMPILED.** The build
  environment for this queue has no Android SDK/Gradle, so the APK
  has never been built or run. The project in
  `ghost-protocol-one/android/` is a standard Android Studio project
  (Kotlin, min SDK 29, Health Connect client library); open it,
  build it, install it on the phone, pair it with the token, and the
  first real phone sighting is the verification. Until then this part
  is BUILT, NOT YET VERIFIED.
