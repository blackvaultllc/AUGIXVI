/**
 * THE CAPTAIN'S CLOCK — every daily rhythm in his learning
 * (the quote of the day, the quote of the night, prayer time,
 * the training record) runs on HIS time: America/Chicago,
 * wherever the surface happens to be. Pure functions over an
 * instant, so the rotation and the schedule are unit-testable
 * without a browser and identical on every surface.
 */

export const CAPTAIN_TIME_ZONE = "America/Chicago";

export type ChicagoParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
};

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAPTAIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function chicagoParts(at: Date | number): ChicagoParts {
  const date = typeof at === "number" ? new Date(at) : at;
  const out: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = Number.parseInt(part.value, 10);
  }
  return {
    year: out["year"] ?? 1970,
    month: out["month"] ?? 1,
    day: out["day"] ?? 1,
    hour: out["hour"] ?? 0,
    minute: out["minute"] ?? 0,
  };
}

/** His calendar date, YYYY-MM-DD, in Chicago. */
export function chicagoDateISO(at: Date | number): string {
  const p = chicagoParts(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/**
 * Whole days since the epoch FOR HIS CALENDAR DATE — the same
 * number all day long in Chicago, one more each midnight of his.
 * The quote rotation and the day-to-day training line key off it.
 */
export function chicagoDayNumber(at: Date | number): number {
  const p = chicagoParts(at);
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);
}

/** Minutes since his midnight (0-1439). */
export function chicagoMinutesOfDay(at: Date | number): number {
  const p = chicagoParts(at);
  return p.hour * 60 + p.minute;
}
