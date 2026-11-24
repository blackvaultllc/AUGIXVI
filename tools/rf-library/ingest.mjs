#!/usr/bin/env node
/**
 * RF/IR KNOWLEDGE LOAD — ingest (owner order 2026-11-24).
 *
 * Pulls the real public remote-code corpora into Augie's LOCAL library:
 *
 *   - Flipper IRDB      (github.com/Lucaslhm/Flipper-IRDB)      .ir files
 *   - irdb              (github.com/probonopd/irdb)             CSV files
 *   - LIRC remotes      (git.code.sf.net/p/lirc-remotes/code)   lircd.conf files
 *   - SMPL code list    (smpltec.com, "Device FULL Code List, Version 2019-1", PDF)
 *   - DISH code list    ("6.3/6.4 Remote Equipment Codes", PDF)
 *
 * Nothing is invented: a brand/model/code enters the library only if a
 * source file carries it, and every entry keeps the name of the source
 * it came from. Devices are deduplicated by brand + model + category;
 * buttons by function name; identical codes from several sources merge
 * into one code carrying all its sources.
 *
 * Pronto hex: the corpora carry codes as protocol/address/command or
 * as raw timings. Pronto hex is a *format* for raw timings — the app
 * converts raw timings to Pronto hex at display time (see
 * src/avatar/remoteCodes.ts, rawToPronto), so no converted strings are
 * stored and nothing can drift from the source data.
 *
 * Usage:
 *   RF_SOURCES_DIR=~/workspace/rf-sources node tools/rf-library/ingest.mjs
 * Sources dir layout (all optional except at least one must exist):
 *   flipper-irdb/  irdb/  lirc-remotes/  smpl-codes.pdf  dish-codes.pdf
 * Output: public/rf-library/{index.json, devices-<category>.json,
 *         setup-<list>.json} — served by the app itself, so the library
 *         works with the network unplugged (local-first law).
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(REPO_ROOT, "public", "rf-library");
const SOURCES_DIR =
  process.env.RF_SOURCES_DIR || join(homedir(), "workspace", "rf-sources");

const SOURCE_META = {
  "flipper-irdb": {
    name: "Flipper IRDB",
    detail: "Community IR database for Flipper Zero (github.com/Lucaslhm/Flipper-IRDB)",
  },
  irdb: {
    name: "irdb",
    detail: "IR code database in protocol/device/function form (github.com/probonopd/irdb)",
  },
  "lirc-remotes": {
    name: "LIRC remote library",
    detail: "Linux Infrared Remote Control — remote configuration library (lirc-remotes)",
  },
  "smpl-2019": {
    name: "SMPL remote code list (2019-1)",
    detail:
      "Setup numbers printed for SMPL universal remotes — “Device FULL Code List, Version 2019-1” (smpltec.com)",
  },
  "dish-634": {
    name: "DISH 6.3/6.4 remote code list",
    detail:
      "Setup numbers printed in the DISH Network “6.3/6.4 Remote Equipment Codes” guide",
  },
};

/* ---------------- normalisation helpers ---------------- */

export function brandKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
export function modelKey(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function buttonKey(name) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
function cleanDisplay(name) {
  return name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

const CATEGORY_LABELS = {
  tv: "TVs",
  ac: "Air conditioners",
  audio: "Audio — receivers, soundbars, players",
  dvd: "DVD & Blu-ray players",
  cable: "Cable & satellite boxes",
  streaming: "Streaming devices",
  projector: "Projectors",
  monitor: "Monitors & displays",
  vcr: "VCRs",
  console: "Game consoles",
  camera: "Cameras & CCTV",
  fan: "Fans",
  fireplace: "Fireplaces",
  heater: "Heaters",
  lights: "Lights",
  home: "Home — purifiers, humidifiers, bidets",
  car: "Car multimedia",
  computer: "Computers & KVM",
  remotes: "Remotes (LIRC library)",
  converted: "Converted library — more codes by brand",
  other: "Other devices",
};

function categoryFromFolder(folder) {
  const f = folder.toLowerCase();
  const exact = {
    tvs: "tv",
    tv: "tv",
    tv_tuner: "tv",
    monitors: "monitor",
    touchscreen_displays: "monitor",
    acs: "ac",
    "air conditioner": "ac",
    audio_and_video_receivers: "audio",
    soundbars: "audio",
    speakers: "audio",
    cd_players: "audio",
    minidisc: "audio",
    laserdisc: "audio",
    dvd_players: "dvd",
    "blu-ray": "dvd",
    blu_ray: "dvd",
    cable_boxes: "cable",
    "dvb-t": "cable",
    converters: "cable",
    streaming_devices: "streaming",
    projectors: "projector",
    vcr: "vcr",
    consoles: "console",
    cctv: "camera",
    cameras: "camera",
    fans: "fan",
    fireplaces: "fireplace",
    heaters: "heater",
    led_lighting: "lights",
    air_purifiers: "home",
    humidifiers: "home",
    bidet: "home",
    car_multimedia: "car",
    head_units: "car",
    computers: "computer",
    kvm: "computer",
  };
  if (exact[f]) return exact[f];
  if (f.includes("plasma") || f.includes("hdtv")) return "tv";
  if (f.includes("tv")) return "tv";
  if (f.includes("air") && f.includes("cond")) return "ac";
  if (
    f.includes("receiver") ||
    f.includes("audio") ||
    f.includes("sound") ||
    f.includes("amplifier") ||
    f.includes("surround") ||
    f.includes("tuner") ||
    f.includes("cassette") ||
    f.includes("jukebox") ||
    f.includes("mp3") ||
    f.includes("ipod") ||
    f === "cd player" ||
    f.includes("cd ")
  )
    return "audio";
  if (f.includes("dvd") || f.includes("blu") || f.includes("laser disc") || f.includes("laserdisc"))
    return "dvd";
  if (f.includes("projector")) return "projector";
  if (f.includes("cable") || f.includes("satellite") || f === "dss" || f === "dvr") return "cable";
  return "other";
}

/* ---------------- device store with dedupe ---------------- */

/** key: category|brandKey|modelKey -> device */
const devices = new Map();
/** brandKey -> Map(displayName -> count) for best display casing */
const brandCasings = new Map();

function noteBrandCasing(display) {
  const key = brandKey(display);
  if (!key) return;
  if (!brandCasings.has(key)) brandCasings.set(key, new Map());
  const m = brandCasings.get(key);
  m.set(display, (m.get(display) || 0) + 1);
}
function bestBrandDisplay(key) {
  const m = brandCasings.get(key);
  if (!m) return key;
  let best = key;
  let bestN = -1;
  for (const [display, n] of m) {
    // Prefer a casing that is not all-caps and not all-lower when counts tie.
    const score = n * 10 + (display === display.toLowerCase() || display === display.toUpperCase() ? 0 : 5);
    if (score > bestN) {
      bestN = score;
      best = display;
    }
  }
  return best;
}

function getDevice(category, brandDisplay, modelDisplay, sourceId) {
  noteBrandCasing(brandDisplay);
  const key = `${category}|${brandKey(brandDisplay)}|${modelKey(modelDisplay)}`;
  let dev = devices.get(key);
  if (!dev) {
    dev = {
      brand: brandDisplay,
      brandKey: brandKey(brandDisplay),
      model: cleanDisplay(modelDisplay),
      category,
      buttons: new Map(), // buttonKey -> {name, codes: Map(codeSig -> code)}
      sources: new Set(),
    };
    devices.set(key, dev);
  }
  dev.sources.add(sourceId);
  return dev;
}

function addCode(dev, buttonName, code, sourceId) {
  const bk = buttonKey(buttonName);
  if (!bk) return;
  let btn = dev.buttons.get(bk);
  if (!btn) {
    btn = { name: cleanDisplay(buttonName), codes: new Map() };
    dev.buttons.set(bk, btn);
  }
  const sig =
    code.raw != null
      ? `raw|${code.frequency || ""}|${code.raw}`
      : `${(code.protocol || "").toLowerCase()}|${code.address || ""}|${code.command || ""}`;
  let existing = btn.codes.get(sig);
  if (!existing) {
    existing = { ...code, sources: new Set() };
    btn.codes.set(sig, existing);
  }
  existing.sources.add(sourceId);
}

/* ---------------- Flipper IRDB ---------------- */

function parseFlipperFile(path, category, brand, model, sourceId) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return 0;
  }
  const dev = getDevice(category, brand, model, sourceId);
  let count = 0;
  let current = null;
  const flush = () => {
    if (!current || !current.name) return;
    if (current.type === "parsed" && current.protocol) {
      addCode(
        dev,
        current.name,
        {
          protocol: current.protocol,
          address: (current.address || "").toUpperCase(),
          command: (current.command || "").toUpperCase(),
        },
        sourceId,
      );
      count++;
    } else if (current.type === "raw" && current.data) {
      addCode(
        dev,
        current.name,
        {
          raw: current.data.replace(/\s+/g, " ").trim(),
          frequency: current.frequency ? Number(current.frequency) : undefined,
        },
        sourceId,
      );
      count++;
    }
  };
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("name:")) {
      flush();
      current = { name: t.slice(5).trim() };
    } else if (current && t.includes(":")) {
      const idx = t.indexOf(":");
      const k = t.slice(0, idx).trim();
      const v = t.slice(idx + 1).trim();
      if (["type", "protocol", "address", "command", "frequency", "data"].includes(k)) {
        current[k] = v;
      }
    }
  }
  flush();
  return count;
}

function walkIrFiles(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkIrFiles(p, out);
    else if (entry.name.toLowerCase().endsWith(".ir")) out.push(p);
  }
  return out;
}

function ingestFlipper(root) {
  let files = 0;
  let codes = 0;
  const skipTop = new Set(["_Converted_", "Universal_TV_Remotes"]);
  for (const top of readdirSync(root, { withFileTypes: true })) {
    if (!top.isDirectory() || skipTop.has(top.name)) continue;
    const category = categoryFromFolder(top.name);
    const catDir = join(root, top.name);
    for (const brandEntry of readdirSync(catDir, { withFileTypes: true })) {
      if (!brandEntry.isDirectory()) continue;
      const brand = cleanDisplay(brandEntry.name);
      const brandDir = join(catDir, brandEntry.name);
      for (const file of walkIrFiles(brandDir, [])) {
        const rel = relative(brandDir, file);
        const model = cleanDisplay(basename(rel, ".ir"));
        codes += parseFlipperFile(file, category, brand, model, "flipper-irdb");
        files++;
      }
    }
  }
  return { files, codes };
}

/**
 * Flipper _Converted_: files converted from other code formats (Pronto
 * hex sets among them), organised by manufacturer only — no device
 * type — so they land in their own "converted" shelf, by brand.
 */
function ingestFlipperConverted(root) {
  const convRoot = join(root, "_Converted_");
  if (!existsSync(convRoot)) return { files: 0, codes: 0 };
  let files = 0;
  let codes = 0;
  for (const kind of readdirSync(convRoot, { withFileTypes: true })) {
    if (!kind.isDirectory()) continue;
    const kindDir = join(convRoot, kind.name);
    for (const letter of readdirSync(kindDir, { withFileTypes: true })) {
      if (!letter.isDirectory()) continue;
      const letterDir = join(kindDir, letter.name);
      for (const entry of readdirSync(letterDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const brand = cleanDisplay(entry.name);
          const brandDir = join(letterDir, entry.name);
          for (const file of walkIrFiles(brandDir, [])) {
            const model = cleanDisplay(basename(file, ".ir"));
            codes += parseFlipperFile(file, "converted", brand, model, "flipper-irdb");
            files++;
          }
        } else if (entry.name.toLowerCase().endsWith(".ir")) {
          const model = cleanDisplay(basename(entry.name, ".ir"));
          codes += parseFlipperFile(
            join(letterDir, entry.name),
            "converted",
            "(Generic)",
            model,
            "flipper-irdb",
          );
          files++;
        }
      }
    }
  }
  return { files, codes };
}

/* ---------------- irdb ---------------- */

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const hex2 = (n) => {
  const v = Number.parseInt(n, 10);
  if (Number.isNaN(v)) return null;
  return v.toString(16).toUpperCase().padStart(2, "0");
};

function ingestIrdB(root) {
  const codesDir = join(root, "codes");
  let files = 0;
  let codes = 0;
  const csvFiles = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.toLowerCase().endsWith(".csv")) csvFiles.push(p);
    }
  };
  walk(codesDir);
  for (const file of csvFiles) {
    const rel = relative(codesDir, file).split(/[\\/]/);
    const brand = cleanDisplay(rel[0]);
    let category = "other";
    let model;
    if (rel.length === 2) {
      model = cleanDisplay(basename(rel[1], ".csv"));
    } else if (rel.length === 3) {
      const mid = rel[1];
      const mapped = categoryFromFolder(mid);
      if (mapped !== "other" || /tv|air|dvd|audio|receiver|projector|cable/i.test(mid)) {
        category = mapped;
        model = cleanDisplay(basename(rel[2], ".csv"));
      } else {
        model = `${cleanDisplay(mid)} ${cleanDisplay(basename(rel[2], ".csv"))}`;
      }
    } else {
      category = categoryFromFolder(rel[1]);
      model = rel.slice(2).map((p) => cleanDisplay(basename(p, ".csv"))).join(" ");
    }
    // irdb file names like "7,7" are device,subdevice — label them plainly.
    if (/^\d+,\d+$/.test(model)) {
      const [d, s] = model.split(",");
      model = `Device ${d} · Subdevice ${s}`;
    }
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) continue;
    const dev = getDevice(category, brand, model, "irdb");
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line);
      if (cols.length < 5) continue;
      const [fn, protocol, device, subdevice, func] = cols;
      const a = hex2(device);
      const b = hex2(subdevice);
      const c = hex2(func);
      if (!fn || !protocol || a === null || c === null) continue;
      addCode(
        dev,
        fn,
        { protocol, address: b && b !== "FF" ? `${a} ${b}` : a, command: c },
        "irdb",
      );
      codes++;
    }
    files++;
  }
  return { files, codes };
}

/* ---------------- LIRC remotes ---------------- */

function ingestLirc(root) {
  let files = 0;
  let codes = 0;
  const confFiles = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else confFiles.push(p);
    }
  };
  const remotesDir = existsSync(join(root, "remotes")) ? join(root, "remotes") : root;
  walk(remotesDir);
  for (const file of confFiles) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!/begin\s+remote/i.test(text)) continue;
    const rel = relative(remotesDir, file).split(/[\\/]/);
    const brand = cleanDisplay(rel.length > 1 ? rel[0] : "LIRC");
    // A file can hold several remotes; split on "begin remote".
    const blocks = text.split(/begin\s+remote/i).slice(1);
    for (const block of blocks) {
      const nameMatch = block.match(/^\s*name\s+(\S+)/m);
      const model = cleanDisplay(nameMatch ? nameMatch[1] : basename(file));
      const preMatch = block.match(/pre_data\s+(0x[0-9a-fA-F]+)/);
      const codesMatch = block.match(/begin\s+codes([\s\S]*?)end\s+codes/i);
      if (!codesMatch) continue;
      const dev = getDevice("remotes", brand, model, "lirc-remotes");
      let n = 0;
      for (const line of codesMatch[1].split(/\r?\n/)) {
        const m = line.trim().match(/^(\S+)\s+(0x[0-9a-fA-F]+)/);
        if (!m) continue;
        addCode(
          dev,
          m[1],
          {
            protocol: "LIRC",
            address: preMatch ? preMatch[1].toUpperCase() : undefined,
            command: m[2].toUpperCase(),
          },
          "lirc-remotes",
        );
        n++;
      }
      if (n) {
        files++;
        codes += n;
      }
    }
  }
  return { files, codes };
}

/* ---------------- setup-code lists (PDF) ---------------- */

function pdfText(pdfPath) {
  const txtPath = pdfPath.replace(/\.pdf$/i, ".txt");
  if (existsSync(txtPath)) return readFileSync(txtPath, "utf8");
  execFileSync("pdftotext", ["-layout", pdfPath, txtPath]);
  return readFileSync(txtPath, "utf8");
}

/** Parse "Brand Name 123 456 789" lines; indented number-only lines continue the last brand. */
function parseBrandCodeLines(lines, isJunk) {
  const out = new Map(); // brand -> codes[]
  let lastBrand = null;
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim() || isJunk(line)) continue;
    const cont = line.match(/^\s+(\d[\d\s,]*)$/);
    if (cont && lastBrand) {
      out.get(lastBrand).push(...cont[1].split(/[\s,]+/).filter(Boolean));
      continue;
    }
    const m = line.match(/^(.+?)\s+(\d[\d\s,]*)$/);
    if (m) {
      const brand = m[1].trim();
      const codes = m[2].split(/[\s,]+/).filter(Boolean);
      if (brand && codes.length) {
        if (!out.has(brand)) out.set(brand, []);
        out.get(brand).push(...codes);
        lastBrand = brand;
      }
    }
  }
  return out;
}

function ingestSmpl(pdfPath) {
  const text = pdfText(pdfPath);
  const sections = { tv: [], cable: [], dvd: [], audio: [], other: [] };
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const head = line.trim().toUpperCase();
    if (/^TV CODES/.test(head)) current = "tv";
    else if (/CABLE|SATELLITE|SET-TOP/.test(head) && /CODES/.test(head)) current = "cable";
    else if (/^DVD/.test(head) && /CODES/.test(head)) current = "dvd";
    else if (/AUDIO|RECEIVER/.test(head) && /CODES/.test(head)) current = "audio";
    else if (/VCR/.test(head) && /CODES/.test(head)) current = "other";
    else if (current) sections[current].push(line);
  }
  const result = {};
  let brands = 0;
  let codes = 0;
  for (const [cat, lines] of Object.entries(sections)) {
    const parsed = parseBrandCodeLines(lines, (l) => /Device FULL Code List|Page \|/i.test(l));
    if (parsed.size) {
      result[cat] = Object.fromEntries(parsed);
      brands += parsed.size;
      codes += [...parsed.values()].reduce((n, arr) => n + arr.length, 0);
    }
  }
  return { categories: result, brands, codes };
}

/** DISH guide: three text columns per page in pdftotext -layout output. */
function ingestDish(pdfPath) {
  const text = pdfText(pdfPath);
  const COLS = [
    [0, 47],
    [47, 95],
    [95, Infinity],
  ];
  const sections = { tv: [], vcr: [], dvd: [], audio: [] };
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\f/g, "");
    const trimmed = line.trim();
    if (/^TV Codes/.test(trimmed)) current = "tv";
    else if (/^VCR Codes/.test(trimmed)) current = "vcr";
    else if (/^DVD Player Codes/.test(trimmed)) current = "dvd";
    else if (/^(Audio|Amplifier|Receiver)/.test(trimmed) && /Codes/.test(trimmed)) current = "audio";
    else if (/Tuner\/Amplifier Codes/.test(trimmed)) current = "audio";
    if (!current) continue;
    if (
      /Remote Controls -|Receivers - Remote|Programming in AUX|These tables|equipment brand|not work|in this guide|control your equipment/i.test(
        line,
      )
    ) {
      continue;
    }
    for (const [a, b] of COLS) {
      const chunk = line.slice(a, b);
      if (chunk.trim()) sections[current].push(chunk);
    }
  }
  const catMap = { tv: "tv", vcr: "vcr", dvd: "dvd", audio: "audio" };
  const result = {};
  let brands = 0;
  let codes = 0;
  for (const [cat, lines] of Object.entries(sections)) {
    const parsed = parseBrandCodeLines(lines, () => false);
    if (parsed.size) {
      result[catMap[cat]] = Object.fromEntries(parsed);
      brands += parsed.size;
      codes += [...parsed.values()].reduce((n, arr) => n + arr.length, 0);
    }
  }
  return { categories: result, brands, codes };
}

/* ---------------- main ---------------- */

function main() {
  const stats = {};
  const flipperRoot = join(SOURCES_DIR, "flipper-irdb");
  if (existsSync(flipperRoot)) {
    stats["flipper-irdb"] = ingestFlipper(flipperRoot);
    const conv = ingestFlipperConverted(flipperRoot);
    stats["flipper-irdb"].files += conv.files;
    stats["flipper-irdb"].codes += conv.codes;
  }
  const irdbRoot = join(SOURCES_DIR, "irdb");
  if (existsSync(join(irdbRoot, "codes"))) stats.irdb = ingestIrdB(irdbRoot);
  const lircRoot = join(SOURCES_DIR, "lirc-remotes");
  if (existsSync(lircRoot)) stats["lirc-remotes"] = ingestLirc(lircRoot);

  const setupLists = [];
  const smplPdf = join(SOURCES_DIR, "smpl-codes.pdf");
  if (existsSync(smplPdf)) {
    const r = ingestSmpl(smplPdf);
    setupLists.push({ id: "smpl-2019", ...r });
    stats["smpl-2019"] = { brands: r.brands, codes: r.codes };
  }
  const dishPdf = join(SOURCES_DIR, "dish-codes.pdf");
  if (existsSync(dishPdf)) {
    const r = ingestDish(dishPdf);
    setupLists.push({ id: "dish-634", ...r });
    stats["dish-634"] = { brands: r.brands, codes: r.codes };
  }

  // Finalise devices: fix brand display casing, serialise per category.
  mkdirSync(OUT_DIR, { recursive: true });
  const byCategory = new Map();
  let totalCodes = 0;
  for (const dev of devices.values()) {
    dev.brand = bestBrandDisplay(dev.brandKey);
    const buttons = [...dev.buttons.values()].map((btn) => ({
      name: btn.name,
      codes: [...btn.codes.values()].map((c) => ({ ...c, sources: [...c.sources] })),
    }));
    totalCodes += buttons.reduce((n, b) => n + b.codes.length, 0);
    const out = {
      brand: dev.brand,
      model: dev.model,
      category: dev.category,
      buttons,
      sources: [...dev.sources],
    };
    if (!byCategory.has(dev.category)) byCategory.set(dev.category, []);
    byCategory.get(dev.category).push(out);
  }

  const categoryIndex = [];
  for (const [cat, list] of [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    list.sort(
      (a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model),
    );
    // Shard by brand: the lookup fetches only the brand the Captain
    // picks, so no single download is ever a whole shelf.
    const perBrand = new Map();
    for (const d of list) {
      if (!perBrand.has(d.brand)) perBrand.set(d.brand, []);
      perBrand.get(d.brand).push(d);
    }
    for (const [brand, brandDevices] of perBrand) {
      writeFileSync(
        join(OUT_DIR, `devices-${cat}--${brandKey(brand)}.json`),
        JSON.stringify(brandDevices),
      );
    }
    const brands = [...perBrand.keys()].sort((a, b) => a.localeCompare(b));
    categoryIndex.push({
      id: cat,
      label: CATEGORY_LABELS[cat] || cat,
      devices: list.length,
      brands,
    });
  }

  // Global brand index: brand -> where its devices live, so the lookup
  // can find a brand across every shelf without loading all shards.
  const brandIndex = {};
  for (const c of categoryIndex) {
    const list = byCategory.get(c.id) || [];
    const perBrand = new Map();
    for (const d of list) perBrand.set(d.brand, (perBrand.get(d.brand) || 0) + 1);
    for (const [brand, n] of perBrand) {
      if (!brandIndex[brand]) brandIndex[brand] = [];
      brandIndex[brand].push({ category: c.id, devices: n });
    }
  }

  const setupIndex = [];
  for (const list of setupLists) {
    const { id, categories } = list;
    writeFileSync(
      join(OUT_DIR, `setup-${id}.json`),
      JSON.stringify({ id, categories }),
    );
    setupIndex.push({
      id,
      name: SOURCE_META[id].name,
      detail: SOURCE_META[id].detail,
      categories: Object.fromEntries(
        Object.entries(categories).map(([cat, brands]) => [
          cat,
          {
            label: CATEGORY_LABELS[cat] || cat,
            brands: Object.keys(brands).sort((a, b) => a.localeCompare(b)),
          },
        ]),
      ),
    });
  }

  const index = {
    generatedAt: new Date().toISOString(),
    sources: Object.entries(SOURCE_META)
      .filter(([id]) => stats[id])
      .map(([id, meta]) => ({ id, ...meta, stats: stats[id] })),
    totals: {
      devices: devices.size,
      codes: totalCodes,
      brands: brandCasings.size,
    },
    categories: categoryIndex,
    brandIndex,
    setupLists: setupIndex,
  };
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2));
  console.log(JSON.stringify(index.totals));
  console.log(JSON.stringify(stats, null, 2));
  for (const c of categoryIndex) console.log(`category ${c.id}: ${c.devices} devices`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
