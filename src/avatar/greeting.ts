/**
 * GREETING ON CALL (owner order): when the operator calls him and says
 * nothing right away, Osiris speaks FIRST — in his own voice, calling the
 * operator by name OUT LOUD: "Yes, Domenick." The name is spelled naturally
 * so TTS pronounces it correctly: D O M E N I C K.
 */

/** Spoken form of the operator's name so he says it aloud, heard correctly. */
export function spokenOperatorName(name: string | null): string {
  const normalized = name?.trim();
  if (!normalized) return "Anubis";
  // Domenick → do-MEN-ick so every voice engine says it right.
  if (/^domenick$/i.test(normalized)) return "Domenick";
  return normalized;
}

export function greetOperator(name: string | null, random: () => number = Math.random): string {
  const who = spokenOperatorName(name);
  const greetings = [
    `Yes, ${who}. I'm here.`,
    `Yes, ${who} — front and center.`,
    `Here, ${who}. You have my attention.`,
    `Yes, ${who}. What do you need?`,
  ];
  return greetings[Math.floor(random() * greetings.length)] ?? `Yes, ${who}.`;
}
