/**
 * NOTIFICATIONS — the server functions (notifications pass,
 * owner orders 2026-11-26). Operator-only, like the camera
 * system itself: every function re-verifies the operator
 * session. What crosses the wire is inbox STATE, feed STATE,
 * and the export text — never a password, never a frame (kept
 * stills are served by the sector door, getSectorStill, under
 * its own record check).
 *
 * Reads reconcile first: the inbox and the feed are derived
 * from the core's real records at read time, so what the
 * Captain sees is never staler than his last look — and
 * nothing appears that no real record stands behind.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { getNotificationsStore } from "./notificationsStore.server";
import { getPropertyFeedStore } from "./propertyFeedStore.server";
import { reconcileNotifications } from "./notificationsRuntime.server";
import {
  unreadNotifications,
  type AnubisNotification,
} from "./cameras/anubisInbox";
import {
  propertyFeedExportText,
  type PropertyFeedEntry,
} from "./cameras/propertyFeed";

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

/* ------------------------------ the inbox ------------------------------ */

export type InboxView = {
  authorized: boolean;
  storageAvailable: boolean;
  entries: AnubisNotification[];
  unread: number;
};

const emptyInbox: InboxView = {
  authorized: false,
  storageAvailable: false,
  entries: [],
  unread: 0,
};

export const getNotifications = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid notifications request.");
    return input;
  })
  .handler(async ({ data }): Promise<InboxView> => {
    if (!(await authorized(data.accessToken))) return emptyInbox;
    await reconcileNotifications();
    const store = await getNotificationsStore();
    if (!store) return { ...emptyInbox, authorized: true };
    const file = await store.read();
    return {
      authorized: true,
      storageAvailable: true,
      entries: file.entries,
      unread: unreadNotifications(file).length,
    };
  });

export type InboxState = { authorized: boolean; storageAvailable: boolean; unread: number };

/** The stage poll's light read: the notification button's real unread count. */
export const getInboxState = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid inbox state request.");
    return input;
  })
  .handler(async ({ data }): Promise<InboxState> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, storageAvailable: false, unread: 0 };
    }
    await reconcileNotifications();
    const store = await getNotificationsStore();
    if (!store) return { authorized: true, storageAvailable: false, unread: 0 };
    const file = await store.read();
    return {
      authorized: true,
      storageAvailable: true,
      unread: unreadNotifications(file).length,
    };
  });

export type NoteResult = { authorized: boolean; ok: boolean; note: string };

export type MarkReadInput = TokenInput & { entryId: string };

export const markNotificationRead = createServerFn({ method: "POST" })
  .validator((input: unknown): MarkReadInput => {
    if (!isTokenInput(input) || typeof (input as MarkReadInput).entryId !== "string") {
      throw new Error("Invalid mark-read request.");
    }
    return input as MarkReadInput;
  })
  .handler(async ({ data }): Promise<NoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const store = await getNotificationsStore();
    if (!store) {
      return { authorized: true, ok: false, note: "The inbox lives on the core machine — no local store here." };
    }
    let found = false;
    await store.update((file) => ({
      entries: file.entries.map((e) => {
        if (e.id !== data.entryId) return e;
        found = true;
        return { ...e, read: true };
      }),
    }));
    return found
      ? { authorized: true, ok: true, note: "Marked read." }
      : { authorized: true, ok: false, note: "That entry is not in the inbox." };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid mark-all-read request.");
    return input;
  })
  .handler(async ({ data }): Promise<NoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const store = await getNotificationsStore();
    if (!store) {
      return { authorized: true, ok: false, note: "The inbox lives on the core machine — no local store here." };
    }
    await store.update((file) => ({
      entries: file.entries.map((e) => (e.read ? e : { ...e, read: true })),
    }));
    return { authorized: true, ok: true, note: "Everything in the inbox is marked read. The entries stay on the record." };
  });

/* ------------------------------ the property feed ------------------------------ */

export type PropertyFeedView = {
  authorized: boolean;
  storageAvailable: boolean;
  entries: PropertyFeedEntry[];
};

const emptyFeed: PropertyFeedView = { authorized: false, storageAvailable: false, entries: [] };

export const getPropertyFeed = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid property feed request.");
    return input;
  })
  .handler(async ({ data }): Promise<PropertyFeedView> => {
    if (!(await authorized(data.accessToken))) return emptyFeed;
    await reconcileNotifications();
    const store = await getPropertyFeedStore();
    if (!store) return { ...emptyFeed, authorized: true };
    const file = await store.read();
    return { authorized: true, storageAvailable: true, entries: file.entries };
  });

export type PropertyFeedExport = {
  authorized: boolean;
  ok: boolean;
  fileName: string;
  content: string;
  note: string;
};

/**
 * The export: one JSON file — the feed, with every referenced
 * image listed by name — for the Captain to hand to the
 * Bellwood Haven records. The images themselves stay on the
 * core in sector-events/ and travel as files.
 */
export const exportPropertyFeed = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid property feed export request.");
    return input;
  })
  .handler(async ({ data }): Promise<PropertyFeedExport> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, fileName: "", content: "", note: "The operator session is gone — sign in again." };
    }
    await reconcileNotifications();
    const store = await getPropertyFeedStore();
    if (!store) {
      return { authorized: true, ok: false, fileName: "", content: "", note: "The property feed lives on the core machine — no local store here." };
    }
    const file = await store.read();
    const now = new Date();
    const fileName = `anubis-property-feed-${now.toISOString().slice(0, 10)}.json`;
    return {
      authorized: true,
      ok: true,
      fileName,
      content: propertyFeedExportText(file, now.getTime()),
      note: `Export ready: ${file.entries.length} feed ${file.entries.length === 1 ? "entry" : "entries"}. The pictures named in it live on the core in ~/.local/share/augie/sector-events/.`,
    };
  });
