/**
 * Browser-side capacity calculation for the Lovable app.
 *
 * Ported from the reference implementation. Uses the `date-holidays` npm package
 * (install it in Lovable: it is pure JS and bundles fine with Vite).
 *
 *   npm i date-holidays
 *
 * Feed it the selected quarter, the quarter's members (joined with their
 * location's country/region), the sub-teams, and the per-sub-team efforts.
 */
import Holidays from 'date-holidays';

export interface QuarterInput {
  start_date: string; // 'YYYY-MM-DD' inclusive
  end_date: string;   // 'YYYY-MM-DD' inclusive
}
export interface SubteamInput {
  id: number;
  name: string;
  color: string;
}
export interface MemberInput {
  id: number;
  name: string;
  subteam_id: number | null;
  capacity_index: number;
  vacation_days: number;
  country?: string | null; // ISO code from the member's location (e.g. 'DE')
  region?: string | null;  // optional state/canton (e.g. 'BE')
}
export interface EffortInput {
  subteam_id: number;
  planned_effort: number;
  actual_effort: number | null;
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

function parseISO(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function yearsInRange(start: string, end: string): number[] {
  const out: number[] = [];
  for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) out.push(y);
  return out;
}

const holidayCache = new Map<string, Set<string>>();

/** Public-holiday dates (YYYY-MM-DD) for a country/region across the given years. */
export function publicHolidaySet(country: string, region: string | null | undefined, years: number[]): Set<string> {
  const key = `${country}|${region ?? ''}|${years.join(',')}`;
  const cached = holidayCache.get(key);
  if (cached) return cached;
  let hd: Holidays;
  try {
    hd = region ? new Holidays(country, region) : new Holidays(country);
  } catch {
    hd = new Holidays(country);
  }
  const set = new Set<string>();
  for (const y of years) {
    for (const h of hd.getHolidays(y) || []) {
      if (h.type === 'public') set.add(String(h.date).slice(0, 10));
    }
  }
  holidayCache.set(key, set);
  return set;
}

/** Count Mon–Fri days in [start, end] inclusive, excluding any date in holidaySet. */
export function countWorkingDays(start: string, end: string, holidaySet: Set<string>): number {
  const cur = parseISO(start);
  const last = parseISO(end);
  let count = 0;
  while (cur <= last) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6 && !holidaySet.has(toISO(cur))) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

export interface SubteamSummary {
  subteamId: number;
  name: string;
  color: string;
  memberCount: number;
  capacity: number;
  plannedEffort: number;
  leftover: number;
  leftoverPct: number;
  retro: {
    actualEffort: number;
    effortVariance: number;              // actual − planned (+ve = under-estimated)
    estimateAccuracyPct: number | null;  // planned ÷ actual
    capacityUtilizationPct: number | null; // actual ÷ capacity
  } | null;
}

/** Full computed summary for a quarter. */
export function computeSummary(
  quarter: QuarterInput,
  subteams: SubteamInput[],
  members: MemberInput[],
  efforts: EffortInput[],
) {
  const years = yearsInRange(quarter.start_date, quarter.end_date);
  const grossWeekdays = countWorkingDays(quarter.start_date, quarter.end_date, new Set());
  const effortBy = new Map(efforts.map((e) => [e.subteam_id, e]));

  const memberResults = members.map((m) => {
    let holidays = 0;
    if (m.country) {
      const net = countWorkingDays(quarter.start_date, quarter.end_date, publicHolidaySet(m.country, m.region, years));
      holidays = grossWeekdays - net;
    }
    const workingDays = grossWeekdays - holidays;
    const afterVacation = Math.max(0, workingDays - m.vacation_days);
    return {
      id: m.id,
      name: m.name,
      subteamId: m.subteam_id,
      publicHolidays: holidays,
      workingDays,
      effectiveCapacity: round(afterVacation * m.capacity_index),
    };
  });

  const subteamSummaries: SubteamSummary[] = subteams.map((st) => {
    const mine = memberResults.filter((m) => m.subteamId === st.id);
    const capacity = round(mine.reduce((s, m) => s + m.effectiveCapacity, 0));
    const eff = effortBy.get(st.id);
    const planned = eff?.planned_effort ?? 0;
    const actual = eff?.actual_effort ?? null;
    const leftover = round(capacity - planned);
    const leftoverPct = capacity > 0 ? round((leftover / capacity) * 100) : 0;
    return {
      subteamId: st.id,
      name: st.name,
      color: st.color,
      memberCount: mine.length,
      capacity,
      plannedEffort: round(planned),
      leftover,
      leftoverPct,
      retro:
        actual !== null
          ? {
              actualEffort: round(actual),
              effortVariance: round(actual - planned),
              estimateAccuracyPct: planned > 0 ? round((planned / actual) * 100) : null,
              capacityUtilizationPct: capacity > 0 ? round((actual / capacity) * 100) : null,
            }
          : null,
    };
  });

  const totals = {
    capacity: round(subteamSummaries.reduce((s, x) => s + x.capacity, 0)),
    plannedEffort: round(subteamSummaries.reduce((s, x) => s + x.plannedEffort, 0)),
    leftover: round(subteamSummaries.reduce((s, x) => s + x.leftover, 0)),
  };

  return { grossWeekdays, members: memberResults, subteams: subteamSummaries, totals };
}

/** Health bucket for a leftover %: <5 = at/over capacity, 5–25 = healthy, >25 = slack. */
export function health(leftoverPct: number): 'bad' | 'good' | 'warn' {
  if (leftoverPct < 5) return 'bad';
  if (leftoverPct > 25) return 'warn';
  return 'good';
}
