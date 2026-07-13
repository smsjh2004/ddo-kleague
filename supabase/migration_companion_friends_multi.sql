-- 직관일지 동행인을 여러 명 선택할 수 있도록 변경 (기존 companion_friend_id 단일 컬럼 -> 배열).
-- HOW TO RUN: Supabase SQL Editor에 붙여넣고 실행.
-- migration_companion_friend.sql을 이미 실행했다면 이 파일로 대체, 아직 안 했으면
-- 이 파일만 실행하면 됨 (컬럼명이 달라서 순서 상관없음).

alter table diary_logs drop column if exists companion_friend_id;
alter table diary_logs add column if not exists companion_friend_ids uuid[];
