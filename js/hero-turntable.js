/* nourhan-portfolio — hero turntable prototype (hero only)
 *
 * 9-frame scroll-driven portrait turntable. Vanilla JS, no new libraries:
 * no ScrollTrigger, no Lenis, no framework. The existing GSAP core is not
 * needed here and is deliberately untouched.
 *
 * Composition: chest-up half frames with TRUE transparent backgrounds
 * (assets/images/hero-turntable/half/frame-000.webp … frame-008.webp).
 * The neutral studio gray was removed offline by border-seeded flood keying
 * (top/left/right seeds only — the subject touches the bottom edge), with
 * 1px erosion, edge feather and gray despill on the fringe. White hijab,
 * skin and suit were never inside the key range and are pixel-intact.
 * The canvas paints the frames directly — no radial mask, no painted box,
 * no oval vignette — so the subject floats on the real hero background.
 * A faint CSS drop-shadow gives the silhouette its purple backlight.
 *
 * Sharpness: the canvas backing store tracks CSS size × devicePixelRatio
 * (capped at 2.5) with high-quality smoothing, so edges and the painted
 * frame stay crisp on retina screens. Source detail itself is limited by
 * the 9-cell contact sheet — a prototype constraint, not a render bug.
 *
 * Pinning: .hero-track supplies 250vh of scroll distance while the 100svh
 * hero viewport stays stuck (see styles.css); progress maps directly to:
 *   frameIndex = min(frames.length - 1, floor(progress * (frames.length - 1)))
 * Scroll down: 000 → 008. Scroll up: 008 → 000. No redraw when the index
 * is unchanged. Reduced motion (or <2 loaded frames): no pin, no scroll
 * listener — static frame-000 only. Failure of frame-000: the canvas stays
 * hidden and the existing profile.jpg chain owns the frame, untouched.
 */
(function () {
  'use strict';

  var FRAME_COUNT = 9;
  var DPR_MAX = 2.5;

  /* ?v= cache-buster: turntable frames carry no fingerprint in their
     filename, so the version rides the query string (same convention as
     styles.css/js bundles) and immutable CDN caching stays safe. */
  var FRAME_V = 'v=1';

  function frameUrl(i) {
    var n = ('00' + i).slice(-3);
    return 'assets/images/hero-turntable/half/frame-' + n + '.webp?' + FRAME_V;
  }

  var reduceQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  var docEl = document.documentElement;

  function reduced() {
    if (docEl.getAttribute('data-motion') === 'full') return false;
    return !!(reduceQuery && reduceQuery.matches);
  }

  var hero = document.querySelector('.hero');
  var figure = document.querySelector('[data-hero-image]');
  var canvas = document.querySelector('[data-turntable-canvas]');
  if (!hero || !figure || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var frames = []; // successfully loaded HTMLImageElements, in order
  var sprites = []; // feathered offscreen renders, one per loaded frame
  var cssW = 0; // canvas CSS pixel size (drawing units)
  var cssH = 0;
  var current = -1;
  var active = false; // canvas owns the figure
  var pinned = false; // hero pin (.hero--turntable) applied
  var raf = null;
  var destroyed = false;

  /* Geometry is cached and re-measured on a time throttle (never per frame),
     mirroring the experienceRail pattern in script.js. */
  var track = document.querySelector('[data-hero-track]');
  var heroTop = 0;
  var heroSpan = 1;
  var measuredAt = 0;

  function stamp() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  function measure() {
    var box = track || hero;
    var rect = box.getBoundingClientRect();
    var y = window.scrollY || window.pageYOffset || 0;
    heroTop = rect.top + y;
    var vh = window.innerHeight || docEl.clientHeight;
    heroSpan = Math.max(box.offsetHeight - vh, 1);
    measuredAt = stamp();
  }

  /* Backing store follows CSS size × DPR so the render stays crisp on
     retina displays; all drawing below uses CSS pixel units. */
  function layout() {
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (!w || !h) return;
    cssW = w;
    cssH = h;
    var bw = Math.max(1, Math.round(w * dpr));
    var bh = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    sprites = [];
    current = -1; // force a full redraw in the new layout
  }

  /* Frames arrive with true transparency: scale them into an offscreen
     canvas once per layout (high-quality smoothing) and blit directly.
     No mask, no painted backdrop — the hero background shows through. */
  function buildSprite(img, W, H) {
    var off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    var o = off.getContext('2d');
    o.imageSmoothingEnabled = true;
    o.imageSmoothingQuality = 'high';
    o.drawImage(img, 0, 0, W, H);
    return off;
  }

  function drawFrame(index) {
    ctx.clearRect(0, 0, cssW, cssH);
    if (!sprites[index]) {
      sprites[index] = buildSprite(frames[index], canvas.width, canvas.height);
    }
    ctx.drawImage(sprites[index], 0, 0, cssW, cssH);
  }

  function show(index) {
    if (index === current) return; // never redraw the same frame
    if (index < 0 || index >= frames.length) return;
    if (!frames[index] || !frames[index].naturalWidth) return;
    if (!cssW || !cssH) return;
    current = index;
    drawFrame(index);
  }

  function progress() {
    if (stamp() - measuredAt > 250) measure();
    var y = window.scrollY || window.pageYOffset || 0;
    var p = (y - heroTop) / heroSpan;
    if (p < 0) return 0;
    if (p > 1) return 1;
    return p;
  }

  function run() {
    raf = null;
    if (destroyed || !active || !pinned) return;
    var p = progress();
    var index = Math.min(
      frames.length - 1,
      Math.floor(p * (frames.length - 1))
    );
    show(index);
  }

  function schedule() {
    if (raf === null && !document.hidden) {
      raf = window.requestAnimationFrame(run);
    }
  }

  function onScroll() {
    schedule();
  }

  /* Pinning applies at every width (mobile keeps the pinned rotation over
     its stacked layout); only reduced motion and <2 loaded frames stay
     static with the front frame. */
  function pinAllowed() {
    return !reduced() && frames.length >= 2;
  }

  function updatePin() {
    if (destroyed || !active) return;
    if (pinAllowed()) {
      if (!pinned) {
        hero.classList.add('hero--turntable');
        pinned = true;
        measure();
        layout();
        schedule();
      }
      return;
    }
    if (pinned) {
      hero.classList.remove('hero--turntable');
      pinned = false;
    }
    layout();
    show(0);
  }

  function onResize() {
    measure();
    layout();
    updatePin();
    schedule();
  }

  function cleanup() {
    destroyed = true;
    if (raf !== null) {
      (window.cancelAnimationFrame || window.clearTimeout)(raf);
      raf = null;
    }
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pagehide', cleanup);
    if (reduceQuery && typeof reduceQuery.removeEventListener === 'function') {
      reduceQuery.removeEventListener('change', onResize);
    }
  }

  function activate() {
    figure.classList.add('is-turntable');
    canvas.removeAttribute('hidden');
    active = true;
    layout();
    show(0);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    /* Late layout shifts (webfonts, Supabase hydration) change the track
       length — re-measure on the same schedule the rest of the page uses. */
    window.addEventListener('load', measure);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (!destroyed) {
          measure();
          layout();
          schedule();
        }
      });
    }
    [0, 250, 700, 1500, 3000].forEach(function (delay) {
      window.setTimeout(function () {
        if (!destroyed) {
          measure();
          layout();
          schedule();
        }
      }, delay);
    });
    updatePin();
    schedule();

    window.addEventListener('pagehide', cleanup);
    if (reduceQuery && typeof reduceQuery.addEventListener === 'function') {
      /* A mid-session switch to reduced motion settles the hero statically. */
      reduceQuery.addEventListener('change', onResize);
    }
  }

  /* Preload in order. Frame-000 must succeed or the existing profile.jpg
     fallback keeps the frame and this module exits silently. */
  (function preload() {
    var pending = FRAME_COUNT;
    var ordered = new Array(FRAME_COUNT);
    var failed0 = false;

    function settle() {
      pending -= 1;
      if (pending > 0) return;
      if (failed0 || destroyed) return; // fallback <img> stays in charge
      for (var i = 0; i < FRAME_COUNT; i++) {
        if (ordered[i]) frames.push(ordered[i]);
      }
      if (!frames.length) return;
      activate();
    }

    for (var i = 0; i < FRAME_COUNT; i++) {
      (function (index) {
        var img = new Image();
        img.decoding = 'async';
        img.onload = function () {
          ordered[index] = img.naturalWidth ? img : null;
          if (index === 0 && !ordered[0]) failed0 = true;
          settle();
        };
        img.onerror = function () {
          ordered[index] = null;
          if (index === 0) failed0 = true;
          settle();
        };
        img.src = frameUrl(index);
      })(i);
    }
  })();

  window.NPTurntable = {
    destroy: cleanup,
    redraw: function () {
      if (active && current >= 0) {
        var keep = current;
        current = -1;
        show(keep);
      }
    }
  };
})();
