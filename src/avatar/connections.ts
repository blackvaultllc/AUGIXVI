/**
 * CONNECTIONS — THE UNIVERSAL API / DATA SLOTS (owner order
 * 2026-11-22, from his live screen).
 *
 * His words, and the reason this exists: "anything that we need to
 * have for open slots for APIs, for anything else — just make sure
 * we have that universal area that will work for APIs that might
 * come from other websites, just so I can always put in the data
 * that's needed for the system to articulate the value of working
 * and to understand what it might be for." Capacity built NOW, not
 * retrofitted later — his survival-guide logic: if the grid goes
 * down but he can still upload knowledge and components, the
 * system keeps learning. The slots are the doors built in advance.
 *
 * THE RULES OF THE AREA:
 * - Every slot carries a plain label and a plain statement of what
 *   it is FOR. Nothing sits here unexplained.
 * - Values are entered by the Captain only, and they live
 *   SERVER-SIDE (connections.server.ts) — never displayed back,
 *   never in client code, never in this registry. This file holds
 *   names and purposes, never a value.
 * - An empty slot reads as OPEN — "nothing connected here yet" —
 *   honestly. A filled slot reads CONNECTED, and where a consumer
 *   exists (the brain pipe reads GROQ_API_KEY and its kin today)
 *   the filled slot is live in that plumbing the moment it is set.
 *   Where no consumer exists yet, the slot says what it waits for.
 *
 * Plain data, unit-testable per the repo rules.
 */

export type ConnectionSlotKind = "api-key" | "url" | "text";

export type ConnectionSlot = {
  id: string;
  category: string;
  /** The slot's name, in plain words. */
  label: string;
  /** What this slot is for, in plain words. */
  purpose: string;
  /** The server-side name the value is stored under. Never a value. */
  envName: string;
  kind: ConnectionSlotKind;
  /**
   * The system that reads this slot today — or null when nothing
   * does yet, in which case `waitsFor` names what it waits for.
   */
  consumer: string | null;
  waitsFor?: string;
};

export const CONNECTION_CATEGORIES = [
  "Brains & voices",
  "Data from the web",
  "Open slots — yours to name the job",
] as const;

export const CONNECTION_SLOTS: readonly ConnectionSlot[] = [
  /* ------------------------- brains & voices ------------------------- */
  {
    id: "groq",
    category: "Brains & voices",
    label: "Groq — fast brain",
    purpose: "The first brain in the failover pipe. Answers chat when it is connected.",
    envName: "GROQ_API_KEY",
    kind: "api-key",
    consumer: "The brain pipe (cloud/brainPipe.server.ts)",
  },
  {
    id: "gemini",
    category: "Brains & voices",
    label: "Gemini — second brain",
    purpose: "The second brain in the failover pipe, when Groq cannot answer.",
    envName: "GEMINI_API_KEY",
    kind: "api-key",
    consumer: "The brain pipe (cloud/brainPipe.server.ts)",
  },
  {
    id: "openrouter",
    category: "Brains & voices",
    label: "OpenRouter — third brain",
    purpose: "The third brain in the failover pipe — many models behind one key.",
    envName: "OPENROUTER_API_KEY",
    kind: "api-key",
    consumer: "The brain pipe (cloud/brainPipe.server.ts)",
  },
  {
    id: "ollama-url",
    category: "Brains & voices",
    label: "Ollama — your own machine's address",
    purpose:
      "Where the brain on your own computer answers. Not a key — the address of your Ollama, so the pipe can always fall back to the machine in the room.",
    envName: "OLLAMA_URL",
    kind: "url",
    consumer: "The brain pipe (cloud/brainPipe.server.ts)",
  },
  {
    id: "elevenlabs",
    category: "Brains & voices",
    label: "ElevenLabs — the spoken voice",
    purpose: "The cloud voice that speaks answers aloud when it is connected.",
    envName: "ELEVENLABS_API_KEY",
    kind: "api-key",
    consumer: "The server voice (speakServer)",
  },
  {
    id: "elevenlabs-voice",
    category: "Brains & voices",
    label: "ElevenLabs — which voice",
    purpose: "The voice ID the spoken voice uses. Works together with the ElevenLabs key above.",
    envName: "ELEVENLABS_VOICE_ID",
    kind: "text",
    consumer: "The server voice (speakServer)",
  },
  /* ------------------------- data from the web ------------------------ */
  {
    id: "weather",
    category: "Data from the web",
    label: "Weather data",
    purpose: "Live weather for the stage and the map — conditions where you stand.",
    envName: "AUGI_WEATHER_API_KEY",
    kind: "api-key",
    consumer: null,
    waitsFor: "a weather reader — the slot stores the key safely until one is built",
  },
  {
    id: "maps",
    category: "Data from the web",
    label: "Maps & place data",
    purpose: "Live place data for the World Map — addresses, coordinates, what's there.",
    envName: "AUGI_MAPS_API_KEY",
    kind: "api-key",
    consumer: null,
    waitsFor: "the World Map's live-data reader — today the map works from its built-in gazetteer",
  },
  {
    id: "news",
    category: "Data from the web",
    label: "News feed",
    purpose: "A news source the system can read from, in the open, under your key.",
    envName: "AUGI_NEWS_API_KEY",
    kind: "api-key",
    consumer: null,
    waitsFor: "a news reader — the slot stores the key safely until one is built",
  },
  /* --------------------------- open slots ----------------------------- */
  {
    id: "custom-1",
    category: "Open slots — yours to name the job",
    label: "Open slot 1",
    purpose: "A spare door for the next website or service you want feeding this system.",
    envName: "AUGI_CUSTOM_1_API_KEY",
    kind: "api-key",
    consumer: null,
    waitsFor: "whatever you build on it next — the capacity is here now, on purpose",
  },
  {
    id: "custom-2",
    category: "Open slots — yours to name the job",
    label: "Open slot 2",
    purpose: "A second spare door, for the service after that one.",
    envName: "AUGI_CUSTOM_2_API_KEY",
    kind: "api-key",
    consumer: null,
    waitsFor: "whatever you build on it next — the capacity is here now, on purpose",
  },
];

export function connectionSlot(id: string): ConnectionSlot | null {
  return CONNECTION_SLOTS.find((slot) => slot.id === id) ?? null;
}

/** The one line a slot shows about its state — honest in both directions. */
export function slotStateLine(slot: ConnectionSlot, connected: boolean): string {
  if (connected) {
    return slot.consumer
      ? `Connected — ${slot.consumer} reads it now.`
      : "Connected — stored safely on the server.";
  }
  return slot.consumer
    ? `Open — nothing connected here yet. ${slot.consumer} reads this slot when you fill it.`
    : `Open — nothing connected here yet. It waits for ${slot.waitsFor ?? "its reader"}.`;
}
