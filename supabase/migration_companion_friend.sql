-- 직관일지 동행인을 친구목록의 프로필과 연결 (같이 간 경기 승/무/패 집계용).
-- HOW TO RUN: Supabase SQL Editor에 붙여넣고 실행.
-- companion 텍스트 컬럼은 그대로 두고(표시용), 친구를 선택한 경우에만
-- companion_friend_id가 채워짐 - 직접 텍스트로 입력한 동행인은 null로 남는다.

alter table diary_logs add column if not exists companion_friend_id uuid references profiles(id) on delete set null;
