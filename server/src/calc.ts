import { db } from './db.js';
import { countWorkingDays, holidaysInRange, publicHolidaySet, yearsInRange } from './holidays.js';

const round = (n: number, dp = 1): number => Math.round(n * 10 ** dp) / 10 ** dp;

interface QuarterRow {
  id: number;
  label: string;
  year: number;
  quarter: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface QuarterMemberRow {
  id: number;
  name: string;
  subteam_id: number | null;
  location_id: number | null;
  capacity_index: number;
  vacation_days: number;
  location_name: string | null;
  country: string | null;
  region: string | null;
}

/**
 * Build the full computed summary for a quarter: per-member capacity, per-sub-team
 * capacity vs. planned/actual effort, leftover %, and retrospective accuracy.
 */
export function buildQuarterSummary(quarterId: number) {
  const quarter = db.prepare('SELECT * FROM quarters WHERE id = ?').get(quarterId) as QuarterRow | undefined;
  if (!quarter) return null;

  const years = yearsInRange(quarter.start_date, quarter.end_date);
  const grossWeekdays = countWorkingDays(quarter.start_date, quarter.end_date, new Set());

  const subteams = db.prepare('SELECT * FROM subteams ORDER BY sort_order, name').all() as Array<{
    id: number;
    name: string;
    color: string;
  }>;

  const members = db
    .prepare(
      `SELECT qm.*, l.name AS location_name, l.country, l.region
       FROM quarter_members qm
       LEFT JOIN locations l ON l.id = qm.location_id
       WHERE qm.quarter_id = ?
       ORDER BY qm.name`
    )
    .all(quarterId) as QuarterMemberRow[];

  const efforts = db.prepare('SELECT * FROM quarter_efforts WHERE quarter_id = ?').all(quarterId) as Array<{
    subteam_id: number;
    planned_effort: number;
    actual_effort: number | null;
  }>;
  const effortBySubteam = new Map(efforts.map((e) => [e.subteam_id, e]));

  // Per-member capacity computation.
  const memberResults = members.map((m) => {
    let holidayCount = 0;
    if (m.country) {
      const set = publicHolidaySet(m.country, m.region, years);
      const net = countWorkingDays(quarter.start_date, quarter.end_date, set);
      holidayCount = grossWeekdays - net;
    }
    const workingDays = grossWeekdays - holidayCount;
    const afterVacation = Math.max(0, workingDays - m.vacation_days);
    const effectiveCapacity = afterVacation * m.capacity_index;
    return {
      id: m.id,
      name: m.name,
      subteamId: m.subteam_id,
      locationId: m.location_id,
      locationName: m.location_name,
      capacityIndex: m.capacity_index,
      vacationDays: m.vacation_days,
      publicHolidays: holidayCount,
      grossWorkingDays: workingDays,
      availableDaysBeforeIndex: round(afterVacation),
      effectiveCapacity: round(effectiveCapacity),
    };
  });

  // Aggregate per sub-team.
  const subteamResults = subteams.map((st) => {
    const stMembers = memberResults.filter((m) => m.subteamId === st.id);
    const capacity = stMembers.reduce((sum, m) => sum + m.effectiveCapacity, 0);
    const effort = effortBySubteam.get(st.id);
    const planned = effort?.planned_effort ?? 0;
    const actual = effort?.actual_effort ?? null;
    const leftover = capacity - planned;
    const leftoverPct = capacity > 0 ? (leftover / capacity) * 100 : 0;

    const retro =
      actual !== null
        ? {
            actualEffort: round(actual),
            effortVariance: round(actual - planned), // +ve => under-estimated effort
            estimateAccuracyPct: planned > 0 ? round((planned / actual) * 100) : null,
            capacityUtilizationPct: capacity > 0 ? round((actual / capacity) * 100) : null,
          }
        : null;

    return {
      subteamId: st.id,
      name: st.name,
      color: st.color,
      memberCount: stMembers.length,
      capacity: round(capacity),
      plannedEffort: round(planned),
      leftover: round(leftover),
      leftoverPct: round(leftoverPct),
      retro,
    };
  });

  const totals = {
    capacity: round(subteamResults.reduce((s, x) => s + x.capacity, 0)),
    plannedEffort: round(subteamResults.reduce((s, x) => s + x.plannedEffort, 0)),
    leftover: round(subteamResults.reduce((s, x) => s + x.leftover, 0)),
  };

  // Holiday calendars referenced by this quarter's members (for transparency in the UI).
  const usedLocations = new Map<number, QuarterMemberRow>();
  for (const m of members) if (m.location_id && m.country) usedLocations.set(m.location_id, m);
  const holidayCalendars = [...usedLocations.values()].map((m) => ({
    locationId: m.location_id,
    locationName: m.location_name,
    holidays: holidaysInRange(m.country!, m.region, quarter.start_date, quarter.end_date),
  }));

  return {
    quarter,
    grossWeekdays,
    members: memberResults,
    subteams: subteamResults,
    totals,
    holidayCalendars,
  };
}
