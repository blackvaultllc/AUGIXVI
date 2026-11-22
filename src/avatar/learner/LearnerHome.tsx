import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BookOpen,
  CarFront,
  ChevronLeft,
  ChevronRight,
  Flower2,
  Gamepad2,
  Heart,
  Lock,
  LogOut,
  Palette,
  Pencil,
  Shapes,
  Shield,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  LEARNER_FIRST_NAME,
  endLearnerSession,
  enterWithRememberedDevice,
  forgetLearnerDevice,
  hasRememberedLearnerDevice,
  isLearnerSessionActive,
  rememberLearnerDevice,
  startLearnerSession,
  validateLearnerSignIn,
} from "./learnerProfile";
import {
  addDiaryEntry,
  isDiarySetUp,
  readDiaryEntries,
  setupDiary,
  unlockDiary,
  type DiaryEntry,
} from "./diaryCrypto";
import {
  deleteProject,
  deleteSquishy,
  loadProjects,
  loadSquishies,
  readFileAsDataUrl,
  saveProject,
  saveSquishy,
  type LearnerProject,
  type SquishyPhoto,
} from "./learnerStore";
import { loadFlowerNotes, recordFlowerNote, type FlowerNote } from "./flowerNotes";

/**
 * KHADIJA'S GRAND PAGE — one page, seven cabinets, no scrolling, big
 * words, big buttons (operator orders 2026-11-21). Everything here is
 * education only: her learning shelf and game, her Squishy Maker,
 * Augie the Flower (her own AI, answering from the library), her
 * private diary, her squishy projects, her homework and tests, and
 * her art. Nothing operator-side is imported, rendered, or reachable
 * from this page — the wall is that this page's whole world is these
 * cabinets.
 */

type CabinetId = "learn" | "maker" | "flower" | "diary" | "squishy" | "homework" | "art";

const CABINETS: { id: CabinetId; label: string; icon: typeof BookOpen }[] = [
  { id: "learn", label: "Learn", icon: BookOpen },
  { id: "maker", label: "Squishy Maker", icon: Sparkles },
  { id: "flower", label: "Augie the Flower", icon: Flower2 },
  { id: "diary", label: "My Diary", icon: Lock },
  { id: "squishy", label: "Squishy Projects", icon: Shapes },
  { id: "homework", label: "Homework & Tests", icon: Pencil },
  { id: "art", label: "My Art", icon: Palette },
];

export function LearnerHome() {
  const [signedIn, setSignedIn] = useState(() => isLearnerSessionActive());
  const [cabinet, setCabinet] = useState<CabinetId>("learn");

  if (!signedIn) {
    return <LearnerSignIn onSignedIn={() => setSignedIn(true)} />;
  }

  return (
    <div className="learner-shell">
      <header className="learner-header">
        <div>
          <h1>Hi, {LEARNER_FIRST_NAME}!</h1>
          <p>My Learning Page · DIJA&apos;S Academy</p>
        </div>
        <button
          type="button"
          className="learner-leave"
          onClick={() => {
            endLearnerSession();
            setSignedIn(false);
          }}
        >
          <LogOut aria-hidden="true" /> Leave
        </button>
      </header>

      <nav className="learner-cabinets" aria-label="My cabinets">
        {CABINETS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="learner-cabinet-button"
            aria-expanded={cabinet === id}
            onClick={() => setCabinet(id)}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <section className="learner-panel" aria-live="polite">
        {cabinet === "learn" && <LearnCabinet />}
        {cabinet === "maker" && <MakerCabinet />}
        {cabinet === "flower" && <FlowerCabinet />}
        {cabinet === "diary" && <DiaryCabinet />}
        {cabinet === "squishy" && <SquishyCabinet />}
        {cabinet === "homework" && <HomeworkCabinet />}
        {cabinet === "art" && <ArtCabinet />}
      </section>
    </div>
  );
}

/* ---------------- Her sign-in ---------------- */

function LearnerSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [message, setMessage] = useState("");
  const [remembered, setRemembered] = useState(() => hasRememberedLearnerDevice());

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateLearnerSignIn(name, year)) {
      setMessage("That's not it — try again.");
      return;
    }
    startLearnerSession();
    rememberLearnerDevice();
    onSignedIn();
  }

  function comeBackIn() {
    if (enterWithRememberedDevice()) onSignedIn();
  }

  function forgetThisDevice() {
    forgetLearnerDevice();
    setRemembered(false);
  }

  return (
    <div className="learner-shell">
      <div className="learner-signin">
        <Heart className="learner-signin__heart" aria-hidden="true" fill="currentColor" />
        <h1>Khadija&apos;s Door</h1>
        {remembered ? (
          <>
            <p>Welcome back, Khadija! This is your device — tap and come right in.</p>
            <button type="button" className="learner-big-button" onClick={comeBackIn}>
              Come in, Khadija
            </button>
            <button type="button" className="learner-signin__forget" onClick={forgetThisDevice}>
              Not Khadija? Forget this device
            </button>
            <p>Or type your name and birth year, like the first time:</p>
          </>
        ) : (
          <p>This door is just for Khadija. Type your name and your birth year.</p>
        )}
        <form className="learner-signin__form" onSubmit={submit}>
          <label>
            Your name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <label>
            Your birth year
            <input
              value={year}
              onChange={(event) => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoComplete="off"
              required
            />
          </label>
          {message && (
            <p className="learner-message" role="alert">
              {message}
            </p>
          )}
          <button type="submit" className="learner-big-button">
            Open my door
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Cabinet 1: Learn ---------------- */

type Starter = { id: string; title: string; words: string; art: ReactNode };

const STARTERS: Starter[] = [
  {
    id: "flower",
    title: "Parts of a Flower",
    words:
      "A flower has petals on top, a stem that holds it up, leaves that catch the sun, and roots that drink water.",
    art: (
      <svg viewBox="0 0 200 160" role="img" aria-label="Diagram of a flower with labeled parts">
        <line x1="100" y1="62" x2="100" y2="128" stroke="#3e9b4f" strokeWidth="5" />
        <circle cx="100" cy="42" r="12" fill="#ffb703" />
        <circle cx="82" cy="50" r="11" fill="#ff6b9d" />
        <circle cx="118" cy="50" r="11" fill="#ff6b9d" />
        <circle cx="88" cy="30" r="11" fill="#ff8fab" />
        <circle cx="112" cy="30" r="11" fill="#ff8fab" />
        <ellipse cx="82" cy="96" rx="16" ry="7" fill="#57cc6d" transform="rotate(-24 82 96)" />
        <path
          d="M100 128 q-8 12 -16 16 M100 128 q0 14 0 20 M100 128 q8 12 16 16"
          stroke="#b08968"
          strokeWidth="4"
          fill="none"
        />
        <text x="130" y="34" fontSize="11">
          Petal
        </text>
        <text x="118" y="90" fontSize="11">
          Stem
        </text>
        <text x="18" y="90" fontSize="11">
          Leaf
        </text>
        <text x="126" y="146" fontSize="11">
          Roots
        </text>
      </svg>
    ),
  },
  {
    id: "water",
    title: "The Water Cycle",
    words:
      "The sun warms the water. Water rises into the sky and makes clouds. Rain falls down, and rivers carry it back. Then it starts again!",
    art: (
      <svg viewBox="0 0 200 160" role="img" aria-label="Diagram of the water cycle">
        <circle cx="34" cy="30" r="15" fill="#ffb703" />
        <ellipse cx="130" cy="36" rx="34" ry="14" fill="#bde0fe" />
        <path d="M118 56 l-4 12 M134 56 l-4 12 M150 56 l-4 12" stroke="#4361ee" strokeWidth="3" />
        <path d="M20 138 q30 -14 60 0 t60 0 t50 0" stroke="#4361ee" strokeWidth="4" fill="none" />
        <path
          d="M52 108 q10 -22 30 -30"
          stroke="#ff6b9d"
          strokeWidth="3"
          fill="none"
          markerEnd="url(#learner-arrow)"
        />
        <defs>
          <marker
            id="learner-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0 0 L7 3 L0 6 Z" fill="#ff6b9d" />
          </marker>
        </defs>
        <text x="14" y="66" fontSize="11">
          Sun
        </text>
        <text x="112" y="20" fontSize="11">
          Cloud
        </text>
        <text x="140" y="86" fontSize="11">
          Rain
        </text>
        <text x="76" y="156" fontSize="11">
          River
        </text>
      </svg>
    ),
  },
  {
    id: "number-line",
    title: "Number Line: 3 + 4 = 7",
    words: "Start at 3. Hop 4 more: 4, 5, 6, 7. You land on 7. Adding is hopping forward!",
    art: (
      <svg
        viewBox="0 0 200 160"
        role="img"
        aria-label="Number line example showing 3 plus 4 equals 7"
      >
        <line x1="16" y1="110" x2="188" y2="110" stroke="#3a2b20" strokeWidth="3" />
        {Array.from({ length: 11 }, (_, n) => (
          <g key={n}>
            <line
              x1={20 + n * 16}
              y1="104"
              x2={20 + n * 16}
              y2="116"
              stroke="#3a2b20"
              strokeWidth="2"
            />
            <text x={16 + n * 16} y={132} fontSize="11">
              {n}
            </text>
          </g>
        ))}
        <path d="M68 104 q32 -44 64 0" stroke="#ff6b9d" strokeWidth="4" fill="none" />
        <circle cx="68" cy="104" r="6" fill="#ffb703" />
        <circle cx="132" cy="104" r="6" fill="#57cc6d" />
        <text x="62" y="34" fontSize="13">
          3 + 4 = 7
        </text>
      </svg>
    ),
  },
];

function LearnCabinet() {
  const [starter, setStarter] = useState<Starter>(STARTERS[0]!);
  return (
    <div className="learner-learn">
      <div className="learner-play-row">
        <a className="learner-play" href="/learner/game">
          <Gamepad2 aria-hidden="true" />
          <span>
            Play <strong>Legend of Logic</strong>
          </span>
        </a>
        <a className="learner-play learner-play--defense" href="/avatar/world">
          <Shield aria-hidden="true" />
          <span>
            Play <strong>Cyber Defense — World of Logic</strong>
          </span>
        </a>
        <a className="learner-play learner-play--racing" href="/learner/racing">
          <CarFront aria-hidden="true" />
          <span>
            Play <strong>Multiplication Racing</strong>
          </span>
          <span className="learner-test-badge">TEST</span>
        </a>
      </div>
      <h2>Diagrams and Examples</h2>
      <p className="learner-note">Starter diagrams — more are coming.</p>
      <div className="learner-viewer">
        <div className="learner-viewer__art">{starter.art}</div>
        <div>
          <h3>{starter.title}</h3>
          <p>{starter.words}</p>
        </div>
      </div>
      <div className="learner-starter-row">
        {STARTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="learner-starter-button"
            aria-pressed={starter.id === item.id}
            onClick={() => setStarter(item)}
          >
            {item.title}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Cabinet 2: Diary Corner ---------------- */

const DIARY_PICTURES = [
  { id: "heart", label: "Heart picture", icon: Heart },
  { id: "star", label: "Star picture", icon: Star },
  { id: "sun", label: "Sun picture", icon: Sun },
  { id: "flower", label: "Flower picture", icon: Flower2 },
] as const;

function DiaryCabinet() {
  const [setUp, setSetUp] = useState(() => isDiarySetUp());
  const [picture, setPicture] = useState<string>("heart");
  const [word, setWord] = useState("");
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const keyRef = useRef<CryptoKey | null>(null);

  const unlockString = useCallback(
    () => `${picture}:${word.trim().toLocaleLowerCase()}`,
    [picture, word],
  );

  async function handleSetup() {
    if (!word.trim()) {
      setMessage("Pick a picture and type your secret word first.");
      return;
    }
    try {
      const newKey = await setupDiary(unlockString());
      keyRef.current = newKey;
      setKey(newKey);
      setSetUp(true);
      setEntries([]);
      setWord("");
      setMessage("Your diary is ready. Only your secret opens it.");
    } catch {
      setMessage("The diary could not be made right now. Try again.");
    }
  }

  async function handleUnlock() {
    const unlocked = await unlockDiary(unlockString());
    if (!unlocked) {
      setMessage("That's not it.");
      return;
    }
    keyRef.current = unlocked;
    setKey(unlocked);
    setWord("");
    setMessage("");
    setEntries(await readDiaryEntries(unlocked));
  }

  async function handleSave() {
    const currentKey = keyRef.current;
    if (!currentKey || !draft.trim()) return;
    try {
      await addDiaryEntry(currentKey, draft);
      setEntries(await readDiaryEntries(currentKey));
      setDraft("");
      setMessage("Saved in your diary.");
    } catch {
      setMessage("That page could not be saved. Try again.");
    }
  }

  function handleLock() {
    keyRef.current = null;
    setKey(null);
    setEntries([]);
    setDraft("");
    setMessage("");
  }

  if (!key) {
    return (
      <div className="learner-diary">
        <h2>My Diary Corner</h2>
        <p className="learner-note">
          This diary is only yours. Nobody else can read it — not even Dad. Your picture and your
          secret word are the only key.
        </p>
        <div className="learner-picture-row" role="group" aria-label="Pick your diary picture">
          {DIARY_PICTURES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="learner-picture-button"
              aria-label={label}
              aria-pressed={picture === id}
              onClick={() => setPicture(id)}
            >
              <Icon aria-hidden="true" fill={picture === id ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
        <label className="learner-field">
          Your secret word
          <input
            value={word}
            onChange={(event) => setWord(event.target.value)}
            autoComplete="off"
          />
        </label>
        {message && (
          <p className="learner-message" role="alert">
            {message}
          </p>
        )}
        {setUp ? (
          <button type="button" className="learner-big-button" onClick={() => void handleUnlock()}>
            Open my diary
          </button>
        ) : (
          <button type="button" className="learner-big-button" onClick={() => void handleSetup()}>
            Make my diary secret
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="learner-diary">
      <h2>My Diary Corner</h2>
      <label className="learner-field">
        Write a new page
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="Dear diary…"
        />
      </label>
      {message && (
        <p className="learner-message" role="status">
          {message}
        </p>
      )}
      <div className="learner-button-row">
        <button type="button" className="learner-big-button" onClick={() => void handleSave()}>
          Save page
        </button>
        <button type="button" className="learner-leave" onClick={handleLock}>
          <Lock aria-hidden="true" /> Lock my diary
        </button>
      </div>
      <ul className="learner-entry-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <strong>{formatDay(entry.createdAt)}</strong>
            <p>{entry.text}</p>
          </li>
        ))}
        {entries.length === 0 && <li>No pages yet. Your first page is waiting!</li>}
      </ul>
    </div>
  );
}

/* ---------------- Cabinet 3: Squishy Projects ---------------- */

function SquishyCabinet() {
  const [photos, setPhotos] = useState<SquishyPhoto[]>(() => loadSquishies());
  const [message, setMessage] = useState("");

  async function handleAdd(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const name = file.name.replace(/\.[^.]+$/, "") || "My Squishy";
      saveSquishy({ name, dataUrl });
      setPhotos(loadSquishies());
      setMessage("Saved! Your squishy is in your gallery.");
    } catch {
      setMessage("That picture could not be saved. It may be too big for this device.");
    }
  }

  return (
    <div className="learner-squishy">
      <h2>Squishy Projects</h2>
      <label className="learner-field">
        Add a picture of your squishy
        <input
          type="file"
          accept="image/*"
          aria-label="Add a squishy picture"
          onChange={(event) => {
            void handleAdd(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      {message && (
        <p className="learner-message" role="status">
          {message}
        </p>
      )}
      <div className="learner-gallery">
        {photos.map((photo) => (
          <figure key={photo.id} className="learner-gallery__item">
            <img src={photo.dataUrl} alt={photo.name} />
            <figcaption>{photo.name}</figcaption>
            <button
              type="button"
              className="learner-delete"
              aria-label={`Delete ${photo.name}`}
              onClick={() => setPhotos(deleteSquishy(photo.id))}
            >
              <Trash2 aria-hidden="true" /> Delete
            </button>
          </figure>
        ))}
        {photos.length === 0 && <p>No squishy pictures yet. Add your first one!</p>}
      </div>
    </div>
  );
}

/* ---------------- Cabinet 4: Homework & Tests ---------------- */

function HomeworkCabinet() {
  const [projects, setProjects] = useState<LearnerProject[]>(() => loadProjects());
  const [hwTitle, setHwTitle] = useState("");
  const [hwText, setHwText] = useState("");
  const [front, setFront] = useState<string | undefined>(undefined);
  const [back, setBack] = useState<string | undefined>(undefined);
  const [testTitle, setTestTitle] = useState("");
  const [testText, setTestText] = useState("");
  const [message, setMessage] = useState("");

  const homework = projects.filter((project) => project.kind === "homework");
  const tests = projects.filter((project) => project.kind === "test");

  async function handlePhoto(which: "front" | "back", file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (which === "front") setFront(dataUrl);
      else setBack(dataUrl);
    } catch {
      setMessage("That photo could not be read. Try another one.");
    }
  }

  function handleSaveHomework() {
    if (!hwTitle.trim()) {
      setMessage("Give your homework a title first.");
      return;
    }
    try {
      saveProject({
        kind: "homework",
        title: hwTitle,
        pastedText: hwText,
        ...(front ? { frontDataUrl: front } : {}),
        ...(back ? { backDataUrl: back } : {}),
      });
      setProjects(loadProjects());
      setHwTitle("");
      setHwText("");
      setFront(undefined);
      setBack(undefined);
      setMessage("Homework saved!");
    } catch {
      setMessage("That homework could not be saved. It may be too big for this device.");
    }
  }

  function handleSaveTest() {
    if (!testTitle.trim()) {
      setMessage("Give your test a title first.");
      return;
    }
    try {
      saveProject({ kind: "test", title: testTitle, pastedText: testText });
      setProjects(loadProjects());
      setTestTitle("");
      setTestText("");
      setMessage("Test saved!");
    } catch {
      setMessage("That test could not be saved. Try again.");
    }
  }

  return (
    <div className="learner-homework">
      <div className="learner-homework__column">
        <h2>My Homework</h2>
        <label className="learner-field">
          Homework title
          <input value={hwTitle} onChange={(event) => setHwTitle(event.target.value)} />
        </label>
        <label className="learner-field">
          Front of the paper
          <input
            type="file"
            accept="image/*"
            aria-label="Front of the paper photo"
            onChange={(event) => {
              void handlePhoto("front", event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {front && <p className="learner-note">Front picture added.</p>}
        <label className="learner-field">
          Back of the paper
          <input
            type="file"
            accept="image/*"
            aria-label="Back of the paper photo"
            onChange={(event) => {
              void handlePhoto("back", event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {back && <p className="learner-note">Back picture added.</p>}
        <label className="learner-field">
          Paste the words here
          <textarea value={hwText} onChange={(event) => setHwText(event.target.value)} rows={3} />
        </label>
        <p className="learner-note">
          Augie is still learning to read pictures — paste the words works now.
        </p>
        <button type="button" className="learner-big-button" onClick={handleSaveHomework}>
          Save homework
        </button>
        <ul className="learner-project-list">
          {homework.map((project) => (
            <li key={project.id}>
              <strong>{project.title}</strong> <span>{formatDay(project.createdAt)}</span>
              {project.frontDataUrl && <img src={project.frontDataUrl} alt="Front of paper" />}
              {project.backDataUrl && <img src={project.backDataUrl} alt="Back of paper" />}
              {project.pastedText && <p>{project.pastedText}</p>}
              <button
                type="button"
                className="learner-delete"
                aria-label={`Delete ${project.title}`}
                onClick={() => setProjects(deleteProject(project.id))}
              >
                <Trash2 aria-hidden="true" /> Delete
              </button>
            </li>
          ))}
          {homework.length === 0 && <li>No homework saved yet.</li>}
        </ul>
      </div>

      <div className="learner-homework__column">
        <h2>My Tests</h2>
        <label className="learner-field">
          Test title
          <input value={testTitle} onChange={(event) => setTestTitle(event.target.value)} />
        </label>
        <label className="learner-field">
          Paste the words here
          <textarea
            value={testText}
            onChange={(event) => setTestText(event.target.value)}
            rows={3}
          />
        </label>
        <button type="button" className="learner-big-button" onClick={handleSaveTest}>
          Save test
        </button>
        {message && (
          <p className="learner-message" role="status">
            {message}
          </p>
        )}
        <ul className="learner-project-list">
          {tests.map((project) => (
            <li key={project.id}>
              <strong>{project.title}</strong> <span>{formatDay(project.createdAt)}</span>
              {project.pastedText && <p>{project.pastedText}</p>}
              <button
                type="button"
                className="learner-delete"
                aria-label={`Delete ${project.title}`}
                onClick={() => setProjects(deleteProject(project.id))}
              >
                <Trash2 aria-hidden="true" /> Delete
              </button>
            </li>
          ))}
          {tests.length === 0 && <li>No tests saved yet.</li>}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Cabinet: Squishy Maker (her game) ---------------- */

function MakerCabinet() {
  return (
    <div className="learner-maker">
      <h2>Squishy Maker</h2>
      <p className="learner-note">
        Your game! Make squishies, open the mystery heart present, and earn pretend prize money.
        Your squishies save right here in Augie.
      </p>
      <a className="learner-play" href="/learner/squishy">
        <Sparkles aria-hidden="true" />
        <span>
          Play <strong>Squishy Maker</strong>
        </span>
      </a>
    </div>
  );
}

/* ---------------- Cabinet: Augie the Flower (her own AI) ---------------- */

type FlowerReply = {
  answer: string;
  mode: "book" | "math" | "none" | "redirect" | "library-down";
  source: { bookTitle: string; articleTitle: string } | null;
  verified: boolean;
};

const FLOWER_EXAMPLES = [
  "Why is the sky blue?",
  "What is 3 + 4?",
  "Tell me about dinosaurs",
  "How do plants eat?",
];

/**
 * Good-manners lessons — the Flower's own kind guidance, in simple
 * words. These are teaching, not book facts, and they are shown as
 * the Flower's words, never dressed up as something from a book.
 */
const MANNERS_LESSONS: { id: string; title: string; words: string }[] = [
  {
    id: "please",
    title: "Please and Thank You",
    words:
      "Say “please” when you ask for something, and “thank you” when someone helps you. Those little words make people feel happy and respected.",
  },
  {
    id: "listening",
    title: "Listening with Care",
    words:
      "When someone is talking, look at them and listen until they finish. Then it is your turn to talk. Listening shows respect.",
  },
  {
    id: "kind-words",
    title: "Kind Words",
    words:
      "Say hello with a smile. Use kind words, even when you feel upset. A young lady speaks with a gentle voice and strong, kind words.",
  },
  {
    id: "table",
    title: "At the Table",
    words:
      "Sit up tall, chew with your mouth closed, and say “excuse me” when you need to speak or leave the table.",
  },
];

/** Heritage topics — tapped, they ask the Flower, and the answer comes from the books. */
const HERITAGE_TOPICS: { id: string; label: string; question: string }[] = [
  { id: "morocco", label: "Morocco", question: "Tell me about Morocco" },
  { id: "africa", label: "Africa", question: "Tell me about Africa" },
  { id: "egypt", label: "Egypt", question: "Tell me about Egypt long ago" },
  { id: "spain", label: "Spain", question: "Tell me about Spain" },
];

/**
 * The Flower's voice — Part 6. She speaks with the same speech path the
 * operator's Augie uses (the browser's speechSynthesis, see src/avatar/
 * voice.ts), with a friendlier pitch for a young listener. Voice-OUT only in
 * this pass: voice-in is NOT wired on her side — /api/transcribe is an
 * operator route outside her wall, and the local ear is bound to the
 * operator stage. Returns false when this device has no speech voice, so
 * the cabinet can say so plainly instead of faking it.
 */
function speakFlowerWords(text: string, onState: (speaking: boolean) => void): boolean {
  const synth = globalThis.speechSynthesis;
  if (!synth || typeof globalThis.SpeechSynthesisUtterance !== "function") return false;
  synth.cancel();
  const utterance = new globalThis.SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1.15;
  utterance.onstart = () => onState(true);
  utterance.onend = () => onState(false);
  utterance.onerror = () => onState(false);
  synth.speak(utterance);
  return true;
}

function FlowerCabinet() {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [speech, setSpeech] = useState(
    "Hello, Khadija! I am Augie the Flower. Ask me a school question, and I will find the answer in our books.",
  );
  const [sourceLine, setSourceLine] = useState<string | null>(null);
  const [notes, setNotes] = useState<FlowerNote[]>(() => loadFlowerNotes());
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const voiceAvailable =
    typeof globalThis.speechSynthesis !== "undefined" &&
    typeof globalThis.SpeechSynthesisUtterance === "function";

  useEffect(() => {
    return () => {
      globalThis.speechSynthesis?.cancel();
    };
  }, []);

  const say = useCallback(
    (text: string) => {
      if (!voiceOn) return;
      speakFlowerWords(text, setSpeaking);
    },
    [voiceOn],
  );

  const ask = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q || asking) return;
    setAsking(true);
    setSpeech("Let me look in our books…");
    setSourceLine(null);
    try {
      const response = await fetch("/api/learner/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!response.ok) throw new Error("ask failed");
      const reply = (await response.json()) as FlowerReply;
      setSpeech(reply.answer);
      say(reply.answer);
      if (reply.mode === "book" && reply.source) {
        setSourceLine(`From the book: ${reply.source.bookTitle} — “${reply.source.articleTitle}”`);
        setNotes(
          recordFlowerNote({
            question: q,
            answer: reply.answer,
            sourceBook: reply.source.bookTitle,
            sourceArticle: reply.source.articleTitle,
            verified: reply.verified,
          }),
        );
      } else if (reply.mode === "math") {
        setSourceLine("Worked out by counting — no book needed.");
        setNotes(
          recordFlowerNote({
            question: q,
            answer: reply.answer,
            sourceBook: "Counting",
            verified: reply.verified,
          }),
        );
      }
    } catch {
      setSpeech(
        "My books are resting right now — I could not reach them. Please ask me again in a little while!",
      );
    } finally {
      setAsking(false);
    }
  }, [asking, say]);

  function showLesson(lesson: (typeof MANNERS_LESSONS)[number]) {
    setSpeech(lesson.words);
    setSourceLine("A good-manners lesson from your Flower.");
    say(lesson.words);
  }

  const flowerState = asking ? "thinking" : speaking ? "speaking" : "listening";
  const statusText =
    flowerState === "thinking"
      ? "Thinking…"
      : flowerState === "speaking"
        ? "Speaking…"
        : "Listening…";

  const latestNote = notes[0];

  return (
    <div className="learner-flower">
      <div className="learner-flower__head">
        <svg
          className={`learner-flower__face is-${flowerState}`}
          viewBox="0 0 120 120"
          role="img"
          aria-label="Augie the Flower, a smiling pink flower"
        >
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse
              key={deg}
              cx="60"
              cy="30"
              rx="15"
              ry="22"
              fill="#ff8fab"
              transform={`rotate(${deg} 60 60)`}
            />
          ))}
          {[30, 90, 150, 210, 270, 330].map((deg) => (
            <ellipse
              key={deg}
              cx="60"
              cy="34"
              rx="11"
              ry="17"
              fill="#c77dff"
              transform={`rotate(${deg} 60 60)`}
            />
          ))}
          <circle cx="60" cy="60" r="24" fill="#ffb703" />
          <circle cx="52" cy="56" r="3.4" fill="#3a2b20" />
          <circle cx="68" cy="56" r="3.4" fill="#3a2b20" />
          <path d="M51 66 q9 8 18 0" stroke="#3a2b20" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="45" cy="63" r="4" fill="#ff6b9d" opacity="0.65" />
          <circle cx="75" cy="63" r="4" fill="#ff6b9d" opacity="0.65" />
        </svg>
        <div>
          <h2>Augie the Flower</h2>
          <p className="learner-note">
            Your own flower, here to help you learn — math, science, history, words, how minds
            and feelings work, and good manners too. Every school subject lives here.
          </p>
          <p className="learner-flower__status" aria-live="polite">
            {statusText}
          </p>
        </div>
      </div>

      <div className="learner-flower__voice">
        {voiceAvailable ? (
          <>
            <button
              type="button"
              className="learner-chip"
              aria-pressed={voiceOn}
              onClick={() => {
                if (voiceOn) globalThis.speechSynthesis?.cancel();
                setVoiceOn(!voiceOn);
              }}
            >
              {voiceOn ? (
                <>
                  <Volume2 aria-hidden="true" /> Voice On
                </>
              ) : (
                <>
                  <VolumeX aria-hidden="true" /> Voice Off
                </>
              )}
            </button>
            <button
              type="button"
              className="learner-chip"
              onClick={() => speakFlowerWords(speech, setSpeaking)}
            >
              <Volume2 aria-hidden="true" /> Hear it again
            </button>
          </>
        ) : (
          <p className="learner-note">
            This device has no voice for me — you can still read my words.
          </p>
        )}
      </div>

      <div className="learner-flower__bubble" aria-live="polite">
        <p>{speech}</p>
        {sourceLine && <p className="learner-flower__source">{sourceLine}</p>}
        {latestNote && (
          <p className="learner-flower__note">
            Saved in your learning notes · {latestNote.sourceBook} · {formatDay(latestNote.date)}
            {latestNote.verified ? " · ✓ checked from a book" : ""}
          </p>
        )}
      </div>

      <form
        className="learner-flower__ask"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
          setQuestion("");
        }}
      >
        <label className="learner-flower__label">
          Ask Augie the Flower
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Type your question here"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="learner-big-button" disabled={asking}>
          {asking ? "Looking…" : "Ask"}
        </button>
      </form>

      <div className="learner-flower__topics">
        <div className="learner-flower__group">
          <h3>Ask me</h3>
          <div className="learner-chip-row">
            {FLOWER_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="learner-chip"
                onClick={() => void ask(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
        <div className="learner-flower__group">
          <h3>Good manners</h3>
          <div className="learner-chip-row">
            {MANNERS_LESSONS.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                className="learner-chip"
                onClick={() => showLesson(lesson)}
              >
                {lesson.title}
              </button>
            ))}
          </div>
        </div>
        <div className="learner-flower__group">
          <h3>My heritage</h3>
          <div className="learner-chip-row">
            {HERITAGE_TOPICS.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className="learner-chip"
                onClick={() => void ask(topic.question)}
              >
                {topic.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Cabinet: My Art ---------------- */

const ARTWORKS: { src: string; title: string; words: string }[] = [
  {
    src: "/learner-art/princess-squishy.webp",
    title: "The Princess and the Heart Squishy",
    words: "A princess with her heart squishy. This picture was made for you.",
  },
  {
    src: "/learner-art/artist-squishies.webp",
    title: "The Artist Whose Drawings Come Alive",
    words: "You draw squishies — and in this picture, they hop right off the page!",
  },
  {
    src: "/learner-art/magical-friends.webp",
    title: "The Magical Girl and Her Squishy Friends",
    words: "A magical girl with all her squishy friends around her.",
  },
];

function ArtCabinet() {
  const [index, setIndex] = useState(0);
  const artwork = ARTWORKS[index]!;
  const go = (step: number) =>
    setIndex((current) => (current + step + ARTWORKS.length) % ARTWORKS.length);

  return (
    <div className="learner-art">
      <h2>My Art</h2>
      <div className="learner-art__stage">
        <img src={artwork.src} alt={artwork.title} />
      </div>
      <p className="learner-art__caption">
        <strong>{artwork.title}.</strong> {artwork.words}
      </p>
      <div className="learner-art__controls">
        <button
          type="button"
          className="learner-art__button"
          aria-label="Back to the picture before"
          onClick={() => go(-1)}
        >
          <ChevronLeft aria-hidden="true" /> Back
        </button>
        <span className="learner-art__count">
          Picture {index + 1} of {ARTWORKS.length}
        </span>
        <button
          type="button"
          className="learner-art__button"
          aria-label="Go to the next picture"
          onClick={() => go(1)}
        >
          Next <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
