import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Location, Subteam } from '../types';

interface Props {
  subteams: Subteam[];
  locations: Location[];
  onChange: () => void;
  reportError: (msg: string) => void;
}

export default function SettingsView({ subteams, locations, onChange, reportError }: Props) {
  const [countries, setCountries] = useState<Record<string, string>>({});
  const [stName, setStName] = useState('');
  const [stColor, setStColor] = useState('#6366f1');

  const [locName, setLocName] = useState('');
  const [country, setCountry] = useState('DE');
  const [region, setRegion] = useState('');
  const [states, setStates] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<{ countries: Record<string, string> }>('/holiday-options')
      .then((d) => setCountries(d.countries))
      .catch((e) => reportError(e.message));
  }, [reportError]);

  useEffect(() => {
    if (!country) return setStates({});
    api.get<{ states: Record<string, string> }>(`/holiday-options?country=${country}`)
      .then((d) => setStates(d.states || {}))
      .catch(() => setStates({}));
    setRegion('');
  }, [country]);

  const handle = (fn: () => Promise<void>) => async () => {
    try {
      await fn();
      onChange();
    } catch (e: any) {
      reportError(e.message);
    }
  };

  const addSubteam = handle(async () => {
    if (!stName.trim()) return;
    await api.post('/subteams', { name: stName.trim(), color: stColor, sort_order: subteams.length + 1 });
    setStName('');
  });

  const addLocation = handle(async () => {
    const name = locName.trim() || `${countries[country] ?? country}${region ? ` (${states[region] ?? region})` : ''}`;
    await api.post('/locations', { name, country, region: region || null });
    setLocName('');
  });

  return (
    <>
      <div className="panel">
        <h2>Sub-teams</h2>
        <p className="sub">The functional groups you plan capacity for (e.g. Frontend, Backend, Design).</p>
        <table>
          <thead>
            <tr><th>Name</th><th>Colour</th><th className="num">Order</th><th></th></tr>
          </thead>
          <tbody>
            {subteams.map((s) => (
              <tr key={s.id}>
                <td><input value={s.name} onChange={(e) => handle(async () => { await api.put(`/subteams/${s.id}`, { ...s, name: e.target.value }); })()} /></td>
                <td><input type="color" value={s.color} onChange={(e) => handle(async () => { await api.put(`/subteams/${s.id}`, { ...s, color: e.target.value }); })()} /></td>
                <td className="num"><input className="num" type="number" value={s.sort_order} style={{ width: 60 }} onChange={(e) => handle(async () => { await api.put(`/subteams/${s.id}`, { ...s, sort_order: Number(e.target.value) }); })()} /></td>
                <td className="num"><button className="btn ghost" onClick={() => { if (confirm(`Delete sub-team ${s.name}?`)) handle(async () => { await api.del(`/subteams/${s.id}`); })(); }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 14 }}>
          <input placeholder="New sub-team name" value={stName} onChange={(e) => setStName(e.target.value)} />
          <input type="color" value={stColor} onChange={(e) => setStColor(e.target.value)} />
          <button className="btn sm" onClick={addSubteam}>+ Add sub-team</button>
        </div>
      </div>

      <div className="panel">
        <h2>Work locations</h2>
        <p className="sub">Each location maps to a country (and optional state/region) used to compute public holidays.</p>
        <table>
          <thead>
            <tr><th>Name</th><th>Country</th><th>Region</th><th></th></tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{countries[l.country] ?? l.country}</td>
                <td>{l.region ?? '—'}</td>
                <td className="num"><button className="btn ghost" onClick={() => { if (confirm(`Delete location ${l.name}?`)) handle(async () => { await api.del(`/locations/${l.id}`); })(); }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 14, alignItems: 'flex-end' }}>
          <label className="field">
            <span>Country</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {Object.entries(countries).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </label>
          {Object.keys(states).length > 0 && (
            <label className="field">
              <span>Region / state</span>
              <select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">(whole country)</option>
                {Object.entries(states).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Display name (optional)</span>
            <input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="auto" />
          </label>
          <button className="btn sm" onClick={addLocation}>+ Add location</button>
        </div>
      </div>
    </>
  );
}
