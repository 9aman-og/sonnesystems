-- Production-safe concurrency and crash/resume smoke for Aero memory.
-- The caller must execute the complete file as one query. The final ROLLBACK
-- removes the disposable auth user, memory account, transactions, and events.

begin;

create temporary table aero_memory_concurrency_result (
  result jsonb not null
) on commit drop;

do $$
declare
  v_user constant uuid := 'f7f6f5f4-f3f2-4f10-8f0e-0d0c0b0a0908';
  v_tx_a constant uuid := '11111111-aaaa-4111-8111-111111111111';
  v_tx_b constant uuid := '22222222-bbbb-4222-8222-222222222222';
  v_tx_c constant uuid := '33333333-cccc-4333-8333-333333333333';
  v_tx_c_retry constant uuid := '44444444-dddd-4444-8444-444444444444';
  v_digest_0 constant text := repeat('a', 64);
  v_digest_1 constant text := repeat('b', 64);
  v_digest_2 constant text := repeat('c', 64);
  v_token_a constant text := repeat('1', 64);
  v_token_b constant text := repeat('2', 64);
  v_token_c_old constant text := repeat('3', 64);
  v_token_c_new constant text := repeat('4', 64);
  v_state_0 jsonb;
  v_state_1 jsonb;
  v_state_2 jsonb;
  v_ops_a jsonb := '[{"type":"remember","claim":"Disposable concurrent target A"}]'::jsonb;
  v_ops_b jsonb := '[{"type":"remember","claim":"Disposable concurrent target B"}]'::jsonb;
  v_ops_c jsonb := '[{"type":"observe","episode":{"id":"disposable-crash-resume"},"outcome":"helpful"}]'::jsonb;
  v_contract_a jsonb;
  v_contract_b jsonb;
  v_contract_c jsonb;
  v_prepare_a jsonb;
  v_prepare_b jsonb;
  v_commit_a jsonb;
  v_commit_b jsonb;
  v_replay_a jsonb;
  v_prepare_c jsonb;
  v_resume_c jsonb;
  v_old_token_c jsonb;
  v_commit_c jsonb;
  v_inspect_b jsonb;
  v_inspect_c jsonb;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user,
    'authenticated', 'authenticated', 'aero-memory-rollback@invalid.example',
    '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', ''
  );

  perform aero_private.aero_ensure_memory_account(v_user);
  select state into strict v_state_0
  from aero_private.aero_memory_accounts
  where user_id = v_user;

  if not coalesce((public.aero_bind_memory_canonical_digest(v_user, 0, v_digest_0)->>'ok')::boolean, false) then
    raise exception 'canonical bootstrap binding failed';
  end if;

  v_state_1 := jsonb_set(v_state_0, '{memoryRevision}', '1'::jsonb, true);
  v_contract_a := jsonb_build_object(
    'protocol', 'aero-memory-v0.3', 'accountId', v_user::text,
    'requestKey', 'rollback-concurrent-a', 'operations', v_ops_a,
    'state', jsonb_build_object('baseRevision', 0, 'beforeDigest', v_digest_0),
    'target', jsonb_build_object('nextRevision', 1, 'digest', v_digest_1)
  );
  v_contract_b := jsonb_build_object(
    'protocol', 'aero-memory-v0.3', 'accountId', v_user::text,
    'requestKey', 'rollback-concurrent-b', 'operations', v_ops_b,
    'state', jsonb_build_object('baseRevision', 0, 'beforeDigest', v_digest_0),
    'target', jsonb_build_object('nextRevision', 1, 'digest', v_digest_1)
  );

  v_prepare_a := public.aero_prepare_memory_transaction(
    v_tx_a, v_user, 'rollback-concurrent-a', v_ops_a, repeat('d', 64),
    v_contract_a, repeat('e', 64), 0, v_digest_0, v_state_1, v_digest_1,
    '[{"type":"memory_upsert","authority":"user-explicit"}]'::jsonb,
    v_token_a, now() + interval '2 minutes'
  );
  v_prepare_b := public.aero_prepare_memory_transaction(
    v_tx_b, v_user, 'rollback-concurrent-b', v_ops_b, repeat('f', 64),
    v_contract_b, repeat('0', 64), 0, v_digest_0, v_state_1, v_digest_1,
    '[{"type":"memory_upsert","authority":"user-explicit"}]'::jsonb,
    v_token_b, now() + interval '2 minutes'
  );
  if not coalesce((v_prepare_a->>'ok')::boolean, false)
     or not coalesce((v_prepare_b->>'ok')::boolean, false)
  then raise exception 'concurrent prepare failed: %, %', v_prepare_a, v_prepare_b; end if;

  v_commit_a := public.aero_commit_memory_transaction(v_user, v_tx_a, repeat('e', 64), v_token_a);
  v_commit_b := public.aero_commit_memory_transaction(v_user, v_tx_b, repeat('0', 64), v_token_b);
  v_replay_a := public.aero_commit_memory_transaction(v_user, v_tx_a, repeat('e', 64), v_token_a);
  if not coalesce((v_commit_a->>'ok')::boolean, false)
     or v_commit_b->>'error' <> 'memory_state_changed'
     or v_replay_a->>'error' <> 'memory_approval_replayed'
  then raise exception 'concurrency/replay invariant failed: %, %, %', v_commit_a, v_commit_b, v_replay_a; end if;

  v_inspect_b := public.aero_inspect_memory_transaction(v_user, v_tx_b);
  if v_inspect_b->>'status' <> 'stale'
     or not coalesce((v_inspect_b->>'journalValid')::boolean, false)
     or not coalesce((v_inspect_b->>'payloadValid')::boolean, false)
  then raise exception 'stale transaction evidence failed: %', v_inspect_b; end if;

  v_state_2 := jsonb_set(v_state_1, '{memoryRevision}', '2'::jsonb, true);
  v_contract_c := jsonb_build_object(
    'protocol', 'aero-memory-v0.3', 'accountId', v_user::text,
    'requestKey', 'rollback-crash-resume-c', 'operations', v_ops_c,
    'state', jsonb_build_object('baseRevision', 1, 'beforeDigest', v_digest_1),
    'target', jsonb_build_object('nextRevision', 2, 'digest', v_digest_2)
  );
  v_prepare_c := public.aero_prepare_memory_transaction(
    v_tx_c, v_user, 'rollback-crash-resume-c', v_ops_c, repeat('5', 64),
    v_contract_c, repeat('6', 64), 1, v_digest_1, v_state_2, v_digest_2,
    '[{"type":"memory_observe","authority":"behavior-only"}]'::jsonb,
    v_token_c_old, now() + interval '2 minutes'
  );
  -- Simulate a fresh process resuming the same request with a new transaction
  -- ID and approval token. The database must return the original transaction.
  v_resume_c := public.aero_prepare_memory_transaction(
    v_tx_c_retry, v_user, 'rollback-crash-resume-c', v_ops_c, repeat('5', 64),
    v_contract_c, repeat('6', 64), 1, v_digest_1, v_state_2, v_digest_2,
    '[{"type":"memory_observe","authority":"behavior-only"}]'::jsonb,
    v_token_c_new, now() + interval '2 minutes'
  );
  if not coalesce((v_prepare_c->>'ok')::boolean, false)
     or not coalesce((v_resume_c->>'ok')::boolean, false)
     or not coalesce((v_resume_c->>'idempotent')::boolean, false)
     or v_resume_c->>'transactionId' <> v_tx_c::text
  then raise exception 'crash resume prepare failed: %, %', v_prepare_c, v_resume_c; end if;

  v_old_token_c := public.aero_commit_memory_transaction(v_user, v_tx_c, repeat('6', 64), v_token_c_old);
  v_commit_c := public.aero_commit_memory_transaction(v_user, v_tx_c, repeat('6', 64), v_token_c_new);
  if v_old_token_c->>'error' <> 'memory_approval_invalid'
     or not coalesce((v_commit_c->>'ok')::boolean, false)
  then raise exception 'crash resume authority failed: %, %', v_old_token_c, v_commit_c; end if;

  v_inspect_c := public.aero_inspect_memory_transaction(v_user, v_tx_c);
  if v_inspect_c->>'status' <> 'completed'
     or not coalesce((v_inspect_c->>'journalValid')::boolean, false)
     or not coalesce((v_inspect_c->>'payloadValid')::boolean, false)
     or coalesce((v_inspect_c->>'eventSequence')::integer, 0) < 3
  then raise exception 'resumed transaction evidence failed: %', v_inspect_c; end if;

  insert into aero_memory_concurrency_result(result)
  values (jsonb_build_object(
    'ok', true,
    'concurrentWinnerCommitted', true,
    'concurrentLoserRejectedStale', true,
    'replayRejected', true,
    'crashResumeReturnedOriginalTransaction', true,
    'oldApprovalRejectedAfterResume', true,
    'resumedCommitCertified', true,
    'rollbackOnly', true
  ));
end
$$;

select result from aero_memory_concurrency_result;

rollback;
