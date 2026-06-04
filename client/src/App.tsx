import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Location, Member, Quarter, Subteam } from './types';
import QuartersView from './components/QuartersView';
import PlanningView from './components/PlanningView';
import EffortView from './components/EffortView';
import RosterView from './components/RosterView';
import SettingsView from './components/SettingsView';
import HistoryView from './components/HistoryView';

type Tab = 'quarters' | 'planning' | 'effort' | 'roster' | 'settings' | 'history';

const TABS: { id: Tab; label: string }[] = [
  { id: 'quarters', label: 'Quarters' },
  { id: 'planning', label: 'Capacity Planning' },
  { id: 'effort', label: 'Effort & Leftover' },
  { id: 'history', label: 'History' },
  { id: 'roster', label: 'Roster' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('quarters');
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [subteams, setSubteams] = useState<Subteam[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadQuarters = useCallback(async () => {
    const qs = await api.get<Quarter[]>('/quarters');
    setQuarters(qs);
    setSelectedId((cur) => (cur && qs.some((q) => q.id === cur) ? cur : qs[0]?.id ?? null));
  }, []);

  const loadRefData = useCallback(async () => {
    const [st, loc, mem] = await Promise.all([
      api.get<Subteam[]>('/subteams'),
      api.get<Location[]>('/locations'),
      api.get<Member[]>('/members'),
    ]);
    setSubteams(st);
    setLocations(loc);
    setMembers(mem);
  }, []);

  const reloadAll = useCallback(async () => {
    try {
      await Promise.all([loadQuarters(), loadRefData()]);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [loadQuarters, loadRefData]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  const wrap = (fn: () => Promise<void>) => async () => {
    try {
      await fn();
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const selectedQuarter = quarters.find((q) => q.id === selectedId) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <h1>📊 Capacity Planning</h1>
        <div className="spacer" />
        <div className="quarter-select">
          <span className="hint">Quarter:</span>
          <select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
          >
            {quarters.length === 0 && <option value="">No quarters yet</option>}
            {quarters.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label} — {q.status}
              </option>
            ))}
          </select>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {error && <div className="error-banner">⚠ {error}</div>}

      {tab === 'quarters' && (
        <QuartersView
          quarters={quarters}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={wrap(loadQuarters)}
          reportError={setError}
        />
      )}
      {tab === 'planning' && (
        <PlanningView
          quarter={selectedQuarter}
          subteams={subteams}
          locations={locations}
          members={members}
          reportError={setError}
        />
      )}
      {tab === 'effort' && <EffortView quarter={selectedQuarter} reportError={setError} />}
      {tab === 'history' && <HistoryView quarters={quarters} onSelect={(id) => { setSelectedId(id); setTab('effort'); }} reportError={setError} />}
      {tab === 'roster' && (
        <RosterView members={members} subteams={subteams} locations={locations} onChange={wrap(loadRefData)} reportError={setError} />
      )}
      {tab === 'settings' && (
        <SettingsView subteams={subteams} locations={locations} onChange={wrap(loadRefData)} reportError={setError} />
      )}
    </div>
  );
}
