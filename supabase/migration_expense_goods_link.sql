-- 지출 내역(카테고리 '굿즈')을 마이페이지 굿즈보관함의 실제 등록 아이템과 연결.
-- HOW TO RUN: Supabase SQL Editor에 붙여넣고 실행.

alter table expenses add column if not exists goods_id text references goods(id) on delete set null;
