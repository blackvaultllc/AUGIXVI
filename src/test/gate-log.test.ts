import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GATE_LOG_MAX_BYTES,
  isTrapPath,
  parseGateLog,
  planAppend,
  serializeKnock,
  type GateKnock,
} from "@/avatar/gateLog";
import { clientIpFromRequest, createGateLogStore } from "@/avatar/gateLogStore.server";

/**
 * GATE LOG / HONEYPOT (operator order 2026-11-21 — "Honeypot city").
 * The trap matcher must catch the classic probe paths and must NEVER
 * shadow a real route or asset of this app; the log must round-trip
 * append → parse exactly, skip torn lines, and rotate at the cap
 * without losing the count.
 */
describe("gate log — trap matcher", () => {
  it.each([
    // The probe paths the gate is baited with.
    "/.env",
    "/.env.local",
    "/.env.bak",
    "/.git/config",
    "/.git/HEAD",
    "/.git",
    "/wp-admin",
    "/wp-admin/install.php",
    "/wp-login.php",
    "/phpmyadmin",
    "/phpmyadmin/index.php",
    "/admin/config",
    "/config.php",
    "/.aws/credentials",
    "/.aws/config",
    "/server-status",
    "/actuator/env",
    "/actuator/health",
    "/vendor/phpunit",
    "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",
    "/xmlrpc.php",
    // Probes vary case, encoding, and trailing slashes.
    "/.ENV",
    "/WP-Admin",
    "/%2eenv",
    "/wp-login.php/",
    "//.env",
  ])("traps %j", (path) => {
    expect(isTrapPath(path)).toBe(true);
  });

  it.each([
    // Every real route of the app.
    "/",
    "/avatar",
    "/avatar/analyze",
    "/avatar/cube",
    "/avatar/game",
    "/api/transcribe",
    // Real public assets.
    "/favicon.ico",
    "/robots.txt",
    "/manifest.webmanifest",
    "/sw.js",
    "/assets/world/earth/earth_day.jpg",
    "/models/wolf_with_animations.glb",
    "/icons/icon-192.png",
    "/ar-cube/index.html",
    "/ar-cube/assets/targets.mind",
    "/games/legend-of-logic.html",
    // Lookalikes that are not probes of this app.
    "/environment",
    "/git",
    "/admin",
    "/config",
    "/server",
    "/vendor",
  ])("does not trap the real path %j", (path) => {
    expect(isTrapPath(path)).toBe(false);
  });
});

describe("gate log — line format", () => {
  const knock: GateKnock = {
    ts: "2026-11-21T05:00:00.000Z",
    ip: "127.0.0.1",
    method: "GET",
    path: "/.env",
    userAgent: "curl/8.0",
  };

  it("round-trips serialize → parse exactly", () => {
    const text = serializeKnock(knock) + serializeKnock({ ...knock, path: "/wp-admin" });
    expect(parseGateLog(text)).toEqual([knock, { ...knock, path: "/wp-admin" }]);
  });

  it("skips malformed and torn lines instead of failing the log", () => {
    const text = `${serializeKnock(knock)}not json\n{"ts":123}\n\n{"ts":"2026-11-21T05:0`;
    expect(parseGateLog(text)).toEqual([knock]);
  });

  it("parses an empty log to no knocks", () => {
    expect(parseGateLog("")).toEqual([]);
  });
});

describe("gate log — rotation rule", () => {
  it("appends while the line fits under the cap", () => {
    expect(planAppend(0, 100)).toBe("append");
    expect(planAppend(GATE_LOG_MAX_BYTES - 100, 100)).toBe("append");
  });

  it("rotates when the line would pass the cap", () => {
    expect(planAppend(GATE_LOG_MAX_BYTES - 99, 100)).toBe("rotate");
    expect(planAppend(GATE_LOG_MAX_BYTES, 1)).toBe("rotate");
  });

  it("never rotates an empty file, so an oversized line still lands", () => {
    expect(planAppend(0, GATE_LOG_MAX_BYTES * 2)).toBe("append");
  });
});

describe("gate log — client address", () => {
  it("prefers the socket address the server actually saw", () => {
    const request = Object.assign(new Request("http://localhost/.env"), {
      ip: "::ffff:192.168.1.20",
    });
    expect(clientIpFromRequest(request)).toBe("192.168.1.20");
  });

  it("falls back to forwarding headers when no socket address exists", () => {
    const request = new Request("http://localhost/.env", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(clientIpFromRequest(request)).toBe("203.0.113.9");
  });

  it("reports unknown when nothing identifies the source", () => {
    expect(clientIpFromRequest(new Request("http://localhost/.env"))).toBe("unknown");
  });
});

describe("gate log — file store", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "augie-gate-log-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const knockAt = (path: string, second: number): GateKnock => ({
    ts: `2026-11-21T05:00:${String(second).padStart(2, "0")}.000Z`,
    ip: "127.0.0.1",
    method: "GET",
    path,
    userAgent: "test-agent",
  });

  it("records knocks and reads them back newest first with the total", async () => {
    const store = await createGateLogStore(directory);
    if (!store) throw new Error("Gate log store was unavailable.");
    await store.record(knockAt("/.env", 1));
    await store.record(knockAt("/wp-admin", 2));
    await store.record(knockAt("/.git/config", 3));

    const { entries, total } = await store.read();
    expect(total).toBe(3);
    expect(entries.map((entry) => entry.path)).toEqual(["/.git/config", "/wp-admin", "/.env"]);

    const raw = await readFile(join(directory, "gate-log.jsonl"), "utf8");
    expect(parseGateLog(raw)).toHaveLength(3);
  });

  it("reads an untouched log as empty", async () => {
    const store = await createGateLogStore(directory);
    if (!store) throw new Error("Gate log store was unavailable.");
    expect(await store.read()).toEqual({ entries: [], total: 0 });
  });

  it("rotates at the cap and keeps every knock counted across both files", async () => {
    const store = await createGateLogStore(directory);
    if (!store) throw new Error("Gate log store was unavailable.");
    // ~10 KiB per knock: ~150 knocks carry the log well past the 1 MiB
    // cap, forcing exactly one rotation (one generation is kept).
    const fatAgent = "x".repeat(10_000);
    const count = 150;
    for (let i = 0; i < count; i += 1) {
      await store.record({ ...knockAt(`/probe-${i}`, i % 60), userAgent: fatAgent });
    }

    const rotated = await stat(join(directory, "gate-log.1.jsonl"));
    expect(rotated.size).toBeGreaterThan(0);
    const live = await stat(join(directory, "gate-log.jsonl"));
    expect(live.size).toBeLessThanOrEqual(GATE_LOG_MAX_BYTES);

    const { entries, total } = await store.read();
    expect(total).toBe(count);
    expect(entries[0]?.path).toBe(`/probe-${count - 1}`);
  });
});
