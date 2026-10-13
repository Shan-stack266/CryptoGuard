-- Run AFTER supabase-schema.sql, in Supabase SQL Editor.
-- The real account must already exist in Authentication > Users.
begin;
do $$
declare target_user uuid;
begin
  select id into target_user from auth.users
  where lower(email) = 'daguimolshan0@gmail.com';
  if target_user is null then
    raise exception 'Account daguimolshan0@gmail.com does not exist. Register it first, then rerun this query.';
  end if;

  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = '', updated_at = now()
  where id = target_user;

  insert into public.cg_profiles(id,email,role,active,locked_until)
  values(target_user,'daguimolshan0@gmail.com','admin',true,null)
  on conflict(id) do update
  set role='admin',active=true,locked_until=null,updated_at=now();

  delete from public.cg_login_counters
  where lower(email) = 'daguimolshan0@gmail.com';

  insert into public.cg_account_logs(target_id,operation,detail)
  values(target_user,'Administrator access granted',
    jsonb_build_object('email','daguimolshan0@gmail.com','role','admin','active',true,'method','SQL Editor'));
end $$;
commit;

select p.id,p.email,p.role,p.active,p.locked_until,u.email_confirmed_at
from public.cg_profiles p join auth.users u on u.id=p.id
where lower(p.email)='daguimolshan0@gmail.com';
