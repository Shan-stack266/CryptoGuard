-- Run in Supabase SQL Editor AFTER supabase-schema.sql and ias-master-migration.sql.
-- Existing accounts, passwords, roles, sessions and history are preserved.
-- Apply this before deploying the new five-field registration form.
begin;
alter table public.cg_profiles add column if not exists full_name text not null default '';
alter table public.cg_profiles add column if not exists username text;
alter table public.cg_profiles drop constraint if exists cg_profiles_full_name_format;
alter table public.cg_profiles add constraint cg_profiles_full_name_format
  check(length(full_name) <= 100 and full_name !~ '[[:cntrl:]]');
alter table public.cg_profiles drop constraint if exists cg_profiles_username_format;
alter table public.cg_profiles add constraint cg_profiles_username_format
  check(username is null or username ~ '^[a-z0-9_]{3,30}$');
-- Lowercase storage plus this unique index prevents case-only duplicates, including races.
-- NULL usernames are allowed only to preserve existing accounts without inventing data.
create unique index if not exists cg_profiles_username_unique on public.cg_profiles(username);

create or replace function public.cg_handle_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare signup_name text; signup_username text;
begin
  if tg_op = 'INSERT' then
    if jsonb_typeof(new.raw_user_meta_data->'full_name') is distinct from 'string'
       or jsonb_typeof(new.raw_user_meta_data->'username') is distinct from 'string' then
      raise exception 'Full name and username are required for new accounts.' using errcode='23514';
    end if;
    signup_name=btrim(new.raw_user_meta_data->>'full_name');
    signup_username=lower(btrim(new.raw_user_meta_data->>'username'));
    if length(signup_name) < 2 or length(signup_name) > 100 or signup_name ~ '[[:cntrl:]]' then
      raise exception 'Full name must contain 2-100 characters without control characters.' using errcode='23514';
    end if;
    if signup_username !~ '^[a-z0-9_]{3,30}$' then
      raise exception 'Username must contain 3-30 letters, numbers, or underscores.' using errcode='23514';
    end if;
    -- Role and access fields always use server defaults, never user metadata.
    insert into public.cg_profiles(id,email,full_name,username,display_name)
    values(new.id,lower(new.email),signup_name,signup_username,signup_name);
    insert into public.cg_account_logs(target_id,operation,detail)
    values(new.id,'Account created',jsonb_build_object('full_name',signup_name,'username',signup_username));
  else
    if new.email is distinct from old.email then
      update public.cg_profiles set email=lower(new.email),updated_at=now() where id=new.id;
      insert into public.cg_account_logs(target_id,operation) values(new.id,'Email changed');
    end if;
    if new.encrypted_password is distinct from old.encrypted_password then
      insert into public.cg_account_logs(target_id,operation) values(new.id,'Password changed');
    end if;
  end if;
  return new;
end $$;
revoke all on function public.cg_handle_auth_user() from public, anon, authenticated;
-- Existing RLS, browser restrictions and service-role grants remain in force.
commit;

-- No password/confirmation columns are added. Supabase Auth manages passwords.
-- Existing accounts keep an empty full_name and NULL username until real details are supplied.
