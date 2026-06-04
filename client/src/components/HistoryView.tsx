import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Quarter, QuarterSummary } from '../types';
import { fmt, leftoverClass, pct } from '../format';

interface Props {
  quarters: Quarter[];
  onSelect: (id: number) => void;
  reportError: (msg: string) => void;
}

export default function HistoryView({ quarters, onSelect, reportError }: Props) {
  const [summaries, setSummaries] = useState<Record<number, QuarterSummary>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(quarters.map((q) => api.get<QuarterSummary>(`/quarters/${q.id}/summary`)))
      .then((list) => {
        if (cancelled) return;
        setSummaries(Object.fromEntries(list.map((s) => [s.quarter.id, s])));
      })
      .catch((e) => reportError(e.message));
    return () => {
      cancelled = true;
    };
  }, [quarters, reportError]);

  if (quarters.length === 0) return <div className="empty">No quarters to show yet.</div>;

  return (
    <div className="panel">
      <h2>History & trends</h2>
      <p className="sub">Capacity vs. planned effort across quarters, with retrospective accuracy where actuals were recorded.</p>
      <table>
        <thead>
          <tr>
            <th>Quarter</th>
            <th>Status</th>
            <th className="num">Capacity</th>
            <th className="num">Planned</th>
            <th className="num">Leftover %</th>
            <th className="num">Actual</th>
            <th className="num">Estimate accuracy</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {quarters.map((q) => {
            const s = summaries[q.id];
            const leftoverPct = s && s.totals.capacity > 0 ? (s.totals.leftover / s.totals.capacity) * 100 : null;
            const actualTotal = s?.subteams.reduce((sum, st) => sum + (st.retro?.actualEffort ?? 0), 0) ?? 0;
            const hasActual = s?.subteams.some((st) => st.retro);
            const accuracy = hasActual && actualTotal > 0 ? (s!.totals.plannedEffort / actualTotal) * 100 : null;
            return (
              <tr key={q.id}>
                <td><strong>{q.label}</strong></td>
                <td><span className={`status-pill status-${q.status}`}>{q.status}</span></td>
                <td className="num">{s ? fmt(s.totals.capacity) : '…'}</td>
                <td className="num">{s ? fmt(s.totals.plannedEffort) : '…'}</td>
                <td className={`num ${leftoverPct === null ? '' : leftoverClass(leftoverPct)}`}>
                  {leftoverPct === null ? '–' : pct(leftoverPct)}
                </td>
                <td className="num">{hasActual ? fmt(actualTotal) : '–'}</td>
                <td className="num">{accuracy === null ? '–' : pct(accuracy)}</td>
                <td className="num"><button className="btn ghost sm" onClick={() => onSelect(q.id)}>Open →</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
