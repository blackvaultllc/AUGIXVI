import { useCallback, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BookOpen,
  Flower2,
  Gamepad2,
  Heart,
  Lock,
  LogOut,
  Pencil,
  Shapes,
  Star,
  Sun,
  Trash2,
} from "lucide-react";
import {
  LEARNER_FIRST_NAME,
  endLearnerSession,
  isLearnerSessionActive,
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

/**
 * KHADIJA'S GRAND PAGE — one page, four cabinets, no scrolling, big
 * words, big buttons (operator order 2026-11-21). Everything here is
 * education only: her game, her learning shelf, her private diary, her
 * squishy projects, her homework and tests. Nothing operator-side is
 * imported, rendered, or reachable from this page — the wall is that
 * this page's whole world is these four cabinets.
 */

type CabinetId = "learn" | "diary" | "squishy" | "homework";

const CABINETS: { id: CabinetId; label: string; icon: typeof BookOpen }[] = [
  { id: "learn", label: "Learn", icon: BookOpen },
  { id: "diary", label: "My Diary", icon: Lock },
  { id: "squishy", label: "Squishy Projects", icon: Shapes },
  { id: "homework", label: "Homework & Tests", icon: Pencil },
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
        {cabinet === "diary" && <DiaryCabinet />}
        {cabinet === "squishy" && <SquishyCabinet />}
        {cabinet === "homework" && <HomeworkCabinet />}
      </section>
    </div>
  );
}

/* ---------------- Her sign-in ---------------- */

function LearnerSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateLearnerSignIn(name, year)) {
      setMessage("That's not it — try again.");
      return;
    }
    startLearnerSession();
    onSignedIn();
  }

  return (
    <div className="learner-shell">
      <div className="learner-signin">
        <Heart className="learner-signin__heart" aria-hidden="true" fill="currentColor" />
        <h1>Khadija&apos;s Door</h1>
        <p>This door is just for Khadija. Type your name and your birth year.</p>
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
      <a className="learner-play" href="/learner/game">
        <Gamepad2 aria-hidden="true" />
        <span>
          Play <strong>Legend of Logic</strong>
        </span>
      </a>
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

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
