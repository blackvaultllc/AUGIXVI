/**
 * DOOR SECURITY — the cube is the security (owner order
 * 2026-11-28 ~00:50 CST).
 *
 * The server half of the door strikes (doorStrikes.ts is the
 * law). Wrong god-names at the front door are counted per
 * source address in the OPERATOR REGISTRY — the Durable Object
 * online, the local registry file on the core — so the record
 * survives the visitor's browser entirely: clearing storage,
 * switching browsers, or coming back tomorrow changes nothing.
 * Only the Captain's release (below, operator-verified like
 * the gate log) or a fully verified operator sign-in from that
 * address clears a record.
 *
 * The two public functions grant NOTHING and reveal nothing:
 * the status answers only the caller's own address, and the
 * strike answers counts the door never displays. An address
 * the server cannot name ("unknown") is never counted and
 * never restricted — the functions say the store is
 * unavailable for it, and the door keeps its ordinary silence.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { requestOperatorRegistry } from "./operatorRegistryAccess.server";
import { clientIpFromRequest } from "./gateLogStore.server";
import { isDoorIpUsable, type DoorRestrictionView } from "./doorStrikes";

export interface DoorStatusView {
  /** False where no registry can be reached, or the caller's address cannot be named. */
  available: boolean;
  strikes: number;
  restricted: boolean;
}

const UNAVAILABLE: DoorStatusView = { available: false, strikes: 0, restricted: false };

async function callRegistry(
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await requestOperatorRegistry(path, init);
    if (!response || !response.ok) return null;
    const parsed: unknown = await response.json();
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function postJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function statusForIp(ip: string): Promise<DoorStatusView> {
  if (!isDoorIpUsable(ip)) return UNAVAILABLE;
  const result = await callRegistry("/door-status", postJson({ ip }));
  if (!result) return UNAVAILABLE;
  return {
    available: true,
    strikes: typeof result["strikes"] === "number" ? (result["strikes"] as number) : 0,
    restricted: result["restricted"] === true,
  };
}

/** The caller's own door standing. Public-by-design: it opens nothing. */
export const getDoorStatus = createServerFn({ method: "POST" })
  .validator((input: unknown): Record<string, never> => {
    if (input !== undefined && (typeof input !== "object" || input === null)) {
      throw new Error("Invalid door status request.");
    }
    return {};
  })
  .handler(async (): Promise<DoorStatusView> => {
    return statusForIp(clientIpFromRequest(getRequest()));
  });

/** Count one wrong name from the caller's address. The door shows none of this. */
export const recordDoorStrike = createServerFn({ method: "POST" })
  .validator((input: unknown): Record<string, never> => {
    if (input !== undefined && (typeof input !== "object" || input === null)) {
      throw new Error("Invalid door strike request.");
    }
    return {};
  })
  .handler(async (): Promise<DoorStatusView> => {
    const ip = clientIpFromRequest(getRequest());
    if (!isDoorIpUsable(ip)) return UNAVAILABLE;
    const result = await callRegistry("/door-strike", postJson({ ip }));
    if (!result) return UNAVAILABLE;
    return {
      available: true,
      strikes: typeof result["strikes"] === "number" ? (result["strikes"] as number) : 0,
      restricted: result["restricted"] === true,
    };
  });

/* ------------- the Captain's side: list and release ------------- */

type AccessInput = { accessToken: string };
type ReleaseInput = { accessToken: string; ip: string };

function isAccessToken(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 16_384;
}

function isRestrictionView(value: unknown): value is DoorRestrictionView {
  if (typeof value !== "object" || value === null) return false;
  const view = value as Partial<DoorRestrictionView>;
  return (
    isDoorIpUsable(view.ip) &&
    typeof view.strikes === "number" &&
    typeof view.firstStrikeAt === "string" &&
    typeof view.lastStrikeAt === "string" &&
    typeof view.restrictedAt === "string"
  );
}

export interface DoorRestrictionsResult {
  configured: boolean;
  authorized: boolean;
  /** False where no registry can be reached. */
  available: boolean;
  restrictions: DoorRestrictionView[];
}

/** The restricted addresses, for the Captain's gate log — operator-verified. */
export const getDoorRestrictions = createServerFn({ method: "POST" })
  .validator((input: unknown): AccessInput => {
    if (
      typeof input !== "object" ||
      input === null ||
      !isAccessToken((input as AccessInput).accessToken)
    ) {
      throw new Error("Invalid door restrictions request.");
    }
    return input as AccessInput;
  })
  .handler(async ({ data }): Promise<DoorRestrictionsResult> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) {
      return {
        configured: verification.configured,
        authorized: false,
        available: false,
        restrictions: [],
      };
    }
    const result = await callRegistry("/door-restrictions");
    if (!result || !Array.isArray(result["restrictions"])) {
      return { configured: true, authorized: true, available: false, restrictions: [] };
    }
    return {
      configured: true,
      authorized: true,
      available: true,
      restrictions: (result["restrictions"] as unknown[]).filter(isRestrictionView),
    };
  });

/** The Captain's release of one address — operator-verified. */
export const releaseDoorRestriction = createServerFn({ method: "POST" })
  .validator((input: unknown): ReleaseInput => {
    if (
      typeof input !== "object" ||
      input === null ||
      !isAccessToken((input as ReleaseInput).accessToken) ||
      !isDoorIpUsable((input as ReleaseInput).ip)
    ) {
      throw new Error("Invalid door release request.");
    }
    return input as ReleaseInput;
  })
  .handler(async ({ data }): Promise<{ authorized: boolean; released: boolean }> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) return { authorized: false, released: false };
    const result = await callRegistry("/door-release", postJson({ ip: data.ip }));
    return { authorized: true, released: result?.["released"] === true };
  });

/**
 * A session that verified ALL the way through the operator
 * gate (registry + MFA) clears its own address's strike
 * record: the restriction guards the door against strangers,
 * and the house does not lock its verified keeper out. Called
 * by the gate right after an authorized verification.
 */
export const clearDoorStrikesForSession = createServerFn({ method: "POST" })
  .validator((input: unknown): AccessInput => {
    if (
      typeof input !== "object" ||
      input === null ||
      !isAccessToken((input as AccessInput).accessToken)
    ) {
      throw new Error("Invalid door clear request.");
    }
    return input as AccessInput;
  })
  .handler(async ({ data }): Promise<{ authorized: boolean; cleared: boolean }> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) return { authorized: false, cleared: false };
    const ip = clientIpFromRequest(getRequest());
    if (!isDoorIpUsable(ip)) return { authorized: true, cleared: false };
    const current = await statusForIp(ip);
    if (!current.available || (current.strikes === 0 && !current.restricted)) {
      return { authorized: true, cleared: false };
    }
    const result = await callRegistry("/door-release", postJson({ ip }));
    return { authorized: true, cleared: result?.["released"] === true };
  });
