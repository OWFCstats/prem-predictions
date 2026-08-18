-- Run this ONCE in the Supabase SQL editor, after schema.sql.
-- The 20 clubs for 26/27: last season's list, minus West Ham, Wolves and
-- Burnley, plus Coventry, Hull and Ipswich.
-- Safe to re-run — existing rows are left alone.

insert into teams (code, name) values
  ('AFC', 'AFC Bournemouth'),
  ('ARS', 'Arsenal'),
  ('AVL', 'Aston Villa'),
  ('BRE', 'Brentford'),
  ('BHA', 'Brighton'),
  ('CHE', 'Chelsea'),
  ('COV', 'Coventry'),
  ('CRY', 'Crystal Palace'),
  ('EVE', 'Everton'),
  ('FUL', 'Fulham'),
  ('HUL', 'Hull'),
  ('IPS', 'Ipswich'),
  ('LEE', 'Leeds'),
  ('LIV', 'Liverpool'),
  ('MCI', 'Manchester City'),
  ('MUN', 'Manchester United'),
  ('NEW', 'Newcastle'),
  ('NFO', 'Nottingham Forest'),
  ('SUN', 'Sunderland'),
  ('TOT', 'Tottenham')
on conflict (code) do nothing;

-- Check it worked: should return 20.
select count(*) as team_count from teams;
