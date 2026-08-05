-- 또직관 - full backend schema (consolidated)
--
-- HOW TO RUN:
-- 1. Create a project at https://supabase.com/dashboard
-- 2. Open the SQL Editor for that project and paste this whole file in, then Run.
--    Safe to re-run any time (every statement is idempotent: "if not exists" /
--    "if exists") - this is the single source of truth for the current schema,
--    replacing the older one-off migration_*.sql files in this folder (kept
--    around only as history of how the schema got here).
-- 3. Copy the Project URL and anon public key (Project Settings -> API)
--    into expo-app/constants/supabaseConfig.js.
-- 4. Authentication -> Providers -> enable Kakao (see utils/auth.js for the
--    redirect flow) so auth.uid() exists for the RLS policies below.
--
-- AUTH MODEL: profiles.id is a real Supabase Auth user (Kakao login via
-- utils/auth.js), so every RLS policy below enforces auth.uid() = <owner
-- column> - a signed-in user can only ever read/write their own rows.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  my_team text,
  avatar_url text,
  friend_code text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table profiles drop column if exists second_team;
alter table profiles drop column if exists third_team;

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
  photo_url text, -- cover photo (first of photo_urls), kept for backward compat
  photo_urls text[], -- up to 5 photos, in display order
  review text,
  companion text,
  companion_friend_ids uuid[], -- profiles picked as companions (see FriendsScreen)
  weather text,
  referee_score int check (referee_score between 0 and 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table diary_logs add column if not exists photo_urls text[];
alter table diary_logs add column if not exists companion_friend_ids uuid[];
alter table diary_logs drop column if exists companion_friend_id; -- superseded by companion_friend_ids

-- goods: a collectible item the user owns (jersey, muffler, etc), and which
-- diary_logs entries it was worn to (for a per-item win rate on My Page).
-- Defined before expenses since expenses.goods_id references it.
create table if not exists goods (
  id text primary key, -- client-generated 'goods-<timestamp>' id
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  category text, -- 'jersey' | 'muffler' | 'etc'
  photo_url text,
  created_at timestamptz default now()
);

create table if not exists goods_logs (
  goods_id text not null references goods(id) on delete cascade,
  diary_log_id text not null references diary_logs(id) on delete cascade,
  primary key (goods_id, diary_log_id)
);

create table if not exists expenses (
  id text primary key, -- matches the client-generated 'exp-<timestamp>-<n>' ids
  user_id uuid not null references profiles(id) on delete cascade,
  match_id text references diary_logs(id) on delete cascade,
  match_title text,
  expense_date date not null,
  category text check (category in ('ticket', 'food', 'transport', 'goods', 'etc')),
  amount numeric not null,
  memo text,
  goods_id text references goods(id) on delete set null,
  created_at timestamptz default now()
);
alter table expenses add column if not exists goods_id text references goods(id) on delete set null;
-- widen an older category constraint that predates the 'etc' category
alter table expenses drop constraint if exists expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category in ('ticket', 'food', 'transport', 'goods', 'etc'));

-- friendships: requester -> addressee direction with a status. Created as
-- 'pending', flips to 'accepted' once the addressee accepts.
create table if not exists friendships (
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table profiles enable row level security;
alter table diary_logs enable row level security;
alter table expenses enable row level security;
alter table goods enable row level security;
alter table goods_logs enable row level security;
alter table friendships enable row level security;

drop policy if exists "anon full access" on profiles;
drop policy if exists "individuals manage own profile" on profiles;
create policy "individuals manage own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
-- everyone needs to be able to look up a nickname/team by friend code to send
-- a request, and to see a friend's profile - not just their own row.
drop policy if exists "profiles are readable by any signed-in user" on profiles;
create policy "profiles are readable by any signed-in user" on profiles
  for select using (auth.uid() is not null);

drop policy if exists "anon full access" on diary_logs;
drop policy if exists "individuals manage own diary logs" on diary_logs;
create policy "individuals manage own diary logs" on diary_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- friends can read each other's logs for the friend feed / head-to-head stats
drop policy if exists "friends can read diary logs" on diary_logs;
create policy "friends can read diary logs" on diary_logs
  for select using (
    auth.uid() = user_id or exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = diary_logs.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = diary_logs.user_id))
    )
  );

drop policy if exists "anon full access" on expenses;
drop policy if exists "individuals manage own expenses" on expenses;
create policy "individuals manage own expenses" on expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "individuals manage own goods" on goods;
create policy "individuals manage own goods" on goods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "individuals manage own goods_logs" on goods_logs;
create policy "individuals manage own goods_logs" on goods_logs
  for all using (
    exists (select 1 from goods g where g.id = goods_logs.goods_id and g.user_id = auth.uid())
  ) with check (
    exists (select 1 from goods g where g.id = goods_logs.goods_id and g.user_id = auth.uid())
  );

drop policy if exists "anon full access" on friendships;
drop policy if exists "individuals manage own friendships" on friendships;
create policy "individuals manage own friendships" on friendships
  for all using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);
