/**
 * GATE LOG — operator read endpoint.
 *
 * The log holds source addresses of every knock on the gate, so it is
 * operator-only in fact, not just by placement: the caller passes the
 * same Supabase access token the rooms use, and it is verified with
 * the exact same check (verifySupabaseOperatorSession — registry
 * ownership plus MFA assurance) before a single entry is returned.
 * Anything unverified gets counts of zero and no entries.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { readGateLog } from "./gateLogStore.server";
import type { GateKnock } from "./gateLog";

type GateLogInput = { accessToken: string };

function isGateLogInput(input: unknown): input is GateLogInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "accessToken" in input &&
    typeof input.accessToken === "string" &&
    input.accessToken.length > 0 &&
    input.accessToken.length <= 16_384
  );
}

export interface GateLogView {
  configured: boolean;
  authorized: boolean;
  /** False where the local log store does not exist (e.g. the Worker). */
  available: boolean;
  entries: GateKnock[];
  total: number;
}

export const getGateLog = createServerFn({ method: "POST" })
  .validator((input: unknown): GateLogInput => {
    if (!isGateLogInput(input)) {
      throw new Error("Invalid gate log request.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<GateLogView> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) {
      return {
        configured: verification.configured,
        authorized: false,
        available: false,
        entries: [],
        total: 0,
      };
    }
    const log = await readGateLog();
    return {
      configured: true,
      authorized: true,
      available: log.available,
      entries: log.entries,
      total: log.total,
    };
  });
