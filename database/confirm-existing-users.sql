-- Run AFTER supabase-schema.sql, in Supabase SQL Editor.
-- Confirms existing email accounts; it does NOT promote anyone to administrator.
-- For FUTURE signups, disable Confirm Email in Supabase Authentication settings.
begin;
with confirmed as (
  update auth.users
  set email_confirmed_at=now(),confirmation_token='',updated_at=now()
  where email is not null and email_confirmed_at is null
  returning id
)
insert into public.cg_account_logs(target_id,operation,detail)
select id,'Email account confirmed',jsonb_build_object('method','SQL Editor bulk confirmation')
from confirmed;
commit;

select id,email,email_confirmed_at
from auth.users where email is not null order by created_at desc;
