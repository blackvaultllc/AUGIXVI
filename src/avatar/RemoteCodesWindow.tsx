/**
 * REMOTE CODES WINDOW — Augie's RF/IR knowledge, on a screen the
 * Captain can work himself (owner order 2026-11-24: "If I bring up a
 * remote I want to use a remote and I have to put the TV code in").
 *
 * Three shelves:
 *   FIND A CODE — pick a kind of device, a brand, a model; the remote
 *     appears as buttons; tap a button to see its code and copy it.
 *   SETUP NUMBERS — the short numbers you type into a universal
 *     remote (SMPL list, DISH list), brand by brand, in order.
 *   HELP — the how-to in plain words, and where every code came from.
 *
 * HONEST LIMIT, stated on the screen: today this window shows and
 * copies codes. It does not send them — sending starts when the
 * Captain's blaster hardware is hooked up and registered. Nothing
 * here pretends to transmit.
 *
 * The data is the local library (public/rf-library/*.json, built by
 * tools/rf-library/ingest.mjs from the public corpora). It loads from
 * this same machine — no internet needed.
 */
import { useEffect, useMemo, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import {
  RF_HELP_STEPS,
  RF_NOT_FOUND_WORDS,
  RF_SETUP_STEPS,
  codeCopyText,
  filterNames,
  formatCodeLine,
  loadRfBrandDevices,
  loadRfIndex,
  loadRfSetupList,
  rawToPronto,
  searchBrands,
  sourceNames,
  type RfButton,
  type RfDevice,
  type RfIndex,
  type RfSetupListData,
} from "./remoteCodes";

type Tab = "find" | "setup" | "help";

export function RemoteCodesWindow({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState<RfIndex | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [tab, setTab] = useState<Tab>("find");

  useEffect(() => {
    let live = true;
    loadRfIndex()
      .then((idx) => {
        if (live) setIndex(idx);
      })
      .catch(() => {
        if (live) setIndexError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <FloatingWindow
      id="remote-codes"
      title="Remote Codes"
      onClose={onClose}
      initialWidth={680}
      initialHeight={600}
    >
      <div className="window-remote-codes">
        <div className="window-remote-codes__tabs" role="tablist" aria-label="Remote codes shelves">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "find"}
            className="window-btn"
            onClick={() => setTab("find")}
          >
            Find a code
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "setup"}
            className="window-btn"
            onClick={() => setTab("setup")}
          >
            Setup numbers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "help"}
            className="window-btn"
            onClick={() => setTab("help")}
          >
            Help — how to do it
          </button>
        </div>

        {!index && !indexError && (
          <p className="window-remote-codes__note">Loading the code library…</p>
        )}
        {indexError && (
          <p className="window-remote-codes__note">
            The code library is not on this machine yet. It lives with Augie on the Parrot — open
            Augie there and this shelf is full.
          </p>
        )}
        {index && tab === "find" && <FindCode index={index} />}
        {index && tab === "setup" && <SetupNumbers index={index} />}
        {index && tab === "help" && <HelpShelf index={index} />}
      </div>
    </FloatingWindow>
  );
}

/* ---------------- Find a code ---------------- */

function FindCode({ index }: { index: RfIndex }) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [shelf, setShelf] = useState<string | null>(null);
  const [devices, setDevices] = useState<RfDevice[] | null>(null);
  const [deviceError, setDeviceError] = useState(false);
  const [device, setDevice] = useState<RfDevice | null>(null);
  const [button, setButton] = useState<RfButton | null>(null);

  const brandHits = useMemo(() => searchBrands(index, query).slice(0, 60), [index, query]);
  const shelves = brand ? index.brandIndex[brand] || [] : [];

  const pickBrand = (name: string) => {
    setBrand(name);
    setDevice(null);
    setButton(null);
    setDevices(null);
    setDeviceError(false);
    const mine = index.brandIndex[name] || [];
    if (mine.length === 1 && mine[0]) {
      void pickShelf(name, mine[0].category);
    } else {
      setShelf(null);
    }
  };

  const pickShelf = async (brandName: string, category: string) => {
    setShelf(category);
    setDevice(null);
    setButton(null);
    setDevices(null);
    setDeviceError(false);
    try {
      const list = await loadRfBrandDevices(category, brandName);
      setDevices(list);
    } catch {
      setDeviceError(true);
    }
  };

  const shelfLabel = (id: string) =>
    index.categories.find((c) => c.id === id)?.label || id;

  return (
    <div className="window-remote-codes__shelf">
      <label className="window-remote-codes__label">
        Type a brand name
        <input
          className="window-remote-codes__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Samsung, Sony, LG…"
          aria-label="Brand name"
          autoComplete="off"
        />
      </label>

      {!brand && (
        <div className="window-remote-codes__grid" aria-label="Brands">
          {brandHits.map((hit) => (
            <button
              key={hit.brand}
              type="button"
              className="window-btn window-remote-codes__brand"
              onClick={() => pickBrand(hit.brand)}
            >
              {hit.brand}
              <span className="window-remote-codes__count">{hit.devices} devices</span>
            </button>
          ))}
          {brandHits.length === 0 && (
            <p className="window-remote-codes__note">{RF_NOT_FOUND_WORDS}</p>
          )}
        </div>
      )}

      {brand && (
        <>
          <p className="window-remote-codes__crumb">
            <button type="button" className="window-btn" onClick={() => setBrand(null)}>
              ← All brands
            </button>{" "}
            <strong>{brand}</strong>
          </p>

          {shelves.length > 1 && !shelf && (
            <>
              <p className="window-remote-codes__note">What kind of {brand} is it?</p>
              <div className="window-remote-codes__grid">
                {shelves.map((s) => (
                  <button
                    key={s.category}
                    type="button"
                    className="window-btn window-remote-codes__brand"
                    onClick={() => void pickShelf(brand, s.category)}
                  >
                    {shelfLabel(s.category)}
                    <span className="window-remote-codes__count">{s.devices} devices</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {shelf && devices === null && !deviceError && (
            <p className="window-remote-codes__note">Loading {brand} codes…</p>
          )}
          {deviceError && (
            <p className="window-remote-codes__note">
              Those codes would not load. Try again, or pick the brand once more.
            </p>
          )}

          {shelf && devices && !device && (
            <>
              <p className="window-remote-codes__note">
                {shelfLabel(shelf)} — pick your model. No model match? Pick any {brand} — most{" "}
                {brand} sets share the same codes.
              </p>
              <div className="window-remote-codes__list">
                {devices.map((d) => (
                  <button
                    key={`${d.brand}|${d.model}`}
                    type="button"
                    className="window-btn window-remote-codes__device"
                    onClick={() => {
                      setDevice(d);
                      setButton(null);
                    }}
                  >
                    {d.model}
                    <span className="window-remote-codes__count">
                      {d.buttons.length} buttons · {sourceNames(index, d.sources)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {device && (
            <RemoteSurface
              index={index}
              device={device}
              button={button}
              onPickButton={setButton}
              onBack={() => {
                setDevice(null);
                setButton(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- The remote surface ---------------- */

function RemoteSurface({
  index,
  device,
  button,
  onPickButton,
  onBack,
}: {
  index: RfIndex;
  device: RfDevice;
  button: RfButton | null;
  onPickButton: (b: RfButton | null) => void;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="window-remote-codes__remote">
      <p className="window-remote-codes__crumb">
        <button type="button" className="window-btn" onClick={onBack}>
          ← All models
        </button>{" "}
        <strong>
          {device.brand} {device.model}
        </strong>
      </p>
      <p className="window-remote-codes__note">
        Codes from {sourceNames(index, device.sources)}. Tap a button to see its code. This screen
        shows and copies codes — it sends them once your blaster is hooked up.
      </p>
      <div className="window-remote-codes__pad" aria-label="Remote buttons">
        {device.buttons.map((b) => (
          <button
            key={b.name}
            type="button"
            className="window-btn window-remote-codes__key"
            aria-pressed={button?.name === b.name}
            onClick={() => onPickButton(b)}
          >
            {b.name}
          </button>
        ))}
      </div>

      {button && (
        <div className="window-remote-codes__detail">
          <h3 className="window-remote-codes__detail-title">{button.name}</h3>
          {button.codes.map((code, i) => {
            const key = `${button.name}|${i}`;
            const pronto = code.raw ? rawToPronto(code.raw, code.frequency) : null;
            return (
              <div key={key} className="window-remote-codes__code">
                <p className="window-remote-codes__codeline">
                  {formatCodeLine(code)}{" "}
                  <span className="window-remote-codes__count">
                    from {sourceNames(index, code.sources)}
                  </span>
                </p>
                {pronto && (
                  <pre className="window-remote-codes__pronto" aria-label="Pronto hex">
                    {pronto}
                  </pre>
                )}
                <button
                  type="button"
                  className="window-btn"
                  onClick={() => void copy(codeCopyText(code, button.name), key)}
                >
                  {copied === key ? "Copied ✓" : pronto ? "Copy the Pronto code" : "Copy the code"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Setup numbers ---------------- */

function SetupNumbers({ index }: { index: RfIndex }) {
  const [listId, setListId] = useState<string | null>(null);
  const [data, setData] = useState<RfSetupListData | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [brandQuery, setBrandQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const info = index.setupLists.find((l) => l.id === listId) || null;

  const pickList = async (id: string) => {
    setListId(id);
    setData(null);
    setCategory(null);
    setBrand(null);
    setLoadError(false);
    try {
      const loaded = await loadRfSetupList(id);
      setData(loaded);
      const cats = Object.keys(loaded.categories);
      if (cats.length === 1 && cats[0]) setCategory(cats[0]);
    } catch {
      setLoadError(true);
    }
  };

  const brandsHere =
    info && category ? filterNames(info.categories[category]?.brands || [], brandQuery) : [];
  const codesHere =
    data && category && brand ? data.categories[category]?.[brand] || [] : [];

  return (
    <div className="window-remote-codes__shelf">
      <ol className="window-remote-codes__steps">
        {RF_SETUP_STEPS.slice(0, 3).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      {!listId && (
        <div className="window-remote-codes__grid">
          {index.setupLists.map((l) => (
            <button
              key={l.id}
              type="button"
              className="window-btn window-remote-codes__brand"
              onClick={() => void pickList(l.id)}
            >
              {l.name}
              <span className="window-remote-codes__count">{l.detail}</span>
            </button>
          ))}
        </div>
      )}

      {listId && info && (
        <>
          <p className="window-remote-codes__crumb">
            <button type="button" className="window-btn" onClick={() => setListId(null)}>
              ← All lists
            </button>{" "}
            <strong>{info.name}</strong>
          </p>
          {loadError && (
            <p className="window-remote-codes__note">That list would not load. Try again.</p>
          )}
          {!category && data && (
            <div className="window-remote-codes__grid">
              {Object.entries(info.categories).map(([cat, meta]) => (
                <button
                  key={cat}
                  type="button"
                  className="window-btn window-remote-codes__brand"
                  onClick={() => setCategory(cat)}
                >
                  {meta.label}
                  <span className="window-remote-codes__count">{meta.brands.length} brands</span>
                </button>
              ))}
            </div>
          )}
          {category && !brand && (
            <>
              <label className="window-remote-codes__label">
                Type a brand name
                <input
                  className="window-remote-codes__input"
                  value={brandQuery}
                  onChange={(e) => setBrandQuery(e.target.value)}
                  placeholder="Samsung, Sony, LG…"
                  aria-label="Brand name"
                  autoComplete="off"
                />
              </label>
              <div className="window-remote-codes__list">
                {brandsHere.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className="window-btn window-remote-codes__device"
                    onClick={() => setBrand(b)}
                  >
                    {b}
                  </button>
                ))}
                {brandsHere.length === 0 && (
                  <p className="window-remote-codes__note">{RF_NOT_FOUND_WORDS}</p>
                )}
              </div>
            </>
          )}
          {category && brand && (
            <>
              <p className="window-remote-codes__crumb">
                <button type="button" className="window-btn" onClick={() => setBrand(null)}>
                  ← All brands
                </button>{" "}
                <strong>
                  {brand} — {info.categories[category]?.label}
                </strong>
              </p>
              <ol className="window-remote-codes__steps">
                {RF_SETUP_STEPS.slice(3).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <div className="window-remote-codes__numbers" aria-label="Setup numbers in order">
                {codesHere.map((code, i) => (
                  <span key={`${code}-${i}`} className="window-remote-codes__number">
                    {i + 1}. {code}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- Help ---------------- */

function HelpShelf({ index }: { index: RfIndex }) {
  return (
    <div className="window-remote-codes__shelf">
      <h3 className="window-remote-codes__detail-title">Find a code — step by step</h3>
      <ol className="window-remote-codes__steps">
        {RF_HELP_STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <h3 className="window-remote-codes__detail-title">Setup numbers — step by step</h3>
      <ol className="window-remote-codes__steps">
        {RF_SETUP_STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="window-remote-codes__note">{RF_NOT_FOUND_WORDS}</p>
      <h3 className="window-remote-codes__detail-title">Where these codes came from</h3>
      <p className="window-remote-codes__note">
        {index.totals.devices.toLocaleString()} devices · {index.totals.codes.toLocaleString()}{" "}
        codes · {index.totals.brands.toLocaleString()} brands. Loaded from the public lists below
        on {new Date(index.generatedAt).toLocaleDateString()}. The library lives on this machine —
        it works with the internet unplugged.
      </p>
      <ul className="window-remote-codes__sources">
        {index.sources.map((s) => (
          <li key={s.id}>
            <strong>{s.name}</strong> — {s.detail}
            {s.stats?.codes ? ` · ${s.stats.codes.toLocaleString()} codes read` : ""}
            {s.stats?.brands ? ` · ${s.stats.brands.toLocaleString()} brands` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
