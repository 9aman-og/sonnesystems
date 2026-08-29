-- The caller already has SELECT/INSERT/UPDATE on lyfe_states and the owner-only
-- RLS policy applies to every row touched here. Run the compare-and-swap under
-- caller authority so the function cannot accidentally grow into a privilege
-- escalation surface as its implementation evolves.
alter function public.lyfe_compare_and_swap_state(bigint, jsonb)
  security invoker;

comment on function public.lyfe_compare_and_swap_state(bigint, jsonb) is
  'Atomically advances one signed-in user Lyfe document by exactly one revision under caller RLS.';
