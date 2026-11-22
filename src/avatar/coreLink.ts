/**
 * CORE LINK — the phone-to-core client discipline (Part 30).
 *
 * One rule: the status line is EARNED. A surface reads CORE CONNECTED
 * only after a real status round trip says the core store exists and
 * answered. When the core cannot be reached, exchanges are QUEUED in a
 * local outbox (never dropped, never pretended-sent) and flushed in
 * order when the core answers again. When the core store does not
 * exist on the answering server at all (the public Worker), the status
 * is NOT CONFIGURED.
 *
 * This module is the pure part — queue shaping and status derivation,
 * with the transport injected. The live wiring is coreLinkClient.ts.
 */

export type CoreStatus = "connected" | "queued" | "not-configured";

export type QueuedExchange = {
  exchangeId: string;
  question: string;
  answer: string;
  provider: string;
  surface: string;
  queuedAt: string;
};

export const CORE_OUTBOX_KEY = "augi.core.outbox.v1";
export const CORE_OUTBOX_MAX = 200;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isQueued(value: unknown): value is QueuedExchange {
  if (!value || typeof value !== "object") return false;
  const q = value as Partial<QueuedExchange>;
  return (
    typeof q.exchangeId === "string" &&
    typeof q.question === "string" &&
    typeof q.answer === "string" &&
    typeof q.provider === "string" &&
    typeof q.surface === "string" &&
    typeof q.queuedAt === "string"
  );
}

export function loadOutbox(storage?: StorageLike): QueuedExchange[] {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(CORE_OUTBOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isQueued) : [];
  } catch {
    return [];
  }
}

export function saveOutbox(queue: QueuedExchange[], storage?: StorageLike): void {
  try {
    (storage ?? globalThis.localStorage)?.setItem(
      CORE_OUTBOX_KEY,
      JSON.stringify(queue.slice(-CORE_OUTBOX_MAX)),
    );
  } catch {
    // Storage refused: the queue lives in memory for this session only.
  }
}

export function enqueue(queue: QueuedExchange[], item: QueuedExchange): QueuedExchange[] {
  if (queue.some((q) => q.exchangeId === item.exchangeId)) return queue;
  return [...queue, item].slice(-CORE_OUTBOX_MAX);
}

/**
 * The three honest states, derived — never asserted:
 * - a status round trip that found the store → connected
 * - no reachable store, but exchanges are waiting → queued
 * - no store and nothing waiting → not-configured
 */
export function deriveCoreStatus(input: {
  storeAvailable: boolean | null;
  pendingCount: number;
}): CoreStatus {
  if (input.storeAvailable === true) return "connected";
  if (input.pendingCount > 0) return "queued";
  return "not-configured";
}

export function coreStatusLabel(status: CoreStatus): string {
  switch (status) {
    case "connected":
      return "CORE CONNECTED";
    case "queued":
      return "QUEUED";
    case "not-configured":
      return "NOT CONFIGURED";
  }
}

/** What the link needs from the network — implemented by coreLinkClient. */
export interface CoreTransport {
  /** True: store exists and answered. False: answered, no store. Null: unreachable/unauthorized. */
  status(): Promise<boolean | null>;
  append(item: QueuedExchange): Promise<"written" | "duplicate" | "unavailable">;
}

export type CoreLink = {
  /** Send one exchange now; queue it when the core does not take it. */
  record(item: QueuedExchange): Promise<CoreStatus>;
  /** Try to drain the outbox in order; returns how many landed. */
  flush(): Promise<number>;
  /** Probe the core and derive the current status. */
  probe(): Promise<CoreStatus>;
  pending(): number;
};

export function createCoreLink(deps: {
  transport: CoreTransport;
  storage?: StorageLike;
  onStatus?: (status: CoreStatus) => void;
}): CoreLink {
  let queue = loadOutbox(deps.storage);
  let lastStoreAvailable: boolean | null = null;

  const currentStatus = (): CoreStatus =>
    deriveCoreStatus({ storeAvailable: lastStoreAvailable, pendingCount: queue.length });

  const emit = (): CoreStatus => {
    const status = currentStatus();
    deps.onStatus?.(status);
    return status;
  };

  const flush = async (): Promise<number> => {
    let landed = 0;
    while (queue.length > 0) {
      const head = queue[0]!;
      let outcome: "written" | "duplicate" | "unavailable";
      try {
        outcome = await deps.transport.append(head);
      } catch {
        outcome = "unavailable";
      }
      if (outcome === "unavailable") break;
      queue = queue.slice(1);
      saveOutbox(queue, deps.storage);
      landed += 1;
      if (outcome === "written") lastStoreAvailable = true;
    }
    emit();
    return landed;
  };

  return {
    async record(item) {
      queue = enqueue(queue, item);
      saveOutbox(queue, deps.storage);
      await flush();
      return emit();
    },
    flush,
    async probe() {
      try {
        lastStoreAvailable = await deps.transport.status();
      } catch {
        lastStoreAvailable = null;
      }
      if (lastStoreAvailable === true) await flush();
      return emit();
    },
    pending: () => queue.length,
  };
}
