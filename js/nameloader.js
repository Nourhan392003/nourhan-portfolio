/* nourhan-portfolio · js/nameloader.js
 * ============================================================
 * The first-visit name hook.
 *
 * On every fresh open of the site the stage greets: the name
 * "NOURHAN ASHRAF" forming letter by letter, a thin REAL progress bar
 * (it tracks the hero turntable frames + the webfonts actually loading),
 * and an OPEN pill. Click it — or wait for the auto-enter — and the stage
 * lifts away revealing the hero.
 *
 * Rules of engagement, mirroring this repo's house style:
 *   · markup lives in index.html; this script only drives it, so a visit
 *     with JS blocked never sees a wall (CSS hides the overlay without .js)
 *   · the overlay self-dismisses via CSS at 9s if this script ever fails
 *     after boot.js has already run — nobody can be stranded behind it
 *   · plays once per TAB session (sessionStorage): navigating inside the
 *     site and back/forward do not replay it, but closing the tab and
 *     opening the site again does — that fresh-open moment is the hook
 *   · ?hook=1 forces a replay for demos and review, any time
 *   · the ceremony plays for everyone: on reduced-motion OSes the CSS swaps
 *     the letter entrance to soft opacity fades (no travel), verified in
 *     styles.css — the old "flash at 0% then vanish" behaviour is gone
 *   · zero dependencies, CSP-safe (no inline anything)
 * ============================================================ */
(function () {
  'use strict';

  var LOADER_ID = 'np-loader';
  var STORE_KEY = 'np-hook-session';

  var overlay = document.getElementById(LOADER_ID);
  if (!overlay) return;

  var force = false;
  try {
    force = new URLSearchParams(window.location.search).get('hook') === '1';
  } catch (e) { force = false; }

  /* Within the same tab session the hook already played — get on with the
     site. Back/forward restores count as the same session too. */
  if (!force) {
    try {
      if (window.sessionStorage.getItem(STORE_KEY) === '1') {
        teardown(true);
        return;
      }
      if (window.performance && performance.type === 2) {
        teardown(true);
        return;
      }
    } catch (e) { /* storage blocked — show the hook, fail open */ }
  }

  /* The ceremony plays for EVERYONE. A reduced-motion OS does not shorten it
     into a flash (that read as "the hook is broken"); instead the CSS swaps
     the letter entrance from a blur-and-lift to a plain sequential fade, so
     the stage still forms and breathes without throwing anything across the
     screen. See the reduced-motion block in styles.css. */

  /* ---- build the letter spans ---------------------------------------- */

  var words = overlay.querySelectorAll('.np-loader__word');
  var totalLetters = 0;
  Array.prototype.forEach.call(words, function (word) {
    var text = word.textContent;
    word.textContent = '';
    Array.prototype.forEach.call(text.split(''), function (ch) {
      var s = document.createElement('span');
      s.className = 'np-loader__letter';
      s.style.setProperty('--i', totalLetters);
      s.textContent = ch;
      word.appendChild(s);
      totalLetters += 1;
    });
  });
  overlay.classList.add('np-armed');

  /* ---- real progress ------------------------------------------------- */

  var FRAME_COUNT = 9;
  var bar = overlay.querySelector('.np-loader__bar');
  var pct = overlay.querySelector('.np-loader__pct');
  var done = 0;
  var total = FRAME_COUNT + 1; /* frames + fonts.ready */
  var started = Date.now();
  var ready = false;
  var entered = false;

  function frameUrl(i) {
    var n = ('00' + i).slice(-3);
    return 'assets/images/hero-turntable/half/frame-' + n + '.webp';
  }

  function tick() {
    done += 1;
    var p = Math.min(100, Math.round((done / total) * 100));
    if (bar) bar.style.transform = 'scaleX(' + p / 100 + ')';
    if (pct) pct.textContent = p + '%';
    if (done >= total) maybeReady();
  }

  function maybeReady() {
    /* Pill shows only when ALL tracked assets landed AND the name had its
       minimum hold. The 11s cap force-enters regardless, so a slow asset can
       never hang the stage forever. */
    if (ready) return;
    if (done < total) {
      window.setTimeout(maybeReady, 250);
      return;
    }
    if (Date.now() - started < 1500) {
      window.setTimeout(maybeReady, 1500 - (Date.now() - started));
      return;
    }
    ready = true;
    overlay.classList.add('np-ready');
  }

  /* Track the same frames the turntable needs (browser dedupes the fetch). */
  for (var i = 0; i < FRAME_COUNT; i++) {
    (function (n) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = tick;
      img.onerror = tick; /* a miss still counts — never stuck */
      img.src = frameUrl(n);
    })(i);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { tick(); });
  } else {
    tick();
  }

  /* ---- enter --------------------------------------------------------- */

  function enter() {
    if (entered) return;
    entered = true;
    try { window.sessionStorage.setItem(STORE_KEY, '1'); } catch (e) { }
    overlay.classList.add('np-done');
    document.documentElement.classList.add('np-entered');
    window.setTimeout(teardown, 820);
  }

  function teardown(instant) {
    var node = document.getElementById(LOADER_ID);
    if (node) node.parentNode.removeChild(node);
    document.documentElement.classList.add('np-entered');
    if (instant) {
      try { window.sessionStorage.setItem(STORE_KEY, '1'); } catch (e) { }
    }
  }

  var pill = overlay.querySelector('.np-loader__open');
  if (pill) {
    pill.addEventListener('click', enter);
    pill.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') enter();
    });
  }

  /* Impatient visitors win: auto-enter shortly after ready, and an absolute
     cap so the hook can never outstay its welcome. */
  function scheduleAutoEnter(ms) {
    window.setTimeout(function () {
      if (ready && !entered) enter();
    }, ms);
  }
  scheduleAutoEnter(7000); /* after ready + 7s */
  window.setTimeout(function () {
    if (!entered) { ready = true; overlay.classList.add('np-ready'); enter(); }
  }, 11000);
})();
