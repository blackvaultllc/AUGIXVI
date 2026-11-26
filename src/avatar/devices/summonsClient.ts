/**
 * THE SUMMONS' CLIENT ROAD (cybernetic pass, 2026-11-26): when a
 * Summons transition fires on the stage, its line is written to
 * the core's append-only events record (logSummonsEvent in
 * eventsLog.server.ts — the record the Logs window reads). The
 * token comes from the signed-in operator session, the same road
 * the Daddy Inbox client uses. Fire-and-forget by design: with
 * no operator session or no core, the write simply does not
 * land — the Captain's notify() and the device card's own
 * presence log still carry the record on this surface, and
 * nothing anywhere pretends the core line was written.
 */
import { logSummonsEvent } from "../eventsLog.server";
import { operatorAccessToken } from "../learner/daddyInboxClient";

export function recordSummonsInCore(line: string): void {
  void (async () => {
    const accessToken = await operatorAccessToken().catch(() => null);
    if (!accessToken) return;
    await logSummonsEvent({ data: { accessToken, line } }).catch(() => null);
  })();
}
