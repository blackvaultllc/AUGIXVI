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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COUNCIL_BACKGROUND,
  GOD_BACKGROUNDS,
  GOD_DOMAINS,
  GOD_PERSONALITIES,
  HELPER_GREETINGS,
  councilOpenLineFor,
  godBackground,
  godInPerspective,
  helperLeaveLine,
  parseCouncilCall,
  parseCouncilEnd,
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

describe("personalities from history — built from the Hall record, nothing invented", () => {
  it("every speaking god carries a personality, each grounded in named record facts", () => {
    for (const god of ["anubis", "montu", "osiris"] as const) {
      expect(GOD_PERSONALITIES[god].manner.length).toBeGreaterThan(60);
      expect(GOD_PERSONALITIES[god].groundedIn.length).toBeGreaterThan(60);
    }
    // The grounding names the Hall's own facts — traceable, not invented.
    expect(GOD_PERSONALITIES.anubis.groundedIn).toContain("weighing of the heart");
    expect(GOD_PERSONALITIES.anubis.groundedIn).toContain("Lord of the Sacred Land");
    expect(GOD_PERSONALITIES.montu.groundedIn).toContain("Mentuhotep");
    expect(GOD_PERSONALITIES.montu.groundedIn).toContain("Armant");
    expect(GOD_PERSONALITIES.osiris.groundedIn).toContain("first king of Egypt");
    expect(GOD_PERSONALITIES.osiris.groundedIn).toContain("Duat");
  });

  it("each manner is its own god's — measured, martial, kingly — never one voice copied", () => {
    expect(GOD_PERSONALITIES.anubis.manner).toContain("Measured and exact");
    expect(GOD_PERSONALITIES.montu.manner).toContain("Direct and martial");
    expect(GOD_PERSONALITIES.osiris.manner).toContain("Kingly and patient");
  });

  it("the manner rides in the speaker directive beside the focus line", () => {
    expect(speakerDirective("anubis")).toContain("Your manner, from the record:");
    expect(speakerDirective("anubis")).toContain("Measured and exact");
    expect(speakerDirective("montu")).toContain("Direct and martial");
    expect(speakerDirective("osiris")).toContain("Kingly and patient");
  });

  it("no personality is written for a god with no speaking construct — Horusec's thin record stays plain", () => {
    expect(Object.keys(GOD_PERSONALITIES).sort()).toEqual(["anubis", "montu", "osiris"]);
  });
});

describe("the council — an Egyptian seat, called and ended by whole-line words", () => {
  it("call everybody seats them all — the mandatory meeting", () => {
    expect(parseCouncilCall("call everybody")).toEqual(["montu", "osiris"]);
    expect(parseCouncilCall("Call a council.")).toEqual(["montu", "osiris"]);
    expect(parseCouncilCall("mandatory meeting")).toEqual(["montu", "osiris"]);
    expect(parseCouncilCall("el consejo")).toEqual(["montu", "osiris"]);
  });

  it("a named seat fills alone", () => {
    expect(parseCouncilCall("call a council with Montu")).toEqual(["montu"]);
    expect(parseCouncilCall("call everybody with osiris")).toEqual(["osiris"]);
    expect(councilOpenLineFor(["montu"])).toContain("Montu stands with me");
    expect(councilOpenLineFor(["montu", "osiris"])).toContain("Montu and Osiris stand with me");
  });

  it("talk about a council never seats one", () => {
    expect(parseCouncilCall("the council said the road is closed")).toBeNull();
    expect(parseCouncilCall("what is a council")).toBeNull();
    expect(parseCouncilCall("call everybody back tomorrow about the truck")).toBeNull();
    expect(parseCouncilCall("")).toBeNull();
  });

  it("the end words close it; ordinary lines do not", () => {
    expect(parseCouncilEnd("end the council")).toBe(true);
    expect(parseCouncilEnd("The council is done.")).toBe(true);
    expect(parseCouncilEnd("dismiss the council")).toBe(true);
    expect(parseCouncilEnd("the council was great")).toBe(false);
  });

  it("while the council sits, the background settles to the council setting", () => {
    expect(
      godInPerspective({ frontGod: "montu", addressee: "montu", councilOpen: true }),
    ).toBe("council");
    expect(COUNCIL_BACKGROUND.god).toBe("council");
    // Its picture is not placed yet — the wallpaper stands, nothing substituted.
    expect(COUNCIL_BACKGROUND.image).toBeNull();
    expect(COUNCIL_BACKGROUND.historyLine).toContain("Horus");
    expect(COUNCIL_BACKGROUND.historyLine).toContain("El Consejo");
  });

  it("a council-seated god stands at presence scale with the council state word", () => {
    const { container } = render(
      <CalledGodPopUp god="osiris" speaking={false} seat="council" onSelect={vi.fn()} />,
    );
    const popup = container.querySelector(".called-god-popup--council-seat");
    expect(popup).not.toBeNull();
    expect(popup?.querySelector(".called-god-popup__state")?.textContent).toBe("In council");
    expect(popup?.querySelector(".presence-ring")).not.toBeNull();
  });
});

describe("the naming law — nothing Arthurian stands in this doctrine", () => {
  it("no Camelot, no Arthur, no round table in the doctrine's code or the manual", () => {
    const arthurian = /camelot|excalibur|king arthur|round table/i;
    for (const path of [
      "src/avatar/godPresence.ts",
      "src/avatar/godStage.ts",
      "src/avatar/CalledGodPopUp.tsx",
      "src/avatar/SpeechBubble.tsx",
      "src/avatar/manualContent.ts",
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source).not.toMatch(arthurian);
    }
  });
});
