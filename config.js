/* nourhan-portfolio · runtime config (COMMITTED ON PURPOSE)
 * ============================================================
 * This file ships with the site. A static page cannot read environment
 * variables, so the two values below have to be present in the deployed
 * build — every page loads this file with <script src="config.js">.
 *
 * Why that is safe:
 *   · SUPABASE_URL is public — it is the address the browser talks to.
 *   · SUPABASE_ANON_KEY is Supabase's PUBLISHABLE key (`sb_publishable_…`).
 *     It is designed to be visible in client code; safety does not come
 *     from hiding it but from Row Level Security. Verified against this
 *     project: anonymous reads return only published/visible rows, and
 *     every anonymous write is refused (a POST/PATCH that would change a
 *     row comes back 401 / 42501, or 200 with an empty representation).
 *
 * WHAT MUST NEVER BE ADDED HERE
 *   · the service_role key, or any key that bypasses RLS
 *   · any private token, password, or API secret
 * Anything in this file is world-readable in the browser and in the
 * public repository. If a future integration needs a secret, it must run
 * server-side, not in this file.
 *
 * The keys are not hard-coded in script.js or js/supabase-client.js by
 * design: those read window.ENV, so rotating the key means editing this
 * one file. config.example.js is the template for a fresh clone.
 * ============================================================ */
window.ENV = {
  SUPABASE_URL: 'https://gzyzquvghpevnmtqeqky.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_I67HXRkm7Bj5xU4BBqgGjg_kCP40GX-',
};
