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
