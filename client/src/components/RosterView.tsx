import { useState } from 'react';
import { api } from '../api';
import type { Location, Member, Subteam } from '../types';

interface Props {
  members: Member[];
  subteams: Subteam[];
  locations: Location[];
  onChange: () => void;
  reportError: (msg: string) => void;
}

export default function RosterView({ members, subteams, locations, onChange, reportError }: Props) {
  const [name, setName] = useState('');
  const [subteamId, setSubteamId] = useState<number | ''>(subteams[0]?.id ?? '');
  const [locationId, setLocationId] = useState<number | ''>(locations[0]?.id ?? '');
  const [capacityIndex, setCapacityIndex] = useState(0.8);

  async function add() {
    if (!name.trim()) return;
    try {
      await api.post('/members', {
        name: name.trim(),
        subteam_id: subteamId || null,
        location_id: locationId || null,
        capacity_index: capacityIndex,
        active: 1,
      });
      setName('');
      onChange();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  async function update(m: Member, patch: Partial<Member>) {
    try {
      await api.put(`/members/${m.id}`, { ...m, ...patch });
      onChange();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  async function remove(m: Member) {
    if (!confirm(`Remove ${m.name} from the roster?`)) return;
    try {
      await api.del(`/members/${m.id}`);
      onChange();
    } catch (e: any) {
      reportError(e.message);
    }
  }

  return (
    <div className="panel">
      <h2>Team roster</h2>
      <p className="sub">
        Your master list of team members and their defaults. Use <strong>Import roster</strong> on the Capacity Planning
        tab to pull active members into a quarter.
      </p>

      <div className="row" style={{ marginBottom: 18 }}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        </label>
        <label className="field">
          <span>Sub-team</span>
          <select value={subteamId} onChange={(e) => setSubteamId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">—</option>
            {subteams.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Location</span>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">—</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Capacity index</span>
          <input className="num" type="number" step="0.05" min="0" max="1" value={capacityIndex} onChange={(e) => setCapacityIndex(Number(e.target.value))} />
        </label>
        <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={add}>+ Add</button>
      </div>

      {members.length === 0 ? (
        <div className="empty">No team members yet — add your first above.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Sub-team</th>
              <th>Location</th>
              <th className="num">Capacity index</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} style={m.active ? undefined : { opacity: 0.5 }}>
                <td><input value={m.name} onChange={(e) => update(m, { name: e.target.value })} /></td>
                <td>
                  <select value={m.subteam_id ?? ''} onChange={(e) => update(m, { subteam_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">—</option>
                    {subteams.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={m.location_id ?? ''} onChange={(e) => update(m, { location_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">—</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </td>
                <td className="num">
                  <input className="num" type="number" step="0.05" min="0" max="1" value={m.capacity_index} onChange={(e) => update(m, { capacity_index: Number(e.target.value) })} />
                </td>
                <td>
                  <input type="checkbox" checked={!!m.active} onChange={(e) => update(m, { active: e.target.checked ? 1 : 0 })} />
                </td>
                <td className="num"><button className="btn ghost" onClick={() => remove(m)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
