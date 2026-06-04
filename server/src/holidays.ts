import Holidays from 'date-holidays';

/** Parse a YYYY-MM-DD string into a UTC date (no timezone surprises). */
function parseISO(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** All distinct calendar years touched by an inclusive [start, end] range. */
export function yearsInRange(start: string, end: string): number[] {
  const y0 = Number(start.slice(0, 4));
  const y1 = Number(end.slice(0, 4));
  const out: number[] = [];
  for (let y = y0; y <= y1; y++) out.push(y);
  return out;
}

export interface HolidayInfo {
  date: string; // YYYY-MM-DD
  name: string;
}

const cache = new Map<string, Set<string>>();

/**
 * Set of public-holiday dates (YYYY-MM-DD) for a country/region across the given years.
 * Results are cached per country|region|year-span.
 */
export function publicHolidaySet(country: string, region: string | null, years: number[]): Set<string> {
  const key = `${country}|${region ?? ''}|${years.join(',')}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let hd: Holidays;
  try {
    hd = region ? new Holidays(country, region) : new Holidays(country);
  } catch {
    hd = new Holidays(country);
  }

  const set = new Set<string>();
  for (const year of years) {
    const holidays = hd.getHolidays(year) || [];
    for (const h of holidays) {
      // Count statutory public holidays only (skip bank/optional/observance/school).
      if (h.type === 'public') {
        set.add(String(h.date).slice(0, 10));
      }
    }
  }
  cache.set(key, set);
  return set;
}

/** List public holidays (with names) that fall within the inclusive range, on weekdays. */
export function holidaysInRange(country: string, region: string | null, start: string, end: string): HolidayInfo[] {
  let hd: Holidays;
  try {
    hd = region ? new Holidays(country, region) : new Holidays(country);
  } catch {
    hd = new Holidays(country);
  }
  const out: HolidayInfo[] = [];
  const seen = new Set<string>();
  for (const year of yearsInRange(start, end)) {
    for (const h of hd.getHolidays(year) || []) {
      if (h.type !== 'public') continue;
      const iso = String(h.date).slice(0, 10);
      if (iso < start || iso > end || seen.has(iso)) continue;
      const dow = parseISO(iso).getUTCDay();
      if (dow === 0 || dow === 6) continue; // weekend holidays don't reduce working days
      seen.add(iso);
      out.push({ date: iso, name: h.name });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/**
 * Count working days (Mon–Fri) in the inclusive range, excluding any dates in `holidaySet`.
 * Pass an empty set to get gross weekday count.
 */
export function countWorkingDays(start: string, end: string, holidaySet: Set<string>): number {
  const cur = parseISO(start);
  const last = parseISO(end);
  let count = 0;
  while (cur <= last) {
    const dow = cur.getUTCDay();
    const iso = toISO(cur);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}
