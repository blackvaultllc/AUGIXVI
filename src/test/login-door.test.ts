import { describe, expect, it } from "vitest";
import {
  CAPTAIN_KEY_GOD_NAME,
  godKeyDoorPath,
  normalizeGodKey,
  resolveGodKey,
} from "@/avatar/loginDoor";
import {
  LANDING_WEAVE_MESSAGE,
  byteBits,
  createWovenGlyphSource,
  decodeBytes,
  extractWovenMessage,
  newMatrixDrop,
  stepMatrixDrops,
  wovenByteStream,
} from "@/avatar/matrixWall";
import {
  clearSavedLogin,
  readSavedLogin,
  sanitizeSavedLogin,
  writeSavedLogin,
  type KeyValueStorage,
  type SavedLogin,
} from "@/avatar/savedLogin";

/**
 * THE FRONT DOOR (owner order 2026-11-27 ~23:18 CST): the
 * god-name key, resolved through the company's seats; the
 * woven cover in the landing rain; and the saved login that
 * passes the name door on return.
 */
describe("the god-name key", () => {
  it("the Captain's key is Anubis, and it opens the operator door", () => {
    expect(CAPTAIN_KEY_GOD_NAME).toBe("Anubis");
    const match = resolveGodKey("Anubis");
    expect(match).not.toBeNull();
    expect(match?.seat).toBe(0);
    expect(match?.door).toBe("operator");
    expect(godKeyDoorPath(match!.door)).toBeNull(); // opens in place
  });

  it("Violet's god opens her own door, Khadija's god opens hers", () => {
    const violet = resolveGodKey("Hathor");
    expect(violet?.seat).toBe(11);
    expect(violet?.door).toBe("violet");
    expect(godKeyDoorPath(violet!.door)).toBe("/violet");
    const khadija = resolveGodKey("Osiris");
    expect(khadija?.seat).toBe(1);
    expect(khadija?.door).toBe("learner");
    expect(godKeyDoorPath(khadija!.door)).toBe("/learner");
  });

  it("the key forgives case and stray spaces, nothing else", () => {
    expect(resolveGodKey("  anubis ")?.door).toBe("operator");
    expect(resolveGodKey("HATHOR")?.door).toBe("violet");
    expect(normalizeGodKey("  A  B ")).toBe("a b");
  });

  it("a wrong name opens nothing — and neither do almost-right ones", () => {
    for (const wrong of [
      "",
      "   ",
      "Ra",
      "Zeus",
      "Anubis2",
      "Anu",
      "Zero",
      "Domenick",
      "Captain",
      "Hathor the Golden One",
    ]) {
      expect(resolveGodKey(wrong), wrong).toBeNull();
    }
  });

  it("a god with no seated person is not a key — Montu opens nothing here", () => {
    // Montu stands in the structure as the Captain's own and
    // guards the gate, but no seat carries him as its god; the
    // Captain's key is Anubis by his own word.
    expect(resolveGodKey("Montu")).toBeNull();
  });

  it("unseated names and unnamed gods open nothing — nothing is invented", () => {
    // Seats 2–10 and 12–15 carry no person and no named god in
    // the company's record (the sons' gods are held by order);
    // no name drawn from them can be a key.
    expect(resolveGodKey("Britt")).toBeNull();
    expect(resolveGodKey("DeJuan")).toBeNull();
    expect(resolveGodKey("Horus")).toBeNull();
    expect(resolveGodKey("Sekhmet")).toBeNull();
  });
});

describe("the woven cover", () => {
  // A tame rng: every "random" byte is 01010101 — extraction
  // must still find the message, because the weave's structure
  // (message byte, noise byte) does not depend on the noise.
  const tame = () => 0.4;

  it("the message is the authorization cover, in bytes", () => {
    expect(LANDING_WEAVE_MESSAGE).toBe("NO AUTHORIZATION");
    expect(byteBits("A")).toBe("01000001");
    expect(byteBits(" ")).toBe("00100000");
  });

  it("the even bytes of the woven stream spell the message", () => {
    const stream = wovenByteStream(LANDING_WEAVE_MESSAGE, tame);
    expect(stream).toHaveLength(LANDING_WEAVE_MESSAGE.length * 2);
    expect(extractWovenMessage(stream)).toBe(LANDING_WEAVE_MESSAGE);
    // The odd bytes are noise: the whole stream is NOT the
    // message — read whole, it is rain.
    expect(decodeBytes(stream)).not.toBe(LANDING_WEAVE_MESSAGE);
    for (const bits of stream) expect(bits).toMatch(/^[01]{8}$/);
  });

  it("a glyph source drawn from the weave repeats the message forever", () => {
    // Aligned at the stream's head (an rng of 0 starts the
    // cursor at 0): two full passes decode to the message,
    // twice — the source wraps and the cover repeats.
    const aligned = createWovenGlyphSource(LANDING_WEAVE_MESSAGE, () => 0);
    const passBits = LANDING_WEAVE_MESSAGE.length * 16;
    const bits = aligned(passBits * 2);
    const bytes: string[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(bits.slice(i, i + 8));
    expect(extractWovenMessage(bytes.slice(0, LANDING_WEAVE_MESSAGE.length * 2))).toBe(
      LANDING_WEAVE_MESSAGE,
    );
    expect(extractWovenMessage(bytes.slice(LANDING_WEAVE_MESSAGE.length * 2))).toBe(
      LANDING_WEAVE_MESSAGE,
    );
    // At any starting offset, what a drop draws is one
    // contiguous slice of the cyclic woven stream — the rain
    // is the stream, wherever a drop joins it.
    const stream = wovenByteStream(LANDING_WEAVE_MESSAGE, tame).join("");
    const wandering = createWovenGlyphSource(LANDING_WEAVE_MESSAGE, tame);
    const slice = wandering(64);
    expect(stream + stream).toContain(slice);
  });

  it("woven drops carry only 0s and 1s, and stepping never tears the weave", () => {
    const source = createWovenGlyphSource(LANDING_WEAVE_MESSAGE, tame);
    let drops = [newMatrixDrop(40, 9, tame, source)];
    expect(drops[0]!.glyphs).toMatch(/^[01]{9}$/);
    // A hostile rng that would flip every glyph it is offered:
    // woven drops must not flip — the message is the cargo.
    const hostile = () => 0;
    for (let i = 0; i < 30; i++) {
      drops = stepMatrixDrops(drops, 40, 9, hostile, source);
      expect(drops[0]!.glyphs).toMatch(/^[01]{9}$/);
    }
  });
});

describe("the saved login", () => {
  function fakeStorage(): KeyValueStorage & { map: Map<string, string> } {
    const map = new Map<string, string>();
    return {
      map,
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => {
        map.set(key, value);
      },
      removeItem: (key) => {
        map.delete(key);
      },
    };
  }

  const record: SavedLogin = {
    seat: 0,
    godName: "Anubis",
    personName: "Domenick Arlon Hall",
    savedAt: "2026-11-28T05:30:00.000Z",
    device: { userAgent: "Test Browser", platform: "TestOS", language: "en-US" },
  };

  it("saves, reads back, and forgets — the whole device record", () => {
    const storage = fakeStorage();
    expect(readSavedLogin(storage)).toBeNull();
    writeSavedLogin(storage, record);
    expect(readSavedLogin(storage)).toEqual(record);
    clearSavedLogin(storage);
    expect(readSavedLogin(storage)).toBeNull();
  });

  it("a torn or foreign record reads as no record", () => {
    const storage = fakeStorage();
    storage.setItem("augi.saved-login.v1", "{not json");
    expect(readSavedLogin(storage)).toBeNull();
    storage.setItem("augi.saved-login.v1", JSON.stringify({ seat: 99, godName: "Anubis" }));
    expect(readSavedLogin(storage)).toBeNull();
    expect(sanitizeSavedLogin(null)).toBeNull();
    expect(sanitizeSavedLogin({ ...record, seat: 16 })).toBeNull();
    expect(sanitizeSavedLogin({ ...record, godName: "" })).toBeNull();
  });

  it("the saved god-name still has to resolve — a stale record passes nothing", () => {
    // The gate re-resolves the saved name through the seats on
    // every return; a name the record no longer seats opens
    // nothing, saved or not.
    const stale: SavedLogin = { ...record, seat: 7, godName: "Montu" };
    expect(resolveGodKey(stale.godName)).toBeNull();
    const live: SavedLogin = { ...record };
    expect(resolveGodKey(live.godName)?.seat).toBe(live.seat);
  });
});
