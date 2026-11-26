/**
 * PRAYER TIME (owner order 2026-11-26): his prayer is read out
 * FOUR times a day while he is on the program. The stage
 * surfaces a calm "Prayer time" pill; he clicks it, and the
 * prayer is read aloud to him. It is never auto-played — his
 * click starts it, in his words: "it'll say prayer time. And
 * I click it and it will read it out loud to me."
 *
 * THE SCHEDULE: four fixed times across his waking day, in
 * his timezone (America/Chicago) — morning, midday, afternoon,
 * evening. A time becomes DUE at its minute and stays due
 * until the next prayer time arrives (the last one until his
 * midnight). Each time can fire at most once per day: once he
 * has heard it, the day's record says so and it does not come
 * back. The due-math is pure and unit-tested; the done-record
 * is a small client map (the prompt lives on the surface; the
 * prayer TEXT is the core's record, never this map).
 */
import { chicagoDateISO, chicagoMinutesOfDay } from "./time";

export type PrayerSlotId = "morning" | "midday" | "afternoon" | "evening";

export interface PrayerSlot {
  id: PrayerSlotId;
  label: string;
  hour: number; // his time, America/Chicago
  minute: number;
}

export const PRAYER_SLOTS: readonly PrayerSlot[] = [
  { id: "morning", label: "Morning", hour: 7, minute: 0 },
  { id: "midday", label: "Midday", hour: 12, minute: 0 },
  { id: "afternoon", label: "Afternoon", hour: 17, minute: 0 },
  { id: "evening", label: "Evening", hour: 21, minute: 0 },
];

/** dateISO (his day) -> the slot ids already heard that day. */
export type PrayerDoneMap = Record<string, readonly string[]>;

function slotStartMinutes(slot: PrayerSlot): number {
  return slot.hour * 60 + slot.minute;
}

/**
 * The slot whose window holds this instant: the latest slot
 * whose time has come, provided it has not already been heard
 * today. Null before the first prayer time of the day, and
 * null once every due slot has been heard.
 */
export function duePrayerSlot(at: Date | number, done: PrayerDoneMap): PrayerSlot | null {
  const minutes = chicagoMinutesOfDay(at);
  const heard = done[chicagoDateISO(at)] ?? [];
  let current: PrayerSlot | null = null;
  for (const slot of PRAYER_SLOTS) {
    if (minutes >= slotStartMinutes(slot)) current = slot;
  }
  if (!current) return null;
  return heard.includes(current.id) ? null : current;
}

/** The day's slots still ahead of this instant (not yet due, not yet heard). */
export function prayerSlotsRemaining(at: Date | number, done: PrayerDoneMap): PrayerSlot[] {
  const minutes = chicagoMinutesOfDay(at);
  const heard = done[chicagoDateISO(at)] ?? [];
  return PRAYER_SLOTS.filter(
    (slot) => slotStartMinutes(slot) > minutes && !heard.includes(slot.id),
  );
}

/** Pure: a new done-map with this slot heard on this day. */
export function markPrayerHeard(done: PrayerDoneMap, dateISO: string, slotId: PrayerSlotId): PrayerDoneMap {
  const heard = done[dateISO] ?? [];
  if (heard.includes(slotId)) return done;
  return { ...done, [dateISO]: [...heard, slotId] };
}

export function prayerSlotLabel(slotId: PrayerSlotId): string {
  return PRAYER_SLOTS.find((slot) => slot.id === slotId)?.label ?? slotId;
}

export function prayerTimeLine(slot: PrayerSlot): string {
  const hour12 = slot.hour % 12 === 0 ? 12 : slot.hour % 12;
  const meridiem = slot.hour < 12 ? "AM" : "PM";
  const minute = String(slot.minute).padStart(2, "0");
  return `${hour12}:${minute} ${meridiem}`;
}

/* ------------------------- done record (client) ------------------------- */

const DONE_KEY = "augi.learning.prayer-done.v1";

export function loadPrayerDone(storage?: Pick<Storage, "getItem">): PrayerDoneMap {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(DONE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<string, readonly string[]> = {};
    for (const [day, slots] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(slots)) {
        out[day] = slots.filter((s): s is string => typeof s === "string");
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function savePrayerDone(
  done: PrayerDoneMap,
  storage?: Pick<Storage, "getItem" | "setItem">,
): PrayerDoneMap {
  try {
    // Keep the newest week of days — the record is a courtesy,
    // not an archive; the core keeps his real records.
    const days = Object.keys(done).sort();
    const trimmed: PrayerDoneMap = {};
    for (const day of days.slice(-7)) trimmed[day] = done[day]!;
    (storage ?? globalThis.localStorage)?.setItem(DONE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch {
    return done;
  }
}
