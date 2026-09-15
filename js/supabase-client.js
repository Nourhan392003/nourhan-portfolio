/* nourhan-portfolio · shared Supabase client
 * Requires (in this order, before this file):
 *   js/vendor/supabase.js   (vendored supabase-js UMD)
 *   config.js               (window.ENV — see config.example.js)
 *
 * Exposes: window.NP = { sb, isConfigured }
 */
(function () {
  'use strict';

  var env = window.ENV || {};
  var url = (env.SUPABASE_URL || '').trim();
  var key = (env.SUPABASE_ANON_KEY || '').trim();

  var configured =
    !!url &&
    !!key &&
    url.indexOf('YOUR-NEW-PROJECT-REF') === -1 &&
    key.indexOf('YOUR-NEW-PROJECT') === -1 &&
    typeof window.supabase !== 'undefined' &&
    typeof window.supabase.createClient === 'function';

  var client = null;
  if (configured) {
    try {
      client = window.supabase.createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
    } catch (err) {
      console.error('[nourhan-portfolio] Supabase init failed:', err);
    }
  }

  window.NP = {
    sb: client,
    isConfigured: function () {
      return !!client;
    },
  };
})();
