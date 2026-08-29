# Lyfe account setup

Lyfe works without an account in local guest mode. Signing in adds private
cloud sync across Lyfe and Lyfe Connect. The current setup uses the free tiers
of Supabase, Google OAuth, the Gmail API, and Gmail SMTP; billing is not
required.

## Current services

- Public app: `https://sonnesystems.com/lyfe/`
- Supabase project: `rfjqqixgevlgjeybeedw`
- Google Cloud project: `modern-cycling-505013-u1` (`Lyfe Ecosystem`)
- Permanent owner: the personal Google account
- BITS account: an allowed test/sign-in account, not the project owner

Keep the personal account as owner. A university account can be restricted or
closed by the institution, so it should only be a test user or normal Lyfe
account.

## What is enabled

- Google sign-in for Lyfe and Lyfe Connect
- Secure email sign-in with a six-digit code
- One shared account across both apps
- Private, per-user state protected by Supabase row-level security
- Optional read-only Gmail access
- Local guest mode and offline fallback

The browser contains only the Supabase project URL and publishable key. Never
put the Google client secret, a Gmail app password, the Supabase service-role
key, or any other private credential in this repository.

## Google OAuth

The Google OAuth client uses:

- JavaScript origin: `https://sonnesystems.com`
- Supabase callback:
  `https://rfjqqixgevlgjeybeedw.supabase.co/auth/v1/callback`
- App home: `https://sonnesystems.com/lyfe/`
- Privacy policy: `https://sonnesystems.com/lyfe/privacy.html`
- Gmail scope: `https://www.googleapis.com/auth/gmail.readonly`

The OAuth app is in testing while the product is private. Add approved Google
accounts under Google Auth Platform > Audience > Test users. Publishing Gmail
access publicly may require Google verification; testing does not require paid
billing.

## Supabase URLs

Authentication > URL Configuration should contain:

- Site URL: `https://sonnesystems.com/lyfe/`
- `https://sonnesystems.com/lyfe/**`
- `http://127.0.0.1:4173/lyfe/**`
- `http://localhost:8090/**`

Authentication > Providers > Google must stay enabled with the OAuth client ID
and client secret stored only in Supabase.

## Free email codes

Supabase's default free sender uses a magic link. To send a six-digit code,
enable custom SMTP with a Gmail app password:

- Host: `smtp.gmail.com`
- Port: `587`
- Username and sender: the personal Gmail address
- Password: a Google app password named `Lyfe SMTP`
- Sender name: `Lyfe`

The sign-in email template should include `{{ .Token }}` and use the subject
`Your Lyfe sign-in code`. Generate the app password in the owner's Google
Account after two-step verification. Store it only in Supabase and revoke it
from Google immediately if it is ever exposed.

## Database security

`schema.sql` creates `public.lyfe_states` and its row-level security policies.
Each user can read and update only their own row. Any new user-data table must
also have row-level security enabled before it is used by the website.

The client integration lives in `cloud.js`; the public connection values live
in `supabase-config.js`. If Supabase is unavailable, Lyfe falls back to local
guest data so the app still opens.

## Cost guardrail

Do not enable Google Cloud billing or upgrade Supabase without an explicit
decision. Check the free-tier usage dashboards before a public launch and keep
email resend limits in place to prevent abuse.

## Aero Groq gateway

Supabase Vault is the only place that may hold the production Groq API key.
It requires a valid Supabase user JWT whose immutable user ID is listed in the private
`aero_allowed_user_ids` Vault secret. The Edge Function reads both values over its
private database connection. The public Lyfe bundle contains only the Supabase
publishable key.

Required encrypted Vault secrets:

- `aero_groq_api_key`: a Groq Console API key
- `aero_allowed_user_ids`: comma-separated immutable Supabase Auth user IDs

`GROQ_API_KEY` and `AERO_ALLOWED_USER_IDS` environment variables remain supported
for local development only. The hosted model defaults to `openai/gpt-oss-120b`.

Keep Groq on its Free plan without a payment method and keep the Supabase
organization on its Free plan. Do not enable a paid developer tier, prepaid
credits, billing, add-ons, or a Supabase upgrade. When either free quota is
exhausted, the cloud request must fail and Aero must use its local fallback.

The function accepts only the current prompt, date, and intent family. It has
an origin allowlist, input limits, a per-user burst limit, a fixed model,
structured output validation, a 25-second timeout, and no prompt logging.
Deploy with JWT verification enabled. Do not configure this function as public.

## Aero signed-in execution rollout

`aero-execute` is separate from the model gateway. It never calls a model. It
accepts only the eight reversible Lyfe record operations, verifies the signed-in
user again with Supabase Auth, and invokes service-role-only database functions
that bind an exact target to the current Lyfe revision. The service-role key is
provided to hosted Edge Functions by Supabase and must never be copied into
`supabase-config.js`, a frontend environment, a log, or source control.

Roll out in this order so an old or partially deployed client cannot enter the
new path:

```powershell
supabase login
supabase link --project-ref rfjqqixgevlgjeybeedw
supabase db push --linked --dry-run
supabase db push --linked
supabase db advisors --linked --type security --level warn --fail-on error
supabase db advisors --linked --type performance --level warn --fail-on error
supabase functions deploy aero-execute --project-ref rfjqqixgevlgjeybeedw --use-api
```

Do not pass `--no-verify-jwt`. Before the database push, run the repository CI
tests and `deno check supabase/functions/aero-execute/index.ts`. After deploying,
test prepare, cancel, exact commit, replay denial, revision conflict, journal
inspection, and privacy deletion with the approved account. Only then change
`aeroExecutionEnabled` to `true` in `supabase-config.js` and publish Lyfe.

The migration keeps run data in the non-exposed `aero_private` schema with RLS,
grants journal mutation only to `service_role`, and adds a revision trigger plus
compare-and-swap RPC for ordinary signed-in Lyfe sync. Prepared plans retain an
exact target only during their two-minute approval window. Completed, stale,
and cancelled runs retain
digests and a minimal receipt, not a duplicated Lyfe document. This rollout uses
Supabase Free and does not require billing.

Production status (29 August 2026): both migrations are applied, the CAS runs
under caller RLS authority, `aero-execute` v1 is active with JWT verification,
and the private allowlisted client flag is enabled. Live account smoke tests
passed prepare/cancel, exact atomic commit, replay denial, stale-revision
rejection, inspection, and privacy deletion. Re-run the same gates after any
protocol, schema, authorization, or state-sync change.

## Aero signed-in memory rollout

`aero-memory` is separate from both the model gateway and the Lyfe record
executor. It reads and writes only the authenticated account's private typed
memory. The Edge Function closes the operation schema; service-role-only RPCs
then prepare and commit one exact target against the current memory revision.
The browser never receives the service-role key and never becomes the signed-in
source of truth.

Deploy the migration before the function, keep JWT verification on, run the
server protocol and migration tests, then enable `aeroMemoryEnabled` in
`supabase-config.js`. Verify read/bootstrap, prepare/cancel, commit, replay
denial, stale-state rejection, feedback observation, privacy forget/reset, raw
target redaction, and zero grants to `anon` or `authenticated` before release.

Production status (29 August 2026): `aero_server_owned_memory` and the
canonical-digest binding migration are applied. `aero-memory` v2 is active with
JWT verification. A rollback-only production transaction passed exact
prepare/commit, relational projection, event-chain
validation, terminal redaction, one-use token consumption, and replay denial.
The route rejects missing authentication with HTTP 401, consumer roles have no
memory-RPC grants, and no disposable account memory was retained by verification.
