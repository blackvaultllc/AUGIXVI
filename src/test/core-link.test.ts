import { describe, expect, it } from "vitest";
import {
  createCoreLink,
  deriveCoreStatus,
  enqueue,
  loadOutbox,
  saveOutbox,
  type CoreTransport,
  type QueuedExchange,
} from "@/avatar/coreLink";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

const item = (id: string): QueuedExchange => ({
  exchangeId: id,
  question: `q ${id}`,
  answer: `a ${id}`,
  provider: "Ollama",
  surface: "phone",
  queuedAt: "2026-11-22T10:00:00.000Z",
});

describe("deriveCoreStatus", () => {
  it("is earned: connected only when the store answered", () => {
    expect(deriveCoreStatus({ storeAvailable: true, pendingCount: 0 })).toBe("connected");
    expect(deriveCoreStatus({ storeAvailable: true, pendingCount: 3 })).toBe("connected");
  });
  it("reads queued when the core is away and exchanges wait", () => {
    expect(deriveCoreStatus({ storeAvailable: null, pendingCount: 2 })).toBe("queued");
    expect(deriveCoreStatus({ storeAvailable: false, pendingCount: 1 })).toBe("queued");
  });
  it("reads not-configured when no store answers and nothing waits", () => {
    expect(deriveCoreStatus({ storeAvailable: null, pendingCount: 0 })).toBe("not-configured");
    expect(deriveCoreStatus({ storeAvailable: false, pendingCount: 0 })).toBe("not-configured");
  });
});

describe("outbox", () => {
  it("dedupes by exchange id and persists", () => {
    const storage = fakeStorage();
    let queue = enqueue([], item("ex-1"));
    queue = enqueue(queue, item("ex-1"));
    expect(queue).toHaveLength(1);
    saveOutbox(queue, storage);
    expect(loadOutbox(storage)).toHaveLength(1);
  });
});

describe("createCoreLink", () => {
  it("writes straight through when the core answers", async () => {
    const written: string[] = [];
    const transport: CoreTransport = {
      status: async () => true,
      append: async (it) => {
        written.push(it.exchangeId);
        return "written";
      },
    };
    const link = createCoreLink({ transport, storage: fakeStorage() });
    const status = await link.record(item("ex-a"));
    expect(status).toBe("connected");
    expect(written).toEqual(["ex-a"]);
    expect(link.pending()).toBe(0);
  });

  it("queues while the core is down and flushes in order on reconnect", async () => {
    let up = false;
    const written: string[] = [];
    const transport: CoreTransport = {
      status: async () => (up ? true : null),
      append: async (it) => {
        if (!up) return "unavailable";
        written.push(it.exchangeId);
        return "written";
      },
    };
    const storage = fakeStorage();
    const link = createCoreLink({ transport, storage });
    expect(await link.record(item("ex-1"))).toBe("queued");
    expect(await link.record(item("ex-2"))).toBe("queued");
    expect(link.pending()).toBe(2);
    // The queue survives a fresh link over the same storage (a restart).
    const revived = createCoreLink({ transport, storage });
    expect(revived.pending()).toBe(2);
    up = true;
    expect(await revived.probe()).toBe("connected");
    expect(written).toEqual(["ex-1", "ex-2"]);
    expect(revived.pending()).toBe(0);
  });

  it("treats a duplicate as landed, not as a failure", async () => {
    const transport: CoreTransport = {
      status: async () => true,
      append: async () => "duplicate",
    };
    const link = createCoreLink({ transport, storage: fakeStorage() });
    await link.record(item("ex-dup"));
    expect(link.pending()).toBe(0);
  });
});
