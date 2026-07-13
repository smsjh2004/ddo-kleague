-- Run this in the Supabase SQL Editor to remove the second/third favorite
-- team feature. My Page now only supports a single myTeam selection.
alter table profiles
  drop column if exists second_team,
  drop column if exists third_team;
