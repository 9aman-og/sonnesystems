-- PostgreSQL's ARE engine rejects bounded repetitions whose upper bound is
-- greater than 255. Keep byte-shape validation in the regex and enforce the
-- protocol limits with explicit character lengths instead.

alter table aero_private.aero_presence_credentials
  drop constraint if exists aero_presence_credential_id_format,
  add constraint aero_presence_credential_id_format
    check (char_length(credential_id) between 16 and 1024
      and credential_id ~ '^[A-Za-z0-9_-]+$'),
  drop constraint if exists aero_presence_public_key_format,
  add constraint aero_presence_public_key_format
    check (char_length(public_key) between 16 and 4096
      and public_key ~ '^[A-Za-z0-9_-]+$');

alter table aero_private.aero_presence_challenges
  drop constraint if exists aero_presence_challenge_format,
  add constraint aero_presence_challenge_format
    check (char_length(challenge) between 32 and 256
      and challenge ~ '^[A-Za-z0-9_-]+$');

create index if not exists aero_presence_grants_credential_idx
  on aero_private.aero_presence_grants (credential_id);

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
    where id = p_target_id and user_id = p_user_id for update;
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

comment on function public.aero_prepare_presence_challenge(uuid, uuid, text, text, text, uuid, text, text, timestamptz) is
  'Creates a short-lived WebAuthn challenge after validating explicit protocol lengths without unsupported regex repetitions.';
