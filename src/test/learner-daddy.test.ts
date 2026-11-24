import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  carryOutDaddyIntent,
  daddyIntentFor,
  extractDaddyMessageText,
  handleLearnerDaddyRequest,
  isDaddyCallIntent,
  isDaddyIdentityQuestion,
  isDaddyMessageIntent,
  mentionsDaddy,
} from "@/avatar/learner/daddy.server";
import {
  activeDaddyCall,
  answerDaddyCall,
  daddyOnline,
  endDaddyCall,
  pollForKhadija,
  postDaddyMessage,
  readDaddyInbox,
  readInboxForDaddy,
  replyFromDaddy,
  stampDaddySeen,
  startDaddyCall,
  unreadForDaddy,
} from "@/avatar/learner/daddyStore.server";
import { answerFlowerQuestion, flowerHealth } from "@/avatar/learner/flower.server";
import { handleLearnerSayRequest } from "@/avatar/learner/learnerSay.server";

/**
 * KHADIJA'S LINE TO DADDY (owner order 2026-11-24 ~17:13 CST) — the
 * three defects and their fixes, pinned:
 *  1. her model "not connected": the ask doorway's health is earned
 *     by round trips, and a surfaceless question forwards to the
 *     core instead of dying on a foreign loopback;
 *  2. her voice: the say doorway answers with the core's Piper or
 *     says honestly why it cannot;
 *  3. call daddy: the intent is known by name, the message lands in
 *     the core's inbox, the call rings while he is present and waits
 *     as a record when he is not.
 */

let env: NodeJS.ProcessEnv;

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "augie-daddy-test-"));
  env = {
    ...process.env,
    AUGIE_DADDY_INBOX_PATH: join(dir, "daddy-inbox.json"),
    AUGIE_EVENTS_PATH: join(dir, "events.jsonl"),
  };
});

describe("the name law — Daddy is Domenick Arlon Hall", () => {
  it("resolves daddy, dad, and his full name to the same man", () => {
    expect(mentionsDaddy("I want to call daddy")).toBe(true);
    expect(mentionsDaddy("tell dad I said hi")).toBe(true);
    expect(mentionsDaddy("Domenick Arlon Hall is my daddy")).toBe(true);
    expect(mentionsDaddy("who is Domenick?")).toBe(true);
    expect(mentionsDaddy("tell me about dinosaurs")).toBe(false);
  });

  it("knows a call wish from a message wish", () => {
    expect(isDaddyCallIntent("Call daddy")).toBe(true);
    expect(isDaddyCallIntent("I want to talk to Domenick Arlon Hall")).toBe(true);
    expect(isDaddyCallIntent("Can I phone dad?")).toBe(true);
    expect(isDaddyMessageIntent("Tell daddy I did my homework")).toBe(true);
    expect(isDaddyMessageIntent("Send a message to daddy")).toBe(true);
    expect(isDaddyCallIntent("Tell daddy I did my homework")).toBe(false);
  });

  it("carries the words she said in the same breath", () => {
    expect(extractDaddyMessageText("Tell daddy I finished my homework")).toBe(
      "I finished my homework",
    );
    expect(extractDaddyMessageText("Tell Daddy that I miss you")).toBe("I miss you");
    expect(extractDaddyMessageText("Send I love you to daddy")).toBe("I love you");
    expect(extractDaddyMessageText("I want to message daddy")).toBeNull();
  });

  it("knows the identity questions — who he is, and who made Augie", () => {
    expect(isDaddyIdentityQuestion("Who is Domenick Arlon Hall?")).toBe(true);
    expect(isDaddyIdentityQuestion("Who is my daddy?")).toBe(true);
    expect(isDaddyIdentityQuestion("Who made you?")).toBe(true);
    expect(isDaddyIdentityQuestion("Who is the president?")).toBe(false);
  });

  it("the intent router picks the right door", () => {
    expect(daddyIntentFor("Call daddy")).toEqual({ kind: "call" });
    expect(daddyIntentFor("Tell daddy goodnight")).toEqual({
      kind: "message",
      words: "goodnight",
    });
    expect(daddyIntentFor("Who made Augie?")).toEqual({ kind: "identity" });
    expect(daddyIntentFor("What is 3 + 4?")).toBeNull();
  });
});

describe("the Daddy Inbox store — her words land on the core", () => {
  it("a message she sends is stored, addressed from her, unread by him", async () => {
    const stored = await postDaddyMessage("I did my homework", env);
    expect(stored?.from).toBe("khadija");
    const { available, inbox } = await readDaddyInbox(env);
    expect(available).toBe(true);
    expect(inbox.messages).toHaveLength(1);
    expect(unreadForDaddy(inbox)).toHaveLength(1);
    // And it truly is on disk at the core path.
    const onDisk = JSON.parse(await readFile(env["AUGIE_DADDY_INBOX_PATH"]!, "utf8")) as {
      messages: { text: string }[];
    };
    expect(onDisk.messages[0]?.text).toBe("I did my homework");
  });

  it("his reading marks her words read; his reply waits for her poll", async () => {
    await postDaddyMessage("Hi daddy", env);
    const view = await readInboxForDaddy(env);
    expect(view.messages).toHaveLength(1);
    const after = await readDaddyInbox(env);
    expect(unreadForDaddy(after.inbox)).toHaveLength(0);

    await replyFromDaddy("Hi my baby girl", env);
    const herView = await pollForKhadija(env);
    expect(herView.messages.map((m) => m.text)).toContain("Hi my baby girl");
    // Her poll saw it, so it is marked read by her now.
    const final = await readDaddyInbox(env);
    expect(final.inbox.messages.every((m) => m.readByKhadija)).toBe(true);
  });

  it("presence is earned by his stamp and fades with time", async () => {
    const t0 = new Date("2026-11-24T17:00:00.000Z");
    await stampDaddySeen(env, t0);
    const { inbox } = await readDaddyInbox(env);
    expect(daddyOnline(inbox, new Date(t0.getTime() + 30_000))).toBe(true);
    expect(daddyOnline(inbox, new Date(t0.getTime() + 10 * 60_000))).toBe(false);
  });

  it("a call rings, he answers, either side can end it", async () => {
    const started = await startDaddyCall(env);
    expect(started?.call.state).toBe("ringing");
    // A second call while one rings is the same call — one ring.
    const again = await startDaddyCall(env);
    expect(again?.call.id).toBe(started?.call.id);

    const answered = await answerDaddyCall(env);
    expect(answered?.state).toBe("answered");
    const { inbox } = await readDaddyInbox(env);
    expect(activeDaddyCall(inbox)?.state).toBe("answered");

    const ended = await endDaddyCall(env);
    expect(ended?.state).toBe("ended");
    const after = await readDaddyInbox(env);
    expect(activeDaddyCall(after.inbox)).toBeNull();
  });

  it("a ring nobody answers becomes a missed call, honestly", async () => {
    const t0 = new Date("2026-11-24T17:00:00.000Z");
    const started = await startDaddyCall(env, t0);
    const later = new Date(t0.getTime() + 10 * 60_000);
    const { inbox } = await readDaddyInbox(env);
    expect(activeDaddyCall(inbox, later)).toBeNull();
    const ended = await endDaddyCall(env, later);
    expect(ended?.id).toBe(started?.call.id);
    expect(ended?.state).toBe("missed");
  });
});

describe("her doorway — /api/learner/daddy", () => {
  beforeEach(() => {
    process.env["AUGIE_DADDY_INBOX_PATH"] = env["AUGIE_DADDY_INBOX_PATH"];
    process.env["AUGIE_EVENTS_PATH"] = env["AUGIE_EVENTS_PATH"];
  });

  const post = (body: unknown) =>
    handleLearnerDaddyRequest(
      new Request("http://learner.local/api/learner/daddy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  it("message lands, call rings, poll shows both", async () => {
    const msg = await post({ action: "message", text: "I love you daddy" });
    expect(msg.status).toBe(200);
    const call = await post({ action: "call" });
    const callBody = (await call.json()) as { ok: boolean; call: { state: string } };
    expect(callBody.ok).toBe(true);
    expect(callBody.call.state).toBe("ringing");

    const poll = await post({ action: "poll" });
    const pollBody = (await poll.json()) as {
      ok: boolean;
      messages: { text: string }[];
      call: { state: string } | null;
    };
    expect(pollBody.ok).toBe(true);
    expect(pollBody.messages.map((m) => m.text)).toContain("I love you daddy");
    expect(pollBody.call?.state).toBe("ringing");
  });

  it("refuses a message with no words", async () => {
    const res = await post({ action: "message", text: "   " });
    expect(res.status).toBe(400);
  });
});

describe("the Flower carries out her daddy wishes", () => {
  it("'Call daddy' places a real call in the core inbox", async () => {
    const result = await carryOutDaddyIntent({ kind: "call" }, env);
    expect(result.ok).toBe(true);
    const { inbox } = await readDaddyInbox(env);
    expect(inbox.calls).toHaveLength(1);
    expect(inbox.calls[0]?.state).toBe("ringing");
  });

  it("'Tell daddy …' stores the exact words", async () => {
    const result = await carryOutDaddyIntent({ kind: "message", words: "I got a star today" }, env);
    expect(result.ok).toBe(true);
    const { inbox } = await readDaddyInbox(env);
    expect(inbox.messages[0]?.text).toBe("I got a star today");
  });

  it("through the ask path: call, message, and identity all answer as daddy mode", async () => {
    const noFetch = vi.fn(async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    const callAnswer = await answerFlowerQuestion("Call daddy", noFetch, env);
    expect(callAnswer.mode).toBe("daddy");
    expect(callAnswer.answer).toMatch(/call/i);

    const msgAnswer = await answerFlowerQuestion("Tell daddy I did my homework", noFetch, env);
    expect(msgAnswer.mode).toBe("daddy");
    const { inbox } = await readDaddyInbox(env);
    expect(inbox.messages.map((m) => m.text)).toContain("I did my homework");

    const idAnswer = await answerFlowerQuestion("Who is Domenick Arlon Hall?", noFetch, env);
    expect(idAnswer.mode).toBe("daddy");
    expect(idAnswer.answer).toContain("your daddy");
    expect(idAnswer.verified).toBe(true);
  });

  it("a daddy wish with no words asks her for the words — nothing is sent", async () => {
    const noFetch = vi.fn(async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    const answer = await answerFlowerQuestion("I want to message daddy", noFetch, env);
    expect(answer.mode).toBe("daddy");
    expect(answer.answer).toMatch(/Tell Daddy/);
    const { inbox } = await readDaddyInbox(env);
    expect(inbox.messages).toHaveLength(0);
  });
});

describe("defect 1 — the not-connected regression", () => {
  it("health is earned: books and brain round trips decide it", async () => {
    const allUp = vi.fn(async (input: string) => {
      const url = String(input);
      if (url.includes("/catalog/")) {
        return Response.json({ totalResultsCount: 1, results: { entries: [{ id: "x" }] } });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const up = await flowerHealth(allUp, {});
    expect(up).toEqual({ ok: true, library: true, brain: true, coreRoad: false });

    const allDown = vi.fn(async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    const down = await flowerHealth(allDown, {});
    expect(down.ok).toBe(false);
    expect(down.library).toBe(false);
    expect(down.brain).toBe(false);
  });

  it("a surface with no library forwards the question to the core — and never twice", async () => {
    const coreAnswer = {
      answer: "Dinosaurs lived long ago.",
      mode: "book",
      source: { bookTitle: "Wikibooks", articleTitle: "Dinosaurs" },
      verified: true,
    };
    const seen: string[] = [];
    const stub = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("core.example")) {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        expect(headers["x-augie-forwarded"]).toBe("1");
        return Response.json(coreAnswer);
      }
      return new Response("{}", { status: 503 });
    }) as unknown as typeof fetch;

    const forwardedEnv = { ...env, AUGIE_CORE_URL: "http://core.example:8081" };
    const answer = await answerFlowerQuestion("Tell me about dinosaurs", stub, forwardedEnv);
    expect(answer.answer).toBe("Dinosaurs lived long ago.");
    expect(answer.mode).toBe("book");
    expect(seen.some((u) => u.includes("core.example"))).toBe(true);

    // Already forwarded once → no second hop; the honest down text.
    const again = await answerFlowerQuestion("Tell me about dinosaurs", stub, forwardedEnv, {
      forwarded: true,
    });
    expect(again.mode).toBe("library-down");
  });

  it("with no core road configured, a dead library still answers honestly", async () => {
    const down = vi.fn(async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    const answer = await answerFlowerQuestion("Tell me about dinosaurs", down, { ...env });
    expect(answer.mode).toBe("library-down");
  });
});

describe("defect 2 — her voice doorway", () => {
  it("answers 400 for empty text and 503 with the reason where Piper is absent", async () => {
    const prevBin = process.env["AUGIE_PIPER_BIN"];
    const prevModel = process.env["AUGIE_PIPER_MODEL"];
    process.env["AUGIE_PIPER_BIN"] = "/nonexistent/piper";
    process.env["AUGIE_PIPER_MODEL"] = "/nonexistent/voice.onnx";
    try {
      const empty = await handleLearnerSayRequest(
        new Request("http://learner.local/api/learner/say", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "  " }),
        }),
      );
      expect(empty.status).toBe(400);

      const res = await handleLearnerSayRequest(
        new Request("http://learner.local/api/learner/say", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "Hello Khadija" }),
        }),
      );
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/Piper is not installed/);
    } finally {
      if (prevBin === undefined) delete process.env["AUGIE_PIPER_BIN"];
      else process.env["AUGIE_PIPER_BIN"] = prevBin;
      if (prevModel === undefined) delete process.env["AUGIE_PIPER_MODEL"];
      else process.env["AUGIE_PIPER_MODEL"] = prevModel;
    }
  });
});
