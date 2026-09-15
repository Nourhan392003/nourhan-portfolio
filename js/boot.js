/* nourhan-portfolio · boot
 * ============================================================
 * The first thing every public page runs. It lives here rather than
 * inline in the <head> so the Content-Security-Policy can stay strict:
 * an inline <script> would force 'unsafe-inline' into script-src, which
 * would defeat the point of having a policy at all.
 *
 * It is loaded with a plain (parser-blocking) <script> tag in the head,
 * AFTER the stylesheet, which gives it the same timing as the inline
 * version it replaces — early enough to set the theme before the first
 * paint, so the page never flashes the wrong mode.
 *
 * Three jobs, all of them before paint:
 *   1. mark the document as scripted (`html.js`) so the entrance
 *      choreography knows content may be parked
 *   2. apply the saved dark/light theme
 *   3. honour ?motion=full / ?motion=system for the hero choreography
 *
 * Every storage access is guarded: private mode or blocked storage must
 * fall back to the dark default rather than break the page.
 * ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;

  // Added synchronously so content is hidden ONLY while the entrance
  // choreography runs. Without JS (or with reduced motion) nothing is hidden.
  root.classList.add('js');

  // Theme — dark is the default and the only other valid value is "light";
  // the CSS tokens in styles.css do the rest.
  try {
    var savedTheme = window.localStorage.getItem('np-theme');
    root.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark');
  } catch (themeErr) {
    /* private mode / disabled storage — keep the dark default */
    root.setAttribute('data-theme', 'dark');
  }

  // The OS "reduce motion" setting is honoured by default. Visiting
  // ?motion=full (or ?motion=system to undo) opts into the full hero
  // choreography for the rest of the browser session, so the animation can
  // be reviewed on machines where the OS reports reduced motion.
  try {
    var requested = new URLSearchParams(window.location.search).get('motion');
    if (requested === 'full') window.sessionStorage.setItem('np-motion', 'full');
    else if (requested === 'system') window.sessionStorage.removeItem('np-motion');
    if (window.sessionStorage.getItem('np-motion') === 'full') {
      root.setAttribute('data-motion', 'full');
    }
  } catch (err) {
    /* private mode / disabled storage — fall back to the OS setting */
  }
})();
