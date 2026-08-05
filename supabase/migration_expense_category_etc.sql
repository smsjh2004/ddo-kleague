-- Adds a standalone '기타' (etc) expense category, distinct from 'goods' -
-- previously the client lumped miscellaneous spend into the "굿즈/기타" label
-- on the 'goods' category. Widens the existing category CHECK constraint.
-- HOW TO RUN: Supabase SQL Editor에 붙여넣고 실행.

alter table expenses drop constraint if exists expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category in ('ticket', 'food', 'transport', 'goods', 'etc'));
