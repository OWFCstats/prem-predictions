-- Prem Predictor 26/27 — Supabase schema
-- Run this whole file once in the Supabase SQL editor (Project > SQL Editor > New query)
-- before handing the repo to Claude Code. Claude Code should treat this file as the
-- source of truth for the data model and NOT invent a different schema.

-- ─────────────────────────────────────────────────────────────
-- CONFIG: season lock timestamp
-- ─────────────────────────────────────────────────────────────
-- Edit this to the actual 26/27 season kickoff time (UTC) before running.
create table if not exists app_config (
  key text primary key,
  value text not null
);
insert into app_config (key, value)
values ('season_lock_at', '2026-08-21T19:00:00Z')
on conflict (key) do nothing;

-- RLS matters here: a public-schema table with RLS switched OFF is fully
-- writable by anyone holding the anon key, which ships in the site's JS.
-- Without this, a stranger could move the lock time and reopen predictions.
alter table app_config enable row level security;

create policy "app_config_public_read"
  on app_config for select
  using (true);

create policy "app_config_admin_write"
  on app_config for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- TEAMS (seed from reference/teams_2026_27.json after this runs)
-- ─────────────────────────────────────────────────────────────
create table if not exists teams (
  code text primary key,
  name text not null
);

alter table teams enable row level security;

create policy "teams_public_read"
  on teams for select
  using (true);

create policy "teams_admin_write"
  on teams for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- PREDICTIONS — one row per player, locked forever once inserted
-- ─────────────────────────────────────────────────────────────
create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  player_name text not null unique,
  predicted_order jsonb not null, -- array of 20 team codes, index 0 = 1st place
  submitted_at timestamptz not null default now()
);

alter table predictions enable row level security;

-- Anyone can read predictions (leaderboard, transparency)
create policy "predictions_public_read"
  on predictions for select
  using (true);

-- Anyone can insert their own prediction, but ONLY before the season lock,
-- and only once per player_name (enforced by the unique constraint above).
create policy "predictions_insert_before_lock"
  on predictions for insert
  with check (
    now() < (select value::timestamptz from app_config where key = 'season_lock_at')
  );

-- No update or delete policy exists for predictions on purpose.
-- This means the anon key can NEVER modify or remove a submitted prediction —
-- not even the admin, short of using the Supabase dashboard directly.
-- That's intentional: it matches "cannot be changed once locked in."

-- ─────────────────────────────────────────────────────────────
-- LIVE TABLE — actual current standings, admin-editable only
-- ─────────────────────────────────────────────────────────────
create table if not exists live_table (
  team_code text primary key references teams(code),
  position int -- 1-20, null until admin sets it
);

alter table live_table enable row level security;

create policy "live_table_public_read"
  on live_table for select
  using (true);

-- Only a logged-in (Supabase Auth) user can write. In practice this means
-- only Owen, since he's the only account that will ever be created.
create policy "live_table_admin_write"
  on live_table for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- GAMEWEEK SNAPSHOTS — admin-triggered, powers the progress graph
-- ─────────────────────────────────────────────────────────────
create table if not exists gameweek_snapshots (
  id uuid primary key default gen_random_uuid(),
  gameweek int not null,
  player_name text not null,
  total_points int not null,
  saved_at timestamptz not null default now(),
  unique (gameweek, player_name)
);

alter table gameweek_snapshots enable row level security;

create policy "snapshots_public_read"
  on gameweek_snapshots for select
  using (true);

create policy "snapshots_admin_write"
  on gameweek_snapshots for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- LEAGUES — any player can start one and add friends to it (low-stakes,
-- no security beyond the app itself; the thing that actually needs
-- protecting is predictions, handled above)
-- ─────────────────────────────────────────────────────────────
create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists league_members (
  league_id uuid not null references leagues(id) on delete cascade,
  player_name text not null,
  primary key (league_id, player_name)
);

alter table leagues enable row level security;
alter table league_members enable row level security;

create policy "leagues_public_read" on leagues for select using (true);
create policy "leagues_public_insert" on leagues for insert with check (true);

create policy "league_members_public_read" on league_members for select using (true);
create policy "league_members_public_insert" on league_members for insert with check (true);
