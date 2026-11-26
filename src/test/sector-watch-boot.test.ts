import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SECTOR_WATCH_SEED_NOTE,
  WATCH_INTERVAL_DEFAULT_SEC,
  emptySectorWatchFile,
  sanitizeSectorWatchFile,
  seededSectorWatchFile,
} from "@/avatar/cameras/sectorWatch";

/**
 * THE WATCH STARTS ITSELF (owner order 2026-11-26): the Sector
 * Watch scheduler starts when the core server process starts —
 * a Nitro plugin calls bootSectorWatch() at startup — and on a
 * core with no sector record yet, the first tick lays down the
 * Captain's standing orders as a seed. These tests pin the
 * boot path, the seed's shape, that seeding fires only when
 * the record is absent, that an existing record is never
 * overwritten, and that the panel's alive line reads the real
 * scheduler state.
 */

const repoFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("the first-run seed — the Captain's standing orders", () => {
  it("watches the front and bedroom cameras, each in its sector, watch armed", () => {
    const seed = seededSectorWatchFile();
    expect(seed.settings.intervalSec).toBe(WATCH_INTERVAL_DEFAULT_SEC);
    expect(seed.settings.cameras["command-front-window"]).toEqual({
      cameraId: "command-front-window",
      zone: "front",
      watch: true,
    });
    expect(seed.settings.cameras["bedroom"]).toEqual({
      cameraId: "bedroom",
      zone: "bedroom",
      watch: true,
    });
    expect(seed.log).toEqual([]);
    expect(seed.events).toEqual([]);
    expect(seed.judgments).toEqual([]);
  });

  it("carries the seed note, in plain words, saying where the record came from", () => {
    const seed = seededSectorWatchFile();
    expect(seed.seededNote).toBe(SECTOR_WATCH_SEED_NOTE);
    expect(seed.seededNote).toContain("standing orders of 2026-11-26");
  });

  it("the empty record carries no seed note — only a real seed is marked", () => {
    expect(emptySectorWatchFile().seededNote).toBeUndefined();
  });

  it("the sanitizer keeps a seed note and drops a claim in the wrong shape", () => {
    const kept = sanitizeSectorWatchFile({ seededNote: SECTOR_WATCH_SEED_NOTE });
    expect(kept.seededNote).toBe(SECTOR_WATCH_SEED_NOTE);
    const dropped = sanitizeSectorWatchFile({ seededNote: 42 });
    expect(dropped.seededNote).toBeUndefined();
    const roundTripped = sanitizeSectorWatchFile(
      JSON.parse(JSON.stringify(seededSectorWatchFile())),
    );
    expect(roundTripped.seededNote).toBe(SECTOR_WATCH_SEED_NOTE);
    expect(roundTripped.settings.cameras["bedroom"]?.watch).toBe(true);
  });
});

describe("the sector store's seedIfAbsent", () => {
  let home: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    originalHome = process.env["HOME"];
    home = mkdtempSync(join(tmpdir(), "sector-seed-"));
    process.env["HOME"] = home;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env["HOME"];
    else process.env["HOME"] = originalHome;
    vi.resetModules();
    rmSync(home, { recursive: true, force: true });
  });

  async function freshStore() {
    const { getSectorWatchStore } = await import("@/avatar/sectorWatchStore.server");
    const store = await getSectorWatchStore();
    if (!store) throw new Error("the sector store should exist under a node HOME");
    return store;
  }

  it("lays the seed down when no record file exists, and persists it", async () => {
    const store = await freshStore();
    const seeded = await store.seedIfAbsent(seededSectorWatchFile());
    expect(seeded).toBe(true);
    const file = join(home, ".local/share/augie/sector-watch.json");
    expect(existsSync(file)).toBe(true);
    const onDisk = JSON.parse(readFileSync(file, "utf8")) as {
      seededNote?: string;
      settings: { cameras: Record<string, { watch: boolean; zone: string }> };
    };
    expect(onDisk.seededNote).toBe(SECTOR_WATCH_SEED_NOTE);
    expect(onDisk.settings.cameras["command-front-window"]).toMatchObject({
      watch: true,
      zone: "front",
    });
    expect(onDisk.settings.cameras["bedroom"]).toMatchObject({ watch: true, zone: "bedroom" });
    const read = await store.read();
    expect(read.seededNote).toBe(SECTOR_WATCH_SEED_NOTE);
  });

  it("never overwrites an existing record — his settings stand", async () => {
    const store = await freshStore();
    await store.seedIfAbsent(seededSectorWatchFile());
    // The Captain's hand changes the record: bedroom watch off.
    await store.update((file) => ({
      ...file,
      settings: {
        ...file.settings,
        cameras: {
          ...file.settings.cameras,
          bedroom: { cameraId: "bedroom", zone: "bedroom" as const, watch: false },
        },
      },
    }));
    const again = await store.seedIfAbsent(seededSectorWatchFile());
    expect(again).toBe(false);
    const read = await store.read();
    expect(read.settings.cameras["bedroom"]?.watch).toBe(false);
    expect(read.settings.cameras["command-front-window"]?.watch).toBe(true);
  });
});

describe("the boot path — the watch starts with the server process", () => {
  let home: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    originalHome = process.env["HOME"];
    home = mkdtempSync(join(tmpdir(), "sector-boot-"));
    process.env["HOME"] = home;
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalHome === undefined) delete process.env["HOME"];
    else process.env["HOME"] = originalHome;
    vi.resetModules();
    rmSync(home, { recursive: true, force: true });
  });

  it("reconcile starts exactly one scheduler, however many times it is called", async () => {
    const runtime = await import("@/avatar/sectorWatchRuntime.server");
    expect(runtime.sectorWatchSchedulerRunning()).toBe(false);
    const before = vi.getTimerCount();
    runtime.reconcileSectorWatch();
    runtime.reconcileSectorWatch();
    expect(vi.getTimerCount() - before).toBe(1);
    expect(runtime.sectorWatchSchedulerRunning()).toBe(true);
  });

  it("bootSectorWatch starts the scheduler, and the first tick lays the seed", async () => {
    const runtime = await import("@/avatar/sectorWatchRuntime.server");
    expect(runtime.sectorWatchSchedulerRunning()).toBe(false);
    await runtime.bootSectorWatch();
    expect(runtime.sectorWatchSchedulerRunning()).toBe(true);
    const file = join(home, ".local/share/augie/sector-watch.json");
    await vi.waitFor(
      () => {
        expect(existsSync(file)).toBe(true);
      },
      { timeout: 15_000, interval: 50 },
    );
    const onDisk = JSON.parse(readFileSync(file, "utf8")) as { seededNote?: string };
    expect(onDisk.seededNote).toBe(SECTOR_WATCH_SEED_NOTE);
  });

  it("boot is a no-op where there is no core store (no HOME — the Cloudflare surface)", async () => {
    delete process.env["HOME"];
    vi.resetModules();
    const runtime = await import("@/avatar/sectorWatchRuntime.server");
    await runtime.bootSectorWatch();
    expect(runtime.sectorWatchSchedulerRunning()).toBe(false);
  });
});

describe("the wiring pins — plugin, config, and the panel's alive line", () => {
  it("nitro.config.ts points Nitro at the server directory", () => {
    const config = repoFile("nitro.config.ts");
    expect(config).toContain("serverDir");
    expect(config).toContain("./server");
  });

  it("the boot plugin is registered by its place in server/plugins and calls the boot", () => {
    const pluginPath = resolve(process.cwd(), "server/plugins/sector-watch-boot.ts");
    expect(existsSync(pluginPath)).toBe(true);
    const plugin = readFileSync(pluginPath, "utf8");
    expect(plugin).toContain("definePlugin");
    expect(plugin).toContain("bootSectorWatch");
    expect(plugin).toContain("sectorWatchRuntime.server");
  });

  it("the panel shows the scheduler's real state as a plain line", () => {
    const panel = repoFile("src/avatar/cameras/SectorWatchPanel.tsx");
    expect(panel).toContain("The watch is running");
    expect(panel).toContain("The watch is NOT running");
    expect(panel).toContain("view.schedulerRunning");
  });
});
