/**
 * UNIFORM PERMISSIONS — the server functions (the Captain's
 * standing rule, 2026-11-26). Operator-only, like the rest of
 * the device system. The window sees the shared profile and
 * every registered item's standing — shared or deviating,
 * stated plainly. Changing the shared profile reconciles the
 * whole fleet at once; a deviation is set or cleared for one
 * item only, by the Captain's hand here.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { getPermissionsProfileStore } from "./permissionsProfileStore.server";
import { itemKey, type PermissionFlags } from "./permissionsProfile";
import {
  permissionsView,
  reconcilePermissions,
  type PermissionsView,
} from "./permissionsProfileRuntime.server";

type TokenInput = { accessToken: string };

function isTokenInput(input: unknown): input is TokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    typeof (input as TokenInput).accessToken === "string" &&
    (input as TokenInput).accessToken.length > 0 &&
    (input as TokenInput).accessToken.length <= 16_384
  );
}

async function authorized(accessToken: string): Promise<boolean> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return verification.authorized;
}

export type PermissionsProfileView = PermissionsView & { authorized: boolean };

export const getPermissionsProfile = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid permissions request.");
    return input;
  })
  .handler(async ({ data }): Promise<PermissionsProfileView> => {
    if (!(await authorized(data.accessToken))) {
      return {
        authorized: false,
        available: false,
        profile: { ownerConfirmed: false, controlGranted: false },
        items: [],
      };
    }
    const view = await permissionsView();
    return { authorized: true, ...view };
  });

export type PermissionsNoteResult = { authorized: boolean; ok: boolean; note: string };

export type SetSharedProfileInput = TokenInput & PermissionFlags;

export const setSharedProfile = createServerFn({ method: "POST" })
  .validator((input: unknown): SetSharedProfileInput => {
    if (
      !isTokenInput(input) ||
      typeof (input as SetSharedProfileInput).ownerConfirmed !== "boolean" ||
      typeof (input as SetSharedProfileInput).controlGranted !== "boolean"
    ) {
      throw new Error("Invalid shared profile request.");
    }
    return input as SetSharedProfileInput;
  })
  .handler(async ({ data }): Promise<PermissionsNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const store = await getPermissionsProfileStore();
    if (!store) {
      return { authorized: true, ok: false, note: "The permissions profile lives on the core machine — no local store here." };
    }
    await store.update((file) => ({
      ...file,
      born: true,
      profile: { ownerConfirmed: data.ownerConfirmed, controlGranted: data.controlGranted },
      version: file.version + 1,
      updatedAt: Date.now(),
    }));
    await reconcilePermissions();
    return {
      authorized: true,
      ok: true,
      note: "The shared profile is set — every camera and device that follows it was reconciled to it. Items standing on a deviation keep theirs.",
    };
  });

export type SetDeviationInput = TokenInput & {
  kind: "camera" | "device";
  id: string;
  /** The explicit per-item flags, or null to return the item to the shared profile. */
  flags: PermissionFlags | null;
};

export const setPermissionDeviation = createServerFn({ method: "POST" })
  .validator((input: unknown): SetDeviationInput => {
    const v = input as SetDeviationInput;
    if (
      !isTokenInput(input) ||
      (v.kind !== "camera" && v.kind !== "device") ||
      typeof v.id !== "string" ||
      (v.flags !== null &&
        (typeof v.flags !== "object" ||
          typeof v.flags.ownerConfirmed !== "boolean" ||
          typeof v.flags.controlGranted !== "boolean"))
    ) {
      throw new Error("Invalid deviation request.");
    }
    return v;
  })
  .handler(async ({ data }): Promise<PermissionsNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const store = await getPermissionsProfileStore();
    if (!store) {
      return { authorized: true, ok: false, note: "The permissions profile lives on the core machine — no local store here." };
    }
    const key = itemKey(data.kind, data.id);
    await store.update((file) => {
      const deviations = { ...file.deviations };
      if (data.flags === null) delete deviations[key];
      else deviations[key] = { ...data.flags };
      return { ...file, deviations, version: file.version + 1, updatedAt: Date.now() };
    });
    await reconcilePermissions();
    return data.flags === null
      ? { authorized: true, ok: true, note: "Back on the shared profile — reconciled." }
      : { authorized: true, ok: true, note: "Deviation set for this item only — reconciled. It stands apart from the shared profile until you clear it." };
  });
