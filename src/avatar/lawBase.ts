/**
 * LAW BASE + STOP MODE — the pure core of the personal-safety
 * pass (owner order 2026-11-26: "make sure the database is
 * really good with law… if the officer is telling the truth or
 * not… I want to make sure whatever I say back [is] the legal
 * premise of what they're saying… and Anubis listening will
 * automatically record the conversation so Anubis has the
 * evidence for me").
 *
 * What lives here:
 *
 *   · THE BASE — legal-information entries for Alabama + federal
 *     law. EVERY entry carries its source (a statute citation or
 *     a case name + citation) and its jurisdiction. An entry
 *     without a verifiable source DOES NOT SHIP: the sanitizer
 *     drops it, and topics the base cannot stand behind are
 *     listed as GAPS, in the open, instead of being filled with
 *     invention.
 *   · CLAIM CHECK — the construct tool. An officer's claim
 *     (typed or heard) is matched against the base and comes
 *     back one of three ways: the claim MATCHES what the base
 *     says, the claim CONTRADICTS it, or the claim is NOT IN
 *     THE BASE. There is no fourth answer and no improvisation.
 *   · GUIDANCE — the words Anubis may put in the Captain's ear
 *     during a stop. Guidance is TEMPLATE-BOUND: every line is
 *     built from a base entry's own statement and exact-word
 *     scripts, and carries that entry's id. No entry, no line.
 *   · STOP DETECTION — the explicit keyword set that marks an
 *     official interaction in heard speech, and the Captain's
 *     own declaration / release phrases.
 *
 * The header below stands over the whole base, in the UI and
 * in every answer: this is legal information from cited
 * sources — not a lawyer, not legal advice.
 *
 * Plain TS, no I/O — the server modules do the lifting.
 */

export const LAW_BASE_HEADER =
  "Legal information from cited sources — not a lawyer, not legal advice.";

/* ------------------------------------------------------------------ */
/* The base                                                            */
/* ------------------------------------------------------------------ */

export type LawJurisdiction = "Alabama" | "Federal";

export interface LawSource {
  /** "Alabama Code" / "U.S. Supreme Court" / "U.S. Court of Appeals, Eleventh Circuit". */
  name: string;
  /** "Ala. Code § 32-6-9" / "Terry v. Ohio, 392 U.S. 1 (1968)". */
  citation: string;
}

export interface OfficerClaimPattern {
  /** A phrase an officer might say, matched as plain words. */
  phrase: string;
  /** Whether that claim, as stated, matches or contradicts the base. */
  verdict: "matches" | "contradicts";
  /** One plain sentence: why, standing on this entry's source. */
  why: string;
}

export interface LawEntry {
  id: string;
  topic: string;
  title: string;
  jurisdiction: LawJurisdiction;
  source: LawSource;
  /** What the law says, in plain words, standing on the source. */
  statement: string;
  /** Exact words the Captain can say — quoted from the entry, never improvised. */
  scripts: string[];
  /** Claims an officer might make about this topic, with the base's verdict on each. */
  claims: OfficerClaimPattern[];
  /** Plain words an officer or the Captain might use that point at this topic. */
  keywords: string[];
}

export const LAW_BASE_SEED: LawEntry[] = [
  {
    id: "license-display",
    topic: "traffic-stop-documents",
    title: "A driver must show his license when an officer demands it",
    jurisdiction: "Alabama",
    source: { name: "Alabama Code", citation: "Ala. Code § 32-6-9(a)" },
    statement:
      "Every licensed driver in Alabama must carry his license while driving and display it on the demand of a judge, a peace officer, or a state trooper. The duty is the DRIVER's — the statute speaks to the person driving. A driver charged under this section is not convicted if he later produces, in court or at the arresting officer's office, a license that was valid at the time.",
    scripts: [],
    claims: [
      {
        phrase: "show me your license",
        verdict: "matches",
        why: "A demand that the DRIVER display his license is exactly what Ala. Code § 32-6-9(a) authorizes.",
      },
      {
        phrase: "you have to show me your license",
        verdict: "matches",
        why: "For the driver, that is the law: Ala. Code § 32-6-9(a) requires display on an officer's demand.",
      },
    ],
    keywords: ["license", "driver's license", "drivers license"],
  },
  {
    id: "stop-and-identify",
    topic: "identification",
    title: "On reasonable suspicion, an officer may demand name, address, and an explanation",
    jurisdiction: "Alabama",
    source: { name: "Alabama Code", citation: "Ala. Code § 15-5-30" },
    statement:
      "An Alabama officer who reasonably suspects a person abroad in a public place is committing, has committed, or is about to commit a felony or other public offense may stop that person and demand his name, his address, and an explanation of his actions. The statute lists those three things — name, address, explanation.",
    scripts: ["Am I being detained, or am I free to leave?"],
    claims: [
      {
        phrase: "you have to give me your name",
        verdict: "matches",
        why: "When the stop stands on reasonable suspicion, Ala. Code § 15-5-30 lets the officer demand name, address, and an explanation of actions.",
      },
      {
        phrase: "you have to tell me your name and address",
        verdict: "matches",
        why: "Name and address are two of the three things Ala. Code § 15-5-30 names.",
      },
    ],
    keywords: ["your name", "your address", "identify yourself", "identification"],
  },
  {
    id: "physical-id-on-foot",
    topic: "identification",
    title: "On foot, the stop-and-identify statute does not make a man hand over an ID card",
    jurisdiction: "Alabama",
    source: {
      name: "U.S. Court of Appeals, Eleventh Circuit",
      citation: "Edger v. City of Dothan, 84 F.4th 1233 (11th Cir. 2023)",
    },
    statement:
      "Alabama's stop-and-identify statute (§ 15-5-30) demands a name, an address, and an explanation — it does not demand a physical ID card. The Eleventh Circuit held in Edger that an Alabama officer violates clearly established law by arresting a person SOLELY for failing to provide a driver's license or physical identification under § 15-5-30. This entry is about a person ON FOOT; a driver at a traffic stop stands under § 32-6-9 instead.",
    scripts: ["My name is — and my address is —. I do not have to hand you an ID card for this."],
    claims: [
      {
        phrase: "i can arrest you for not showing me your id",
        verdict: "contradicts",
        why: "Under Edger, arresting a person solely for not producing physical identification under § 15-5-30 violates clearly established law — the statute demands name, address, and explanation, not a card.",
      },
      {
        phrase: "hand me your id card or you're under arrest",
        verdict: "contradicts",
        why: "§ 15-5-30 does not make handing over a physical ID the price of a stop; Edger holds an arrest on that sole ground unlawful.",
      },
    ],
    keywords: ["id card", "your id", "identification card", "show me your id"],
  },
  {
    id: "consent-search",
    topic: "consent-to-search",
    title: "He may refuse a search — refusal is not a crime and not probable cause",
    jurisdiction: "Federal",
    source: {
      name: "U.S. Supreme Court",
      citation: "Schneckloth v. Bustamonte, 412 U.S. 218 (1973); Florida v. Royer, 460 U.S. 491 (1983)",
    },
    statement:
      "A search by consent is lawful only when the consent is freely and voluntarily given — that is the Schneckloth rule. And refusing consent does not furnish probable cause: a man's refusal to let officers search is not itself a ground to search or to hold him (Royer). An officer may ASK; the Captain may say no, in plain words, and the no is the end of the consent road.",
    scripts: ["I do not consent to any searches."],
    claims: [
      {
        phrase: "you have to let me search your car",
        verdict: "contradicts",
        why: "A search needs a warrant, probable cause with an exception, or voluntary consent (Schneckloth). Nobody has to consent, and a bare demand does not create the right.",
      },
      {
        phrase: "if you refuse the search i can arrest you",
        verdict: "contradicts",
        why: "Refusing consent is the exercise of a right; under Royer it furnishes no probable cause and is not itself an offense.",
      },
      {
        phrase: "do you mind if i search",
        verdict: "matches",
        why: "An officer may ask for consent — asking is lawful (Schneckloth). The answer is the Captain's to give, and 'I do not consent to any searches' is a complete one.",
      },
    ],
    keywords: ["search your car", "search the car", "search your vehicle", "search you", "look through your car", "consent to search"],
  },
  {
    id: "terry-stop-frisk",
    topic: "terry-stops",
    title: "A brief stop and an outer-clothing frisk need reasonable suspicion",
    jurisdiction: "Federal",
    source: { name: "U.S. Supreme Court", citation: "Terry v. Ohio, 392 U.S. 1 (1968)" },
    statement:
      "Under Terry, an officer with reasonable suspicion that crime is afoot may briefly stop a person to investigate; if he also reasonably suspects the person is armed and dangerous, he may frisk the OUTER clothing for weapons. A frisk is a search for weapons, not a general search for evidence, and the stop must stay brief and tied to its justification.",
    scripts: ["Am I being detained, or am I free to leave?"],
    claims: [
      {
        phrase: "i'm going to pat you down",
        verdict: "matches",
        why: "Terry allows an outer-clothing frisk for weapons when the officer reasonably suspects the person is armed and dangerous — a frisk, not a full search.",
      },
      {
        phrase: "i can stop you whenever i want for as long as i want",
        verdict: "contradicts",
        why: "Terry stops stand on reasonable suspicion and must be brief and investigative; the case gives no power to stop anyone, anytime, for any length.",
      },
    ],
    keywords: ["pat you down", "frisk", "pat down"],
  },
  {
    id: "stop-length",
    topic: "traffic-stop-length",
    title: "A traffic stop may not be stretched past its mission",
    jurisdiction: "Federal",
    source: { name: "U.S. Supreme Court", citation: "Rodriguez v. United States, 575 U.S. 431 (2015)" },
    statement:
      "A traffic stop's mission is the traffic violation, the license and vehicle checks, and road safety. Under Rodriguez, an officer may not extend the stop beyond the time reasonably needed for that mission — for example, to wait for a dog — unless the extension is supported by reasonable suspicion or the driver consents. Authority for the stop ends when the mission's tasks are, or reasonably should have been, complete.",
    scripts: ["Am I being detained, or am I free to leave?"],
    claims: [
      {
        phrase: "i can keep you here as long as i want",
        verdict: "contradicts",
        why: "Rodriguez: a stop may not be extended past its mission without reasonable suspicion or consent — 'as long as I want' is not the law.",
      },
      {
        phrase: "i'm going to hold you here until the dog gets here",
        verdict: "contradicts",
        why: "Extending a completed stop to wait for a dog is exactly what Rodriguez forbids, absent reasonable suspicion or consent.",
      },
    ],
    keywords: ["wait for the dog", "k-9", "k9", "dog sniff", "hold you here"],
  },
  {
    id: "exit-order",
    topic: "exit-orders",
    title: "An officer may order the driver — and the passengers — out of the car",
    jurisdiction: "Federal",
    source: {
      name: "U.S. Supreme Court",
      citation: "Pennsylvania v. Mimms, 434 U.S. 106 (1977); Maryland v. Wilson, 519 U.S. 408 (1997)",
    },
    statement:
      "During a lawful traffic stop, an officer may order the driver out of the vehicle (Mimms) and may order the passengers out too (Wilson) — no separate justification is needed. This is one order the base says to OBEY on the spot: get out calmly, keep hands visible, and let the record argue about the rest later.",
    scripts: [],
    claims: [
      {
        phrase: "step out of the vehicle",
        verdict: "matches",
        why: "Mimms and Wilson: ordering everyone out during a lawful stop is within the officer's authority. Obey it calmly.",
      },
      {
        phrase: "step out of the car",
        verdict: "matches",
        why: "Mimms and Wilson: ordering everyone out during a lawful stop is within the officer's authority. Obey it calmly.",
      },
      {
        phrase: "get out of the car",
        verdict: "matches",
        why: "Mimms and Wilson: ordering everyone out during a lawful stop is within the officer's authority. Obey it calmly.",
      },
    ],
    keywords: ["step out", "get out of the vehicle", "out of the car"],
  },
  {
    id: "free-to-leave",
    topic: "free-to-leave",
    title: "He may ask: am I being detained, or am I free to leave?",
    jurisdiction: "Federal",
    source: { name: "U.S. Supreme Court", citation: "Florida v. Royer, 460 U.S. 491 (1983)" },
    statement:
      "A person approached by an officer may ask whether he is being detained or is free to leave, and the answer fixes what the encounter is: if he is free to leave, he may walk away and may decline to answer; if he is detained, the detention must stand on reasonable suspicion. Under Royer, a person may decline an officer's requests, and his refusal does not furnish probable cause.",
    scripts: ["Am I being detained, or am I free to leave?"],
    claims: [
      {
        phrase: "you can't leave until i say so",
        verdict: "matches",
        why: "If the officer says this, the encounter is a detention — lawful only on reasonable suspicion (Royer/Terry). The thing to do is note it, stay calm, and ask what the suspicion is; the record will carry it.",
      },
      {
        phrase: "you have to answer my questions",
        verdict: "contradicts",
        why: "Outside a lawful detention's narrow identification duties, a person may decline to answer an officer's questions; Royer holds that refusal furnishes no probable cause.",
      },
    ],
    keywords: ["free to leave", "am i detained", "being detained"],
  },
  {
    id: "silence",
    topic: "silence-and-miranda",
    title: "The right to remain silent — and to invoke it in clear words",
    jurisdiction: "Federal",
    source: {
      name: "U.S. Supreme Court",
      citation: "Miranda v. Arizona, 384 U.S. 436 (1966); Berghuis v. Thompkins, 560 U.S. 370 (2010)",
    },
    statement:
      "A person in custody must be warned of his right to remain silent before interrogation (Miranda), and the right itself belongs to him whether or not the warnings have been read. Under Thompkins, the right must be invoked UNAMBIGUOUSLY — staying quiet alone may not be enough. The clear invocation is a sentence, said out loud: 'I am choosing to remain silent.' After that, questioning must stop.",
    scripts: ["I am choosing to remain silent.", "I want a lawyer."],
    claims: [
      {
        phrase: "if you don't talk to me i'll take that as guilt",
        verdict: "contradicts",
        why: "Silence, clearly invoked, is a constitutional right (Miranda; Thompkins) — it is not evidence of guilt and may not be held against him.",
      },
      {
        phrase: "you have to talk to me",
        verdict: "contradicts",
        why: "No one in custody can be compelled to answer interrogation; the Fifth Amendment right Miranda protects says the opposite.",
      },
    ],
    keywords: ["remain silent", "miranda", "talk to me", "answer my questions"],
  },
  {
    id: "recording-conversation",
    topic: "recording-rights",
    title: "Alabama is one-party consent: he may record a conversation he is part of",
    jurisdiction: "Alabama",
    source: { name: "Alabama Code", citation: "Ala. Code §§ 13A-11-30, 13A-11-31" },
    statement:
      "Alabama's eavesdropping law makes it a crime to record a private communication WITHOUT the consent of at least one person engaged in it (§§ 13A-11-30, 13A-11-31). One party's consent is enough — and a participant supplies it himself. So a man may record a conversation HE IS PART OF, including a stop he is in, without asking the other side's permission. Recording a conversation he is no part of is a different matter entirely.",
    scripts: ["I am recording this conversation. Alabama is a one-party consent state."],
    claims: [
      {
        phrase: "it's illegal for you to record this",
        verdict: "contradicts",
        why: "Alabama is one-party consent (§§ 13A-11-30, 13A-11-31): a participant may record a conversation he is part of. The claim, said to a participant recording his own stop, is wrong.",
      },
      {
        phrase: "you need my permission to record",
        verdict: "contradicts",
        why: "One-party consent means the participant's own consent satisfies the statute (§ 13A-11-31); the other side's permission is not required.",
      },
    ],
    keywords: ["record this", "recording", "record me", "one-party", "one party consent"],
  },
  {
    id: "recording-police",
    topic: "recording-rights",
    title: "Recording police conduct in public is First Amendment protected",
    jurisdiction: "Federal",
    source: {
      name: "U.S. Court of Appeals, Eleventh Circuit",
      citation: "Smith v. City of Cumming, 212 F.3d 1332 (11th Cir. 2000)",
    },
    statement:
      "In the Eleventh Circuit — Alabama's circuit — the First Amendment protects the right to photograph and videotape police conduct on public property, subject to reasonable time, place, and manner restrictions. The First Amendment protects gathering information about what public officials do on public property, and specifically the right to record matters of public interest.",
    scripts: ["I have a First Amendment right to record police conduct in public."],
    claims: [
      {
        phrase: "turn that camera off",
        verdict: "contradicts",
        why: "Smith v. City of Cumming: recording police conduct in public is First Amendment protected (reasonable time/place/manner limits aside). A bare order to stop recording, with no other ground, contradicts it.",
      },
      {
        phrase: "it's against the law to film the police",
        verdict: "contradicts",
        why: "It is not: the Eleventh Circuit recognized the right to record police conduct in Smith v. City of Cumming, 212 F.3d 1332.",
      },
    ],
    keywords: ["film the police", "camera off", "recording the police", "videotape"],
  },
  {
    id: "vehicle-search-arrest",
    topic: "vehicle-search",
    title: "Arresting the driver does not open the whole car to a search",
    jurisdiction: "Federal",
    source: { name: "U.S. Supreme Court", citation: "Arizona v. Gant, 556 U.S. 332 (2009)" },
    statement:
      "Under Gant, when police arrest a vehicle's occupant they may search the passenger compartment incident to that arrest ONLY if the arrestee is unsecured and within reaching distance of it, OR if evidence relevant to the crime of arrest might be in the vehicle. An arrest alone — a traffic warrant, say — does not by itself open a secured driver's car to a search.",
    scripts: ["I do not consent to any searches."],
    claims: [
      {
        phrase: "when i arrest you i can search your whole car",
        verdict: "contradicts",
        why: "Gant limits a search incident to arrest: the arrestee unsecured within reach, or evidence of the crime of arrest in the vehicle. 'Arrest means the whole car' overstates it.",
      },
      {
        phrase: "an arrest lets me search the vehicle automatically",
        verdict: "contradicts",
        why: "Not automatically — Gant's two conditions govern, and neither is 'there was an arrest.'",
      },
    ],
    keywords: ["search incident", "search the whole car", "search your vehicle incident"],
  },
  {
    id: "dui-implied-consent",
    topic: "dui-stops",
    title: "DUI chemical tests: refusal costs the license — and a refused test is not given",
    jurisdiction: "Alabama",
    source: { name: "Alabama Code", citation: "Ala. Code § 32-5-192" },
    statement:
      "A person who drives on Alabama's highways is deemed to consent to a chemical test (blood, breath, or oral fluid) if LAWFULLY ARRESTED for DUI (§ 32-5-192). The officer must tell him refusal means suspension of his driving privilege for a minimum of 90 days. If he refuses, NO test is given — unless officers obtain a court order. Refusal is a real choice with a real price: the suspension follows on the officer's sworn report, even if the DUI charge itself is later beaten, though acquittal lets the Secretary reduce the suspension.",
    scripts: ["I understand refusal means a license suspension. I am still refusing the test."],
    claims: [
      {
        phrase: "if you refuse the breath test you'll lose your license",
        verdict: "matches",
        why: "That is § 32-5-192: refusal after a lawful DUI arrest brings suspension of the driving privilege, a minimum of 90 days.",
      },
      {
        phrase: "you have to take the breath test right now or else",
        verdict: "contradicts",
        why: "§ 32-5-192 gives the arrested driver the choice; if he refuses, no test is given unless a court orders one. The price of refusal is the suspension, not a forced test on the spot.",
      },
    ],
    keywords: ["breath test", "chemical test", "blow into", "implied consent", "breathalyzer"],
  },
  {
    id: "passenger-seized",
    topic: "passengers",
    title: "A passenger is seized by the stop too — and is not the driver",
    jurisdiction: "Federal",
    source: { name: "U.S. Supreme Court", citation: "Brendlin v. California, 551 U.S. 249 (2007)" },
    statement:
      "When a car is stopped, its passengers are seized under the Fourth Amendment just as the driver is (Brendlin) — a passenger may challenge the stop's legality, and while the stop stands he is not free to walk off mid-stop. But the Alabama license-display duty (§ 32-6-9) speaks to the person DRIVING; being a passenger is not itself a license offense.",
    scripts: ["Am I being detained, or am I free to leave?"],
    claims: [
      {
        phrase: "passengers have no rights in a traffic stop",
        verdict: "contradicts",
        why: "Brendlin: a passenger is seized by the stop and holds Fourth Amendment rights in it, including the right to challenge the stop itself.",
      },
      {
        phrase: "everyone in the car has to show me id",
        verdict: "contradicts",
        why: "The display duty in Ala. Code § 32-6-9 is the driver's. Brendlin gives passengers rights in the stop, not a blanket duty to produce licenses.",
      },
    ],
    keywords: ["passenger", "passengers", "everyone in the car"],
  },
];

/**
 * Topics the base does NOT cover, in the open. A claim that
 * lands on one of these comes back "not in the base" — the gap
 * list is how the base refuses to bluff.
 */
export const LAW_BASE_GAPS: { topic: string; note: string }[] = [
  {
    topic: "Field sobriety tests",
    note: "Whether roadside field sobriety tests (walk-and-turn, one-leg stand) are voluntary in Alabama, and what follows from refusing them — no statute or case citation verified for the base yet. GAP: not in the base.",
  },
  {
    topic: "Preliminary roadside breath test (before arrest)",
    note: "The hand-held roadside breath tester offered BEFORE any arrest is a different device from the § 32-5-192 chemical test; its refusal consequences were not verified to a citation. GAP: not in the base.",
  },
  {
    topic: "Vehicle registration papers",
    note: "What registration documentation an Alabama driver must carry and display, and under which section — not verified to a citation in this pass. GAP: not in the base.",
  },
  {
    topic: "Firearms in the vehicle",
    note: "What a driver must or must not tell an officer about a firearm in the car under Alabama's permitless-carry law — not verified to a citation in this pass. GAP: not in the base.",
  },
  {
    topic: "Dog sniffs during a stop",
    note: "The base covers stop LENGTH (Rodriguez). The separate rules for when a sniff itself is a search are not in the base. GAP: not in the base.",
  },
];

/* ------------------------------------------------------------------ */
/* Sanitizers — an entry without a verifiable source DOES NOT SHIP     */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function cleanStringList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim().slice(0, maxLen))
    .slice(0, maxItems);
}

export function sanitizeLawEntry(v: unknown): LawEntry | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const topic = cleanString(v["topic"], 64);
  const title = cleanString(v["title"], 200);
  const statement = cleanString(v["statement"], 2000);
  const source = isRecord(v["source"]) ? v["source"] : null;
  const sourceName = source ? cleanString(source["name"], 120) : undefined;
  const sourceCitation = source ? cleanString(source["citation"], 200) : undefined;
  // The shipping rule, enforced here: no source, no entry.
  if (!id || !topic || !title || !statement || !sourceName || !sourceCitation) return null;
  const jurisdiction = v["jurisdiction"] === "Alabama" ? "Alabama" : v["jurisdiction"] === "Federal" ? "Federal" : null;
  if (!jurisdiction) return null;
  const claims: OfficerClaimPattern[] = [];
  if (Array.isArray(v["claims"])) {
    for (const c of v["claims"].slice(0, 12)) {
      if (!isRecord(c)) continue;
      const phrase = cleanString(c["phrase"], 200);
      const why = cleanString(c["why"], 600);
      if (!phrase || !why) continue;
      if (c["verdict"] !== "matches" && c["verdict"] !== "contradicts") continue;
      claims.push({ phrase, verdict: c["verdict"], why });
    }
  }
  return {
    id,
    topic,
    title,
    jurisdiction,
    source: { name: sourceName, citation: sourceCitation },
    statement,
    scripts: cleanStringList(v["scripts"], 6, 300),
    claims,
    keywords: cleanStringList(v["keywords"], 12, 80),
  };
}

export interface LawBaseFile {
  entries: LawEntry[];
  gaps: { topic: string; note: string }[];
  /** When the core's copy was seeded from the in-repo base. */
  seededAt: number | null;
}

export function sanitizeLawBaseFile(v: unknown): LawBaseFile {
  if (!isRecord(v)) return { entries: sanitizeLawBaseFile({ entries: LAW_BASE_SEED, gaps: LAW_BASE_GAPS }).entries, gaps: LAW_BASE_GAPS, seededAt: null };
  const entries = Array.isArray(v["entries"])
    ? v["entries"].map(sanitizeLawEntry).filter((e): e is LawEntry => e !== null)
    : [];
  const gaps = Array.isArray(v["gaps"])
    ? v["gaps"]
        .filter(isRecord)
        .map((g) => {
          const topic = cleanString(g["topic"], 120);
          const note = cleanString(g["note"], 600);
          return topic && note ? { topic, note } : null;
        })
        .filter((g): g is { topic: string; note: string } => g !== null)
    : [];
  return {
    entries,
    gaps,
    seededAt: typeof v["seededAt"] === "number" && Number.isFinite(v["seededAt"]) ? v["seededAt"] : null,
  };
}

/** The seed as a store file — every entry re-passing the sanitizer's shipping rule. */
export function seededLawBaseFile(at: number): LawBaseFile {
  return {
    entries: LAW_BASE_SEED.map(sanitizeLawEntry).filter((e): e is LawEntry => e !== null),
    gaps: LAW_BASE_GAPS.map((g) => ({ ...g })),
    seededAt: at,
  };
}

/* ------------------------------------------------------------------ */
/* Claim check — the construct tool                                    */
/* ------------------------------------------------------------------ */

export type ClaimVerdict = "matches" | "contradicts" | "not-in-base";

export interface ClaimCheckResult {
  verdict: ClaimVerdict;
  /** The claim, as given (trimmed). */
  claim: string;
  /** The entry the claim was checked against — null when nothing in the base speaks to it. */
  entry: LawEntry | null;
  /** Plain words: the verdict and the ground it stands on. */
  note: string;
  /** A related entry on the same topic when the exact claim is not in the base. */
  related: LawEntry | null;
}

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' -]+/g, " ").replace(/\s+/g, " ")} `;
}

/**
 * THE TOOL — check one claim against the base. Deterministic:
 * an entry's own claim patterns first (an exact spoken claim
 * the base has a verdict on), then topic keywords for a
 * "related" pointer. Anything else is "not in the base" —
 * the tool never stretches an entry to cover a claim it does
 * not speak to.
 */
export function checkOfficerClaim(claim: string, entries: LawEntry[]): ClaimCheckResult {
  const clean = claim.trim();
  const hay = normalize(clean);
  for (const entry of entries) {
    for (const pattern of entry.claims) {
      if (hay.includes(normalize(pattern.phrase))) {
        return {
          verdict: pattern.verdict,
          claim: clean,
          entry,
          note:
            pattern.verdict === "matches"
              ? `That claim MATCHES the base. ${pattern.why} [${entry.source.citation}]`
              : `That claim CONTRADICTS the base. ${pattern.why} [${entry.source.citation}]`,
          related: null,
        };
      }
    }
  }
  for (const entry of entries) {
    if (entry.keywords.some((k) => hay.includes(normalize(k)))) {
      return {
        verdict: "not-in-base",
        claim: clean,
        entry: null,
        note: `That exact claim is NOT IN THE BASE. The base does speak to the topic — see “${entry.title}” (${entry.source.citation}) — but it carries no verdict on these words, and Anubis will not improvise one.`,
        related: entry,
      };
    }
  }
  return {
    verdict: "not-in-base",
    claim: clean,
    entry: null,
    note: "That claim is NOT IN THE BASE. The base has no entry that speaks to it, and Anubis will not improvise law.",
    related: null,
  };
}

/* ------------------------------------------------------------------ */
/* Guidance — template-bound, entry-id cited, nothing else             */
/* ------------------------------------------------------------------ */

export interface GuidanceLine {
  /** The exact words Anubis may speak, built only from the entry. */
  text: string;
  /** The base entry this line stands on. */
  entryId: string;
  /** The entry's citation, carried with the line. */
  citation: string;
}

/**
 * The guidance for one entry: its scripts, word for word, each
 * framed by the same template — "Say this: …" — and nothing
 * else. An entry with no scripts yields NO lines (its statement
 * is information, not words for his mouth).
 */
export function guidanceForEntry(entry: LawEntry): GuidanceLine[] {
  return entry.scripts.map((script) => ({
    text: `Say this: “${script}”`,
    entryId: entry.id,
    citation: entry.source.citation,
  }));
}

/** Guidance for a claim-check result: the matched entry's words, or none. */
export function guidanceForClaim(result: ClaimCheckResult): GuidanceLine[] {
  if (!result.entry) return [];
  return guidanceForEntry(result.entry);
}

/* ------------------------------------------------------------------ */
/* Stop detection — the explicit keyword set                           */
/* ------------------------------------------------------------------ */

/**
 * The Captain's own declaration that a stop is on. Heard in HIS
 * speech, this starts stop mode: Anubis records and listens.
 */
export const STOP_DECLARATION_PHRASES = [
  "i'm being pulled over",
  "i am being pulled over",
  "getting pulled over",
  "i'm in a traffic stop",
  "i am in a traffic stop",
  "i'm being stopped",
  "i am being stopped",
  "this is a traffic stop",
  "the officer is at my window",
  "cop is at my window",
  "start stop mode",
  "anubis stop mode",
] as const;

/**
 * An officer's self-identification and stop vocabulary. Heard
 * in ANY speech while listening is on, these mark an official
 * interaction and start stop mode — the set is explicit and
 * small on purpose: a phrase outside it starts nothing.
 */
export const OFFICER_INTERACTION_PHRASES = [
  "license and registration",
  "do you know why i stopped you",
  "do you know why i pulled you over",
  "i'm officer",
  "i am officer",
  "this is officer",
  "officer with the",
  "sheriff's department",
  "sheriffs department",
  "state trooper",
  "highway patrol",
  "step out of the vehicle",
  "step out of the car",
  "you were going",
  "miles per hour in a",
] as const;

/** The Captain's release: his words that end stop mode. */
export const STOP_RELEASE_PHRASES = [
  "end stop mode",
  "stop mode off",
  "the stop is over",
  "stop is over",
  "anubis end the stop",
] as const;

export type StopTrigger = "declaration" | "officer" | null;

/** Which trigger, if any, a heard line carries. Declaration wins over officer phrases. */
export function detectStopTrigger(text: string): StopTrigger {
  const hay = normalize(text);
  if (STOP_DECLARATION_PHRASES.some((p) => hay.includes(normalize(p)))) return "declaration";
  if (OFFICER_INTERACTION_PHRASES.some((p) => hay.includes(normalize(p)))) return "officer";
  return null;
}

export function isStopRelease(text: string): boolean {
  const hay = normalize(text);
  return STOP_RELEASE_PHRASES.some((p) => hay.includes(normalize(p)));
}

/**
 * The shape of a legal claim, whoever says it: "you have to…",
 * "you must…", "I can arrest you…", "it's illegal to…", "the
 * law says…". Stop mode logs claim-SHAPED lines even when the
 * base has no verdict for them — the log then says "not in the
 * base" instead of letting the claim pass unrecorded. Small
 * talk is not claim-shaped and is never logged as a claim.
 */
const CLAIM_SHAPE_PHRASES = [
  "you have to",
  "you must",
  "you need to",
  "i can arrest you",
  "you're under arrest for",
  "you are under arrest for",
  "it's illegal",
  "it is illegal",
  "against the law",
  "the law says",
  "by law",
  "i have the right to",
  "you don't have the right",
  "you do not have the right",
] as const;

export function looksLikeLegalClaim(text: string): boolean {
  const hay = normalize(text);
  return CLAIM_SHAPE_PHRASES.some((p) => hay.includes(normalize(p)));
}

/**
 * How long stop mode waits in silence before it calls the
 * interaction over: ten minutes without one heard line on the
 * stop's camera. His word ends it sooner; the ALL-STOP ends it
 * at once.
 */
export const STOP_SILENCE_WINDOW_MS = 10 * 60 * 1000;
