-- Run this in the Supabase SQL Editor to let profiles store the profile
-- photo Kakao returns at login.
alter table profiles
  add column if not exists avatar_url text;
