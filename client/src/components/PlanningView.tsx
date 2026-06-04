import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Location, Member, MemberSummary, Quarter, QuarterMember, QuarterSummary, Subteam } from '../types';
import { fmt } from '../format';

interface Props {
  quarter: Quarter | null;
  subteams: Subteam[];
  locations: Location[];
  members: Member[];
  reportError: (msg: string) => void;
}

export default function PlanningView({ quarter, subteams, locations, members, reportError }: Props) {
  const [rows, setRows] = useState<QuarterMember[]>([]);
  const [summary, setSummary] = useState<QuarterSummary | null>(null);

  const load = useCallback(async () => {
    if (!quarter) {
      setRows([]);
      setSummary(null);
      return;
    }
    try {
      const [qm, sum] = await Promise.all([
        api.get<QuarterMember[]>(`/quarters/${quarter.id}/members`),
        api.get<QuarterSummary>(`/quarters/${quarter.id}/summary`),
      ]);
      setRows(qm);
      setSummary(sum);
    } catch (e: any) {
      reportError(e.message);
    }
  }, [quarter, reportError]);

  useEffect(() => {
    load();
  }, [load]);

  if (!quarter) return <div className="empty">Select or create a quarter to start planning.</div>;

  const summaryById = new Map<number, MemberSummary>((summary?.members ?? []).map((m) => [m.id, m]));

  async function save(row: QuarterMember, patch: Partial<QuarterMember>) {
    const next = { ...row, ...patch };
    setRows((rs) => rs.map((r) => (r.id === row.id ? next : r))); // optimistic
    try {
      await api.put(`/quarter-members/${row.id}`, next);
      load();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  async function addMember() {
    try {
      await api.post(`/quarters/${quarter!.id}/members`, {
        name: 'New member',
        subteam_id: subteams[0]?.id ?? null,
        location_id: locations[0]?.id ?? null,
        capacity_index: 0.8,
        vacation_days: 0,
      });
      load();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  async function importRoster() {
    try {
      await api.post(`/quarters/${quarter!.id}/import-roster`);
      load();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  async function remove(row: QuarterMember) {
    try {
      await api.del(`/quarter-members/${row.id}`);
      load();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  // Group rows by sub-team, preserving sub-team order.
  const groups = subteams.map((st) => ({
    subteam: st,
    rows: rows.filter((r) => r.subteam_id === st.id),
  }));
  const ungrouped = rows.filter((r) => !subteams.some((st) => st.id === r.subteam_id));

  return (
    <>
      <div className="panel">
        <div className="row between">
          <div>
            <h2>Capacity Planning — {quarter.label}</h2>
            <p className="sub">
              {summary ? `${summary.grossWeekdays} working weekdays in this quarter (${quarter.start_date} → ${quarter.end_date})` : ''}
            </p>
          </div>
          <div className="row">
            <button className="btn secondary sm" onClick={importRoster} disabled={members.length === 0}>
              Import roster ({members.filter((m) => m.active).length})
            </button>
            <button className="btn sm" onClick={addMember}>+ Add member</button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            No team members for this quarter yet.<br />
            Use <strong>Import roster</strong> to pull in your saved team, or add members individually.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Sub-team</th>
                <th>Location</th>
                <th className="num" title="Share of time spent on deliverable work (vs. meetings, support, etc.)">Capacity index</th>
                <th className="num">Vacation (days)</th>
                <th className="num" title="Working weekdays in quarter">Work days</th>
                <th className="num" title="Public holidays at this location">Holidays</th>
                <th className="num" title="Work days − holidays − vacation, × capacity index">Effective capacity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groups.map(({ subteam, rows: stRows }) =>
                stRows.length === 0 ? null : (
                  <RowGroup
                    key={subteam.id}
                    subteam={subteam}
                    rows={stRows}
                    summaryById={summaryById}
                    subteams={subteams}
                    locations={locations}
                    onSave={save}
                    onRemove={remove}
                  />
                )
              )}
              {ungrouped.length > 0 && (
                <RowGroup
                  subteam={{ id: -1, name: 'Unassigned', color: '#9ca3af', sort_order: 99 }}
                  rows={ungrouped}
                  summaryById={summaryById}
                  subteams={subteams}
                  locations={locations}
                  onSave={save}
                  onRemove={remove}
                />
              )}
            </tbody>
          </table>
        )}
      </div>

      {summary && summary.subteams.some((s) => s.memberCount > 0) && (
        <div className="panel">
          <h2>Total available capacity by sub-team</h2>
          <p className="sub">Person-days available for deliverable work this quarter.</p>
          <div className="cards">
            {summary.subteams
              .filter((s) => s.memberCount > 0)
              .map((s) => (
                <div className="metric-card" key={s.subteamId}>
                  <div className="name">
                    <span className="dot" style={{ background: s.color }} /> {s.name}
                  </div>
                  <div className="big">{fmt(s.capacity)}</div>
                  <div className="line"><span>Members</span><span>{s.memberCount}</span></div>
                </div>
              ))}
            <div className="metric-card" style={{ background: '#f7f8ff' }}>
              <div className="name">Total</div>
              <div className="big">{fmt(summary.totals.capacity)}</div>
              <div className="line"><span>All sub-teams</span><span>person-days</span></div>
            </div>
          </div>
        </div>
      )}

      {summary && summary.holidayCalendars.length > 0 && (
        <div className="panel">
          <h2>Public holidays applied</h2>
          <p className="sub">Statutory public holidays (weekdays only) deducted per location, from the bundled holiday calendar.</p>
          {summary.holidayCalendars.map((c) => (
            <details className="holidays" key={c.locationId ?? c.locationName}>
              <summary>{c.locationName} — {c.holidays.length} holiday{c.holidays.length === 1 ? '' : 's'}</summary>
              <ul>
                {c.holidays.map((hd) => (
                  <li key={hd.date}>{hd.date} — {hd.name}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </>
  );
}

interface GroupProps {
  subteam: Subteam;
  rows: QuarterMember[];
  summaryById: Map<number, MemberSummary>;
  subteams: Subteam[];
  locations: Location[];
  onSave: (row: QuarterMember, patch: Partial<QuarterMember>) => void;
  onRemove: (row: QuarterMember) => void;
}

function RowGroup({ subteam, rows, summaryById, subteams, locations, onSave, onRemove }: GroupProps) {
  const total = rows.reduce((sum, r) => sum + (summaryById.get(r.id)?.effectiveCapacity ?? 0), 0);
  return (
    <>
      <tr className="subteam-header">
        <td colSpan={9}>
          <span className="dot" style={{ background: subteam.color }} /> {subteam.name}
        </td>
      </tr>
      {rows.map((r) => {
        const s = summaryById.get(r.id);
        return (
          <tr key={r.id}>
            <td>
              <input
                value={r.name}
                onChange={(e) => onSave(r, { name: e.target.value })}
                style={{ width: 160 }}
              />
            </td>
            <td>
              <select value={r.subteam_id ?? ''} onChange={(e) => onSave(r, { subteam_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">—</option>
                {subteams.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </td>
            <td>
              <select value={r.location_id ?? ''} onChange={(e) => onSave(r, { location_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">—</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </td>
            <td className="num">
              <input
                className="num"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={r.capacity_index}
                onChange={(e) => onSave(r, { capacity_index: Number(e.target.value) })}
                style={{ width: 70 }}
              />
            </td>
            <td className="num">
              <input
                className="num"
                type="number"
                step="0.5"
                min="0"
                value={r.vacation_days}
                onChange={(e) => onSave(r, { vacation_days: Number(e.target.value) })}
                style={{ width: 70 }}
              />
            </td>
            <td className="num">{fmt(s?.grossWorkingDays)}</td>
            <td className="num">{fmt(s?.publicHolidays)}</td>
            <td className="num"><strong>{fmt(s?.effectiveCapacity)}</strong></td>
            <td className="num"><button className="btn ghost" onClick={() => onRemove(r)}>✕</button></td>
          </tr>
        );
      })}
      <tr className="subteam-total">
        <td colSpan={7}>{subteam.name} total capacity</td>
        <td className="num">{fmt(total)}</td>
        <td></td>
      </tr>
    </>
  );
}
