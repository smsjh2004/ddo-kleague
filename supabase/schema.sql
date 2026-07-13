-- K리그 직관일지 - initial backend schema
--
-- HOW TO RUN:
-- 1. Create a project at https://supabase.com/dashboard
-- 2. Open the SQL Editor for that project and paste this whole file in, then Run.
-- 3. Copy the Project URL and anon public key (Project Settings -> API)
--    into expo-app/constants/supabaseConfig.js.
--
-- AUTH MODEL (temporary, until Kakao login is wired up):
-- There is no real Supabase Auth session yet. The app generates a random
-- UUID per install (utils/deviceId.js) and sends it as `user_id`/`id` on every
-- request using the public anon key. Because there is no authenticated
-- session, RLS cannot verify "this caller owns this row" the normal way
-- (auth.uid()), so the policies below simply allow the anon key to read/write
-- everything, and the app is trusted to only ever query with its own device id.
--
-- THIS IS NOT SECURE: anyone who has the anon key and guesses/observes a
-- device id can read or write that device's data. It's fine for early
-- development, but before real release this should be replaced with Supabase
-- Auth (e.g. anonymous sign-in now, linked to Kakao/Google later) so RLS can
-- enforce auth.uid() = user_id for real.

create table if not exists profiles (
  id uuid primary key,
  nickname text not null,
  my_team text,
  second_team text,
  third_team text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists diary_logs (
  id text primary key, -- matches the client-generated Date.now().toString() ids
  user_id uuid not null references profiles(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  home_score int,
  away_score int,
  match_date date not null,
  stadium text,
  rating int check (rating between 1 and 5),
  photo_url text,
  review text,
  companion text,
  weather text,
  referee_score int check (referee_score between 0 and 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists expenses (
  id text primary key, -- matches the client-generated 'exp-<timestamp>-<category>' ids
  user_id uuid not null references profiles(id) on delete cascade,
  match_id text references diary_logs(id) on delete cascade,
  match_title text,
  expense_date date not null,
  category text check (category in ('ticket', 'food', 'transport', 'goods')),
  amount numeric not null,
  memo text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table diary_logs enable row level security;
alter table expenses enable row level security;

drop policy if exists "anon full access" on profiles;
create policy "anon full access" on profiles for all using (true) with check (true);

drop policy if exists "anon full access" on diary_logs;
create policy "anon full access" on diary_logs for all using (true) with check (true);

drop policy if exists "anon full access" on expenses;
create policy "anon full access" on expenses for all using (true) with check (true);
