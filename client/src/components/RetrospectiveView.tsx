import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Effort, Quarter, QuarterSummary } from '../types';
import { fmt, pct } from '../format';

interface Props {
  quarter: Quarter | null;
  reportError: (msg: string) => void;
}

export default function RetrospectiveView({ quarter, reportError }: Props) {
  const [summary, setSummary] = useState<QuarterSummary | null>(null);
  const [efforts, setEfforts] = useState<Record<number, Effort>>({});

  const load = useCallback(async () => {
    if (!quarter) {
      setSummary(null);
      return;
    }
    try {
      const [sum, eff] = await Promise.all([
        api.get<QuarterSummary>(`/quarters/${quarter.id}/summary`),
        api.get<Effort[]>(`/quarters/${quarter.id}/efforts`),
      ]);
      setSummary(sum);
      setEfforts(Object.fromEntries(eff.map((e) => [e.subteam_id, e])));
    } catch (e: any) {
      reportError(e.message);
    }
  }, [quarter, reportError]);

  useEffect(() => {
    load();
  }, [load]);

  if (!quarter) return <div className="panel"><div className="empty">Select a quarter first.</div></div>;
  if (!summary) return <div className="panel"><div className="empty">Loading…</div></div>;

  const active = summary.subteams.filter((s) => s.memberCount > 0 || s.plannedEffort > 0);

  async function saveActual(subteamId: number, actual: number | null) {
    try {
      await api.put(`/quarters/${quarter!.id}/efforts/${subteamId}`, {
        planned_effort: efforts[subteamId]?.planned_effort ?? 0,
        actual_effort: actual,
      });
      load();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  const totalActual = summary.subteams.reduce((s, st) => s + (st.retro?.actualEffort ?? 0), 0);
  const hasAnyActual = summary.subteams.some((s) => s.retro);

  return (
    <>
      {quarter.status !== 'completed' && (
        <div className="action-item sev-info" style={{ marginBottom: 18 }}>
          <span className="ai-ic">ℹ️</span>
          <div className="ai-body">
            <div className="ai-title">{quarter.label} is still {quarter.status}</div>
            <div className="ai-desc">
              You can record actuals any time, but retrospectives are usually done after the quarter ends.
              Mark it <strong>completed</strong> on the Quarters tab when it wraps up.
            </div>
          </div>
        </div>
      )}

      {hasAnyActual && (
        <div className="hero-grid">
          <div className="hero-card">
            <div className="label">Planned effort</div>
            <div className="value">{fmt(summary.totals.plannedEffort)} <small>days</small></div>
          </div>
          <div className="hero-card">
            <div className="label">Actual effort</div>
            <div className="value">{fmt(totalActual)} <small>days</small></div>
          </div>
          <div className="hero-card">
            <div className="label">Overall estimate accuracy</div>
            <div className="value">{totalActual > 0 ? pct((summary.totals.plannedEffort / totalActual) * 100) : '–'}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="section-title"><h2>Planned vs. actual effort</h2></div>
        <p className="sub">Record the actual person-days spent per sub-team to see how good the estimates were.</p>

        {active.length === 0 ? (
          <div className="empty">Nothing to review yet — add team members and planned effort first.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sub-team</th>
                <th className="num">Capacity</th>
                <th className="num">Planned</th>
                <th className="num">Actual</th>
                <th className="num">Variance</th>
                <th className="num" title="Planned ÷ Actual">Estimate accuracy</th>
                <th className="num" title="Actual ÷ Capacity">Capacity used</th>
              </tr>
            </thead>
            <tbody>
              {active.map((s) => {
                const variance = s.retro?.effortVariance ?? null;
                return (
                  <tr key={s.subteamId}>
                    <td><span className="dot" style={{ background: s.color }} /> {s.name}</td>
                    <td className="num">{fmt(s.capacity)}</td>
                    <td className="num">{fmt(s.plannedEffort)}</td>
                    <td className="num">
                      <input
                        className="num"
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="–"
                        value={efforts[s.subteamId]?.actual_effort ?? ''}
                        onChange={(e) => saveActual(s.subteamId, e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </td>
                    <td className={`num ${variance === null ? '' : variance > 0 ? 'pct-bad' : 'pct-good'}`}>
                      {variance === null ? '–' : `${variance > 0 ? '+' : ''}${fmt(variance)}`}
                    </td>
                    <td className="num">{pct(s.retro?.estimateAccuracyPct ?? null)}</td>
                    <td className="num">{pct(s.retro?.capacityUtilizationPct ?? null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="hint" style={{ marginTop: 12 }}>
          Variance is actual − planned: <span className="pct-bad">positive</span> = effort was under-estimated,
          <span className="pct-good"> negative</span> = over-estimated.
        </p>
      </div>
    </>
  );
}
