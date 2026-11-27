/**
 * ASSET TRACERS — the data model (phone fix pass, owner order
 * 2026-11-27, from his Top 100 list #71): small GPS tracker
 * tags ride the truck, the vest, and the gear, and report
 * where they are onto his map. Paired with the asset tamper
 * guard: a watched asset also reports where it WENT if moved.
 *
 * HONEST STATE OF THE WORLD: no tag hardware is paired with
 * this build yet, so no report arrives on its own. This module
 * is the registry and the record the reports will land in —
 * a tracer is registered here (what it rides, where it
 * belongs), a report is a real position a tag sent (or, until
 * tags exist, a position the Captain enters by hand from the
 * tag's own app — labeled as entered, never dressed as a live
 * feed). The window (AssetTracersWindow) shows exactly what
 * is on this record and says "no report yet" where that is
 * the truth. Nothing here invents a position.
 *
 * Plain data + localStorage, per the repo's rules — the same
 * discipline as the medallion anchors: the record is sanitized
 * on load, and a corrupt record reads as an empty one.
 */

export type AssetTracerKind = "truck" | "vest" | "gear";

export interface AssetTracer {
  id: string;
  /** His name for the tag — "Truck tag", "Vest tag". */
  label: string;
  kind: AssetTracerKind;
  /** Where the asset belongs — the home anchor the tamper guard reads. */
  home: { lat: number; lng: number } | null;
  /** How far from home (meters) still counts as home ground. */
  homeRadiusM: number;
}

export interface AssetTracerReport {
  tracerId: string;
  at: number;
  lat: number;
  lng: number;
  /** "tag" = the tag sent it; "entered" = the Captain typed it from the tag's app. */
  source: "tag" | "entered";
}

export interface AssetTracersFile {
  tracers: AssetTracer[];
  reports: AssetTracerReport[];
}

export const ASSET_TRACERS_STORAGE_KEY = "augi.asset-tracers.v1";
/** A tracer that has not reported in a day is stale — the map says so. */
export const TRACER_STALE_MS = 24 * 60 * 60 * 1000;
export const TRACER_DEFAULT_HOME_RADIUS_M = 75;

function isLatLng(value: unknown): value is { lat: number; lng: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { lat?: unknown; lng?: unknown };
  return (
    typeof v.lat === "number" &&
    Number.isFinite(v.lat) &&
    v.lat >= -90 &&
    v.lat <= 90 &&
    typeof v.lng === "number" &&
    Number.isFinite(v.lng) &&
    v.lng >= -180 &&
    v.lng <= 180
  );
}

export function sanitizeAssetTracersFile(value: unknown): AssetTracersFile {
  if (typeof value !== "object" || value === null) return { tracers: [], reports: [] };
  const file = value as { tracers?: unknown; reports?: unknown };
  const tracers: AssetTracer[] = [];
  if (Array.isArray(file.tracers)) {
    for (const raw of file.tracers) {
      if (typeof raw !== "object" || raw === null) continue;
      const t = raw as Partial<AssetTracer>;
      if (typeof t.id !== "string" || !t.id) continue;
      if (typeof t.label !== "string" || !t.label.trim()) continue;
      if (t.kind !== "truck" && t.kind !== "vest" && t.kind !== "gear") continue;
      tracers.push({
        id: t.id,
        label: t.label.trim().slice(0, 60),
        kind: t.kind,
        home: isLatLng(t.home) ? { lat: t.home.lat, lng: t.home.lng } : null,
        homeRadiusM:
          typeof t.homeRadiusM === "number" && t.homeRadiusM > 0
            ? Math.min(10_000, Math.round(t.homeRadiusM))
            : TRACER_DEFAULT_HOME_RADIUS_M,
      });
    }
  }
  const known = new Set(tracers.map((t) => t.id));
  const reports: AssetTracerReport[] = [];
  if (Array.isArray(file.reports)) {
    for (const raw of file.reports) {
      if (typeof raw !== "object" || raw === null) continue;
      const r = raw as Partial<AssetTracerReport>;
      if (typeof r.tracerId !== "string" || !known.has(r.tracerId)) continue;
      if (typeof r.at !== "number" || !Number.isFinite(r.at)) continue;
      const point = { lat: r.lat, lng: r.lng };
      if (!isLatLng(point)) continue;
      reports.push({
        tracerId: r.tracerId,
        at: r.at,
        lat: point.lat,
        lng: point.lng,
        source: r.source === "tag" ? "tag" : "entered",
      });
    }
  }
  reports.sort((a, b) => a.at - b.at);
  return { tracers, reports };
}

export function loadAssetTracers(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): AssetTracersFile {
  try {
    const raw = storage?.getItem(ASSET_TRACERS_STORAGE_KEY);
    return sanitizeAssetTracersFile(raw ? (JSON.parse(raw) as unknown) : null);
  } catch {
    return { tracers: [], reports: [] };
  }
}

export function saveAssetTracers(
  file: AssetTracersFile,
  storage: Pick<Storage, "setItem"> | undefined = safeStorage(),
) {
  try {
    storage?.setItem(ASSET_TRACERS_STORAGE_KEY, JSON.stringify(file));
  } catch {
    // best effort only — the registry is a convenience record
  }
}

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Great-circle distance in meters — the tamper guard's measure. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h))));
}

export type TracerStanding = "no-report" | "home" | "moved" | "away-no-home";

export interface TracerStatus {
  tracer: AssetTracer;
  lastReport: AssetTracerReport | null;
  standing: TracerStanding;
  /** Distance from home in meters, when both ends are known. */
  distanceFromHomeM: number | null;
  /** The last report is older than the stale line. */
  stale: boolean;
}

/**
 * Each tracer's standing, from the record alone: no report →
 * "no-report" (the map shows the tag as silent, never guesses
 * a place); a report inside the home radius → "home"; outside
 * it → "moved" (the tamper guard's flag); no home set →
 * "away-no-home" (a place is known, home is not, so no moved
 * claim is made).
 */
export function tracerStatuses(file: AssetTracersFile, now: number): TracerStatus[] {
  return file.tracers.map((tracer) => {
    const reports = file.reports.filter((r) => r.tracerId === tracer.id);
    const lastReport = reports.length ? reports[reports.length - 1]! : null;
    if (!lastReport) {
      return { tracer, lastReport: null, standing: "no-report", distanceFromHomeM: null, stale: false };
    }
    const stale = now - lastReport.at > TRACER_STALE_MS;
    if (!tracer.home) {
      return { tracer, lastReport, standing: "away-no-home", distanceFromHomeM: null, stale };
    }
    const distance = distanceMeters(tracer.home, lastReport);
    return {
      tracer,
      lastReport,
      standing: distance <= tracer.homeRadiusM ? "home" : "moved",
      distanceFromHomeM: distance,
      stale,
    };
  });
}

/**
 * The local plot: every known point (homes + last reports)
 * projected onto a 0..1 square around their own bounds — a
 * relative map of his ground, drawn from the record, with no
 * tiles and no outside service. Null when there is nothing to
 * plot.
 */
export function tracerPlotPoints(
  file: AssetTracersFile,
): { id: string; kind: "home" | "report"; x: number; y: number }[] | null {
  const statuses = tracerStatuses(file, Date.now());
  const raw: { id: string; kind: "home" | "report"; lat: number; lng: number }[] = [];
  for (const status of statuses) {
    if (status.tracer.home) {
      raw.push({ id: `${status.tracer.id}:home`, kind: "home", lat: status.tracer.home.lat, lng: status.tracer.home.lng });
    }
    if (status.lastReport) {
      raw.push({ id: `${status.tracer.id}:report`, kind: "report", lat: status.lastReport.lat, lng: status.lastReport.lng });
    }
  }
  if (!raw.length) return null;
  const lats = raw.map((p) => p.lat);
  const lngs = raw.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = Math.max(0.0004, maxLat - minLat);
  const spanLng = Math.max(0.0004, maxLng - minLng);
  return raw.map((p) => ({
    id: p.id,
    kind: p.kind,
    x: 0.08 + 0.84 * ((p.lng - minLng) / spanLng),
    y: 0.92 - 0.84 * ((p.lat - minLat) / spanLat),
  }));
}
