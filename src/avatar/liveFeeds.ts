/**
 * LIVE FEEDS — real time, real sources, never invented (owner order 2026-11-10).
 * Weather, news, time, inbox: every item carries its SOURCE and TIMESTAMP.
 * Unavailable says UNAVAILABLE; stale says STALE with the age. If a feed
 * can't be reached, Osiris says so plainly instead of making something up.
 *
 * Pure fetchers + pure formatting so the brain layer can inject facts with
 * provenance. No keys in client code: endpoints are public/open ones, and
 * calendar comes from the local device ICS-free day view (no account).
 */

export type FeedFreshness = "live" | "stale" | "unavailable";

export type LiveFeedItem = {
  kind: "weather" | "news" | "inbox" | "calendar";
  freshness: FeedFreshness;
  /** Age in ms when staleness is known; null when unknown/unavailable. */
  ageMs: number | null;
  source: string;
  fetchedAt: string | null;
  lines: string[];
};

export const STALE_AFTER_MS = 15 * 60 * 1000;

export function classifyFreshness(fetchedAtMs: number | null, nowMs = Date.now()): FeedFreshness {
  if (fetchedAtMs === null) return "unavailable";
  const age = nowMs - fetchedAtMs;
  if (age < 0) return "live";
  return age <= STALE_AFTER_MS ? "live" : "stale";
}

export function formatFeedLine(item: LiveFeedItem): string {
  const stamp =
    item.freshness === "unavailable"
      ? "UNAVAILABLE"
      : item.freshness === "stale" && item.ageMs !== null
        ? `STALE · ${Math.round(item.ageMs / 60000)} min old`
        : "LIVE";
  const when = item.fetchedAt ? ` (${item.fetchedAt})` : "";
  const body = item.lines.length ? item.lines.join(" · ") : "no data";
  return `${item.kind.toUpperCase()} [${stamp}] via ${item.source}${when}: ${body}`;
}

export function summarizeFeeds(items: LiveFeedItem[]): string {
  if (!items.length) return "No feeds configured — everything is UNAVAILABLE right now.";
  return items.map(formatFeedLine).join("\n");
}

/** Deterministic, testable clock line — never a guess. */
export function formatLocalTime(now: Date): string {
  return now.toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<LiveFeedItem> {
  const fetchedAtMs = Date.now();
  try {
    const init: RequestInit = signal ? { signal } : {};
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`,
      init,
    );
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const temperature = data.current?.temperature_2m;
    if (typeof temperature !== "number") throw new Error("no temperature");
    return {
      kind: "weather",
      freshness: "live",
      ageMs: 0,
      source: "open-meteo.com",
      fetchedAt: new Date(fetchedAtMs).toISOString(),
      lines: [`${Math.round(temperature)}°F, weather code ${data.current?.weather_code ?? "?"}`],
    };
  } catch {
    return {
      kind: "weather",
      freshness: "unavailable",
      ageMs: null,
      source: "open-meteo.com",
      fetchedAt: null,
      lines: [],
    };
  }
}

/** RSS headline titles via a public, keyless relay. */
export async function fetchNews(signal?: AbortSignal): Promise<LiveFeedItem> {
  const fetchedAtMs = Date.now();
  try {
    const init: RequestInit = signal ? { signal } : {};
    const response = await fetch(
      "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.bbci.co.uk%2Fnews%2Fworld%2Frss.xml",
      init,
    );
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as { items?: Array<{ title?: string }> };
    const titles = (data.items ?? [])
      .slice(0, 5)
      .map((entry) => entry.title?.trim())
      .filter((title): title is string => Boolean(title));
    if (!titles.length) throw new Error("no items");
    return {
      kind: "news",
      freshness: "live",
      ageMs: 0,
      source: "BBC World via rss2json",
      fetchedAt: new Date(fetchedAtMs).toISOString(),
      lines: titles,
    };
  } catch {
    return {
      kind: "news",
      freshness: "unavailable",
      ageMs: null,
      source: "BBC World via rss2json",
      fetchedAt: null,
      lines: [],
    };
  }
}

/** Inbox feed is UNAVAILABLE by design until the operator connects one — never invented. */
export function unavailableFeed(kind: LiveFeedItem["kind"], source: string): LiveFeedItem {
  return {
    kind,
    freshness: "unavailable",
    ageMs: null,
    source,
    fetchedAt: null,
    lines: [],
  };
}

/** One-call helper for "what's happening today?". */
export async function gatherDailyBriefing(coords?: { latitude: number; longitude: number }) {
  const now = new Date();
  const items: LiveFeedItem[] = [];
  if (coords) items.push(await fetchWeather(coords.latitude, coords.longitude));
  items.push(await fetchNews());
  items.push(unavailableFeed("inbox", "not connected"));
  return {
    timeLine: `It is ${formatLocalTime(now)}.`,
    feeds: items,
    spoken: summarizeFeeds(items),
  };
}
