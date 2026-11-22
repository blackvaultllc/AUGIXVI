/**
 * OPERATOR SETTINGS — account copy of the stage settings.
 *
 * The stage settings (particles, bloom, glitch, theme, custom color,
 * sensitivity, cooldown) live on the device in localStorage; this is the
 * account copy, so a configuration the operator makes on one device is
 * there when he opens Augie on another. Storage is the operator registry —
 * the same single-owner store that holds the ownership claim (the Durable
 * Object online, the file-backed registry in the local build) — reached
 * only through these functions.
 *
 * Operator-only in fact, not just by placement: the caller passes the same
 * Supabase access token the rooms use, and it is verified with the exact
 * same check (verifySupabaseOperatorSession — registry ownership plus MFA
 * assurance) before a single setting is read or written. Anything
 * unverified reads nothing and saves nothing. Settings are sanitized
 * through the same validator the local loader uses, so the account copy
 * can never hold values outside the knobs' limits.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { requestOperatorRegistry } from "./operatorRegistryAccess.server";
import { sanitizeAvatarSettings, type AvatarSettings } from "./settings";

type GetSettingsInput = { accessToken: string };
type SaveSettingsInput = { accessToken: string; settings: unknown; updatedAt: string };

function isAccessToken(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 16_384;
}

function isGetSettingsInput(input: unknown): input is GetSettingsInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "accessToken" in input &&
    isAccessToken(input.accessToken)
  );
}

function isSaveSettingsInput(input: unknown): input is SaveSettingsInput {
  if (typeof input !== "object" || input === null) return false;
  if (!("accessToken" in input) || !isAccessToken(input.accessToken)) return false;
  if (
    !("settings" in input) ||
    typeof input.settings !== "object" ||
    input.settings === null ||
    Array.isArray(input.settings)
  ) {
    return false;
  }
  if (!("updatedAt" in input) || typeof input.updatedAt !== "string") return false;
  return (
    input.updatedAt.length > 0 &&
    input.updatedAt.length <= 64 &&
    !Number.isNaN(Date.parse(input.updatedAt))
  );
}

export interface OperatorSettingsView {
  configured: boolean;
  authorized: boolean;
  /** False where the registry could not be reached at all. */
  available: boolean;
  /** The account copy, or null when the account has never saved settings. */
  settings: AvatarSettings | null;
  /** ISO timestamp of the account copy, or null when there is none. */
  updatedAt: string | null;
}

export interface OperatorSettingsSaveResult {
  configured: boolean;
  authorized: boolean;
  saved: boolean;
}

export const getOperatorSettings = createServerFn({ method: "POST" })
  .validator((input: unknown): GetSettingsInput => {
    if (!isGetSettingsInput(input)) {
      throw new Error("Invalid operator settings request.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<OperatorSettingsView> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) {
      return {
        configured: verification.configured,
        authorized: false,
        available: false,
        settings: null,
        updatedAt: null,
      };
    }
    const response = await requestOperatorRegistry("/settings");
    if (!response || !response.ok) {
      return {
        configured: true,
        authorized: true,
        available: false,
        settings: null,
        updatedAt: null,
      };
    }
    const result: unknown = await response.json();
    const record =
      typeof result === "object" && result !== null && "settings" in result
        ? (result as { settings: unknown }).settings
        : null;
    if (
      typeof record !== "object" ||
      record === null ||
      !("settings" in record) ||
      !("updatedAt" in record) ||
      typeof (record as { updatedAt: unknown }).updatedAt !== "string"
    ) {
      // No account copy yet — a fact, not a failure.
      return {
        configured: true,
        authorized: true,
        available: true,
        settings: null,
        updatedAt: null,
      };
    }
    const stored = record as { settings: unknown; updatedAt: string };
    return {
      configured: true,
      authorized: true,
      available: true,
      settings: sanitizeAvatarSettings(stored.settings),
      updatedAt: stored.updatedAt,
    };
  });

export const saveOperatorSettings = createServerFn({ method: "POST" })
  .validator((input: unknown): SaveSettingsInput => {
    if (!isSaveSettingsInput(input)) {
      throw new Error("Invalid operator settings save request.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<OperatorSettingsSaveResult> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) {
      return { configured: verification.configured, authorized: false, saved: false };
    }
    const response = await requestOperatorRegistry("/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        settings: sanitizeAvatarSettings(data.settings),
        updatedAt: data.updatedAt,
      }),
    });
    if (!response || !response.ok) {
      return { configured: true, authorized: true, saved: false };
    }
    const result: unknown = await response.json();
    const saved =
      typeof result === "object" && result !== null && "saved" in result && result.saved === true;
    return { configured: true, authorized: true, saved };
  });
