import { useState } from 'react';
import { api } from '../api';
import type { Quarter, QuarterStatus } from '../types';

interface Props {
  quarters: Quarter[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onChange: () => void;
  reportError: (msg: string) => void;
}

const STATUSES: QuarterStatus[] = ['planning', 'active', 'completed'];

export default function QuartersView({ quarters, selectedId, onSelect, onChange, reportError }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);

  async function create() {
    try {
      const created = await api.post<Quarter>('/quarters', { year, quarter });
      onChange();
      onSelect(created.id);
    } catch (e: any) {
      reportError(e.message);
    }
  }

  async function update(q: Quarter, patch: Partial<Quarter>) {
    try {
      await api.put(`/quarters/${q.id}`, { ...q, ...patch });
      onChange();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  async function remove(q: Quarter) {
    if (!confirm(`Delete ${q.label}? This removes its planning data and effort entries.`)) return;
    try {
      await api.del(`/quarters/${q.id}`);
      onChange();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  return (
    <>
      <div className="panel">
        <h2>Create a quarter</h2>
        <p className="sub">Dates default to the calendar quarter; adjust them per quarter in the table below.</p>
        <div className="row">
          <label className="field">
            <span>Year</span>
            <input className="num" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Quarter</span>
            <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>Q{q}</option>
              ))}
            </select>
          </label>
          <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={create}>+ Add quarter</button>
        </div>
      </div>

      <div className="panel">
        <h2>Quarters</h2>
        {quarters.length === 0 ? (
          <div className="empty">No quarters yet — create one above to start planning.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quarter</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quarters.map((q) => (
                <tr key={q.id} style={q.id === selectedId ? { background: '#f5f7ff' } : undefined}>
                  <td>
                    <button className="btn ghost" style={{ color: q.id === selectedId ? 'var(--primary)' : undefined, fontWeight: 600 }} onClick={() => onSelect(q.id)}>
                      {q.label}
                    </button>
                  </td>
                  <td>
                    <input type="date" value={q.start_date} onChange={(e) => update(q, { start_date: e.target.value })} />
                  </td>
                  <td>
                    <input type="date" value={q.end_date} onChange={(e) => update(q, { end_date: e.target.value })} />
                  </td>
                  <td>
                    <select value={q.status} onChange={(e) => update(q, { status: e.target.value as QuarterStatus })}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    <button className="btn ghost" onClick={() => remove(q)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
