/* nourhan-portfolio · runtime config
 * ============================================================
 * HOW TO USE
 *   1. Copy this file:            config.example.js  →  config.js
 *   2. Create a BRAND-NEW Supabase project (do not reuse any old one).
 *   3. In the new project: Settings → API, copy the two values below.
 *   4. Paste them here. The anon key is public by design — safety
 *      comes from Row Level Security (see supabase/02_policies.sql).
 *
 * NEVER put the service_role key in this file or any client file.
 *
 * ------------------------------------------------------------
 * CONTACT FORM (both values are optional)
 *   CONTACT_ENDPOINT — a Formspree-compatible URL that accepts a
 *     form POST, e.g. 'https://formspree.io/f/abcdwxyz'. Create the
 *     form while signed in with the inbox that should receive the
 *     messages. With an endpoint set, the Contact form sends
 *     silently and shows its own success/failure feedback.
 *
 *   With CONTACT_ENDPOINT empty the form still works: it hands the
 *   message to the visitor's mail client, already addressed and
 *   filled in. Nothing is ever posted anywhere from the page.
 *
 *   CONTACT_EMAIL — where messages are addressed. Only change this
 *     if the inbox moves.
 * ------------------------------------------------------------
 */
window.ENV = {
  SUPABASE_URL: 'https://YOUR-NEW-PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-NEW-PROJECT-ANON-KEY',

  CONTACT_ENDPOINT: '',
  CONTACT_EMAIL: 'nourhanagag392003@gmail.com',
};
