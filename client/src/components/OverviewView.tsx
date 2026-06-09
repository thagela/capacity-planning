import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Effort, Quarter, QuarterSummary, Subteam } from '../types';
import { fmt, pct } from '../format';

interface Props {
  quarter: Quarter | null;
  subteams: Subteam[];
  onNavigate: (tab: 'planning' | 'quarters' | 'retro') => void;
  reportError: (msg: string) => void;
}

type Severity = 'critical' | 'warn' | 'info' | 'ok';
interface ActionItem {
  severity: Severity;
  title: string;
  desc: string;
}
const SEV_ORDER: Severity[] = ['critical', 'warn', 'info', 'ok'];
const SEV_ICON: Record<Severity, string> = { critical: '⛔', warn: '⚠️', info: 'ℹ️', ok: '✅' };

/** Health bucket for leftover %: overcommitted/at-capacity → bad, healthy → good, slack → warn. */
function fillClass(leftoverPct: number): 'good' | 'warn' | 'bad' {
  if (leftoverPct < 5) return 'bad';
  if (leftoverPct > 25) return 'warn';
  return 'good';
}

export default function OverviewView({ quarter, subteams, onNavigate, reportError }: Props) {
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

  if (!quarter) {
    return (
      <div className="panel">
        <div className="empty">
          <span className="big-ic">🗓</span>
          No quarter selected yet.
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => onNavigate('quarters')}>Create a quarter</button>
          </div>
        </div>
      </div>
    );
  }
  if (!summary) return <div className="panel"><div className="empty">Loading…</div></div>;

  const activeSubteams = summary.subteams.filter((s) => s.memberCount > 0);
  const totalLeftoverPct = summary.totals.capacity > 0 ? (summary.totals.leftover / summary.totals.capacity) * 100 : 0;

  async function saveEffort(subteamId: number, planned: number) {
    try {
      await api.put(`/quarters/${quarter!.id}/efforts/${subteamId}`, {
        planned_effort: planned,
        actual_effort: efforts[subteamId]?.actual_effort ?? null,
      });
      load();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  // ---- Action items ----------------------------------------------------------
  const actions: ActionItem[] = [];
  if (activeSubteams.length === 0) {
    actions.push({
      severity: 'info',
      title: 'No team members for this quarter',
      desc: 'Head to Planning to import your roster and set vacations.',
    });
  }
  for (const s of activeSubteams) {
    if (s.plannedEffort === 0) {
      actions.push({ severity: 'info', title: `No effort planned for ${s.name}`, desc: `${fmt(s.capacity)} person-days available — add planned effort to track leftover.` });
    } else if (s.leftover < 0) {
      actions.push({ severity: 'critical', title: `${s.name} is overcommitted`, desc: `Planned ${fmt(s.plannedEffort)}d against ${fmt(s.capacity)}d capacity — ${fmt(-s.leftover)}d over. Cut scope or add capacity.` });
    } else if (s.leftoverPct < 5) {
      actions.push({ severity: 'warn', title: `${s.name} is at capacity`, desc: `Only ${fmt(s.leftover)}d buffer (${pct(s.leftoverPct)}). No room for unknowns or support work.` });
    } else if (s.leftoverPct > 25) {
      actions.push({ severity: 'warn', title: `${s.name} is under-utilised`, desc: `${fmt(s.leftover)}d free (${pct(s.leftoverPct)}). Consider pulling work forward or reallocating.` });
    } else {
      actions.push({ severity: 'ok', title: `${s.name} is well balanced`, desc: `${fmt(s.leftover)}d buffer (${pct(s.leftoverPct)}) — a healthy margin.` });
    }
  }
  if (quarter.status === 'completed') {
    actions.push({ severity: 'info', title: 'Quarter completed', desc: 'Record actual effort in the Retrospective to review estimate accuracy.' });
  }
  actions.sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));

  return (
    <>
      {/* Hero metrics */}
      <div className="hero-grid">
        <div className="hero-card accent">
          <div className="label">Total capacity</div>
          <div className="value">{fmt(summary.totals.capacity)} <small>person-days</small></div>
        </div>
        <div className="hero-card">
          <div className="label">Planned effort</div>
          <div className="value">{fmt(summary.totals.plannedEffort)} <small>days</small></div>
        </div>
        <div className="hero-card">
          <div className="label">Leftover</div>
          <div className={`value ${totalLeftoverPct < 5 ? 'pct-bad' : totalLeftoverPct > 25 ? 'pct-warn' : 'pct-good'}`}>
            {fmt(summary.totals.leftover)} <small>{pct(totalLeftoverPct)}</small>
          </div>
        </div>
        <div className="hero-card">
          <div className="label">Team size</div>
          <div className="value">{summary.members.length} <small>people</small></div>
        </div>
      </div>

      {/* Capacity by sub-team with inline effort editing */}
      <div className="panel">
        <div className="section-title"><h2>Capacity by sub-team</h2></div>
        <p className="sub">Enter planned effort to see how much capacity is left. Bars are coloured by health.</p>

        {activeSubteams.length === 0 ? (
          <div className="empty">
            <span className="big-ic">👥</span>
            No team members yet for {quarter.label}.
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => onNavigate('planning')}>Go to Planning</button>
            </div>
          </div>
        ) : (
          activeSubteams.map((s) => {
            const cls = fillClass(s.leftoverPct);
            const plannedPctOfCap = s.capacity > 0 ? Math.min(100, Math.max(0, (s.plannedEffort / s.capacity) * 100)) : 0;
            return (
              <div className="cap-row" key={s.subteamId}>
                <div className="cap-name">
                  <span className="dot" style={{ background: s.color }} />
                  <span>{s.name}<small>{s.memberCount} {s.memberCount === 1 ? 'person' : 'people'}</small></span>
                </div>
                <div>
                  <div className="cap-bar">
                    <span className={`fill ${cls}`} style={{ width: `${plannedPctOfCap}%` }} />
                  </div>
                  <div className="cap-legend">
                    <span>Planned <b>{fmt(s.plannedEffort)}d</b></span>
                    <span>Leftover <b className={`pct-${cls === 'bad' ? 'bad' : cls === 'warn' ? 'warn' : 'good'}`}>{fmt(s.leftover)}d</b></span>
                    <span>Capacity <b>{fmt(s.capacity)}d</b></span>
                  </div>
                </div>
                <div className="cap-meta">
                  <label className="field" style={{ alignItems: 'flex-end' }}>
                    <span>Planned effort</span>
                    <input
                      className="num effort-input"
                      type="number"
                      step="0.5"
                      min="0"
                      value={efforts[s.subteamId]?.planned_effort ?? 0}
                      onChange={(e) => saveEffort(s.subteamId, Number(e.target.value))}
                    />
                  </label>
                  <div className="stat">
                    <div className="k">Leftover</div>
                    <div className={`v pct-${cls === 'bad' ? 'bad' : cls === 'warn' ? 'warn' : 'good'}`}>{pct(s.leftoverPct)}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action items */}
      {actions.length > 0 && (
        <div className="panel">
          <div className="section-title"><h2>Action items</h2></div>
          <p className="sub">Generated from current capacity vs. planned effort.</p>
          <div className="actionables">
            {actions.map((a, i) => (
              <div className={`action-item sev-${a.severity}`} key={i}>
                <span className="ai-ic">{SEV_ICON[a.severity]}</span>
                <div className="ai-body">
                  <div className="ai-title">{a.title}</div>
                  <div className="ai-desc">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
