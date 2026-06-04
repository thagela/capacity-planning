import { Router } from 'express';
import Holidays from 'date-holidays';
import { db } from './db.js';
import { buildQuarterSummary } from './calc.js';

export const api = Router();

const h = (fn: (req: any, res: any) => void) => (req: any, res: any) => {
  try {
    fn(req, res);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err?.message ?? 'Request failed' });
  }
};

/* ----------------------------- Sub-teams ----------------------------- */
api.get('/subteams', h((_req, res) => {
  res.json(db.prepare('SELECT * FROM subteams ORDER BY sort_order, name').all());
}));

api.post('/subteams', h((req, res) => {
  const { name, color = '#4f46e5', sort_order = 0 } = req.body;
  const info = db.prepare('INSERT INTO subteams (name, color, sort_order) VALUES (?, ?, ?)').run(name, color, sort_order);
  res.status(201).json(db.prepare('SELECT * FROM subteams WHERE id = ?').get(info.lastInsertRowid));
}));

api.put('/subteams/:id', h((req, res) => {
  const { name, color, sort_order } = req.body;
  db.prepare('UPDATE subteams SET name = ?, color = ?, sort_order = ? WHERE id = ?').run(name, color, sort_order, req.params.id);
  res.json(db.prepare('SELECT * FROM subteams WHERE id = ?').get(req.params.id));
}));

api.delete('/subteams/:id', h((req, res) => {
  db.prepare('DELETE FROM subteams WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

/* ----------------------------- Locations ----------------------------- */
api.get('/locations', h((_req, res) => {
  res.json(db.prepare('SELECT * FROM locations ORDER BY name').all());
}));

api.post('/locations', h((req, res) => {
  const { name, country, region = null } = req.body;
  const info = db.prepare('INSERT INTO locations (name, country, region) VALUES (?, ?, ?)').run(name, country, region || null);
  res.status(201).json(db.prepare('SELECT * FROM locations WHERE id = ?').get(info.lastInsertRowid));
}));

api.put('/locations/:id', h((req, res) => {
  const { name, country, region = null } = req.body;
  db.prepare('UPDATE locations SET name = ?, country = ?, region = ? WHERE id = ?').run(name, country, region || null, req.params.id);
  res.json(db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id));
}));

api.delete('/locations/:id', h((req, res) => {
  db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

// Supported countries / states from the bundled holiday library (for dropdowns).
api.get('/holiday-options', h((req, res) => {
  const hd = new Holidays();
  const countries = hd.getCountries();
  const country = req.query.country as string | undefined;
  let states: Record<string, string> = {};
  if (country) {
    try {
      states = new Holidays(country).getStates(country) || {};
    } catch {
      states = {};
    }
  }
  res.json({ countries, states });
}));

/* ------------------------------ Members ------------------------------ */
api.get('/members', h((_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT m.*, s.name AS subteam_name, l.name AS location_name
         FROM members m
         LEFT JOIN subteams s ON s.id = m.subteam_id
         LEFT JOIN locations l ON l.id = m.location_id
         ORDER BY m.active DESC, m.name`
      )
      .all()
  );
}));

api.post('/members', h((req, res) => {
  const { name, subteam_id = null, location_id = null, capacity_index = 0.8, active = 1 } = req.body;
  const info = db
    .prepare('INSERT INTO members (name, subteam_id, location_id, capacity_index, active) VALUES (?, ?, ?, ?, ?)')
    .run(name, subteam_id, location_id, capacity_index, active ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM members WHERE id = ?').get(info.lastInsertRowid));
}));

api.put('/members/:id', h((req, res) => {
  const { name, subteam_id = null, location_id = null, capacity_index = 0.8, active = 1 } = req.body;
  db.prepare('UPDATE members SET name = ?, subteam_id = ?, location_id = ?, capacity_index = ?, active = ? WHERE id = ?')
    .run(name, subteam_id, location_id, capacity_index, active ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id));
}));

api.delete('/members/:id', h((req, res) => {
  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

/* ------------------------------ Quarters ----------------------------- */
// Default first/last day for a calendar quarter.
function quarterDates(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3; // 0,3,6,9
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0)); // last day of the 3rd month
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

api.get('/quarters', h((_req, res) => {
  res.json(db.prepare('SELECT * FROM quarters ORDER BY year DESC, quarter DESC').all());
}));

api.post('/quarters', h((req, res) => {
  const { year, quarter, status = 'planning' } = req.body;
  const label = req.body.label || `Q${quarter} ${year}`;
  const defaults = quarterDates(Number(year), Number(quarter));
  const start_date = req.body.start_date || defaults.start;
  const end_date = req.body.end_date || defaults.end;
  const info = db
    .prepare('INSERT INTO quarters (label, year, quarter, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(label, year, quarter, start_date, end_date, status);
  res.status(201).json(db.prepare('SELECT * FROM quarters WHERE id = ?').get(info.lastInsertRowid));
}));

api.put('/quarters/:id', h((req, res) => {
  const { label, year, quarter, start_date, end_date, status } = req.body;
  db.prepare('UPDATE quarters SET label = ?, year = ?, quarter = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?')
    .run(label, year, quarter, start_date, end_date, status, req.params.id);
  res.json(db.prepare('SELECT * FROM quarters WHERE id = ?').get(req.params.id));
}));

api.delete('/quarters/:id', h((req, res) => {
  db.prepare('DELETE FROM quarters WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

// Populate a quarter's roster from the active master members.
api.post('/quarters/:id/import-roster', h((req, res) => {
  const quarterId = Number(req.params.id);
  const members = db.prepare('SELECT * FROM members WHERE active = 1').all() as any[];
  const existing = db.prepare('SELECT member_id FROM quarter_members WHERE quarter_id = ? AND member_id IS NOT NULL').all(quarterId) as any[];
  const have = new Set(existing.map((e) => e.member_id));
  const insert = db.prepare(
    `INSERT INTO quarter_members (quarter_id, member_id, name, subteam_id, location_id, capacity_index, vacation_days)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  );
  const tx = db.transaction(() => {
    for (const m of members) {
      if (have.has(m.id)) continue;
      insert.run(quarterId, m.id, m.name, m.subteam_id, m.location_id, m.capacity_index);
    }
  });
  tx();
  res.json(db.prepare('SELECT COUNT(*) AS c FROM quarter_members WHERE quarter_id = ?').get(quarterId));
}));

// Clone the planning rows (incl. vacation days) from another quarter.
api.post('/quarters/:id/clone-from/:sourceId', h((req, res) => {
  const quarterId = Number(req.params.id);
  const sourceId = Number(req.params.sourceId);
  const rows = db.prepare('SELECT * FROM quarter_members WHERE quarter_id = ?').all(sourceId) as any[];
  const insert = db.prepare(
    `INSERT INTO quarter_members (quarter_id, member_id, name, subteam_id, location_id, capacity_index, vacation_days)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const r of rows) {
      insert.run(quarterId, r.member_id, r.name, r.subteam_id, r.location_id, r.capacity_index, r.vacation_days);
    }
  });
  tx();
  res.json(db.prepare('SELECT COUNT(*) AS c FROM quarter_members WHERE quarter_id = ?').get(quarterId));
}));

/* -------------------------- Quarter members -------------------------- */
api.get('/quarters/:id/members', h((req, res) => {
  res.json(
    db
      .prepare(
        `SELECT qm.*, s.name AS subteam_name, s.color AS subteam_color, l.name AS location_name
         FROM quarter_members qm
         LEFT JOIN subteams s ON s.id = qm.subteam_id
         LEFT JOIN locations l ON l.id = qm.location_id
         WHERE qm.quarter_id = ?
         ORDER BY s.sort_order, qm.name`
      )
      .all(req.params.id)
  );
}));

api.post('/quarters/:id/members', h((req, res) => {
  const { member_id = null, name, subteam_id = null, location_id = null, capacity_index = 0.8, vacation_days = 0 } = req.body;
  const info = db
    .prepare(
      `INSERT INTO quarter_members (quarter_id, member_id, name, subteam_id, location_id, capacity_index, vacation_days)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.params.id, member_id, name, subteam_id, location_id, capacity_index, vacation_days);
  res.status(201).json(db.prepare('SELECT * FROM quarter_members WHERE id = ?').get(info.lastInsertRowid));
}));

api.put('/quarter-members/:id', h((req, res) => {
  const { name, subteam_id = null, location_id = null, capacity_index = 0.8, vacation_days = 0 } = req.body;
  db.prepare('UPDATE quarter_members SET name = ?, subteam_id = ?, location_id = ?, capacity_index = ?, vacation_days = ? WHERE id = ?')
    .run(name, subteam_id, location_id, capacity_index, vacation_days, req.params.id);
  res.json(db.prepare('SELECT * FROM quarter_members WHERE id = ?').get(req.params.id));
}));

api.delete('/quarter-members/:id', h((req, res) => {
  db.prepare('DELETE FROM quarter_members WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

/* ------------------------------ Efforts ------------------------------ */
api.get('/quarters/:id/efforts', h((req, res) => {
  res.json(db.prepare('SELECT * FROM quarter_efforts WHERE quarter_id = ?').all(req.params.id));
}));

api.put('/quarters/:id/efforts/:subteamId', h((req, res) => {
  const quarterId = Number(req.params.id);
  const subteamId = Number(req.params.subteamId);
  const planned = Number(req.body.planned_effort ?? 0);
  const actual = req.body.actual_effort === null || req.body.actual_effort === undefined || req.body.actual_effort === ''
    ? null
    : Number(req.body.actual_effort);
  db.prepare(
    `INSERT INTO quarter_efforts (quarter_id, subteam_id, planned_effort, actual_effort)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(quarter_id, subteam_id)
     DO UPDATE SET planned_effort = excluded.planned_effort, actual_effort = excluded.actual_effort`
  ).run(quarterId, subteamId, planned, actual);
  res.json(db.prepare('SELECT * FROM quarter_efforts WHERE quarter_id = ? AND subteam_id = ?').get(quarterId, subteamId));
}));

/* ------------------------------ Summary ------------------------------ */
api.get('/quarters/:id/summary', h((req, res) => {
  const summary = buildQuarterSummary(Number(req.params.id));
  if (!summary) return res.status(404).json({ error: 'Quarter not found' });
  res.json(summary);
}));
