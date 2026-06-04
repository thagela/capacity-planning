export interface Subteam {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

export interface Location {
  id: number;
  name: string;
  country: string;
  region: string | null;
}

export interface Member {
  id: number;
  name: string;
  subteam_id: number | null;
  location_id: number | null;
  capacity_index: number;
  active: number;
  subteam_name?: string | null;
  location_name?: string | null;
}

export type QuarterStatus = 'planning' | 'active' | 'completed';

export interface Quarter {
  id: number;
  label: string;
  year: number;
  quarter: number;
  start_date: string;
  end_date: string;
  status: QuarterStatus;
}

export interface QuarterMember {
  id: number;
  quarter_id: number;
  member_id: number | null;
  name: string;
  subteam_id: number | null;
  location_id: number | null;
  capacity_index: number;
  vacation_days: number;
  subteam_name?: string | null;
  subteam_color?: string | null;
  location_name?: string | null;
}

export interface Effort {
  id: number;
  quarter_id: number;
  subteam_id: number;
  planned_effort: number;
  actual_effort: number | null;
}

export interface MemberSummary {
  id: number;
  name: string;
  subteamId: number | null;
  locationId: number | null;
  locationName: string | null;
  capacityIndex: number;
  vacationDays: number;
  publicHolidays: number;
  grossWorkingDays: number;
  availableDaysBeforeIndex: number;
  effectiveCapacity: number;
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
    effortVariance: number;
    estimateAccuracyPct: number | null;
    capacityUtilizationPct: number | null;
  } | null;
}

export interface HolidayCalendar {
  locationId: number | null;
  locationName: string | null;
  holidays: { date: string; name: string }[];
}

export interface QuarterSummary {
  quarter: Quarter;
  grossWeekdays: number;
  members: MemberSummary[];
  subteams: SubteamSummary[];
  totals: { capacity: number; plannedEffort: number; leftover: number };
  holidayCalendars: HolidayCalendar[];
}
