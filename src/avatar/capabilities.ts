/**
 * WHAT AUGIE CAN ACTUALLY DO — the capability truth the reply brain
 * answers from (owner defect 2026-11-23 ~15:43 EST: "I asked him if
 * he can access the AI dog or if he can access the camera or
 * anything — he didn't answer").
 *
 * A capability question ("can you access the camera?", "can you
 * drive the dog?") is a factual question about THIS system, and the
 * brain can only answer it from facts it is given. This brief is
 * those facts, injected into the reply context of every brain leg
 * (local Ollama, the on-phone brain) ahead of the speaker directive.
 *
 * KEPT CURRENT BY CONSTRUCTION: every line names the Master Manual
 * entry it mirrors (manualContent.ts). A test pins that each named
 * entry still exists — when a build changes what Augie can do, it
 * updates the manual entry (the standing rule) and this brief in
 * the same pass, or the test fails and says why. States are the
 * manual's truth marks: LIVE things are stated as working; a thing
 * BUILT but not yet proven live is stated exactly that way — never
 * as a yes, never as a dodge.
 *
 * Plain TS, no DOM — unit-testable per the repo rules.
 */

export interface CapabilityLine {
  /** The Master Manual entry this line mirrors (manualContent.ts). */
  manualId: string;
  /** The fact, in the plain words the brain may answer from. */
  line: string;
}

export const CAPABILITY_LINES: readonly CapabilityLine[] = [
  {
    manualId: "cameras-first",
    line:
      "THE CAMERA (the desk camera, Agagmoss v1): registered and live. You can look " +
      "through it on both of its stream paths, move it with its pan and tilt, hear " +
      "through it, and analyze a view when asked — an analysis is a draft that can " +
      "invent details, and you say so when you give one. You CANNOT speak through " +
      "the camera: it offers you no talk path.",
  },
  {
    manualId: "cmdmod-wepwawet",
    line:
      "WEPWAWET (the robot dog): his control protocol is fully mapped and your " +
      "broadcast control of him is BUILT, byte-verified, and PROVEN LIVE — on " +
      "2026-11-24, on the Captain's order with him watching the dog in his " +
      "hand, Augie's frames fired Stop, Forward, Stop from the Parrot sender " +
      "and the dog moved. The Captain can also drive him himself from the " +
      "dog's card in Devices: each tap hands the frame to the Parrot sender " +
      "(the bridge), Practice mode transmits nothing, and the LIVE switch is " +
      "the Captain's own hand. The dog reports nothing back to you, and you " +
      "cannot speak words through him; you trigger his built-in sounds and " +
      "actions only.",
  },
  {
    manualId: "sw-how",
    line:
      "SOUND WATCH: on this machine you listen through the microphone and name the " +
      "sounds you hear — the Captain's taught sound library first, then the " +
      "offline classifier. A sound you do not know is UNCLASSIFIED, never guessed. " +
      "Human sounds — speech, footsteps, a shout — raise an alert.",
  },
  {
    manualId: "train-device",
    line:
      "DEVICES AND THE PERMISSION LAW: you map the Captain's own devices whose " +
      "signals appear around you, and you CONTROL only the devices he has granted " +
      "one by one — the camera and Wepwawet are granted. The Magic Wand's beacon " +
      "is watched for; its greeting on this machine waits on its registry card " +
      "being finished here.",
  },
  {
    manualId: "world-bigger",
    line:
      "THE BUILT WORLD: you keep the Captain's built world — rooms, claimed " +
      "plots, placed pieces, and world skies — and the map of real places. " +
      "Vehicles are not built yet; you walk the world yourself.",
  },
  {
    manualId: "voice-speak",
    line:
      "VOICE: on this machine you speak aloud through your voice and hear through " +
      "the local ear when the microphone is on. The microphone's true state is " +
      "what STATUS on the stage says it is — never claim to hear when it is off.",
  },
];

/** The compressed brief for the small on-phone brain's small context. */
export const CAPABILITY_LINES_SHORT: readonly CapabilityLine[] = [
  {
    manualId: "cameras-first",
    line:
      "The desk camera is live: you can look through it, move it, hear through " +
      "it, and analyze a view (a draft). You cannot speak through it.",
  },
  {
    manualId: "cmdmod-wepwawet",
    line:
      "Wepwawet the robot dog: your control of him is built, byte-verified " +
      "and PROVEN LIVE (2026-11-24 — the Captain watched him move on your " +
      "frames). He can also be driven from his card in Devices, through the " +
      "Parrot bridge.",
  },
  {
    manualId: "train-device",
    line:
      "You control only the devices the Captain has granted, one by one — the " +
      "camera and the dog are granted. What you do not know, you say you do not know.",
  },
];

const BRIEF_HEADER =
  "WHAT YOU CAN ACCESS AND DO — answer questions about your own access and " +
  "abilities from these facts only, never beyond them:";

/** The brief as one system-prompt block. */
export function capabilitiesBrief(variant: "full" | "short" = "full"): string {
  const lines = variant === "short" ? CAPABILITY_LINES_SHORT : CAPABILITY_LINES;
  return [BRIEF_HEADER, ...lines.map((entry) => entry.line)].join("\n");
}
