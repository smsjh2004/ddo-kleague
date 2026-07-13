-- 친구 기능: 프로필별 친구코드 + 요청/수락 기반 친구 관계
--
-- HOW TO RUN: Supabase SQL Editor에 붙여넣고 실행 (schema.sql 이후에).
-- 이 프로젝트에서 friendships 테이블을 아직 만든 적 없으면 이 파일 그대로,
-- 예전 버전(대칭 2행 모델)을 이미 실행했었다면 먼저
--   drop table if exists friendships;
-- 로 지우고 이 파일을 실행할 것.
--
-- friendships: requester -> addressee 방향의 요청 1행으로 표현.
-- status='pending'으로 생성되고 addressee가 수락하면 'accepted'로 바뀐다.
-- (기존에 썼던 "양방향 2행" 모델 대신 "방향 있는 1행 + status"로 바꿔서
-- 요청/수락 흐름과 "내가 보낸 요청" vs "내가 받은 요청" 구분을 자연스럽게 표현.)

alter table profiles add column if not exists friend_code text unique;

create table if not exists friendships (
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table friendships enable row level security;

-- 개발용 개방 정책 (schema.sql의 다른 테이블과 동일한 임시 모델).
-- 실서비스 전 auth.uid() 기반 정책으로 교체 필요.
drop policy if exists "anon full access" on friendships;
create policy "anon full access" on friendships for all using (true) with check (true);
