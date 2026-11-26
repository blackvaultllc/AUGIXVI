import { defineConfig } from "nitro";

/**
 * The server directory holds exactly one thing: the Nitro
 * server plugins under server/plugins/ (auto-registered from
 * there at server startup). Today that is the Sector Watch
 * boot plugin — Anubis's watch starts with the core server
 * process, no window opened first. There are no routes,
 * middleware, or tasks under server/; TanStack Start's own
 * server entry (src/server.ts) is untouched by this.
 */
export default defineConfig({
  serverDir: "./server",
});
