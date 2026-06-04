import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Effort, Quarter, QuarterSummary } from '../types';
import { fmt, leftoverClass, leftoverLabel, pct } from '../format';

interface Props {
  quarter: Quarter | null;
  reportError: (msg: string) => void;
}

export default function EffortView({ quarter, reportError }: Props) {
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

  if (!quarter) return <div className="empty">Select or create a quarter first.</div>;
  if (!summary) return <div className="empty">Loading…</div>;

  const active = summary.subteams.filter((s) => s.memberCount > 0 || s.plannedEffort > 0);
  const showRetro = quarter.status === 'completed' || summary.subteams.some((s) => s.retro);

  async function saveEffort(subteamId: number, patch: { planned_effort?: number; actual_effort?: number | null }) {
    const cur = efforts[subteamId];
    const body = {
      planned_effort: patch.planned_effort ?? cur?.planned_effort ?? 0,
      actual_effort: patch.actual_effort !== undefined ? patch.actual_effort : cur?.actual_effort ?? null,
    };
    try {
      await api.put(`/quarters/${quarter!.id}/efforts/${subteamId}`, body);
      load();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  return (
    <>
      <div className="panel">
        <div className="row between">
          <div>
            <h2>Effort & Leftover Capacity — {quarter.label}</h2>
            <p className="sub">Enter the planned effort (person-days) per sub-team to see how much capacity is left.</p>
          </div>
          <span className={`status-pill status-${quarter.status}`}>{quarter.status}</span>
        </div>

        {active.length === 0 ? (
          <div className="empty">Add team members in Capacity Planning, then enter planned effort here.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sub-team</th>
                <th className="num">Available capacity</th>
                <th className="num">Planned effort</th>
                <th className="num">Leftover</th>
                <th className="num">Leftover %</th>
                <th style={{ width: 180 }}>Indicator</th>
              </tr>
            </thead>
            <tbody>
              {active.map((s) => (
                <tr key={s.subteamId}>
                  <td><span className="dot" style={{ background: s.color }} /> {s.name}</td>
                  <td className="num">{fmt(s.capacity)}</td>
                  <td className="num">
                    <input
                      className="num"
                      type="number"
                      step="0.5"
                      min="0"
                      value={efforts[s.subteamId]?.planned_effort ?? 0}
                      onChange={(e) => saveEffort(s.subteamId, { planned_effort: Number(e.target.value) })}
                    />
                  </td>
                  <td className={`num ${leftoverClass(s.leftoverPct)}`}>{fmt(s.leftover)}</td>
                  <td className={`num ${leftoverClass(s.leftoverPct)}`}><strong>{pct(s.leftoverPct)}</strong></td>
                  <td>
                    <div className="bar">
                      <span
                        style={{
                          width: `${Math.min(100, Math.max(0, (s.plannedEffort / Math.max(s.capacity, 0.0001)) * 100))}%`,
                          background: s.leftoverPct < 5 ? 'var(--bad)' : s.leftoverPct > 25 ? 'var(--warn)' : 'var(--good)',
                        }}
                      />
                    </div>
                    <span className={`hint ${leftoverClass(s.leftoverPct)}`}>{leftoverLabel(s.leftoverPct)}</span>
                  </td>
                </tr>
              ))}
              <tr className="subteam-total">
                <td>Total</td>
                <td className="num">{fmt(summary.totals.capacity)}</td>
                <td className="num">{fmt(summary.totals.plannedEffort)}</td>
                <td className="num">{fmt(summary.totals.leftover)}</td>
                <td className="num">
                  {pct(summary.totals.capacity > 0 ? (summary.totals.leftover / summary.totals.capacity) * 100 : 0)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
        <p className="hint" style={{ marginTop: 12 }}>
          <span className="pct-bad">●</span> &lt;5% left = at/over capacity &nbsp;
          <span className="pct-good">●</span> 5–25% = healthy buffer &nbsp;
          <span className="pct-warn">●</span> &gt;25% = under-utilised
        </p>
      </div>

      {active.length > 0 && (
        <div className="panel">
          <div className="row between">
            <div>
              <h2>Retrospective</h2>
              <p className="sub">
                After the quarter, record the actual effort spent per sub-team to check how good the estimates were.
              </p>
            </div>
            {!showRetro && <span className="hint">Set the quarter status to <em>completed</em> on the Quarters tab to wrap up.</span>}
          </div>
          <table>
            <thead>
              <tr>
                <th>Sub-team</th>
                <th className="num">Planned</th>
                <th className="num">Actual</th>
                <th className="num">Variance</th>
                <th className="num" title="Planned ÷ Actual">Estimate accuracy</th>
                <th className="num" title="Actual ÷ Available capacity">Capacity used</th>
              </tr>
            </thead>
            <tbody>
              {active.map((s) => {
                const variance = s.retro?.effortVariance ?? null;
                return (
                  <tr key={s.subteamId}>
                    <td><span className="dot" style={{ background: s.color }} /> {s.name}</td>
                    <td className="num">{fmt(s.plannedEffort)}</td>
                    <td className="num">
                      <input
                        className="num"
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="–"
                        value={efforts[s.subteamId]?.actual_effort ?? ''}
                        onChange={(e) => saveEffort(s.subteamId, { actual_effort: e.target.value === '' ? null : Number(e.target.value) })}
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
          <p className="hint" style={{ marginTop: 10 }}>
            Variance is actual − planned: <span className="pct-bad">positive</span> means effort was under-estimated,
            <span className="pct-good"> negative</span> means over-estimated.
          </p>
        </div>
      )}
    </>
  );
}
