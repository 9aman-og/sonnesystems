-- ============================================================
-- Lyfe backend schema (Supabase / Postgres).
-- Run ONCE:  Supabase Dashboard > SQL Editor > New query > paste > Run.
-- Safe to re-run: every statement is guarded.
--
-- Model: one row per user, holding that user's whole Lyfe document
-- as JSONB. This mirrors how the app already keeps state (a single
-- object in localStorage), so the client stays a thin sync layer
-- rather than a rewrite. An engineer can later normalise this into
-- per-entity tables if querying inside the data is ever needed.
--
-- Security: row-level security (RLS) means the database itself only
-- ever lets a user read or write THEIR OWN row. The public anon key
-- shipped in the browser cannot reach anyone else's data.
-- ============================================================

create table if not exists public.lyfe_states (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  rev        integer     not null default 0,
  updated_at timestamptz not null default now()
);

-- Turn ON row-level security. Without this line, the public anon key
-- could read every row. With it, the policies below are the only way in.
alter table public.lyfe_states enable row level security;
alter table public.lyfe_states force row level security;

-- SQL-created tables are not exposed to the Data API automatically on every
-- Supabase project. Grant only the operations the signed-in client needs, and
-- explicitly keep the unauthenticated role out. RLS still decides which rows
-- an authenticated user may touch.
grant usage on schema public to authenticated;
grant select, insert, update on table public.lyfe_states to authenticated;
revoke all on table public.lyfe_states from anon;

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

-- Keep updated_at honest on every write.
create or replace function public.lyfe_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end $$;

revoke all on function public.lyfe_touch_updated_at() from public, anon, authenticated;

drop trigger if exists lyfe_touch on public.lyfe_states;
create trigger lyfe_touch before update on public.lyfe_states
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
end $$;
