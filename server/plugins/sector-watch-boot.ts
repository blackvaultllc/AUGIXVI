/**
 * SECTOR WATCH BOOT — a Nitro server plugin, auto-registered
 * from server/plugins/ (nitro.config.ts sets the server
 * directory) and run ONCE when the server process starts.
 *
 * The Captain's order (2026-11-26): the watch is ALIVE on the
 * core — the cameras patrol 24/7, Anubis looks whenever he
 * wants, and the Captain does not chase behind the construct.
 * Before this plugin, the watch scheduler only started when a
 * client surface happened to call a sector server function, so
 * every restart (every deploy) left the watch dead until
 * someone opened a window. Now the scheduler starts with the
 * process itself.
 *
 * The boot itself lives in the sector watch runtime
 * (bootSectorWatch): on the core it starts the scheduler; off
 * the core (the Cloudflare surface, where there is no local
 * sector store) it is a no-op, the same way every .server
 * store degrades there. A failure here is caught and never
 * takes the server down — the watch also still starts from
 * any sector server function, exactly as before.
 */
import { definePlugin } from "nitro";
import { bootSectorWatch } from "../../src/avatar/sectorWatchRuntime.server";

export default definePlugin(() => {
  void bootSectorWatch().catch(() => undefined);
});
