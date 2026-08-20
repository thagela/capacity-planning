# Lovable build prompt — Capacity Planning Tool

Paste the block below as the **first message** in a new Lovable project. After it
scaffolds, connect Supabase (Lovable will prompt you), then run
`supabase_schema.sql` in the Supabase SQL editor, and drop in `capacity.ts` for
the maths. Follow-up prompts are listed at the bottom.

---

## INITIAL PROMPT (paste this into Lovable)

Build a **quarterly capacity planning tool** for cross-functional product teams
(Frontend, Backend, Design). Use React + Vite + Tailwind + shadcn/ui, and use
**Supabase** for the database. Keep a clean, modern dashboard-style UI with a
left sidebar (not top tabs).

### Data (Supabase Postgres tables)
- `subteams` (id, name, color, sort_order)
- `locations` (id, name, country [ISO code like DE/LK/LT], region [optional, e.g. BE for Berlin])
- `members` (id, name, subteam_id, location_id, capacity_index [0–1, default 0.8], active)
- `quarters` (id, label, year, quarter, start_date, end_date, status ['planning'|'active'|'completed'])
- `quarter_members` (id, quarter_id, member_id, name, subteam_id, location_id, capacity_index, vacation_days) — a per-quarter snapshot so past quarters stay stable
- `quarter_efforts` (id, quarter_id, subteam_id, planned_effort, actual_effort) — unique per (quarter, subteam)

All reads/writes go through the Supabase client.

### Capacity calculation (run in the browser)
Install and use the **`date-holidays`** npm package. For each member in a quarter:
```
working days   = weekdays (Mon–Fri) between the quarter's start and end dates
                 − public holidays at the member's location (weekdays only, from date-holidays)
available days = working days − vacation_days
effective      = available days × capacity_index   (person-days)
```
A sub-team's capacity = sum of its members' effective capacity.
`leftover = capacity − planned_effort`; `leftover % = leftover / capacity`.

### Screens (left sidebar: "Plan" group and "Configure" group)
**Plan**
1. **Overview** (landing): a quarter selector in the header; hero tiles for Total
   capacity / Planned effort / Leftover / Team size; a "Capacity by sub-team"
   section with one row per sub-team showing a horizontal bar (planned vs
   capacity, coloured by health), an **inline editable "planned effort" input**,
   and the leftover %. Below that an **Action items** panel auto-generated from
   the numbers (see rules below).
2. **Planning**: capacity inputs only — a table of the quarter's members grouped
   by sub-team, each row editable (name, sub-team, location, capacity index,
   vacation days) and showing computed working days, public holidays, and
   effective capacity. Buttons: "Import roster" (copy active members into this
   quarter) and "Add member". Also show the public holidays applied per location.
3. **Retrospective**: its own page. A table per sub-team of Planned vs Actual
   effort (actual is editable), with Variance, Estimate accuracy (planned÷actual)
   and Capacity used (actual÷capacity). Emphasise this page when the quarter's
   status is 'completed'.
4. **History**: a table of all quarters with capacity, planned effort, leftover %,
   and — where actuals exist — estimate accuracy.

**Configure**
5. **Quarters**: create/select quarters (dates default to the calendar quarter),
   set status, delete.
6. **Team**: master roster CRUD (name, sub-team, location, capacity index, active).
7. **Settings**: manage sub-teams (name, colour) and work locations
   (country + optional region). Populate country/region choices from date-holidays.

### Action item rules (Overview), per sub-team with members
- planned_effort = 0 → info: "No effort planned for {team}".
- leftover < 0 → critical: "{team} is overcommitted — {x}d over. Cut scope or add capacity."
- leftover % < 5 → warning: "{team} is at capacity — only {x}d buffer."
- leftover % > 25 → warning: "{team} is under-utilised — {x}d free."
- otherwise → ok: "{team} is well balanced."
Health colours: leftover % < 5 = red, 5–25 = green, > 25 = amber.

### Seed data
Sub-teams: Frontend, Backend, Design. Locations: Sri Lanka (LK), Lithuania (LT),
Germany/Berlin (DE, region BE).

Round capacity figures to 2 decimals. Make it responsive and clean.

---

## FOLLOW-UP PROMPTS (send one at a time after the first build)
1. "Add a quarter switcher in the header that persists the selected quarter, and
   make the Overview's planned-effort inputs save to Supabase on change and
   refresh the totals/action items live."
2. "Use the exact capacity calculation from this file" — then paste `capacity.ts`.
3. "Add Supabase email auth so only signed-in users can view/edit, and add
   row-level security policies that require an authenticated user." (Do this
   before sharing the URL — see the schema file's RLS note.)
4. "Add an 'Import roster' action on Planning that inserts active members into
   quarter_members for the selected quarter, and a 'Clone from previous quarter'."
5. Publish: click **Publish** in Lovable (top right) for a `*.lovable.app` URL,
   or attach a custom domain in project settings.
