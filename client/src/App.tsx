import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Location, Member, Quarter, Subteam } from './types';
import OverviewView from './components/OverviewView';
import PlanningView from './components/PlanningView';
import RetrospectiveView from './components/RetrospectiveView';
import HistoryView from './components/HistoryView';
import QuartersView from './components/QuartersView';
import RosterView from './components/RosterView';
import SettingsView from './components/SettingsView';

type Tab = 'overview' | 'planning' | 'retro' | 'history' | 'quarters' | 'team' | 'settings';

const NAV: { section: string; items: { id: Tab; label: string; icon: string }[] }[] = [
  {
    section: 'Plan',
    items: [
      { id: 'overview', label: 'Overview', icon: '◎' },
      { id: 'planning', label: 'Planning', icon: '👥' },
      { id: 'retro', label: 'Retrospective', icon: '↻' },
      { id: 'history', label: 'History', icon: '📈' },
    ],
  },
  {
    section: 'Configure',
    items: [
      { id: 'quarters', label: 'Quarters', icon: '🗓' },
      { id: 'team', label: 'Team', icon: '🧑‍💻' },
      { id: 'settings', label: 'Settings', icon: '⚙' },
    ],
  },
];

const TITLES: Record<Tab, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'Where the team stands this quarter, and what needs attention.' },
  planning: { title: 'Capacity Planning', subtitle: 'Team members, vacations and capacity index for the quarter.' },
  retro: { title: 'Retrospective', subtitle: 'Compare planned vs. actual effort once the quarter has wrapped up.' },
  history: { title: 'History', subtitle: 'Capacity and effort trends across quarters.' },
  quarters: { title: 'Quarters', subtitle: 'Create and manage planning periods.' },
  team: { title: 'Team Roster', subtitle: 'Your master list of people and their defaults.' },
  settings: { title: 'Settings', subtitle: 'Sub-teams and work locations.' },
};

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
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
  const showQuarterSwitch = !['quarters', 'team', 'settings', 'history'].includes(tab);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">📊</span> Capacity
        </div>
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="nav-section">{group.section}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${tab === item.id ? 'active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                <span className="ic">{item.icon}</span> {item.label}
              </button>
            ))}
          </div>
        ))}
        <div className="foot">Quarterly capacity planning</div>
      </aside>

      <main className="content">
        <div className="content-header">
          <div className="titles">
            <h1>{TITLES[tab].title}</h1>
            <p>{TITLES[tab].subtitle}</p>
          </div>
          <div className="spacer" />
          {showQuarterSwitch && (
            <div className="quarter-switch">
              <label htmlFor="q">Quarter</label>
              <select id="q" value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}>
                {quarters.length === 0 && <option value="">None yet</option>}
                {quarters.map((q) => (
                  <option key={q.id} value={q.id}>{q.label}</option>
                ))}
              </select>
              {selectedQuarter && <span className={`status-pill status-${selectedQuarter.status}`}>{selectedQuarter.status}</span>}
            </div>
          )}
        </div>

        {error && <div className="error-banner">⚠ {error}</div>}

        {tab === 'overview' && (
          <OverviewView
            quarter={selectedQuarter}
            subteams={subteams}
            onNavigate={(t) => setTab(t)}
            reportError={setError}
          />
        )}
        {tab === 'planning' && (
          <PlanningView quarter={selectedQuarter} subteams={subteams} locations={locations} members={members} reportError={setError} />
        )}
        {tab === 'retro' && <RetrospectiveView quarter={selectedQuarter} reportError={setError} />}
        {tab === 'history' && (
          <HistoryView quarters={quarters} onSelect={(id) => { setSelectedId(id); setTab('overview'); }} reportError={setError} />
        )}
        {tab === 'quarters' && (
          <QuartersView quarters={quarters} selectedId={selectedId} onSelect={setSelectedId} onChange={wrap(loadQuarters)} reportError={setError} />
        )}
        {tab === 'team' && (
          <RosterView members={members} subteams={subteams} locations={locations} onChange={wrap(loadRefData)} reportError={setError} />
        )}
        {tab === 'settings' && (
          <SettingsView subteams={subteams} locations={locations} onChange={wrap(loadRefData)} reportError={setError} />
        )}
      </main>
    </div>
  );
}
