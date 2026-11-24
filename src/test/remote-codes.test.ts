import { describe, expect, it } from "vitest";
import {
  codeCopyText,
  filterNames,
  formatCodeLine,
  loadRfBrandDevices,
  loadRfIndex,
  rawToPronto,
  rfBrandKey,
  searchBrands,
  type RfIndex,
} from "@/avatar/remoteCodes";

const fixtureIndex: RfIndex = {
  generatedAt: "2026-11-24T00:00:00.000Z",
  sources: [
    { id: "flipper-irdb", name: "Flipper IRDB", detail: "test" },
    { id: "irdb", name: "irdb", detail: "test" },
  ],
  totals: { devices: 3, codes: 10, brands: 2 },
  categories: [
    { id: "tv", label: "TVs", devices: 2, brands: ["Samsung", "Sony"] },
    { id: "ac", label: "Air conditioners", devices: 1, brands: ["Samsung"] },
  ],
  brandIndex: {
    Samsung: [
      { category: "tv", devices: 1 },
      { category: "ac", devices: 1 },
    ],
    Sony: [{ category: "tv", devices: 1 }],
  },
  setupLists: [],
};

describe("remote codes — brand keys and search", () => {
  it("brand key matches the ingest shard naming", () => {
    expect(rfBrandKey("Bang & Olufsen")).toBe("bangolufsen");
    expect(rfBrandKey("LG")).toBe("lg");
    expect(rfBrandKey("TCL")).toBe("tcl");
  });

  it("search finds brands by part of the name, with device totals", () => {
    expect(searchBrands(fixtureIndex, "sam")).toEqual([{ brand: "Samsung", devices: 2 }]);
    expect(searchBrands(fixtureIndex, "")).toHaveLength(2);
    expect(searchBrands(fixtureIndex, "zzz")).toEqual([]);
  });

  it("filterNames is a plain substring filter", () => {
    expect(filterNames(["Samsung", "Sony", "Sanyo"], "sa")).toEqual(["Samsung", "Sanyo"]);
    expect(filterNames(["Samsung", "Sony", "Sanyo"], "san")).toEqual(["Sanyo"]);
    expect(filterNames(["Samsung"], "")).toEqual(["Samsung"]);
  });
});

describe("remote codes — loaders", () => {
  it("loads the index and the per-brand shard by URL", async () => {
    const seen: string[] = [];
    const fetchFn = async (url: string) => {
      seen.push(url);
      return {
        ok: true,
        json: async () => (url.endsWith("index.json") ? fixtureIndex : []),
      };
    };
    const idx = await loadRfIndex(fetchFn);
    expect(idx.totals.brands).toBe(2);
    await loadRfBrandDevices("tv", "Bang & Olufsen", fetchFn);
    expect(seen).toEqual([
      "/rf-library/index.json",
      "/rf-library/devices-tv--bangolufsen.json",
    ]);
  });

  it("throws on a missing shard instead of inventing data", async () => {
    const fetchFn = async () => ({ ok: false, json: async () => ({}) });
    await expect(loadRfIndex(fetchFn)).rejects.toThrow();
  });
});

describe("remote codes — formatting", () => {
  it("formats a parsed code as one plain line", () => {
    expect(
      formatCodeLine({ protocol: "NECx2", address: "07 07", command: "1B", sources: ["irdb"] }),
    ).toBe("NECx2 · address 07 07 · code 1B");
  });

  it("formats a raw code with its frequency and timing count", () => {
    expect(
      formatCodeLine({ raw: "8885 4455 547 1667", frequency: 38381, sources: ["flipper-irdb"] }),
    ).toBe("Raw signal · 38,381 Hz · 4 timings");
  });

  it("copy text for a parsed code names the button and the triple", () => {
    const text = codeCopyText(
      { protocol: "NEC", address: "00 DF", command: "1C", sources: ["flipper-irdb"] },
      "Power",
    );
    expect(text).toContain("Power");
    expect(text).toContain("Protocol: NEC");
    expect(text).toContain("Address: 00 DF");
    expect(text).toContain("Code: 1C");
  });
});

describe("remote codes — Pronto conversion", () => {
  it("38 kHz default gives the classic 006D frequency word", () => {
    const pronto = rawToPronto("9000 4500 560 560");
    expect(pronto).not.toBeNull();
    const words = pronto!.split(" ");
    expect(words[0]).toBe("0000");
    expect(words[1]).toBe("006D");
    expect(words[2]).toBe("0002"); // two burst pairs
    expect(words[3]).toBe("0000"); // no repeat section
  });

  it("converts the Flipper sample timings at 38381 Hz", () => {
    // period = 1e6/38381 ≈ 26.05 µs; freq word = round(26.05/0.241246) = 108 = 0x006C
    // 8885 µs ≈ 341 periods = 0x0155; 4455 µs ≈ 171 = 0x00AB
    const pronto = rawToPronto("8885 4455 547 1667", 38381);
    const words = pronto!.split(" ");
    expect(words[1]).toBe("006C");
    expect(words[4]).toBe("0155");
    expect(words[5]).toBe("00AB");
  });

  it("pads an odd timing list with a trailing gap instead of dropping the last burst", () => {
    const pronto = rawToPronto("9000 4500 560");
    const words = pronto!.split(" ");
    expect(words[2]).toBe("0002");
    expect(words).toHaveLength(4 + 4);
  });

  it("refuses junk instead of inventing a code", () => {
    expect(rawToPronto("")).toBeNull();
    expect(rawToPronto("abc")).toBeNull();
    expect(rawToPronto("100")).toBeNull();
  });
});
