import { beforeEach, describe, expect, it } from "vitest";
import {
  LEARNER_ALLOWED_PATHS,
  endLearnerSession,
  enterWithRememberedDevice,
  forgetLearnerDevice,
  hasRememberedLearnerDevice,
  isLearnerSessionActive,
  isOperatorPath,
  learnerCanAccess,
  loadLearnerSession,
  rememberLearnerDevice,
  startLearnerSession,
  validateLearnerSignIn,
} from "@/avatar/learner/learnerProfile";
import {
  DIARY_STORAGE_KEY,
  addDiaryEntry,
  isDiarySetUp,
  loadDiaryVault,
  readDiaryEntries,
  setupDiary,
  unlockDiary,
} from "@/avatar/learner/diaryCrypto";
import {
  deleteProject,
  deleteSquishy,
  loadProjects,
  loadSquishies,
  saveProject,
  saveSquishy,
} from "@/avatar/learner/learnerStore";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("Khadija's sign-in identity", () => {
  it("accepts her full name and birth year, forgiving case and spacing", () => {
    expect(validateLearnerSignIn("Khadija Leila Hall", "2019")).toBe(true);
    expect(validateLearnerSignIn("  khadija   leila hall ", 2019)).toBe(true);
  });

  it("rejects a wrong name or a wrong year", () => {
    expect(validateLearnerSignIn("Khadija Hall", "2019")).toBe(false);
    expect(validateLearnerSignIn("Khadija Leila Hall", "2018")).toBe(false);
    expect(validateLearnerSignIn("Domenick Hall", "2019")).toBe(false);
    expect(validateLearnerSignIn("", "")).toBe(false);
  });

  it("keeps her session in sessionStorage, apart from everything else", () => {
    expect(isLearnerSessionActive()).toBe(false);
    startLearnerSession();
    expect(isLearnerSessionActive()).toBe(true);
    expect(loadLearnerSession()?.name).toBe("Khadija Leila Hall");
    endLearnerSession();
    expect(isLearnerSessionActive()).toBe(false);
  });
});

describe("the wall — learner route space", () => {
  it("allows only her own routes and the game file", () => {
    for (const path of LEARNER_ALLOWED_PATHS) {
      expect(learnerCanAccess(path)).toBe(true);
    }
    expect(learnerCanAccess("/learner?from=heart")).toBe(true);
  });

  it("denies every operator surface to a learner session", () => {
    const operatorPaths = [
      "/avatar",
      "/avatar/cube",
      "/avatar/analyze",
      "/avatar/game",
      "/api/transcribe",
      "/",
    ];
    for (const path of operatorPaths) {
      expect(learnerCanAccess(path)).toBe(false);
    }
    expect(isOperatorPath("/avatar/cube")).toBe(true);
    expect(isOperatorPath("/avatar")).toBe(true);
    expect(isOperatorPath("/learner")).toBe(false);
  });

  it("allows her Squishy Maker, her art, and the Flower's ask doorway — exactly those", () => {
    expect(learnerCanAccess("/learner/squishy")).toBe(true);
    expect(learnerCanAccess("/games/squishy-maker/index.html")).toBe(true);
    expect(learnerCanAccess("/games/squishy-maker/actions")).toBe(true);
    expect(learnerCanAccess("/games/squishy-maker/assets/index-rz1jvtdr.js")).toBe(true);
    expect(learnerCanAccess("/games/squishy-maker/assets/index-er1n5jmk.css")).toBe(true);
    expect(learnerCanAccess("/learner-art/princess-squishy.webp")).toBe(true);
    expect(learnerCanAccess("/api/learner/ask")).toBe(true);
    expect(learnerCanAccess("/learner/racing")).toBe(true);
  });

  it("still denies the operator's APIs and every neighbouring path", () => {
    const denied = [
      "/api/transcribe",
      "/api/library/catalog",
      "/api/library/search",
      "/api/library/article",
      "/api/voiceprint/status",
      "/api/learner",
      "/api/learner/ask/extra",
      "/learner/racing/extra",
      "/learner/squishy/extra",
      "/learner/art",
      "/games",
      "/games/squishy-maker",
      "/games/squishy-maker/other.html",
      "/learner-art/../avatar",
      "/avatar/world",
      "/avatar/analyze",
    ];
    for (const path of denied) {
      expect(learnerCanAccess(path), path).toBe(false);
    }
  });
});

describe("her remembered device — one tap back in (Part 8)", () => {
  it("a device that never enrolled her cannot fast-enter", () => {
    expect(hasRememberedLearnerDevice()).toBe(false);
    expect(enterWithRememberedDevice()).toBe(false);
    expect(isLearnerSessionActive()).toBe(false);
  });

  it("after enrollment, the same device re-enters directly — same session, same wall", () => {
    rememberLearnerDevice();
    expect(hasRememberedLearnerDevice()).toBe(true);
    expect(enterWithRememberedDevice()).toBe(true);
    expect(isLearnerSessionActive()).toBe(true);
    // The fast path changes her speed of entry, never her reach:
    expect(learnerCanAccess("/learner")).toBe(true);
    expect(learnerCanAccess("/learner/racing")).toBe(true);
    expect(learnerCanAccess("/avatar")).toBe(false);
    expect(learnerCanAccess("/api/transcribe")).toBe(false);
  });

  it("forgetting the device restores the full sign-in", () => {
    rememberLearnerDevice();
    forgetLearnerDevice();
    expect(hasRememberedLearnerDevice()).toBe(false);
    expect(enterWithRememberedDevice()).toBe(false);
    expect(isLearnerSessionActive()).toBe(false);
  });

  it("a tampered device memory (wrong name) does not count as enrolled", () => {
    localStorage.setItem("augi.learner.device.v1", JSON.stringify({ name: "Somebody Else" }));
    expect(hasRememberedLearnerDevice()).toBe(false);
    expect(enterWithRememberedDevice()).toBe(false);
  });
});

describe("her diary — encrypted, hers alone", () => {
  const unlock = "heart:rose-garden";

  it("round-trips an entry through encryption", async () => {
    const key = await setupDiary(unlock);
    await addDiaryEntry(key, "I saw a rainbow over the garden.");
    const reopened = await unlockDiary(unlock);
    expect(reopened).not.toBeNull();
    const entries = await readDiaryEntries(reopened!);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe("I saw a rainbow over the garden.");
  });

  it("stores no plaintext and no unlock anywhere in storage", async () => {
    const secretText = "MY-VERY-PRIVATE-DIARY-WORDS-12345";
    const key = await setupDiary(unlock);
    await addDiaryEntry(key, secretText);
    const raw = localStorage.getItem(DIARY_STORAGE_KEY) ?? "";
    expect(raw).not.toContain(secretText);
    expect(raw).not.toContain("rose-garden");
    expect(raw).not.toContain("heart:rose");
    const vault = loadDiaryVault();
    expect(vault?.entries[0]?.ciphertext).toBeTruthy();
    expect(JSON.stringify(vault)).not.toContain(secretText);
  });

  it("locks out a wrong unlock and leaks nothing", async () => {
    const key = await setupDiary(unlock);
    await addDiaryEntry(key, "A secret page.");
    expect(await unlockDiary("star:wrong-word")).toBeNull();
    expect(await unlockDiary("heart:rose-garden-2")).toBeNull();
    // The right unlock still works after wrong tries.
    const reopened = await unlockDiary(unlock);
    expect(reopened).not.toBeNull();
    expect((await readDiaryEntries(reopened!))[0]?.text).toBe("A secret page.");
  });

  it("knows whether the diary has been set up", async () => {
    expect(isDiarySetUp()).toBe(false);
    await setupDiary(unlock);
    expect(isDiarySetUp()).toBe(true);
  });
});

describe("squishy gallery storage", () => {
  it("saves a picture and finds it again after a reload (fresh read)", () => {
    const saved = saveSquishy({ name: "Berry", dataUrl: TINY_PNG });
    expect(saved.name).toBe("Berry");
    const reloaded = loadSquishies();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]?.dataUrl).toBe(TINY_PNG);
  });

  it("deletes only her own pick", () => {
    const a = saveSquishy({ name: "Berry", dataUrl: TINY_PNG });
    saveSquishy({ name: "Melon", dataUrl: TINY_PNG });
    const next = deleteSquishy(a.id);
    expect(next.map((photo) => photo.name)).toEqual(["Melon"]);
    expect(loadSquishies()).toHaveLength(1);
  });
});

describe("homework + tests storage", () => {
  it("saves a homework project with front AND back photos and pasted words", () => {
    const project = saveProject({
      kind: "homework",
      title: "Math page 4",
      pastedText: "3 + 4 = 7",
      frontDataUrl: TINY_PNG,
      backDataUrl: TINY_PNG,
    });
    const reloaded = loadProjects();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]?.id).toBe(project.id);
    expect(reloaded[0]?.frontDataUrl).toBe(TINY_PNG);
    expect(reloaded[0]?.backDataUrl).toBe(TINY_PNG);
    expect(reloaded[0]?.pastedText).toBe("3 + 4 = 7");
  });

  it("keeps tests in the same store under their own kind", () => {
    saveProject({ kind: "test", title: "Spelling test", pastedText: "cat, dog, sun" });
    saveProject({ kind: "homework", title: "Reading page" });
    const all = loadProjects();
    expect(all.filter((p) => p.kind === "test")).toHaveLength(1);
    expect(all.filter((p) => p.kind === "homework")).toHaveLength(1);
    const removed = deleteProject(all.find((p) => p.kind === "test")!.id);
    expect(removed).toHaveLength(1);
    expect(removed[0]?.kind).toBe("homework");
  });
});
