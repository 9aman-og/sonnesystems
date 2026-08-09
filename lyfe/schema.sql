-- ============================================================
-- Lyfe backend schema (Supabase / Postgres).
-- Run ONCE:  Supabase Dashboard > SQL Editor > New query > paste > Run.
-- Safe to re-run: every statement is guarded.
--
-- Model: separate one-row-per-user JSON documents for Lyfe and Connect.
-- Keeping these documents separate is intentional: Connect cannot read
-- private Lyfe tasks, notes, Gmail state, or EOS conversations. The live
-- project also has normalized Connect tables for profiles, posts, comments,
-- relationships, workspaces, channels, messages, opportunities, applications,
-- and notifications; those are introduced by managed migrations.
--
-- Security: row-level security (RLS) means the database itself only
-- ever lets a user read or write THEIR OWN row. The public anon key
-- shipped in the browser cannot reach anyone else's data.
-- ============================================================

create table if not exists public.lyfe_states (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  rev        bigint      not null default 0 check (rev >= 0),
  updated_at timestamptz not null default now()
);

-- Turn ON row-level security. Without this line, the public anon key
-- could read every row. With it, the policies below are the only way in.
alter table public.lyfe_states enable row level security;

create table if not exists public.lyfe_connect_states (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  rev        bigint      not null default 0 check (rev >= 0),
  updated_at timestamptz not null default now()
);

alter table public.lyfe_connect_states enable row level security;

-- SQL-created tables are not exposed to the Data API automatically on every
-- Supabase project. Grant only the operations the signed-in client needs, and
-- explicitly keep the unauthenticated role out. RLS still decides which rows
-- an authenticated user may touch.
grant usage on schema public to authenticated;
grant select, insert, update on table public.lyfe_states to authenticated;
grant select, insert, update on table public.lyfe_connect_states to authenticated;
revoke all on table public.lyfe_states from anon;
revoke all on table public.lyfe_connect_states from anon;

-- Each signed-in user may touch only the row whose user_id equals their
-- own auth id. Unauthenticated requests have no auth.uid(), so every
-- policy fails for them: no anonymous access at all.
drop policy if exists "lyfe read own"   on public.lyfe_states;
drop policy if exists "lyfe insert own" on public.lyfe_states;
drop policy if exists "lyfe update own" on public.lyfe_states;

create policy "lyfe read own"
  on public.lyfe_states for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "lyfe insert own"
  on public.lyfe_states for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "lyfe update own"
  on public.lyfe_states for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "connect state read own"   on public.lyfe_connect_states;
drop policy if exists "connect state insert own" on public.lyfe_connect_states;
drop policy if exists "connect state update own" on public.lyfe_connect_states;

create policy "connect state read own"
  on public.lyfe_connect_states for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "connect state insert own"
  on public.lyfe_connect_states for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "connect state update own"
  on public.lyfe_connect_states for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Keep updated_at honest on every write.
create or replace function public.lyfe_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists lyfe_touch on public.lyfe_states;
create trigger lyfe_touch before update on public.lyfe_states
  for each row execute function public.lyfe_touch_updated_at();

drop trigger if exists lyfe_connect_touch on public.lyfe_connect_states;
create trigger lyfe_connect_touch before update on public.lyfe_connect_states
  for each row execute function public.lyfe_touch_updated_at();

-- Optional: live cross-device updates. Safe to skip; the app also syncs
-- on load and when a tab regains focus. Guarded so re-running is fine.
do $$
begin
  begin
    alter publication supabase_realtime add table public.lyfe_states;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.lyfe_connect_states;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
