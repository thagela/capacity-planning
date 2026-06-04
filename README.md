# 📊 Capacity Planning

A lightweight web tool for **quarterly capacity planning** of cross-functional teams
(Frontend, Backend, Design, …). It replaces the spreadsheet workflow: capture team
members, their location, vacations and a capacity index, compute available
person-days per sub-team after public holidays, enter planned effort, and see the
**leftover capacity** at a glance — plus a **retrospective** once the quarter is done.

## Features

- **Team members & sub-teams** — maintain a roster and assign each person to a sub-team.
- **Vacations** — record planned vacation days per member, per quarter.
- **Public holidays** — computed automatically per work location from a bundled
  holiday calendar (`date-holidays`), no internet required. Supports Sri Lanka,
  Lithuania, Germany (per federal state) and ~200 other countries/regions.
- **Capacity index** — a factor (e.g. `0.8`) reflecting that not all time is spent on
  deliverable work (meetings, support, etc.).
- **Available capacity by sub-team** — `(working weekdays − holidays − vacation) × index`,
  summed per sub-team in person-days.
- **Planned effort & leftover** — enter planned effort per sub-team and see leftover
  capacity and leftover %, with health indicators (over-committed / healthy / under-utilised).
- **Retrospective** — after the quarter, record actual effort to review estimate
  accuracy and capacity utilisation.
- **History** — browse all quarters and their capacity/effort trends.

## How capacity is calculated

For each member in a quarter:

```
working weekdays in quarter   (Mon–Fri between start and end dates)
  − public holidays at their location (weekdays only)
  − planned vacation days
  = available days
  × capacity index
  = effective capacity (person-days)
```

Sub-team capacity is the sum of its members' effective capacity. Then:

```
leftover   = capacity − planned effort
leftover % = leftover / capacity
```

## Tech stack

- **Server:** Node + Express + SQLite (`better-sqlite3`) + `date-holidays`
- **Client:** React + Vite + TypeScript
- Data lives in a local SQLite file at `data/capacity.sqlite` (gitignored).

## Getting started

```bash
npm install            # installs server + client workspaces

# Development (two processes, hot reload):
npm run dev            # client on http://localhost:5173, API on http://localhost:4000

# Production (single process serves API + built client):
npm run build          # builds the client into client/dist
npm start              # serves everything on http://localhost:4000
```

The database is created and seeded automatically on first run (default sub-teams
Frontend/Backend/Design and locations Sri Lanka / Lithuania / Germany).

### Configuration

| Env var      | Default                  | Description                          |
| ------------ | ------------------------ | ------------------------------------ |
| `PORT`       | `4000`                   | Server port                          |
| `CP_DB_PATH` | `data/capacity.sqlite`   | Path to the SQLite database file     |

## Typical workflow

1. **Settings** — confirm your sub-teams and work locations.
2. **Roster** — add your team members with their sub-team, location and capacity index.
3. **Quarters** — create the quarter (dates default to the calendar quarter).
4. **Capacity Planning** — *Import roster*, then set each person's vacation days.
   Review available capacity by sub-team.
5. **Effort & Leftover** — enter planned effort per sub-team; watch the leftover %.
6. After the quarter, set its status to **completed** and record **actual effort**
   on the same tab to run the retrospective.
