-- Aero server-owned typed memory v0.3.
--
-- The browser keeps a read-through cache for offline UX, but this private
-- ledger is the authority for signed-in memory. Explicit memories and privacy
-- deletions use exact-plan, one-use approval. Behavioral observations have
-- lower authority and can only become candidate/provisional procedures.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists aero_private;
revoke all on schema aero_private from public, anon, authenticated;
grant usage on schema aero_private to service_role;

create table if not exists aero_private.aero_memory_accounts (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  protocol_version   text not null default 'aero-memory-v0.3',
  revision           bigint not null default 0 check (revision >= 0),
  state              jsonb not null,
  state_digest       text not null,
  state_storage_digest text not null,
  event_sequence     integer not null default 0 check (event_sequence >= 0),
  event_head_digest  text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint aero_memory_accounts_state_object check (jsonb_typeof(state) = 'object'),
  constraint aero_memory_accounts_digest check (state_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_memory_accounts_storage_digest check (state_storage_digest ~ '^[0-9a-f]{64}$')
);

create table if not exists aero_private.aero_memories (
  user_id          uuid not null references auth.users (id) on delete cascade,
  id               text not null,
  memory_type      text not null,
  scope            text not null,
  memory_key       text not null,
  claim            text not null,
  source_mode      text not null,
  authority        text not null,
  status           text not null,
  confidence       numeric(5,4) not null,
  evidence         jsonb not null default '[]'::jsonb,
  source_refs      jsonb not null default '[]'::jsonb,
  pattern_key      text not null default '',
  depends_on       jsonb not null default '[]'::jsonb,
  supersedes       jsonb not null default '[]'::jsonb,
  superseded_by    text not null default '',
  invalidated_by   jsonb not null default '[]'::jsonb,
  revision         bigint not null default 0,
  commit_id        text not null default '',
  success_count    integer not null default 0,
  failure_count    integer not null default 0,
  distinct_days    jsonb not null default '[]'::jsonb,
  contradictions   jsonb not null default '[]'::jsonb,
  episode_outcomes jsonb not null default '[]'::jsonb,
  was_promoted     boolean not null default false,
  valid_from       timestamptz not null,
  valid_until      timestamptz,
  last_used        timestamptz,
  last_confirmed   timestamptz,
  created_at       timestamptz not null,
  updated_at       timestamptz not null,
  primary key (user_id, id),
  constraint aero_memories_id_length check (char_length(id) between 1 and 120),
  constraint aero_memories_type check (memory_type in ('episodic', 'semantic', 'project', 'procedural')),
  constraint aero_memories_scope_length check (char_length(scope) between 1 and 100),
  constraint aero_memories_key_length check (char_length(memory_key) between 1 and 240),
  constraint aero_memories_claim_length check (char_length(claim) between 1 and 800),
  constraint aero_memories_source_mode check (source_mode in ('explicit', 'inferred')),
  constraint aero_memories_authority check (authority in ('user', 'behavior')),
  constraint aero_memories_status check (status in ('candidate', 'provisional', 'active', 'disputed', 'superseded', 'invalidated')),
  constraint aero_memories_confidence check (confidence between 0 and 1),
  constraint aero_memories_revision check (revision >= 0),
  constraint aero_memories_counts check (success_count >= 0 and failure_count >= 0),
  constraint aero_memories_evidence_array check (jsonb_typeof(evidence) = 'array'),
  constraint aero_memories_sources_array check (jsonb_typeof(source_refs) = 'array'),
  constraint aero_memories_depends_array check (jsonb_typeof(depends_on) = 'array'),
  constraint aero_memories_supersedes_array check (jsonb_typeof(supersedes) = 'array'),
  constraint aero_memories_invalidated_array check (jsonb_typeof(invalidated_by) = 'array'),
  constraint aero_memories_days_array check (jsonb_typeof(distinct_days) = 'array'),
  constraint aero_memories_contradictions_array check (jsonb_typeof(contradictions) = 'array'),
  constraint aero_memories_outcomes_array check (jsonb_typeof(episode_outcomes) = 'array')
);

create unique index if not exists aero_memories_one_usable_key_idx
  on aero_private.aero_memories (user_id, memory_key)
  where status in ('active', 'provisional');

create index if not exists aero_memories_user_status_updated_idx
  on aero_private.aero_memories (user_id, status, updated_at desc);

create table if not exists aero_private.aero_memory_edges (
  user_id        uuid not null references auth.users (id) on delete cascade,
  from_memory_id text not null,
  to_memory_id   text not null,
  edge_kind      text not null,
  created_at     timestamptz not null default now(),
  primary key (user_id, from_memory_id, to_memory_id, edge_kind),
  constraint aero_memory_edges_kind check (edge_kind in ('depends_on')),
  constraint aero_memory_edges_not_self check (from_memory_id <> to_memory_id),
  foreign key (user_id, from_memory_id)
    references aero_private.aero_memories (user_id, id) on delete cascade,
  foreign key (user_id, to_memory_id)
    references aero_private.aero_memories (user_id, id) on delete cascade
);

create index if not exists aero_memory_edges_target_idx
  on aero_private.aero_memory_edges (user_id, to_memory_id, from_memory_id);

create table if not exists aero_private.aero_memory_transactions (
  id                    uuid primary key,
  user_id               uuid not null references auth.users (id) on delete cascade,
  request_key           text not null,
  protocol_version      text not null default 'aero-memory-v0.3',
  status                text not null default 'prepared',
  operation             jsonb not null,
  operation_digest      text not null,
  contract              jsonb not null,
  contract_digest       text not null,
  base_revision         bigint not null check (base_revision >= 0),
  before_digest         text not null,
  target_state          jsonb not null,
  target_digest         text not null,
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
  constraint aero_memory_transactions_request_length check (char_length(request_key) between 8 and 160),
  constraint aero_memory_transactions_status check (status in ('prepared', 'completed', 'expired', 'stale', 'cancelled')),
  constraint aero_memory_transactions_operation_array check (jsonb_typeof(operation) = 'array'),
  constraint aero_memory_transactions_contract_object check (jsonb_typeof(contract) = 'object'),
  constraint aero_memory_transactions_target_object check (jsonb_typeof(target_state) = 'object'),
  constraint aero_memory_transactions_review_array check (jsonb_typeof(review) = 'array'),
  constraint aero_memory_transactions_operation_digest check (operation_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_memory_transactions_contract_digest check (contract_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_memory_transactions_before_digest check (before_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_memory_transactions_target_digest check (target_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_memory_transactions_storage_digest check (payload_storage_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_memory_transactions_approval_hash check (approval_token_hash is null or approval_token_hash ~ '^[0-9a-f]{64}$'),
  unique (user_id, request_key)
);

create index if not exists aero_memory_transactions_user_created_idx
  on aero_private.aero_memory_transactions (user_id, created_at desc);

create index if not exists aero_memory_transactions_expiry_idx
  on aero_private.aero_memory_transactions (approval_expires_at)
  where status = 'prepared';

create table if not exists aero_private.aero_memory_events (
  id              bigint generated always as identity primary key,
  transaction_id  uuid not null references aero_private.aero_memory_transactions (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  sequence        integer not null check (sequence > 0),
  event_type      text not null,
  payload         jsonb not null default '{}'::jsonb,
  previous_digest text not null default '',
  event_digest    text not null,
  created_at      timestamptz not null default now(),
  constraint aero_memory_events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint aero_memory_events_digest check (event_digest ~ '^[0-9a-f]{64}$'),
  unique (transaction_id, sequence)
);

create index if not exists aero_memory_events_user_transaction_idx
  on aero_private.aero_memory_events (user_id, transaction_id, sequence);

alter table aero_private.aero_memory_accounts enable row level security;
alter table aero_private.aero_memories enable row level security;
alter table aero_private.aero_memory_edges enable row level security;
alter table aero_private.aero_memory_transactions enable row level security;
alter table aero_private.aero_memory_events enable row level security;
alter table aero_private.aero_memory_accounts force row level security;
alter table aero_private.aero_memories force row level security;
alter table aero_private.aero_memory_edges force row level security;
alter table aero_private.aero_memory_transactions force row level security;
alter table aero_private.aero_memory_events force row level security;

revoke all on table
  aero_private.aero_memory_accounts,
  aero_private.aero_memories,
  aero_private.aero_memory_edges,
  aero_private.aero_memory_transactions,
  aero_private.aero_memory_events
from public, anon, authenticated;
revoke all on all sequences in schema aero_private from public, anon, authenticated;

grant all on table
  aero_private.aero_memory_accounts,
  aero_private.aero_memories,
  aero_private.aero_memory_edges,
  aero_private.aero_memory_transactions,
  aero_private.aero_memory_events
to service_role;
grant usage, select on all sequences in schema aero_private to service_role;

drop policy if exists "aero service memory accounts" on aero_private.aero_memory_accounts;
create policy "aero service memory accounts" on aero_private.aero_memory_accounts
  for all to service_role using (true) with check (true);
drop policy if exists "aero service memories" on aero_private.aero_memories;
create policy "aero service memories" on aero_private.aero_memories
  for all to service_role using (true) with check (true);
drop policy if exists "aero service memory edges" on aero_private.aero_memory_edges;
create policy "aero service memory edges" on aero_private.aero_memory_edges
  for all to service_role using (true) with check (true);
drop policy if exists "aero service memory transactions" on aero_private.aero_memory_transactions;
create policy "aero service memory transactions" on aero_private.aero_memory_transactions
  for all to service_role using (true) with check (true);
drop policy if exists "aero service memory events" on aero_private.aero_memory_events;
create policy "aero service memory events" on aero_private.aero_memory_events
  for all to service_role using (true) with check (true);

comment on table aero_private.aero_memory_accounts is
  'Private authoritative Aero memory state. The Lyfe document is a read-through cache only.';
comment on table aero_private.aero_memories is
  'Relational projection of typed memories for constrained retrieval and inspection.';
comment on table aero_private.aero_memory_transactions is
  'Exact, one-use memory mutation contracts; raw targets are redacted after terminal transitions.';

create or replace function aero_private.aero_memory_state_digest(p_state jsonb)
returns text
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(extensions.digest(p_state::text, 'sha256'), 'hex')
$$;

create or replace function aero_private.aero_memory_tx_storage_digest(
  p_operation jsonb,
  p_operation_digest text,
  p_contract jsonb,
  p_contract_digest text,
  p_base_revision bigint,
  p_before_digest text,
  p_target_state jsonb,
  p_target_digest text,
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
      p_operation::text || E'\n' || p_operation_digest || E'\n' ||
      p_contract::text || E'\n' || p_contract_digest || E'\n' ||
      p_base_revision::text || E'\n' || p_before_digest || E'\n' ||
      p_target_state::text || E'\n' || p_target_digest || E'\n' || p_review::text,
      'sha256'
    ),
    'hex'
  )
$$;

create or replace function aero_private.aero_minimal_memory_review(p_review jsonb)
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

create or replace function aero_private.aero_validate_memory_state(p_state jsonb)
returns boolean
language plpgsql
immutable
parallel safe
security invoker
set search_path = ''
as $$
declare
  v_memory jsonb;
  v_dependency jsonb;
  v_ids text[] := '{}'::text[];
  v_live_keys text[] := '{}'::text[];
  v_id text;
  v_key text;
  v_status text;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' then return false; end if;
  if jsonb_typeof(coalesce(p_state->'memories', '[]'::jsonb)) <> 'array' then return false; end if;
  if jsonb_typeof(coalesce(p_state->'memoryJournal', '[]'::jsonb)) <> 'array' then return false; end if;
  if jsonb_typeof(coalesce(p_state->'episodes', '[]'::jsonb)) <> 'array' then return false; end if;
  if jsonb_array_length(coalesce(p_state->'memories', '[]'::jsonb)) > 300 then return false; end if;
  if jsonb_array_length(coalesce(p_state->'memoryJournal', '[]'::jsonb)) > 120 then return false; end if;
  if jsonb_array_length(coalesce(p_state->'episodes', '[]'::jsonb)) > 500 then return false; end if;
  if coalesce((p_state->>'memoryRevision')::bigint, 0) < 0 then return false; end if;

  for v_memory in select value from jsonb_array_elements(coalesce(p_state->'memories', '[]'::jsonb)) loop
    if jsonb_typeof(v_memory) <> 'object' then return false; end if;
    v_id := coalesce(v_memory->>'id', '');
    v_key := coalesce(v_memory->>'memoryKey', '');
    v_status := coalesce(v_memory->>'status', '');
    if char_length(v_id) not between 1 and 120 or v_id = any(v_ids) then return false; end if;
    if char_length(v_key) not between 1 and 240 then return false; end if;
    if char_length(coalesce(v_memory->>'claim', '')) not between 1 and 800 then return false; end if;
    if char_length(coalesce(v_memory->>'scope', '')) not between 1 and 100 then return false; end if;
    if coalesce(v_memory->>'type', '') not in ('episodic', 'semantic', 'project', 'procedural') then return false; end if;
    if coalesce(v_memory->>'sourceMode', '') not in ('explicit', 'inferred') then return false; end if;
    if v_status not in ('candidate', 'provisional', 'active', 'disputed', 'superseded', 'invalidated') then return false; end if;
    if jsonb_typeof(coalesce(v_memory->'dependsOn', '[]'::jsonb)) <> 'array' then return false; end if;
    if jsonb_typeof(coalesce(v_memory->'evidence', '[]'::jsonb)) <> 'array' then return false; end if;
    if jsonb_typeof(coalesce(v_memory->'sourceRefs', '[]'::jsonb)) <> 'array' then return false; end if;
    if coalesce((v_memory->>'confidence')::numeric, -1) < 0 or coalesce((v_memory->>'confidence')::numeric, 2) > 1 then return false; end if;
    v_ids := array_append(v_ids, v_id);
    if v_status in ('active', 'provisional') then
      if v_key = any(v_live_keys) then return false; end if;
      v_live_keys := array_append(v_live_keys, v_key);
    end if;
  end loop;

  for v_memory in select value from jsonb_array_elements(coalesce(p_state->'memories', '[]'::jsonb)) loop
    if coalesce(v_memory->>'status', '') not in ('active', 'provisional') then continue; end if;
    for v_dependency in select value from jsonb_array_elements(coalesce(v_memory->'dependsOn', '[]'::jsonb)) loop
      if jsonb_typeof(v_dependency) <> 'string' then return false; end if;
      if not exists (
        select 1
        from jsonb_array_elements(coalesce(p_state->'memories', '[]'::jsonb)) as candidate(value)
        where candidate.value->>'id' = v_dependency #>> '{}'
          and candidate.value->>'status' in ('active', 'provisional')
      ) then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then
  return false;
end
$$;

create or replace function public.aero_commit_memory_transaction(
  p_user_id uuid,
  p_transaction_id uuid,
  p_contract_digest text,
  p_approval_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transaction aero_private.aero_memory_transactions%rowtype;
  v_account aero_private.aero_memory_accounts%rowtype;
  v_state jsonb;
  v_head text;
  v_certificate_payload jsonb;
  v_certificate jsonb;
  v_certificate_digest text;
begin
  select * into v_transaction
  from aero_private.aero_memory_transactions
  where id = p_transaction_id and user_id = p_user_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'memory_transaction_not_found'); end if;
  if v_transaction.payload_storage_digest <> aero_private.aero_memory_tx_storage_digest(
    v_transaction.operation, v_transaction.operation_digest,
    v_transaction.contract, v_transaction.contract_digest,
    v_transaction.base_revision, v_transaction.before_digest,
    v_transaction.target_state, v_transaction.target_digest, v_transaction.review
  ) then return jsonb_build_object('ok', false, 'error', 'memory_integrity_failed'); end if;
  if not aero_private.aero_memory_event_chain_valid(v_transaction.id, p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'memory_journal_integrity_failed');
  end if;
  if v_transaction.contract_digest <> p_contract_digest then
    return jsonb_build_object('ok', false, 'error', 'memory_contract_changed');
  end if;
  if v_transaction.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'memory_approval_replayed');
  end if;
  if v_transaction.status = 'expired' then
    return jsonb_build_object('ok', false, 'error', 'memory_approval_expired');
  end if;
  if v_transaction.status <> 'prepared' then
    return jsonb_build_object('ok', false, 'error', 'memory_transaction_not_prepared', 'status', v_transaction.status);
  end if;
  if v_transaction.approval_expires_at is null or v_transaction.approval_expires_at <= now() then
    update aero_private.aero_memory_transactions
    set status = 'expired', approval_token_hash = null, approval_expires_at = null, updated_at = now()
    where id = v_transaction.id and user_id = p_user_id;
    perform aero_private.aero_append_memory_event(
      v_transaction.id, p_user_id, 'expired', jsonb_build_object('phase', 'approval')
    );
    perform aero_private.aero_redact_memory_transaction(v_transaction.id, p_user_id);
    return jsonb_build_object('ok', false, 'error', 'memory_approval_expired');
  end if;
  if v_transaction.approval_token_hash is null
     or v_transaction.approval_token_hash <> p_approval_token_hash
  then return jsonb_build_object('ok', false, 'error', 'memory_approval_invalid'); end if;

  select * into v_account
  from aero_private.aero_memory_accounts
  where user_id = p_user_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'memory_state_missing'); end if;
  if v_account.state_storage_digest <> aero_private.aero_memory_state_digest(v_account.state)
     or not aero_private.aero_validate_memory_state(v_account.state)
  then return jsonb_build_object('ok', false, 'error', 'memory_integrity_failed'); end if;
  if v_account.revision <> v_transaction.base_revision
     or v_account.state_digest <> v_transaction.before_digest
  then
    update aero_private.aero_memory_transactions
    set status = 'stale', approval_token_hash = null, approval_expires_at = null, updated_at = now()
    where id = v_transaction.id and user_id = p_user_id;
    perform aero_private.aero_append_memory_event(
      v_transaction.id, p_user_id, 'stale',
      jsonb_build_object(
        'expectedRevision', v_transaction.base_revision,
        'currentRevision', v_account.revision
      )
    );
    perform aero_private.aero_redact_memory_transaction(v_transaction.id, p_user_id);
    return jsonb_build_object(
      'ok', false, 'error', 'memory_state_changed',
      'currentRevision', v_account.revision, 'stateDigest', v_account.state_digest
    );
  end if;
  if not aero_private.aero_validate_memory_state(v_transaction.target_state)
     or coalesce((v_transaction.target_state->>'memoryRevision')::bigint, -1) <> v_transaction.base_revision + 1
  then return jsonb_build_object('ok', false, 'error', 'memory_integrity_failed'); end if;

  v_state := v_transaction.target_state;
  update aero_private.aero_memory_accounts
  set protocol_version = v_transaction.protocol_version,
      revision = v_transaction.base_revision + 1,
      state = v_state,
      state_digest = v_transaction.target_digest,
      state_storage_digest = aero_private.aero_memory_state_digest(v_state),
      updated_at = now()
  where user_id = p_user_id
  returning * into v_account;
  perform aero_private.aero_project_memory_state(p_user_id, v_state);

  update aero_private.aero_memory_transactions
  set status = 'completed', approval_token_hash = null, approval_expires_at = null,
      completed_at = now(), updated_at = now()
  where id = v_transaction.id and user_id = p_user_id;
  v_head := aero_private.aero_append_memory_event(
    v_transaction.id, p_user_id, 'completed',
    jsonb_build_object(
      'contractDigest', v_transaction.contract_digest,
      'targetDigest', v_transaction.target_digest,
      'newRevision', v_account.revision,
      'atomic', true
    )
  );
  v_certificate_payload := jsonb_build_object(
    'protocol', v_transaction.protocol_version,
    'transactionId', v_transaction.id,
    'status', 'completed',
    'contractDigest', v_transaction.contract_digest,
    'beforeDigest', v_transaction.before_digest,
    'targetDigest', v_transaction.target_digest,
    'eventHeadDigest', v_head,
    'baseRevision', v_transaction.base_revision,
    'newRevision', v_account.revision,
    'atomic', true
  );
  v_certificate_digest := pg_catalog.encode(
    extensions.digest(v_certificate_payload::text, 'sha256'), 'hex'
  );
  v_certificate := jsonb_build_object('payload', v_certificate_payload, 'digest', v_certificate_digest);
  update aero_private.aero_memory_transactions
  set completion_certificate = v_certificate, updated_at = now()
  where id = v_transaction.id and user_id = p_user_id;
  perform aero_private.aero_redact_memory_transaction(v_transaction.id, p_user_id);

  return jsonb_build_object(
    'ok', true,
    'status', 'completed',
    'transactionId', v_transaction.id,
    'certificate', v_certificate,
    'state', v_state,
    'revision', v_account.revision,
    'stateDigest', v_transaction.target_digest
  );
end
$$;

create or replace function public.aero_cancel_memory_transaction(
  p_user_id uuid,
  p_transaction_id uuid,
  p_contract_digest text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transaction aero_private.aero_memory_transactions%rowtype;
begin
  select * into v_transaction
  from aero_private.aero_memory_transactions
  where id = p_transaction_id and user_id = p_user_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'memory_transaction_not_found'); end if;
  if v_transaction.payload_storage_digest <> aero_private.aero_memory_tx_storage_digest(
    v_transaction.operation, v_transaction.operation_digest,
    v_transaction.contract, v_transaction.contract_digest,
    v_transaction.base_revision, v_transaction.before_digest,
    v_transaction.target_state, v_transaction.target_digest, v_transaction.review
  ) or not aero_private.aero_memory_event_chain_valid(v_transaction.id, p_user_id)
  then return jsonb_build_object('ok', false, 'error', 'memory_integrity_failed'); end if;
  if v_transaction.contract_digest <> p_contract_digest then
    return jsonb_build_object('ok', false, 'error', 'memory_contract_changed');
  end if;
  if v_transaction.status <> 'prepared' then
    return jsonb_build_object('ok', false, 'error', 'memory_transaction_not_prepared', 'status', v_transaction.status);
  end if;
  update aero_private.aero_memory_transactions
  set status = 'cancelled', approval_token_hash = null, approval_expires_at = null, updated_at = now()
  where id = v_transaction.id and user_id = p_user_id;
  perform aero_private.aero_append_memory_event(v_transaction.id, p_user_id, 'cancelled', '{}'::jsonb);
  perform aero_private.aero_redact_memory_transaction(v_transaction.id, p_user_id);
  return jsonb_build_object('ok', true, 'status', 'cancelled', 'transactionId', v_transaction.id);
end
$$;

create or replace function public.aero_inspect_memory_transaction(
  p_user_id uuid,
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transaction aero_private.aero_memory_transactions%rowtype;
  v_events jsonb;
begin
  select * into v_transaction
  from aero_private.aero_memory_transactions
  where id = p_transaction_id and user_id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'memory_transaction_not_found'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence', sequence,
    'type', event_type,
    'payload', payload,
    'previousDigest', previous_digest,
    'digest', event_digest,
    'createdAt', created_at
  ) order by sequence), '[]'::jsonb)
  into v_events
  from aero_private.aero_memory_events
  where transaction_id = p_transaction_id and user_id = p_user_id;
  return jsonb_build_object(
    'ok', true,
    'transactionId', v_transaction.id,
    'requestKey', v_transaction.request_key,
    'status', v_transaction.status,
    'contractDigest', v_transaction.contract_digest,
    'baseRevision', v_transaction.base_revision,
    'targetDigest', v_transaction.target_digest,
    'review', v_transaction.review,
    'certificate', v_transaction.completion_certificate,
    'eventHeadDigest', v_transaction.event_head_digest,
    'eventSequence', v_transaction.event_sequence,
    'journalValid', aero_private.aero_memory_event_chain_valid(v_transaction.id, p_user_id),
    'payloadValid', v_transaction.payload_storage_digest = aero_private.aero_memory_tx_storage_digest(
      v_transaction.operation, v_transaction.operation_digest,
      v_transaction.contract, v_transaction.contract_digest,
      v_transaction.base_revision, v_transaction.before_digest,
      v_transaction.target_state, v_transaction.target_digest, v_transaction.review
    ),
    'events', v_events,
    'createdAt', v_transaction.created_at,
    'updatedAt', v_transaction.updated_at
  );
end
$$;

create or replace function public.aero_forget_memory_transaction(
  p_user_id uuid,
  p_transaction_id uuid,
  p_contract_digest text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transaction aero_private.aero_memory_transactions%rowtype;
begin
  select * into v_transaction
  from aero_private.aero_memory_transactions
  where id = p_transaction_id and user_id = p_user_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'memory_transaction_not_found'); end if;
  if v_transaction.contract_digest <> p_contract_digest then
    return jsonb_build_object('ok', false, 'error', 'memory_contract_changed');
  end if;
  delete from aero_private.aero_memory_transactions
  where id = p_transaction_id and user_id = p_user_id;
  return jsonb_build_object('ok', true, 'forgotten', true, 'transactionId', p_transaction_id);
end
$$;

revoke all on function aero_private.aero_memory_state_digest(jsonb) from public, anon, authenticated;
revoke all on function aero_private.aero_memory_tx_storage_digest(jsonb, text, jsonb, text, bigint, text, jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function aero_private.aero_minimal_memory_review(jsonb) from public, anon, authenticated;
revoke all on function aero_private.aero_validate_memory_state(jsonb) from public, anon, authenticated;
grant execute on function aero_private.aero_memory_state_digest(jsonb) to service_role;
grant execute on function aero_private.aero_memory_tx_storage_digest(jsonb, text, jsonb, text, bigint, text, jsonb, text, jsonb) to service_role;
grant execute on function aero_private.aero_minimal_memory_review(jsonb) to service_role;
grant execute on function aero_private.aero_validate_memory_state(jsonb) to service_role;

create or replace function aero_private.aero_memory_timestamp(
  p_value jsonb,
  p_key text,
  p_fallback timestamptz default null
)
returns timestamptz
language plpgsql
immutable
parallel safe
security invoker
set search_path = ''
as $$
declare
  v_value text := coalesce(p_value->>p_key, '');
  v_millis numeric;
begin
  if v_value !~ '^[0-9]+([.][0-9]+)?$' then return p_fallback; end if;
  v_millis := v_value::numeric;
  if v_millis <= 0 then return p_fallback; end if;
  return pg_catalog.to_timestamp((v_millis / 1000.0)::double precision);
exception when others then
  return p_fallback;
end
$$;

create or replace function aero_private.aero_project_memory_state(
  p_user_id uuid,
  p_state jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not aero_private.aero_validate_memory_state(p_state) then
    raise exception using errcode = '22023', message = 'invalid aero memory state';
  end if;

  delete from aero_private.aero_memory_edges where user_id = p_user_id;
  delete from aero_private.aero_memories where user_id = p_user_id;

  insert into aero_private.aero_memories (
    user_id, id, memory_type, scope, memory_key, claim, source_mode, authority,
    status, confidence, evidence, source_refs, pattern_key, depends_on,
    supersedes, superseded_by, invalidated_by, revision, commit_id,
    success_count, failure_count, distinct_days, contradictions, episode_outcomes,
    was_promoted, valid_from, valid_until, last_used, last_confirmed,
    created_at, updated_at
  )
  select
    p_user_id,
    memory.value->>'id',
    memory.value->>'type',
    memory.value->>'scope',
    memory.value->>'memoryKey',
    memory.value->>'claim',
    memory.value->>'sourceMode',
    case when memory.value->>'sourceMode' = 'explicit' then 'user' else 'behavior' end,
    memory.value->>'status',
    greatest(0, least(1, coalesce((memory.value->>'confidence')::numeric, 0))),
    coalesce(memory.value->'evidence', '[]'::jsonb),
    coalesce(memory.value->'sourceRefs', '[]'::jsonb),
    coalesce(memory.value->>'patternKey', ''),
    coalesce(memory.value->'dependsOn', '[]'::jsonb),
    coalesce(memory.value->'supersedes', '[]'::jsonb),
    coalesce(memory.value->>'supersededBy', ''),
    coalesce(memory.value->'invalidatedBy', '[]'::jsonb),
    greatest(0, coalesce((memory.value->>'revision')::bigint, 0)),
    coalesce(memory.value->>'commitId', ''),
    greatest(0, coalesce((memory.value->>'successCount')::integer, 0)),
    greatest(0, coalesce((memory.value->>'failureCount')::integer, 0)),
    coalesce(memory.value->'distinctDays', '[]'::jsonb),
    coalesce(memory.value->'contradictions', '[]'::jsonb),
    coalesce(memory.value->'episodeOutcomes', '[]'::jsonb),
    coalesce((memory.value->>'wasPromoted')::boolean, false),
    aero_private.aero_memory_timestamp(memory.value, 'validFrom', now()),
    aero_private.aero_memory_timestamp(memory.value, 'validUntil', null),
    aero_private.aero_memory_timestamp(memory.value, 'lastUsed', null),
    aero_private.aero_memory_timestamp(memory.value, 'lastConfirmed', null),
    aero_private.aero_memory_timestamp(memory.value, 'createdAt', now()),
    aero_private.aero_memory_timestamp(memory.value, 'updatedAt', now())
  from jsonb_array_elements(coalesce(p_state->'memories', '[]'::jsonb)) as memory(value);

  insert into aero_private.aero_memory_edges (
    user_id, from_memory_id, to_memory_id, edge_kind
  )
  select p_user_id, source.value->>'id', dependency.value, 'depends_on'
  from jsonb_array_elements(coalesce(p_state->'memories', '[]'::jsonb)) as source(value)
  cross join lateral jsonb_array_elements_text(coalesce(source.value->'dependsOn', '[]'::jsonb)) as dependency(value)
  join aero_private.aero_memories target
    on target.user_id = p_user_id and target.id = dependency.value
  where source.value->>'id' <> dependency.value
    and source.value->>'status' in ('active', 'provisional');
end
$$;

create or replace function aero_private.aero_ensure_memory_account(p_user_id uuid)
returns aero_private.aero_memory_accounts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account aero_private.aero_memory_accounts%rowtype;
  v_legacy jsonb;
  v_state jsonb;
  v_revision bigint := 0;
  v_digest text;
  v_now_millis bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_inserted integer := 0;
begin
  select * into v_account
  from aero_private.aero_memory_accounts
  where user_id = p_user_id;
  if found then return v_account; end if;

  select data->'aero' into v_legacy
  from public.lyfe_states
  where user_id = p_user_id;

  v_state := jsonb_build_object(
    'version', 3,
    'memories', '[]'::jsonb,
    'memoryRevision', 0,
    'memoryJournal', '[]'::jsonb,
    'episodes', '[]'::jsonb,
    'lastContext', null,
    'createdAt', v_now_millis,
    'lastServerAt', v_now_millis
  );
  if jsonb_typeof(v_legacy) = 'object' then
    v_legacy := jsonb_set(v_legacy, '{version}', '3'::jsonb, true);
    v_legacy := jsonb_set(v_legacy, '{lastServerAt}', to_jsonb(v_now_millis), true);
    if aero_private.aero_validate_memory_state(v_legacy) then v_state := v_legacy; end if;
  end if;
  if not aero_private.aero_validate_memory_state(v_state) then
    raise exception using errcode = '22023', message = 'could not initialize aero memory state';
  end if;
  v_revision := greatest(0, coalesce((v_state->>'memoryRevision')::bigint, 0));
  v_digest := aero_private.aero_memory_state_digest(v_state);

  insert into aero_private.aero_memory_accounts (
    user_id, revision, state, state_digest, state_storage_digest
  ) values (
    p_user_id, v_revision, v_state, v_digest, v_digest
  ) on conflict (user_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then perform aero_private.aero_project_memory_state(p_user_id, v_state); end if;

  select * into strict v_account
  from aero_private.aero_memory_accounts
  where user_id = p_user_id;
  return v_account;
end
$$;

create or replace function aero_private.aero_append_memory_event(
  p_transaction_id uuid,
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
  from aero_private.aero_memory_transactions
  where id = p_transaction_id and user_id = p_user_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'aero memory transaction not found'; end if;

  v_digest := pg_catalog.encode(extensions.digest(
    coalesce(v_previous, '') || E'\n' || p_user_id::text || E'\n' ||
    p_transaction_id::text || E'\n' || v_sequence::text || E'\n' ||
    left(p_event_type, 80) || E'\n' || coalesce(p_payload, '{}'::jsonb)::text,
    'sha256'
  ), 'hex');

  insert into aero_private.aero_memory_events (
    transaction_id, user_id, sequence, event_type, payload, previous_digest, event_digest
  ) values (
    p_transaction_id, p_user_id, v_sequence, left(p_event_type, 80),
    coalesce(p_payload, '{}'::jsonb), coalesce(v_previous, ''), v_digest
  );
  update aero_private.aero_memory_transactions
  set event_sequence = v_sequence, event_head_digest = v_digest, updated_at = now()
  where id = p_transaction_id and user_id = p_user_id;
  return v_digest;
end
$$;

create or replace function aero_private.aero_memory_event_chain_valid(
  p_transaction_id uuid,
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
    from aero_private.aero_memory_events
    where transaction_id = p_transaction_id and user_id = p_user_id
    order by sequence
  loop
    v_digest := pg_catalog.encode(extensions.digest(
      coalesce(v_previous, '') || E'\n' || p_user_id::text || E'\n' ||
      p_transaction_id::text || E'\n' || v_event.sequence::text || E'\n' ||
      v_event.event_type || E'\n' || v_event.payload::text,
      'sha256'
    ), 'hex');
    if v_event.sequence <> v_expected
       or v_event.previous_digest <> v_previous
       or v_event.event_digest <> v_digest
    then return false; end if;
    v_previous := v_event.event_digest;
    v_expected := v_expected + 1;
  end loop;

  select event_sequence, event_head_digest into v_sequence, v_head
  from aero_private.aero_memory_transactions
  where id = p_transaction_id and user_id = p_user_id;
  if not found then return false; end if;
  return v_sequence = v_expected - 1 and v_head = v_previous;
end
$$;

create or replace function aero_private.aero_redact_memory_transaction(
  p_transaction_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transaction aero_private.aero_memory_transactions%rowtype;
  v_contract jsonb;
  v_review jsonb;
  v_storage_digest text;
begin
  select * into strict v_transaction
  from aero_private.aero_memory_transactions
  where id = p_transaction_id and user_id = p_user_id
  for update;
  v_contract := jsonb_build_object(
    'protocol', v_transaction.protocol_version,
    'redacted', true,
    'operationCount', jsonb_array_length(v_transaction.operation)
  );
  v_review := aero_private.aero_minimal_memory_review(v_transaction.review);
  v_storage_digest := aero_private.aero_memory_tx_storage_digest(
    '[]'::jsonb, v_transaction.operation_digest,
    v_contract, v_transaction.contract_digest,
    v_transaction.base_revision, v_transaction.before_digest,
    '{}'::jsonb, v_transaction.target_digest, v_review
  );
  update aero_private.aero_memory_transactions
  set operation = '[]'::jsonb,
      contract = v_contract,
      target_state = '{}'::jsonb,
      review = v_review,
      payload_storage_digest = v_storage_digest,
      updated_at = now()
  where id = p_transaction_id and user_id = p_user_id;
end
$$;

create or replace function aero_private.aero_expire_memory_transactions(p_user_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transaction record;
  v_count integer := 0;
begin
  for v_transaction in
    select id from aero_private.aero_memory_transactions
    where user_id = p_user_id and status = 'prepared' and approval_expires_at <= now()
    order by approval_expires_at
    for update skip locked
  loop
    update aero_private.aero_memory_transactions
    set status = 'expired', approval_token_hash = null, approval_expires_at = null, updated_at = now()
    where id = v_transaction.id and user_id = p_user_id;
    perform aero_private.aero_append_memory_event(
      v_transaction.id, p_user_id, 'expired', jsonb_build_object('phase', 'approval')
    );
    perform aero_private.aero_redact_memory_transaction(v_transaction.id, p_user_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

revoke all on function aero_private.aero_memory_timestamp(jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function aero_private.aero_project_memory_state(uuid, jsonb) from public, anon, authenticated;
revoke all on function aero_private.aero_ensure_memory_account(uuid) from public, anon, authenticated;
revoke all on function aero_private.aero_append_memory_event(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function aero_private.aero_memory_event_chain_valid(uuid, uuid) from public, anon, authenticated;
revoke all on function aero_private.aero_redact_memory_transaction(uuid, uuid) from public, anon, authenticated;
revoke all on function aero_private.aero_expire_memory_transactions(uuid) from public, anon, authenticated;
grant execute on function aero_private.aero_memory_timestamp(jsonb, text, timestamptz) to service_role;
grant execute on function aero_private.aero_project_memory_state(uuid, jsonb) to service_role;
grant execute on function aero_private.aero_ensure_memory_account(uuid) to service_role;
grant execute on function aero_private.aero_append_memory_event(uuid, uuid, text, jsonb) to service_role;
grant execute on function aero_private.aero_memory_event_chain_valid(uuid, uuid) to service_role;
grant execute on function aero_private.aero_redact_memory_transaction(uuid, uuid) to service_role;
grant execute on function aero_private.aero_expire_memory_transactions(uuid) to service_role;

create or replace function public.aero_read_memory_state(p_user_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account aero_private.aero_memory_accounts%rowtype;
begin
  if p_user_id is null then return jsonb_build_object('ok', false, 'error', 'memory_identity_required'); end if;
  perform aero_private.aero_ensure_memory_account(p_user_id);
  perform aero_private.aero_expire_memory_transactions(p_user_id);
  select * into strict v_account
  from aero_private.aero_memory_accounts
  where user_id = p_user_id;
  if v_account.state_storage_digest <> aero_private.aero_memory_state_digest(v_account.state)
     or not aero_private.aero_validate_memory_state(v_account.state)
     or coalesce((v_account.state->>'memoryRevision')::bigint, -1) <> v_account.revision
  then
    return jsonb_build_object('ok', false, 'error', 'memory_integrity_failed');
  end if;
  return jsonb_build_object(
    'ok', true,
    'protocol', v_account.protocol_version,
    'revision', v_account.revision,
    'stateDigest', v_account.state_digest,
    'state', v_account.state,
    'updatedAt', v_account.updated_at
  );
exception when no_data_found then
  return jsonb_build_object('ok', false, 'error', 'memory_state_missing');
end
$$;

create or replace function public.aero_prepare_memory_transaction(
  p_transaction_id uuid,
  p_user_id uuid,
  p_request_key text,
  p_operation jsonb,
  p_operation_digest text,
  p_contract jsonb,
  p_contract_digest text,
  p_base_revision bigint,
  p_before_digest text,
  p_target_state jsonb,
  p_target_digest text,
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
  v_transaction aero_private.aero_memory_transactions%rowtype;
  v_account aero_private.aero_memory_accounts%rowtype;
  v_payload_digest text;
  v_idempotent boolean := false;
begin
  if p_transaction_id is null or p_user_id is null
     or char_length(p_request_key) not between 8 and 160
     or p_operation_digest !~ '^[0-9a-f]{64}$'
     or p_contract_digest !~ '^[0-9a-f]{64}$'
     or p_before_digest !~ '^[0-9a-f]{64}$'
     or p_target_digest !~ '^[0-9a-f]{64}$'
     or p_approval_token_hash !~ '^[0-9a-f]{64}$'
     or p_base_revision < 0
     or jsonb_typeof(p_operation) <> 'array'
     or jsonb_array_length(p_operation) not between 1 and 20
     or jsonb_typeof(p_contract) <> 'object'
     or jsonb_typeof(p_target_state) <> 'object'
     or jsonb_typeof(p_review) <> 'array'
     or jsonb_array_length(p_review) not between 1 and 20
     or p_approval_expires_at <= now()
     or not aero_private.aero_validate_memory_state(p_target_state)
     or coalesce((p_target_state->>'memoryRevision')::bigint, -1) <> p_base_revision + 1
     or coalesce(p_contract->>'protocol', '') <> 'aero-memory-v0.3'
     or coalesce(p_contract->>'accountId', '') <> p_user_id::text
     or coalesce(p_contract->>'requestKey', '') <> p_request_key
     or p_contract->'operations' is distinct from p_operation
     or coalesce(p_contract#>>'{state,baseRevision}', '') <> p_base_revision::text
     or coalesce(p_contract#>>'{state,beforeDigest}', '') <> p_before_digest
     or coalesce(p_contract#>>'{target,nextRevision}', '') <> (p_base_revision + 1)::text
     or coalesce(p_contract#>>'{target,digest}', '') <> p_target_digest
  then
    raise exception using errcode = '22023', message = 'invalid aero memory transaction request';
  end if;

  v_payload_digest := aero_private.aero_memory_tx_storage_digest(
    p_operation, p_operation_digest, p_contract, p_contract_digest,
    p_base_revision, p_before_digest, p_target_state, p_target_digest, p_review
  );
  perform aero_private.aero_ensure_memory_account(p_user_id);
  perform aero_private.aero_expire_memory_transactions(p_user_id);

  select * into v_transaction
  from aero_private.aero_memory_transactions
  where user_id = p_user_id and request_key = p_request_key
  for update;

  if found then
    if v_transaction.payload_storage_digest <> aero_private.aero_memory_tx_storage_digest(
      v_transaction.operation, v_transaction.operation_digest,
      v_transaction.contract, v_transaction.contract_digest,
      v_transaction.base_revision, v_transaction.before_digest,
      v_transaction.target_state, v_transaction.target_digest, v_transaction.review
    ) or not aero_private.aero_memory_event_chain_valid(v_transaction.id, p_user_id)
    then return jsonb_build_object('ok', false, 'error', 'memory_integrity_failed'); end if;
    if v_transaction.operation_digest <> p_operation_digest
       or v_transaction.contract_digest <> p_contract_digest
       or v_transaction.target_digest <> p_target_digest
       or v_transaction.before_digest <> p_before_digest
       or v_transaction.base_revision <> p_base_revision
    then return jsonb_build_object('ok', false, 'error', 'memory_idempotency_conflict'); end if;
    if v_transaction.status = 'completed' then
      return jsonb_build_object('ok', false, 'error', 'memory_approval_replayed');
    end if;
    if v_transaction.status not in ('prepared', 'expired') then
      return jsonb_build_object('ok', false, 'error', 'memory_transaction_not_prepared', 'status', v_transaction.status);
    end if;
    v_idempotent := true;
  end if;

  select * into strict v_account
  from aero_private.aero_memory_accounts
  where user_id = p_user_id
  for update;
  if v_account.state_storage_digest <> aero_private.aero_memory_state_digest(v_account.state)
     or not aero_private.aero_validate_memory_state(v_account.state)
  then return jsonb_build_object('ok', false, 'error', 'memory_integrity_failed'); end if;
  if v_account.revision <> p_base_revision or v_account.state_digest <> p_before_digest then
    if v_idempotent and v_transaction.status = 'prepared' then
      update aero_private.aero_memory_transactions
      set status = 'stale', approval_token_hash = null, approval_expires_at = null, updated_at = now()
      where id = v_transaction.id and user_id = p_user_id;
      perform aero_private.aero_append_memory_event(
        v_transaction.id, p_user_id, 'stale',
        jsonb_build_object('expectedRevision', p_base_revision, 'currentRevision', v_account.revision)
      );
      perform aero_private.aero_redact_memory_transaction(v_transaction.id, p_user_id);
    end if;
    return jsonb_build_object(
      'ok', false, 'error', 'memory_state_changed',
      'currentRevision', v_account.revision, 'stateDigest', v_account.state_digest
    );
  end if;

  if v_idempotent then
    update aero_private.aero_memory_transactions
    set status = 'prepared',
        operation = p_operation,
        operation_digest = p_operation_digest,
        contract = p_contract,
        contract_digest = p_contract_digest,
        target_state = p_target_state,
        target_digest = p_target_digest,
        review = p_review,
        payload_storage_digest = v_payload_digest,
        approval_token_hash = p_approval_token_hash,
        approval_expires_at = p_approval_expires_at,
        updated_at = now()
    where id = v_transaction.id and user_id = p_user_id
    returning * into v_transaction;
    perform aero_private.aero_append_memory_event(
      v_transaction.id, p_user_id, 'approval_refreshed',
      jsonb_build_object('contractDigest', p_contract_digest, 'expiresAt', p_approval_expires_at)
    );
  else
    insert into aero_private.aero_memory_transactions (
      id, user_id, request_key, operation, operation_digest, contract,
      contract_digest, base_revision, before_digest, target_state,
      target_digest, review, payload_storage_digest,
      approval_token_hash, approval_expires_at
    ) values (
      p_transaction_id, p_user_id, p_request_key, p_operation, p_operation_digest,
      p_contract, p_contract_digest, p_base_revision, p_before_digest,
      p_target_state, p_target_digest, p_review, v_payload_digest,
      p_approval_token_hash, p_approval_expires_at
    ) returning * into v_transaction;
    perform aero_private.aero_append_memory_event(
      v_transaction.id, p_user_id, 'prepared',
      jsonb_build_object(
        'contractDigest', p_contract_digest,
        'beforeDigest', p_before_digest,
        'targetDigest', p_target_digest,
        'baseRevision', p_base_revision,
        'operationCount', jsonb_array_length(p_operation)
      )
    );
  end if;

  select * into strict v_transaction
  from aero_private.aero_memory_transactions
  where id = v_transaction.id and user_id = p_user_id;
  return jsonb_build_object(
    'ok', true,
    'idempotent', v_idempotent,
    'transactionId', v_transaction.id,
    'status', v_transaction.status,
    'contractDigest', v_transaction.contract_digest,
    'baseRevision', v_transaction.base_revision,
    'targetDigest', v_transaction.target_digest,
    'review', v_transaction.review,
    'eventHeadDigest', v_transaction.event_head_digest,
    'eventSequence', v_transaction.event_sequence
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'memory_prepare_race_retry');
end
$$;

revoke all on function public.aero_read_memory_state(uuid) from public, anon, authenticated;
revoke all on function public.aero_prepare_memory_transaction(uuid, uuid, text, jsonb, text, jsonb, text, bigint, text, jsonb, text, jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function public.aero_commit_memory_transaction(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.aero_cancel_memory_transaction(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.aero_inspect_memory_transaction(uuid, uuid) from public, anon, authenticated;
revoke all on function public.aero_forget_memory_transaction(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.aero_read_memory_state(uuid) to service_role;
grant execute on function public.aero_prepare_memory_transaction(uuid, uuid, text, jsonb, text, jsonb, text, bigint, text, jsonb, text, jsonb, text, timestamptz) to service_role;
grant execute on function public.aero_commit_memory_transaction(uuid, uuid, text, text) to service_role;
grant execute on function public.aero_cancel_memory_transaction(uuid, uuid, text) to service_role;
grant execute on function public.aero_inspect_memory_transaction(uuid, uuid) to service_role;
grant execute on function public.aero_forget_memory_transaction(uuid, uuid, text) to service_role;

comment on function public.aero_read_memory_state(uuid) is
  'Returns one account private Aero memory state after independent storage-integrity verification.';
comment on function public.aero_prepare_memory_transaction(uuid, uuid, text, jsonb, text, jsonb, text, bigint, text, jsonb, text, jsonb, text, timestamptz) is
  'Binds a one-use approval token to one exact typed-memory target and base revision.';
comment on function public.aero_commit_memory_transaction(uuid, uuid, text, text) is
  'Atomically commits one exact memory target, relational projection, evidence chain, and completion certificate.';
