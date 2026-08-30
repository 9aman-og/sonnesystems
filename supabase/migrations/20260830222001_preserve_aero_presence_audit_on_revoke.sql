-- A verified device removal must stop future assertions without erasing the
-- grant rows and certificate evidence produced by earlier approved actions.

alter table aero_private.aero_presence_credentials
  add column if not exists revoked_at timestamptz;

alter table aero_private.aero_presence_credentials
  drop constraint if exists aero_presence_credentials_user_id_key;

create unique index if not exists aero_presence_credentials_one_active_user_idx
  on aero_private.aero_presence_credentials (user_id)
  where revoked_at is null;

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

comment on column aero_private.aero_presence_credentials.revoked_at is
  'Set only after a verified credential-removal assertion; revoked credentials cannot authorize future actions.';
comment on table aero_private.aero_presence_credentials is
  'Private account-bound WebAuthn public keys; revoked rows remain so historical grants and approval evidence stay auditable.';
