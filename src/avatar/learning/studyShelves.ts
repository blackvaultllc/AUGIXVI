/**
 * THE STUDY SHELVES — Psychology and Dark Psychology
 * (owner order 2026-11-26: added to HIS learning section,
 * beside the cybersecurity game and The Art of War).
 *
 * TRUTH DISCIPLINE: every note states an established,
 * attributable concept and names whose it is — the author,
 * the work, the experiment. Nothing here is an invented
 * quotation and no citation is fabricated. Where a finding
 * has a known limit, the note says so.
 *
 * Dark Psychology is framed the way he means it: know how
 * manipulation and persuasion work so you can RECOGNIZE
 * them and defend against them. Recognition first, defense
 * always — the notes teach the tell and the counter.
 */

export interface StudyNote {
  title: string;
  /** The concept, in plain words. */
  body: string;
  /** Whose concept it is — author / work / experiment. */
  source: string;
}

export interface StudyShelf {
  id: string;
  title: string;
  intro: string;
  notes: readonly StudyNote[];
}

export const PSYCHOLOGY_SHELF: StudyShelf = {
  id: "psychology",
  title: "Psychology",
  intro:
    "How the mind actually works — the established findings, each with the name of the person who stood behind it. Study notes, plain words.",
  notes: [
    {
      title: "Two systems of thinking",
      body: "The mind runs two modes. System 1 is fast, automatic, and effortless — it answers before you know you asked. System 2 is slow, deliberate, and lazy — it checks the work, but only when called on. Most errors of judgment happen when System 1 answers a hard question with an easy one and System 2 never wakes up to check it.",
      source: "Daniel Kahneman, “Thinking, Fast and Slow” (2011)",
    },
    {
      title: "Classical conditioning",
      body: "Pair a neutral signal with something that already triggers a response, repeat it, and the signal alone starts triggering the response. Pavlov's dogs salivated at a bell because the bell had come to mean food. The same wiring is why a place, a song, or a tone of voice can move you before you have thought anything at all.",
      source: "Ivan Pavlov, experiments on conditioned reflexes (published 1900s–1927)",
    },
    {
      title: "Operant conditioning",
      body: "Behavior is shaped by what follows it. Actions followed by reward get repeated; actions followed by punishment get avoided. The schedule matters as much as the reward: a payoff that comes at unpredictable intervals produces the most persistent behavior of all — the principle every slot machine and endless feed is built on.",
      source: "B. F. Skinner, operant conditioning research (1930s onward)",
    },
    {
      title: "Cognitive dissonance",
      body: "When a person's actions and beliefs contradict each other, the mind feels real discomfort — and usually resolves it by changing the belief, not the behavior. Knowing this explains why people defend a bad decision hardest right after making it, and why getting someone to take one small step changes what they believe more than any argument.",
      source: "Leon Festinger, “A Theory of Cognitive Dissonance” (1957)",
    },
    {
      title: "The forgetting curve — and how to beat it",
      body: "Memory of new material decays fastest in the first hours and days, then levels off. Ebbinghaus measured it on himself in 1885. The counter is spaced repetition: review at widening intervals and each review flattens the curve. This is why your Daily Training brings your weak subjects back around — the schedule is the science.",
      source: "Hermann Ebbinghaus, “Memory: A Contribution to Experimental Psychology” (1885)",
    },
    {
      title: "The Dunning–Kruger effect",
      body: "People with low skill in a subject tend to overestimate their ability at it, because the skill needed to do the work is the same skill needed to judge the work. Genuine experts, knowing how much there is, rate themselves more carefully. The practical use runs both ways: discount loud certainty, and let your own confidence be earned by testing, not by feeling.",
      source: "Justin Kruger & David Dunning, “Unskilled and Unaware of It” (1999)",
    },
    {
      title: "Maslow's hierarchy of needs",
      body: "Human motivation stacks like a pyramid: survival needs first (food, safety), then belonging and esteem, and only then self-actualization — becoming what you can be. A man fighting for the bottom of the pyramid cannot be reached by arguments aimed at the top. Read any room, any negotiation, any hard season of your own life by asking which level is actually in play.",
      source: "Abraham Maslow, “A Theory of Human Motivation” (1943)",
    },
    {
      title: "Confirmation bias",
      body: "The mind searches for, favors, and remembers evidence that agrees with what it already believes — and skims past the rest. It is not a character flaw; it is the default setting, in scientists and soldiers alike. The discipline against it is deliberate: ask what would prove you wrong, and go look at exactly that.",
      source: "Established in cognitive psychology research; reviewed by Raymond Nickerson (1998)",
    },
  ],
};

export const DARK_PSYCHOLOGY_SHELF: StudyShelf = {
  id: "dark-psychology",
  title: "Dark Psychology",
  intro:
    "How manipulation and persuasion actually work — studied so you can recognize them on sight and defend against them. Every tactic here is named, attributed, and paired with its tell. Recognition first. Defense always.",
  notes: [
    {
      title: "Reciprocity — the favor that is a hook",
      body: "People feel obliged to return what they are given — even something they never asked for. The manipulator's version: an unsolicited favor, gift, or concession, given precisely so you will feel the debt. THE TELL: generosity that arrives fast, early, and with an audience for the ask that follows. THE COUNTER: a gift you did not agree to creates no contract. You may accept the thing and decline the debt.",
      source: "Robert B. Cialdini, “Influence: The Psychology of Persuasion” (1984)",
    },
    {
      title: "Social proof — the crowd that may not exist",
      body: "Under uncertainty, people decide what is right by watching what others do. Manipulators manufacture the crowd: fake testimonials, bought followers, a room where everyone has already agreed. THE TELL: pressure that points sideways — “everybody is doing it” — instead of at reasons. THE COUNTER: ask what the evidence is when nobody is watching, and notice that real crowds do not need to announce themselves.",
      source: "Robert B. Cialdini, “Influence” (1984)",
    },
    {
      title: "Authority — the uniform is not the argument",
      body: "In Milgram's 1963 experiments, 26 of 40 ordinary participants (65%) obeyed an authority figure's instructions all the way to what they believed was a 450-volt shock to a stranger. Titles, uniforms, and confident tones switch off judgment in most people. THE TELL: “because I said so” dressed in credentials, and urgency that forbids checking. THE COUNTER: authority can be questioned; a real expert welcomes the question.",
      source: "Stanley Milgram, obedience experiments, Yale University (1963)",
    },
    {
      title: "Scarcity — the closing door",
      body: "Things seem more valuable when they seem rare or about to vanish, so manipulators manufacture deadlines and limited quantities. THE TELL: the offer cannot survive you sleeping on it. THE COUNTER: anything true today is usually true tomorrow; walk away and watch whether the scarcity was real.",
      source: "Robert B. Cialdini, “Influence” (1984)",
    },
    {
      title: "Gaslighting — an attack on your memory itself",
      body: "Named for Patrick Hamilton's 1938 play “Gas Light,” in which a husband dims the gas lamps and denies they changed, to make his wife doubt her own senses. The tactic: deny what happened, contradict your memory, and present your doubt as proof you are unstable. THE TELL: you leave conversations doubting records you were sure of. THE COUNTER: write things down, keep the record, and check the fact with a second source — your own doctrine: fact first, then concurrence.",
      source: "Patrick Hamilton, “Gas Light” (1938); term established in clinical and popular use since",
    },
    {
      title: "Love bombing — affection as a lever",
      body: "An early flood of praise, attention, and devotion, far beyond what the relationship has earned, used to create obligation and dependence fast — and withdrawn later as punishment. THE TELL: intensity that outruns time, and affection that turns cold the first time you say no. THE COUNTER: real regard can survive a boundary; a lever cannot.",
      source: "Term from clinical literature on coercive control (1970s onward)",
    },
    {
      title: "DARVO — the reversal",
      body: "When confronted, the manipulator Denies, Attacks the confronter, and Reverses Victim and Offender — by the end, the person who raised the harm is defending themselves. THE TELL: the subject changes from what they did to what is wrong with you, within one breath. THE COUNTER: name the pattern, return to the original fact, and do not accept the new trial they have opened against you.",
      source: "Jennifer J. Freyd, who named the pattern (1997)",
    },
    {
      title: "The dark triad — know the three faces",
      body: "Psychology's name for three overlapping traits: narcissism (grandiosity, hunger for admiration), Machiavellianism (cold, strategic manipulation — named for Machiavelli's “The Prince,” 1532), and psychopathy (callousness, impulsivity, no remorse). Most manipulators you will ever meet are not clinical cases — but the traits in small doses are exactly the toolkit on this shelf. THE COUNTER is the whole shelf: slow down, check the record, watch what they do when they hear “no.”",
      source: "Delroy L. Paulhus & Kevin M. Williams, “The Dark Triad of Personality” (2002)",
    },
  ],
};

export const STUDY_SHELVES: readonly StudyShelf[] = [PSYCHOLOGY_SHELF, DARK_PSYCHOLOGY_SHELF];
