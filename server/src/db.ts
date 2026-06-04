import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The SQLite file lives in <repo>/data/capacity.sqlite (gitignored).
const dataDir = resolve(__dirname, '../../data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.CP_DB_PATH || resolve(dataDir, 'capacity.sqlite');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subteams (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      color      TEXT NOT NULL DEFAULT '#4f46e5',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS locations (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      name    TEXT NOT NULL,
      country TEXT NOT NULL,           -- ISO 3166-1 alpha-2 code for date-holidays (e.g. DE, LK, LT)
      region  TEXT                     -- optional state / canton (e.g. BE for Berlin)
    );

    CREATE TABLE IF NOT EXISTS members (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      subteam_id     INTEGER REFERENCES subteams(id) ON DELETE SET NULL,
      location_id    INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      capacity_index REAL NOT NULL DEFAULT 0.8,
      active         INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS quarters (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      label      TEXT NOT NULL UNIQUE,   -- e.g. "Q2 2026"
      year       INTEGER NOT NULL,
      quarter    INTEGER NOT NULL,       -- 1..4
      start_date TEXT NOT NULL,          -- YYYY-MM-DD inclusive
      end_date   TEXT NOT NULL,          -- YYYY-MM-DD inclusive
      status     TEXT NOT NULL DEFAULT 'planning'  -- planning | active | completed
    );

    -- Per-quarter snapshot of a member's planning inputs. Snapshotting name/subteam/
    -- location keeps historical quarters stable even when the master roster changes.
    CREATE TABLE IF NOT EXISTS quarter_members (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      quarter_id     INTEGER NOT NULL REFERENCES quarters(id) ON DELETE CASCADE,
      member_id      INTEGER REFERENCES members(id) ON DELETE SET NULL,
      name           TEXT NOT NULL,
      subteam_id     INTEGER REFERENCES subteams(id) ON DELETE SET NULL,
      location_id    INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      capacity_index REAL NOT NULL DEFAULT 0.8,
      vacation_days  REAL NOT NULL DEFAULT 0
    );

    -- Planned and (post-quarter) actual effort per sub-team, in person-days.
    CREATE TABLE IF NOT EXISTS quarter_efforts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      quarter_id     INTEGER NOT NULL REFERENCES quarters(id) ON DELETE CASCADE,
      subteam_id     INTEGER NOT NULL REFERENCES subteams(id) ON DELETE CASCADE,
      planned_effort REAL NOT NULL DEFAULT 0,
      actual_effort  REAL,
      UNIQUE(quarter_id, subteam_id)
    );
  `);
}

export function seed(): void {
  const subteamCount = (db.prepare('SELECT COUNT(*) AS c FROM subteams').get() as { c: number }).c;
  if (subteamCount === 0) {
    const insert = db.prepare('INSERT INTO subteams (name, color, sort_order) VALUES (?, ?, ?)');
    insert.run('Frontend', '#2563eb', 1);
    insert.run('Backend', '#059669', 2);
    insert.run('Design', '#db2777', 3);
  }

  const locationCount = (db.prepare('SELECT COUNT(*) AS c FROM locations').get() as { c: number }).c;
  if (locationCount === 0) {
    const insert = db.prepare('INSERT INTO locations (name, country, region) VALUES (?, ?, ?)');
    insert.run('Sri Lanka', 'LK', null);
    insert.run('Lithuania', 'LT', null);
    insert.run('Germany (Berlin)', 'DE', 'BE');
  }
}
