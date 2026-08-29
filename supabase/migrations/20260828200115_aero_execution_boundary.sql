-- Aero signed-in execution boundary.
--
-- Lyfe record changes prepared by Aero are materialized by the Edge Function,
-- but only this database transaction may commit them. The browser never gets
-- table-mutation authority for the private run journal. Ordinary Lyfe sync is
-- also changed to compare-and-swap semantics so a stale tab cannot overwrite a
-- completed Aero run.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists aero_private;
revoke all on schema aero_private from public, anon, authenticated;
grant usage on schema aero_private to service_role;

create table if not exists aero_private.aero_runs (
  id                    uuid primary key,
  user_id               uuid not null references auth.users (id) on delete cascade,
  request_key           text not null,
  protocol_version      text not null default 'aero-supabase-v0.1',
  status                text not null default 'prepared',
  contract              jsonb not null,
  contract_digest       text not null,
  base_rev              bigint not null check (base_rev >= 0),
  before_digest         text not null,
  target_data           jsonb not null,
  target_digest         text not null,
  patches               jsonb not null default '[]'::jsonb,
  review                jsonb not null default '[]'::jsonb,
  payload_storage_digest text not null,
  approval_token_hash   text,
  approval_expires_at   timestamptz,
  completion_certificate jsonb,
  event_sequence        integer not null default 0 check (event_sequence >= 0),
  event_head_digest     text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  completed_at          timestamptz,
  constraint aero_runs_request_key_length check (char_length(request_key) between 8 and 160),
  constraint aero_runs_status check (status in ('prepared', 'completed', 'expired', 'stale', 'cancelled')),
  constraint aero_runs_contract_object check (jsonb_typeof(contract) = 'object'),
  constraint aero_runs_target_object check (jsonb_typeof(target_data) = 'object'),
  constraint aero_runs_patches_array check (jsonb_typeof(patches) = 'array'),
  constraint aero_runs_review_array check (jsonb_typeof(review) = 'array'),
  constraint aero_runs_contract_digest check (contract_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_runs_before_digest check (before_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_runs_target_digest check (target_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_runs_payload_storage_digest check (payload_storage_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_runs_approval_hash check (approval_token_hash is null or approval_token_hash ~ '^[0-9a-f]{64}$'),
  unique (user_id, request_key)
);

create index if not exists aero_runs_user_created_idx
  on aero_private.aero_runs (user_id, created_at desc);

create table if not exists aero_private.aero_run_events (
  id              bigint generated always as identity primary key,
  run_id          uuid not null references aero_private.aero_runs (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  sequence        integer not null check (sequence > 0),
  event_type      text not null,
  payload         jsonb not null default '{}'::jsonb,
  previous_digest text not null default '',
  event_digest    text not null,
  created_at      timestamptz not null default now(),
  constraint aero_run_events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint aero_run_events_digest check (event_digest ~ '^[0-9a-f]{64}$'),
  unique (run_id, sequence)
);

create index if not exists aero_run_events_user_run_idx
  on aero_private.aero_run_events (user_id, run_id, sequence);

alter table aero_private.aero_runs enable row level security;
alter table aero_private.aero_run_events enable row level security;
alter table aero_private.aero_runs force row level security;
alter table aero_private.aero_run_events force row level security;

revoke all on table aero_private.aero_runs from public, anon, authenticated;
revoke all on table aero_private.aero_run_events from public, anon, authenticated;
revoke all on all sequences in schema aero_private from public, anon, authenticated;
grant all on table aero_private.aero_runs to service_role;
grant all on table aero_private.aero_run_events to service_role;
grant usage, select on all sequences in schema aero_private to service_role;

drop policy if exists "aero service runs" on aero_private.aero_runs;
create policy "aero service runs"
  on aero_private.aero_runs for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "aero service events" on aero_private.aero_run_events;
create policy "aero service events"
  on aero_private.aero_run_events for all
  to service_role
  using (true)
  with check (true);

create or replace function aero_private.aero_payload_storage_digest(
  p_contract jsonb,
  p_contract_digest text,
  p_base_rev bigint,
  p_before_digest text,
  p_target_data jsonb,
  p_target_digest text,
  p_patches jsonb,
  p_review jsonb
)
returns text
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      p_contract::text || E'\n' || p_contract_digest || E'\n' || p_base_rev::text || E'\n' ||
      p_before_digest || E'\n' || p_target_data::text || E'\n' || p_target_digest || E'\n' ||
      p_patches::text || E'\n' || p_review::text,
      'sha256'
    ),
    'hex'
  )
$$;

revoke all on function aero_private.aero_payload_storage_digest(jsonb, text, bigint, text, jsonb, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function aero_private.aero_payload_storage_digest(jsonb, text, bigint, text, jsonb, text, jsonb, jsonb) to service_role;

create or replace function aero_private.aero_minimal_review(p_review jsonb)
returns jsonb
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(item.value - 'subject' order by item.ordinality),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(p_review, '[]'::jsonb)) with ordinality as item(value, ordinality)
$$;

revoke all on function aero_private.aero_minimal_review(jsonb) from public, anon, authenticated;
grant execute on function aero_private.aero_minimal_review(jsonb) to service_role;

create or replace function public.lyfe_enforce_state_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rev < 1 then
    raise exception using errcode = '22023', message = 'lyfe revision must start at one';
  end if;
  if tg_op = 'UPDATE' and new.rev <> old.rev + 1 then
    raise exception using errcode = '40001', message = 'stale lyfe revision';
  end if;
  -- Device-only provider credentials never belong in the cloud document.
  new.data := jsonb_set(
    coalesce(new.data, '{}'::jsonb) #- '{settings,apiKey}',
    '{rev}',
    to_jsonb(new.rev),
    true
  );
  return new;
end
$$;

drop trigger if exists lyfe_revision_guard on public.lyfe_states;
create trigger lyfe_revision_guard
  before insert or update on public.lyfe_states
  for each row execute function public.lyfe_enforce_state_revision();

create or replace function public.lyfe_compare_and_swap_state(
  p_expected_rev bigint,
  p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.lyfe_states%rowtype;
  v_next_rev bigint;
  v_data jsonb;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_expected_rev < 0 or jsonb_typeof(p_data) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid lyfe state request';
  end if;

  select * into v_row
  from public.lyfe_states
  where user_id = v_user
  for update;

  if not found then
    if p_expected_rev <> 0 then
      return jsonb_build_object('applied', false, 'error', 'revision_conflict', 'rev', 0);
    end if;
    v_next_rev := 1;
    v_data := jsonb_set(p_data #- '{settings,apiKey}', '{rev}', to_jsonb(v_next_rev), true);
    insert into public.lyfe_states (user_id, data, rev)
    values (v_user, v_data, v_next_rev)
    returning * into v_row;
    return jsonb_build_object('applied', true, 'rev', v_row.rev, 'data', v_row.data);
  end if;

  if v_row.rev <> p_expected_rev then
    -- A retried flush is idempotent when the exact requested document already
    -- occupies the next revision. This is common after an uncertain network
    -- response and must not be mistaken for a competing write.
    v_next_rev := p_expected_rev + 1;
    v_data := jsonb_set(p_data #- '{settings,apiKey}', '{rev}', to_jsonb(v_next_rev), true);
    if v_row.rev = v_next_rev and v_row.data = v_data then
      return jsonb_build_object(
        'applied', true,
        'idempotent', true,
        'rev', v_row.rev,
        'data', v_row.data
      );
    end if;
    return jsonb_build_object(
      'applied', false,
      'error', 'revision_conflict',
      'rev', v_row.rev,
      'data', v_row.data
    );
  end if;

  v_next_rev := v_row.rev + 1;
  v_data := jsonb_set(p_data #- '{settings,apiKey}', '{rev}', to_jsonb(v_next_rev), true);
  update public.lyfe_states
  set data = v_data, rev = v_next_rev
  where user_id = v_user
  returning * into v_row;
  return jsonb_build_object('applied', true, 'rev', v_row.rev, 'data', v_row.data);
end
$$;

revoke all on function public.lyfe_compare_and_swap_state(bigint, jsonb) from public, anon;
grant execute on function public.lyfe_compare_and_swap_state(bigint, jsonb) to authenticated;

create or replace function aero_private.aero_append_event(
  p_run_id uuid,
  p_user_id uuid,
  p_event_type text,
  p_payload jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sequence integer;
  v_previous text;
  v_digest text;
begin
  select event_sequence + 1, event_head_digest
    into v_sequence, v_previous
  from aero_private.aero_runs
  where id = p_run_id and user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'aero run not found';
  end if;

  v_digest := pg_catalog.encode(
    extensions.digest(
      coalesce(v_previous, '') || E'\n' || p_run_id::text || E'\n' ||
      v_sequence::text || E'\n' || p_event_type || E'\n' || coalesce(p_payload, '{}'::jsonb)::text,
      'sha256'
    ),
    'hex'
  );

  insert into aero_private.aero_run_events (
    run_id, user_id, sequence, event_type, payload, previous_digest, event_digest
  ) values (
    p_run_id, p_user_id, v_sequence, left(p_event_type, 80),
    coalesce(p_payload, '{}'::jsonb), coalesce(v_previous, ''), v_digest
  );
  update aero_private.aero_runs
  set event_sequence = v_sequence, event_head_digest = v_digest, updated_at = now()
  where id = p_run_id and user_id = p_user_id;
  return v_digest;
end
$$;

revoke all on function aero_private.aero_append_event(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function aero_private.aero_append_event(uuid, uuid, text, jsonb) to service_role;

create or replace function aero_private.aero_event_chain_valid(
  p_run_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event record;
  v_expected integer := 1;
  v_previous text := '';
  v_digest text;
  v_sequence integer;
  v_head text;
begin
  for v_event in
    select sequence, event_type, payload, previous_digest, event_digest
    from aero_private.aero_run_events
    where run_id = p_run_id and user_id = p_user_id
    order by sequence
  loop
    v_digest := pg_catalog.encode(
      extensions.digest(
        coalesce(v_previous, '') || E'\n' || p_run_id::text || E'\n' ||
        v_event.sequence::text || E'\n' || v_event.event_type || E'\n' || v_event.payload::text,
        'sha256'
      ),
      'hex'
    );
    if v_event.sequence <> v_expected
       or v_event.previous_digest <> v_previous
       or v_event.event_digest <> v_digest
    then
      return false;
    end if;
    v_previous := v_event.event_digest;
    v_expected := v_expected + 1;
  end loop;

  select event_sequence, event_head_digest into v_sequence, v_head
  from aero_private.aero_runs
  where id = p_run_id and user_id = p_user_id;
  if not found then return false; end if;
  return v_sequence = v_expected - 1 and v_head = v_previous;
end
$$;

revoke all on function aero_private.aero_event_chain_valid(uuid, uuid) from public, anon, authenticated;
grant execute on function aero_private.aero_event_chain_valid(uuid, uuid) to service_role;

create or replace function public.aero_prepare_run(
  p_run_id uuid,
  p_user_id uuid,
  p_request_key text,
  p_contract jsonb,
  p_contract_digest text,
  p_base_rev bigint,
  p_before_digest text,
  p_target_data jsonb,
  p_target_digest text,
  p_patches jsonb,
  p_review jsonb,
  p_approval_token_hash text,
  p_approval_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run aero_private.aero_runs%rowtype;
  v_idempotent boolean := false;
  v_payload_digest text;
begin
  if p_user_id is null or p_run_id is null then
    raise exception using errcode = '22023', message = 'run identity required';
  end if;
  if char_length(p_request_key) not between 8 and 160
     or p_contract_digest !~ '^[0-9a-f]{64}$'
     or p_before_digest !~ '^[0-9a-f]{64}$'
     or p_target_digest !~ '^[0-9a-f]{64}$'
     or p_approval_token_hash !~ '^[0-9a-f]{64}$'
     or p_base_rev < 0
     or jsonb_typeof(p_contract) <> 'object'
     or jsonb_typeof(p_target_data) <> 'object'
     or jsonb_typeof(p_patches) <> 'array'
     or jsonb_typeof(p_review) <> 'array'
     or p_approval_expires_at <= now()
  then
    raise exception using errcode = '22023', message = 'invalid aero run request';
  end if;

  v_payload_digest := aero_private.aero_payload_storage_digest(
    p_contract, p_contract_digest, p_base_rev, p_before_digest,
    p_target_data, p_target_digest, p_patches, p_review
  );

  select * into v_run
  from aero_private.aero_runs
  where user_id = p_user_id and request_key = p_request_key
  for update;

  if found then
    if v_run.payload_storage_digest <> aero_private.aero_payload_storage_digest(
      v_run.contract, v_run.contract_digest, v_run.base_rev, v_run.before_digest,
      v_run.target_data, v_run.target_digest, v_run.patches, v_run.review
    ) or not aero_private.aero_event_chain_valid(v_run.id, p_user_id)
    then
      return jsonb_build_object('ok', false, 'error', 'run_integrity_failed');
    end if;
    if v_run.contract_digest <> p_contract_digest then
      return jsonb_build_object('ok', false, 'error', 'idempotency_conflict');
    end if;
    v_idempotent := true;
    if v_run.status in ('prepared', 'expired') then
      update aero_private.aero_runs
      set status = 'prepared',
          approval_token_hash = p_approval_token_hash,
          approval_expires_at = p_approval_expires_at,
          updated_at = now()
      where id = v_run.id
      returning * into v_run;
      perform aero_private.aero_append_event(
        v_run.id, p_user_id, 'approval_refreshed',
        jsonb_build_object('contractDigest', v_run.contract_digest, 'expiresAt', p_approval_expires_at)
      );
    end if;
  else
    insert into aero_private.aero_runs (
      id, user_id, request_key, contract, contract_digest, base_rev,
      before_digest, target_data, target_digest, patches, review,
      payload_storage_digest, approval_token_hash, approval_expires_at
    ) values (
      p_run_id, p_user_id, p_request_key, p_contract, p_contract_digest, p_base_rev,
      p_before_digest, p_target_data, p_target_digest, p_patches, p_review,
      v_payload_digest, p_approval_token_hash, p_approval_expires_at
    ) returning * into v_run;
    perform aero_private.aero_append_event(
      v_run.id, p_user_id, 'prepared',
      jsonb_build_object(
        'contractDigest', v_run.contract_digest,
        'beforeDigest', v_run.before_digest,
        'targetDigest', v_run.target_digest,
        'baseRev', v_run.base_rev,
        'steps', jsonb_array_length(v_run.review)
      )
    );
  end if;

  select * into v_run from aero_private.aero_runs where id = v_run.id;
  return jsonb_build_object(
    'ok', true,
    'idempotent', v_idempotent,
    'runId', v_run.id,
    'status', v_run.status,
    'contractDigest', v_run.contract_digest,
    'baseRev', v_run.base_rev,
    'targetDigest', v_run.target_digest,
    'review', v_run.review,
    'eventHeadDigest', v_run.event_head_digest,
    'eventSequence', v_run.event_sequence
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'prepare_race_retry');
end
$$;

create or replace function public.aero_commit_run(
  p_user_id uuid,
  p_run_id uuid,
  p_contract_digest text,
  p_approval_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run aero_private.aero_runs%rowtype;
  v_state public.lyfe_states%rowtype;
  v_head text;
  v_payload jsonb;
  v_certificate jsonb;
  v_certificate_digest text;
  v_redacted_contract jsonb;
  v_redacted_review jsonb;
  v_redacted_storage_digest text;
begin
  select * into v_run
  from aero_private.aero_runs
  where id = p_run_id and user_id = p_user_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'run_not_found');
  end if;
  if v_run.payload_storage_digest <> aero_private.aero_payload_storage_digest(
    v_run.contract, v_run.contract_digest, v_run.base_rev, v_run.before_digest,
    v_run.target_data, v_run.target_digest, v_run.patches, v_run.review
  ) then
    return jsonb_build_object('ok', false, 'error', 'run_integrity_failed');
  end if;
  if not aero_private.aero_event_chain_valid(v_run.id, p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'journal_integrity_failed');
  end if;
  if v_run.contract_digest <> p_contract_digest then
    return jsonb_build_object('ok', false, 'error', 'contract_changed');
  end if;
  if v_run.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'approval_replayed');
  end if;
  if v_run.status <> 'prepared' then
    return jsonb_build_object('ok', false, 'error', 'run_not_prepared', 'status', v_run.status);
  end if;
  if v_run.approval_expires_at is null or v_run.approval_expires_at <= now() then
    update aero_private.aero_runs
    set status = 'expired', approval_token_hash = null, approval_expires_at = null, updated_at = now()
    where id = v_run.id;
    perform aero_private.aero_append_event(v_run.id, p_user_id, 'expired', jsonb_build_object('phase', 'approval'));
    return jsonb_build_object('ok', false, 'error', 'approval_expired');
  end if;
  if v_run.approval_token_hash is null
     or v_run.approval_token_hash <> p_approval_token_hash
  then
    return jsonb_build_object('ok', false, 'error', 'approval_invalid');
  end if;

  select * into v_state
  from public.lyfe_states
  where user_id = p_user_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'state_missing');
  end if;
  if v_state.rev <> v_run.base_rev then
    update aero_private.aero_runs
    set status = 'stale', approval_token_hash = null, approval_expires_at = null, updated_at = now()
    where id = v_run.id;
    perform aero_private.aero_append_event(
      v_run.id, p_user_id, 'stale',
      jsonb_build_object('expectedRev', v_run.base_rev, 'currentRev', v_state.rev)
    );
    v_redacted_contract := jsonb_build_object(
      'protocol', v_run.protocol_version,
      'redacted', true,
      'actionCount', jsonb_array_length(v_run.review)
    );
    v_redacted_review := aero_private.aero_minimal_review(v_run.review);
    v_redacted_storage_digest := aero_private.aero_payload_storage_digest(
      v_redacted_contract, v_run.contract_digest, v_run.base_rev, v_run.before_digest,
      '{}'::jsonb, v_run.target_digest, '[]'::jsonb, v_redacted_review
    );
    update aero_private.aero_runs
    set contract = v_redacted_contract,
        target_data = '{}'::jsonb,
        patches = '[]'::jsonb,
        review = v_redacted_review,
        payload_storage_digest = v_redacted_storage_digest,
        updated_at = now()
    where id = v_run.id;
    return jsonb_build_object('ok', false, 'error', 'state_changed', 'currentRev', v_state.rev);
  end if;

  update public.lyfe_states
  set data = v_run.target_data, rev = v_run.base_rev + 1
  where user_id = p_user_id
  returning * into v_state;

  update aero_private.aero_runs
  set status = 'completed', approval_token_hash = null, approval_expires_at = null,
      completed_at = now(), updated_at = now()
  where id = v_run.id;

  v_head := aero_private.aero_append_event(
    v_run.id, p_user_id, 'completed',
    jsonb_build_object(
      'contractDigest', v_run.contract_digest,
      'targetDigest', v_run.target_digest,
      'newRev', v_state.rev,
      'atomic', true
    )
  );
  v_payload := jsonb_build_object(
    'protocol', v_run.protocol_version,
    'runId', v_run.id,
    'status', 'completed',
    'contractDigest', v_run.contract_digest,
    'beforeDigest', v_run.before_digest,
    'targetDigest', v_run.target_digest,
    'eventHeadDigest', v_head,
    'baseRev', v_run.base_rev,
    'newRev', v_state.rev,
    'atomic', true
  );
  v_certificate_digest := pg_catalog.encode(extensions.digest(v_payload::text, 'sha256'), 'hex');
  v_certificate := jsonb_build_object('payload', v_payload, 'digest', v_certificate_digest);
  v_redacted_contract := jsonb_build_object(
    'protocol', v_run.protocol_version,
    'redacted', true,
    'actionCount', jsonb_array_length(v_run.review)
  );
  v_redacted_review := aero_private.aero_minimal_review(v_run.review);
  v_redacted_storage_digest := aero_private.aero_payload_storage_digest(
    v_redacted_contract, v_run.contract_digest, v_run.base_rev, v_run.before_digest,
    '{}'::jsonb, v_run.target_digest, '[]'::jsonb, v_redacted_review
  );
  update aero_private.aero_runs
  set completion_certificate = v_certificate,
      contract = v_redacted_contract,
      target_data = '{}'::jsonb,
      patches = '[]'::jsonb,
      review = v_redacted_review,
      payload_storage_digest = v_redacted_storage_digest,
      updated_at = now()
  where id = v_run.id;

  return jsonb_build_object(
    'ok', true,
    'status', 'completed',
    'runId', v_run.id,
    'certificate', v_certificate,
    'state', v_state.data,
    'rev', v_state.rev
  );
end
$$;

create or replace function public.aero_cancel_run(
  p_user_id uuid,
  p_run_id uuid,
  p_contract_digest text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run aero_private.aero_runs%rowtype;
  v_redacted_contract jsonb;
  v_redacted_review jsonb;
  v_redacted_storage_digest text;
begin
  select * into v_run
  from aero_private.aero_runs
  where id = p_run_id and user_id = p_user_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'run_not_found'); end if;
  if v_run.payload_storage_digest <> aero_private.aero_payload_storage_digest(
    v_run.contract, v_run.contract_digest, v_run.base_rev, v_run.before_digest,
    v_run.target_data, v_run.target_digest, v_run.patches, v_run.review
  ) or not aero_private.aero_event_chain_valid(v_run.id, p_user_id)
  then
    return jsonb_build_object('ok', false, 'error', 'run_integrity_failed');
  end if;
  if v_run.contract_digest <> p_contract_digest then
    return jsonb_build_object('ok', false, 'error', 'contract_changed');
  end if;
  if v_run.status <> 'prepared' then
    return jsonb_build_object('ok', false, 'error', 'run_not_prepared', 'status', v_run.status);
  end if;
  update aero_private.aero_runs
  set status = 'cancelled', approval_token_hash = null, approval_expires_at = null, updated_at = now()
  where id = v_run.id;
  perform aero_private.aero_append_event(v_run.id, p_user_id, 'cancelled', '{}'::jsonb);
  v_redacted_contract := jsonb_build_object(
    'protocol', v_run.protocol_version,
    'redacted', true,
    'actionCount', jsonb_array_length(v_run.review)
  );
  v_redacted_review := aero_private.aero_minimal_review(v_run.review);
  v_redacted_storage_digest := aero_private.aero_payload_storage_digest(
    v_redacted_contract, v_run.contract_digest, v_run.base_rev, v_run.before_digest,
    '{}'::jsonb, v_run.target_digest, '[]'::jsonb, v_redacted_review
  );
  update aero_private.aero_runs
  set contract = v_redacted_contract,
      target_data = '{}'::jsonb,
      patches = '[]'::jsonb,
      review = v_redacted_review,
      payload_storage_digest = v_redacted_storage_digest,
      updated_at = now()
  where id = v_run.id;
  return jsonb_build_object('ok', true, 'status', 'cancelled', 'runId', v_run.id);
end
$$;

create or replace function public.aero_inspect_run(
  p_user_id uuid,
  p_run_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run aero_private.aero_runs%rowtype;
  v_events jsonb;
begin
  select * into v_run
  from aero_private.aero_runs
  where id = p_run_id and user_id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'run_not_found'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence', sequence,
    'type', event_type,
    'payload', payload,
    'previousDigest', previous_digest,
    'digest', event_digest,
    'createdAt', created_at
  ) order by sequence), '[]'::jsonb)
  into v_events
  from aero_private.aero_run_events
  where run_id = p_run_id and user_id = p_user_id;
  return jsonb_build_object(
    'ok', true,
    'runId', v_run.id,
    'requestKey', v_run.request_key,
    'status', v_run.status,
    'contractDigest', v_run.contract_digest,
    'baseRev', v_run.base_rev,
    'targetDigest', v_run.target_digest,
    'review', v_run.review,
    'certificate', v_run.completion_certificate,
    'eventHeadDigest', v_run.event_head_digest,
    'eventSequence', v_run.event_sequence,
    'journalValid', aero_private.aero_event_chain_valid(v_run.id, p_user_id),
    'payloadValid', v_run.payload_storage_digest = aero_private.aero_payload_storage_digest(
      v_run.contract, v_run.contract_digest, v_run.base_rev, v_run.before_digest,
      v_run.target_data, v_run.target_digest, v_run.patches, v_run.review
    ),
    'events', v_events,
    'createdAt', v_run.created_at,
    'updatedAt', v_run.updated_at
  );
end
$$;

create or replace function public.aero_forget_run(
  p_user_id uuid,
  p_run_id uuid,
  p_contract_digest text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run aero_private.aero_runs%rowtype;
begin
  select * into v_run
  from aero_private.aero_runs
  where id = p_run_id and user_id = p_user_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'run_not_found'); end if;
  if v_run.contract_digest <> p_contract_digest then
    return jsonb_build_object('ok', false, 'error', 'contract_changed');
  end if;
  delete from aero_private.aero_runs where id = p_run_id and user_id = p_user_id;
  return jsonb_build_object('ok', true, 'forgotten', true, 'runId', p_run_id);
end
$$;

revoke all on function public.aero_prepare_run(uuid, uuid, text, jsonb, text, bigint, text, jsonb, text, jsonb, jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function public.aero_commit_run(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.aero_cancel_run(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.aero_inspect_run(uuid, uuid) from public, anon, authenticated;
revoke all on function public.aero_forget_run(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.aero_prepare_run(uuid, uuid, text, jsonb, text, bigint, text, jsonb, text, jsonb, jsonb, text, timestamptz) to service_role;
grant execute on function public.aero_commit_run(uuid, uuid, text, text) to service_role;
grant execute on function public.aero_cancel_run(uuid, uuid, text) to service_role;
grant execute on function public.aero_inspect_run(uuid, uuid) to service_role;
grant execute on function public.aero_forget_run(uuid, uuid, text) to service_role;

comment on function public.lyfe_compare_and_swap_state(bigint, jsonb) is
  'Atomically advances one signed-in user Lyfe document by exactly one revision.';
comment on table aero_private.aero_runs is
  'Private server-owned Aero contracts and exact target states; not exposed through the Data API.';
comment on table aero_private.aero_run_events is
  'Hash-chained evidence for private Aero execution runs.';
