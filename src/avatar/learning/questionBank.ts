/**
 * THE QUESTION BANK — Daily Training (owner orders
 * 2026-11-26). Questions are drawn randomly and UNTITLED:
 * the subject tag on each item is INTERNAL — it drives the
 * calibration and the progress view, and it is never shown
 * during a run.
 *
 * THE POC BAR (his doctrine, 2026-11-26 ~12:57 CST — apply
 * exactly): POC ONLY. Everything he learns must be proof of
 * concept — what stands as truth now, confirmed by fact. No
 * hypothesis, no maybe/maybe-not. An item whose answer is
 * not confirmed fact does not ship as a training question
 * at all. Every item therefore carries:
 *   - `source` — the work, experiment, statute, or record
 *     the fact stands on, named plainly;
 *   - `confirmedAsOf` — the date the fact was last confirmed
 *     as it stands here.
 * If the world changes and a new fact is confirmed, the POC
 * updates: the old item is marked `retired: true` (it stops
 * being drawn, and the record of what he answered against
 * it stands untouched) and a NEW item with its own source
 * and date replaces it. An item is never silently edited —
 * a changed answer with the same id would falsify his
 * training record, and the record is the calibration.
 *
 * Every item has exactly ONE correct answer. The choices
 * are written so the wrong ones are wrong on the fact, not
 * on a trick of wording.
 */

export type SubjectId =
  | "psychology"
  | "dark-psychology"
  | "cybersecurity"
  | "martial-arts"
  | "ninjutsu"
  | "bushido"
  | "kung-fu"
  | "taekwondo"
  | "law"
  | "art-of-war"
  | "anatomy"
  | "health"
  | "medicine"
  | "science";

/** Shown ONLY in the progress view — never during a run. */
export const SUBJECT_LABELS: Record<SubjectId, string> = {
  psychology: "Psychology",
  "dark-psychology": "Dark Psychology",
  cybersecurity: "Cybersecurity",
  "martial-arts": "Martial Arts",
  ninjutsu: "Ninjutsu",
  bushido: "Bushido",
  "kung-fu": "Kung Fu",
  taekwondo: "Taekwondo",
  law: "Law",
  "art-of-war": "The Art of War",
  anatomy: "Anatomy",
  health: "Health",
  medicine: "Medicine & Surgery",
  science: "General Science",
};

export const SUBJECT_IDS = Object.keys(SUBJECT_LABELS) as SubjectId[];

export interface BankQuestion {
  id: string;
  /** INTERNAL ONLY — never rendered during a run. */
  subject: SubjectId;
  question: string;
  choices: readonly [string, string, string, string];
  /** Index into choices of the ONE correct answer. */
  answerIndex: 0 | 1 | 2 | 3;
  /** The fact, stated plainly, with its source. Shown after he answers. */
  explanation: string;
  /** The work / experiment / statute / record the fact stands on. */
  source: string;
  /** The date this fact was last confirmed as it stands here (POC record). */
  confirmedAsOf: string;
  /** A superseded item: never drawn again, never edited, record stands. */
  retired?: boolean;
}

const POC_DATE = "2026-11-26";

function q(
  id: string,
  subject: SubjectId,
  question: string,
  choices: [string, string, string, string],
  answerIndex: 0 | 1 | 2 | 3,
  explanation: string,
  source: string,
): BankQuestion {
  return { id, subject, question, choices, answerIndex, explanation, source, confirmedAsOf: POC_DATE };
}

export const QUESTION_BANK: readonly BankQuestion[] = [
  /* ------------------------------ Psychology ------------------------------ */
  q(
    "psy-two-systems",
    "psychology",
    "In Daniel Kahneman's account of the mind, what is “System 1”?",
    [
      "The slow, deliberate, effortful mode of thinking",
      "The fast, automatic, effortless mode of thinking",
      "The part of the brain that stores long-term memory",
      "The mode of thinking used only during sleep",
    ],
    1,
    "Kahneman describes two modes: System 1 operates automatically and quickly, with little or no effort; System 2 allocates attention to effortful mental activities. Source: Daniel Kahneman, “Thinking, Fast and Slow” (2011).",
    "Daniel Kahneman, “Thinking, Fast and Slow” (2011)",
  ),
  q(
    "psy-pavlov",
    "psychology",
    "In Pavlov's famous experiments, what happened after a bell was repeatedly paired with food?",
    [
      "The dogs learned to press a lever for food",
      "The dogs salivated at the sound of the bell alone",
      "The dogs stopped eating altogether",
      "The dogs could no longer hear the bell",
    ],
    1,
    "Pavlov's dogs came to salivate at the bell alone, because the bell had been paired with food — the founding demonstration of classical conditioning. Source: Ivan Pavlov's conditioned-reflex experiments (published 1900s–1927).",
    "Ivan Pavlov, conditioned-reflex experiments (1900s–1927)",
  ),
  q(
    "psy-dissonance",
    "psychology",
    "What is cognitive dissonance, in Leon Festinger's theory?",
    [
      "The discomfort felt when beliefs and actions contradict each other",
      "The inability to remember new information",
      "The tendency to obey authority figures",
      "A state of deep, focused attention",
    ],
    0,
    "Festinger's theory (1957): when a person's actions and beliefs contradict, the mind feels real discomfort — dissonance — and works to reduce it, usually by adjusting the belief. Source: Leon Festinger, “A Theory of Cognitive Dissonance” (1957).",
    "Leon Festinger, “A Theory of Cognitive Dissonance” (1957)",
  ),
  q(
    "psy-forgetting",
    "psychology",
    "What did Hermann Ebbinghaus's forgetting curve show?",
    [
      "Memory improves steadily for a week after learning",
      "Memory decays fastest soon after learning, then levels off",
      "Memory never decays once something is truly learned",
      "Forgetting happens only during sleep",
    ],
    1,
    "Ebbinghaus measured his own retention and found memory loss is steepest in the first hours and days, then levels off — which is why spaced review works against it. Source: Hermann Ebbinghaus, “Memory” (1885).",
    "Hermann Ebbinghaus, “Memory: A Contribution to Experimental Psychology” (1885)",
  ),
  q(
    "psy-dunning-kruger",
    "psychology",
    "What does the Dunning–Kruger effect describe?",
    [
      "Experts always overestimate their ability",
      "People with low skill in a subject tend to overestimate their ability at it",
      "People perform worse when they are being watched",
      "Memory is worse after a head injury",
    ],
    1,
    "Kruger and Dunning (1999) found that low-skill performers overestimate their ability, because the skill needed to do the work is the same skill needed to judge it. Source: Kruger & Dunning, “Unskilled and Unaware of It” (1999).",
    "Justin Kruger & David Dunning (1999)",
  ),
  q(
    "psy-operant",
    "psychology",
    "In B. F. Skinner's operant conditioning, what shapes behavior over time?",
    [
      "Pairing two stimuli together repeatedly",
      "The consequences that follow the behavior — reward and punishment",
      "Watching a model perform the behavior",
      "The person's stated intentions",
    ],
    1,
    "Operant conditioning: behavior followed by reward is repeated; behavior followed by punishment is avoided. The consequences do the shaping. Source: B. F. Skinner's operant conditioning research (1930s onward).",
    "B. F. Skinner, operant conditioning research (1930s onward)",
  ),

  /* ---------------------------- Dark Psychology ---------------------------- */
  q(
    "dark-reciprocity",
    "dark-psychology",
    "In Robert Cialdini's “Influence,” what is the principle of reciprocity?",
    [
      "People copy what the majority is doing",
      "People feel obliged to return what they have been given",
      "People obey whoever holds a title",
      "People value things more when they are rare",
    ],
    1,
    "Reciprocity: people feel obliged to return favors, gifts, and concessions — which is why an unsolicited favor can be used as a hook. Source: Robert B. Cialdini, “Influence: The Psychology of Persuasion” (1984).",
    "Robert B. Cialdini, “Influence” (1984)",
  ),
  q(
    "dark-social-proof",
    "dark-psychology",
    "What is “social proof” as a persuasion lever?",
    [
      "Proof offered by a scientific study",
      "Deciding what is right by watching what others are doing",
      "A written contract signed by witnesses",
      "Proof that a product was tested in a laboratory",
    ],
    1,
    "Social proof: under uncertainty, people take their cue from the crowd — so a manufactured crowd (fake reviews, staged agreement) can move a decision without any real evidence. Source: Robert B. Cialdini, “Influence” (1984).",
    "Robert B. Cialdini, “Influence” (1984)",
  ),
  q(
    "dark-milgram",
    "dark-psychology",
    "In Stanley Milgram's 1963 obedience experiments, what did most participants do?",
    [
      "Refused the experimenter's instructions almost immediately",
      "Obeyed instructions to deliver what they believed were dangerous shocks, all the way to the maximum",
      "Left the room before the experiment began",
      "Figured out the setup and played along knowingly",
    ],
    1,
    "In Milgram's 1963 study, 26 of 40 participants (65%) obeyed the authority figure's instructions to the maximum 450 volts, against their own visible distress — the standing demonstration of how far authority alone can move ordinary people. Source: Stanley Milgram, Yale University (1963).",
    "Stanley Milgram, obedience experiments (1963)",
  ),
  q(
    "dark-gaslighting",
    "dark-psychology",
    "Where does the term “gaslighting” come from?",
    [
      "A 1960s psychology textbook",
      "Patrick Hamilton's 1938 play “Gas Light,” where a husband dims the lamps and denies it",
      "A court case about a gas company",
      "A novel by George Orwell",
    ],
    1,
    "The term comes from Patrick Hamilton's 1938 play “Gas Light”: a husband dims the gas lamps and denies anything changed, to make his wife doubt her own senses. The tactic named after it attacks a person's memory and perception the same way. Source: Patrick Hamilton, “Gas Light” (1938).",
    "Patrick Hamilton, “Gas Light” (1938)",
  ),
  q(
    "dark-triad",
    "dark-psychology",
    "Which three traits make up the “dark triad” in personality psychology?",
    [
      "Anxiety, depression, and anger",
      "Narcissism, Machiavellianism, and psychopathy",
      "Shyness, stubbornness, and impulsiveness",
      "Ambition, jealousy, and pride",
    ],
    1,
    "Paulhus and Williams (2002) named the dark triad: narcissism, Machiavellianism, and psychopathy — three overlapping traits that share a callous, manipulative core. Source: Paulhus & Williams, “The Dark Triad of Personality” (2002).",
    "Delroy L. Paulhus & Kevin M. Williams (2002)",
  ),
  q(
    "dark-darvo",
    "dark-psychology",
    "What does DARVO stand for?",
    [
      "Deny, Attack, and Reverse Victim and Offender",
      "Distract, Argue, Repeat, Vanish, Obscure",
      "Defend, Accuse, Refuse, Victimize, Oppose",
      "Delay, Avoid, Redirect, Vilify, Object",
    ],
    0,
    "DARVO — Deny, Attack, Reverse Victim and Offender — is the pattern Jennifer Freyd named (1997): confronted with harm they did, the manipulator denies it, attacks the confronter, and ends up cast as the victim. Source: Jennifer J. Freyd (1997).",
    "Jennifer J. Freyd (1997)",
  ),

  /* ----------------------------- Cybersecurity ----------------------------- */
  q(
    "cyber-phishing",
    "cybersecurity",
    "What is phishing?",
    [
      "A program that encrypts files and demands payment",
      "Fraudulent messages that imitate trusted senders to steal credentials or data",
      "A method of guessing passwords by trying every combination",
      "A physical device plugged into a network port",
    ],
    1,
    "Phishing is fraud by imitation: messages made to look like they come from a bank, a company, or a person you trust, built to make you hand over passwords, codes, or money. The defense is verification through a channel you chose, not the one the message gave you. Source: NIST Computer Security Resource Center glossary.",
    "Established cybersecurity terminology (NIST Computer Security Resource Center glossary)",
  ),
  q(
    "cyber-mfa",
    "cybersecurity",
    "What does multi-factor authentication (MFA) add to a password?",
    [
      "A longer password chosen by the system",
      "A second, independent proof of identity — like a code or a device prompt",
      "A automatic password change every day",
      "Encryption of the password while it is typed",
    ],
    1,
    "MFA requires a second factor from a different category — something you have or something you are — on top of the password (something you know). A stolen password alone then fails to open the account. Source: NIST SP 800-63, Digital Identity Guidelines.",
    "Established cybersecurity practice (NIST SP 800-63, Digital Identity Guidelines)",
  ),
  q(
    "cyber-ransomware",
    "cybersecurity",
    "What is ransomware?",
    [
      "Software that quietly records keystrokes",
      "Malware that encrypts a victim's data and demands payment for the key",
      "A fake antivirus program",
      "An email filter that blocks spam",
    ],
    1,
    "Ransomware encrypts the victim's files or systems and demands payment for decryption. Offline backups are the standing defense, because they make the encrypted copy worthless to the attacker. Source: CISA ransomware guidance.",
    "Established cybersecurity terminology (CISA ransomware guidance)",
  ),
  q(
    "cyber-least-privilege",
    "cybersecurity",
    "What is the principle of least privilege?",
    [
      "Every user should have administrator access to work faster",
      "Each account gets only the access it needs to do its job — nothing more",
      "Passwords should be shared within a team for coverage",
      "Systems should have as few accounts as possible",
    ],
    1,
    "Least privilege: every account, program, and person holds only the minimum access their task requires. When an account is compromised, the damage is fenced to that minimum. Source: Saltzer & Schroeder (1975); NIST guidance.",
    "Established cybersecurity principle (NIST; Saltzer & Schroeder, 1975)",
  ),
  q(
    "cyber-zero-day",
    "cybersecurity",
    "What is a “zero-day” vulnerability?",
    [
      "A vulnerability that takes zero days to exploit once found",
      "A flaw the vendor does not know about yet, or has not yet patched",
      "A virus that deletes itself after one day",
      "The first vulnerability ever found in a system",
    ],
    1,
    "A zero-day is a flaw with zero days of vendor awareness or fix behind it — attackers who know it hold a window in which no patch exists. The defense in that window is layers: least privilege, monitoring, and segmentation. Source: NIST Computer Security Resource Center glossary.",
    "Established cybersecurity terminology (NIST CSRC glossary)",
  ),
  q(
    "cyber-patching",
    "cybersecurity",
    "Why does installing security updates promptly matter?",
    [
      "Updates make the software run noticeably faster",
      "Updates close known vulnerabilities that attackers actively exploit",
      "Updates are required for the warranty to stay valid",
      "Updates remove the need for passwords",
    ],
    1,
    "A security update closes holes that are publicly known the moment the patch ships — attackers reverse-engineer patches to build exploits, so the unpatched window after release is the most dangerous one. Source: CISA guidance on timely patching.",
    "Established cybersecurity practice (CISA guidance on timely patching)",
  ),

  /* ------------------------------ Martial Arts ----------------------------- */
  q(
    "ma-karate",
    "martial-arts",
    "Where did karate develop, and what does its name mean?",
    [
      "In mainland China; it means “iron fist”",
      "In Okinawa; “karate” means “empty hand”",
      "In Korea; it means “way of the foot”",
      "In Thailand; it means “eight limbs”",
    ],
    1,
    "Karate developed in Okinawa (then the Ryukyu Kingdom) from local fighting methods and Chinese influence; the name is written with characters meaning “empty hand.” Source: established martial-arts history (Okinawa, Ryukyu Kingdom).",
    "Established martial-arts history — karate, Okinawa",
  ),
  q(
    "ma-judo",
    "martial-arts",
    "Who founded judo, and when?",
    [
      "Morihei Ueshiba, in 1925",
      "Jigoro Kano, in 1882",
      "Gichin Funakoshi, in 1901",
      "Choi Hong-hi, in 1955",
    ],
    1,
    "Jigoro Kano founded judo in 1882 in Tokyo, refining jujutsu into a system built on maximum efficiency and mutual benefit; his school was the Kodokan. Source: established martial-arts history (Kodokan, 1882).",
    "Established martial-arts history — Kodokan judo, 1882",
  ),
  q(
    "ma-muay-thai",
    "martial-arts",
    "Why is Muay Thai called “the art of eight limbs”?",
    [
      "It has eight founding masters",
      "It strikes with fists, elbows, knees, and shins — eight points of contact",
      "Its forms contain exactly eight movements",
      "It is practiced in eight countries",
    ],
    1,
    "Muay Thai uses the fists (2), elbows (2), knees (2), and shins/feet (2) — eight “limbs” as weapons, where Western boxing uses two points and kickboxing four. Source: established martial-arts knowledge — Muay Thai, Thailand.",
    "Established martial-arts knowledge — Muay Thai",
  ),
  q(
    "ma-queensberry",
    "martial-arts",
    "What did the Marquess of Queensberry rules (1867) establish for boxing?",
    [
      "Bare-knuckle fighting to the finish",
      "Gloves, timed rounds, and the ten-second count",
      "Weight classes for the first time anywhere",
      "Professional boxing leagues",
    ],
    1,
    "The Queensberry rules (1867) made gloves mandatory, set three-minute rounds with one-minute rests, and introduced the ten-second count for a downed boxer — the frame modern boxing still stands in. Source: established boxing history (Queensberry rules, 1867).",
    "Established boxing history — Queensberry rules, 1867",
  ),
  q(
    "ma-bjj",
    "martial-arts",
    "Brazilian jiu-jitsu developed primarily from which art, carried to Brazil in the early 1900s?",
    [
      "Japanese judo / jujutsu, taught in Brazil by Mitsuyo Maeda",
      "Korean taekwondo",
      "Chinese wing chun",
      "Russian sambo",
    ],
    0,
    "Mitsuyo Maeda, a Kodokan judoka, emigrated to Brazil and taught Carlos Gracie; the Gracie family developed the ground-focused system that became Brazilian jiu-jitsu. Source: established martial-arts history (Maeda → Gracie, 1910s onward).",
    "Established martial-arts history — Brazilian jiu-jitsu",
  ),
  q(
    "ma-wrestling",
    "martial-arts",
    "Wrestling's place in the ancient Olympic Games is best described how?",
    [
      "It was added only in the modern Olympics of 1896",
      "It was contested in the ancient Games from 708 BC",
      "It was banned from the ancient Games as too dangerous",
      "It existed only as a children's event",
    ],
    1,
    "Wrestling entered the ancient Olympic Games in 708 BC and was the decisive final event of the pentathlon — one of the oldest recorded competitive sports in the world. Source: established Olympic history.",
    "Established Olympic history — wrestling, 708 BC",
  ),

  /* -------------------------------- Ninjutsu ------------------------------- */
  q(
    "nin-iga-koga",
    "ninjutsu",
    "Which two regions of feudal Japan are historically associated with the ninja (shinobi)?",
    [
      "Edo and Kyoto",
      "Iga and Koga",
      "Okinawa and Hokkaido",
      "Nagasaki and Osaka",
    ],
    1,
    "The Iga and Koga regions (present-day Mie and Shiga prefectures) are the documented homelands of shinobi families and their methods during Japan's feudal centuries. Source: established Japanese history — Iga and Koga shinobi traditions.",
    "Established Japanese history — Iga and Koga",
  ),
  q(
    "nin-shinobi-work",
    "ninjutsu",
    "What was the shinobi's actual historical work?",
    [
      "Tournament fighting for sport",
      "Espionage, scouting, infiltration, and survival",
      "Ceremonial guard duty at temples",
      "Teaching martial arts to the public",
    ],
    1,
    "The shinobi were specialists in espionage — intelligence gathering, infiltration, scouting, and escape — hired precisely because open samurai warfare could not do that work. Ninjutsu is the collected discipline of that trade, not a dueling sport. Source: established Japanese history (Bansenshukai, 1676, compiles the tradition).",
    "Established Japanese history — Bansenshukai (1676)",
  ),
  q(
    "nin-character",
    "ninjutsu",
    "The character 忍 (“nin”) at the heart of “ninjutsu” carries which core meaning?",
    [
      "Speed",
      "Endurance / perseverance (and stealth)",
      "Victory",
      "Shadow",
    ],
    1,
    "忍 (nin) means endurance, perseverance, patience — with the sense of enduring unseen. The name states the discipline: outlast, stay hidden, complete the mission. Source: established Japanese language and ninjutsu tradition.",
    "Established Japanese language — the character 忍",
  ),
  q(
    "nin-bujinkan",
    "ninjutsu",
    "Masaaki Hatsumi is known in the ninjutsu world as what?",
    [
      "The founder of the Kodokan",
      "Founder of the Bujinkan and grandmaster (34th) of the Togakure-ryu line",
      "The last shogun's personal bodyguard",
      "The author of the Hagakure",
    ],
    1,
    "Masaaki Hatsumi, student of Toshitsugu Takamatsu, founded the Bujinkan organization and held the Togakure-ryu grandmastership as its 34th soke — the line through which much modern ninjutsu teaching descends. Source: established martial-arts record — Bujinkan / Togakure-ryu.",
    "Established martial-arts record — Bujinkan, Masaaki Hatsumi",
  ),
  q(
    "nin-vs-samurai",
    "ninjutsu",
    "How did shinobi methods stand in relation to the samurai code?",
    [
      "They were the same code under two names",
      "They were a separate, pragmatic trade — deception and concealment the samurai code disdained",
      "Shinobi were simply samurai of higher rank",
      "The samurai invented ninjutsu as their official manual",
    ],
    1,
    "Samurai honor culture prized open battle; shinobi work — spying, disguise, deception — ran against that code, which is exactly why it existed as a separate hired specialty. Source: established Japanese history.",
    "Established Japanese history — shinobi and samurai",
  ),

  /* --------------------------------- Bushido ------------------------------- */
  q(
    "bush-nitobe",
    "bushido",
    "Who wrote “Bushido: The Soul of Japan” (1899), the book that carried the samurai code to the world?",
    [
      "Yamamoto Tsunetomo",
      "Nitobe Inazo",
      "Miyamoto Musashi",
      "Takeda Shingen",
    ],
    1,
    "Nitobe Inazo wrote “Bushido: The Soul of Japan” in English in 1899, presenting the samurai's unwritten code to a world audience. Source: Nitobe Inazo, “Bushido: The Soul of Japan” (1899).",
    "Nitobe Inazo, “Bushido: The Soul of Japan” (1899)",
  ),
  q(
    "bush-meaning",
    "bushido",
    "What does “Bushido” literally mean?",
    [
      "“The way of the sword”",
      "“The way of the warrior”",
      "“The art of death”",
      "“The path of honor”",
    ],
    1,
    "Bushido (武士道) reads “the way of the warrior” — bushi, warrior; do, the way or path. Source: established Japanese language and history.",
    "Established Japanese language — 武士道",
  ),
  q(
    "bush-hagakure",
    "bushido",
    "The “Hagakure,” a foundational text on the samurai way, records the sayings of which retainer?",
    [
      "Yamamoto Tsunetomo",
      "Oda Nobunaga",
      "Saigo Takamori",
      "Minamoto no Yoritomo",
    ],
    0,
    "The Hagakure (compiled 1709–1716) records the sayings of Yamamoto Tsunetomo, a retainer of the Nabeshima clan — including its famous opening teaching that the way of the samurai is found in death: readiness that frees a man from fear. Source: Hagakure, Yamamoto Tsunetomo (early 1700s).",
    "Hagakure — Yamamoto Tsunetomo (compiled 1709–1716)",
  ),
  q(
    "bush-virtues",
    "bushido",
    "In Nitobe's account, which of these is one of Bushido's seven virtues?",
    [
      "Wealth",
      "Benevolence (Jin)",
      "Fame",
      "Obedience to any order without question",
    ],
    1,
    "Nitobe's seven virtues: Rectitude (Gi), Courage (Yu), Benevolence (Jin), Respect (Rei), Honesty (Makoto), Honor (Meiyo), and Loyalty (Chugi). Benevolence — mercy and compassion from a position of strength — stands among them. Source: Nitobe Inazo, “Bushido: The Soul of Japan” (1899).",
    "Nitobe Inazo, “Bushido: The Soul of Japan” (1899)",
  ),
  q(
    "bush-seppuku",
    "bushido",
    "What was seppuku in samurai culture?",
    [
      "A formal tea ceremony before battle",
      "Ritual suicide undertaken to restore honor or accept responsibility",
      "The ceremony of receiving a sword",
      "A code word for retreat",
    ],
    1,
    "Seppuku was the samurai's ritual suicide — performed to restore honor after disgrace, protest a wrong, or follow a lord in death. It stood at the severe end of a code in which honor outweighed life itself. Source: established Japanese history.",
    "Established Japanese history — seppuku",
  ),

  /* --------------------------------- Kung Fu ------------------------------- */
  q(
    "kf-meaning",
    "kung-fu",
    "What does the Chinese term “kung fu” (功夫) actually mean, at root?",
    [
      "A specific fighting style from the Shaolin Temple",
      "Skill attained through great effort over time — in any discipline",
      "The highest rank a student can hold",
      "A weapon made of bamboo",
    ],
    1,
    "功夫 (gongfu) means skill earned through sustained effort — a master cook or calligrapher has kung fu in their craft. In the West it became the umbrella name for Chinese martial arts. Source: established Chinese language usage.",
    "Established Chinese language — 功夫 (gongfu)",
  ),
  q(
    "kf-shaolin",
    "kung-fu",
    "The Shaolin Temple, legendary home of kung fu tradition, stands in which Chinese province?",
    [
      "Sichuan",
      "Henan",
      "Fujian",
      "Shandong",
    ],
    1,
    "The Shaolin Temple stands on Mount Song in Henan province, founded in 495 AD; its monks' martial tradition became the most famous name in Chinese martial arts. Source: established Chinese history — Shaolin Temple, Henan (founded 495 AD).",
    "Established Chinese history — Shaolin Temple, Henan",
  ),
  q(
    "kf-wing-chun",
    "kung-fu",
    "Wing Chun is best characterized as which kind of system?",
    [
      "A long-range kicking art",
      "A close-range system built on centerline control and economy of motion",
      "A grappling art fought entirely on the ground",
      "A weapons-only tradition",
    ],
    1,
    "Wing Chun fights close: it guards and attacks along the centerline, favors direct, economical movement, and trains sensitivity through chi sao (sticking hands). Yip Man taught it in Hong Kong — Bruce Lee was among his students. Source: established martial-arts knowledge — Wing Chun.",
    "Established martial-arts knowledge — Wing Chun / Yip Man",
  ),
  q(
    "kf-wushu",
    "kung-fu",
    "What is modern “wushu”?",
    [
      "An ancient battlefield manual",
      "China's standardized contemporary sport form of its martial arts — forms (taolu) and sparring (sanda)",
      "A secret society of martial artists",
      "The original name of tai chi",
    ],
    1,
    "Wushu is the modern, standardized sport built from China's traditional arts in the 20th century: taolu (forms, judged on performance) and sanda (full-contact sparring). Traditional styles continue alongside it under their own lineages. Source: established martial-arts knowledge — wushu.",
    "Established martial-arts knowledge — modern wushu",
  ),
  q(
    "kf-tai-chi",
    "kung-fu",
    "Tai chi (taijiquan) is best described as what?",
    [
      "A purely medical exercise with no martial content",
      "An internal martial art — a real fighting system practiced slowly, also valued for health",
      "A dance form created for festivals",
      "A Japanese art imported to China",
    ],
    1,
    "Taijiquan is one of the internal (neijia) martial arts: its slow forms train structure, balance, and yielding force for actual combat, and the same practice is widely used for health. Slow in training does not mean soft in application. Source: established martial-arts knowledge — taijiquan.",
    "Established martial-arts knowledge — taijiquan",
  ),

  /* -------------------------------- Taekwondo ------------------------------ */
  q(
    "tkd-origin",
    "taekwondo",
    "Taekwondo comes from which country?",
    ["Japan", "China", "Korea", "Thailand"],
    2,
    "Taekwondo is Korea's martial art, named in 1955 and built from Korean traditions (including taekkyeon) and the karate many founders trained in during the Japanese occupation era. Source: established martial-arts history — taekwondo, Korea.",
    "Established martial-arts history — taekwondo, Korea",
  ),
  q(
    "tkd-name",
    "taekwondo",
    "What do the parts of the name “taekwondo” mean?",
    [
      "Tae = hand, kwon = foot, do = spirit",
      "Tae = foot/leg, kwon = fist/hand, do = the way",
      "Tae = fast, kwon = strong, do = school",
      "Tae = kick, kwon = block, do = belt",
    ],
    1,
    "Tae (跆) is the foot/leg, kwon (拳) the fist/hand, do (道) the way — “the way of the foot and the fist.” Source: established Korean language and taekwondo record.",
    "Established Korean language — 跆拳道",
  ),
  q(
    "tkd-olympics",
    "taekwondo",
    "When did taekwondo become a full Olympic medal sport?",
    [
      "Seoul 1988",
      "Sydney 2000",
      "Tokyo 2020",
      "It has never been an Olympic sport",
    ],
    1,
    "Taekwondo appeared as a demonstration sport at Seoul 1988 and Barcelona 1992, and became a full medal sport at the Sydney 2000 Olympics. Source: established Olympic record.",
    "Established Olympic record — taekwondo, Sydney 2000",
  ),
  q(
    "tkd-emphasis",
    "taekwondo",
    "Taekwondo is especially known for its emphasis on what?",
    [
      "Ground grappling and submissions",
      "High, fast, and spinning kicks",
      "Weapons forms",
      "Joint locks and throws",
    ],
    1,
    "Taekwondo's signature is its kicking — head-height, jumping, and spinning kicks developed to a level beyond most arts, with the legs treated as the longest and strongest weapons. Source: established martial-arts knowledge — taekwondo.",
    "Established martial-arts knowledge — taekwondo",
  ),
  q(
    "tkd-orgs",
    "taekwondo",
    "The two historic world bodies for taekwondo are the ITF (founded 1966) and which other, founded 1973?",
    ["The WTF, today World Taekwondo (WT)", "The Kodokan", "The IBF", "The Shaolin Federation"],
    0,
    "Choi Hong-hi founded the International Taekwon-do Federation (ITF) in 1966; the World Taekwondo Federation followed in 1973 (today simply World Taekwondo, WT) and carries the Olympic style. Source: established taekwondo record.",
    "Established taekwondo record — ITF (1966), WT (1973)",
  ),

  /* ----------------------------------- Law --------------------------------- */
  q(
    "law-miranda",
    "law",
    "The Miranda warning — “you have the right to remain silent…” — comes from which Supreme Court case?",
    [
      "Terry v. Ohio (1968)",
      "Miranda v. Arizona (1966)",
      "Brown v. Board of Education (1954)",
      "Gideon v. Wainwright (1963)",
    ],
    1,
    "Miranda v. Arizona (1966) held that a person in custody must be informed of their rights — to remain silent, and to an attorney — before interrogation, or their statements may be excluded. Source: Miranda v. Arizona, 384 U.S. 436 (1966).",
    "Miranda v. Arizona, 384 U.S. 436 (1966)",
  ),
  q(
    "law-fourth",
    "law",
    "The Fourth Amendment to the U.S. Constitution protects against what?",
    [
      "Cruel and unusual punishment",
      "Unreasonable searches and seizures",
      "Self-incrimination",
      "Double jeopardy",
    ],
    1,
    "The Fourth Amendment guards against unreasonable searches and seizures and generally requires warrants based on probable cause. Self-incrimination is the Fifth; cruel and unusual punishment is the Eighth. Source: U.S. Constitution, Amendment IV.",
    "U.S. Constitution, Amendment IV",
  ),
  q(
    "law-burden",
    "law",
    "In a U.S. criminal trial, what standard of proof must the prosecution meet?",
    [
      "Preponderance of the evidence",
      "Clear and convincing evidence",
      "Beyond a reasonable doubt",
      "Probable cause",
    ],
    2,
    "Criminal conviction requires proof beyond a reasonable doubt — the highest standard in the law. Preponderance of the evidence is the ordinary civil standard. Source: established U.S. law (In re Winship, 397 U.S. 358 (1970)).",
    "Established U.S. law — In re Winship (1970)",
  ),
  q(
    "law-terry",
    "law",
    "Under Terry v. Ohio (1968), when may an officer briefly stop and frisk a person?",
    [
      "On any hunch, at any time",
      "On reasonable suspicion of criminal activity — and, for the frisk, reason to believe the person is armed",
      "Only after making an arrest",
      "Only with a signed warrant",
    ],
    1,
    "Terry v. Ohio (1968): a brief investigative stop needs reasonable suspicion — specific facts, more than a hunch, less than probable cause — and a frisk needs reason to believe the person is armed and dangerous. Source: Terry v. Ohio, 392 U.S. 1 (1968).",
    "Terry v. Ohio, 392 U.S. 1 (1968)",
  ),
  q(
    "law-alabama-consent",
    "law",
    "Alabama's recording law is best described how?",
    [
      "All-party consent — everyone recorded must agree",
      "One-party consent — one party to the conversation may record it",
      "Recording any conversation is always illegal",
      "Recording is legal only for police",
    ],
    1,
    "Alabama is a one-party consent state: a person who is a party to a conversation may record it without the other parties' consent (interception by a non-party is a different matter). Source: Ala. Code § 13A-11-31 and Alabama's one-party consent standing.",
    "Ala. Code § 13A-11-31 — Alabama one-party consent",
  ),
  q(
    "law-fifth",
    "law",
    "The Fifth Amendment's protection against self-incrimination means what?",
    [
      "A defendant can be forced to testify against himself",
      "No person can be compelled to be a witness against himself in a criminal case",
      "Witnesses may never be questioned in court",
      "A person may not remain silent during a police interview before arrest",
    ],
    1,
    "The Fifth Amendment provides that no person “shall be compelled in any criminal case to be a witness against himself” — the root of the right to remain silent. Source: U.S. Constitution, Amendment V.",
    "U.S. Constitution, Amendment V",
  ),

  /* ------------------------------ The Art of War ---------------------------- */
  q(
    "aow-deception",
    "art-of-war",
    "Sun Tzu, Chapter I: “All warfare is based on…” what?",
    ["Superior numbers", "Deception", "Speed", "Terrain"],
    1,
    "Chapter I of the Giles translation: “All warfare is based on deception.” Source: Sun Tzu, “The Art of War,” Chapter I (Giles translation, 1910) — the text on your Art of War shelf.",
    "Sun Tzu, “The Art of War,” Ch. I (Giles, 1910)",
  ),
  q(
    "aow-five-factors",
    "art-of-war",
    "Which of these is one of the five constant factors in Chapter I of The Art of War?",
    ["The Moral Law", "The size of the treasury", "The age of the general", "The number of horses"],
    0,
    "The five constant factors (Chapter I): the Moral Law, Heaven, Earth, the Commander, and Method and discipline. Source: Sun Tzu, “The Art of War,” Chapter I (Giles translation, 1910).",
    "Sun Tzu, “The Art of War,” Ch. I (Giles, 1910)",
  ),
  q(
    "aow-supreme",
    "art-of-war",
    "In Chapter III, what is “supreme excellence”?",
    [
      "Winning one hundred battles in a row",
      "Breaking the enemy's resistance without fighting",
      "Taking the enemy's capital city",
      "Never retreating under any circumstances",
    ],
    1,
    "Chapter III: “to fight and conquer in all your battles is not supreme excellence; supreme excellence consists in breaking the enemy's resistance without fighting.” Source: Sun Tzu, “The Art of War,” Chapter III (Giles translation, 1910).",
    "Sun Tzu, “The Art of War,” Ch. III (Giles, 1910)",
  ),
  q(
    "aow-know",
    "art-of-war",
    "Complete the saying from Chapter III: “If you know the enemy and know yourself…”",
    [
      "“…you will never need an army.”",
      "“…you need not fear the result of a hundred battles.”",
      "“…victory is guaranteed in every battle.”",
      "“…you should attack at once.”",
    ],
    1,
    "Chapter III: “If you know the enemy and know yourself, you need not fear the result of a hundred battles.” The same passage warns that knowing only one of the two trades victories for defeats. Source: Sun Tzu, “The Art of War,” Chapter III (Giles translation, 1910).",
    "Sun Tzu, “The Art of War,” Ch. III (Giles, 1910)",
  ),
  q(
    "aow-terrain",
    "art-of-war",
    "How many kinds of terrain does Chapter X distinguish?",
    ["Three", "Five", "Six", "Nine"],
    2,
    "Chapter X names six kinds of terrain: accessible, entangling, temporizing, narrow passes, precipitous heights, and positions at a great distance from the enemy. (The nine situations of Chapter XI are varieties of ground in a different sense.) Source: Sun Tzu, “The Art of War,” Chapter X (Giles translation, 1910).",
    "Sun Tzu, “The Art of War,” Ch. X (Giles, 1910)",
  ),
  q(
    "aow-spies",
    "art-of-war",
    "Chapter XIII, “The Use of Spies,” names how many classes of spy?",
    ["Two", "Three", "Five", "Seven"],
    2,
    "Five classes: local spies, inward spies, converted spies, doomed spies, and surviving spies. Source: Sun Tzu, “The Art of War,” Chapter XIII (Giles translation, 1910).",
    "Sun Tzu, “The Art of War,” Ch. XIII (Giles, 1910)",
  ),

  /* --------------------------------- Anatomy ------------------------------- */
  q(
    "ana-bones",
    "anatomy",
    "How many bones does a typical adult human skeleton have?",
    ["106", "206", "306", "412"],
    1,
    "An adult human has 206 bones. Babies are born with around 300, many of which fuse together as the skeleton matures. Source: established human anatomy.",
    "Established human anatomy — adult skeleton, 206 bones",
  ),
  q(
    "ana-skin",
    "anatomy",
    "What is the largest organ of the human body?",
    ["The liver", "The heart", "The skin", "The lungs"],
    2,
    "The skin is the body's largest organ — it covers the whole surface, regulates temperature, and is the first barrier against infection. The liver is the largest internal organ. Source: established human anatomy.",
    "Established human anatomy — the skin",
  ),
  q(
    "ana-heart",
    "anatomy",
    "How many chambers does the human heart have, and what are the upper two called?",
    [
      "Two chambers; the upper are ventricles",
      "Four chambers; the upper two are atria",
      "Three chambers; the upper are valves",
      "Four chambers; the upper two are ventricles",
    ],
    1,
    "The heart has four chambers: two upper atria that receive blood and two lower ventricles that pump it out. Source: established human anatomy — the heart.",
    "Established human anatomy — the heart",
  ),
  q(
    "ana-femur",
    "anatomy",
    "Which bone is the longest and strongest in the human body?",
    ["The humerus", "The tibia", "The femur (thigh bone)", "The radius"],
    2,
    "The femur — the thigh bone — is the longest and strongest bone in the body, built to carry the body's weight in standing and motion. Source: established human anatomy.",
    "Established human anatomy — the femur",
  ),
  q(
    "ana-muscle",
    "anatomy",
    "Which is the largest muscle in the human body?",
    ["The biceps brachii", "The gluteus maximus", "The deltoid", "The pectoralis major"],
    1,
    "The gluteus maximus is the largest muscle in the body — it keeps the trunk upright and drives climbing, running, and rising from a chair. Source: established human anatomy.",
    "Established human anatomy — gluteus maximus",
  ),
  q(
    "ana-liver",
    "anatomy",
    "Which is the largest INTERNAL organ of the human body?",
    ["The stomach", "The brain", "The liver", "The spleen"],
    2,
    "The liver is the largest internal organ — it filters blood, produces bile, stores energy, and processes much of what the body takes in. (The skin is larger still, but it is the body's outer organ.) Source: established human anatomy.",
    "Established human anatomy — the liver",
  ),

  /* --------------------------------- Health -------------------------------- */
  q(
    "hea-heart-rate",
    "health",
    "What is the standard normal resting heart rate range for adults?",
    ["30–50 beats per minute", "60–100 beats per minute", "110–140 beats per minute", "It has no normal range"],
    1,
    "A normal resting heart rate for adults is 60 to 100 beats per minute; trained athletes commonly rest lower, in the 40s–50s, because the heart pumps more per beat. Source: established clinical reference ranges (American Heart Association).",
    "Established clinical reference — American Heart Association",
  ),
  q(
    "hea-cpr",
    "health",
    "At what rate should chest compressions be given in adult CPR?",
    ["60 per minute", "80 per minute", "100–120 per minute", "As fast as possible, at least 160"],
    2,
    "The American Heart Association's guidelines set adult CPR compressions at 100 to 120 per minute, hard and fast in the center of the chest, allowing full recoil. Source: American Heart Association CPR guidelines.",
    "American Heart Association — CPR guidelines",
  ),
  q(
    "hea-sleep",
    "health",
    "How much sleep do health authorities recommend for adults?",
    ["4–5 hours", "At least 7 hours", "Exactly 6 hours", "Sleep need is the same at every age"],
    1,
    "The CDC, following the American Academy of Sleep Medicine, recommends adults get at least 7 hours of sleep per night; regularly getting less is associated with measurable harm to health and cognition. Source: CDC / American Academy of Sleep Medicine recommendation.",
    "CDC / American Academy of Sleep Medicine — adult sleep recommendation",
  ),
  q(
    "hea-bp",
    "health",
    "Under the ACC/AHA categories, a blood pressure reading below which level is “normal”?",
    ["Below 140/90", "Below 130/85", "Below 120/80", "Below 110/70"],
    2,
    "The 2017 ACC/AHA guideline defines normal blood pressure as below 120/80 mm Hg; 120–129 with diastolic below 80 is “elevated,” and 130/80 and above begins stage 1 hypertension. Source: ACC/AHA blood pressure guideline (2017).",
    "ACC/AHA Guideline for High Blood Pressure (2017)",
  ),
  q(
    "hea-temperature",
    "health",
    "Average normal human body temperature is approximately what?",
    ["35.0°C (95.0°F)", "37.0°C (98.6°F)", "38.5°C (101.3°F)", "40.0°C (104.0°F)"],
    1,
    "Average normal body temperature is about 37.0°C (98.6°F), with a healthy range around it — roughly 36.1–37.2°C (97–99°F) depending on the person and the hour. Source: established clinical reference.",
    "Established clinical reference — body temperature",
  ),
  q(
    "hea-handwash",
    "health",
    "Per CDC guidance, how long should you scrub your hands with soap when handwashing?",
    ["5 seconds", "At least 20 seconds", "2 minutes", "Scrubbing time does not matter"],
    1,
    "The CDC's handwashing guidance: wet, lather, and scrub for at least 20 seconds before rinsing — the scrubbing, with soap, is what lifts and removes the germs. Source: CDC handwashing guidance.",
    "CDC — handwashing guidance",
  ),

  /* ------------------------- Medicine & Surgery ---------------------------- */
  q(
    "med-jenner",
    "medicine",
    "Edward Jenner's 1796 experiment founded which medical practice?",
    [
      "Blood transfusion",
      "Vaccination — using cowpox to protect against smallpox",
      "Antiseptic surgery",
      "X-ray imaging",
    ],
    1,
    "In 1796 Jenner inoculated James Phipps with cowpox and showed it protected him against smallpox — the founding act of vaccination (vacca is Latin for cow). Source: established medical history — Jenner, 1796.",
    "Established medical history — Edward Jenner, 1796",
  ),
  q(
    "med-fleming",
    "medicine",
    "What did Alexander Fleming discover in 1928?",
    [
      "Insulin",
      "Penicillin — a mold that kills bacteria",
      "The DNA double helix",
      "Ether anesthesia",
    ],
    1,
    "Fleming noticed a Penicillium mold contaminating his culture plates was killing the bacteria around it — the discovery of penicillin, the first widely used antibiotic. Florey and Chain's team later made it a usable drug. Source: established medical history — Fleming, 1928.",
    "Established medical history — Alexander Fleming, 1928",
  ),
  q(
    "med-lister",
    "medicine",
    "Joseph Lister's contribution to surgery was what?",
    [
      "The first heart transplant",
      "Antiseptic technique — using carbolic acid to kill germs in wounds and the operating field",
      "The invention of the scalpel",
      "Blood typing for transfusion",
    ],
    1,
    "Lister (1860s) applied Pasteur's germ theory to surgery, using carbolic acid as an antiseptic — surgical deaths from infection fell dramatically, and aseptic technique descends from his work. Source: established medical history — Joseph Lister.",
    "Established medical history — Joseph Lister, antiseptic surgery",
  ),
  q(
    "med-ether",
    "medicine",
    "The first successful public demonstration of ether anesthesia took place in which year?",
    ["1796", "1846", "1901", "1928"],
    1,
    "On October 16, 1846, William T. G. Morton demonstrated ether anesthesia at Massachusetts General Hospital — surgery without the patient's agony became possible, and the date is still marked as Ether Day. Source: established medical history — Morton, 1846.",
    "Established medical history — ether demonstration, 1846",
  ),
  q(
    "med-triage",
    "medicine",
    "In emergency medicine, what is triage?",
    [
      "A three-dose course of antibiotics",
      "Sorting patients by urgency so the most critical are treated first",
      "The final check before a patient is discharged",
      "A surgical technique using three incisions",
    ],
    1,
    "Triage (from the French trier, to sort) is the sorting of patients by the urgency of their condition — in mass-casualty and emergency care, the sickest salvageable patients go first. Source: established emergency-medicine practice.",
    "Established emergency medicine — triage",
  ),
  q(
    "med-hippocrates",
    "medicine",
    "The Hippocratic Oath, the historic ethical oath of physicians, is named for whom?",
    [
      "Galen of Pergamon",
      "Hippocrates, the Greek physician of the 5th–4th century BC",
      "Andreas Vesalius",
      "William Osler",
    ],
    1,
    "The oath bears the name of Hippocrates of Kos, the Greek physician whose school separated medicine from superstition and grounded it in observation; versions of the oath are still sworn by physicians today. Source: established medical history — Hippocratic tradition.",
    "Established medical history — Hippocrates",
  ),

  /* ---------------------------- General Science ---------------------------- */
  q(
    "sci-light",
    "science",
    "The speed of light in a vacuum is approximately what?",
    ["300 km per second", "3,000 km per second", "300,000 km per second", "30,000,000 km per second"],
    2,
    "Light in a vacuum travels at 299,792,458 meters per second — about 300,000 kilometers per second. It is the universe's speed limit for information and matter. Source: established physics (exact defined value, SI).",
    "Established physics — speed of light (SI defined value)",
  ),
  q(
    "sci-gold",
    "science",
    "What is the chemical symbol for gold?",
    ["Go", "Gd", "Au", "Ag"],
    2,
    "Gold's symbol is Au, from the Latin aurum. (Ag is silver, from argentum.) Source: established chemistry — the periodic table.",
    "Established chemistry — periodic table",
  ),
  q(
    "sci-table",
    "science",
    "The periodic table arranges the elements primarily in order of what?",
    ["Alphabetical order", "Atomic number — the number of protons", "Atomic weight alone", "Date of discovery"],
    1,
    "Elements are ordered by atomic number — the count of protons in the nucleus — and the table's rows (periods) and columns (groups) then display repeating chemical behavior. Source: established chemistry — the periodic table.",
    "Established chemistry — periodic table",
  ),
  q(
    "sci-dna",
    "science",
    "Who published the double-helix structure of DNA in 1953?",
    [
      "Charles Darwin and Alfred Wallace",
      "James Watson and Francis Crick",
      "Louis Pasteur and Robert Koch",
      "Gregor Mendel and Thomas Hunt Morgan",
    ],
    1,
    "Watson and Crick published the double-helix model in “Nature” in 1953, building on Rosalind Franklin's X-ray diffraction data — her Photo 51 was key evidence for the helix. Source: established history of science — Watson & Crick, “Nature” (1953).",
    "Established history of science — Watson & Crick, “Nature” (1953)",
  ),
  q(
    "sci-photosynthesis",
    "science",
    "Photosynthesis is the process by which plants do what?",
    [
      "Convert sunlight, water, and carbon dioxide into oxygen and stored energy (sugars)",
      "Convert oxygen into carbon dioxide for growth",
      "Absorb nitrogen directly from the air through their leaves",
      "Turn soil minerals into water",
    ],
    0,
    "Photosynthesis: green plants use sunlight to turn water and carbon dioxide into sugars (stored energy) and release oxygen — the process nearly all life on Earth ultimately runs on. Source: established biology.",
    "Established biology — photosynthesis",
  ),
  q(
    "sci-gravity",
    "science",
    "The acceleration due to gravity at Earth's surface is approximately what?",
    ["1.6 m/s²", "9.8 m/s²", "24.8 m/s²", "0.98 m/s²"],
    1,
    "Earth's surface gravity accelerates falling objects at about 9.8 meters per second squared. (1.6 is the Moon; 24.8 is Jupiter.) Source: established physics.",
    "Established physics — Earth's gravity, ≈9.8 m/s²",
  ),
];

/** The questions that can be drawn — retired items never are. */
export const ACTIVE_QUESTIONS: readonly BankQuestion[] = QUESTION_BANK.filter((q) => !q.retired);

/**
 * The POC bar, enforced in code: every ACTIVE item must carry
 * exactly 4 distinct choices, a valid answer index, a named
 * source, and a "confirmed as of" date — or the bank does not
 * validate and the training window says so instead of running.
 */
export function validateBank(bank: readonly BankQuestion[] = QUESTION_BANK): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const item of bank) {
    if (seen.has(item.id)) problems.push(`duplicate id ${item.id}`);
    seen.add(item.id);
    if (item.retired) continue; // retired items stand as history, not as questions
    if (!item.question.trim()) problems.push(`${item.id}: empty question`);
    if (item.choices.length !== 4) problems.push(`${item.id}: must carry exactly 4 choices`);
    if (new Set(item.choices).size !== item.choices.length) problems.push(`${item.id}: choices must be distinct`);
    if (item.answerIndex < 0 || item.answerIndex > 3) problems.push(`${item.id}: answerIndex out of range`);
    if (!item.choices[item.answerIndex]?.trim()) problems.push(`${item.id}: answer choice is empty`);
    if (!item.source.trim()) problems.push(`${item.id}: POC — a source is required`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.confirmedAsOf)) problems.push(`${item.id}: POC — a confirmed-as-of date is required`);
    if (!item.explanation.trim()) problems.push(`${item.id}: an explanation is required`);
  }
  return problems;
}

export function questionById(id: string): BankQuestion | undefined {
  return QUESTION_BANK.find((q) => q.id === id);
}
