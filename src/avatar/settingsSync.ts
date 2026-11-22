/**
 * SETTINGS SYNC — the stage settings follow the operator's account.
 *
 * Local storage is the floor: settings save on this device on every change
 * (settings.ts) and always work signed out or offline. When the operator is
 * signed in, this engine keeps the account copy (operatorSettings.server,
 * stored in the operator registry) in step:
 *
 *   - On start (the stage only exists while signed in): pull the account
 *     copy. If it is newer than this device's copy, apply it here. If this
 *     device's copy is newer, push it up. If the account has none and this
 *     device has saved settings, seed the account with them.
 *   - On every local change: debounce, then push. Latest save wins.
 *
 * Honesty rules: the status only claims "account" after the server has
 * confirmed a read or a save — never on hope. A failed push leaves the
 * settings safe on this device and reports "unavailable". Applying an
 * account copy never echoes back as a new save (content is compared).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import { getOperatorSettings, saveOperatorSettings } from "./operatorSettings.server";
import {
  hasSavedAvatarSettings,
  loadAvatarSettings,
  loadAvatarSettingsUpdatedAt,
  saveAvatarSettingsUpdatedAt,
  type AvatarSettings,
} from "./settings";

export type SettingsSyncStatus = "connecting" | "local-only" | "account" | "unavailable";

export function settingsSyncLabel(status: SettingsSyncStatus): string {
  switch (status) {
    case "connecting":
      return "Checking your account…";
    case "account":
      return "Synced with your account — your settings follow you across devices.";
    case "unavailable":
      return "Account sync unavailable — saved on this device for now.";
    case "local-only":
    default:
      return "Saved on this device only.";
  }
}

export interface SettingsRemoteView {
  configured: boolean;
  authorized: boolean;
  available: boolean;
  settings: AvatarSettings | null;
  updatedAt: string | null;
}

export interface SettingsRemoteSaveResult {
  configured: boolean;
  authorized: boolean;
  saved: boolean;
}

export interface SettingsRemote {
  get(accessToken: string): Promise<SettingsRemoteView>;
  save(
    accessToken: string,
    settings: AvatarSettings,
    updatedAt: string,
  ): Promise<SettingsRemoteSaveResult>;
}

const defaultRemote: SettingsRemote = {
  get: (accessToken) => getOperatorSettings({ data: { accessToken } }),
  save: (accessToken, settings, updatedAt) =>
    saveOperatorSettings({ data: { accessToken, settings, updatedAt } }),
};

/** Same client resolution the in-stage windows use (Gate Log pattern). */
async function loadAuthClient(): Promise<SupabaseClient | null> {
  let url = import.meta.env["VITE_SUPABASE_URL"]?.trim();
  let publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
  if (!url || !publishableKey) {
    const config = (await getSupabaseClientConfig().catch(() => null)) ?? null;
    url = config?.url?.trim();
    publishableKey = config?.publishableKey?.trim();
  }
  if (!url || !publishableKey) return null;
  return createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

export interface SettingsSyncDeps {
  /** Apply a newer account copy to the live stage (and persist it locally). */
  apply: (settings: AvatarSettings) => void;
  onStatus?: (status: SettingsSyncStatus) => void;
  loadClient?: () => Promise<SupabaseClient | null>;
  remote?: SettingsRemote;
  readLocal?: () => { settings: AvatarSettings; updatedAt: number | null; exists: boolean };
  stampUpdatedAt?: (updatedAt: number) => void;
  debounceMs?: number;
}

export interface SettingsSync {
  start: () => void;
  stop: () => void;
  notifyLocalChange: (settings: AvatarSettings) => void;
  status: () => SettingsSyncStatus;
}

export function createSettingsSync(deps: SettingsSyncDeps): SettingsSync {
  const remote = deps.remote ?? defaultRemote;
  const loadClient = deps.loadClient ?? loadAuthClient;
  const readLocal =
    deps.readLocal ??
    (() => ({
      settings: loadAvatarSettings(),
      updatedAt: loadAvatarSettingsUpdatedAt(),
      exists: hasSavedAvatarSettings(),
    }));
  const stampUpdatedAt = deps.stampUpdatedAt ?? saveAvatarSettingsUpdatedAt;
  const debounceMs = deps.debounceMs ?? 1_200;

  let currentStatus: SettingsSyncStatus = "connecting";
  let started = false;
  let stopped = false;
  let accessToken: string | null = null;
  let lastSyncedJson: string | null = null;
  let pending: AvatarSettings | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;

  function setStatus(next: SettingsSyncStatus) {
    if (currentStatus === next) return;
    currentStatus = next;
    deps.onStatus?.(next);
  }

  async function push(settings: AvatarSettings, updatedAtMs: number): Promise<boolean> {
    if (!accessToken) return false;
    try {
      const result = await remote.save(accessToken, settings, new Date(updatedAtMs).toISOString());
      if (result.saved) {
        lastSyncedJson = JSON.stringify(settings);
        setStatus("account");
        return true;
      }
      setStatus("unavailable");
      return false;
    } catch {
      setStatus("unavailable");
      return false;
    }
  }

  async function flush() {
    if (stopped || !pending) return;
    const settings = pending;
    pending = null;
    if (!accessToken) {
      setStatus("local-only");
      return;
    }
    if (JSON.stringify(settings) === lastSyncedJson) {
      setStatus("account");
      return;
    }
    const local = readLocal();
    await push(settings, local.updatedAt ?? Date.now());
  }

  function scheduleFlush() {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, debounceMs);
  }

  async function initialSync(token: string) {
    let view: SettingsRemoteView;
    try {
      view = await remote.get(token);
    } catch {
      setStatus("unavailable");
      return;
    }
    if (stopped) return;
    if (!view.configured || !view.available) {
      setStatus("unavailable");
      return;
    }
    if (!view.authorized) {
      setStatus("local-only");
      return;
    }
    const local = readLocal();
    const remoteMs = view.updatedAt ? Date.parse(view.updatedAt) : null;
    if (view.settings && remoteMs !== null && !Number.isNaN(remoteMs)) {
      if (local.updatedAt === null || remoteMs >= local.updatedAt) {
        // The account copy is the latest word — take it, and mark it as
        // already synced BEFORE applying so the apply doesn't echo back.
        lastSyncedJson = JSON.stringify(view.settings);
        deps.apply(view.settings);
        stampUpdatedAt(remoteMs);
        setStatus("account");
        return;
      }
      // This device saved later than the account — push its copy up.
      await push(local.settings, local.updatedAt);
      return;
    }
    // No account copy yet: seed it from this device if it has one.
    if (local.exists) {
      await push(local.settings, local.updatedAt ?? Date.now());
      return;
    }
    // Both sides empty and the account channel answered — in step.
    setStatus("account");
  }

  async function boot() {
    let client: SupabaseClient | null = null;
    try {
      client = await loadClient();
    } catch {
      client = null;
    }
    if (stopped) return;
    if (!client) {
      setStatus("local-only");
      return;
    }
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (stopped) return;
      if (event === "SIGNED_OUT" || !session) {
        accessToken = null;
        setStatus("local-only");
        return;
      }
      if (event === "SIGNED_IN" && session.access_token !== accessToken) {
        accessToken = session.access_token;
        void initialSync(accessToken);
      }
    });
    unsubscribe = () => subscription.unsubscribe();

    try {
      const { data } = await client.auth.getSession();
      if (stopped) return;
      const token = data.session?.access_token ?? null;
      if (!token) {
        setStatus("local-only");
        return;
      }
      accessToken = token;
      await initialSync(token);
    } catch {
      if (!stopped) setStatus("local-only");
    }
  }

  return {
    start() {
      if (started) return;
      started = true;
      deps.onStatus?.(currentStatus);
      void boot();
    },
    stop() {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      unsubscribe?.();
      unsubscribe = null;
    },
    notifyLocalChange(settings) {
      pending = settings;
      if (!started || stopped) return;
      if (!accessToken && currentStatus !== "connecting") {
        setStatus("local-only");
        return;
      }
      scheduleFlush();
    },
    status: () => currentStatus,
  };
}
