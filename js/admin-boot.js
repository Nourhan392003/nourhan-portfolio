/* nourhan-portfolio · admin boot
 * Extracted from admin.html so the Content-Security-Policy can stay strict:
 * script-src never needs 'unsafe-inline'. Mirrors js/boot.js on the public
 * pages — same job, smaller scope.
 *
 * Runs after js/admin-content.js (see the order in admin.html) and starts
 * the content editors once the DOM is ready. init() failure is contained:
 * the rest of the admin (login, projects, uploads) keeps working.
 */
(function () {
  'use strict';

  function start() {
    if (window.NPContentAdmin && typeof window.NPContentAdmin.init === 'function') {
      try {
        window.NPContentAdmin.init();
      } catch (e) {
        console.error('Admin content init failed:', e);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
