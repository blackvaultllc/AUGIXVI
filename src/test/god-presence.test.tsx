/**
 * THE GOD PRESENCE DOCTRINE (owner orders, voice call
 * 2026-11-26 ~13:48–13:53 CST — godPresence.ts):
 * - A called god stands at Anubis's value (presence scale,
 *   his ring around him); a god called BY a god stands
 *   SMALLER (helper scale, no ring) and bows out when done.
 * - While a god speaks, the speech bubble shows his words
 *   beside his own head — and only while he is ACTUALLY
 *   speaking (bridge state SPEAKING).
 * - Each god has his own background record, grounded in his
 *   history; an unplaced picture is null and named — never
 *   substituted with another god's picture.
 * - Knowledge focus: Anubis answers from the whole core; a
 *   focused god's directive carries his domain and the
 *   referral rule.
 * - A helper call is a whole-line call form naming another
 *   god — a mention never raises a helper, and Anubis is
 *   never a helper.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  GOD_BACKGROUNDS,
  GOD_DOMAINS,
  HELPER_GREETINGS,
  godBackground,
  godInPerspective,
  helperLeaveLine,
  parseHelperCall,
  speechBubbleFor,
} from "@/avatar/godPresence";
import { speakerDirective } from "@/avatar/addressee";
import { CalledGodPopUp } from "@/avatar/CalledGodPopUp";
import { SpeechBubble } from "@/avatar/SpeechBubble";
import { stashChatAttachment, takeChatAttachment } from "@/avatar/chatAttachment";

describe("per-god backgrounds — honest registry", () => {
  it("carries a record for every presence god, each on his own history", () => {
    expect(GOD_BACKGROUNDS.map((entry) => entry.god)).toEqual(["anubis", "montu", "osiris"]);
    for (const entry of GOD_BACKGROUNDS) {
      expect(entry.historyLine.length).toBeGreaterThan(40);
    }
  });

  it("names the unplaced pictures as unplaced — image null, never a substitute", () => {
    // No per-god background art exists in the app's pipeline
    // yet: every record must say so with a null image rather
    // than borrowing the generic Egyptian set or another god.
    for (const entry of GOD_BACKGROUNDS) {
      expect(entry.image).toBeNull();
    }
    expect(godBackground("montu").god).toBe("montu");
    expect(godBackground("osiris").image).toBeNull();
  });

  it("perspective: a called god stands, Osiris addressed stands, rest does not", () => {
    expect(godInPerspective({ frontGod: "montu", addressee: "anubis" })).toBe("montu");
    expect(godInPerspective({ frontGod: "anubis", addressee: "osiris" })).toBe("osiris");
    expect(godInPerspective({ frontGod: "anubis", addressee: "anubis" })).toBeNull();
    expect(godInPerspective({ frontGod: null, addressee: "anubis" })).toBeNull();
  });
});

describe("the speech bubble's state rule", () => {
  it("stands only while the bridge is SPEAKING, with the words being spoken", () => {
    expect(
      speechBubbleFor({ bridgeState: "SPEAKING", addressee: "anubis", words: "I hear you, Captain." }),
    ).toEqual({ god: "anubis", text: "I hear you, Captain." });
    expect(
      speechBubbleFor({ bridgeState: "LISTENING", addressee: "anubis", words: "I hear you, Captain." }),
    ).toBeNull();
    expect(
      speechBubbleFor({ bridgeState: "THINKING", addressee: "montu", words: "On it." }),
    ).toBeNull();
  });

  it("belongs to the god whose voice it is — the addressee when a god holds the talk", () => {
    expect(
      speechBubbleFor({ bridgeState: "SPEAKING", addressee: "montu", words: "The watch is set." }),
    ).toEqual({ god: "montu", text: "The watch is set." });
    expect(
      speechBubbleFor({ bridgeState: "SPEAKING", addressee: "osiris", words: "The record stands." }),
    ).toEqual({ god: "osiris", text: "The record stands." });
  });

  it("never bubbles the boot placeholder or an empty line", () => {
    expect(
      speechBubbleFor({ bridgeState: "SPEAKING", addressee: "anubis", words: "No response yet." }),
    ).toBeNull();
    expect(speechBubbleFor({ bridgeState: "SPEAKING", addressee: "anubis", words: "  " })).toBeNull();
  });

  it("renders the words beside the named god", () => {
    const { container } = render(<SpeechBubble god="montu" text="The watch is set." />);
    const bubble = container.querySelector(".speech-bubble--montu");
    expect(bubble).not.toBeNull();
    expect(bubble?.textContent).toContain("The watch is set.");
    expect(bubble?.getAttribute("aria-label")).toContain("Montu is saying");
  });
});

describe("helper calls — a god called by a god", () => {
  it("parses whole-line call forms for another god", () => {
    expect(parseHelperCall("call osiris", "montu")).toBe("osiris");
    expect(parseHelperCall("ask osiris", "montu")).toBe("osiris");
    expect(parseHelperCall("bring osiris in", "montu")).toBe("osiris");
    expect(parseHelperCall("get montu", "osiris")).toBe("montu");
    expect(parseHelperCall("osiris come here", "montu")).toBe("osiris");
    expect(parseHelperCall("Call Osiris.", "montu")).toBe("osiris");
  });

  it("never raises the god already being addressed, and never Anubis", () => {
    expect(parseHelperCall("call montu", "montu")).toBeNull();
    expect(parseHelperCall("call anubis", "montu")).toBeNull();
    expect(parseHelperCall("bring anubis in", "osiris")).toBeNull();
  });

  it("a mention is not a call", () => {
    expect(parseHelperCall("what does osiris think of this?", "montu")).toBeNull();
    expect(parseHelperCall("osiris is the core beneath you", "montu")).toBeNull();
    expect(parseHelperCall("tell me about montu", "osiris")).toBeNull();
  });

  it("the helper greets with allegiance and leaves with the bow line", () => {
    expect(HELPER_GREETINGS.osiris).toContain("Osiris stands with you");
    expect(helperLeaveLine("Montu")).toContain("Montu bows and returns to his work");
  });
});

describe("knowledge focus in the speaker directive", () => {
  it("Anubis carries the whole core — and no referral line", () => {
    const directive = speakerDirective("anubis");
    expect(directive).toContain(GOD_DOMAINS.anubis.focusLine);
    expect(directive).not.toContain("outside your ground");
  });

  it("a focused god carries his domain and the referral rule", () => {
    const montu = speakerDirective("montu");
    expect(montu).toContain("war and security");
    expect(montu).toContain("outside your ground");
    const osiris = speakerDirective("osiris");
    expect(osiris).toContain("the core itself");
    expect(osiris).toContain("outside your ground");
  });
});

describe("the called god's two scales", () => {
  it("PRESENCE scale: Montu stands with his ring around him", () => {
    const { container } = render(
      <CalledGodPopUp god="montu" speaking={false} scale="presence" onSelect={vi.fn()} />,
    );
    const popup = container.querySelector(".called-god-popup--presence");
    expect(popup).not.toBeNull();
    expect(popup?.querySelector(".presence-ring")).not.toBeNull();
    expect(popup?.querySelector(".called-god-popup__state")?.textContent).toBe("On the call");
  });

  it("HELPER scale: smaller, no ring, standing with the call", () => {
    const { container } = render(
      <CalledGodPopUp god="montu" speaking={false} scale="helper" onSelect={vi.fn()} />,
    );
    const popup = container.querySelector(".called-god-popup--helper");
    expect(popup).not.toBeNull();
    expect(popup?.querySelector(".presence-ring")).toBeNull();
    expect(popup?.querySelector(".called-god-popup__state")?.textContent).toBe(
      "Standing with the call",
    );
  });

  it("Osiris as a helper wears his still in the circle — no borrowed face rig", () => {
    const { container } = render(
      <CalledGodPopUp god="osiris" speaking={false} scale="helper" onSelect={vi.fn()} />,
    );
    const img = container.querySelector("img.god-medallion__img");
    expect(img?.getAttribute("src")).toBe("/augie-presence/still.webp");
  });

  it("Anubis never pops up", () => {
    const { container } = render(
      <CalledGodPopUp god="anubis" speaking={false} onSelect={vi.fn()} />,
    );
    expect(container.querySelector(".called-god-popup")).toBeNull();
  });
});

describe("the chat attachment hand-off", () => {
  it("a stashed picture is taken exactly once", () => {
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    stashChatAttachment(file);
    expect(takeChatAttachment()).toBe(file);
    expect(takeChatAttachment()).toBeNull();
  });
});
