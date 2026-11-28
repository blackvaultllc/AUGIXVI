import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Eye } from "lucide-react";
import { CommandBox } from "../avatar/CommandBox";

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
 *
 * SUPERSEDED IN PART (owner order 2026-11-24 ~16:57 EST): items
 * 2–4 are replaced. The chat window is the CAPTAIN'S OWN — no god
 * sits in it or heads it; folded, it is its BAR along the bottom,
 * and its home is the BOTTOM-LEFT again. OSIRIS STANDS ALONE on
 * the stage, bare, top-left, animated as before; his four keys
 * live in HIS OWN three-lines menu, with a message option that
 * opens his small message screen under him. Items 1 and 5 stand
 * untouched.
 *
 * SUPERSEDED IN PART AGAIN (owner order 2026-11-26 ~04:32 CST,
 * the one-god screen): Osiris no longer stands on the stage at
 * rest — his medallion is his CALL POP-UP now, rendered only
 * while he is addressed, at the same top-left seat, bare, with
 * the same menu and message screen. Item 5 stands: tap a called
 * god's pop-up and his chat opens, addressed to him.
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
const osirisSource = readFileSync(
  path.join(process.cwd(), "src/avatar/OsirisMedallion.tsx"),
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
      chat=""
      onChatChange={() => undefined}
      onSubmit={() => undefined}
      voiceAvailable={false}
      voiceListening={false}
      onToggleVoice={() => undefined}
      responseLine="Standing by."
      responseSource="test"
     />,
  );
}

describe("clean-screen round — the status tab", () => {
  it("the stage carries ONE status tab and ONE status panel", () => {
    expect(stageSource).toContain("avatar-status-tab");
    expect(stageSource).toContain("avatar-status-panel");
    // PASS 7 (owner order 2026-11-27 ~23:03 CST): the tab is a
    // small pulse symbol in the top bar now — the comment over
    // its panel reads ONE PANEL; the tab and the panel are still
    // one each, and the panel itself is unchanged.
    expect(stageSource).toContain("STATUS — ONE PANEL, OFF THE MAIN SCREEN");
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
    // SUPERSEDED PINS (owner order 2026-11-24 ~16:57 EST): the
    // console-dots/console-menu rules are deleted with the
    // console itself; Osiris's own menu is dressed in section 32.
    expect(fixCss).not.toContain(".avatar-command-box__console-dots");
    expect(fixCss).not.toContain(".avatar-command-box__console-menu");
    expect(fixCss).toContain("32) OSIRIS STANDS ALONE");
    expect(fixCss).toContain(".osiris-medallion__menu-button");
    expect(fixCss).toContain(".osiris-medallion__menu");
  });
});

describe("clean-screen round — the Captain's window, Osiris called", () => {
  it("the box starts folded at every width: the bar is the opening form", () => {
    expect(boxSource).toContain("const [minimized, setMinimized] = useState(true)");
    expect(boxSource).toContain("THE BAR IS");
    expect(boxSource).toContain("THE OPENING FORM AT EVERY WIDTH");
  });

  it("folded, the box renders the bar — the message line, no god in it", () => {
    const html = renderBox();
    expect(html).toContain("avatar-command-box--minimized");
    expect(html).toContain("avatar-command-box__bar");
    expect(html).toContain("Message for Anubis");
    // The retired forms must not render: no console, no god's
    // face, no rail, no thread.
    expect(html).not.toContain("avatar-command-box--console");
    expect(html).not.toContain("avatar-command-box__console-face");
    expect(html).not.toContain("augie-presence");
    expect(html).not.toContain("avatar-command-box__rail");
    expect(html).not.toContain("avatar-command-box__thread");
  });

  it("no name, no “Chat” word, no title anywhere on the folded window", () => {
    const html = renderBox();
    expect(html).not.toContain("osiris-presence__caption");
    expect(html).not.toContain(">Chat<");
    expect(html).not.toContain("avatar-command-box__title");
    // The rail's title span is gone from the source for good.
    expect(boxSource).not.toContain("avatar-command-box__title");
  });

  it("the four keys live in Osiris's three-lines menu now, with his message option", () => {
    // The keys left the box entirely (owner order 2026-11-24
    // ~16:57 EST): Osiris's own medallion carries them — anchor,
    // reset, menu, fold — in a horizontal row behind his
    // three-lines button, plus the message option that opens
    // his direct-message screen under him.
    expect(boxSource).not.toContain("avatar-command-box__console-menu");
    expect(osirisSource).toContain("Open Osiris's menu");
    expect(osirisSource).toContain("Anchor the chat window");
    expect(osirisSource).toContain("Unanchor the chat window");
    expect(osirisSource).toContain("Reset the chat window to its home form");
    expect(osirisSource).toContain("Open the chat window's menu");
    expect(osirisSource).toContain("Minimize the chat window");
    expect(osirisSource).toContain("Message Osiris directly");
  });

  it("the window's home is the bottom-left corner again", () => {
    // SUPERSEDED (owner order 2026-11-24 ~16:57 EST): the
    // top-left home belonged to the console morning; the
    // Captain's window stands along the bottom — the anchor
    // effect and the unmeasured fallback both place it at the
    // bottom margin now.
    expect(boxSource).toContain("The anchor home: BOTTOM-LEFT");
    expect(boxSource).toContain("viewport.h - height - WINDOW_MARGIN");
  });

  it("Osiris's pop-up stands on the stage only while he is called, his caption suppressed", () => {
    expect(stageSource).toContain("<OsirisMedallion");
    // The one-god gate (owner order 2026-11-26): the medallion
    // renders only while the addressee state calls him, held
    // through its leaving tail by the pop-up presence hook.
    expect(stageSource).toContain('usePopUpPresence(addressee === "osiris")');
    expect(stageSource).toContain("osirisPop.shown");
    expect(osirisSource).toContain("captioned={false}");
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

  it("a called god's pop-up tap routes AND opens the chat", () => {
    // SUPERSEDED IN PART (owner order 2026-11-24 ~11:27–11:31 EST,
    // the gods-on-the-sides round; refined again ~16:57 EST;
    // refined again 2026-11-26 ~04:32 CST, the one-god screen):
    // the tap that routes and opens is now the called god's
    // POP-UP tap — Montu's pop-up face opens the chat (addressed
    // to him: the pop-up stands only while he holds the call),
    // and Osiris's pop-up face turns the conversation to him and
    // opens the window. The law itself is unchanged: tap a god,
    // and his chat opens, addressed to him.
    expect(stageSource).toContain("EVERY GOD HIS OWN CHAT");
    expect(stageSource).toContain("<CalledGodPopUp");
    expect(stageSource).toContain("onSelect={openChatBox}");
    expect(stageSource).toContain('applyAddressee("osiris")');
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
