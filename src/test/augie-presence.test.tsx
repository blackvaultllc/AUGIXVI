import { act, render } from "@testing-library/react";
import { Eye } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AugiePresence } from "@/avatar/AugiePresence";
import { CommandBox } from "@/avatar/CommandBox";
import {
  MILESTONE_FLASH_MS,
  PRESENCE_ASSETS,
  PRESENCE_POSTER,
  presenceKindFor,
  type PresenceSignals,
} from "@/avatar/presenceState";

/**
 * Augie's living presence (owner order 2026-11-22): the circular face
 * in the Command box grip must show only what Augie is actually doing.
 * These tests pin the signal → animation mapping so the face can never
 * drift into random decoration, and pin the milestone flash to the
 * real completion of a thinking cycle.
 */

const base: PresenceSignals = {
  ready: true,
  avatarState: "IDLE",
  voiceListening: false,
  acting: false,
  milestone: false,
};

describe("presence state mapping", () => {
  it("connecting while the stage is not ready, whatever else is true", () => {
    expect(presenceKindFor({ ...base, ready: false })).toBe("connecting");
    expect(
      presenceKindFor({ ...base, ready: false, avatarState: "THINKING", milestone: true }),
    ).toBe("connecting");
  });

  it("idle at rest, and the glitch state falls back to the idle face", () => {
    expect(presenceKindFor(base)).toBe("idle");
    expect(presenceKindFor({ ...base, avatarState: "GLITCH" })).toBe("idle");
  });

  it("working while the brain thinks", () => {
    expect(presenceKindFor({ ...base, avatarState: "THINKING" })).toBe("working");
  });

  it("speaking always shows the talking face — the owner's rule, whoever produced the line", () => {
    expect(presenceKindFor({ ...base, avatarState: "SPEAKING" })).toBe("speaking");
    expect(presenceKindFor({ ...base, avatarState: "SPEAKING", acting: true })).toBe("speaking");
    expect(PRESENCE_ASSETS.speaking.video).toBe("/augie-presence/speaking.mp4");
  });

  it("making while Augie visibly acts without speaking (world flight, presenting)", () => {
    expect(presenceKindFor({ ...base, acting: true })).toBe("making");
    // Thinking outranks the acting beat: the brain at work is working.
    expect(presenceKindFor({ ...base, avatarState: "THINKING", acting: true })).toBe("working");
  });

  it("waiting while listening for the operator", () => {
    expect(presenceKindFor({ ...base, avatarState: "LISTENING" })).toBe("waiting");
    expect(presenceKindFor({ ...base, voiceListening: true })).toBe("waiting");
  });

  it("milestone outranks the live state while its flash lasts", () => {
    expect(presenceKindFor({ ...base, avatarState: "SPEAKING", milestone: true })).toBe(
      "milestone",
    );
    expect(presenceKindFor({ ...base, milestone: true })).toBe("milestone");
  });

  it("every kind resolves to a presence asset, with the brief's pairings", () => {
    for (const kind of Object.keys(PRESENCE_ASSETS) as Array<keyof typeof PRESENCE_ASSETS>) {
      expect(PRESENCE_ASSETS[kind].video).toMatch(/^\/augie-presence\/.+\.mp4$/);
      expect(PRESENCE_ASSETS[kind].label.length).toBeGreaterThan(0);
    }
    // Owner's brief: idle doubles as connecting, working doubles as waiting.
    expect(PRESENCE_ASSETS.connecting.video).toBe(PRESENCE_ASSETS.idle.video);
    expect(PRESENCE_ASSETS.waiting.video).toBe(PRESENCE_ASSETS.working.video);
    expect(PRESENCE_POSTER).toBe("/augie-presence/still.webp");
  });
});

describe("AugiePresence component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function face(container: HTMLElement) {
    const root = container.querySelector(".augie-presence");
    const video = container.querySelector("video");
    expect(root).not.toBeNull();
    expect(video).not.toBeNull();
    return { root: root!, video: video! };
  }

  it("shows the connecting face (idle clip, still poster) before the stage is ready", () => {
    const { container } = render(
      <AugiePresence ready={false} avatarState="IDLE" voiceListening={false} acting={false} />,
    );
    const { root, video } = face(container);
    expect(root.getAttribute("data-presence")).toBe("connecting");
    expect(video.getAttribute("src")).toBe("/augie-presence/idle.mp4");
    expect(video.getAttribute("poster")).toBe("/augie-presence/still.webp");
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
  });

  it("works while thinking, flashes milestone when the cycle completes, then settles into the talking face", () => {
    const { container, rerender } = render(
      <AugiePresence ready avatarState="THINKING" voiceListening={false} acting={false} />,
    );
    expect(face(container).root.getAttribute("data-presence")).toBe("working");
    expect(face(container).video.getAttribute("src")).toBe("/augie-presence/working.mp4");

    rerender(<AugiePresence ready avatarState="SPEAKING" voiceListening={false} acting={false} />);
    expect(face(container).root.getAttribute("data-presence")).toBe("milestone");
    expect(face(container).video.getAttribute("src")).toBe("/augie-presence/milestone.mp4");

    act(() => {
      vi.advanceTimersByTime(MILESTONE_FLASH_MS + 100);
    });
    expect(face(container).root.getAttribute("data-presence")).toBe("speaking");
    expect(face(container).video.getAttribute("src")).toBe("/augie-presence/speaking.mp4");
  });

  it("no milestone flash when speech did not come out of a thinking cycle — straight to the talking face", () => {
    const { container, rerender } = render(
      <AugiePresence ready avatarState="IDLE" voiceListening={false} acting={false} />,
    );
    rerender(<AugiePresence ready avatarState="SPEAKING" voiceListening={false} acting={false} />);
    expect(face(container).root.getAttribute("data-presence")).toBe("speaking");
    expect(face(container).video.getAttribute("src")).toBe("/augie-presence/speaking.mp4");
  });

  it("makes while Augie acts without speaking", () => {
    const { container } = render(
      <AugiePresence ready avatarState="IDLE" voiceListening={false} acting={true} />,
    );
    expect(face(container).root.getAttribute("data-presence")).toBe("making");
    expect(face(container).video.getAttribute("src")).toBe("/augie-presence/making.mp4");
  });

  it("waits while listening", () => {
    const { container } = render(
      <AugiePresence ready avatarState="LISTENING" voiceListening acting={false} />,
    );
    expect(face(container).root.getAttribute("data-presence")).toBe("waiting");
  });
});

describe("CommandBox presence slot", () => {
  it("renders the supplied presence inside the grip, ahead of the title", () => {
    const { container } = render(
      <CommandBox
        accent="#d4af37"
        tabs={[{ id: "scene", label: "Scene", icon: Eye }]}
        activeTab="scene"
        onTabChange={() => {}}
        chat=""
        onChatChange={() => {}}
        onSubmit={() => {}}
        voiceAvailable={false}
        voiceListening={false}
        onToggleVoice={() => {}}
        responseLine=""
        responseSource=""
        presence={<span data-testid="presence-slot" />}
      >
        <div />
      </CommandBox>,
    );
    const grip = container.querySelector(".avatar-command-box__grip");
    const slot = container.querySelector('[data-testid="presence-slot"]');
    const title = container.querySelector(".avatar-command-box__title");
    expect(grip).not.toBeNull();
    expect(slot).not.toBeNull();
    expect(grip!.contains(slot)).toBe(true);
    // The face sits at the head of the grip, before the "Command" title.
    expect(slot!.compareDocumentPosition(title!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
