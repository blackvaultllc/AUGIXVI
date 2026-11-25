/**
 * DEVICE CORE — the operator's server functions (owner order
 * 2026-11-24: the device stores move into the core).
 *
 * Every call re-verifies the operator session exactly like the
 * core memory and the Daddy Inbox do (verifySupabaseOperatorSession)
 * before a single record moves — the registry carries the
 * Permission Law's grants, and it opens for the Captain alone.
 *
 * The put is a MERGE, never a blind replace: the incoming state is
 * merged over the core's (mergeLocalIntoCore), so a surface with a
 * stale cache cannot wipe a flag request Anubis just filed or a
 * grant the Captain just confirmed elsewhere.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "../operatorAuth.server";
import {
  mergeLocalIntoCore,
  sanitizeDeviceCoreState,
  type DeviceCoreState,
} from "./deviceStoreCore";

type TokenInput = { accessToken: string };

function isTokenInput(input: unknown): input is TokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "accessToken" in input &&
    typeof (input as TokenInput).accessToken === "string" &&
    (input as TokenInput).accessToken.length > 0 &&
    (input as TokenInput).accessToken.length <= 16_384
  );
}

async function authorize(accessToken: string): Promise<{ configured: boolean; authorized: boolean }> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return { configured: verification.configured, authorized: verification.authorized };
}

export interface DeviceCoreView {
  configured: boolean;
  authorized: boolean;
  /** False where the core store does not exist (e.g. the Worker). */
  available: boolean;
  state: DeviceCoreState | null;
}

const DENIED: DeviceCoreView = {
  configured: false,
  authorized: false,
  available: false,
  state: null,
};

export const getDeviceCore = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid device core request.");
    return input;
  })
  .handler(async ({ data }): Promise<DeviceCoreView> => {
    const auth = await authorize(data.accessToken);
    if (!auth.authorized) return { ...DENIED, configured: auth.configured };
    const { readDeviceCore } = await import("./deviceStore.server");
    const { available, state } = await readDeviceCore();
    if (!available) return { ...DENIED, configured: true, authorized: true };
    return { configured: true, authorized: true, available: true, state };
  });

type PutInput = TokenInput & { state: unknown };

function isPutInput(input: unknown): input is PutInput {
  return isTokenInput(input) && typeof input === "object" && input !== null && "state" in input;
}

export const putDeviceCore = createServerFn({ method: "POST" })
  .validator((input: unknown): PutInput => {
    if (!isPutInput(input)) throw new Error("Invalid device core write.");
    return input;
  })
  .handler(async ({ data }): Promise<DeviceCoreView> => {
    const auth = await authorize(data.accessToken);
    if (!auth.authorized) return { ...DENIED, configured: auth.configured };
    const { readDeviceCore, writeDeviceCore } = await import("./deviceStore.server");
    const current = await readDeviceCore();
    if (!current.available) return { ...DENIED, configured: true, authorized: true };
    const merged = mergeLocalIntoCore(current.state, sanitizeDeviceCoreState(data.state));
    const stored = await writeDeviceCore(merged);
    if (!stored) return { ...DENIED, configured: true, authorized: true };
    return { configured: true, authorized: true, available: true, state: stored };
  });
