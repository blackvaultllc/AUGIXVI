/**
 * CONNECTIONS — the server half of the universal slots area.
 *
 * Operator-only in fact, not just by placement: every function
 * re-verifies the operator session (the same check the gate log
 * uses) before it reports or stores anything. What crosses the
 * wire is NAMES AND STATES ONLY — connected or open, and where the
 * value lives (environment or the server store). A value goes one
 * way: from the Captain's hands into the server store. It is never
 * read back out to any client, never logged, never echoed in an
 * error.
 *
 * Where the local store does not exist (the Cloudflare Worker),
 * saving reports the honest path instead: set the Worker secret of
 * the slot's name. Status still reads the environment there, so a
 * secret set in Cloudflare shows as connected.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { CONNECTION_SLOTS, connectionSlot } from "./connections";
import { applyStoredConnectionsToEnv, getConnectionsStore } from "./connectionsStore.server";

type RequestWithCloudflareEnv = Request & {
  runtime?: { cloudflare?: { env?: Record<string, unknown> } };
};

function envValue(name: string): string | undefined {
  try {
    const request = getRequest() as RequestWithCloudflareEnv;
    const runtimeEnv = request.runtime?.cloudflare?.env ?? {};
    const value = runtimeEnv[name] ?? process.env[name];
    return typeof value === "string" && value.trim() ? value : undefined;
  } catch {
    const value = process.env[name];
    return typeof value === "string" && value.trim() ? value : undefined;
  }
}

export type ConnectionSlotState = {
  slotId: string;
  connected: boolean;
  /** Where the value lives: the environment (e.g. a Worker secret) or this server's store. */
  source: "environment" | "stored" | null;
};

export type ConnectionsView = {
  configured: boolean;
  authorized: boolean;
  /** False on surfaces with no local store (the Worker): saving there goes through Worker secrets. */
  storageAvailable: boolean;
  slots: ConnectionSlotState[];
};

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

async function slotStates(): Promise<{ storageAvailable: boolean; slots: ConnectionSlotState[] }> {
  const store = await getConnectionsStore();
  const stored = store ? await store.readAll() : {};
  return {
    storageAvailable: store !== null,
    slots: CONNECTION_SLOTS.map((slot) => {
      if (envValue(slot.envName)) {
        return { slotId: slot.id, connected: true, source: "environment" as const };
      }
      if (stored[slot.envName]) {
        return { slotId: slot.id, connected: true, source: "stored" as const };
      }
      return { slotId: slot.id, connected: false, source: null };
    }),
  };
}

/** Names and states only — never a value. */
export const getConnectionSlots = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid connections request.");
    return input;
  })
  .handler(async ({ data }): Promise<ConnectionsView> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) {
      return {
        configured: verification.configured,
        authorized: false,
        storageAvailable: false,
        slots: [],
      };
    }
    const { storageAvailable, slots } = await slotStates();
    return { configured: true, authorized: true, storageAvailable, slots };
  });

export type SaveConnectionInput = TokenInput & { slotId: string; value: string };

export type SaveConnectionResult = {
  authorized: boolean;
  stored: boolean;
  /** Plain words for the Captain — never contains the value. */
  note: string;
};

function isSaveInput(input: unknown): input is SaveConnectionInput {
  return (
    isTokenInput(input) &&
    typeof (input as SaveConnectionInput).slotId === "string" &&
    typeof (input as SaveConnectionInput).value === "string"
  );
}

/** The Captain fills a slot. The value goes into the server store and nowhere else. */
export const saveConnectionSlot = createServerFn({ method: "POST" })
  .validator((input: unknown): SaveConnectionInput => {
    if (!isSaveInput(input)) throw new Error("Invalid connection save request.");
    return input;
  })
  .handler(async ({ data }): Promise<SaveConnectionResult> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) {
      return { authorized: false, stored: false, note: "That session is not the operator's." };
    }
    const slot = connectionSlot(data.slotId);
    if (!slot) return { authorized: true, stored: false, note: "That slot does not exist." };
    const value = data.value.trim();
    if (!value) return { authorized: true, stored: false, note: "Nothing was entered." };
    if (value.length > 1024) {
      return { authorized: true, stored: false, note: "That is too long for a key or address." };
    }
    const store = await getConnectionsStore();
    if (!store) {
      return {
        authorized: true,
        stored: false,
        note: `This surface can't store keys. Set the Worker secret named ${slot.envName} in Cloudflare instead — it will show here as connected.`,
      };
    }
    await store.set(slot.envName, value);
    // Live at once: the plumbing that reads env names sees it now,
    // and the boot loader restores it on the next start.
    if (!process.env[slot.envName]) process.env[slot.envName] = value;
    return {
      authorized: true,
      stored: true,
      note: slot.consumer
        ? `Stored on the server. ${slot.consumer} can read it now.`
        : "Stored safely on the server.",
    };
  });

/** The Captain empties a slot he filled here. Environment values are not his to clear from this panel. */
export const clearConnectionSlot = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput & { slotId: string } => {
    if (!isTokenInput(input) || typeof (input as { slotId?: unknown }).slotId !== "string") {
      throw new Error("Invalid connection clear request.");
    }
    return input as TokenInput & { slotId: string };
  })
  .handler(async ({ data }): Promise<SaveConnectionResult> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) {
      return { authorized: false, stored: false, note: "That session is not the operator's." };
    }
    const slot = connectionSlot(data.slotId);
    if (!slot) return { authorized: true, stored: false, note: "That slot does not exist." };
    const store = await getConnectionsStore();
    if (!store) {
      return {
        authorized: true,
        stored: false,
        note: "Nothing is stored on this surface to clear.",
      };
    }
    const before = await store.readAll();
    const storedValue = before[slot.envName];
    await store.clear(slot.envName);
    if (storedValue && process.env[slot.envName] === storedValue) {
      delete process.env[slot.envName];
    }
    return { authorized: true, stored: true, note: "Slot emptied. It reads open again." };
  });

/** Boot: restore stored slot values into the server process environment. */
export async function bootConnections(): Promise<void> {
  await applyStoredConnectionsToEnv();
}
