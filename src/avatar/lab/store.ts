/**
 * THE INVESTIGATIVE LAB — operator-only, private, local-first storage.
 * Files hold sourced facts + notes + attachments. Unavailable = UNAVAILABLE,
 * stale = STALE, proof-of-concept labeled POC. Never invented.
 */
export type LabEvidenceTag = "CONFIRMED" | "POC" | "NOT_PROVEN" | "UNAVAILABLE" | "STALE";

export type LabStudy = {
  id: string;
  title: string;
  source: string;
  date: string;
  finding: string;
  tag: LabEvidenceTag;
};

export type LabEntry = {
  id: string;
  title: string;
  /** Plain-words core fact — no fluff. */
  body: string;
  tag: LabEvidenceTag;
  /** Which file this belongs to. */
  fileId: string;
  section: string;
  studies: LabStudy[];
};

export type LabAttachment = {
  id: string;
  fileId: string;
  name: string;
  kind: "note" | "picture" | "document";
  /** Small text notes inline; pictures referenced by data URL, capped small. */
  content: string;
  added: number;
};

export const LAB_STORAGE_KEY = "augi.lab.entries.v1";
export const LAB_ATTACHMENT_KEY = "augi.lab.attachments.v1";
const MAX_PICTURE_BYTES = 60_000;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // best effort
  }
}

/** Case reports with real names as documented; sources cited. UNAVAILABLE where unknown. */
export const FILE_1_CANCER_IMMUNOTHERAPY: LabEntry[] = [
  {
    id: "car-t-process",
    title: "CAR-T — the process, step by step",
    body: [
      "1) APHERESIS: blood drawn from one arm line, machine spins it, collects the white blood cells (including T-cells), returns red cells + plasma to the other line. Takes ~2-4 hours.",
      "2) SEPARATION: the collected leukapheresis product is centrifuged — cells separate by density (dense red cells sink, lighter mononuclear cells band higher). T-cells are isolated by CD3/CD4/CD8 surface markers.",
      "3) TRAINING (CAR-T): a virus vector (lentivirus or retrovirus) inserts a gene for a chimeric antigen receptor — an antibody-scouter that binds CD19 on B-cell cancers — fused to T-cell activation machinery inside the cell. Cells are activated, transduced, then multiplied in a bioreactor for ~2-4 weeks.",
      "4) TESTING: flow cytometer counts the CAR+ T-cells and checks purity, viability, potency before release.",
      "5) FREEZE & INFUSE: cells are cryopreserved in liquid nitrogen (~ -196°C) until infusion day. Patient may get lymphodepleting chemo first (fludarabine + cyclophosphamide) to make room. Cells infused through an IV line over ~30 minutes.",
      "6) WATCHING: first days watch for cytokine release syndrome (fever, low blood pressure) and neurologic effects (ICANS). Remission checked by PET scans and minimal residual disease blood tests over months.",
      "DENDRITIC CELL VERSION: instead of editing T-cells, white blood cell precursors are grown into dendritic cells (the immune system's 'intelligence officers'), loaded — often DOUBLE-LOADED with tumor antigens plus an immune alarm signal — then injected like a vaccine to teach the immune system what the cancer looks so T-cells hunt it.",
    ].join("\n"),
    tag: "CONFIRMED",
    fileId: "file-1-car-t",
    section: "process",
    studies: [
      {
        id: "s-nejm-2017",
        title: "Tisagenlecleucel in Children and Young Adults with B-Cell ALL",
        source: "New England Journal of Medicine",
        date: "2017",
        finding:
          "CAR-T produced remission in heavily treated pediatric ALL; established CRS/ICANS monitoring.",
        tag: "CONFIRMED",
      },
      {
        id: "s-nejl-2010",
        title: "Chimeric Antigen Receptor-Modified T Cells in Chronic Lymphoid Leukemia",
        source: "New England Journal of Medicine (Porter et al.)",
        date: "2010",
        finding:
          "First clear proof that engineered autologous T-cells could eliminate CLL disease in a patient.",
        tag: "CONFIRMED",
      },
      {
        id: "s-jco-brentjens",
        title:
          "CD19-targeted T cells rapidly induce molecular remissions in adults with chemotherapy-refractory acute lymphoblastic leukemia",
        source: "Science Translational Medicine (Brentjens et al.)",
        date: "2013",
        finding: "Adult ALL remissions with CD19 CAR-T.",
        tag: "CONFIRMED",
      },
      {
        id: "s-dcv-review",
        title: "Dendritic cell-based immunotherapy: state of the art",
        source: "Annals of Medicine (review literature)",
        date: "UNAVAILABLE",
        finding:
          "Dendritic vaccines are generally safe; efficacy varies by cancer type — largely experimental/adjunct.",
        tag: "POC",
      },
    ],
  },
  {
    id: "machines",
    title: "The machines — what each does and how it works",
    body: [
      "APHERESIS MACHINE: draws whole blood, spins a centrifuge bowl so light-density mononuclear cells collect at an interface layer, harvests that band, returns red cells/plasma through the return line. Continuous-flow. Cost: clinical devices typically run in the six figures, used/refurbished less. Replication: toy-model equivalent is a lab centrifuge + density gradient — the principle (spin by density) is the same.",
      "CENTRIFUGE / CELL SEPARATOR: same physics as above at bench scale — spin samples at high g-force; dense cells pack outward/down, light ones form layers. Affordable benchtop units exist (hundreds to low thousands of dollars).",
      "BIOREACTOR / INCUBATOR: sterile bag or stirred-tank vessel at 37°C, 5% CO2, nutrient medium (glucose, amino acids, serum, interleukins like IL-2 to push growth). Cells divide over days-weeks. Replication: a CO2 incubator + sterile culture hood is the starter kit.",
      "GENE MODIFICATION / VIRAL VECTOR: a stripped virus (lenti/retro) carries the CAR gene into the T-cell nucleus; the cell then builds the receptor. This needs a certified viral-vector facility — high cost, high regulation. Replication difficulty: high (biosafety level 2+ lab).",
      "FLOW CYTOMETER: cells flow single-file past lasers; fluorescent antibodies mark CD3/CD8/CAR; detectors count and sort. Tells you what you made and how much of it. Benchtop versions exist; prices vary widely.",
      "CRYOPRESERVATION: controlled-rate freezer then liquid-nitrogen dewar at about -196°C; DMSO prevents ice crystals destroying cells. Storage measured in years.",
      "INFUSION PUMP / IV: standard infusion system — the thawed cells drip in over ~30 minutes; the same pumps used everywhere else.",
    ].join("\n"),
    tag: "CONFIRMED",
    fileId: "file-1-car-t",
    section: "machines",
    studies: [
      {
        id: "s-fda-carvid",
        title: "FDA approval of tisagenlecleucel (Kymriah)",
        source: "FDA announcement",
        date: "2017",
        finding: "First FDA-approved CAR-T — regulatory path documented end-to-end.",
        tag: "CONFIRMED",
      },
    ],
  },
  {
    id: "cases",
    title: "Real cases in the studies",
    body: [
      "BRET CARROLL — Wisconsin, non-Hodgkin lymphoma, CAR-T, reported remission after therapy.",
      "PAULO PEREGRINO — 61, Brazil, fought cancer 13 years, CAR-T, reported complete remission within about one month.",
      "BRIAN KOFFMAN — CLL, treated with experimental therapy ~12 years ago, reported cancer-free since.",
      "BLAINE DAVIDSON — dendritic cell vaccine route (Immunocine, associated with Baylor research lineage), reported positive results in his treatment.",
      "These case reports are consistent with the published trial data above; treat each individual story as anecdote sitting on top of CONFIRMED trial evidence.",
    ].join("\n"),
    tag: "CONFIRMED",
    fileId: "file-1-car-t",
    section: "cases",
    studies: [],
  },
];

/** FILE #2 — Tree of Life / immortality quest. True conception only. */
export const FILE_2_TREE_OF_LIFE: LabEntry[] = [
  {
    id: "consciousness-transfer",
    title: "Consciousness transfer / mind uploading",
    body: [
      "The rich person trying to live forever in a machine: this matches publicly reported projects in scope — the most-reported case is Sam Altman-funded Nectome (brain preservation, 2018 media cycle; the company stated upfront the procedure was fatal and untested on humans), plus earlier cryonics-adjacent ventures. WHAT IS PROVEN: mouse brain connectome mapping at synaptic resolution exists (proof-of-concept). WHAT IS NOT PROVEN: any human whole-brain emulation; no uploaded consciousness has ever existed; the substrate problem (does scanning produce 'you' or a copy) remains philosophical, not solved engineering. Reports said machines froze tissue for scanning — the procedure itself did not achieve a living upload, and no trial completed.",
      "MIND UPLOADING STATUS: not demonstrated in any organism at human complexity._label: POC at best for sub-parts, NOT_PROVEN for the whole.",
      "CRYONICS: legally can only be done AFTER legal death. Preserved brains retain structure per some studies; revival has never been demonstrated. NOT_PROVEN for revival, CONFIRMED for preservation-quality improvements (aldehyde-stabilized cryopreservation, 2015, rabbit brain intact ultrastructure — POC).",
      "SENOLYTICS: drugs clearing aged ('senescent') cells — dramatic results in mice (Mayo Clinic / Buck Institute, 2015-2019); human trials early and mixed. Label: POC-to-early-trial, NOT cures.",
      "TELOMERES: lengthening telomeres delays cellular aging in vitro; telomerase activation is linked to cancer risk in animal models — not a safe longevity lever yet.",
      "METFORMIN / rapamycin / NAD+ precursors: real biology, real papers, human longevity benefit UNPROVEN — ongoing trials (TAME metformin trial).",
      "EGYPTOLOGY PARALLEL: the Egyptians pursued immortality through preservation and memory — the Book of the Dead mapped the afterlife's route; their 'immortality' that worked is cultural memory: we are still reading them 3,000+ years later.",
    ].join("\n"),
    tag: "POC",
    fileId: "file-2-tree-of-life",
    section: "quest",
    studies: [
      {
        id: "s-asc-plosone-2015",
        title: "Aldehyde-stabilized cryopreservation",
        source: "PLOS ONE / 21st Century Medicine",
        date: "2015",
        finding:
          "Rabbit brain preserved with intact ultrastructure — preservation POC, NOT revival.",
        tag: "POC",
      },
      {
        id: "s-nectome-mit",
        title: "Nectome brain-preservation coverage",
        source: "MIT Technology Review",
        date: "2018",
        finding:
          "Company openly stated the procedure was fatal and untested in humans; no successful upload.",
        tag: "CONFIRMED",
      },
      {
        id: "s-senolytics-mayo",
        title: "Senolytics improve physical function and increase lifespan in old mice",
        source: "Nature Medicine (Xu et al., Mayo/Buck)",
        date: "2018",
        finding:
          "Senescent-cell clearance extended mouse healthspan — mouse data, human translation pending.",
        tag: "POC",
      },
      {
        id: "s-tame",
        title: "Targeting Aging with Metformin (TAME)",
        source: "Aging journal / AFAR",
        date: "UNAVAILABLE (ongoing)",
        finding: "Trial designed to test metformin as anti-aging; results pending — NOT proven.",
        tag: "STALE",
      },
      {
        id: "s-connectome-fly",
        title: "Complete connectome of the fruit fly brain",
        source: "Science / Janelia Research Campus",
        date: "2023",
        finding:
          "Full synaptic map of a fly brain — scanning technology advancing, human-scale mapping distant.",
        tag: "CONFIRMED",
      },
    ],
  },
];

/** THE PERIODIC TABLE — 118 elements. Stays in Osiris forever. */
export const PERIODIC_TABLE: LabEntry = {
  id: "periodic-table",
  title: "The Periodic Table — 118 elements, and the frontier beyond",
  body: "118 confirmed elements organize by atomic number into periods and groups. Beyond 118 (119+) lies the frontier: predicted 'island of stability' superheavy nuclei. Searching for element 119 is active physics — the frontier Anubis is searching.",
  tag: "CONFIRMED",
  fileId: "science-core",
  section: "chemistry",
  studies: [
    {
      id: "s-iupac-118",
      title: "IUPAC element 118 (oganesson) naming",
      source: "IUPAC",
      date: "2016",
      finding: "118th element confirmed and named — the current frontier edge before 119+.",
      tag: "CONFIRMED",
    },
    {
      id: "s-island-stability",
      title: "Island of stability predictions",
      source: "Journal of Physical Chemistry / nuclear theory literature",
      date: "UNAVAILABLE",
      finding: "Superheavy element stability predictions remain theoretical — search continues.",
      tag: "POC",
    },
  ],
};

export const SCIENCE_CORE: LabEntry[] = [
  {
    id: "chem-core",
    title: "Chemistry core — the atoms and bonds",
    body: "Atoms: protons/charge, neutrons/mass, electrons/behavior. Bonds: ionic (transfer), covalent (share), hydrogen (weak but shapes water and proteins). Acids donate H+, bases accept. Reaction rates rise with temperature and concentration (Arrhenius). Water's polarity makes it the universal biological solvent.",
    tag: "CONFIRMED",
    fileId: "science-core",
    section: "chemistry",
    studies: [],
  },
  {
    id: "bio-core",
    title: "Biology core — cells and energy",
    body: "Cells are the unit of life: DNA stores instructions, RNA carries them, ribosomes build proteins. Mitochondria convert glucose + oxygen to ATP (energy currency). Cell division (mitosis) copies; meiosis makes sex cells with half the genes. Evolution selects on variation; mutation is the raw fuel.",
    tag: "CONFIRMED",
    fileId: "science-core",
    section: "biology",
    studies: [],
  },
  {
    id: "anatomy-core",
    title: "Anatomy core — systems of the body",
    body: "Heart pumps ~5L/min at rest; lungs exchange O2/CO2 at the alveoli; kidneys filter ~180L/day of blood plasma; liver processes nutrients and toxins; the gut is 80% of immune tissue; bones store minerals and make blood cells; skin is the largest organ.",
    tag: "CONFIRMED",
    fileId: "science-core",
    section: "anatomy",
    studies: [],
  },
  {
    id: "mindbody-core",
    title: "Mind-body process — what is actually measured",
    body: "The brain runs on ~20% of body energy at 2% of mass. Neurotransmitters: glutamate (main exciter), GABA (main inhibitor), dopamine (motivation/reward), serotonin (mood modulation — SSRI drugs act here, effect modest). Stress hormones (cortisol, adrenaline) sharpen short-term focus, erode long-term health when chronic. The placebo/nocebo effect is real and measurable — expectation changes outcomes for pain and some subjective measures. Mind-body practices (sleep, exercise, meditation) have measurable biomarker effects; many supplement claims remain NOT_PROVEN.",
    tag: "CONFIRMED",
    fileId: "science-core",
    section: "mind-body",
    studies: [],
  },
];

/** APOTHECARY — all categories. Proof-of-concept labeled honestly. */
export const APOTHECARY: LabEntry[] = [
  {
    id: "apoth-intro",
    title: "The Herbal Apothecary — the categories",
    body: "Categories in the world of the herbal apothecary: ADAPTOGENS (stress balance), NERVINES (nervous system), BITTERS (digestion), TONICS (system support), ANTIOXIDANTS, IMMUNE AIDS, ANTIMICROBIALS, POUltICES/SALVES (topical), TEAS/DECOCTIONS/INFUSIONS (preparation methods), TINCTURES (alcohol extraction), RESINS/Frankincense-family (spiritual + antimicrobial), SMOKE/CLEANSING herbs (ritual context), HOODOO/VOODOO traditional uses (folkloric — folklore preserved, mechanism mostly UNPROVEN), CULINARY SPICES (many with real bioactivity — turmeric/curcumin POC anti-inflammatory), PSYCHOACTIVE TRADITIONS (ethnobotany; legal status varies; only clearly-labeled facts).",
    tag: "CONFIRMED",
    fileId: "apothecary",
    section: "categories",
    studies: [],
  },
  {
    id: "apoth-adaptogens",
    title: "Adaptogens — what is measured",
    body: "ASHWAGANDHA: multiple randomized trials show moderate stress/anxiety reduction (best-studied adaptogen). RHODIOLA: some fatigue-reduction evidence. GINSENG: mixed evidence for energy/cognition. HOLY BASIL, SCHISANDRA, MACA: weaker evidence, traditional-use documented. Preparation: usually tincture or standardized capsule; dose-response varies by extract type.",
    tag: "POC",
    fileId: "apothecary",
    section: "adaptogens",
    studies: [
      {
        id: "s-ashwagandha-rct",
        title: "Ashwagandha randomized controlled trials for stress",
        source: "Multiple journal RCTs",
        date: "UNAVAILABLE",
        finding: "Moderate anxiolytic effect in several RCTs; more high-quality trials needed.",
        tag: "POC",
      },
    ],
  },
  {
    id: "apoth-nervines",
    title: "Nervines and sleep herbs",
    body: "CHAMOMILE: mild sedative effect (apigenin binds GABA-A receptors) — mild but real. VALERIAN: mixed evidence for sleep onset, smell is famously strong. PASSIONFLOWER, LEMON BALM, LAVENDER (aromatherapy has modest anxiety-measurement support). KAVA: effective anxiolytic but rare hepatotoxicity — regulated or banned in some countries. CAUTION FRAME: none of these replace medical care; interactions with prescriptions are real.",
    tag: "POC",
    fileId: "apothecary",
    section: "nervines",
    studies: [],
  },
  {
    id: "apoth-resins-ritual",
    title: "Resins, smoke, and the folkloric side",
    body: "FRANKINCENSE (boswellic acids — POC anti-inflammatory data exists), MYRRH (antimicrobial properties documented), SAGE/PALO SANTO/CEDAR smoke traditions (antimicrobial smoke-air studies are POC; spiritual uses are folklore, preserved with respect). HOODOO/VOODOO materia medica: High John the Conqueror root (personal power symbol), agrimony (protection folklore), bay leaf (wish-work folklore), cinnamon (prosperity folklore), mugwort (dreamwork folklore) — the folklore is real as folklore; mechanisms are NOT_PROVEN. That distinction is the discipline.",
    tag: "POC",
    fileId: "apothecary",
    section: "ritual-folkloric",
    studies: [],
  },
];

export const ALL_FILES: readonly { id: string; title: string; entries: LabEntry[] }[] = [
  {
    id: "file-1-car-t",
    title: "File #1 — Cancer blood-training lab (CAR-T / dendritic)",
    entries: FILE_1_CANCER_IMMUNOTHERAPY,
  },
  {
    id: "file-2-tree-of-life",
    title: "File #2 — Tree of Life & the immortality quest",
    entries: FILE_2_TREE_OF_LIFE,
  },
  {
    id: "science-core",
    title: "Science core — chemistry, biology, anatomy, mind-body",
    entries: [...SCIENCE_CORE, PERIODIC_TABLE],
  },
  { id: "apothecary", title: "The Herbal Apothecary — all categories", entries: APOTHECARY },
];

/** Keyword search across everything — "CAR-T", "apheresis", "Bret Carroll"… */
export function searchLab(query: string): LabEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: LabEntry[] = [];
  for (const file of ALL_FILES) {
    for (const entry of file.entries) {
      const haystack = `${entry.title} ${entry.body} ${entry.section} ${file.title} ${entry.studies
        .map((s) => `${s.title} ${s.finding}`)
        .join(" ")}`.toLowerCase();
      if (haystack.includes(q)) results.push(entry);
    }
  }
  return results;
}

export function loadAttachments(): LabAttachment[] {
  return load<LabAttachment[]>(LAB_ATTACHMENT_KEY, []);
}

export function addAttachment(attachment: Omit<LabAttachment, "added">): LabAttachment[] {
  if (attachment.kind === "picture" && attachment.content.length > MAX_PICTURE_BYTES) {
    throw new RangeError("Picture too large for local storage — compress it first.");
  }
  const next = [...loadAttachments(), { ...attachment, added: Date.now() }];
  save(LAB_ATTACHMENT_KEY, next);
  return next;
}

export function loadEntries(): LabEntry[] {
  return load<LabEntry[]>(LAB_STORAGE_KEY, []);
}

/** Operator adds their own entries; seed facts stay constant underneath. */
export function addOperatorEntry(entry: Omit<LabEntry, "id">): LabEntry[] {
  const next = [{ ...entry, id: `op-${Date.now()}` }, ...loadEntries()];
  save(LAB_STORAGE_KEY, next);
  return next;
}
