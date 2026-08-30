-- Transaction-bound user presence for Aero approvals.
--
-- A browser click and an account session are not strong proof that the person
-- approved one exact action. This layer registers one WebAuthn credential,
-- binds a fresh assertion challenge to the prepared contract *and* its current
-- one-use approval token, and consumes the resulting presence grant in the
-- same Postgres transaction as the target commit.

create table if not exists aero_private.aero_presence_credentials (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  credential_id     text not null unique,
  public_key         text not null,
  counter            bigint not null default 0 check (counter >= 0),
  transports         text[] not null default '{}'::text[],
  device_type        text not null default 'singleDevice',
  backed_up          boolean not null default false,
  friendly_name      text not null default 'Secure approval device',
  created_at         timestamptz not null default now(),
  last_used_at       timestamptz,
  revoked_at         timestamptz,
  constraint aero_presence_credential_id_format
    check (char_length(credential_id) between 16 and 1024
      and credential_id ~ '^[A-Za-z0-9_-]+$'),
  constraint aero_presence_public_key_format
    check (char_length(public_key) between 16 and 4096
      and public_key ~ '^[A-Za-z0-9_-]+$'),
  constraint aero_presence_device_type
    check (device_type in ('singleDevice', 'multiDevice')),
  constraint aero_presence_friendly_name_length
    check (char_length(friendly_name) between 1 and 120)
);

create unique index if not exists aero_presence_credentials_one_active_user_idx
  on aero_private.aero_presence_credentials (user_id)
  where revoked_at is null;

create table if not exists aero_private.aero_presence_challenges (
  id                    uuid primary key,
  user_id               uuid not null references auth.users (id) on delete cascade,
  ceremony              text not null,
  challenge             text not null unique,
  target_type           text,
  target_id             uuid,
  contract_digest       text,
  approval_token_hash   text,
  expires_at            timestamptz not null,
  consumed_at           timestamptz,
  created_at            timestamptz not null default now(),
  constraint aero_presence_challenge_ceremony
    check (ceremony in ('registration', 'approval', 'credential_remove')),
  constraint aero_presence_challenge_format
    check (char_length(challenge) between 32 and 256
      and challenge ~ '^[A-Za-z0-9_-]+$'),
  constraint aero_presence_challenge_target
    check (target_type is null or target_type in ('run', 'memory', 'credential')),
  constraint aero_presence_challenge_contract
    check (contract_digest is null or contract_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_presence_challenge_approval
    check (approval_token_hash is null or approval_token_hash ~ '^[0-9a-f]{64}$'),
  constraint aero_presence_challenge_shape check (
    (ceremony = 'registration' and target_type is null and target_id is null
      and contract_digest is null and approval_token_hash is null)
    or
    (ceremony = 'approval' and target_type in ('run', 'memory') and target_id is not null
      and contract_digest is not null and approval_token_hash is not null)
    or
    (ceremony = 'credential_remove' and target_type = 'credential' and target_id is not null
      and contract_digest is not null and approval_token_hash is null)
  )
);

create index if not exists aero_presence_challenges_user_created_idx
  on aero_private.aero_presence_challenges (user_id, created_at desc);

create table if not exists aero_private.aero_presence_grants (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  credential_id         uuid not null references aero_private.aero_presence_credentials (id) on delete cascade,
  token_hash            text not null unique,
  target_type           text not null,
  target_id             uuid not null,
  contract_digest       text not null,
  approval_token_hash   text not null,
  expires_at            timestamptz not null,
  consumed_at           timestamptz,
  created_at            timestamptz not null default now(),
  constraint aero_presence_grant_target check (target_type in ('run', 'memory')),
  constraint aero_presence_grant_token check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint aero_presence_grant_contract check (contract_digest ~ '^[0-9a-f]{64}$'),
  constraint aero_presence_grant_approval check (approval_token_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists aero_presence_grants_target_idx
  on aero_private.aero_presence_grants (user_id, target_type, target_id, created_at desc);
create index if not exists aero_presence_grants_credential_idx
  on aero_private.aero_presence_grants (credential_id);

alter table aero_private.aero_presence_credentials enable row level security;
alter table aero_private.aero_presence_challenges enable row level security;
alter table aero_private.aero_presence_grants enable row level security;
alter table aero_private.aero_presence_credentials force row level security;
alter table aero_private.aero_presence_challenges force row level security;
alter table aero_private.aero_presence_grants force row level security;

revoke all on table aero_private.aero_presence_credentials from public, anon, authenticated;
revoke all on table aero_private.aero_presence_challenges from public, anon, authenticated;
revoke all on table aero_private.aero_presence_grants from public, anon, authenticated;
grant all on table aero_private.aero_presence_credentials to service_role;
grant all on table aero_private.aero_presence_challenges to service_role;
grant all on table aero_private.aero_presence_grants to service_role;

drop policy if exists "aero service presence credentials" on aero_private.aero_presence_credentials;
create policy "aero service presence credentials"
  on aero_private.aero_presence_credentials for all to service_role using (true) with check (true);
drop policy if exists "aero service presence challenges" on aero_private.aero_presence_challenges;
create policy "aero service presence challenges"
  on aero_private.aero_presence_challenges for all to service_role using (true) with check (true);
drop policy if exists "aero service presence grants" on aero_private.aero_presence_grants;
create policy "aero service presence grants"
  on aero_private.aero_presence_grants for all to service_role using (true) with check (true);

create or replace function aero_private.aero_presence_required(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from aero_private.aero_presence_credentials
    where user_id = p_user_id and revoked_at is null
  )
$$;

create or replace function public.aero_presence_status(p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', true,
    'supported', true,
    'enrolled', count(*) > 0,
    'approvalMode', case when count(*) > 0 then 'every-change' else 'review-click' end,
    'credentials', coalesce(
      jsonb_agg(jsonb_build_object(
        'id', id,
        'credentialId', credential_id,
        'friendlyName', friendly_name,
        'deviceType', device_type,
        'backedUp', backed_up,
        'transports', transports,
        'createdAt', created_at,
        'lastUsedAt', last_used_at
      ) order by created_at) filter (where id is not null),
      '[]'::jsonb
    )
  )
  from aero_private.aero_presence_credentials
  where user_id = p_user_id and revoked_at is null
$$;

create or replace function public.aero_prepare_presence_challenge(
  p_user_id uuid,
  p_challenge_id uuid,
  p_ceremony text,
  p_challenge text,
  p_target_type text,
  p_target_id uuid,
  p_contract_digest text,
  p_approval_token_hash text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run aero_private.aero_runs%rowtype;
  v_memory aero_private.aero_memory_transactions%rowtype;
  v_credential aero_private.aero_presence_credentials%rowtype;
begin
  if p_user_id is null or p_challenge_id is null
     or p_challenge is null
     or char_length(p_challenge) not between 32 and 256
     or p_challenge !~ '^[A-Za-z0-9_-]+$'
     or p_expires_at <= now() or p_expires_at > now() + interval '5 minutes'
  then return jsonb_build_object('ok', false, 'error', 'presence_challenge_invalid'); end if;

  delete from aero_private.aero_presence_challenges
  where user_id = p_user_id and consumed_at is null and expires_at <= now();

  if p_ceremony = 'registration' then
    if p_target_type is not null or p_target_id is not null
       or p_contract_digest is not null or p_approval_token_hash is not null
    then return jsonb_build_object('ok', false, 'error', 'presence_registration_invalid'); end if;
    if aero_private.aero_presence_required(p_user_id) then
      return jsonb_build_object('ok', false, 'error', 'presence_credential_exists');
    end if;
  elsif p_ceremony = 'approval' then
    if not aero_private.aero_presence_required(p_user_id) then
      return jsonb_build_object('ok', false, 'error', 'presence_not_enrolled');
    end if;
    if p_target_type = 'run' then
      select * into v_run from aero_private.aero_runs
      where id = p_target_id and user_id = p_user_id for update;
      if not found then return jsonb_build_object('ok', false, 'error', 'run_not_found'); end if;
      if v_run.status <> 'prepared' then
        return jsonb_build_object('ok', false, 'error', 'run_not_prepared', 'status', v_run.status);
      end if;
      if v_run.approval_expires_at is null or v_run.approval_expires_at <= now() then
        return jsonb_build_object('ok', false, 'error', 'approval_expired');
      end if;
      if v_run.contract_digest <> p_contract_digest
         or v_run.approval_token_hash <> p_approval_token_hash
      then return jsonb_build_object('ok', false, 'error', 'presence_target_changed'); end if;
    elsif p_target_type = 'memory' then
      select * into v_memory from aero_private.aero_memory_transactions
      where id = p_target_id and user_id = p_user_id for update;
      if not found then return jsonb_build_object('ok', false, 'error', 'memory_transaction_not_found'); end if;
      if v_memory.status <> 'prepared' then
        return jsonb_build_object('ok', false, 'error', 'memory_transaction_not_prepared', 'status', v_memory.status);
      end if;
      if v_memory.approval_expires_at is null or v_memory.approval_expires_at <= now() then
        return jsonb_build_object('ok', false, 'error', 'memory_approval_expired');
      end if;
      if v_memory.contract_digest <> p_contract_digest
         or v_memory.approval_token_hash <> p_approval_token_hash
      then return jsonb_build_object('ok', false, 'error', 'presence_target_changed'); end if;
    else
      return jsonb_build_object('ok', false, 'error', 'presence_target_invalid');
    end if;
  elsif p_ceremony = 'credential_remove' then
    if p_target_type <> 'credential' or p_target_id is null
       or p_contract_digest !~ '^[0-9a-f]{64}$' or p_approval_token_hash is not null
    then return jsonb_build_object('ok', false, 'error', 'presence_removal_invalid'); end if;
    select * into v_credential from aero_private.aero_presence_credentials
    where id = p_target_id and user_id = p_user_id and revoked_at is null for update;
    if not found then return jsonb_build_object('ok', false, 'error', 'presence_credential_not_found'); end if;
  else
    return jsonb_build_object('ok', false, 'error', 'presence_ceremony_unsupported');
  end if;

  insert into aero_private.aero_presence_challenges (
    id, user_id, ceremony, challenge, target_type, target_id,
    contract_digest, approval_token_hash, expires_at
  ) values (
    p_challenge_id, p_user_id, p_ceremony, p_challenge, p_target_type, p_target_id,
    p_contract_digest, p_approval_token_hash, p_expires_at
  );
  return jsonb_build_object('ok', true, 'challengeId', p_challenge_id, 'expiresAt', p_expires_at);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'presence_challenge_conflict');
end
$$;

create or replace function public.aero_read_presence_challenge(
  p_user_id uuid,
  p_challenge_id uuid,
  p_credential_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_challenge aero_private.aero_presence_challenges%rowtype;
  v_credential aero_private.aero_presence_credentials%rowtype;
begin
  select * into v_challenge from aero_private.aero_presence_challenges
  where id = p_challenge_id and user_id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'presence_challenge_not_found'); end if;
  if v_challenge.consumed_at is not null then
    return jsonb_build_object('ok', false, 'error', 'presence_challenge_replayed');
  end if;
  if v_challenge.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'presence_challenge_expired');
  end if;

  if v_challenge.ceremony <> 'registration' then
    select * into v_credential from aero_private.aero_presence_credentials
    where credential_id = p_credential_id and user_id = p_user_id
      and revoked_at is null;
    if not found then return jsonb_build_object('ok', false, 'error', 'presence_credential_not_found'); end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'challengeId', v_challenge.id,
    'ceremony', v_challenge.ceremony,
    'challenge', v_challenge.challenge,
    'targetType', v_challenge.target_type,
    'targetId', v_challenge.target_id,
    'contractDigest', v_challenge.contract_digest,
    'approvalTokenHash', v_challenge.approval_token_hash,
    'expiresAt', v_challenge.expires_at,
    'credential', case when v_challenge.ceremony = 'registration' then null else jsonb_build_object(
      'id', v_credential.id,
      'credentialId', v_credential.credential_id,
      'publicKey', v_credential.public_key,
      'counter', v_credential.counter,
      'transports', v_credential.transports,
      'deviceType', v_credential.device_type,
      'backedUp', v_credential.backed_up
    ) end
  );
end
$$;

create or replace function public.aero_complete_presence_registration(
  p_user_id uuid,
  p_challenge_id uuid,
  p_credential_id text,
  p_public_key text,
  p_counter bigint,
  p_transports text[],
  p_device_type text,
  p_backed_up boolean,
  p_friendly_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_challenge aero_private.aero_presence_challenges%rowtype;
  v_credential aero_private.aero_presence_credentials%rowtype;
begin
  select * into v_challenge from aero_private.aero_presence_challenges
  where id = p_challenge_id and user_id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'presence_challenge_not_found'); end if;
  if v_challenge.ceremony <> 'registration' then
    return jsonb_build_object('ok', false, 'error', 'presence_ceremony_mismatch');
  end if;
  if v_challenge.consumed_at is not null then
    return jsonb_build_object('ok', false, 'error', 'presence_challenge_replayed');
  end if;
  if v_challenge.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'presence_challenge_expired');
  end if;
  if aero_private.aero_presence_required(p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'presence_credential_exists');
  end if;
  if p_credential_id is null
     or char_length(p_credential_id) not between 16 and 1024
     or p_credential_id !~ '^[A-Za-z0-9_-]+$'
     or p_public_key is null
     or char_length(p_public_key) not between 16 and 4096
     or p_public_key !~ '^[A-Za-z0-9_-]+$'
     or p_counter is null or p_counter < 0
     or p_device_type is null or p_device_type not in ('singleDevice', 'multiDevice')
     or p_friendly_name is null or char_length(p_friendly_name) not between 1 and 120
  then return jsonb_build_object('ok', false, 'error', 'presence_credential_invalid'); end if;

  insert into aero_private.aero_presence_credentials (
    user_id, credential_id, public_key, counter, transports,
    device_type, backed_up, friendly_name
  ) values (
    p_user_id, p_credential_id, p_public_key, p_counter,
    coalesce(p_transports, '{}'::text[]), p_device_type,
    coalesce(p_backed_up, false), p_friendly_name
  ) returning * into v_credential;
  update aero_private.aero_presence_challenges set consumed_at = now() where id = v_challenge.id;
  return jsonb_build_object(
    'ok', true, 'enrolled', true, 'credentialId', v_credential.id,
    'friendlyName', v_credential.friendly_name, 'approvalMode', 'every-change'
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'presence_credential_exists');
end
$$;

create or replace function public.aero_complete_presence_assertion(
  p_user_id uuid,
  p_challenge_id uuid,
  p_credential_id text,
  p_new_counter bigint,
  p_grant_token_hash text,
  p_grant_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_challenge aero_private.aero_presence_challenges%rowtype;
  v_credential aero_private.aero_presence_credentials%rowtype;
  v_grant aero_private.aero_presence_grants%rowtype;
begin
  select * into v_challenge from aero_private.aero_presence_challenges
  where id = p_challenge_id and user_id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'presence_challenge_not_found'); end if;
  if v_challenge.ceremony not in ('approval', 'credential_remove') then
    return jsonb_build_object('ok', false, 'error', 'presence_ceremony_mismatch');
  end if;
  if v_challenge.consumed_at is not null then
    return jsonb_build_object('ok', false, 'error', 'presence_challenge_replayed');
  end if;
  if v_challenge.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'presence_challenge_expired');
  end if;
  select * into v_credential from aero_private.aero_presence_credentials
  where credential_id = p_credential_id and user_id = p_user_id
    and revoked_at is null for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'presence_credential_not_found'); end if;
  if p_new_counter < 0
     or (v_credential.counter > 0 and p_new_counter <= v_credential.counter)
  then return jsonb_build_object('ok', false, 'error', 'presence_counter_invalid'); end if;

  update aero_private.aero_presence_credentials
  set counter = p_new_counter, last_used_at = now()
  where id = v_credential.id;
  update aero_private.aero_presence_challenges set consumed_at = now() where id = v_challenge.id;

  if v_challenge.ceremony = 'credential_remove' then
    if v_challenge.target_id <> v_credential.id then
      return jsonb_build_object('ok', false, 'error', 'presence_target_changed');
    end if;
    update aero_private.aero_presence_credentials
    set revoked_at = now(), last_used_at = now()
    where id = v_credential.id;
    return jsonb_build_object('ok', true, 'removed', true, 'approvalMode', 'review-click');
  end if;

  if p_grant_token_hash !~ '^[0-9a-f]{64}$'
     or p_grant_expires_at <= now() or p_grant_expires_at > now() + interval '90 seconds'
  then return jsonb_build_object('ok', false, 'error', 'presence_grant_invalid'); end if;
  insert into aero_private.aero_presence_grants (
    user_id, credential_id, token_hash, target_type, target_id,
    contract_digest, approval_token_hash, expires_at
  ) values (
    p_user_id, v_credential.id, p_grant_token_hash, v_challenge.target_type,
    v_challenge.target_id, v_challenge.contract_digest,
    v_challenge.approval_token_hash, p_grant_expires_at
  ) returning * into v_grant;
  return jsonb_build_object(
    'ok', true, 'verified', true, 'grantId', v_grant.id,
    'targetType', v_grant.target_type, 'targetId', v_grant.target_id,
    'contractDigest', v_grant.contract_digest, 'expiresAt', v_grant.expires_at
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'presence_grant_conflict');
end
$$;

create or replace function aero_private.aero_lock_presence_grant(
  p_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_contract_digest text,
  p_approval_token_hash text,
  p_presence_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_grant aero_private.aero_presence_grants%rowtype;
begin
  if not aero_private.aero_presence_required(p_user_id) then
    return jsonb_build_object('ok', true, 'required', false, 'verified', false);
  end if;
  if p_presence_token_hash is null or p_presence_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'presence_required');
  end if;
  select * into v_grant from aero_private.aero_presence_grants
  where user_id = p_user_id and token_hash = p_presence_token_hash
    and target_type = p_target_type and target_id = p_target_id
    and contract_digest = p_contract_digest
    and approval_token_hash = p_approval_token_hash
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'presence_invalid'); end if;
  if v_grant.consumed_at is not null then
    return jsonb_build_object('ok', false, 'error', 'presence_replayed');
  end if;
  if v_grant.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'presence_expired');
  end if;
  return jsonb_build_object(
    'ok', true, 'required', true, 'verified', true,
    'grantId', v_grant.id, 'credentialId', v_grant.credential_id
  );
end
$$;

-- Move the pre-presence commit implementations out of the exposed RPC schema.
alter function public.aero_commit_run(uuid, uuid, text, text) rename to aero_commit_run_core;
alter function public.aero_commit_run_core(uuid, uuid, text, text) set schema aero_private;
alter function public.aero_commit_memory_transaction(uuid, uuid, text, text)
  rename to aero_commit_memory_transaction_core;
alter function public.aero_commit_memory_transaction_core(uuid, uuid, text, text)
  set schema aero_private;

create or replace function public.aero_commit_run(
  p_user_id uuid,
  p_run_id uuid,
  p_contract_digest text,
  p_approval_token_hash text,
  p_presence_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_presence jsonb;
  v_result jsonb;
  v_grant_id uuid;
  v_credential_id uuid;
  v_head text;
  v_presence_evidence jsonb;
  v_payload jsonb;
  v_certificate jsonb;
begin
  v_presence := aero_private.aero_lock_presence_grant(
    p_user_id, 'run', p_run_id, p_contract_digest,
    p_approval_token_hash, p_presence_token_hash
  );
  if not coalesce((v_presence->>'ok')::boolean, false) then return v_presence; end if;

  v_result := aero_private.aero_commit_run_core(
    p_user_id, p_run_id, p_contract_digest, p_approval_token_hash
  );
  if not coalesce((v_result->>'ok')::boolean, false) then return v_result; end if;

  if coalesce((v_presence->>'required')::boolean, false) then
    v_grant_id := (v_presence->>'grantId')::uuid;
    v_credential_id := (v_presence->>'credentialId')::uuid;
    update aero_private.aero_presence_grants set consumed_at = now() where id = v_grant_id;
    v_head := aero_private.aero_append_event(
      p_run_id, p_user_id, 'presence_verified',
      jsonb_build_object(
        'grantId', v_grant_id, 'credentialId', v_credential_id,
        'contractDigest', p_contract_digest, 'method', 'webauthn-uv'
      )
    );
    v_presence_evidence := jsonb_build_object(
      'required', true, 'verified', true, 'method', 'webauthn-uv',
      'credentialId', v_credential_id, 'grantId', v_grant_id, 'verifiedAt', now()
    );
  else
    v_head := v_result->'certificate'->'payload'->>'eventHeadDigest';
    v_presence_evidence := jsonb_build_object('required', false, 'verified', false);
  end if;

  v_payload := jsonb_set(v_result->'certificate'->'payload', '{eventHeadDigest}', to_jsonb(v_head), true);
  v_payload := jsonb_set(v_payload, '{presence}', v_presence_evidence, true);
  v_certificate := jsonb_build_object(
    'payload', v_payload,
    'digest', pg_catalog.encode(extensions.digest(v_payload::text, 'sha256'), 'hex')
  );
  update aero_private.aero_runs set completion_certificate = v_certificate, updated_at = now()
  where id = p_run_id and user_id = p_user_id;
  return jsonb_set(v_result, '{certificate}', v_certificate, true);
end
$$;

create or replace function public.aero_commit_memory_transaction(
  p_user_id uuid,
  p_transaction_id uuid,
  p_contract_digest text,
  p_approval_token_hash text,
  p_presence_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_presence jsonb;
  v_result jsonb;
  v_memory_requires_presence boolean;
  v_grant_id uuid;
  v_credential_id uuid;
  v_head text;
  v_presence_evidence jsonb;
  v_payload jsonb;
  v_certificate jsonb;
begin
  select exists (
    select 1 from aero_private.aero_memory_transactions transaction,
      jsonb_array_elements(transaction.operation) operation
    where transaction.id = p_transaction_id and transaction.user_id = p_user_id
      and operation->>'type' <> 'observe'
  ) into v_memory_requires_presence;
  if v_memory_requires_presence then
    v_presence := aero_private.aero_lock_presence_grant(
      p_user_id, 'memory', p_transaction_id, p_contract_digest,
      p_approval_token_hash, p_presence_token_hash
    );
  else
    v_presence := jsonb_build_object('ok', true, 'required', false, 'verified', false);
  end if;
  if not coalesce((v_presence->>'ok')::boolean, false) then return v_presence; end if;

  v_result := aero_private.aero_commit_memory_transaction_core(
    p_user_id, p_transaction_id, p_contract_digest, p_approval_token_hash
  );
  if not coalesce((v_result->>'ok')::boolean, false) then return v_result; end if;

  if coalesce((v_presence->>'required')::boolean, false) then
    v_grant_id := (v_presence->>'grantId')::uuid;
    v_credential_id := (v_presence->>'credentialId')::uuid;
    update aero_private.aero_presence_grants set consumed_at = now() where id = v_grant_id;
    v_head := aero_private.aero_append_memory_event(
      p_transaction_id, p_user_id, 'presence_verified',
      jsonb_build_object(
        'grantId', v_grant_id, 'credentialId', v_credential_id,
        'contractDigest', p_contract_digest, 'method', 'webauthn-uv'
      )
    );
    v_presence_evidence := jsonb_build_object(
      'required', true, 'verified', true, 'method', 'webauthn-uv',
      'credentialId', v_credential_id, 'grantId', v_grant_id, 'verifiedAt', now()
    );
  else
    v_head := v_result->'certificate'->'payload'->>'eventHeadDigest';
    v_presence_evidence := jsonb_build_object('required', false, 'verified', false);
  end if;

  v_payload := jsonb_set(v_result->'certificate'->'payload', '{eventHeadDigest}', to_jsonb(v_head), true);
  v_payload := jsonb_set(v_payload, '{presence}', v_presence_evidence, true);
  v_certificate := jsonb_build_object(
    'payload', v_payload,
    'digest', pg_catalog.encode(extensions.digest(v_payload::text, 'sha256'), 'hex')
  );
  update aero_private.aero_memory_transactions
  set completion_certificate = v_certificate, updated_at = now()
  where id = p_transaction_id and user_id = p_user_id;
  return jsonb_set(v_result, '{certificate}', v_certificate, true);
end
$$;

revoke all on function aero_private.aero_presence_required(uuid) from public, anon, authenticated;
revoke all on function aero_private.aero_lock_presence_grant(uuid, text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function aero_private.aero_commit_run_core(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function aero_private.aero_commit_memory_transaction_core(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function aero_private.aero_presence_required(uuid) to service_role;
grant execute on function aero_private.aero_lock_presence_grant(uuid, text, uuid, text, text, text) to service_role;
grant execute on function aero_private.aero_commit_run_core(uuid, uuid, text, text) to service_role;
grant execute on function aero_private.aero_commit_memory_transaction_core(uuid, uuid, text, text) to service_role;

revoke all on function public.aero_presence_status(uuid) from public, anon, authenticated;
revoke all on function public.aero_prepare_presence_challenge(uuid, uuid, text, text, text, uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.aero_read_presence_challenge(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.aero_complete_presence_registration(uuid, uuid, text, text, bigint, text[], text, boolean, text) from public, anon, authenticated;
revoke all on function public.aero_complete_presence_assertion(uuid, uuid, text, bigint, text, timestamptz) from public, anon, authenticated;
revoke all on function public.aero_commit_run(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.aero_commit_memory_transaction(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.aero_presence_status(uuid) to service_role;
grant execute on function public.aero_prepare_presence_challenge(uuid, uuid, text, text, text, uuid, text, text, timestamptz) to service_role;
grant execute on function public.aero_read_presence_challenge(uuid, uuid, text) to service_role;
grant execute on function public.aero_complete_presence_registration(uuid, uuid, text, text, bigint, text[], text, boolean, text) to service_role;
grant execute on function public.aero_complete_presence_assertion(uuid, uuid, text, bigint, text, timestamptz) to service_role;
grant execute on function public.aero_commit_run(uuid, uuid, text, text, text) to service_role;
grant execute on function public.aero_commit_memory_transaction(uuid, uuid, text, text, text) to service_role;

comment on table aero_private.aero_presence_credentials is
  'Private account-bound WebAuthn public keys for transaction approval; revoked credentials remain as audit evidence and are never exposed to browser roles.';
comment on table aero_private.aero_presence_challenges is
  'One-use WebAuthn challenges bound to one prepared contract and current approval token.';
comment on table aero_private.aero_presence_grants is
  'Short-lived one-use grants consumed atomically with the exact Aero commit.';
