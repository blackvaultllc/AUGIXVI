export type KnowledgeSource = {
  label: string;
  url: string;
};

export type MartialArtEntry = {
  name: string;
  focus: string;
};

export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  {
    label: "Next Generation Science Standards",
    url: "https://www.nextgenscience.org/",
  },
  {
    label: "National Center for Education Statistics, Digest of Education Statistics",
    url: "https://nces.ed.gov/programs/digest/",
  },
  {
    label: "NCES Digest Dashboard",
    url: "https://nces.ed.gov/programs/digest-dashboard/",
  },
];

export const CURRICULUM_PACKS = [
  {
    level: "Pre-K",
    domains: ["language", "early mathematics", "science exploration", "social development"],
    coverage: "Topic index only; no jurisdiction-specific curriculum is loaded.",
    sources: [KNOWLEDGE_SOURCES[1]!, KNOWLEDGE_SOURCES[2]!],
  },
  {
    level: "Elementary",
    domains: ["life science", "physical science", "earth and space science", "engineering design"],
    coverage:
      "NGSS topic index: dimensions include practices, crosscutting concepts, and core ideas.",
    sources: [KNOWLEDGE_SOURCES[0]!],
  },
  {
    level: "Middle school",
    domains: ["life science", "physical science", "earth and space science", "engineering design"],
    coverage: "NGSS topic index; consult the cited standards for grade-specific expectations.",
    sources: [KNOWLEDGE_SOURCES[0]!],
  },
  {
    level: "High school",
    domains: ["life science", "physical science", "earth and space science", "engineering design"],
    coverage: "NGSS topic index; consult the cited standards for grade-specific expectations.",
    sources: [KNOWLEDGE_SOURCES[0]!],
  },
  {
    level: "College and adult learning",
    domains: ["education statistics", "research literacy", "discipline-specific study"],
    coverage: "Reference directory only; institution and program details are not loaded.",
    sources: [KNOWLEDGE_SOURCES[1]!],
  },
] as const;

export const MARTIAL_ARTS: MartialArtEntry[] = [
  {
    name: "Aikido",
    focus: "A Japanese practice emphasizing balance, movement, and conflict de-escalation.",
  },
  {
    name: "Boxing",
    focus:
      "A striking sport focused on footwork, defense, conditioning, and regulated competition.",
  },
  {
    name: "Brazilian jiu-jitsu",
    focus: "A grappling sport focused on positional control, escapes, and submissions under rules.",
  },
  {
    name: "Capoeira",
    focus: "A Brazilian Afro-diasporic practice combining movement, music, and ritualized play.",
  },
  {
    name: "Judo",
    focus: "A Japanese grappling sport emphasizing throws, pins, and safe practice.",
  },
  {
    name: "Karate",
    focus:
      "A family of Okinawan and Japanese practices with forms, striking, discipline, and sport variants.",
  },
  {
    name: "Krav Maga",
    focus:
      "A modern self-protection system; instruction should prioritize avoidance, safety, and qualified supervision.",
  },
  {
    name: "Kung fu",
    focus:
      "A broad label for diverse Chinese martial traditions, with distinct forms, histories, and training goals.",
  },
  {
    name: "Muay Thai",
    focus: "A Thai striking sport emphasizing conditioning, movement, and regulated competition.",
  },
  {
    name: "Taekwondo",
    focus: "A Korean martial art and sport known for kicking techniques, forms, and competition.",
  },
  {
    name: "Wrestling",
    focus: "A grappling sport centered on takedowns, control, escapes, and rule-based competition.",
  },
];

export const DEFENSIVE_CYBERSECURITY_TOPICS = [
  "asset inventory and secure configuration",
  "multi-factor authentication and access control",
  "software updates and vulnerability management",
  "backups and recovery planning",
  "phishing awareness and incident reporting",
  "logging, detection, containment, and recovery",
] as const;

export const PRACTICAL_SKILL_TOPICS = [
  "document literacy and source checking",
  "first-aid awareness and emergency-service escalation",
  "planning, note-taking, and task decomposition",
  "measurement, unit conversion, and basic calculation",
  "clear communication and conflict de-escalation",
] as const;

export const US_STATES = [
  ["Alabama", "AL"],
  ["Alaska", "AK"],
  ["Arizona", "AZ"],
  ["Arkansas", "AR"],
  ["California", "CA"],
  ["Colorado", "CO"],
  ["Connecticut", "CT"],
  ["Delaware", "DE"],
  ["Florida", "FL"],
  ["Georgia", "GA"],
  ["Hawaii", "HI"],
  ["Idaho", "ID"],
  ["Illinois", "IL"],
  ["Indiana", "IN"],
  ["Iowa", "IA"],
  ["Kansas", "KS"],
  ["Kentucky", "KY"],
  ["Louisiana", "LA"],
  ["Maine", "ME"],
  ["Maryland", "MD"],
  ["Massachusetts", "MA"],
  ["Michigan", "MI"],
  ["Minnesota", "MN"],
  ["Mississippi", "MS"],
  ["Missouri", "MO"],
  ["Montana", "MT"],
  ["Nebraska", "NE"],
  ["Nevada", "NV"],
  ["New Hampshire", "NH"],
  ["New Jersey", "NJ"],
  ["New Mexico", "NM"],
  ["New York", "NY"],
  ["North Carolina", "NC"],
  ["North Dakota", "ND"],
  ["Ohio", "OH"],
  ["Oklahoma", "OK"],
  ["Oregon", "OR"],
  ["Pennsylvania", "PA"],
  ["Rhode Island", "RI"],
  ["South Carolina", "SC"],
  ["South Dakota", "SD"],
  ["Tennessee", "TN"],
  ["Texas", "TX"],
  ["Utah", "UT"],
  ["Vermont", "VT"],
  ["Virginia", "VA"],
  ["Washington", "WA"],
  ["West Virginia", "WV"],
  ["Wisconsin", "WI"],
  ["Wyoming", "WY"],
] as const;

export function lookupKnowledge(query: string): string | null {
  const normalized = query.toLocaleLowerCase();
  const art = MARTIAL_ARTS.find((entry) => normalized.includes(entry.name.toLocaleLowerCase()));
  if (art)
    return `${art.name}: ${art.focus} Practice with a qualified instructor and follow local safety rules.`;
  if (/\b(?:martial arts|martial art styles)\b/i.test(normalized)) {
    return `I have a structured overview of ${MARTIAL_ARTS.map((entry) => entry.name).join(", ")}. These are distinct traditions and sports; I can explain a named style, but I do not physically perform them.`;
  }
  if (/\b(?:curriculum|science standards|ngss)\b/i.test(normalized)) {
    return "The NGSS organizes K–12 science around science and engineering practices, crosscutting concepts, and disciplinary core ideas. I have a topic index, not the complete grade-by-grade standards; see nextgenscience.org.";
  }
  if (/\b(?:state facts|facts about (?:a )?state|population of|capital of)\b/i.test(normalized)) {
    return "I do not have a verified state-facts dataset loaded. The state directory and NCES source links are available in my knowledge catalog; I will not guess a state fact.";
  }
  if (/\b(?:cybersecurity|secure my|protect my computer|defend my network)\b/i.test(normalized)) {
    return `For defensive security, start with ${DEFENSIVE_CYBERSECURITY_TOPICS.slice(0, 4).join(", ")}. I can explain defensive concepts, but I will not run commands against systems.`;
  }
  return null;
}
