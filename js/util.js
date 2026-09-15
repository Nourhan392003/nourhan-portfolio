/* nourhan-portfolio · shared utilities
 * ============================================================
 * The one place HTML escaping and slug generation live.
 *
 * Before this file existed the same two helpers were declared in
 * several modules — `esc()` in js/public-content.js and `escapeHtml()`
 * in js/admin-content.js were byte-identical, and `slugify()` existed
 * separately in js/admin.js and js/projects.js. Two implementations of
 * an escaping function is a security problem, not just a tidiness one:
 * the copy that drifts is the one that stops escaping something.
 *
 * Load order: this file must come BEFORE any module that uses it —
 * js/public-content.js, js/projects.js, js/admin.js, js/admin-content.js.
 * It has no dependencies of its own and exposes exactly:
 *
 *   window.NPUtil = { esc(value), slugify(value) }
 *
 * Exported as globals to match the rest of the codebase, which has no
 * module system and no build step by design.
 * ============================================================ */
(function () {
  'use strict';

  /* Escape every character that could end an attribute or open a tag.
     Used for any stored value that reaches innerHTML — never for values
     that go through textContent, which needs no escaping. */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* A URL-safe slug from any title: lowercased, accent-stripped, capped at
     80 characters, with no leading/trailing hyphen. The accent stripping
     matters for Arabic/Latin-diacritic titles pasted into the admin form,
     where "Café" should become "cafe" and not "caf-". */
  function slugify(value) {
    var text = String(value == null ? '' : value).toLowerCase().trim();
    if (typeof text.normalize === 'function') {
      text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return text
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  window.NPUtil = {
    esc: esc,
    slugify: slugify,
  };
})();
