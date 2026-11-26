/**
 * THE LOGIN GATE STORE — the doorbell's memory on disk.
 * Attempts land in the core-side gate directory; a snapshot is
 * written beside its record under a core-made name, and it is read
 * back ONLY through the record check (a name no record carries is
 * never served). Khadija's entries sit in the same log, plainly hers.
 */
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGateAttemptStore, type GateAttemptStore } from "@/avatar/loginGateStore.server";
import type { GateAttemptRecord } from "@/avatar/loginGate";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

const attempt = (overrides: Partial<GateAttemptRecord>): GateAttemptRecord => ({
  ts: "2026-11-26T14:22:00.000Z",
  door: "operator",
  result: "voice-match",
  namedAs: "Zero",
  note: "",
  photoFile: null,
  ...overrides,
});

describe("login gate store", () => {
  let directory: string;
  let store: GateAttemptStore | null;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "augie-gate-"));
    store = await createGateAttemptStore(directory);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("records an attempt with its snapshot under a core-made name", async () => {
    expect(store).not.toBeNull();
    const stored = await store!.record(attempt({}), JPEG);
    expect(stored.photoFile).toMatch(/^attempt-[0-9]{14}-[0-9]+\.jpg$/);
    const { entries, total } = await store!.read();
    expect(total).toBe(1);
    expect(entries[0]?.result).toBe("voice-match");
    expect(entries[0]?.namedAs).toBe("Zero");
    const photo = await store!.readPhoto(stored.photoFile as string);
    expect(photo).not.toBeNull();
    expect(Buffer.from(photo as Uint8Array).equals(Buffer.from(JPEG))).toBe(true);
  });

  it("serves no photo whose name no record carries", async () => {
    await store!.record(attempt({}), JPEG);
    expect(await store!.readPhoto("attempt-20261126142200-99.jpg")).toBeNull();
    expect(await store!.readPhoto("../secret.jpg")).toBeNull();
    expect(await store!.readPhoto("attempt-20261126142200-1.png")).toBeNull();
  });

  it("records attempts without a camera plainly — photoFile stays null", async () => {
    const stored = await store!.record(
      attempt({ result: "permission-denied", namedAs: null, note: "Refused." }),
      null,
    );
    expect(stored.photoFile).toBeNull();
    const { entries } = await store!.read();
    expect(entries[0]?.result).toBe("permission-denied");
  });

  it("keeps Khadija's entries in the same log, newest first", async () => {
    await store!.record(attempt({ ts: "2026-11-26T14:22:00.000Z" }), null);
    await store!.record(
      attempt({
        ts: "2026-11-26T15:00:00.000Z",
        door: "learner",
        result: "learner-entry",
        namedAs: "One",
      }),
      null,
    );
    const { entries, total } = await store!.read();
    expect(total).toBe(2);
    expect(entries[0]?.door).toBe("learner");
    expect(entries[1]?.door).toBe("operator");
  });

  it("locks the directory and files down (0700 / 0600)", async () => {
    const stored = await store!.record(attempt({}), JPEG);
    const dirMode = (await stat(directory)).mode & 0o777;
    const fileMode = (await stat(join(directory, "attempts.jsonl"))).mode & 0o777;
    const photoMode = (await stat(join(directory, "photos", stored.photoFile as string))).mode &
      0o777;
    expect(dirMode).toBe(0o700);
    expect(fileMode).toBe(0o600);
    expect(photoMode).toBe(0o600);
  });
});
