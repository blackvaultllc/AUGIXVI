import { describe, expect, it } from "vitest";
import {
  BRAIN_STORAGE_KEY,
  DEFAULT_BRAIN_URL,
  loadBrainAddress,
  normalizeBrainAddress,
  saveBrainAddress,
} from "@/avatar/brain";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    map,
  };
}

describe("normalizeBrainAddress", () => {
  it("defaults a bare host to Ollama's port over http", () => {
    expect(normalizeBrainAddress("192.168.1.50")).toBe("http://192.168.1.50:11434");
    expect(normalizeBrainAddress("parrot-pc")).toBe("http://parrot-pc:11434");
    expect(normalizeBrainAddress("pc.example.ts.net")).toBe("http://pc.example.ts.net:11434");
  });

  it("keeps an explicit scheme and port, and trims trailing slashes", () => {
    expect(normalizeBrainAddress("http://192.168.1.50:11434")).toBe("http://192.168.1.50:11434");
    expect(normalizeBrainAddress("100.101.102.103:11434/")).toBe("http://100.101.102.103:11434");
    expect(normalizeBrainAddress("https://pc.example.ts.net")).toBe(
      "https://pc.example.ts.net:11434",
    );
    expect(normalizeBrainAddress("192.168.1.50:8080")).toBe("http://192.168.1.50:8080");
  });

  it("treats empty input as 'this device' — the default", () => {
    expect(normalizeBrainAddress("")).toBe(DEFAULT_BRAIN_URL);
    expect(normalizeBrainAddress("   ")).toBe(DEFAULT_BRAIN_URL);
    expect(normalizeBrainAddress("localhost")).toBe(DEFAULT_BRAIN_URL);
  });

  it("rejects what cannot be a brain address", () => {
    expect(normalizeBrainAddress("not an address")).toBeNull();
    expect(normalizeBrainAddress("192.168.1.50/some/path")).toBeNull();
    expect(normalizeBrainAddress("host:99999")).toBeNull();
    expect(normalizeBrainAddress("host:0")).toBeNull();
    expect(normalizeBrainAddress("http://")).toBeNull();
  });
});

describe("brain address storage", () => {
  it("round-trips a saved address, normalized", () => {
    const s = fakeStorage();
    expect(saveBrainAddress("192.168.1.50", s)).toBe("http://192.168.1.50:11434");
    expect(s.map.get(BRAIN_STORAGE_KEY)).toBe("http://192.168.1.50:11434");
    expect(loadBrainAddress(s)).toBe("http://192.168.1.50:11434");
  });

  it("falls back to the default when nothing is saved or the save is garbage", () => {
    const s = fakeStorage();
    expect(loadBrainAddress(s)).toBe(DEFAULT_BRAIN_URL);
    s.map.set(BRAIN_STORAGE_KEY, "not an address");
    expect(loadBrainAddress(s)).toBe(DEFAULT_BRAIN_URL);
  });

  it("refuses to save an invalid address", () => {
    const s = fakeStorage();
    expect(saveBrainAddress("no good", s)).toBeNull();
    expect(s.map.size).toBe(0);
  });

  it("never throws without storage (server render)", () => {
    expect(loadBrainAddress(null)).toBe(DEFAULT_BRAIN_URL);
    expect(saveBrainAddress("192.168.1.50", null)).toBe("http://192.168.1.50:11434");
  });
});
