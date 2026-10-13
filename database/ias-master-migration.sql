-- Run after supabase-schema.sql. Keeps existing users, ciphers and logs.
begin;
alter table public.cg_profiles add column if not exists display_name text not null default '';
alter table public.cg_profiles drop constraint if exists cg_profile_name_length;
alter table public.cg_profiles add constraint cg_profile_name_length check(length(display_name) <= 100);
alter table public.cg_events add column if not exists user_agent text;
alter table public.cg_events add column if not exists http_status integer;
update public.cg_events set severity='Medium' where severity='Moderate';
update public.cg_alerts set severity='Medium' where severity='Moderate';
alter table public.cg_events drop constraint if exists cg_events_severity_values;
alter table public.cg_events add constraint cg_events_severity_values check(severity in ('Low','Medium','High','Critical'));
alter table public.cg_alerts drop constraint if exists cg_alerts_severity_values;
alter table public.cg_alerts add constraint cg_alerts_severity_values check(severity in ('Low','Medium','High','Critical'));
create table if not exists public.cg_sessions (
  token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists cg_sessions_owner on public.cg_sessions(user_id);
alter table public.cg_sessions enable row level security;
revoke all on public.cg_sessions from anon,authenticated;
grant all on public.cg_sessions to service_role;
create or replace function public.cg_display_name_log() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.display_name is distinct from old.display_name then
   insert into public.cg_account_logs(actor_id,target_id,operation,detail)
   values(auth.uid(),new.id,'Profile data changed',jsonb_build_object('field','display_name','source','database trigger'));
 end if;
 return new;
end $$;
drop trigger if exists cg_display_name_log on public.cg_profiles;
create trigger cg_display_name_log after update on public.cg_profiles
for each row execute function public.cg_display_name_log();
revoke all on function public.cg_display_name_log() from public,anon,authenticated;
commit;
