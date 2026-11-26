/**
 * PERSONAL SAFETY PASS — vault, voice distinction, law base,
 * stop mode (owner order 2026-11-26).
 *
 * What these tests pin:
 *   · THE SHIPPING RULE: every law-base seed entry carries a
 *     source (name + citation) and jurisdiction, and the
 *     sanitizer DROPS any entry that loses them — an entry
 *     without a verifiable source does not ship.
 *   · Claim check: matches / contradicts / not-in-base, with
 *     related-topic surfacing and NO stretched verdicts.
 *   · Guidance is template-bound: lines exist only where an
 *     entry carries scripts, and every line cites its entry.
 *   · Stop triggers: his declaration, the officer keyword set,
 *     the release phrases, the claim-shape gate.
 *   · The vault: core-named files only (bare names, no paths),
 *     sanitizers, and a store round-trip in a scratch HOME —
 *     write, read back, remove.
 *   · Voice distinction: the speaker label mapping, the
 *     strengthening gate (capped, captain-matches only by
 *     construction of its inputs), and presence sanitizer
 *     round-trips — old records without a speaker still read.
 *   · Evidence: session sanitizers and a store round-trip.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAW_BASE_GAPS,
  LAW_BASE_HEADER,
  LAW_BASE_SEED,
  checkOfficerClaim,
  detectStopTrigger,
  guidanceForClaim,
  guidanceForEntry,
  isStopRelease,
  looksLikeLegalClaim,
  sanitizeLawBaseFile,
  seededLawBaseFile,
} from "@/avatar/lawBase";
import {
  VAULT_DOC_TYPES,
  extensionForMediaType,
  isAcceptedVaultMediaType,
  isBareVaultFileName,
  sanitizeVaultIndex,
  vaultFileName,
} from "@/avatar/personalVault";
import { emptyEvidenceFile, sanitizeEvidenceFile } from "@/avatar/evidence";
import {
  VOICE_STRENGTHEN_MAX,
  mayStrengthenVoiceprint,
  sanitizePresenceFile,
  speakerLabelFromVerdict,
  speakerLabelWords,
} from "@/avatar/cameras/cameraPresence";

describe("the law base seed — the shipping rule", () => {
  it("carries a source, citation, and jurisdiction on EVERY entry", () => {
    expect(LAW_BASE_SEED.length).toBeGreaterThanOrEqual(12);
    for (const entry of LAW_BASE_SEED) {
      expect(entry.source.name.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.source.citation.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.jurisdiction.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.statement.trim().length, entry.id).toBeGreaterThan(0);
    }
  });

  it("covers the ordered topics: license, consent search, identification, Terry, recording, free to leave, silence, DUI", () => {
    const ids = new Set(LAW_BASE_SEED.map((e) => e.id));
    for (const id of [
      "license-display",
      "consent-search",
      "stop-and-identify",
      "terry-stop-frisk",
      "recording-conversation",
      "recording-police",
      "free-to-leave",
      "silence",
      "dui-implied-consent",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("carries the exact-word scripts the Captain ordered", () => {
    const allScripts = LAW_BASE_SEED.flatMap((e) => e.scripts);
    expect(allScripts).toContain("I do not consent to any searches.");
    expect(allScripts).toContain("Am I being detained, or am I free to leave?");
    expect(allScripts).toContain("I am choosing to remain silent.");
    expect(allScripts).toContain("I want a lawyer.");
  });

  it("states its header plainly — information, not a lawyer", () => {
    expect(LAW_BASE_HEADER).toContain("not a lawyer, not legal advice");
  });

  it("names its gaps instead of covering them", () => {
    expect(LAW_BASE_GAPS.length).toBeGreaterThanOrEqual(4);
    for (const gap of LAW_BASE_GAPS) {
      expect(gap.topic.trim().length).toBeGreaterThan(0);
      expect(gap.note.trim().length).toBeGreaterThan(0);
    }
  });

  it("the sanitizer DROPS an entry that loses its source — it does not ship", () => {
    const file = seededLawBaseFile(1_700_000_000_000);
    const poisoned = {
      ...file,
      entries: [
        ...file.entries,
        {
          id: "invented-law",
          topic: "invented",
          title: "A law somebody made up",
          jurisdiction: "Alabama",
          source: { name: "", citation: "" },
          statement: "You must do whatever anyone says.",
          scripts: [],
          claims: [],
          keywords: [],
        },
        {
          id: "no-citation",
          topic: "invented",
          title: "A real-sounding title with no citation",
          jurisdiction: "Alabama",
          source: { name: "Some blog", citation: "" },
          statement: "Trust me.",
          scripts: [],
          claims: [],
          keywords: [],
        },
      ],
    };
    const clean = sanitizeLawBaseFile(poisoned);
    const ids = clean.entries.map((e) => e.id);
    expect(ids).not.toContain("invented-law");
    expect(ids).not.toContain("no-citation");
    expect(clean.entries.length).toBe(LAW_BASE_SEED.length);
  });
});

describe("claim check — matches, contradicts, or not in the base", () => {
  it("a true claim about the license matches its entry", () => {
    const result = checkOfficerClaim("You have to show me your license", LAW_BASE_SEED);
    expect(result.verdict).toBe("matches");
    expect(result.entry?.id).toBe("license-display");
  });

  it("a false claim about searching on refusal contradicts the consent entry", () => {
    const result = checkOfficerClaim(
      "If you refuse the search I can arrest you",
      LAW_BASE_SEED,
    );
    expect(result.verdict).toBe("contradicts");
    expect(result.entry?.id).toBe("consent-search");
  });

  it("a claim the base has no entry for is NOT IN THE BASE — never stretched", () => {
    const result = checkOfficerClaim(
      "You have to take the field sobriety test or you lose your license",
      LAW_BASE_SEED,
    );
    expect(result.verdict).toBe("not-in-base");
    expect(result.entry).toBeNull();
  });

  it("an unrelated line is not in the base and carries no entry", () => {
    const result = checkOfficerClaim("Nice weather we're having", LAW_BASE_SEED);
    expect(result.verdict).toBe("not-in-base");
    expect(result.entry).toBeNull();
  });

  it("guidance comes ONLY from entries with scripts, and cites its entry", () => {
    const result = checkOfficerClaim(
      "If you refuse the search I can arrest you",
      LAW_BASE_SEED,
    );
    const lines = guidanceForClaim(result);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.entryId).toBe("consent-search");
      expect(line.citation).toContain("Schneckloth");
      expect(line.text).toContain("I do not consent to any searches.");
    }
    const noEntry = checkOfficerClaim("Nice weather we're having", LAW_BASE_SEED);
    expect(guidanceForClaim(noEntry)).toEqual([]);
  });

  it("an entry without scripts yields no guidance lines at all", () => {
    const scriptless = LAW_BASE_SEED.find((e) => e.scripts.length === 0);
    expect(scriptless).toBeDefined();
    expect(guidanceForEntry(scriptless!)).toEqual([]);
  });
});

describe("stop detection — the explicit keyword set", () => {
  it("his declaration starts a stop", () => {
    expect(detectStopTrigger("I'm being pulled over")).toBe("declaration");
    expect(detectStopTrigger("Anubis, start stop mode")).toBe("declaration");
  });

  it("an officer's own stop words mark an official interaction", () => {
    expect(detectStopTrigger("License and registration, please")).toBe("officer");
    expect(detectStopTrigger("Do you know why I stopped you?")).toBe("officer");
    expect(detectStopTrigger("Step out of the vehicle")).toBe("officer");
  });

  it("ordinary talk triggers nothing", () => {
    expect(detectStopTrigger("What's for dinner tonight")).toBeNull();
    expect(detectStopTrigger("Turn the license plate light on")).toBeNull();
  });

  it("the release phrases end a stop — and only those", () => {
    expect(isStopRelease("Anubis, end stop mode")).toBe(true);
    expect(isStopRelease("The stop is over")).toBe(true);
    expect(isStopRelease("You are free to go")).toBe(false);
  });

  it("claim-shaped lines are the ones that get checked", () => {
    expect(looksLikeLegalClaim("You have to get out of the car")).toBe(true);
    expect(looksLikeLegalClaim("It's illegal to record me")).toBe(true);
    expect(looksLikeLegalClaim("Where are you headed tonight")).toBe(false);
  });
});

describe("the personal vault — names and sanitizers", () => {
  it("knows its document types", () => {
    expect(VAULT_DOC_TYPES).toContain("drivers-license");
    expect(VAULT_DOC_TYPES).toContain("passport");
    expect(VAULT_DOC_TYPES).toContain("vehicle-title");
  });

  it("file names are core-made and bare — never a path", () => {
    const name = vaultFileName("drivers-license", 1_700_000_000_000, "ab12cd", "jpg");
    expect(isBareVaultFileName(name)).toBe(true);
    expect(name).not.toContain("/");
    expect(isBareVaultFileName("../secret.jpg")).toBe(false);
    expect(isBareVaultFileName("a/b.jpg")).toBe(false);
    expect(isBareVaultFileName("")).toBe(false);
  });

  it("accepts only picture and PDF media", () => {
    expect(isAcceptedVaultMediaType("image/jpeg")).toBe(true);
    expect(isAcceptedVaultMediaType("application/pdf")).toBe(true);
    expect(isAcceptedVaultMediaType("application/zip")).toBe(false);
    expect(extensionForMediaType("image/png")).toBe("png");
  });

  it("the index sanitizer drops malformed documents and path-carrying files", () => {
    const clean = sanitizeVaultIndex({
      documents: [
        {
          id: "d1",
          type: "passport",
          label: "Passport",
          file: "passport-1-ab.pdf",
          mediaType: "application/pdf",
          addedAt: 5,
          bytes: 10,
        },
        {
          id: "d2",
          type: "passport",
          label: "Escape attempt",
          file: "../etc/passwd",
          mediaType: "application/pdf",
          addedAt: 5,
          bytes: 10,
        },
        { id: "d3", type: "not-a-type", label: "x", file: "x.jpg", mediaType: "image/jpeg", addedAt: 5, bytes: 1 },
      ],
    });
    expect(clean.documents.map((d) => d.id)).toEqual(["d1"]);
  });
});

describe("voice distinction — labels, never numbers", () => {
  it("maps the voiceprint verdict to the three honest states", () => {
    expect(speakerLabelFromVerdict(true, true)).toBe("captain");
    expect(speakerLabelFromVerdict(true, false)).toBe("another");
    expect(speakerLabelFromVerdict(false, null)).toBeNull();
    expect(speakerLabelFromVerdict(true, null)).toBeNull();
    expect(speakerLabelFromVerdict(false, true)).toBeNull();
  });

  it("words the labels without any score", () => {
    expect(speakerLabelWords("captain")).toContain("the Captain");
    expect(speakerLabelWords("another")).toContain("another person");
    expect(speakerLabelWords(null)).toBeNull();
  });

  it("strengthening is gated: enrolled, idle, under the cap, room in the set", () => {
    const base = { enrolled: true, pendingSamples: 0, samples: 5, maxSamples: 10, alreadyAdded: 0 };
    expect(mayStrengthenVoiceprint(base)).toBe(true);
    expect(mayStrengthenVoiceprint({ ...base, enrolled: false })).toBe(false);
    expect(mayStrengthenVoiceprint({ ...base, pendingSamples: 2 })).toBe(false);
    expect(mayStrengthenVoiceprint({ ...base, alreadyAdded: VOICE_STRENGTHEN_MAX })).toBe(false);
    expect(mayStrengthenVoiceprint({ ...base, samples: 10 })).toBe(false);
    expect(mayStrengthenVoiceprint({ ...base, samples: null })).toBe(false);
  });

  it("presence records round-trip the speaker — and old records without one still read", () => {
    const legacy = sanitizePresenceFile({
      hearing: [
        { id: "h1", cameraId: "c1", cameraName: "Front", at: 10, text: "hello", acted: "" },
      ],
    });
    expect(legacy.hearing[0]?.speaker ?? null).toBeNull();
    const labeled = sanitizePresenceFile({
      hearing: [
        { id: "h2", cameraId: "c1", cameraName: "Front", at: 10, text: "hello", acted: "", speaker: "captain" },
        { id: "h3", cameraId: "c1", cameraName: "Front", at: 11, text: "hi", acted: "", speaker: "intruder" },
      ],
    });
    expect(labeled.hearing.find((h) => h.id === "h2")?.speaker).toBe("captain");
    // an unknown label is dropped to no-verdict, never kept
    expect(labeled.hearing.find((h) => h.id === "h3")?.speaker ?? null).toBeNull();
  });
});

describe("evidence records — sanitizers", () => {
  it("round-trips a finished stop with its claims and guidance", () => {
    const file = sanitizeEvidenceFile({
      active: null,
      stops: [
        {
          id: "stop-1",
          startedAt: 100,
          endedAt: 200,
          trigger: "declaration",
          triggerText: "I'm being pulled over",
          cameraId: "c1",
          cameraName: "Front",
          recording: { file: "stop-1.mkv", startedAt: 100, stoppedAt: 200, bytes: 42 },
          claims: [
            {
              at: 150,
              claim: "You have to show me your license",
              verdict: "matches",
              entryId: "license-display",
              note: "stands on the entry",
              source: "heard",
            },
          ],
          guidance: [{ at: 151, text: "Say this: “…”", entryId: "license-display", citation: "Ala. Code § 32-6-9" }],
          endKind: "his-word",
          lastHeardAt: 190,
        },
      ],
    });
    expect(file.stops).toHaveLength(1);
    expect(file.stops[0]?.claims[0]?.verdict).toBe("matches");
    expect(file.stops[0]?.endKind).toBe("his-word");
    expect(emptyEvidenceFile()).toEqual({ active: null, stops: [] });
  });

  it("drops a stop whose recording file carries a path", () => {
    const file = sanitizeEvidenceFile({
      active: null,
      stops: [
        {
          id: "stop-2",
          startedAt: 100,
          endedAt: 200,
          trigger: "panel",
          triggerText: "",
          cameraId: "c1",
          cameraName: "Front",
          recording: { file: "../escape.mkv", startedAt: 100, stoppedAt: 200, bytes: 1 },
          claims: [],
          guidance: [],
          endKind: "panel",
          lastHeardAt: 190,
        },
      ],
    });
    // the session survives only if its recording reference is honest; a
    // path-carrying file name is not a recording this store can serve
    for (const stop of file.stops) {
      expect(stop.recording?.file ?? "").not.toContain("/");
    }
  });
});

describe("the stores — round-trips in a scratch HOME", () => {
  let home: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    originalHome = process.env["HOME"];
    home = mkdtempSync(join(tmpdir(), "personal-safety-"));
    process.env["HOME"] = home;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env["HOME"];
    else process.env["HOME"] = originalHome;
    vi.resetModules();
    rmSync(home, { recursive: true, force: true });
  });

  it("the vault store writes a document, indexes it, reads it back, removes it", async () => {
    const { getPersonalVaultStore } = await import("@/avatar/personalVaultStore.server");
    const store = await getPersonalVaultStore();
    if (!store) throw new Error("the vault store should exist under a node HOME");
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await store.writeDocument("drivers-license-1-ab.jpg", bytes);
    await store.update((file) => ({
      documents: [
        ...file.documents,
        {
          id: "d1",
          type: "drivers-license" as const,
          label: "License",
          file: "drivers-license-1-ab.jpg",
          mediaType: "image/jpeg",
          addedAt: 10,
          bytes: 4,
        },
      ],
    }));
    const index = await store.read();
    expect(index.documents).toHaveLength(1);
    expect(Array.from((await store.readDocument("drivers-license-1-ab.jpg")) ?? [])).toEqual([1, 2, 3, 4]);
    expect(existsSync(join(home, ".local/share/augie/personal-vault/index.json"))).toBe(true);
    await store.removeDocument("drivers-license-1-ab.jpg");
    expect(await store.readDocument("drivers-license-1-ab.jpg")).toBeNull();
  });

  it("the law base store seeds from the repo seed and never overwrites an existing copy", async () => {
    const { getLawBaseStore } = await import("@/avatar/lawBaseStore.server");
    const store = await getLawBaseStore();
    if (!store) throw new Error("the law base store should exist under a node HOME");
    const seeded = await store.read();
    expect(seeded.entries.length).toBe(LAW_BASE_SEED.length);
    const path = join(home, ".local/share/augie/law-base.json");
    expect(existsSync(path)).toBe(true);
    const before = readFileSync(path, "utf8");
    const again = await store.read();
    expect(again.entries.length).toBe(LAW_BASE_SEED.length);
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("the evidence store round-trips a stop record", async () => {
    const { getEvidenceStore } = await import("@/avatar/evidenceStore.server");
    const store = await getEvidenceStore();
    if (!store) throw new Error("the evidence store should exist under a node HOME");
    await store.update((file) => ({
      ...file,
      stops: [
        ...file.stops,
        {
          id: "stop-9",
          startedAt: 1,
          endedAt: 2,
          trigger: "officer" as const,
          triggerText: "License and registration",
          cameraId: "c1",
          cameraName: "Front",
          recording: null,
          claims: [],
          guidance: [],
          endKind: "silence" as const,
          lastHeardAt: 2,
        },
      ],
    }));
    const read = await store.read();
    expect(read.stops.map((s) => s.id)).toContain("stop-9");
  });
});
