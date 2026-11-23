import { describe, expect, it } from "vitest";
import {
  ADDRESSEE_NAMES,
  DEFAULT_ADDRESSEE,
  detectAddressee,
  speakerDirective,
} from "@/avatar/addressee";

/**
 * THE ADDRESSEE — A ROUTING STATE (owner order 2026-11-23 ~07:19
 * EST). The Captain's screenshots: "Anubis, can you hear me?"
 * answered by the core in its own name, under an ANUBIS label. The
 * routing these tests pin: an explicit address switches who is
 * speaking; a passing mention never does; the directive the prompt
 * carries names the same one the thread label shows.
 */
describe("the default addressee", () => {
  it("is Anubis, the resident commander", () => {
    expect(DEFAULT_ADDRESSEE).toBe("anubis");
    expect(ADDRESSEE_NAMES).toEqual({ anubis: "Anubis", montu: "Montu", osiris: "Osiris" });
  });
});

describe("explicit address switches the conversation", () => {
  it("a vocative opening — the Captain's actual line", () => {
    expect(detectAddressee("Anubis, can you hear me?")).toBe("anubis");
    expect(detectAddressee("Osiris, can you hear me?")).toBe("osiris");
    expect(detectAddressee("Montu, report")).toBe("montu");
  });

  it("voice transcription drops the comma — the name still routes", () => {
    expect(detectAddressee("anubis can you hear me")).toBe("anubis");
    expect(detectAddressee("osiris are you there")).toBe("osiris");
    expect(detectAddressee("hey montu what is the status")).toBe("montu");
  });

  it("the bare name is an address", () => {
    expect(detectAddressee("Osiris")).toBe("osiris");
    expect(detectAddressee("montu.")).toBe("montu");
    expect(detectAddressee("Anubis")).toBe("anubis");
  });

  it("call forms route: talk to, speak to, ask", () => {
    expect(detectAddressee("talk to Osiris")).toBe("osiris");
    expect(detectAddressee("speak to Montu")).toBe("montu");
    expect(detectAddressee("ask Osiris about the cameras")).toBe("osiris");
  });

  it("a greeting before the name does not hide the address", () => {
    expect(detectAddressee("Hey Osiris, wake up")).toBe("osiris");
    expect(detectAddressee("ok anubis, listen")).toBe("anubis");
  });
});

describe("a passing mention never switches", () => {
  it("a question ABOUT a god, asked TO the current addressee, stays put", () => {
    expect(detectAddressee("What does Osiris think of this?")).toBeNull();
    expect(detectAddressee("Tell me about Montu")).toBeNull();
    expect(detectAddressee("What is Anubis doing?")).toBeNull();
  });

  it("a statement about a god is not an address to him", () => {
    expect(detectAddressee("Osiris is the core under Anubis")).toBeNull();
    expect(detectAddressee("Anubis is the command face, right?")).toBeNull();
    expect(detectAddressee("Montu has the watch tonight")).toBeNull();
  });

  it("stage orders that merely contain a name do not route", () => {
    expect(detectAddressee("call Osiris in")).toBeNull();
    expect(detectAddressee("bring augi in")).toBeNull();
    expect(detectAddressee("open the notepad")).toBeNull();
    expect(detectAddressee("")).toBeNull();
  });
});

describe("the speaker directive — the prompt's edge of the routing", () => {
  it("names the one speaking, per addressee", () => {
    expect(speakerDirective("anubis")).toContain("You are speaking as Anubis");
    expect(speakerDirective("montu")).toContain("You are speaking as Montu");
    expect(speakerDirective("osiris")).toContain("You are speaking as Osiris");
  });

  it("the structure is stated in the speaker's own first person", () => {
    expect(speakerDirective("anubis")).toContain("Osiris is the core beneath me");
    expect(speakerDirective("osiris")).toContain("Anubis is the face in command above me");
    expect(speakerDirective("montu")).toContain("the Captain seated us so");
  });

  it("carries the bans: no name-denial, no recitation, no third person, no boilerplate", () => {
    for (const addressee of ["anubis", "montu", "osiris"] as const) {
      const directive = speakerDirective(addressee);
      expect(directive).toContain("Never deny the name you are addressed by");
      expect(directive).toContain("Never recite it as a correction");
      expect(directive).toContain("never speak of him in the third person");
      expect(directive).toContain('"functioning as intended"');
      expect(directive).toContain('"The Captain is currently available"');
      expect(directive).toContain('"I hear you, Captain."');
    }
  });
});
