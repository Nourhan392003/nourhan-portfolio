/* nourhan-portfolio · js/nameloader.js
 * ============================================================
 * The first-visit name hook.
 *
 * On the day's first open the site greets with a dark stage, the name
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
 *   · shows at most ONCE PER DAY per browser (localStorage day stamp), so
 *     recruiters are hooked, then left alone
 *   · reduced motion: no ceremony — a brief static beat, then in
 *   · zero dependencies, CSP-safe (no inline anything)
 * ============================================================ */
(function () {
  'use strict';

  var LOADER_ID = 'np-loader';
  var STORE_KEY = 'np-hook-day';

  function todayStamp() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  var overlay = document.getElementById(LOADER_ID);
  if (!overlay) return;

  /* Already shown today (or this is a back/forward restore where the node
     was left behind) — clear it instantly and get on with the site. */
  try {
    if (window.localStorage.getItem(STORE_KEY) === todayStamp()) {
      teardown(true);
      return;
    }
    if ((window.performance && performance.type === 2)) {
      /* back/forward navigation restore — skip the hook */
      teardown(true);
      return;
    }
  } catch (e) { /* storage blocked — show the hook, fail open */ }

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
    /* Small minimum hold so the name can finish forming even on cache hits. */
    if (ready) return;
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
    try { window.localStorage.setItem(STORE_KEY, todayStamp()); } catch (e) { }
    overlay.classList.add('np-done');
    document.documentElement.classList.add('np-entered');
    window.setTimeout(teardown, 820);
  }

  function teardown(instant) {
    var node = document.getElementById(LOADER_ID);
    if (node) node.parentNode.removeChild(node);
    document.documentElement.classList.add('np-entered');
    if (instant) {
      try { window.localStorage.setItem(STORE_KEY, todayStamp()); } catch (e) { }
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
