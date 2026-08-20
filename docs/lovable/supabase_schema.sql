-- Capacity Planning — Supabase (Postgres) schema
-- Run this in the Supabase SQL editor (Lovable > your project > Supabase > SQL).

create table if not exists subteams (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  color       text not null default '#6366f1',
  sort_order  int  not null default 0
);

create table if not exists locations (
  id       bigint generated always as identity primary key,
  name     text not null,
  country  text not null,          -- ISO 3166-1 alpha-2 for date-holidays (DE, LK, LT)
  region   text                    -- optional state/canton (e.g. BE for Berlin)
);

create table if not exists members (
  id              bigint generated always as identity primary key,
  name            text not null,
  subteam_id      bigint references subteams(id) on delete set null,
  location_id     bigint references locations(id) on delete set null,
  capacity_index  numeric not null default 0.8,
  active          boolean not null default true
);

create table if not exists quarters (
  id          bigint generated always as identity primary key,
  label       text not null unique,     -- e.g. "Q2 2026"
  year        int  not null,
  quarter     int  not null,            -- 1..4
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'planning'  -- planning | active | completed
);

-- Per-quarter snapshot of each member's inputs (keeps history stable).
create table if not exists quarter_members (
  id              bigint generated always as identity primary key,
  quarter_id      bigint not null references quarters(id) on delete cascade,
  member_id       bigint references members(id) on delete set null,
  name            text not null,
  subteam_id      bigint references subteams(id) on delete set null,
  location_id     bigint references locations(id) on delete set null,
  capacity_index  numeric not null default 0.8,
  vacation_days   numeric not null default 0
);

-- Planned + (post-quarter) actual effort per sub-team, in person-days.
create table if not exists quarter_efforts (
  id              bigint generated always as identity primary key,
  quarter_id      bigint not null references quarters(id) on delete cascade,
  subteam_id      bigint not null references subteams(id) on delete cascade,
  planned_effort  numeric not null default 0,
  actual_effort   numeric,
  unique (quarter_id, subteam_id)
);

-- Seed defaults ------------------------------------------------------------
insert into subteams (name, color, sort_order) values
  ('Frontend', '#2563eb', 1),
  ('Backend',  '#059669', 2),
  ('Design',   '#db2777', 3)
on conflict (name) do nothing;

insert into locations (name, country, region) values
  ('Sri Lanka',        'LK', null),
  ('Lithuania',        'LT', null),
  ('Germany (Berlin)', 'DE', 'BE');

-- Row-Level Security -------------------------------------------------------
-- Supabase blocks all access until you add policies. Pick ONE option.
--
-- OPTION A — internal/demo, no login (ANYONE with the anon key can read/write).
-- Fine for a quick private demo; DO NOT use for anything sensitive.
alter table subteams        enable row level security;
alter table locations       enable row level security;
alter table members         enable row level security;
alter table quarters        enable row level security;
alter table quarter_members enable row level security;
alter table quarter_efforts enable row level security;

create policy "anon all" on subteams        for all using (true) with check (true);
create policy "anon all" on locations       for all using (true) with check (true);
create policy "anon all" on members         for all using (true) with check (true);
create policy "anon all" on quarters        for all using (true) with check (true);
create policy "anon all" on quarter_members for all using (true) with check (true);
create policy "anon all" on quarter_efforts for all using (true) with check (true);

-- OPTION B — recommended once you add Supabase Auth: replace each "anon all"
-- policy above with an authenticated-only one, e.g.:
--   create policy "auth all" on subteams for all
--     using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- (Drop the "anon all" policies first: drop policy "anon all" on subteams; ... )
