# Ghost Protocol One

The phone-side bridge (Part 23). Design, doctrine, OS limits, and
build state: `docs/ghost-protocol-one.md` in this repo.

- `android/` — the companion app project (Kotlin, Android Studio).
  Source complete; not yet compiled (no Android SDK in the build
  environment) — BUILT, NOT YET VERIFIED until it runs on the phone
  and the core logs its first phone sighting.
- Core side (in the main app): `POST /api/devices/phone-sightings`
  with pairing-token authorization; phone reports merge into
  scan-state beside the Parrot watcher's own.

Pairing, on the Parrot:
`openssl rand -hex 16 > ~/.local/share/augie/ghost-token.txt`
then type the same token into the app once.
