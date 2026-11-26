/**
 * NOTIFICATIONS RUNTIME — node-only, server-side. The living
 * half of the notifications pass (owner orders 2026-11-26):
 *
 * On every read of the inbox or the feed (and on the stage's
 * alert poll), the runtime re-derives both records from the
 * real sources that already exist in the core:
 *
 *   · the SECTOR record (events, judgments, watch log) →
 *     CAPTURE entries, the suggestion rule set, and the
 *     property feed (through the feed store's wall — the
 *     derivation only ever offers front-zone records, and the
 *     wall refuses anything else regardless);
 *   · the PRESENCE record → the household count the
 *     enrollment suggestion (S3) stands on;
 *   · the CORE EVENTS LOG (augie-events) → SYSTEM entries,
 *     one per real self-activity line.
 *
 * Derivation is deterministic (cameras/anubisInbox.ts): the
 * same records produce the same entry ids, the store merge
 * dedupes by id, and the Captain's read marks survive.
 * Nothing is fabricated: a source with nothing to say adds
 * nothing. A failed reconcile is silent — the records
 * themselves stand, and the next read tries again.
 */
import { getSectorWatchStore } from "./sectorWatchStore.server";
import { getCameraPresenceStore } from "./cameraPresenceStore.server";
import { getNotificationsStore } from "./notificationsStore.server";
import { getPropertyFeedStore } from "./propertyFeedStore.server";
import {
  deriveNotifications,
  mergeDerivedEntries,
  type CoreEventRef,
} from "./cameras/anubisInbox";
import { derivePropertyFeed } from "./cameras/propertyFeed";
import { effectiveHousehold } from "./cameras/cameraPresence";

/** A stable id for a core events-log line (the log itself carries no ids). */
function coreEventRefId(atIso: string, type: string, summary: string): string {
  const at = Date.parse(atIso) || 0;
  let h = 0;
  const s = `${atIso}|${type}|${summary}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `core-${at}-${(h >>> 0).toString(36)}`;
}

/** Re-derive the inbox and the property feed from the core's real records. */
export async function reconcileNotifications(): Promise<void> {
  try {
    const [sectorStore, presenceStore, inboxStore, feedStore] = await Promise.all([
      getSectorWatchStore(),
      getCameraPresenceStore(),
      getNotificationsStore(),
      getPropertyFeedStore(),
    ]);
    if (!sectorStore || !inboxStore) return;
    const sector = await sectorStore.read();
    const householdCount = presenceStore
      ? effectiveHousehold(await presenceStore.read()).length
      : 0;
    const { readAugieEvents } = await import("./eventsLog.server");
    const rawEvents = await readAugieEvents(200).catch(() => []);
    const coreEvents: CoreEventRef[] = rawEvents
      .map((e) => ({
        id: coreEventRefId(e.at, e.type, e.summary),
        at: Date.parse(e.at) || 0,
        type: e.type,
        summary: e.summary,
        detail: e.detail ?? "",
      }))
      .filter((e) => e.at > 0);
    const derived = deriveNotifications({ sector, householdCount, coreEvents });
    if (derived.length > 0) {
      await inboxStore.update((file) => mergeDerivedEntries(file, derived));
    }
    if (feedStore) {
      // Through the wall, always: append() refuses any entry
      // whose zone is not the outside (front) zone.
      await feedStore.append(derivePropertyFeed(sector));
    }
  } catch {
    // derivation is a duty, not a dependency — the records stand
  }
}
