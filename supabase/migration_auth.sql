-- Run this in the Supabase SQL Editor AFTER Kakao login is configured
-- (Authentication -> Providers -> Kakao) and the app's LoginScreen is wired up.
--
-- What this does:
-- 1. Clears out the device-id-based test data from before real login existed
--    (there is no real user behind those rows, so they can't be linked to
--    auth.users anyway).
-- 2. Links profiles.id to auth.users(id), so a profile row only ever exists
--    for a real authenticated (Kakao) user.
-- 3. Replaces the temporary "anon full access" policies from schema.sql with
--    real per-user policies enforced via auth.uid().
--
-- After this runs, the device-id scheme (utils/deviceId.js) is no longer used
-- by the app for talking to Supabase - the real Kakao-authenticated user id
-- (auth.uid()) is used instead.

truncate table expenses, diary_logs, profiles cascade;

alter table profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

drop policy if exists "anon full access" on profiles;
create policy "individuals manage own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "anon full access" on diary_logs;
create policy "individuals manage own diary logs" on diary_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "anon full access" on expenses;
create policy "individuals manage own expenses" on expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
