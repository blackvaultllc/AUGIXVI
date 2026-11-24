/**
 * REMOTE CODES — Augie's RF/IR knowledge (owner order 2026-11-24).
 *
 * The library itself is data, not code: public/rf-library/*.json,
 * built by tools/rf-library/ingest.mjs from the real public corpora
 * (Flipper IRDB, irdb, the LIRC remote library, and the printed SMPL
 * and DISH universal-remote code lists). It is served by this app, so
 * it works with the network unplugged — local-first law. Every code
 * carries the name of the source it came from; a brand or model that
 * is not in the sources is not in the library.
 *
 * This module is the plain-TS half: types, loading, searching, and
 * formatting — unit-testable without the stage (per AGENTS.md).
 *
 * PRONTO HEX: the corpora carry codes as protocol/address/command or
 * as raw timings. Pronto hex is a *format* for raw timings, so it is
 * converted here at display time (rawToPronto) — never stored, never
 * invented: the same numbers, written the Pronto way.
 */

export interface RfCode {
  protocol?: string;
  address?: string;
  command?: string;
  /** Raw timings in microseconds, alternating on/off, starting on. */
  raw?: string;
  frequency?: number;
  sources: string[];
}

export interface RfButton {
  name: string;
  codes: RfCode[];
}

export interface RfDevice {
  brand: string;
  model: string;
  category: string;
  buttons: RfButton[];
  sources: string[];
}

export interface RfSourceInfo {
  id: string;
  name: string;
  detail: string;
  stats?: { files?: number; brands?: number; codes?: number };
}

export interface RfCategoryInfo {
  id: string;
  label: string;
  devices: number;
  brands: string[];
}

export interface RfSetupListInfo {
  id: string;
  name: string;
  detail: string;
  categories: Record<string, { label: string; brands: string[] }>;
}

export interface RfIndex {
  generatedAt: string;
  sources: RfSourceInfo[];
  totals: { devices: number; codes: number; brands: number };
  categories: RfCategoryInfo[];
  brandIndex: Record<string, { category: string; devices: number }[]>;
  setupLists: RfSetupListInfo[];
}

export interface RfSetupListData {
  id: string;
  categories: Record<string, Record<string, string[]>>;
}

/** Mirrors brandKey() in tools/rf-library/ingest.mjs — shard file names. */
export function rfBrandKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

type FetchFn = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const defaultFetch: FetchFn = (url) => fetch(url);

export async function loadRfIndex(fetchFn: FetchFn = defaultFetch): Promise<RfIndex> {
  const res = await fetchFn("/rf-library/index.json");
  if (!res.ok) throw new Error("rf index unavailable");
  return (await res.json()) as RfIndex;
}

export async function loadRfBrandDevices(
  category: string,
  brand: string,
  fetchFn: FetchFn = defaultFetch,
): Promise<RfDevice[]> {
  const res = await fetchFn(
    `/rf-library/devices-${category}--${rfBrandKey(brand)}.json`,
  );
  if (!res.ok) throw new Error("rf brand shard unavailable");
  return (await res.json()) as RfDevice[];
}

export async function loadRfSetupList(
  id: string,
  fetchFn: FetchFn = defaultFetch,
): Promise<RfSetupListData> {
  const res = await fetchFn(`/rf-library/setup-${id}.json`);
  if (!res.ok) throw new Error("rf setup list unavailable");
  return (await res.json()) as RfSetupListData;
}

/* ---------------- searching ---------------- */

/** All brands in the library, with their total device counts. */
export function allBrands(index: RfIndex): { brand: string; devices: number }[] {
  return Object.entries(index.brandIndex)
    .map(([brand, shelves]) => ({
      brand,
      devices: shelves.reduce((n, s) => n + s.devices, 0),
    }))
    .sort((a, b) => a.brand.localeCompare(b.brand));
}

export function searchBrands(index: RfIndex, query: string): { brand: string; devices: number }[] {
  const q = query.trim().toLowerCase();
  const all = allBrands(index);
  if (!q) return all;
  return all.filter((b) => b.brand.toLowerCase().includes(q));
}

export function filterNames(names: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return names;
  return names.filter((n) => n.toLowerCase().includes(q));
}

/* ---------------- formatting ---------------- */

export function sourceNames(index: RfIndex | null, ids: string[]): string {
  if (!index) return ids.join(", ");
  return ids
    .map((id) => index.sources.find((s) => s.id === id)?.name ?? id)
    .join(" + ");
}

/** One plain line describing a code — what the remote surface shows. */
export function formatCodeLine(code: RfCode): string {
  if (code.raw) {
    const n = code.raw.split(/\s+/).filter(Boolean).length;
    const hz = code.frequency ? `${code.frequency.toLocaleString()} Hz` : "raw signal";
    return `Raw signal · ${hz} · ${n} timings`;
  }
  const parts = [code.protocol || "Code"];
  if (code.address) parts.push(`address ${code.address}`);
  if (code.command) parts.push(`code ${code.command}`);
  return parts.join(" · ");
}

/** The text the Copy button puts on the clipboard for a code. */
export function codeCopyText(code: RfCode, buttonName: string): string {
  if (code.raw) {
    const pronto = rawToPronto(code.raw, code.frequency);
    return pronto ? `${buttonName}\nPronto hex:\n${pronto}` : `${buttonName}\nRaw timings (microseconds):\n${code.raw}`;
  }
  const lines = [buttonName];
  if (code.protocol) lines.push(`Protocol: ${code.protocol}`);
  if (code.address) lines.push(`Address: ${code.address}`);
  if (code.command) lines.push(`Code: ${code.command}`);
  return lines.join("\n");
}

/* ---------------- Pronto hex conversion ---------------- */

/**
 * Convert raw microsecond timings to a Pronto hex "learned code"
 * (format 0000). Deterministic and reversible within rounding: each
 * timing becomes a count of carrier periods. If the timing list has
 * an odd length (ends on an "on"), a plain trailing gap is appended —
 * a framing space, not part of the code.
 */
export function rawToPronto(raw: string, frequency?: number): string | null {
  const freq = frequency && frequency > 0 ? frequency : 38000;
  const timings = raw
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => Number(t))
    .filter((t) => Number.isFinite(t) && t > 0);
  if (timings.length < 2) return null;
  const periodUs = 1_000_000 / freq;
  const freqWord = Math.round(periodUs / 0.241246);
  if (freqWord <= 0) return null;
  const realPeriodUs = freqWord * 0.241246;
  const pairs: [number, number][] = [];
  for (let i = 0; i < timings.length; i += 2) {
    const onRaw = timings[i];
    if (onRaw === undefined) break;
    const offRaw = timings[i + 1];
    const off = offRaw === undefined ? 30000 : offRaw;
    pairs.push([
      Math.max(1, Math.round(onRaw / realPeriodUs)),
      Math.max(1, Math.round(off / realPeriodUs)),
    ]);
  }
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
  const words = ["0000", hex(freqWord), hex(pairs.length), "0000"];
  for (const pair of pairs) {
    words.push(hex(pair[0]), hex(pair[1]));
  }
  return words.join(" ");
}

/* ---------------- plain-words help ---------------- */

/**
 * The how-to, written the Captain's way (2026-11-24): plain layman
 * steps a five-year-old could follow. Complexity in writing is just
 * confusion. These same words live in the window's Help and in the
 * Master Manual entry.
 */
export const RF_HELP_STEPS: string[] = [
  "Pick what you want to control — a TV, a sound bar, an air conditioner.",
  "Pick the brand name written on it — Samsung, Sony, LG, and so on.",
  "Pick your model if you see it. If you do not see your model, pick one with the same brand. Most brands use the same codes for many models.",
  "You will see the buttons of the remote, one by one. Tap a button, like Power.",
  "Augie shows you that button's code. Tap Copy to copy it.",
  "When your blaster is hooked up, this same screen will send the code for you. Today it shows and copies — it does not send yet.",
];

export const RF_SETUP_STEPS: string[] = [
  "Setup numbers are the short numbers you type into a universal remote so it learns your TV.",
  "Pick the list that matches your remote — the SMPL list for an SMPL remote, the DISH list for a DISH remote.",
  "Pick the kind of device, then the brand.",
  "Hold your remote's setup button the way its little book says, then type the first number on the list.",
  "Point the remote at the TV and press Power.",
  "If the TV answers, you are done. If nothing happens, type the next number and press Power again.",
  "Keep going down the list until one works. The right number is almost always on the list.",
];

export const RF_NOT_FOUND_WORDS =
  "If your brand is not here, it is not in the public lists Augie loaded. That is the honest answer — Augie will not make up a code. A learning remote or the blaster's learn mode (when it is hooked up) can copy the code straight from your real remote instead.";
