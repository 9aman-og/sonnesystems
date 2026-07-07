/* ============================================================
   Lyfe cloud config.  PASTE YOUR SUPABASE PROJECT VALUES BELOW.

   Until BOTH fields are filled in, Lyfe runs local-only (guest),
   exactly as it did before, and nothing breaks. The moment you
   fill them in and redeploy, the sign-in screen and Google login
   turn on.

   Both values here are PUBLIC and safe to commit to a public repo.
   The anon key is designed to be shipped in the browser: your data
   is protected by Postgres row-level security (see schema.sql), not
   by hiding this key. NEVER put the "service_role" key here, that
   one is secret and server-only.

   Setup steps live in SETUP.md.
   ============================================================ */
window.LYFE_SUPABASE = {
  url: "",      // e.g. https://abcdefgh.supabase.co
  anonKey: ""   // the "anon / public" key from Project Settings > API
};
