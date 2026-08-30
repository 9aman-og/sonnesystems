-- Production-safe transaction-bound presence smoke.
-- Execute the complete file as one query. Every disposable user, credential,
-- challenge, grant, run, event, and Lyfe state is removed by the final ROLLBACK.

begin;

create temporary table aero_presence_atomic_result (
  result jsonb not null
) on commit drop;

do $$
declare
  v_user constant uuid := 'e7e6e5e4-e3e2-4e10-8e0e-0d0c0b0a0908';
  v_run_a constant uuid := 'aaaaaaaa-1111-4111-8111-111111111111';
  v_run_b constant uuid := 'bbbbbbbb-2222-4222-8222-222222222222';
  v_registration_challenge constant uuid := 'cccccccc-3333-4333-8333-333333333333';
  v_approval_challenge constant uuid := 'dddddddd-4444-4444-8444-444444444444';
  v_removal_challenge constant uuid := 'eeeeeeee-5555-4555-8555-555555555555';
  v_contract_a constant text := repeat('a', 64);
  v_contract_b constant text := repeat('b', 64);
  v_approval_a constant text := repeat('1', 64);
  v_approval_b constant text := repeat('2', 64);
  v_presence constant text := repeat('3', 64);
  v_wrong_presence constant text := repeat('4', 64);
  v_credential_external constant text := repeat('C', 32);
  v_state_1 jsonb := '{"rev":1,"tasks":[],"notes":[],"docs":[],"worklog":[],"goals":[],"education":[],"projects":[]}'::jsonb;
  v_state_2 jsonb;
  v_state_3 jsonb;
  v_prepare_a jsonb;
  v_commit_a jsonb;
  v_prepare_registration jsonb;
  v_registration jsonb;
  v_prepare_b jsonb;
  v_missing_presence jsonb;
  v_wrong_binding jsonb;
  v_prepare_approval jsonb;
  v_assertion jsonb;
  v_wrong_token jsonb;
  v_commit_b jsonb;
  v_replay jsonb;
  v_inspect jsonb;
  v_credential uuid;
  v_grant uuid;
  v_prepare_removal jsonb;
  v_removal jsonb;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user,
    'authenticated', 'authenticated', 'aero-presence-rollback@invalid.example',
    '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', ''
  );
  insert into public.lyfe_states (user_id, data, rev) values (v_user, v_state_1, 1);

  v_state_2 := jsonb_set(
    jsonb_set(v_state_1, '{rev}', '2'::jsonb, true),
    '{tasks}', '[{"id":"presence-a","title":"Legacy reviewed change","done":false}]'::jsonb, true
  );
  v_prepare_a := public.aero_prepare_run(
    v_run_a, v_user, 'presence-rollback-a',
    jsonb_build_object('protocol', 'aero-supabase-v0.1', 'runId', v_run_a, 'accountId', v_user),
    v_contract_a, 1, repeat('5', 64), v_state_2, repeat('6', 64),
    '[{"op":"add","path":"tasks"}]'::jsonb,
    '[{"stepId":"step-1","type":"add_task","capability":"lyfe.tasks.create","acceptance":"One matching open task exists."}]'::jsonb,
    v_approval_a, now() + interval '2 minutes'
  );
  v_commit_a := public.aero_commit_run(v_user, v_run_a, v_contract_a, v_approval_a, null);
  if not coalesce((v_prepare_a->>'ok')::boolean, false)
     or not coalesce((v_commit_a->>'ok')::boolean, false)
     or coalesce((v_commit_a#>>'{certificate,payload,presence,required}')::boolean, true)
  then raise exception 'unenrolled exact approval regression: %, %', v_prepare_a, v_commit_a; end if;

  v_prepare_registration := public.aero_prepare_presence_challenge(
    v_user, v_registration_challenge, 'registration', repeat('R', 43),
    null, null, null, null, now() + interval '5 minutes'
  );
  v_registration := public.aero_complete_presence_registration(
    v_user, v_registration_challenge, v_credential_external, repeat('P', 64),
    0, array['internal']::text[], 'singleDevice', false, 'Disposable device'
  );
  if not coalesce((v_prepare_registration->>'ok')::boolean, false)
     or not coalesce((v_registration->>'ok')::boolean, false)
  then raise exception 'presence registration persistence failed: %, %', v_prepare_registration, v_registration; end if;
  select id into strict v_credential from aero_private.aero_presence_credentials where user_id = v_user;

  v_state_3 := jsonb_set(
    jsonb_set(v_state_2, '{rev}', '3'::jsonb, true),
    '{tasks}', (v_state_2->'tasks') || '[{"id":"presence-b","title":"Device verified change","done":false}]'::jsonb, true
  );
  v_prepare_b := public.aero_prepare_run(
    v_run_b, v_user, 'presence-rollback-b',
    jsonb_build_object('protocol', 'aero-supabase-v0.1', 'runId', v_run_b, 'accountId', v_user),
    v_contract_b, 2, repeat('6', 64), v_state_3, repeat('7', 64),
    '[{"op":"add","path":"tasks"}]'::jsonb,
    '[{"stepId":"step-1","type":"add_task","capability":"lyfe.tasks.create","acceptance":"One matching open task exists."}]'::jsonb,
    v_approval_b, now() + interval '2 minutes'
  );
  v_missing_presence := public.aero_commit_run(v_user, v_run_b, v_contract_b, v_approval_b, null);
  if v_missing_presence->>'error' <> 'presence_required'
     or (select rev from public.lyfe_states where user_id = v_user) <> 2
  then raise exception 'missing presence did not fail closed: %', v_missing_presence; end if;

  v_wrong_binding := public.aero_prepare_presence_challenge(
    v_user, gen_random_uuid(), 'approval', repeat('W', 43),
    'run', v_run_b, v_contract_b, repeat('9', 64), now() + interval '5 minutes'
  );
  if v_wrong_binding->>'error' <> 'presence_target_changed' then
    raise exception 'wrong approval binding accepted: %', v_wrong_binding;
  end if;

  v_prepare_approval := public.aero_prepare_presence_challenge(
    v_user, v_approval_challenge, 'approval', repeat('A', 43),
    'run', v_run_b, v_contract_b, v_approval_b, now() + interval '5 minutes'
  );
  v_assertion := public.aero_complete_presence_assertion(
    v_user, v_approval_challenge, v_credential_external, 1,
    v_presence, now() + interval '60 seconds'
  );
  if not coalesce((v_prepare_approval->>'ok')::boolean, false)
     or not coalesce((v_assertion->>'ok')::boolean, false)
  then raise exception 'bound assertion persistence failed: %, %', v_prepare_approval, v_assertion; end if;
  v_grant := (v_assertion->>'grantId')::uuid;

  v_wrong_token := public.aero_commit_run(v_user, v_run_b, v_contract_b, v_approval_b, v_wrong_presence);
  if v_wrong_token->>'error' <> 'presence_invalid'
     or (select consumed_at is not null from aero_private.aero_presence_grants where id = v_grant)
     or (select rev from public.lyfe_states where user_id = v_user) <> 2
  then raise exception 'wrong presence token changed state: %', v_wrong_token; end if;

  v_commit_b := public.aero_commit_run(v_user, v_run_b, v_contract_b, v_approval_b, v_presence);
  if not coalesce((v_commit_b->>'ok')::boolean, false)
     or not coalesce((v_commit_b#>>'{certificate,payload,presence,required}')::boolean, false)
     or not coalesce((v_commit_b#>>'{certificate,payload,presence,verified}')::boolean, false)
     or v_commit_b#>>'{certificate,payload,presence,method}' <> 'webauthn-uv'
     or not (select consumed_at is not null from aero_private.aero_presence_grants where id = v_grant)
     or (select rev from public.lyfe_states where user_id = v_user) <> 3
  then raise exception 'atomic verified commit failed: %', v_commit_b; end if;

  v_replay := public.aero_commit_run(v_user, v_run_b, v_contract_b, v_approval_b, v_presence);
  if v_replay->>'error' <> 'presence_replayed' then
    raise exception 'presence replay was not rejected: %', v_replay;
  end if;
  v_inspect := public.aero_inspect_run(v_user, v_run_b);
  if not coalesce((v_inspect->>'journalValid')::boolean, false)
     or not coalesce((v_inspect->>'payloadValid')::boolean, false)
     or coalesce((v_inspect->>'eventSequence')::integer, 0) < 3
  then raise exception 'presence completion evidence invalid: %', v_inspect; end if;

  v_prepare_removal := public.aero_prepare_presence_challenge(
    v_user, v_removal_challenge, 'credential_remove', repeat('D', 43),
    'credential', v_credential, repeat('8', 64), null, now() + interval '5 minutes'
  );
  v_removal := public.aero_complete_presence_assertion(
    v_user, v_removal_challenge, v_credential_external, 2, null, null
  );
  if not coalesce((v_prepare_removal->>'ok')::boolean, false)
     or not coalesce((v_removal->>'ok')::boolean, false)
     or aero_private.aero_presence_required(v_user)
  then raise exception 'verified credential removal failed: %, %', v_prepare_removal, v_removal; end if;
  if not exists (
       select 1 from aero_private.aero_presence_credentials
       where id = v_credential and user_id = v_user and revoked_at is not null
     )
     or not exists (
       select 1 from aero_private.aero_presence_grants
       where id = v_grant and user_id = v_user and consumed_at is not null
     )
  then raise exception 'presence audit evidence was erased on revocation'; end if;

  insert into aero_presence_atomic_result(result)
  values (jsonb_build_object(
    'ok', true,
    'unenrolledReviewStillWorks', true,
    'enrolledCommitWithoutPresenceRejected', true,
    'wrongApprovalBindingRejected', true,
    'wrongPresenceTokenChangedNothing', true,
    'presenceAndTargetCommittedAtomically', true,
    'presenceEvidenceCertified', true,
    'presenceReplayRejected', true,
    'verifiedRemovalWorked', true,
    'auditEvidencePreservedOnRevocation', true,
    'rollbackOnly', true
  ));
end
$$;

select result from aero_presence_atomic_result;

rollback;
