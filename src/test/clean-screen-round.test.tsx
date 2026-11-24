import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Eye } from "lucide-react";
import { CommandBox } from "../avatar/CommandBox";
import { AugiePresence } from "../avatar/AugiePresence";

/**
 * THE CLEAN-SCREEN ROUND (owner voice call 2026-11-24 ~10:40 EST,
 * confirmed "Good" / "That's perfect"):
 * 1. Both HUD panels are OFF the main screen — every readout
 *    (core, phone brain, voice cal, FPS, sensors, activity,
 *    status, intensity, hearing) lives in ONE panel behind a
 *    single Status tab.
 * 2. The folded chat box is OSIRIS'S HEAD ALONE — a medallion like
 *    Anubis's: no name under him, no "Chat" word.
 * 3. His four chat-window options live BEHIND his three-dots
 *    control (Anubis's pattern), never sitting out on the screen;
 *    the resting console is the medallion alone.
 * 4. The head's home is the TOP-LEFT, where the CORE panel sat —
 *    the same place on the phone.
 * 5. EVERY GOD HIS OWN CHAT: tapping any god's medallion routes
 *    the conversation to him AND opens his chat box.
 */
const stageSource = readFileSync(
  path.join(process.cwd(), "src/avatar/AvatarStage.tsx"),
  "utf8",
);
const boxSource = readFileSync(
  path.join(process.cwd(), "src/avatar/CommandBox.tsx"),
  "utf8",
);
const presenceSource = readFileSync(
  path.join(process.cwd(), "src/avatar/AugiePresence.tsx"),
  "utf8",
);
const fixCss = readFileSync(
  path.join(process.cwd(), "src/avatar/stage-fix-round.css"),
  "utf8",
);

function renderBox() {
  return renderToStaticMarkup(
    <CommandBox
      accent="#d4af37"
      tabs={[{ id: "scene", label: "Scene", icon: Eye }]}
      activeTab="scene"
      onTabChange={() => undefined}
      chat=""
      onChatChange={() => undefined}
      onSubmit={() => undefined}
      voiceAvailable={false}
      voiceListening={false}
      onToggleVoice={() => undefined}
      responseLine="Standing by."
      responseSource="test"
      presence={
        <AugiePresence
          ready
          avatarState="LISTENING"
          voiceListening={false}
          acting={false}
          captioned={false}
        />
      }
    >
      <p>panel body</p>
    </CommandBox>,
  );
}

describe("clean-screen round — the status tab", () => {
  it("the stage carries ONE status tab and ONE status panel", () => {
    expect(stageSource).toContain("avatar-status-tab");
    expect(stageSource).toContain("avatar-status-panel");
    expect(stageSource).toContain("STATUS — ONE TAB, OFF THE MAIN SCREEN");
  });

  it("the HUD clusters no longer render as stage frames", () => {
    // The builder-frame wiring for the two panels is gone — the
    // clusters render only inside the status panel, as citizens.
    expect(stageSource).not.toContain('frameStyle("hud-status")');
    expect(stageSource).not.toContain('frameStyle("hud-core")');
    expect(stageSource).not.toContain('frameDragProps("hud-status"');
    expect(stageSource).not.toContain('frameDragProps("hud-core"');
  });

  it("the panel still carries every readout, hearing truth included", () => {
    // The readouts themselves were not deleted — they moved.
    expect(stageSource).toContain("CORE:");
    expect(stageSource).toContain("PHONE BRAIN:");
    expect(stageSource).toContain("VOICE CAL:");
    expect(stageSource).toContain("FPS");
    expect(stageSource).toContain("STATUS:");
    expect(stageSource).toContain("INTENSITY:");
    expect(stageSource).toContain("<VoiceIndicator");
  });

  it("the status chrome is dressed in section 31 of the fix sheet", () => {
    expect(fixCss).toContain("31) THE CLEAN SCREEN");
    expect(fixCss).toContain(".avatar-status-tab");
    expect(fixCss).toContain(".avatar-status-panel");
    expect(fixCss).toContain(".avatar-command-box__console-dots");
    expect(fixCss).toContain(".avatar-command-box__console-menu");
  });
});

describe("clean-screen round — the Osiris console", () => {
  it("the box starts folded at every width: the console is the opening form", () => {
    expect(boxSource).toContain("const [minimized, setMinimized] = useState(true)");
    expect(boxSource).toContain("IS THE OPENING FORM AT EVERY WIDTH");
  });

  it("folded, the box renders the console — medallion plus three dots, nothing else", () => {
    const html = renderBox();
    expect(html).toContain("avatar-command-box--console");
    expect(html).toContain("avatar-command-box__console-face");
    expect(html).toContain('aria-label="Open the chat with Anubis"');
    expect(html).toContain("Open Osiris");
    expect(html).toContain("chat options");
    // The retired forms must not render: no docked phone-bar face,
    // no rail, no thread, no input row.
    expect(html).not.toContain("avatar-command-box__phonebar");
    expect(html).not.toContain("avatar-command-box__rail");
    expect(html).not.toContain("avatar-command-box__thread");
  });

  it("no name, no “Chat” word anywhere on the folded console", () => {
    const html = renderBox();
    expect(html).not.toContain("osiris-presence__caption");
    expect(html).not.toContain(">Chat<");
    expect(html).not.toContain("avatar-command-box__title");
    // The rail's title span is gone from the source for good.
    expect(boxSource).not.toContain("avatar-command-box__title");
  });

  it("the four options live behind the three dots, labeled and complete", () => {
    expect(boxSource).toContain("avatar-command-box__console-menu");
    expect(boxSource).toContain("<span>Open chat</span>");
    expect(boxSource).toContain("Menu — tools &amp; settings");
    expect(boxSource).toContain("Reset — window back home");
    // The anchor option speaks both of its states.
    expect(boxSource).toContain("Anchored — tap to unanchor");
    expect(boxSource).toContain("Unanchored — anchor at home");
  });

  it("the head's home is the top-left corner", () => {
    // The anchor effect and the unmeasured fallback both place
    // the box at the top margin now — never the viewport bottom.
    expect(boxSource).toContain("The anchor home: TOP-LEFT");
    expect(boxSource).not.toContain("viewport.h - height - WINDOW_MARGIN");
  });

  it("the stage suppresses Osiris's caption where it builds his presence", () => {
    expect(stageSource).toContain("captioned={false}");
    // The presence still defaults to captioned for its other homes.
    expect(presenceSource).toContain("captioned = true");
  });
});

describe("clean-screen round — every god his own chat", () => {
  it("the box registers its controls for the stage", () => {
    expect(boxSource).toContain("onMinimizeShortcut?.({ minimize: minimizeNow, restore: restoreNow })");
    expect(stageSource).toContain("chatControlsRef");
    expect(stageSource).toContain("onMinimizeShortcut={(controls) => {");
  });

  it("Anubis's and Montu's medallion taps route AND open the chat", () => {
    expect(stageSource).toContain("EVERY GOD HIS OWN CHAT");
    expect(stageSource).toContain('selectGod("anubis");');
    expect(stageSource).toContain('selectGod("montu");');
    expect(stageSource.match(/openChatBox\(\);/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("no placeholder in the thread (owner order 2026-11-24 ~11:00 EST)", () => {
  it("the stage never passes the placeholder as the thread's live line", () => {
    // The old wiring fell back to the raw "No response yet."
    // sentinel whenever a brain COULD answer — the exact line his
    // screenshot showed under his message while THINKING.
    expect(stageSource).toContain("NO PLACEHOLDER IN THE THREAD");
    expect(stageSource).not.toContain("?? lastWords");
    // While he has a message standing, the live line is empty —
    // thinking shows in the status, not as a fake SYSTEM message.
    expect(stageSource).toContain('? lastUserMessage\n                ? ""');
  });
});
