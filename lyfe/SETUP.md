# Lyfe accounts + cloud sync: setup

Lyfe works with zero setup as a local-only app (guest mode). This guide turns on
**Google sign-in** and **per-user cloud sync** so your data follows you across
devices. It takes about 20 minutes and only needs a free Supabase account and a
Google Cloud project.

Until you finish step 6, Lyfe keeps running exactly as it does today. Nothing
breaks while it is half-configured.

---

## What you are building

- A **Postgres database** (hosted by Supabase) with one row per user.
- **Google sign-in** (and a plain "continue as guest" option).
- **Row-level security**: the database itself guarantees each account can only
  ever read or write its own row. Even though the key in the app is public, no
  one can reach anyone else's data.

Your Anthropic API key (if you use the Claude brain for Sol) is deliberately
**never** uploaded. It stays on the device where you typed it.

---

## Step 1 - Create the Supabase project

1. Go to https://supabase.com, sign in, **New project**.
2. Pick a name and a strong database password (save it in your password
   manager), choose the region closest to you, create it.
3. Wait for it to finish provisioning (about a minute).

## Step 2 - Create the tables

1. In the project, open **SQL Editor > New query**.
2. Open `schema.sql` from this folder, copy all of it, paste, click **Run**.
3. You should see "Success. No rows returned." That created the `lyfe_states`
   table and its security policies.
4. Sanity check: **Table Editor** should now list `lyfe_states`, and
   **Authentication > Policies** should show three policies on it. If the table
   ever shows an "RLS disabled" warning, re-run `schema.sql`. RLS being on is
   what keeps the data private.

## Step 3 - Create Google OAuth credentials

1. Go to https://console.cloud.google.com, create (or pick) a project.
2. Open **Google Auth Platform**. Complete **Branding**, set the audience to
   **External**, and add your own Google address as a test user while the app is
   in testing mode.
3. Under **Data Access**, confirm the `openid`, email, and profile scopes are
   enabled. Supabase needs those three basic identity scopes.
4. Open **Clients > Create client** and choose **Web application**:
   - Under **Authorized JavaScript origins**, add every origin that hosts Lyfe,
     such as `https://sonnesystems.com` and `http://localhost:4173`.
   - **Authorized redirect URI**: paste your Supabase callback, which is
     `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
     (find YOUR-PROJECT-REF in Supabase under **Project Settings > API >
     Project URL**).
   - Create it, then copy the **Client ID** and **Client secret**.

## Step 4 - Connect Google to Supabase

1. In Supabase: **Authentication > Providers > Google**.
2. Toggle it on, paste the **Client ID** and **Client secret** from step 3, save.

## Step 5 - Tell Supabase which site can log in

1. In Supabase: **Authentication > URL Configuration**.
2. Set **Site URL** to `https://9aman-og.github.io/lyfe/`.
3. Under **Redirect URLs**, add each place Lyfe runs:
   - `https://9aman-og.github.io/lyfe/`
   - `https://sonnesystems.com/lyfe/`
   - `http://localhost:4173/` (only if you test locally)
4. Save.

## Step 6 - Paste your keys into Lyfe

1. In Supabase: **Project Settings > API**. Copy the **Project URL** and the
   **publishable** key. A legacy anon/public key also works. Never use the
   service-role or secret key in browser code.
2. Open `supabase-config.js` in this folder and fill both fields:
   ```js
   window.LYFE_SUPABASE = {
     url: "https://YOUR-PROJECT-REF.supabase.co",
     anonKey: "sb_publishable_..."
   };
   ```
3. Commit and push (or just re-upload the folder). Sign-in is now live.

That is it. Open Lyfe: you will see the login screen. "Continue with Google"
signs you in and starts syncing; "Continue as guest" keeps that session on the
device only.

---

## Lyfe runs in two places

Lyfe is deployed twice:

- **Canonical:** the `lyfe` repo, live at `https://9aman-og.github.io/lyfe/`.
- **Mirror:** a copy under `web/lyfe/` in the `sonnesystems` repo, live at
  `https://sonnesystems.com/lyfe/`.

Edit the canonical copy, then resync the mirror before pushing the site:

```
robocopy G:\CLAUDE\lyfe G:\CLAUDE\web\lyfe /MIR /XD .git
```

That is why step 5 lists both origins as redirect URLs. If you ever stop using
the sonnesystems.com/lyfe mirror, delete `web/lyfe/` and drop that redirect URL.

## For whoever maintains this later

- **Where the code is.** `cloud.js` is the whole client integration (auth +
  sync). `app.js` calls it from three places: boot (`resolveAuthAndBoot`), every
  save (`save()` pushes when signed in), and the login screen buttons. Search
  `LyfeCloud` and `CLOUD_MODE` in `app.js`.
- **Data shape.** Each user is one JSONB blob in `public.lyfe_states.data`, the
  same object Lyfe keeps in `localStorage`. A `rev` counter (also used for the
  multi-tab guard) provides last-writer-wins ordering. If you ever need to query
  inside the data (e.g. "all tasks due today across users"), that is the point to
  normalise into real tables; nothing else depends on the blob shape except
  `normalize()` in `app.js`.
- **Security model.** The anon key is public on purpose. All access control is
  the three RLS policies in `schema.sql` (`auth.uid() = user_id`). If you add
  tables, enable RLS on them too or they are wide open. Never ship the
  `service_role` key to the browser.
- **Offline + failure behaviour.** If Supabase or the CDN is unreachable, the
  app falls back to local guest mode and still opens. Signed-in devices keep a
  local cache under `lyfe.cloud.<userId>`, so a dropped connection does not lose
  work; the next successful save re-pushes.
- **Rotating keys.** The anon key rarely needs rotating (it is public). If you
  must, regenerate in Supabase and update `supabase-config.js`. To revoke a
  user, delete them in **Authentication > Users**; their row cascades away.
- **Cost.** The Supabase free tier covers a personal app comfortably. Watch the
  monthly active users and database size in the dashboard if it grows.
