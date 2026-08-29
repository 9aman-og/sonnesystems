-- Bind the validated Postgres bootstrap image to the Edge protocol's
-- canonical JSON digest before the account extends its memory ledger.

alter table aero_private.aero_memory_accounts
  add column if not exists canonical_digest_bound boolean not null default false;

create or replace function public.aero_bind_memory_canonical_digest(
  p_user_id uuid,
  p_revision bigint,
  p_canonical_digest text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account aero_private.aero_memory_accounts%rowtype;
begin
  if p_user_id is null
     or p_revision < 0
     or p_canonical_digest !~ '^[0-9a-f]{64}$'
  then
    return jsonb_build_object('ok', false, 'error', 'memory_binding_input');
  end if;

  perform aero_private.aero_ensure_memory_account(p_user_id);
  select * into strict v_account
  from aero_private.aero_memory_accounts
  where user_id = p_user_id
  for update;

  if v_account.state_storage_digest <> aero_private.aero_memory_state_digest(v_account.state)
     or not aero_private.aero_validate_memory_state(v_account.state)
     or coalesce((v_account.state->>'memoryRevision')::bigint, -1) <> v_account.revision
  then
    return jsonb_build_object('ok', false, 'error', 'memory_integrity_failed');
  end if;
  if v_account.revision <> p_revision then
    return jsonb_build_object('ok', false, 'error', 'memory_state_changed', 'currentRevision', v_account.revision);
  end if;
  if v_account.canonical_digest_bound then
    if v_account.state_digest <> p_canonical_digest then
      return jsonb_build_object('ok', false, 'error', 'memory_integrity_failed');
    end if;
  else
    update aero_private.aero_memory_accounts
    set state_digest = p_canonical_digest,
        canonical_digest_bound = true,
        updated_at = now()
    where user_id = p_user_id
    returning * into v_account;
  end if;

  return jsonb_build_object(
    'ok', true,
    'revision', v_account.revision,
    'stateDigest', v_account.state_digest,
    'canonicalDigestBound', v_account.canonical_digest_bound,
    'updatedAt', v_account.updated_at
  );
exception when no_data_found then
  return jsonb_build_object('ok', false, 'error', 'memory_state_missing');
end
$$;

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
    'canonicalDigestBound', v_account.canonical_digest_bound,
    'state', v_account.state,
    'updatedAt', v_account.updated_at
  );
exception when no_data_found then
  return jsonb_build_object('ok', false, 'error', 'memory_state_missing');
end
$$;

revoke all on function public.aero_bind_memory_canonical_digest(uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.aero_bind_memory_canonical_digest(uuid, bigint, text)
  to service_role;

comment on column aero_private.aero_memory_accounts.canonical_digest_bound is
  'True only after the Edge protocol has bound the storage-validated state to its canonical JSON digest.';
comment on function public.aero_bind_memory_canonical_digest(uuid, bigint, text) is
  'Service-only one-time binding between the Postgres bootstrap image and Aero canonical JSON integrity.';
