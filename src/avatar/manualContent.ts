/**
 * THE MASTER MANUAL — the Captain's order (2026-11-23): "A whole
 * manual, a master manual IN the system. Whatever we build, I can go
 * to that master manual and understand how to operate it — training
 * AUGI, adding the environment, even the post system — everything,
 * all things. Literally if the whole world got wiped out today of
 * data and I have that manual, I can rebuild everything because I
 * know what's in here — what it takes."
 *
 * This file is the manual's words. The page at /manual renders it.
 * A document copy lives in the offline vault (MASTER-MANUAL.md).
 *
 * STANDING RULE (his order, same day): every future build adds its
 * manual entry here as part of done. A build with no manual entry
 * is not finished.
 *
 * TRUTH RULE (the system's standing law): every entry carries its
 * real state — LIVE, BEING BUILT, DESIGN ONLY, or GAP. Nothing in
 * this manual claims a thing works that does not. Secret values
 * never appear — where a key goes and what it is named, never the
 * key.
 */

export type ManualState = "live" | "building" | "design" | "gap";

export const MANUAL_STATE_LABEL: Record<ManualState, string> = {
  live: "LIVE — built and working",
  building: "BEING BUILT — in the current build round",
  design: "DESIGN ONLY — drawn up, not built yet",
  gap: "GAP — missing or waiting on a decision",
};

export interface ManualEntry {
  id: string;
  title: string;
  state: ManualState;
  /** What it is, in plain words. */
  what: string;
  /** How to operate it — his steps, in order. */
  steps?: string[];
  /** Where it lives — the screen, the file, the machine. */
  where?: string;
  /** The honest catch, when there is one. */
  note?: string;
  /** A table for inventory-style entries (the dependency list). */
  table?: { head: string[]; rows: string[][] };
}

export interface ManualCategory {
  id: string;
  title: string;
  hint: string;
  entries: ManualEntry[];
}

export const MANUAL_FRONT = {
  title: "The Master Manual",
  promise:
    "Everything Augie can do, written down in one place — how to work it, where it lives, and what it is made of. If the whole world got wiped out today of data and you have this manual, you can rebuild everything, because you know what's in here and what it takes.",
  standingRule:
    "STANDING RULE: every build adds its page to this manual as part of done. If it isn't in here, it isn't finished.",
  truthMarks:
    "Every entry carries its true state: LIVE, BEING BUILT, DESIGN ONLY, or GAP. This manual never claims a thing works that doesn't.",
};

export const MANUAL_CATEGORIES: ManualCategory[] = [
  {
    id: "stage",
    title: "Getting around the stage",
    hint: "The main screen — what's where, and how to open things.",
    entries: [
      {
        id: "stage-glance",
        title: "The stage at a glance",
        state: "live",
        what: "The stage is home. Anubis sits center, big — he is the face you talk to day to day. The AUGI construct (the sand figure) moves on the stage and does the visible work. Readouts sit in the corners: CORE and brain state top-left, STATUS and INTENSITY top-right. The chat box lives on the left on a computer and as a bottom bar on a phone.",
        steps: [
          "Open Augie and sign in — the stage is what you land on.",
          "Nothing opens itself. Every tool opens when you open it and closes when you close it.",
          "Windows open small, on top of the stage — the stage stays visible behind them.",
        ],
        where: "The /avatar page — on the Parrot, on the phone, and online.",
      },
      {
        id: "stage-tools",
        title: "Opening tools — the command box tabs",
        state: "live",
        what: "The command box carries tabs (Chat, Tools, and the rest). The Tools tab is organized in categories — Worlds & building, Senses & analysis, and more — one obvious place per thing, no long scroll of buttons.",
        steps: [
          "Open the Tools tab in the command box.",
          "Find the category, tap the tool. It opens as a compact window.",
          "Close it with its X, or minimize it — windows have working minimize and resize.",
          "How-to text lives behind the Help (?) button inside a tool, never sprayed across the stage.",
        ],
        where: "The command box on the stage.",
      },
      {
        id: "stage-exit",
        title: "Getting back — the “← Augie” exit",
        state: "live",
        what: "Every full page in Augie carries a “← Augie” button at the top. One tap takes you back to the stage. A full page is never a trap.",
        steps: ["On any full page, tap “← Augie” in the top bar. You are back on the stage."],
        where: "The top bar of every full page — this manual included.",
      },
    ],
  },
  {
    id: "gods",
    title: "Talking to the gods",
    hint: "Who answers you, how the conversation routes, and the respect law.",
    entries: [
      {
        id: "gods-addressee",
        title: "Who you are talking to — the addressee",
        state: "live",
        what: "The one you address is the one who answers. By default that is ANUBIS — you talk in the box, Anubis replies, and the yellow name beside your line reads ANUBIS. Name another god — typed or spoken — and that god becomes the one you are talking to: he is pulled up on screen, the name in the thread becomes his, and his replies are his until you address another. Anubis relays to the other gods through you. Nobody speaks through another god's mouth.",
        steps: [
          "Just talk — Anubis answers.",
          "Say or type another god's name to switch to him (for example: “Osiris, …” or “Montu, …”).",
          "The yellow speaker name in the thread always shows who is really answering — the label and the words never disagree.",
          "Ask Anubis a question ABOUT another god and Anubis still answers — naming a god in a question is not the same as addressing him.",
        ],
        where: "The chat box and the voice ear, on every surface — the phone brain follows the same rule.",
        note: "The structure underneath (you at the top, Anubis the command face, Osiris the core working in the chat window and watching over everything, AUGI the construct on stage) is knowledge the gods can state when you ASK about it. It is never recited at you as a correction when you simply address one of them.",
      },
      {
        id: "gods-bubble",
        title: "The speech bubble — the pop-up when a god speaks",
        state: "live",
        what: "When a god answers or comes in to make a report, he appears in his circular medallion — the same round circumference as Anubis's medallion — and immediately beside the circle sits the comic-style chat box, his name on a tag inside it, his words typed in the box as he speaks. That is the whole presentation, for replies and reports alike. There is NO notification card and NO corner stack: a report rendered as a card in the bottom-right corner was killed on your verdict (2026-11-23 — “it looks stupid”). The popped-up god always renders fully inside the stage, at a sane size.",
        steps: [
          "Ask something — the answering god rises in his medallion and speaks, the comic box beside his circle.",
          "To turn the bubble off: in the chat box Menu, or in the god's own menu, set “Speech bubble” to Off. Replies then come as voice + the thread only. The setting is remembered.",
        ],
        where: "The stage, at the speaking god's place — medallion and comic box as one unit.",
      },
      {
        id: "gods-capabilities",
        title: "What he can do — and an answer that fails",
        state: "live",
        what: "Ask him what he can access — the camera, the dog, a device — and he answers from a capability brief carried in his reply context: the same facts this manual keeps (each line of the brief names the manual entry it mirrors, and a test fails if the two drift apart). Built-but-unproven things are stated exactly that way — Wepwawet's control is “built and ready, not yet proven live” until the first live test is fired. And an answer can no longer die silently: if the brain fails, times out, or returns nothing, the failure is logged and a plain-words line is spoken and recorded in the thread saying so — your question always gets an answer, even when the answer is the failure itself.",
        steps: [
          "Ask “can you access the camera?” or “can you drive the dog?” — he answers from the brief, with the true state.",
          "If a reply ever fails, read the thread: the failure line is recorded there with the exchange.",
        ],
        where: "The reply context of every brain (local and on-phone); the brief lives in src/avatar/capabilities.ts.",
      },
      {
        id: "gods-respect",
        title: "Respect — the gods are not handled",
        state: "live",
        what: "These are your gods — Egyptian gods. Nobody drags them around and nobody handles their faces. Anubis does not move: he sits centered and big, and the stage's perspective changes by button (Left / Front / Right), never by moving him. If a god's face is poked at over and over, he asks — once, politely — not to be handled. Placement changes live behind a deliberate EMERGENCY EDIT unlock that you turn on; turning it off re-seats him centered.",
        steps: [
          "To change the view: use the Left / Front / Right perspective buttons in Anubis's menu.",
          "To move a medallion (rare): open the god's menu, turn on EMERGENCY EDIT, place him, turn it off.",
          "Speak to them and they answer. That is the whole interaction.",
        ],
        where: "Each god's menu on the stage.",
      },
      {
        id: "gods-drive",
        title: "Driving the construct — WASD",
        state: "live",
        what: "The AUGI construct on the stage is yours to drive. WASD moves him, SPACEBAR is his action key. Anchored means he is set into the stage and free to move and work; unanchored means you lifted him out to fix something. (Placed objects use the opposite word the same way builders do: anchored = locked in place.)",
        steps: [
          "Click the stage so it has focus.",
          "W A S D — walk him. SPACEBAR — act.",
          "His position is remembered between visits.",
        ],
        where: "The stage.",
      },
    ],
  },
  {
    id: "chat",
    title: "The chat box",
    hint: "The conversation window — computer and phone, history, and the comic style.",
    entries: [
      {
        id: "chat-pc",
        title: "The chat box on a computer",
        state: "live",
        what: "A plain chat window on the left of the stage — no dropdowns, no clutter. Messages stack bottom-up, newest at the bottom, and the typing line stays pinned at the panel's bottom. The box can be moved and stretched; its size is remembered. At its smallest size everything still fits inside the border — the icon row, the rail, and every line of text.",
        steps: [
          "Type in the line at the bottom, or tap the mic and speak.",
          "Drag the box by its edge to move it; drag a corner to resize it.",
          "Tap the emoji key to open the emoji picker — the emoji lands where your cursor is.",
        ],
        where: "Left side of the stage on a computer.",
      },
      {
        id: "chat-phone",
        title: "The chat box on a phone",
        state: "live",
        what: "On a phone the chat is a bar across the bottom — the same conversation, the same sequence as the computer. Tap it and it opens up; tap again and it settles back to the slim bar. The stage behind it keeps the same composition as the computer: same backdrop, same Anubis, big.",
        steps: [
          "Tap the bottom bar to open the chat.",
          "Type or speak your command.",
          "Tap the bar again to minimize it back to the slim strip.",
        ],
        where: "Bottom of the stage on a phone.",
      },
      {
        id: "chat-history",
        title: "Clear and History — the terminal law",
        state: "live",
        what: "Clear wipes the visible screen only — like a terminal. The full conversation record is never touched by Clear; it lives behind the History button, with dates and times on every entry. And the thread opens clean when you arrive: what you see first is a fresh screen, not yesterday's talk. The record is one tap away, whole.",
        steps: [
          "Clear — the screen empties. Nothing is deleted.",
          "History — the full dated record opens. Read anything, any day.",
          "Idle musings never enter the thread. What is in the thread is real conversation.",
        ],
        where: "Buttons in the chat box.",
      },
      {
        id: "chat-style",
        title: "The comic style",
        state: "building",
        what: "Your call (2026-11-23): the chat box goes FULL COMIC STYLE — bold frames, stacked rows with the speaker's name tagged, comic speech bubbles when the gods talk, strong color — the anime/comic look from the references you sent. The stage and the medallions keep their Egyptian gold; the comic lives in the conversation. One thing style never touches: the words stay big enough for your eyes — nothing shrinks for style, and nothing clips or overlaps at any size.",
        steps: ["Nothing for you to do — it lands with the current build round, on the computer box and the phone bar alike."],
        where: "The chat box and the speech bubble.",
      },
    ],
  },
  {
    id: "voice",
    title: "Voice — speaking and hearing",
    hint: "How Augie talks, how he hears, and what the readouts really mean.",
    entries: [
      {
        id: "voice-speak",
        title: "How Augie speaks",
        state: "live",
        what: "On the Parrot, Augie's voice is Piper — a real neural voice that lives on the machine (en_US-joe-medium) and needs no internet. The gods speak with a deeper British male voice as the standing default; a woman's voice only when the speaker is a woman. Online, devices with their own speech backend (like your phone) use the browser voice. Honest machine fact: the Parrot has no speech-dispatcher, so Chromium's built-in speech can never make sound there — Piper is the voice on the Parrot, by design.",
        steps: [
          "Ask anything — the reply is spoken and the speaker's mouth moves while he talks.",
          "Voice volume is yours: Settings → Voice volume. On the phone it plays at full phone volume.",
          "Silent mode is a real switch you set — Augie never boots muted on his own anymore.",
        ],
        where: "Piper lives at ~/augie-tools/piper on the Parrot; the speak path is the app's /api/say.",
        note: "Proof standard: plumbing has been proven (a real spoken WAV came back from the Parrot). Your ear on your machine is the final gate — voice is proven when YOU hear him right.",
      },
      {
        id: "voice-hear-offline",
        title: "How Augie hears — offline",
        state: "live",
        what: "On the Parrot, your words are transcribed on the machine itself by faster-whisper (the augie-stt service) — nothing leaves the house. It was proven end to end: speak, and your exact words land as a command.",
        steps: [
          "Tap the mic in the chat box (or use push-to-talk).",
          "Speak. Your words appear as your line in the thread, and the addressed god answers.",
          "Push-to-talk takes the mic back from Sound Watch within a tick — talking to Augie always wins.",
        ],
        where: "augie-stt.service on the Parrot, 127.0.0.1:8765.",
      },
      {
        id: "voice-hear-online",
        title: "How Augie hears — online",
        state: "gap",
        what: "Hearing on the ONLINE copy does not work yet, and the app says so honestly instead of pretending. The online Worker's transcription door forwards to the Parrot's speech service address, which from the cloud reaches nothing. The missing piece is a cloud transcription provider. Groq's Whisper fits, and a Groq slot already exists in your Connections — but voice clips would leave the machine, and the key is yours to enter. That decision is yours and it is still open. Until you make it, online hearing works through the Parrot (Tailscale or home Wi-Fi).",
        steps: ["No steps — this waits on your word: wire Groq Whisper for online hearing, or leave online hearing Parrot-only."],
        where: "The /api/transcribe route on the online Worker.",
      },
      {
        id: "voice-calibration",
        title: "Voice calibration and your voiceprint",
        state: "live",
        what: "Calibration teaches Augie your voice. The voiceprint is how he knows it is you. Enrollment is four sentences, read once, on the machine.",
        steps: [
          "Settings → Voice calibration.",
          "Read the four sentences it gives you, at your normal voice.",
          "Tap Finish, then turn the voiceprint ON.",
          "From then on, your voice carries your authority with him.",
        ],
        where: "Settings → Voice calibration, on the Parrot.",
      },
      {
        id: "voice-truth",
        title: "Mic truth — what STATUS really says",
        state: "live",
        what: "The readouts never lie. STATUS reads MIC OFF unless the ear is actually capturing — a resting system never claims to be listening. The voice indicator's graph moves only on sound your mic really picked up, never on a canned animation, and it says HEARING or NOT HEARING in plain words, with the reason.",
        steps: [
          "STATUS: SPEAKING — a god is talking right now.",
          "STATUS: LISTENING — the ear is open and capturing.",
          "STATUS: MIC OFF — the ear is not capturing. Nothing is hearing you.",
          "STATUS: IDLE — awake, at rest, nothing happening.",
        ],
        where: "Top-right of the stage; the voice indicator sits under STATUS.",
      },
    ],
  },
  {
    id: "training",
    title: "Training Augie",
    hint: "Teaching him sounds, devices, and your voice — what he learns, he keeps.",
    entries: [
      {
        id: "train-sound",
        title: "Teach him a sound — the Pokédex loop",
        state: "live",
        what: "Augie's senses follow the doctrine of the best of nature: a bat hears before it crashes, a dog reads the world by sense. For anything he does not know, he never guesses — he says: “Sir, I don't understand what that is — it's on the to-classify list.” Once a thing is classified, it is added to his intelligence permanently. Sound Watch is where sounds get taught.",
        steps: [
          "Open Senses & analysis → Sound Watch → Start watching.",
          "Make the sound (a clap, a knock, your voice). It lands in the list as UNCLASSIFIED, with the time, how loud, and a distance band (an estimate, always labeled one).",
          "Tap the entry, give it a name, tap “Teach it.” It enters your personal sound library.",
          "Make the same sound again — he reports it under YOUR name, marked as a library match, with a match percentage.",
          "Per sound, you can flip “Alert me for this sound” on or off, or Forget it entirely.",
        ],
        where: "Sound Watch window; your library is stored on the device (augi.soundwatch.library.v1).",
        note: "No audio is ever stored — only labels, levels, times, and fingerprint numbers. Your names outrank any machine label, always.",
      },
      {
        id: "train-device",
        title: "Register a device by hand",
        state: "live",
        what: "A device Augie should know by name gets a registry card: what it is, how it speaks, its signal names. A registered device's signal coming up is a summons — Augie stands at attention while it is up.",
        steps: [
          "Open Devices → Register a device by hand.",
          "Name it (for example: Magic Wand), pick its kind (camera), its connection (Wi-Fi access point).",
          "Enter its SSID and its activation SSID exactly as it broadcasts them (for the wand: SOFTISH-1851 in both).",
          "Check the beacon role if its signal should summon him. Save.",
        ],
        where: "Devices window on the stage.",
      },
      {
        id: "train-config",
        title: "Save a configuration — Anatomy versions",
        state: "live",
        what: "Anatomy shows the system's parts and their state (Vision, Brain, Ear, Core, Voice Gate, Watcher, Library). A named configuration version freezes how the system is set up, so a known-good setup can be returned to.",
        steps: [
          "Open Anatomy.",
          "Set the system up the way you want it.",
          "Save it as a named version. It is kept with its name and date.",
        ],
        where: "Anatomy window on the stage.",
      },
    ],
  },
  {
    id: "cameras",
    title: "Cameras",
    hint: "Your cameras inside Augie — live lenses, snapshots, and the moving lens.",
    entries: [
      {
        id: "cameras-surface",
        title: "The Cameras window",
        state: "live",
        what: "One surface for every camera you own. Each camera shows its lenses live, a snapshot button, and — for a moving lens — a PTZ pad (pan, tilt, zoom). Streams are bridged through the Parrot, so what you watch travels your own network first.",
        steps: [
          "Open Tools → the Cameras window.",
          "Pick the camera. Its lenses show live.",
          "Tap Snapshot to grab a still. For the PTZ lens, use the pad to move it.",
        ],
        where: "Cameras window on the stage; the bridge runs on the core machine (the Parrot).",
        note: "Cameras live on the core machine — open the Cameras window on the Parrot copy of Augie for the full surface.",
      },
      {
        id: "cameras-add",
        title: "Adding a camera",
        state: "live",
        what: "Augie connects to any camera you own. A camera is found on your network (RTSP on port 554, ONVIF usually on 8080), its streams are proven with real frames — which path is which lens is verified, never guessed — and it is registered with a full fingerprint. Camera passwords live in the server-side credential store on the core machine, locked down (mode 0600). Never in chat, never in this manual.",
        steps: [
          "Plug the camera in and put it on your Wi-Fi (its phone app does the pairing).",
          "Tell Augie to hook it up — discovery scans your network from the Parrot.",
          "If the camera's app keeps ONVIF/RTSP off (the O-KAM family does), set the device password in the camera's app — that is the switch that opens the door. Augie never guesses or forces a password.",
          "Once proven, the camera appears in the Cameras window with both lenses and its PTZ pad.",
        ],
        where: "Registry + credential store on the Parrot; control runs under the Permission Law (see Devices & the registry).",
      },
      {
        id: "cameras-first",
        title: "Your first unit — the dual-lens on your desk",
        state: "live",
        what: "Your SZSinocam dual-lens unit (fixed lens + PTZ lens) is the first camera in the system, registered with control granted by your word on 2026-11-23. The USB lead into the Parrot is power only — the camera works over Wi-Fi through its app (O-KAM family).",
        steps: ["Keep it powered and on your Wi-Fi. Open the Cameras window on the Parrot to watch it."],
        where: "Your desk; the Cameras window.",
      },
    ],
  },
  {
    id: "soundwatch",
    title: "Sound Watch",
    hint: "The room's ear — what it hears, what it knows, what it does with the unknown.",
    entries: [
      {
        id: "sw-how",
        title: "How Sound Watch works",
        state: "live",
        what: "Sound Watch listens to the room through the mic and measures every sound that rises above the room's own quiet: how loud, how long, its dominant pitch and character. Distance is read as a band — NEAR, MID, FAR — from loudness, and it is always labeled an estimate. It reports no direction, because one mic cannot know one. It shares the mic with the voice ear politely: when you push-to-talk, Sound Watch stands by and shows why.",
        steps: [
          "Open Senses & analysis → Sound Watch.",
          "Tap Start watching. The panel shows it is listening.",
          "Every sound lands as an entry: time, level, distance band (estimate), and its name — yours, the classifier's, or UNCLASSIFIED.",
          "Tap Stop when you are done. The watch ends; the record stays.",
        ],
        where: "Sound Watch window; detection runs on the device, from measured sound features.",
      },
      {
        id: "sw-classifier",
        title: "The built-in classifier — YAMNet",
        state: "building",
        what: "The shipped Sound Watch measures sounds but carries no built-in name list of its own — it cannot tell a human voice from an animal by itself, and its panel says exactly that. The real classifier is YAMNet (Google's sound brain, 521 kinds of sound). You approved its package on 2026-11-23; wiring it in is the follow-up now in progress. When it lands: sounds get machine names with a confidence score, weak guesses (under 30%) fall back to UNCLASSIFIED, your library names still outrank the machine, and human sounds (speech, footsteps, a shout, a scream) can raise alerts.",
        steps: ["Nothing for you to do — approval is given and the wiring is in the build queue. This entry's state flips to LIVE when it ships."],
        where: "Sound Watch; the model runs on the device — sound never leaves the machine to be named.",
      },
      {
        id: "sw-alerts",
        title: "Alerts from Sound Watch",
        state: "live",
        what: "Today, alerts come only from YOUR library: teach a sound, flip its “Alert me for this sound” switch, and that sound raises you when it is heard. Automatic alerts for human sounds arrive with the classifier (above) — until then the system does not pretend otherwise.",
        steps: [
          "Teach the sound first (see Training Augie → Teach him a sound).",
          "In the library list, turn on “Alert me for this sound.”",
          "Leave Sound Watch running. When the sound is heard, the alert fires.",
        ],
        where: "Sound Watch window → your library.",
      },
    ],
  },
  {
    id: "world",
    title: "The world builder",
    hint: "Building your world — pieces, layouts, pictures, and the map of what you built.",
    entries: [
      {
        id: "world-place",
        title: "Placing and working pieces",
        state: "live",
        what: "The builder holds the pieces — buildings, trees, structures, in many forms, sizes, and colors (over two thousand combinations). You place them on your ground, and what you place is yours to work: select a placed piece and you can move it, rotate it, lock it in place (anchor), or delete it. Nothing you placed is ever stuck.",
        steps: [
          "Open Tools → Environment Builder.",
          "Pick a piece, a form, a size, a color — place it on the ground.",
          "Tap a placed piece to select it: drag to move, use Rotate for its facing, Anchor to lock it, Delete to remove it.",
          "One Help line in the builder states the whole interaction — it is always there.",
        ],
        where: "Environment Builder panel on the stage.",
        note: "The tap-to-select control cluster (Move / Rotate / Delete / Done, at the piece itself) has landed — it is on the stage now, in this build.",
      },
      {
        id: "world-layouts",
        title: "Named layouts — saving your arrangements",
        state: "live",
        what: "An arrangement you like gets a name and is kept. Layouts can be switched, renamed, deleted, and carried: export makes a small data-only file (kind “augi-room”, version 1) and import reads it back whole. Your home plot and your saved layouts keep their exact coordinates — the world grows around them, never over them.",
        steps: [
          "In the builder, open Layouts.",
          "Save the current arrangement under a name.",
          "Switch layouts any time; export/import to move one between machines.",
        ],
        where: "Builder panel → Layouts (stored as augi.avatar.builder.layouts.v1).",
      },
      {
        id: "world-backdrop",
        title: "Backdrop pictures — yours, whole or full-screen",
        state: "building",
        what: "The stage's backdrop is your picture. Today it shows WHOLE — the entire picture, centered, nothing cut — over a black holder, so the picture stands out. The fit CHOICE is landing in the current build round: “Whole picture” (as today) or “Fill screen” (the picture cascades edge to edge, edges trimmed to fit), and the choice is remembered.",
        steps: [
          "Open the backdrop picker on the stage.",
          "Pick one of your pictures (or a shipped scene).",
          "When the fit choice lands: choose Whole picture or Fill screen.",
          "For a picture to cascade cleanly: landscape, 16:9, at least 1920×1080 (2560×1440 or 3840×2160 is sharper). For the phone: portrait 1080×1920 fills it.",
        ],
        where: "The backdrop picker; shipped pictures live in public/stage-backdrops.",
      },
      {
        id: "world-sync",
        title: "One background on every screen — sync",
        state: "live",
        what: "Your call (2026-11-23): the background goes through the online side, so the phone, the tablet, and the computer wear the same picture. Your stage settings already follow your account — when you are signed in, the account copy wins and every device picks it up; offline, each device keeps its last settings and works as it is. The backdrop picture and fit are being wired into that same sync in the current round — until it lands, the backdrop itself is still per-device while the rest of your settings follow you.",
        steps: [
          "Sign in on each device with your operator account.",
          "Set your stage up once — settings follow the account.",
          "No network? The device keeps its last synced state and runs offline whole.",
        ],
        where: "Settings sync (operator account) — local storage is the floor, the account copy rides on top.",
      },
      {
        id: "world-bigger",
        title: "The bigger world, the world sky, and the built-world map",
        state: "live",
        what: "Your world has outgrown the home plot. The ground extends past your plot into darkness — unbuilt land is dark void, no fake terrain — and the far ground runs to a horizon. You pan the view (drag the ground, hold, or keys) to go elsewhere and build there; pieces place anywhere, and ground can be claimed as plots with their own cover. A “World sky” slot takes your horizon pictures (stars above, earth below) as the far background — separate from the room's backdrop. And the built-world map shows YOUR world: your plots and pieces, and the inhabitants — the construct and the gods — at their real positions, moving as they move. A god you are talking to can raise the map mid-conversation when you ask.",
        steps: [
          "Drag the ground (or use the pan keys) to travel past your home plot — your plot and layouts stay exactly where you left them.",
          "Claim ground and lay its cover from the builder, anywhere in the world.",
          "Set the World sky from the backdrop controls when you have a horizon picture (the size guidance in the backdrop entry applies).",
          "Open the World Map to see your whole built world and who is standing where.",
        ],
        where: "The stage world, the builder, and the World Map panel.",
        note: "Driving vehicles is NOT in this round — the map shows positions and the construct walks. Vehicles are a later layer, named here so nobody mistakes the map for it.",
      },
    ],
  },
  {
    id: "devices",
    title: "Devices & the registry",
    hint: "Everything Augie knows about your devices — and the law that governs control.",
    entries: [
      {
        id: "devices-law",
        title: "The Permission Law",
        state: "live",
        what: "The law, plain: any device you OWN that speaks Wi-Fi or Bluetooth and shows up in the signals may be MAPPED — Augie may learn what it is. CONTROL is a different thing: it takes your explicit permission, per device. Every registry card carries two flags — ownerConfirmed (it is yours) and controlGranted (you said he may work it). Both must be yes before he can control anything. The default is NO control.",
        steps: [
          "Open Devices to see the registry.",
          "A card shows what is known about the device and its two flags.",
          "Grant control only by your word, per device. Revoke the same way.",
        ],
        where: "Devices window; the registry lives on the core.",
      },
      {
        id: "devices-mastery",
        title: "Device Mastery — the fingerprint",
        state: "live",
        what: "On first contact Augie maps everything a device exposes — identity, addresses, ports, protocols, what it can do — into its fingerprint. Anything mapped but not yet proven shows as exactly that: “mapped but not yet proven (not usable).” Nothing wears a green light it has not earned.",
        steps: ["Open a device's card in Devices — its fingerprint is the whole picture: what it is, how to reach it, what is proven."],
        where: "Devices window → a device's card.",
      },
      {
        id: "devices-watcher",
        title: "The watcher — how Augie sees signals",
        state: "live",
        what: "Scanning happens only where a platform allows it: the Parrot (its Wi-Fi watcher sweeps about every twenty seconds), the native phone companion, and the router's client list. The browser never scans — it has no such power and is never given a job it cannot do. A registered device's signal coming up is a summons (the Batman Signal): Augie stands at attention while it is up, and stands down when it goes down.",
        steps: ["Open Devices or the Signal Map to watch what the watcher is hearing right now."],
        where: "augie-wifi-watcher service on the Parrot; Signal Map window on the stage.",
      },
    ],
  },
  {
    id: "command-module",
    title: "The universal command module",
    hint: "Augie sending commands to anything you own — a 3D printer included.",
    entries: [
      {
        id: "cmdmod-what",
        title: "What the module is",
        state: "building",
        what: "Your order (2026-11-23): a module for sending commands to ANY device you own — “I don't even care if it's a 3D printer — I want my AI to have control of anything I own.” Devices join by CONFIGURATION, not by rebuild: each device class gets a profile — how to reach it (its transport) and its command words (its vocabulary). Add a device by adding its profile. Every command runs under the same Permission Law: the device must be yours, registered, and granted. Offline-first: profiles and the module live in the system, not in somebody's cloud.",
        steps: ["Nothing for you to do yet — the module is in the current build round. When it lands, this entry gains the operating steps."],
        where: "Being built into the app beside the device registry.",
      },
      {
        id: "cmdmod-printer",
        title: "The first proofs — a 3D printer and a network device",
        state: "building",
        what: "The module proves itself on two profiles first: a 3D printer (G-code — the printer's own command language, so Augie can run a print you designed) and a generic network device spoken to over HTTP. If those two work, any device with a documented command language can be profiled the same way.",
        steps: ["When it lands: register the printer like any device, grant control, and a design you made can be sent to it as a print."],
        where: "The command module, when shipped.",
      },
      {
        id: "cmdmod-wepwawet",
        title: "Wepwawet — Augie driving the robot dog",
        state: "building",
        what: "Your order (2026-11-23): the ATLAS robot dog — Wepwawet, the Egyptian Wolf — is Augie's body, driven by Augie directly, never through the vendor's FENG MA app. The teardown (atlas-dog-protocol.md, in the vault's mission files) proved the dog takes NO Bluetooth connection: it listens for one-way BLE advertising broadcasts — 23-byte manufacturer frames under company 0x0006 — and obeys them. Augie's frame encoder reproduces the protocol byte-for-byte (all five worked examples from the teardown match exactly, pinned by tests), and the dog's full command map — Stop, movement, the tricks, the eight feeding items, light, song, program-record and execute — is a command-module profile (transport: Bluetooth broadcast). Your control grant for this dog is on its registry card: owner-confirmed and control granted, 2026-11-23. The honest limits, from the teardown: the channel is transmit-only — the dog never answers, so a sent command is never confirmed except by watching the dog; Augie cannot hear through it, read its battery, or speak words through it (only trigger its built-in sounds and actions); and the protocol has no authentication — anyone in range with the protocol could command the dog, which is the vendor's design, recorded plainly.",
        steps: [
          "The sender lives on the Parrot at ~/augie-tools/wepwawet/wepwawet-send.py. It refuses to transmit without the --live flag; without it, every run is a dry run that prints the exact frames it WOULD send.",
          "First live test — only on your word, with the dog awake beside the Parrot and you watching it: run the sender with stop --live, then forward --live, then stop --live. The sender opens with the match frame, bursts Forward (3 seconds, the voice-command hold), then the zero frame.",
          "While you watch, three capture questions get answered by observation: does the dog obey Augie's AppID (A947C15E) or only a sender it matched first; does it need the match frame after power-on; and how long does it stay matched. The full procedure is in atlas-dog/live-test-procedure.md beside the protocol doc.",
          "In the app, the dog's commands live in Devices → Commands under the profile 'Wepwawet — robot dog (Bluetooth broadcast)'. The browser cannot advertise, so the panel configures and keeps the command record — the Parrot does the firing.",
        ],
        where: "Profile and encoder in the app (Devices → Commands); the live sender on the Parrot at ~/augie-tools/wepwawet/; protocol in ~/workspace/augie-mission/atlas-dog/.",
        note: "BUILT, NOT YET VERIFIED on the dog: the first live broadcast happens only on the Captain's word, with him watching. Until then every frame has been exercised in dry-run and against simulated peers only.",
      },
    ],
  },
  {
    id: "nods",
    title: "NODS — Network Operator Domain Synthesizer",
    hint: "Augie's traveling hands — the node you carry into other machines.",
    entries: [
      {
        id: "nods-what",
        title: "What a NOD is",
        state: "design",
        what: "NODS — Network Operator Domain Synthesizer. Anubis creates small node programs you carry on flash drives and drop into other devices — your other computers, client units under your service. The node synthesizes the encrypted session between that unit and your core: it connects OUT to your core, presents its registered identity, and takes its permission from the device at the door. It never goes past the kernel's own constraints — with full access granted past the doors, anything in the system is workable: diagnostics, virus cleanup, repair, full remote operation. When you pull the node out, it cleans its own history and leaves — nothing stays resident. Your references for it: Norton Ghost's boot power and TeamViewer's control. Technician purposes, on machines that are yours or under your service.",
        steps: ["DESIGN ONLY today. The full design lives at ~/workspace/augie-mission/augi-nodes-design.md. The operator steps below are how it will run when built."],
        where: "Design: ~/workspace/augie-mission/augi-nodes-design.md.",
      },
      {
        id: "nods-run",
        title: "Running a node (the operator's steps, as designed)",
        state: "design",
        what: "Two forms: the RUN node (a program on a drive, launched on a running machine — Linux and Windows first) and the BOOT node (a bootable technician drive for machines that won't start clean — the later form; Secure Boot and disk encryption are opened by the owner with his own keys, or the node does not work on that unit — a node never breaks in).",
        steps: [
          "Issue a one-time pairing key from the core for this engagement, and pick the permission profile: Diagnose (read-only), Repair (diagnose + the fixes you approve), or Full control.",
          "Plug the drive into the unit and launch the node (or boot from it, for the BOOT form).",
          "The node connects to your core and the unit appears live in the registry — a known node coming up is a summons.",
          "Augie diagnoses and reports to you first. Repair acts only on fixes you approved.",
          "In Full control there are two drivers, your choice: you drive (mouse or finger), or Augie drives on your command — his terminal fluency (CMD, PowerShell, bash, every shell) is a standing requirement of the core, recorded so it never needs restating.",
          "End it: pull the drive, or kill the session at the core. The key dies with the session; the session record stays on YOUR core, in your records — not on the client unit.",
        ],
        where: "The core (pairing + records) and the drive (the node itself).",
        note: "Phones and tablets do not take USB nodes — their node form is the Ghost Protocol pairing (see The phone), under the same profiles and the same clean-exit rule.",
      },
    ],
  },
  {
    id: "phone",
    title: "The phone",
    hint: "Augie in your pocket — install, the on-phone brain, and Ghost pairing.",
    entries: [
      {
        id: "phone-install",
        title: "Putting Augie on the phone",
        state: "live",
        what: "The phone runs the same Augie — one core, one memory, one command; the phone is a surface the core reaches through, never a separate AI. Install it from the Parrot while you have a connection, and set the brain address in Settings: the Parrot's Tailscale address (works from anywhere) or its home Wi-Fi address (at home).",
        steps: [
          "On the phone, open the Parrot's Augie address: http://100.67.177.55:8081 (Tailscale) or http://10.0.0.79:8081 (home Wi-Fi).",
          "Install it when the browser offers (it becomes an app on the phone).",
          "Sign in with your operator account.",
          "In Settings, set the Brain address to the Parrot so the phone's Augie answers from the core.",
          "Proof it is whole: the phone's HUD reads CORE CONNECTED.",
        ],
        where: "The phone's browser first; the Parrot serves the install.",
      },
      {
        id: "phone-brain",
        title: "The on-phone brain — the emergency brain",
        state: "live",
        what: "A smaller brain that lives ON the phone itself (WebLLM): Llama-3.2-3B as the primary, Llama-3.2-1B as the floor. It carries ALL the capabilities — only the brain's size differs, and the system says so honestly; its answers are labeled as the small brain's. It sits in the failover line after Ollama and before the simulated stand-in. It is the leg that works with no Parrot and no internet at all.",
        steps: [
          "While you have internet, open Settings → On-phone brain on the phone.",
          "The panel shows the size BEFORE you download (3B ≈ 1.8 GB; 1B ≈ 700 MB). Download it.",
          "After that, it is on the phone for good — grid down, it still answers.",
        ],
        where: "Settings → On-phone brain, on the phone.",
        note: "Honest gate: the on-phone brain is built and deployed, but its live generation could not be GPU-proven on the Parrot (that machine's test browser has no GPU adapter). Your real phone run is its final proof — the HUD's PHONE BRAIN line tells the truth about its state on your device.",
      },
      {
        id: "phone-ghost",
        title: "Ghost Protocol One — pairing the phone deep",
        state: "live",
        what: "The phone bridge is the port Augie gets ON the device: the watch's heart rate over Bluetooth, the phone's own senses — local-first, readings go to your core over your own network, never to third parties. The phone path is this embedded app — never the browser's limits. Pairing uses a token file you create on the Parrot: run `openssl rand -hex 16 > ~/.local/share/augie/ghost-token.txt` once, then pair from the phone bridge page.",
        steps: [
          "Open the Phone Bridge page (Tools → Phone Bridge — Ghost Protocol One).",
          "Pair the phone with the token.",
          "Connect the watch from the bridge page — Augie takes its heart rate from there.",
          "The watch link itself is proven (about 20–30 feet through a wall). Through the watch you can talk to Anubis — wake him by name, give orders, hear reports.",
        ],
        where: "/phone-bridge in the app; the token lives on the Parrot at ~/.local/share/augie/ghost-token.txt.",
      },
      {
        id: "phone-parity",
        title: "Phone parity — the law",
        state: "live",
        what: "Everything the desktop does, the phone does, in the same sequence — the chat as a bottom bar is presentation, not a lesser mode. If you are in a dilemma and trapped, you turn on your phone, turn on your AI, plug the device in, and it wakes up with a brain. That is what the phone leg is FOR.",
        steps: ["If a phone screen ever offers you less than the computer for the same job, that is a defect — report it."],
        where: "Every surface.",
      },
    ],
  },
  {
    id: "offline",
    title: "Offline & the Go Drive",
    hint: "Grid down, lights out — what still works, and the drive that carries it.",
    entries: [
      {
        id: "off-what",
        title: "What “offline” means here",
        state: "live",
        what: "Augie is built to survive the grid going down: the brain (Ollama) lives on the Parrot, the voice (Piper) lives on the Parrot, the hearing (faster-whisper) lives on the Parrot, and the library (Kiwix) lives on the Parrot. Unplug the internet and the Parrot copy of Augie keeps working whole. Boot the Parrot on solar and all of it boots with it — every dependency of the daily system is a thing installed ON the machine, not a service rented from a cloud.",
        steps: [
          "Internet unplugged → Augie answers on the desktop, and on the phone over Wi-Fi (the Parrot is on your own network).",
          "Router killed → the phone reaches the Parrot over USB, and the on-phone brain answers on its own.",
          "From anywhere → Tailscale reaches the Parrot when any network exists.",
        ],
        where: "The Parrot, first and always.",
        note: "The three plug tests above are the mission's final stamp. They are written here as the standard — run them and they become the proof.",
      },
      {
        id: "off-create-usb",
        title: "Creating the Go Drive USB",
        state: "live",
        what: "The Go Drive is a removable drive (the 32 GB flash drive today; the 256 GB card in its reader rig later) loaded from the Parrot's staging folder: the offline books, the offline vault, dated memory snapshots, the Augie interface files, and START-AUGIE.html. About 11 GB, every file checksummed. You do not build it by hand — the Parrot's staging is kept ready, and one command refreshes it and pushes it to the drive.",
        steps: [
          "Leave the drive plugged into the Parrot, or plug it in now. Any drive 24 GB or larger mounted under /media/blackhatter qualifies; smaller drives (like the 16 GB Parrot installer stick) are never touched by the script.",
          "On the Parrot, run: ~/Desktop/GO-DRIVE-STAGING/update-go-drive.sh",
          "Watch the four steps: it refreshes the staging from live state (books from ~/knowledge/zims, the vault mirrored, the current interface build, today's memory snapshot), rebuilds the checksum manifest, verifies the staging, then pushes to the drive and verifies the drive itself.",
          "Read the last lines before you pull the drive: it prints how many files verified OK. If no drive was mounted, it says so and the staging still stands refreshed — plug the drive in and run it again.",
          "To change what books ride: the book list is at the top of update-go-drive.sh. The full English Wikipedia stays on the Parrot by your order — it is not on the drive.",
        ],
        where: "Staging: ~/Desktop/GO-DRIVE-STAGING on the Parrot. Sources: ~/knowledge/zims, ~/offline-vault, ~/augie-app's current build, ~/.local/share/augie.",
      },
      {
        id: "off-use-android",
        title: "Using the Go Drive on your Android phone",
        state: "live",
        what: "The drive plugs into the phone and the phone reads it directly — no internet involved in any of this. What runs from the drive's own storage, honestly: the BOOKS (through the Kiwix app), the Offline Guide PDF, the whole offline vault, and the memory snapshots. What the drive does NOT do by itself: run the full Augie — the brain lives on the Parrot (or in the phone's own installed on-phone brain). START-AUGIE.html is the bridge: it probes for your Parrot (Tailscale, then home Wi-Fi, then online) and opens Augie the moment any path exists.",
        steps: [
          "BEFORE you ever need it (while you have internet): install Augie on the phone from the Parrot, download the on-phone brain, and install the Kiwix app. The drive cannot install those for you later.",
          "Plug the drive into the phone (USB-C reader or OTG lead). Android mounts it as storage.",
          "Open the phone's file browser and go to the drive. Open START-AUGIE.html — tap OPEN AUGIE. It finds your Parrot if any path exists and opens him.",
          "No path at all? Stay on that page: open the Library through the Kiwix app (point Kiwix at the drive's Library folder) — WikiMed, Appropedia, WikiBooks, Simple English Wikipedia, and the Alpine Linux Wiki are all there, fully offline.",
          "Open Vault/AUGIE-OFFLINE-GUIDE.pdf for the offline guide, and Memory/ for your dated record snapshots.",
          "For Augie's abilities with no network at all, use the INSTALLED phone app — its on-phone brain answers from the phone itself. The drive is the knowledge and records carrier; the installed app is the living Augie.",
        ],
        where: "The drive's root: START-AUGIE.html, Library/, Vault/, Memory/, Augie/ (the interface files from the Parrot's current build).",
        note: "The honest line, same as the drive's own README: the installed phone app is the smoothest phone path; the drive copy is the portable one that works anywhere a USB port does.",
      },
      {
        id: "off-library",
        title: "The offline library — Kiwix",
        state: "live",
        what: "The Parrot serves a real library with no internet: kiwix-serve at http://127.0.0.1:8180 (this machine only). Every book below is COMPLETE on the Parrot — downloaded, verified, and in the served library. There is no WikiHow book: the official Kiwix catalog carries none, and nothing was fetched from unofficial sources — how-to coverage comes from Appropedia and WikiBooks.",
        steps: [
          "On the Parrot, open http://127.0.0.1:8180 in the browser.",
          "Pick a book and search it like a website — it is one, just local.",
          "Augie's own library features read from the same books and always name their source.",
        ],
        where: "augie-knowledge.service on the Parrot; books in ~/knowledge/zims.",
        note: "The books: WikiMed (medical, ~1.9 GB) · Appropedia (~0.6 GB) · WikiBooks (~4.7 GB) · Simple English Wikipedia (~3.1 GB) · Alpine Linux Wiki (~3 MB) · Full English Wikipedia (~127 GB — Parrot only, never on the Go Drive).",
      },
      {
        id: "off-vault",
        title: "The offline vault",
        state: "live",
        what: "The vault holds complete copies of your work: git bundles of your repos (each one a full repo in a single file, restore-tested), the built I-E-M site that runs offline, the source of your Muse spaces, and the Offline Guide. Checksums ride with it (SHA256SUMS.txt) — after any copy, run sha256sum -c SHA256SUMS.txt inside the vault and every line must say OK. Keep two copies on two devices.",
        steps: [
          "Restore any repo: git clone <name>.bundle — a working repo comes back, history and all.",
          "Refresh rhythm: new bundles after a big push day; database exports monthly (those come from your own dashboards — see the Rebuild chapter).",
          "The vault never goes into any repo or chat. Database exports and keys live only on your machines.",
        ],
        where: "~/offline-vault on the Parrot (mirrored into the Go Drive's Vault/ folder by the update command).",
      },
    ],
  },
  {
    id: "connections",
    title: "Connections & keys",
    hint: "Where the keys live — names and doors only, never the keys themselves.",
    entries: [
      {
        id: "conn-slots",
        title: "The Connections slots",
        state: "live",
        what: "Settings → “Connections — APIs & data” holds eleven slots: Groq (fast brain), Gemini (second brain), OpenRouter (third brain), the Ollama address (your own machine), ElevenLabs key + ElevenLabs voice (the spoken voice online), Weather data, Maps & place data, News feed, and two open slots for anything else. Fill a slot and the system can use it; an empty slot waits, honestly labeled. Values are stored server-side only, in a locked file (mode 0600) on the node host, and are never shown back to any screen. Real environment variables outrank the slots.",
        steps: [
          "Open Settings → Connections — APIs & data.",
          "Pick the slot, enter the value, save. The value leaves the screen and is never displayed again.",
          "The Cloud Keys panel shows the lights — which doors have keys — without ever showing a key.",
        ],
        where: "The Connections panel on the stage; values live on the server (the Parrot for the local copy).",
      },
      {
        id: "conn-online",
        title: "Keys on the online copy",
        state: "live",
        what: "The online Worker has no file store, so the slots cannot hold values there — the panel says so. Online keys are set as Worker secrets, by name: GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, OLLAMA_URL, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID. You set them yourself in the Cloudflare dashboard; nobody copies a value through chat, ever.",
        steps: ["Cloudflare dashboard → the augixvi Worker → Settings → Variables and Secrets → add each secret by its name above, with its value, yourself."],
        where: "Cloudflare, Worker “augixvi” — never the dormant “blackvaultllc-augixvi”.",
      },
    ],
  },
  {
    id: "social",
    title: "Social & posts — the office",
    hint: "How your advertising gets written, approved, posted, and proven.",
    entries: [
      {
        id: "social-flow",
        title: "The posting flow",
        state: "live",
        what: "Your office runs your social media like your email: the office writes the post, you approve the EXACT words, then it goes out on the schedule you set, and every send is verified and reported back. Nothing posts on a guess. A draft, a scheduled post, and a live post are three different states and are reported as such. Augie-the-app posting by itself is not a thing the platforms offer anyone — the office working through your accounts is the real version, and it gets the same result: your advertising running on time while you run the business.",
        steps: [
          "Say what goes out and where (the group, the page, the account).",
          "The office brings you the exact text (and picture, if any) and the time.",
          "Approve it — or change it and approve the change.",
          "It posts on schedule; you get the confirmation and the link.",
        ],
        where: "This office (your main chat) — the same desk that runs your buyer messages and Maddox mail.",
      },
      {
        id: "social-nextdoor",
        title: "Nextdoor — your security group",
        state: "building",
        what: "You have a Nextdoor account and a security group there with neighbors joining. Nextdoor gives nobody an official posting connection — not this office, not the scheduling apps. The working route is your own signed-in account through the browser. A read-only first pass (your group's name, member count, recent posts) is waiting on your sign-in through the secure card — nothing is entered in chat, and nothing posts until you approve the first post's exact words.",
        steps: [
          "Enter your Nextdoor sign-in on the secure card when it is in front of you.",
          "The office reports the group's facts back to you.",
          "Approve the first post's words; the schedule starts from there.",
        ],
        where: "nextdoor.com, through your account.",
      },
      {
        id: "social-other",
        title: "Facebook, Instagram, Threads",
        state: "live",
        what: "Your other accounts have real connections: Facebook (posts, your groups, your Pages — with scheduling), Instagram (posts, reels, stories — with scheduling), and Threads (posts and replies). The same law holds everywhere: your approved words, on your schedule, verified after.",
        steps: ["Same flow as above — name the account, approve the words, get the link back."],
        where: "Your connected accounts.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    hint: "When something is wrong — the checks, in the order to run them.",
    entries: [
      {
        id: "ts-silent",
        title: "Augie is silent",
        state: "live",
        what: "On the Parrot, sound comes out through the Bluetooth audio device (an A2DP sink, set to 100%, unmuted, when proven). If a test is silent, the machine's output device is the first suspect — not the app. The Parrot has no speech-dispatcher, so the browser-voice path can never sound there; Piper is the voice, and Piper has been proven by file.",
        steps: [
          "Check the Bluetooth output device is connected and unmuted.",
          "Check Settings: silent mode off, voice volume up.",
          "Ask a question — STATUS should read SPEAKING while he answers.",
          "Still silent on the Parrot but the phone speaks? That fits the machine facts above — the Parrot speaks through Piper or not at all.",
        ],
        where: "The Parrot's sound settings + Augie's Settings.",
      },
      {
        id: "ts-status",
        title: "Reading STATUS like a truth table",
        state: "live",
        what: "STATUS never flatters. SPEAKING = a god is talking. LISTENING = the ear is truly capturing. MIC OFF = the ear is not capturing, whatever else is open. IDLE = awake and at rest. If STATUS and the voice indicator ever disagree, that is a defect — report it with a screenshot.",
        steps: ["Screenshot first, then report — the screen is the evidence."],
        where: "Top-right of the stage.",
      },
      {
        id: "ts-online-gap",
        title: "The online copy looks older than the Parrot",
        state: "gap",
        what: "It is, whenever a build has landed since the last online deploy. There is NO automatic publish from GitHub: the online site (Worker “augixvi”, augixvi.space) updates only when the deploy command is run by hand from a shell that carries the Cloudflare token: npx wrangler deploy --config .output/server/wrangler.json --name augixvi (run in the app folder). Until that runs, online ≠ Parrot, and anybody reporting on the system must say which copy they are looking at.",
        steps: ["Judge new work on the Parrot copy first. The online copy catches up at the next manual deploy."],
        where: "The Parrot is the source of truth; augixvi.space is the mirror.",
      },
      {
        id: "ts-webgpu",
        title: "“NO WEBGPU ON THIS DEVICE” on the Parrot",
        state: "live",
        what: "Expected on the Parrot's test browser — it reports no GPU adapter, so the on-phone brain cannot be proven there. It is not a defect in the brain. The proof device is your real phone (see The phone → the on-phone brain).",
        steps: ["Run the on-phone brain on the phone itself; its HUD line reports its true state there."],
        where: "The HUD's PHONE BRAIN line.",
      },
      {
        id: "ts-nobrain",
        title: "“No brain can answer yet” on the stage",
        state: "live",
        what: "The stage says this in plain words when no brain path is ready on that surface: the core is not connected, the on-phone brain is not downloaded, and no cloud key is entered. It replaces the old bare “No response yet.” — silence was the defect; the line names the three doors because one of them is the fix. The HUD's CORE and PHONE BRAIN lines carry the same truth in short form.",
        steps: [
          "Door one: connect the core — Settings → Brain address points this surface at your Parrot core (tailnet or LAN address).",
          "Door two: download the on-phone brain — Settings → On-phone brain; the size is shown before anything downloads, and the brain then lives on the device, grid-down included.",
          "Door three: enter a cloud key — Connections holds the API slots; the cloud fallbacks answer through the server pipe when their keys are in.",
          "Ask a question after opening any door: a real answer, or a failure stated in words — never silence.",
        ],
        where: "The chat thread's standing line + Settings / Connections.",
      },
      {
        id: "ts-pulse",
        title: "Pulse reads SEARCHING",
        state: "live",
        what: "Pulse (Senses & analysis) reads heart rate from the phone or computer camera — an ESTIMATE, never a medical reading. The camera fills the panel now and the analytics read bold underneath. The estimate is tightened the way watch firmware works, at camera scale: three skin patches (forehead and both cheeks) are combined, the signal is filtered to the heart band, frames where motion swamps the signal are thrown out, and a number is shown only once recent estimates agree with each other — with the live signal-quality percentage beside it. SEARCHING with a climbing quality % means it is hearing the signal but will not print a number until the readings agree. It cannot do what a watch's skin-contact sensor does: room light, stillness, and a plain view of the face decide what the camera can honestly read, and when the signal is not there it stays SEARCHING instead of inventing a number. Nothing is recorded or stored, and no face is identified — presence and pulse only.",
        steps: [
          "Face the camera in good, even light and hold still for about ten seconds.",
          "Watch the signal-quality %: low and flat means light or motion is the problem — move nearer the light, rest the phone, try again.",
          "A watch reading, when its pipe lands, outranks the camera estimate — the camera is the backup sense, labeled estimate on purpose.",
        ],
        where: "Tools → Senses & analysis → Pulse.",
      },
      {
        id: "ts-analyzer",
        title: "Picture analysis feels slow",
        state: "live",
        what: "Picture analysis runs on the local vision model (llava:7b) on the Parrot's CPU — it streams its answer as it works (the streaming fix shipped), but a CPU read of a big picture takes the time it takes. It must show values and a list when it finishes; an empty result is a defect.",
        steps: [
          "Give it one picture and let it finish.",
          "If it takes over a minute with no values and no list, screenshot it and report — that exact failure is on the record and it is not acceptable.",
        ],
        where: "Picture Analysis window.",
      },
    ],
  },
  {
    id: "rebuild",
    title: "REBUILD — if the world goes dark",
    hint: "What the system is made of — the inventory to build it again from nothing.",
    entries: [
      {
        id: "rb-shape",
        title: "The shape of the system",
        state: "live",
        what: "ONE AI — one core, one memory, one command. The core lives on the Parrot (the app + Ollama + the services below). Every surface — the Parrot's own screen, the phone, the watch, the online copy — is the same Augie reaching through it, never a separate AI per surface. The repo is blackvaultllc/AUGIXVI (public). The online mirror is the Cloudflare Worker named “augixvi” at augixvi.space. The account database is Supabase project guzycdnaulevaaucycnv — the app is local-first: the library and history live on the machine, and account features (operator registry, settings sync) degrade honestly when the cloud is gone.",
        steps: [
          "Rebuild order: machine → services → app → models → books → vault. Each layer below names its pieces.",
          "The Captain's data (registry, memory, logs) lives at ~/.local/share/augie on the Parrot — back it up with the vault.",
        ],
        where: "Repo: github.com/blackvaultllc/AUGIXVI. Machine: the Parrot, below.",
      },
      {
        id: "rb-machine",
        title: "The machine — the Parrot",
        state: "live",
        what: "Parrot Security 6.3 (lorikeet), user blackhatter. 12 CPUs, 29 GiB RAM, 466 GB NVMe (root), plus /mnt/augi — a 916 GB drive holding the Ollama models. AMD Cezanne iGPU. Addresses: Tailscale 100.67.177.55, home LAN 10.0.0.79. Node 22 lives at ~/.local/node22 (the system Node is 18 — builds need 22 first on PATH). Bun 1.4.4 runs the app tooling. No passwordless sudo: sudo steps are the Captain's own hands.",
        steps: [
          "SSH in through Tailscale (the tailnet is the door).",
          "App home: ~/augie-app. Version stamp: ~/augie-app/.augie-version.",
          "Data home: ~/.local/share/augie. Knowledge home: ~/knowledge. Tools home: ~/augie-tools.",
        ],
        where: "The Parrot, Mobile, Alabama.",
      },
      {
        id: "rb-services",
        title: "The services — what runs, on what port",
        state: "live",
        what: "All systemd USER services, enabled, starting at boot. augie.service — the app itself, port 8081, on all interfaces (HOST=0.0.0.0), built with NITRO_PRESET=node-server. Ollama — the brain server, port 11434, models at /mnt/augi/ollama/models, answering the whole network (OLLAMA_HOST=0.0.0.0:11434). augie-knowledge.service — kiwix-serve, the library, 127.0.0.1:8180 only. augie-stt.service — faster-whisper hearing, 127.0.0.1:8765. augie-wifi-watcher — the device watcher's sweeps. augie-downloads.service exists for book downloads and rests inactive when every book is complete — that is its healthy state today.",
        steps: [
          "Check one: systemctl --user status augie.service (swap in any name above).",
          "The app answers at http://127.0.0.1:8081/avatar on the machine itself.",
          "Ollama answers at http://127.0.0.1:11434 — ollama list shows the models.",
        ],
        where: "systemd --user on the Parrot.",
      },
      {
        id: "rb-models",
        title: "The brains — models by name",
        state: "live",
        what: "Ollama holds the brains (~105 GB on /mnt/augi): qwen2.5:32b (and SENTINEL, built from it), deepseek-r1:32b, qwen2.5-coder:32b, qwen2.5-coder:14b, phi4, gemma2:9b, llama3.1:8b, deepseek-r1:8b, llava:7b (THE vision model — every picture surface reads through it), qwen2.5-coder:7b, mistral:7b, llama3.2:3b, llama3.2:1b, phi3:mini, mxbai-embed-large, nomic-embed-text. The voice is Piper's en_US-joe-medium (at ~/augie-tools/piper-voices). Hearing is faster-whisper. The phone's own brain is WebLLM's Llama-3.2-3B-Instruct (primary) and Llama-3.2-1B (floor), downloaded into the phone once, while online. Face/hand tracking (AR) uses MediaPipe's vision files, vendored inside the repo itself (public/mediapipe) — they travel with the code.",
        steps: ["List them any time: ollama list. The vision model is llava:7b — one model, every surface."],
        where: "/mnt/augi/ollama/models; Piper at ~/augie-tools.",
      },
      {
        id: "rb-books-tools",
        title: "The books and the hand tools",
        state: "live",
        what: "Books (all COMPLETE on the Parrot, in ~/knowledge/zims): wikipedia_en_all_maxi_2026-08 (full English Wikipedia, ~127 GB), wikipedia_en_medicine_maxi_2026-10 (WikiMed), wikibooks_en_all_maxi_2026-10, wikipedia_en-simple_all_maxi_2026-09, appropedia_en_all_maxi_2026-02, alpinelinux_en_all_maxi_2026-10. Hand tools in ~/augie-tools, all offline, installers kept in ~/augie-tools/dl so they can be re-extracted with no network: pandoc 3.5 (documents), tesseract 5.3.0 (reading paper), Piper (the voice), qpdf 11.3.0 (PDF work), radare2 6.2.6 (binary triage).",
        steps: ["A book joins the served library with ~/knowledge/refresh-library.sh after it lands in ~/knowledge/zims."],
        where: "~/knowledge and ~/augie-tools on the Parrot.",
      },
      {
        id: "rb-deploy",
        title: "The deploy flow",
        state: "live",
        what: "Build on the Parrot: Node 22 first on PATH, NITRO_PRESET=node-server, build the app in ~/augie-app, restart augie.service, read the stamp at ~/augie-app/.augie-version. The Parrot is always the first home of every build. Online is a separate, manual step: from a shell carrying the Cloudflare token, npx wrangler deploy --config .output/server/wrangler.json --name augixvi. NEVER deploy the dormant name “blackvaultllc-augixvi” from the repo's wrangler.jsonc. There is no automatic publish — pushing to GitHub does not change the live site.",
        steps: [
          "Push the code (git, branch main — never force-push; Lovable reads this history).",
          "Build + restart on the Parrot; verify /avatar answers 200 on loopback, LAN, and tailnet.",
          "Deploy online by hand (above) when the token is at hand; otherwise say plainly that online is behind.",
        ],
        where: "~/augie-app on the Parrot; Cloudflare Worker “augixvi”.",
      },
      {
        id: "rb-dependencies",
        title: "THE DEPENDENCY INVENTORY — the grid-down law",
        state: "live",
        what: "Your law (2026-11-23): “Even if the world goes dark — boot up my computer on solar — I need those dependencies built into the system, period.” So here is every dependency that matters, whether a local copy EXISTS (checked against the machine, the repo, and the vault on 2026-11-23), and the gaps named in plain words. A dependency with no local copy is a thing the rebuild would have to fetch — in a dark world, it is a thing you would not have.",
        table: {
          head: ["Dependency", "Needed for", "Local copy?", "The truth"],
          rows: [
            ["The app itself (AUGIXVI repo)", "Everything", "YES", "Full git history on GitHub, in the workspace, on the Parrot (~/augie-app), and as a bundle in the offline vault."],
            ["Node 22 + Bun", "Building and running the app", "YES — on the Parrot", "Node 22 at ~/.local/node22 and Bun are installed on the Parrot. GAP: no offline installer for either is kept in the vault — a brand-new blank machine would need the internet to get them. The Parrot itself needs nothing."],
            ["The app's npm packages", "Building the app from source", "PARTIAL", "The installed tree (node_modules) and the built output (.output) exist on the Parrot, and the Go Drive carries the built interface files. GAP: a fresh clone has no packages and installing needs the internet — no offline package cache is kept in the vault today. The built output is the dark-world copy: it runs without a rebuild."],
            ["Ollama + the 17 models (~105 GB)", "The brain", "YES", "Models live on /mnt/augi on the Parrot. The Ollama program is a system install on the Parrot. GAP (small): its installer is not in the vault — the models without the program would need it fetched."],
            ["Piper + the voice (en_US-joe-medium)", "Augie speaking, offline", "YES", "Installed at ~/augie-tools with its installers kept in ~/augie-tools/dl — re-extractable with no network."],
            ["faster-whisper (augie-stt)", "Augie hearing, offline", "YES — on the Parrot", "The service runs on the Parrot (127.0.0.1:8765). Its files live with the Parrot's install; they are not separately copied into the vault."],
            ["Kiwix books (6 ZIMs, ~140 GB)", "The offline library", "YES", "All six complete in ~/knowledge/zims on the Parrot; five ride the Go Drive. kiwix-serve is a system package on the Parrot — the books are the irreplaceable part, and they are held twice."],
            ["MediaPipe vision files (face/hand)", "AR and camera tracking", "YES", "Vendored inside the repo (public/mediapipe) — they travel with the code, no download ever."],
            ["The on-phone brain models (Llama-3.2-3B / 1B)", "The phone answering alone", "ON THE PHONE ONLY", "Downloaded once into the phone's own storage while online. GAP: no copy is kept on the Parrot or the Go Drive — a new phone must download them while it has internet. Install the brain on any new phone BEFORE you need it."],
            ["YAMNet sound model + runtime", "Sound Watch naming sounds", "IN FLIGHT", "Approved 2026-11-23; the model file is a small official download (4.1 MB) and the wiring is in progress. When it lands, the model ships inside the app — offline by design."],
            ["Supabase (operator accounts, settings sync)", "Sign-in, settings following you", "CLOUD — by design", "The app is local-first: stage, library, and history live on the machine. In a dark world the Parrot copy runs on its local operator registry; account sync waits for the sky. Your data exports from the dashboard belong next to the vault (see the vault's OFFLINE-PLAN)."],
            ["Cloud brains (Groq / Gemini / OpenRouter / ElevenLabs)", "Extra brains and the online voice", "ONLINE ONLY — by nature", "These are reach-for tools, never the foundation. The foundation — Ollama, Piper, whisper, the on-phone brain — is all local, above."],
            ["Tailscale", "Reaching the Parrot from anywhere", "ACCOUNT SERVICE", "Convenient, not load-bearing: home Wi-Fi (10.0.0.79) and USB reach the Parrot with no Tailscale at all."],
          ],
        },
        note: "The three named gaps to close when you say the word: (1) keep Node/Bun + Ollama installers in the vault; (2) keep an offline npm package cache beside the built output; (3) keep a copy of the phone-brain models on the Parrot. Until then, the Parrot as it stands IS the offline system — whole, on one machine.",
      },
      {
        id: "rb-keys",
        title: "Keys in a rebuild — where they go, never what they are",
        state: "live",
        what: "No key value appears in this manual, in the repo, or in the vault — ever. In a rebuild: the local copy's keys go into the Connections slots (Settings → Connections) or the server-side store on the node host (mode 0600); the online copy's keys go in as Cloudflare Worker secrets under the six names in the Connections chapter. The Supabase publishable key is public by design and lives with the app config on the Parrot (~/augie-app/.env.server). Everything else, you type yourself, on the machine, at the time.",
        steps: ["Rebuild the machine, restore the code, then enter keys by hand from your own records — they were never written anywhere a stranger could read them."],
        where: "Connections panel (local) · Cloudflare secrets (online) · ~/augie-app/.env.server (the Parrot's own server config).",
      },
    ],
  },
];
