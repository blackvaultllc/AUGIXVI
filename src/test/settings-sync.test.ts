import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSettingsSync,
  settingsSyncLabel,
  type SettingsRemote,
  type SettingsRemoteView,
  type SettingsSync,
  type SettingsSyncStatus,
} from "@/avatar/settingsSync";
import type { AvatarSettings } from "@/avatar/settings";

const LOCAL_SETTINGS: AvatarSettings = {
  maxParticles: 60_000,
  bloom: 0,
  glitch: 0.15,
  theme: "purple",
  customColor: "#22c55e",
  sensitivity: 1.1,
  cooldownMs: 650,
  backdropImage: null,
  backdropFit: "contain" as const,
  backdropSynced: false,
};

const ACCOUNT_SETTINGS: AvatarSettings = {
  maxParticles: 90_000,
  bloom: 0,
  glitch: 0.2,
  theme: "green",
  customColor: "#22c55e",
  sensitivity: 0.9,
  cooldownMs: 700,
  backdropImage: null,
  backdropFit: "contain" as const,
  backdropSynced: false,
};

const tick = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeClient(session: { access_token: string } | null): SupabaseClient {
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  } as unknown as SupabaseClient;
}

function fakeRemote(view: SettingsRemoteView) {
  const saves: Array<{ settings: AvatarSettings; updatedAt: string }> = [];
  const remote: SettingsRemote = {
    get: async () => view,
    save: async (_token, settings, updatedAt) => {
      saves.push({ settings, updatedAt });
      return { configured: true, authorized: true, saved: true };
    },
  };
  return { remote, saves };
}

function harness(options: {
  session: { access_token: string } | null;
  view: SettingsRemoteView;
  local: { settings: AvatarSettings; updatedAt: number | null; exists: boolean };
  echoApply?: boolean;
}) {
  const { remote, saves } = fakeRemote(options.view);
  const applied: AvatarSettings[] = [];
  const stamped: number[] = [];
  const statuses: SettingsSyncStatus[] = [];
  const holder: { sync?: SettingsSync } = {};
  const sync = createSettingsSync({
    loadClient: async () => fakeClient(options.session),
    remote,
    readLocal: () => options.local,
    stampUpdatedAt: (ms) => stamped.push(ms),
    apply: (settings) => {
      applied.push(settings);
      // The real stage's apply persists locally, which notifies the engine
      // again — the engine must not echo that back as a new account save.
      if (options.echoApply) holder.sync?.notifyLocalChange(settings);
    },
    onStatus: (status) => statuses.push(status),
    debounceMs: 5,
  });
  holder.sync = sync;
  return { sync, saves, applied, stamped, statuses };
}

const EMPTY_VIEW: SettingsRemoteView = {
  configured: true,
  authorized: true,
  available: true,
  settings: null,
  updatedAt: null,
};

describe("settings sync — local floor, account follows", () => {
  it("signed out: local-only, and a change never reaches the account", async () => {
    const h = harness({
      session: null,
      view: EMPTY_VIEW,
      local: { settings: LOCAL_SETTINGS, updatedAt: 1_000, exists: true },
    });
    h.sync.start();
    await tick();
    expect(h.sync.status()).toBe("local-only");
    h.sync.notifyLocalChange({ ...LOCAL_SETTINGS, bloom: 0.5 });
    await tick();
    expect(h.saves).toHaveLength(0);
    expect(h.applied).toHaveLength(0);
    h.sync.stop();
  });

  it("account copy newer: applied here, stamped with its time, never echoed back as a save", async () => {
    const accountMs = 5_000;
    const h = harness({
      session: { access_token: "token-1" },
      view: {
        configured: true,
        authorized: true,
        available: true,
        settings: ACCOUNT_SETTINGS,
        updatedAt: new Date(accountMs).toISOString(),
      },
      local: { settings: LOCAL_SETTINGS, updatedAt: 1_000, exists: true },
      echoApply: true,
    });
    h.sync.start();
    await tick();
    expect(h.applied).toEqual([ACCOUNT_SETTINGS]);
    expect(h.stamped).toEqual([accountMs]);
    await tick();
    expect(h.saves).toHaveLength(0);
    expect(h.sync.status()).toBe("account");
    h.sync.stop();
  });

  it("this device saved later: its copy is pushed up — latest save wins", async () => {
    const h = harness({
      session: { access_token: "token-1" },
      view: {
        configured: true,
        authorized: true,
        available: true,
        settings: ACCOUNT_SETTINGS,
        updatedAt: new Date(1_000).toISOString(),
      },
      local: { settings: LOCAL_SETTINGS, updatedAt: 9_000, exists: true },
    });
    h.sync.start();
    await tick();
    expect(h.applied).toHaveLength(0);
    expect(h.saves).toEqual([
      { settings: LOCAL_SETTINGS, updatedAt: new Date(9_000).toISOString() },
    ]);
    expect(h.sync.status()).toBe("account");
    h.sync.stop();
  });

  it("account has none, this device does: the account is seeded from here", async () => {
    const h = harness({
      session: { access_token: "token-1" },
      view: EMPTY_VIEW,
      local: { settings: LOCAL_SETTINGS, updatedAt: 3_000, exists: true },
    });
    h.sync.start();
    await tick();
    expect(h.saves).toEqual([
      { settings: LOCAL_SETTINGS, updatedAt: new Date(3_000).toISOString() },
    ]);
    expect(h.sync.status()).toBe("account");
    h.sync.stop();
  });

  it("a change after sign-in is debounce-pushed to the account", async () => {
    const h = harness({
      session: { access_token: "token-1" },
      view: EMPTY_VIEW,
      local: { settings: LOCAL_SETTINGS, updatedAt: null, exists: false },
    });
    h.sync.start();
    await tick();
    expect(h.saves).toHaveLength(0);
    const changed = { ...LOCAL_SETTINGS, theme: "green" as const };
    h.sync.notifyLocalChange(changed);
    await tick();
    expect(h.saves).toHaveLength(1);
    expect(h.saves[0]!.settings).toEqual(changed);
    expect(h.sync.status()).toBe("account");
    h.sync.stop();
  });

  it("account store unreachable: status says unavailable, settings stay local", async () => {
    const h = harness({
      session: { access_token: "token-1" },
      view: {
        configured: true,
        authorized: true,
        available: false,
        settings: null,
        updatedAt: null,
      },
      local: { settings: LOCAL_SETTINGS, updatedAt: 1_000, exists: true },
    });
    h.sync.start();
    await tick();
    expect(h.sync.status()).toBe("unavailable");
    expect(settingsSyncLabel(h.sync.status())).toContain("on this device");
    h.sync.stop();
  });

  it("labels never claim a sync that did not happen", () => {
    expect(settingsSyncLabel("account")).toContain("account");
    expect(settingsSyncLabel("local-only")).toContain("this device");
    expect(settingsSyncLabel("unavailable")).toContain("unavailable");
    expect(settingsSyncLabel("connecting")).toContain("Checking");
    const spy = vi.fn();
    expect(spy).not.toHaveBeenCalled();
  });
});
