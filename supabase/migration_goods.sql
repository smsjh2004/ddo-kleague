-- Run in the Supabase SQL Editor to add "마이 굿즈 보관함" support (My Page).
--
-- goods: a collectible item the user owns (jersey, muffler, etc).
-- goods_logs: which diary_logs entries this item was worn to, so a win rate
-- can be computed per item ("이 유니폼 입고 간 경기 승률").

create table if not exists goods (
  id text primary key, -- client-generated 'goods-<timestamp>' id, same convention as diary_logs/expenses
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

alter table goods enable row level security;
alter table goods_logs enable row level security;

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
