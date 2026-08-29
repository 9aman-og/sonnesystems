/* ============================================================
   Lyfe's public Supabase connection.

   Both values below are intentionally public browser credentials.
   User data is protected by Postgres row-level security (schema.sql),
   not by hiding this key. Never place the service-role key, Google
   client secret, or SMTP password in this file.

   Setup and recovery notes live in SETUP.md.
   ============================================================ */
window.LYFE_SUPABASE = {
  url: "https://rfjqqixgevlgjeybeedw.supabase.co",
  anonKey: "sb_publishable_VsN4Zi5m-oCca-2ZVJ9Ung_r6vv9wHa",
  // Google OAuth is configured in Supabase. Email sign-in remains available.
  googleEnabled: true,
  // Calls an authenticated Edge Function. No provider secret is public here.
  aeroGatewayEnabled: true,
  // Private, JWT-verified, account-allowlisted execution for reversible Lyfe
  // record changes. The server still fails closed if any invariant is missing.
  aeroExecutionEnabled: true,
  // Server-owned typed memory. Browser memory is only a read-through display
  // cache for a signed-in account; explicit changes require one exact review.
  aeroMemoryEnabled: true
};
