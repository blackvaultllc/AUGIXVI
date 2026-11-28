/**
 * PERIODIC PHOTO VERIFICATION (owner law 2026-11-28 ~07:28 CST):
 * while a person uses the AI, Anubis may OCCASIONALLY ask for
 * one picture to verify it is still them — permission first,
 * always. The pins below hold the law's load-bearing points:
 *   · NO camera opens without a granted permission — rendering
 *     the ask never touches it, and neither does a decline.
 *   · A decline takes NO snapshot and carries NO penalty: the
 *     record says "declined" with no photo, and the session
 *     carries on (onResolved fires all the same).
 *   · The cadence is respected — no second ask inside the
 *     window, for every value in his range (1 / 3 / 7 days),
 *     and the clock runs from the last ask whatever its answer.
 *   · A completed check never claims a match: the copy says
 *     plainly there is nothing to match against yet, and the
 *     store refuses to attach a photo to any record that is
 *     not a completed check.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PHOTO_CHECK_ASK_TITLE,
  PHOTO_CHECK_CADENCE_KEY,
  PHOTO_CHECK_DEFAULT_CADENCE_DAYS,
  PHOTO_CHECK_LAST_ASK_KEY,
  PHOTO_CHECK_NO_MATCH_NOTE,
  isPhotoCheckPhotoName,
  loadPhotoCheckCadenceDays,
  loadPhotoCheckLastAskAt,
  parsePhotoChecks,
  photoCheckAskBody,
  photoCheckCadenceWords,
  photoCheckDue,
  photoCheckOutcomeWords,
  sanitizePhotoCheckCadenceDays,
  savePhotoCheckCadenceDays,
  savePhotoCheckLastAskAt,
  serializePhotoCheck,
  type PhotoCheckRecord,
  type PhotoCheckStorage,
} from "@/avatar/photoCheck";
import { createPhotoCheckStore, type PhotoCheckStore } from "@/avatar/photoCheckStore.server";
import { PhotoCheckPrompt } from "@/avatar/PhotoCheckPrompt";
import { postPhotoCheckRecord } from "@/avatar/photoCheckClient";

vi.mock("@/avatar/photoCheckClient", () => ({
  postPhotoCheckRecord: vi.fn(async () => undefined),
}));

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

function fakeStorage(initial: Record<string, string> = {}): PhotoCheckStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("photoCheck — the cadence, his range only", () => {
  it("keeps his three values and falls back to the middle of the range", () => {
    expect(sanitizePhotoCheckCadenceDays(1)).toBe(1);
    expect(sanitizePhotoCheckCadenceDays(3)).toBe(3);
    expect(sanitizePhotoCheckCadenceDays(7)).toBe(7);
    expect(sanitizePhotoCheckCadenceDays(2)).toBe(PHOTO_CHECK_DEFAULT_CADENCE_DAYS);
    expect(sanitizePhotoCheckCadenceDays(0)).toBe(3);
    expect(sanitizePhotoCheckCadenceDays("3")).toBe(3);
    expect(sanitizePhotoCheckCadenceDays(null)).toBe(3);
    expect(sanitizePhotoCheckCadenceDays(undefined)).toBe(3);
  });

  it("speaks the cadence in his words", () => {
    expect(photoCheckCadenceWords(1)).toBe("once a day");
    expect(photoCheckCadenceWords(3)).toBe("once every three days");
    expect(photoCheckCadenceWords(7)).toBe("once a week");
  });

  it("round-trips the setting through storage, and a corrupt value falls back", () => {
    const storage = fakeStorage();
    expect(loadPhotoCheckCadenceDays(storage)).toBe(3);
    savePhotoCheckCadenceDays(7, storage);
    expect(loadPhotoCheckCadenceDays(storage)).toBe(7);
    savePhotoCheckCadenceDays(1, storage);
    expect(loadPhotoCheckCadenceDays(storage)).toBe(1);
    expect(loadPhotoCheckCadenceDays(fakeStorage({ [PHOTO_CHECK_CADENCE_KEY]: "banana" }))).toBe(3);
    expect(loadPhotoCheckCadenceDays(null)).toBe(3);
  });
});

describe("photoCheck — the due rule (no second ask inside the window)", () => {
  it("is due when this device has never been asked", () => {
    expect(photoCheckDue(NOW, null, 1)).toBe(true);
    expect(photoCheckDue(NOW, null, 3)).toBe(true);
    expect(photoCheckDue(NOW, null, 7)).toBe(true);
  });

  it("is not due inside the window, and due the moment the window has passed", () => {
    for (const days of [1, 3, 7] as const) {
      expect(photoCheckDue(NOW, NOW - days * DAY + 1, days)).toBe(false);
      expect(photoCheckDue(NOW, NOW - days * DAY, days)).toBe(true);
      expect(photoCheckDue(NOW, NOW - days * DAY - 1, days)).toBe(true);
    }
  });

  it("runs the clock from the last ask — an hour ago is inside every window", () => {
    const anHourAgo = NOW - 3_600_000;
    expect(photoCheckDue(NOW, anHourAgo, 1)).toBe(false);
    expect(photoCheckDue(NOW, anHourAgo, 3)).toBe(false);
    expect(photoCheckDue(NOW, anHourAgo, 7)).toBe(false);
  });

  it("waits out a last-ask time in the future (a moved clock is not due)", () => {
    expect(photoCheckDue(NOW, NOW + DAY, 1)).toBe(false);
  });

  it("round-trips the last-ask clock through storage", () => {
    const storage = fakeStorage();
    expect(loadPhotoCheckLastAskAt(storage)).toBe(null);
    savePhotoCheckLastAskAt(NOW, storage);
    expect(loadPhotoCheckLastAskAt(storage)).toBe(NOW);
    expect(loadPhotoCheckLastAskAt(fakeStorage({ [PHOTO_CHECK_LAST_ASK_KEY]: "soon" }))).toBe(null);
    expect(loadPhotoCheckLastAskAt(null)).toBe(null);
  });
});

describe("photoCheck — the ask copy", () => {
  it("says what is asked, why, and that it is one picture this once", () => {
    const body = photoCheckAskBody(3);
    expect(body).toContain("once every three days");
    expect(body).toContain("one picture, this once");
    expect(body).toContain("The camera opens only if you say yes");
    expect(body).toContain("Saying no is fine");
    expect(photoCheckAskBody(1)).toContain("once a day");
    expect(photoCheckAskBody(7)).toContain("once a week");
  });

  it("never claims a match exists to run", () => {
    expect(PHOTO_CHECK_NO_MATCH_NOTE).toContain("no face on file to match it against yet");
    expect(PHOTO_CHECK_NO_MATCH_NOTE).toContain("no match was run");
  });
});

describe("photoCheck — the record", () => {
  const record = (overrides: Partial<PhotoCheckRecord>): PhotoCheckRecord => ({
    ts: "2026-11-28T13:28:00.000Z",
    trigger: "periodic",
    outcome: "completed",
    note: "",
    photoFile: null,
    ...overrides,
  });

  it("round-trips through the JSONL line format", () => {
    const one = record({ photoFile: "check-20261128132800-42.jpg" });
    expect(parsePhotoChecks(serializePhotoCheck(one))).toEqual([one]);
  });

  it("skips malformed and off-law lines without losing the good ones", () => {
    const good = record({ outcome: "declined" });
    const text =
      serializePhotoCheck(good) +
      "not json\n" +
      JSON.stringify({ ts: "x", trigger: "periodic", outcome: "suspicious", note: "", photoFile: null }) +
      "\n" +
      JSON.stringify({ ts: "x", trigger: "whenever", outcome: "declined", note: "", photoFile: null }) +
      "\n";
    expect(parsePhotoChecks(text)).toEqual([good]);
  });

  it("speaks outcomes in plain words, and a decline is never suspicion", () => {
    expect(photoCheckOutcomeWords("completed")).toContain("one picture was taken");
    expect(photoCheckOutcomeWords("declined")).toContain("nothing held against them");
    expect(photoCheckOutcomeWords("camera-unavailable")).toContain("camera could not open");
  });

  it("accepts only core-made snapshot names", () => {
    expect(isPhotoCheckPhotoName("check-20261128132800-42.jpg")).toBe(true);
    expect(isPhotoCheckPhotoName("attempt-20261128132800-42.jpg")).toBe(false);
    expect(isPhotoCheckPhotoName("../check-20261128132800-42.jpg")).toBe(false);
    expect(isPhotoCheckPhotoName("check-20261128132800-42.png")).toBe(false);
  });
});

describe("photoCheck store — the record on disk", () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  let directory: string;
  let store: PhotoCheckStore | null;

  const record = (overrides: Partial<PhotoCheckRecord>): PhotoCheckRecord => ({
    ts: "2026-11-28T13:28:00.000Z",
    trigger: "periodic",
    outcome: "completed",
    note: "",
    photoFile: null,
    ...overrides,
  });

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "augie-photocheck-"));
    store = await createPhotoCheckStore(directory);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("records a completed check with its snapshot under a core-made name", async () => {
    const stored = await store!.record(record({}), JPEG);
    expect(stored.photoFile).toMatch(/^check-\d{14}-\d+\.jpg$/);
    const { entries, total } = await store!.read();
    expect(total).toBe(1);
    expect(entries[0]?.outcome).toBe("completed");
    const photo = await store!.readPhoto(stored.photoFile as string);
    expect(photo && Array.from(photo)).toEqual(Array.from(JPEG));
  });

  it("NEVER attaches a photo to a declined record, even when one is handed over", async () => {
    const stored = await store!.record(record({ outcome: "declined" }), JPEG);
    expect(stored.photoFile).toBe(null);
    const { entries } = await store!.read();
    expect(entries[0]?.photoFile).toBe(null);
  });

  it("serves a photo only through the record check", async () => {
    await store!.record(record({ outcome: "declined" }), null);
    expect(await store!.readPhoto("check-20261128132800-999.jpg")).toBe(null);
    expect(await store!.readPhoto("../../etc/passwd")).toBe(null);
  });
});

/* ------------------------------ the prompt ------------------------------ */

const postMock = vi.mocked(postPhotoCheckRecord);
let getUserMedia: ReturnType<typeof vi.fn>;
let fakeStream: { getTracks: () => { stop: ReturnType<typeof vi.fn> }[] };

function stubCamera(grants: boolean) {
  fakeStream = { getTracks: () => [{ stop: vi.fn() }] };
  getUserMedia = vi.fn(async () => {
    if (!grants) throw new DOMException("denied", "NotAllowedError");
    return fakeStream;
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
    configurable: true,
    get: () => 640,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
    configurable: true,
    get: () => 480,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "readyState", {
    configurable: true,
    get: () => 2,
  });
  HTMLVideoElement.prototype.play = vi.fn(async () => undefined);
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({ drawImage: () => undefined }) as unknown as CanvasRenderingContext2D,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
    callback(new Blob([new Uint8Array([0xff, 0xd8, 1])], { type: "image/jpeg" }));
  } as typeof HTMLCanvasElement.prototype.toBlob;
}

describe("PhotoCheckPrompt — permission is absolute", () => {
  beforeEach(() => {
    postMock.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  });

  it("asks in plain words and never opens the camera on render", () => {
    stubCamera(true);
    render(<PhotoCheckPrompt trigger="periodic" onResolved={() => undefined} />);
    expect(screen.getByText(PHOTO_CHECK_ASK_TITLE)).toBeTruthy();
    expect(screen.getByText(/one picture, this once/)).toBeTruthy();
    expect(screen.getByText(/The camera opens only if you say yes/)).toBeTruthy();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("a decline takes no snapshot, carries no penalty, and the session carries on", async () => {
    stubCamera(true);
    const onResolved = vi.fn();
    render(<PhotoCheckPrompt trigger="periodic" onResolved={onResolved} />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0]?.[0]).toMatchObject({
      trigger: "periodic",
      outcome: "declined",
      photo: null,
    });
    expect(screen.getByText(/No picture was taken/)).toBeTruthy();
    // The cadence clock restarted — a "no" is not chased.
    expect(loadPhotoCheckLastAskAt()).not.toBe(null);
    expect(photoCheckDue(Date.now(), loadPhotoCheckLastAskAt(), 1)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("a yes opens the camera once, takes one picture, and claims no match", async () => {
    stubCamera(true);
    const onResolved = vi.fn();
    render(<PhotoCheckPrompt trigger="periodic" onResolved={onResolved} />);
    fireEvent.click(screen.getByRole("button", { name: "Yes — take my picture" }));
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({ video: true });
    const posted = postMock.mock.calls[0]?.[0];
    expect(posted).toMatchObject({ trigger: "periodic", outcome: "completed" });
    expect(posted?.photo).toBeInstanceOf(Blob);
    expect(await screen.findByText(/no face on file to match it against yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("a yes the camera cannot honor records camera-unavailable, with no picture", async () => {
    stubCamera(false);
    render(<PhotoCheckPrompt trigger="periodic" onResolved={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Yes — take my picture" }));
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock.mock.calls[0]?.[0]).toMatchObject({
      outcome: "camera-unavailable",
      photo: null,
    });
    expect(await screen.findByText(/The camera could not open/)).toBeTruthy();
  });

  it("the cadence can be changed on the card, in his range, in one place", () => {
    stubCamera(true);
    render(<PhotoCheckPrompt trigger="periodic" onResolved={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "once a week" }));
    expect(localStorage.getItem(PHOTO_CHECK_CADENCE_KEY)).toBe("7");
    expect(screen.getByText(/Once in a while — once a week/)).toBeTruthy();
  });

  it("a sensitive-action ask names the action and says it opens either way", () => {
    stubCamera(true);
    render(
      <PhotoCheckPrompt
        trigger="sensitive-action"
        actionName="your Personal Vault"
        onResolved={() => undefined}
      />,
    );
    expect(screen.getByText(/You are opening your Personal Vault/)).toBeTruthy();
    expect(screen.getByText(/the vault opens either way/)).toBeTruthy();
  });
});
