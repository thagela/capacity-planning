/**
 * Seeds the "Q2 2026" quarter with data matching the reference RICE board sheet.
 *
 * The shared CSV (the Topics sheet) only contained the effort/capacity summary, not the
 * per-person capacity-planning inputs. The members below are illustrative placeholders
 * whose computed capacity reproduces the sheet's totals exactly:
 *
 *   Sub-team   Capacity   Planned effort   Leftover   Leftover %
 *   Frontend   55         43               12         21.82%
 *   Backend    57         38               19         33.33%
 *   Design     26         16 (10 + UX 6)   10         38.46%
 *
 * Run with:  npm run seed
 * Safe to re-run: it resets only the "Q2 2026" quarter and the named roster members.
 */
import { db, migrate, seed as seedBase } from './db.js';

migrate();
seedBase(); // ensure default sub-teams + locations exist

const QUARTER_LABEL = 'Q2 2026';

function subteamId(name: string): number {
  const row = db.prepare('SELECT id FROM subteams WHERE name = ?').get(name) as { id: number } | undefined;
  if (!row) throw new Error(`Sub-team "${name}" not found — did the base seed run?`);
  return row.id;
}

function locationId(country: string, region: string | null): number {
  const row = (
    region
      ? db.prepare('SELECT id FROM locations WHERE country = ? AND region = ?').get(country, region)
      : db.prepare('SELECT id FROM locations WHERE country = ? AND region IS NULL').get(country)
  ) as { id: number } | undefined;
  if (!row) throw new Error(`Location ${country}/${region ?? '-'} not found — did the base seed run?`);
  return row.id;
}

const FE = subteamId('Frontend');
const BE = subteamId('Backend');
const DS = subteamId('Design');

const DE = locationId('DE', 'BE'); // Germany (Berlin)
const LK = locationId('LK', null); // Sri Lanka
const LT = locationId('LT', null); // Lithuania

// member, sub-team, location, capacity index, vacation days
const MEMBERS: Array<{ name: string; subteam: number; location: number; index: number; vacation: number }> = [
  { name: 'Anika', subteam: FE, location: DE, index: 0.6, vacation: 5 },
  { name: 'Bohan', subteam: FE, location: LK, index: 0.4, vacation: 3 },
  { name: 'Carlos', subteam: BE, location: LT, index: 0.5, vacation: 2 },
  { name: 'Dasha', subteam: BE, location: DE, index: 0.45, vacation: 0 },
  { name: 'Elif', subteam: DS, location: DE, index: 0.3, vacation: 0 },
  { name: 'Farah', subteam: DS, location: LK, index: 0.16, vacation: 8 },
];

// planned effort per sub-team (person-days), from the reference sheet
const EFFORTS: Array<{ subteam: number; planned: number }> = [
  { subteam: FE, planned: 43 },
  { subteam: BE, planned: 38 },
  { subteam: DS, planned: 16 }, // Design 10 + UX Research 6
];

const run = db.transaction(() => {
  // 1. Find or create the Q2 2026 quarter (active — today falls within it).
  let quarter = db.prepare('SELECT * FROM quarters WHERE label = ?').get(QUARTER_LABEL) as { id: number } | undefined;
  if (!quarter) {
    const info = db
      .prepare('INSERT INTO quarters (label, year, quarter, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(QUARTER_LABEL, 2026, 2, '2026-04-01', '2026-06-30', 'active');
    quarter = { id: Number(info.lastInsertRowid) };
  } else {
    db.prepare("UPDATE quarters SET start_date = '2026-04-01', end_date = '2026-06-30', status = 'active' WHERE id = ?").run(quarter.id);
  }
  const quarterId = quarter.id;

  // 2. Reset this quarter's planning rows and efforts so the seed is idempotent.
  db.prepare('DELETE FROM quarter_members WHERE quarter_id = ?').run(quarterId);
  db.prepare('DELETE FROM quarter_efforts WHERE quarter_id = ?').run(quarterId);

  const findMember = db.prepare('SELECT id FROM members WHERE name = ?');
  const insertMember = db.prepare(
    'INSERT INTO members (name, subteam_id, location_id, capacity_index, active) VALUES (?, ?, ?, ?, 1)'
  );
  const updateMember = db.prepare(
    'UPDATE members SET subteam_id = ?, location_id = ?, capacity_index = ?, active = 1 WHERE id = ?'
  );
  const insertQuarterMember = db.prepare(
    `INSERT INTO quarter_members (quarter_id, member_id, name, subteam_id, location_id, capacity_index, vacation_days)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const m of MEMBERS) {
    // Upsert the master roster entry by name, then snapshot it into the quarter.
    const existing = findMember.get(m.name) as { id: number } | undefined;
    let memberId: number;
    if (existing) {
      updateMember.run(m.subteam, m.location, m.index, existing.id);
      memberId = existing.id;
    } else {
      memberId = Number(insertMember.run(m.name, m.subteam, m.location, m.index).lastInsertRowid);
    }
    insertQuarterMember.run(quarterId, memberId, m.name, m.subteam, m.location, m.index, m.vacation);
  }

  const insertEffort = db.prepare(
    'INSERT INTO quarter_efforts (quarter_id, subteam_id, planned_effort, actual_effort) VALUES (?, ?, ?, NULL)'
  );
  for (const e of EFFORTS) insertEffort.run(quarterId, e.subteam, e.planned);

  return quarterId;
});

const quarterId = run();
console.log(`✓ Seeded "${QUARTER_LABEL}" (quarter id ${quarterId}) with ${MEMBERS.length} members and effort for ${EFFORTS.length} sub-teams.`);
console.log('  Start the app and open the Capacity Planning / Effort & Leftover tabs to view it.');
