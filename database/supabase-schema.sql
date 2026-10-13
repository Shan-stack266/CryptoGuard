-- Run in Supabase SQL Editor. No example users, messages, alerts, or events are inserted.
-- Passwords are managed exclusively by Supabase Auth.
begin;
create table if not exists public.cg_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique, role text not null default 'user' check (role in ('user','admin')),
  active boolean not null default true, locked_until timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cg_login_counters (
  email text primary key, failures integer not null default 0 check(failures >= 0),
  locked_until timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.cg_policies (
  id integer primary key check(id = 1), max_failures integer not null default 5 check(max_failures between 1 and 5),
  max_requests integer not null default 120 check(max_requests between 1 and 100000),
  max_payload integer not null default 1024 check(max_payload between 1 and 1000000),
  alert_threshold integer not null default 50 check(alert_threshold between 1 and 100),
  block_threshold integer not null default 75 check(block_threshold between 1 and 100),
  auto_block boolean not null default true, emergency boolean not null default false,
  updated_at timestamptz not null default now(), check(block_threshold >= alert_threshold)
);
-- Configuration, not sample data.
insert into public.cg_policies(id) values(1) on conflict(id) do nothing;
create table if not exists public.cg_events (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  timestamp timestamptz not null default now(), identity text not null, ip inet,
  operation text not null, source text not null default 'Application' check(source = 'Application'),
  failures integer not null default 0, requests integer not null default 0,
  payload double precision not null default 0, device_hash text,
  score integer not null default 0 check(score between 0 and 100), severity text not null default 'Low',
  decision text not null default 'Allowed' check(decision in ('Allowed','Challenged','Blocked','Failed')),
  reasons jsonb not null default '[]', controls jsonb not null default '[]', model jsonb not null default '{}'
);
create table if not exists public.cg_alerts (
  id uuid primary key default gen_random_uuid(), event_id uuid references public.cg_events(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null, timestamp timestamptz not null default now(),
  identity text not null, ip inet, title text not null, score integer not null check(score between 0 and 100),
  severity text not null, status text not null default 'Open' check(status in ('Open','Acknowledged','Resolved')),
  note text not null default '' check(length(note) <= 1000), source text not null default 'Application', updated_at timestamptz not null default now()
);
create table if not exists public.cg_account_logs (
  id uuid primary key default gen_random_uuid(), timestamp timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null, target_id uuid references auth.users(id) on delete set null,
  operation text not null, detail jsonb not null default '{}'
);
create table if not exists public.cg_audit (
  id uuid primary key default gen_random_uuid(), timestamp timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null, operation text not null, detail text not null,
  status text not null default 'Recorded'
);
create table if not exists public.cg_blocked_ips (
  ip inet primary key, reason text not null check(length(reason) between 1 and 200),
  timestamp timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null
);
create table if not exists public.cg_cipher_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  timestamp timestamptz not null default now(), algorithm text not null check(algorithm in ('Playfair','Caesar','Bifid','Vigenère','AES-256-GCM')),
  operation text not null check(operation in ('Encrypt','Decrypt')), digest text not null check(digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'Processed'
);
create index if not exists cg_events_user_time on public.cg_events(user_id,timestamp desc);
create index if not exists cg_events_time on public.cg_events(timestamp desc);
create index if not exists cg_alerts_status_time on public.cg_alerts(status,timestamp desc);
create index if not exists cg_cipher_user_time on public.cg_cipher_history(user_id,timestamp desc);

create or replace function public.cg_handle_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.cg_profiles(id,email) values(new.id,lower(new.email));
    insert into public.cg_account_logs(target_id,operation) values(new.id,'Account created');
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
drop trigger if exists cg_auth_user on auth.users;
create trigger cg_auth_user after insert or update on auth.users for each row execute function public.cg_handle_auth_user();
-- Backfill actual existing Auth users without creating demo accounts.
insert into public.cg_profiles(id,email) select id,lower(email) from auth.users where email is not null on conflict(id) do nothing;

create or replace function public.cg_profile_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at=now();
  if new.role is distinct from old.role or new.active is distinct from old.active or new.locked_until is distinct from old.locked_until then
    insert into public.cg_account_logs(actor_id,target_id,operation,detail)
    values(auth.uid(),new.id,'Account access updated',jsonb_build_object('old_role',old.role,'role',new.role,'active',new.active,'locked_until',new.locked_until));
  end if;
  return new;
end $$;
drop trigger if exists cg_profile_changes on public.cg_profiles;
create trigger cg_profile_changes before update on public.cg_profiles for each row execute function public.cg_profile_changes();

-- Atomic attempt counting: concurrent failed attempts cannot overwrite each other.
create or replace function public.cg_login_failure(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare attempts integer; lock_time timestamptz; attempt_limit integer;
begin
  select max_failures into attempt_limit from public.cg_policies where id=1;
  insert into public.cg_login_counters(email,failures) values(lower(p_email),1)
  on conflict(email) do update set
    failures=case when cg_login_counters.updated_at < now()-interval '15 minutes' then 1 else cg_login_counters.failures+1 end,
    updated_at=now()
  returning failures into attempts;
  if attempts >= least(coalesce(attempt_limit,5),5) then
    lock_time=now()+interval '15 minutes';
    update public.cg_login_counters set locked_until=lock_time where email=lower(p_email);
    update public.cg_profiles set locked_until=lock_time where email=lower(p_email);
  end if;
  return jsonb_build_object('failures',attempts,'locked_until',lock_time);
end $$;
revoke all on function public.cg_login_failure(text) from public, anon, authenticated;
grant execute on function public.cg_login_failure(text) to service_role;

-- All browser reads/writes go through the verified server API. Direct REST access
-- to these tables is denied even with a valid user JWT. This prevents bypassing
-- account locks or self-promoting roles via Supabase's public endpoint.
do $$ declare t text; begin
  foreach t in array array['cg_profiles','cg_login_counters','cg_policies','cg_events','cg_alerts','cg_account_logs','cg_audit','cg_blocked_ips','cg_cipher_history'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
    execute format('grant all on table public.%I to service_role',t);
  end loop;
end $$;
revoke all on function public.cg_handle_auth_user() from public, anon, authenticated;
revoke all on function public.cg_profile_changes() from public, anon, authenticated;
commit;

-- FIRST ADMIN: after registering and confirming your own real account, run
-- this separately, substituting your own Auth user UUID (never a sample user):
-- update public.cg_profiles set role='admin' where id='YOUR-AUTH-USER-UUID'::uuid;
