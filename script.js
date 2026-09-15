/* nourhan-portfolio — public site behaviour
 *
 * No library, no build step. Everything here is progressive enhancement:
 * the CSS marks nothing as hidden unless `html.js` is present (set by the
 * inline <head> snippet), so the page is fully readable without JS and the
 * hero entrance simply plays once on load.
 *
 * Modules
 *   1. portrait    — images/profile.jpg → images/profile.jpeg → placeholder
 *   2. side copy   — one-time GSAP entrance timeline for the hero copy column
 *   3. typewriter  — rotating specialization line
 *   4. reveal      — direction-aware IntersectionObserver reveals
 *                    (+ window.NPReveal), fed by a rAF scroll watcher
 *   5. butterflies — pointer reaction on top of the CSS flight paths
 *   6. parallax    — subtle hero depth on desktop pointers
 *   7. chrome      — mobile nav, current year
 *   8. contact     — CONTACT_LINKS → buttons + rows (empty = inert)
 *   9. form        — portfolio message form → validate, then WhatsApp
 *  10. theme       — manual dark / light mode + saved preference
 *
 * The hero portrait and the two name lines keep their CSS keyframes (they
 * own no GSAP tweens); everything in the copy column below the eyebrow is
 * animated once by the GSAP timeline in module 2.
 */

/* ============================================================
   CONTACT LINKS — EDIT ME
   ------------------------------------------------------------
   Fill in a value to switch its control on; leave it empty to
   keep the control visible but inert (no href, aria-disabled
   "true"), so an un-filled link can never navigate to "#".

     email     "you@domain.com"  → becomes a mailto: link
     whatsapp  "201234567890"    → becomes https://wa.me/201234567890
               (a full URL is also accepted, e.g. wa.me/...)
     linkedin  full profile URL  → https://…  is added if omitted
     github    full profile URL
     instagram full profile URL
   ============================================================ */
const CONTACT_LINKS = {
  linkedin: '',
  github: '',
  instagram: '',
  whatsapp: '',
  email: ''
};

(function () {
  'use strict';

  var docEl = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // The OS preference is honoured unless the visitor opted in with
  // ?motion=full (data-motion is set by the inline <head> snippet).
  var forcedMotion = docEl.getAttribute('data-motion') === 'full';

  function reduced() {
    return reduceMotion.matches && !forcedMotion;
  }

  /* ============================================================
     1 · Portrait — swap-friendly loading
     Replace images/profile.jpg to change the hero photo.
     ============================================================ */
  (function portrait() {
    var img = document.getElementById('hero-photo');
    if (!img) return;

    var frame = img.closest('.hero__frame') || img.parentNode;
    var sources = ['images/profile.jpg', 'images/profile.jpeg'];
    var index = 0;

    function showPlaceholder() {
      if (frame && frame.classList) frame.classList.add('is-placeholder');
    }

    function tryNext() {
      index += 1;
      if (index >= sources.length) {
        showPlaceholder();
        return;
      }
      img.src = sources[index];
    }

    img.addEventListener('error', tryNext);
    img.addEventListener('load', function () {
      if (!img.naturalWidth) tryNext();
    });

    // Already cached/failed before the listeners were attached?
    if (img.complete) {
      if (!img.naturalWidth) tryNext();
    } else if (img.getAttribute('src') !== sources[0]) {
      img.src = sources[0];
    }
  })();

  /* ============================================================
     2 · Hero side copy — one-time GSAP entrance
     Runs once per full page load. The targets are the visible elements
     themselves (the two .hero__desc-line spans hold the real words), so the
     movement happens on the text people read — never on a hidden wrapper.
     ============================================================ */
  (function sideCopyEntrance() {
    if (reduced()) return;
    if (!window.gsap) return; // no GSAP → the copy simply stays visible

    var descLines = document.querySelectorAll('.hero__desc-line');
    if (!descLines.length) return;

    var sideText = gsap.timeline({
      defaults: {
        ease: 'power3.out'
      }
    });

    sideText
      .from('.hero__eyebrow', {
        y: -80,
        opacity: 0,
        duration: 0.8
      }, 0.35)
      .from('.hero__desc-line', {
        y: 45,
        opacity: 0,
        duration: 0.75,
        stagger: 0.16
      }, 0.95)
      .from('.hero__specialization', {
        y: 35,
        opacity: 0,
        duration: 0.7
      }, 1.35)
      .from('.hero__actions', {
        y: 35,
        opacity: 0,
        duration: 0.7
      }, 1.6)
      .from('.hero__availability', {
        y: 25,
        opacity: 0,
        duration: 0.55
      }, 1.85);
  })();

  /* ============================================================
     3 · Typewriter — rotating specialization line
     ============================================================ */
  (function typewriter() {
    var output = document.querySelector('.hero__specialization-text');
    if (!output) return;

    var phrases = [
      'Frontend Developer',
      'E-Commerce Specialist',
      'Brand Website Builder',
      'Responsive UI Developer'
    ];

    function showStatic() {
      output.textContent = phrases[0];
    }

    /* Hero content may arrive from Supabase after this typewriter has
       already started. Consumers call window.NPSpecializations.set(list)
       instead of writing into the line themselves: it reuses THIS
       typewriter — stopping the current run, resetting position and
       starting exactly once — so no second typewriter, timer or interval
       is ever created. */
    window.NPSpecializations = {
      set: function (list) {
        if (!Array.isArray(list)) return;
        var cleaned = list
          .map(function (s) { return String(s == null ? '' : s).trim(); })
          .filter(Boolean);
        if (!cleaned.length) return;
        phrases = cleaned;
        stop();
        phraseIndex = 0;
        charIndex = 0;
        erasing = false;
        output.textContent = '';
        if (reduced()) { showStatic(); return; }
        start();
      }
    };

    if (reduced()) {
      showStatic();
      return;
    }

    var START_DELAY = 2500; // lands just after the copy timeline finishes
    var TYPE_MS = 70;
    var ERASE_MS = 38;
    var HOLD_MS = 1400;
    var GAP_MS = 380;

    var phraseIndex = 0;
    var charIndex = 0;
    var erasing = false;
    var timer = null;
    var running = false;

    function tick() {
      var phrase = phrases[phraseIndex];

      if (!erasing) {
        charIndex += 1;
        output.textContent = phrase.slice(0, charIndex);
        if (charIndex >= phrase.length) {
          erasing = true;
          timer = window.setTimeout(tick, HOLD_MS);
        } else {
          timer = window.setTimeout(tick, TYPE_MS);
        }
        return;
      }

      charIndex -= 1;
      output.textContent = phrase.slice(0, Math.max(charIndex, 0));
      if (charIndex <= 0) {
        erasing = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        charIndex = 0;
        timer = window.setTimeout(tick, GAP_MS);
      } else {
        timer = window.setTimeout(tick, ERASE_MS);
      }
    }

    function start() {
      if (running) return;
      running = true;
      timer = window.setTimeout(tick, START_DELAY);
    }

    function stop() {
      running = false;
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    });

    if (!document.hidden) start();
  })();

  /* ---------- scroll direction (vanilla + rAF, no library) ----------
     The reveal module below reads this the moment an element enters the
     viewport, so the same element can fall in when the visitor scrolls
     down and rise in when they scroll up. */
  let previousScrollY = window.scrollY;
  let scrollDirection = 'down';
  let ticking = false;

  function updateScrollDirection() {
    const currentScrollY = window.scrollY;
    scrollDirection = currentScrollY > previousScrollY ? 'down' : 'up';
    previousScrollY = currentScrollY;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateScrollDirection);
      ticking = true;
    }
  }, { passive: true });

  /* ============================================================
     4 · Scroll reveal — direction-aware IntersectionObserver
     ------------------------------------------------------------
     Stack rows ([data-scroll-item]), section headings, service rows,
     experience rows, project cards and contact rows all enter from the
     side the visitor is scrolling towards: falling in from above when
     scrolling down, rising in from below when scrolling up. Leaving the
     viewport resets an item, so nothing is revealed only once.
     ============================================================ */
  (function reveal() {
    var RAIL = '[data-reveal-rail]';
    var SELECTOR =
      '[data-scroll-item], .reveal-line, .service, .xp__item, ' +
      '.contact-row, .contact__intro, .contact__panel, ' +
      '.case:not(.case--skeleton), [data-reveal], ' + RAIL;

    var tracked = [];

    function show(node) {
      node.classList.add('visible');
    }

    function isRail(node) {
      return node.hasAttribute && node.hasAttribute('data-reveal-rail');
    }

    // Only elements carrying `data-scroll-motion` are hidden and offset by
    // the CSS, and this marker is written by JS only — so reduced motion
    // (where this never runs) leaves the page visible and untouched.
    function markMotion(node) {
      if (isRail(node)) return;
      node.setAttribute('data-scroll-motion', '1');
      node.setAttribute('data-scroll-dir', scrollDirection);
    }

    // No IntersectionObserver (or reduced motion) → everything is visible.
    if (!('IntersectionObserver' in window) || reduced()) {
      window.NPReveal = {
        observeAll: function (scope) {
          var root = scope || document;
          var all = root.querySelectorAll(SELECTOR);
          for (var i = 0; i < all.length; i++) show(all[i]);
          if (root.nodeType === 1 && root.matches(SELECTOR)) show(root);
        }
      };
      window.NPReveal.observeAll(document);
      return;
    }

    // Nothing is observed once: the same element is reset when it leaves
    // the viewport and animates again on its next entrance.
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var node = entry.target;

          if (entry.isIntersecting) {
            if (node.classList.contains('visible')) return;
            // The direction is read at the moment of entry, not at load.
            node.setAttribute('data-scroll-dir', scrollDirection);
            show(node);
            return;
          }

          // Left the viewport → drop the visible state and park the element
          // on the side it will come back from.
          if (!node.classList.contains('visible')) return;
          node.classList.remove('visible');
          if (!isRail(node)) node.setAttribute('data-scroll-dir', scrollDirection);
        });
      },
      // threshold 0 (not a ratio): a partially clipped heading still counts
      // as entering. The small bottom inset holds the entrance back until
      // the element is properly in view, while the top edge stays exact so
      // an item leaving upwards is reset the instant it is fully out.
      { threshold: 0, rootMargin: '0px 0px -10% 0px' }
    );

    function staggerSiblings(node) {
      // project cards are appended by js/projects.js; they are already
      // siblings of each other, so the same index-based delay applies
      var parent = node.parentNode;
      if (!parent) return;
      var siblings = parent.querySelectorAll('[data-reveal]');
      if (siblings.length < 2) return;
      var i = Array.prototype.indexOf.call(siblings, node);
      if (i > 0) node.style.setProperty('--reveal-delay', (i * 0.09).toFixed(2) + 's');
    }

    function observeOne(node) {
      if (node.dataset && node.dataset.npObserved === '1') return;
      if (node.dataset) node.dataset.npObserved = '1';
      if (node.hasAttribute && node.hasAttribute('data-reveal')) staggerSiblings(node);
      markMotion(node);
      observer.observe(node);
      tracked.push(node);
    }

    function queue(scope) {
      var root = scope || document;
      var all = root.querySelectorAll(SELECTOR);
      for (var i = 0; i < all.length; i++) observeOne(all[i]);
      if (root.nodeType === 1 && root.matches(SELECTOR)) observeOne(root);
    }

    queue(document);

    // Elements rendered later (project cards from Supabase) join in.
    window.NPReveal = { observeAll: queue };

    // Safety net: on a very tall viewport the closing rows can sit inside
    // the observer's bottom margin at maximum scroll, where they would
    // never intersect. When the page bottoms out, settle whatever is on
    // screen rather than leaving it hidden.
    var bottomTicking = false;

    function settleAtBottom() {
      bottomTicking = false;
      if (
        window.innerHeight + window.scrollY <
        document.documentElement.scrollHeight - 2
      ) {
        return;
      }
      for (var i = 0; i < tracked.length; i++) {
        var node = tracked[i];
        if (node.classList.contains('visible')) continue;
        var rect = node.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          node.setAttribute('data-scroll-dir', scrollDirection);
          show(node);
        }
      }
    }

    window.addEventListener('scroll', function () {
      if (bottomTicking) return;
      bottomTicking = true;
      window.requestAnimationFrame(settleAtBottom);
    }, { passive: true });

    if ('MutationObserver' in window) {
      var grid = document.getElementById('projects-grid');
      if (grid) {
        new MutationObserver(function (mutations) {
          mutations.forEach(function (m) {
            Array.prototype.forEach.call(m.addedNodes, function (node) {
              if (node.nodeType === 1) queue(node);
            });
          });
        }).observe(grid, { childList: true });
      }
    }
  })();

  /* ============================================================
     5 · Butterflies — subtle pointer reaction
     Flight drift and wing flap are CSS; this only nudges each
     butterfly away from the cursor and eases it back.
     ============================================================ */
  (function butterflies() {
    var wrap = document.querySelector('.butterflies');
    if (!wrap) return;
    if (reduced() || !finePointer.matches) return;

    var nodes = Array.prototype.slice.call(wrap.querySelectorAll('.butterfly'));
    if (!nodes.length) return;

    var REACH = 190;   // px radius of awareness
    var PUSH = 42;     // px maximum displacement
    var TURN = 24;     // degrees maximum rotation

    var bugs = nodes.map(function (node) {
      var inner = node.querySelector('.butterfly-flight') || node;
      inner.style.willChange = 'transform';
      return { inner: inner, x: 0, y: 0, r: 0, b: 1, tx: 0, ty: 0, tr: 0, tb: 1, unit: 1 };
    });

    var pointer = { x: -9999, y: -9999, active: false };
    var frame = null;
    var settled = true;

    var VIEWBOX_W = 120; // .butterfly uses a 120×90 viewBox

    function measure(bug) {
      var rect = bug.inner.getBoundingClientRect();
      // CSS pixels inside an SVG are user units, so an offset in screen px
      // has to be converted before it is written to the group's transform.
      bug.unit = rect.width > 0 ? VIEWBOX_W / rect.width : 1;
      return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    }

    function step() {
      frame = null;
      var moving = false;

      bugs.forEach(function (bug) {
        var c = measure(bug);
        var dx = c.cx - pointer.x;
        var dy = c.cy - pointer.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (pointer.active && dist < REACH && dist > 0.01) {
          var force = 1 - dist / REACH;
          bug.tx = (dx / dist) * PUSH * force;
          bug.ty = (dy / dist) * PUSH * force;
          bug.tr = (dx > 0 ? 1 : -1) * TURN * force;
          bug.tb = 1 + 0.45 * force;
        } else if (pointer.active) {
          bug.tx = 0;
          bug.ty = 0;
          bug.tr = 0;
          bug.tb = 1;
        }

        // smooth interpolation toward the target offset
        bug.x += (bug.tx - bug.x) * 0.09;
        bug.y += (bug.ty - bug.y) * 0.09;
        bug.r += (bug.tr - bug.r) * 0.09;
        bug.b += (bug.tb - bug.b) * 0.12;

        if (
          Math.abs(bug.x - bug.tx) > 0.1 ||
          Math.abs(bug.y - bug.ty) > 0.1 ||
          Math.abs(bug.r - bug.tr) > 0.1 ||
          Math.abs(bug.b - bug.tb) > 0.005
        ) {
          moving = true;
        }

        bug.inner.style.transform =
          'translate3d(' + (bug.x * bug.unit).toFixed(2) + 'px,' +
          (bug.y * bug.unit).toFixed(2) + 'px,0) rotate(' + bug.r.toFixed(2) + 'deg)';
        bug.inner.style.filter = bug.b > 1.02 ? 'brightness(' + bug.b.toFixed(2) + ')' : '';
      });

      settled = !moving && !pointer.active;
    }

    function schedule() {
      if (frame === null && !document.hidden) frame = window.requestAnimationFrame(step);
    }

    document.addEventListener(
      'pointermove',
      function (event) {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
        schedule();
      },
      { passive: true }
    );

    document.addEventListener('pointerleave', function () {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
      schedule();
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) schedule();
    });

    // idle spin-up so the easing never stalls mid-flight
    window.setInterval(function () {
      if (!settled) schedule();
    }, 120);
  })();

  /* ============================================================
     5 · Hero parallax — desktop pointers only
     Transform-only, each layer on its own element so it never
     fights the entrance animation (which owns translate/scale).
     ============================================================ */
  (function parallax() {
    if (reduced() || !finePointer.matches) return;

    var hero = document.querySelector('.hero');
    var layers = [
      { el: document.querySelector('.hero__frame'), max: 12 },
      { el: document.querySelector('.hero__visual-glow'), max: 24 },
      { el: document.querySelector('.hero__copy'), max: 4 }
    ].filter(function (layer) {
      return layer.el;
    });

    if (!hero || !layers.length) return;

    var pointer = { x: 0.5, y: 0.5 };
    var current = { x: 0.5, y: 0.5 };
    var frame = null;

    function step() {
      frame = null;
      current.x += (pointer.x - current.x) * 0.08;
      current.y += (pointer.y - current.y) * 0.08;

      var ox = (current.x - 0.5) * 2;
      var oy = (current.y - 0.5) * 2;

      layers.forEach(function (layer) {
        if (layer.el.classList && layer.el.classList.contains('hero__copy')) {
          layer.el.style.transform =
            'translate3d(' + (ox * layer.max).toFixed(2) + 'px,' + (oy * layer.max).toFixed(2) + 'px,0)';
          return;
        }
        layer.el.style.transform =
          'translate3d(' + (-ox * layer.max).toFixed(2) + 'px,' + (-oy * layer.max).toFixed(2) + 'px,0)';
      });

      if (
        Math.abs(pointer.x - current.x) > 0.001 ||
        Math.abs(pointer.y - current.y) > 0.001
      ) {
        frame = window.requestAnimationFrame(step);
      }
    }

    hero.addEventListener(
      'pointermove',
      function (event) {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        var rect = hero.getBoundingClientRect();
        pointer.x = (event.clientX - rect.left) / rect.width;
        pointer.y = (event.clientY - rect.top) / rect.height;
        if (frame === null) frame = window.requestAnimationFrame(step);
      },
      { passive: true }
    );

    hero.addEventListener('pointerleave', function () {
      pointer.x = 0.5;
      pointer.y = 0.5;
      if (frame === null) frame = window.requestAnimationFrame(step);
    });
  })();

  /* ============================================================
     6 · Chrome — mobile nav, current year
     ============================================================ */
  (function chrome() {
    var year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());

    var toggle = document.getElementById('navToggle');
    var links = document.querySelector('.nav__links');
    if (toggle && links) {
      toggle.addEventListener('click', function () {
        var open = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });

      links.addEventListener('click', function (event) {
        if (event.target && event.target.tagName === 'A') {
          links.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
  })();

  /* ============================================================
     8 · Contact — CONTACT_LINKS wiring
     Every control stays visible. An empty value keeps it inert:
     no href, aria-disabled="true", never "#". Fill the value in
     and the control switches on with no markup change.
     ============================================================ */
  (function contact() {
    var links = (typeof CONTACT_LINKS !== 'undefined' && CONTACT_LINKS) || {};

    function clean(value) {
      return typeof value === 'string' ? value.trim() : '';
    }

    function asUrl(value) {
      var v = clean(value);
      if (!v) return '';
      if (/^https?:\/\//i.test(v) || /^mailto:/i.test(v)) return v;
      return 'https://' + v.replace(/^\/+/, '');
    }

    function asWhatsApp(value) {
      var v = clean(value);
      if (!v) return '';
      if (/^https?:\/\//i.test(v)) return v;
      var digits = v.replace(/[^\d]/g, '');
      return digits ? 'https://wa.me/' + digits : '';
    }

    function asMail(value) {
      var v = clean(value);
      if (!v) return '';
      if (/^mailto:/i.test(v)) return v;
      return 'mailto:' + v;
    }

    function disable(node) {
      node.removeAttribute('href');
      node.removeAttribute('target');
      node.removeAttribute('rel');
      node.setAttribute('aria-disabled', 'true');
      if (node.classList) node.classList.add('is-disabled');
    }

    function activate(node, href) {
      node.setAttribute('href', href);
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
      node.removeAttribute('aria-disabled');
      if (node.classList) node.classList.remove('is-disabled');
    }

    /* --- the four contact buttons --- */
    var builders = {
      linkedin: asUrl,
      github: asUrl,
      instagram: asUrl,
      whatsapp: asWhatsApp
    };

    Array.prototype.forEach.call(
      document.querySelectorAll('[data-contact-btn]'),
      function (btn) {
        var key = btn.getAttribute('data-contact-btn');
        var build = builders[key] || asUrl;
        var href = build(links[key]);
        if (href) {
          activate(btn, href);
          return;
        }
        disable(btn);
        btn.addEventListener('click', function (event) {
          event.preventDefault();
        });
      }
    );

    /* --- email + WhatsApp rows upgrade to the real values --- */
    var emailRow = document.querySelector('[data-contact-row="email"]');
    var emailValue = document.querySelector('[data-contact-value="email"]');
    var mail = asMail(links.email);
    if (emailRow && mail) {
      emailRow.setAttribute('href', mail);
      if (emailValue) emailValue.textContent = clean(links.email).replace(/^mailto:/i, '');
    }

    var waRow = document.querySelector('[data-contact-row="whatsapp"]');
    var waValue = document.querySelector('[data-contact-value="whatsapp"]');
    var wa = asWhatsApp(links.whatsapp);
    if (waRow && wa) {
      waRow.setAttribute('href', wa);
      if (waValue) waValue.textContent = clean(links.whatsapp);
    }

    /* --- profiles row: each name links only once its URL exists --- */
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-contact-profile]'),
      function (chip) {
        var key = chip.getAttribute('data-contact-profile');
        var href = asUrl(links[key]);
        if (!href) return;
        var link = document.createElement('a');
        link.className = 'contact__profile';
        link.setAttribute('href', href);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.textContent = chip.textContent;
        chip.parentNode.replaceChild(link, chip);
      }
    );
  })();

  /* ============================================================
     9 · Message form — validate, then deliver by email
     ------------------------------------------------------------
     A valid submission posts the message to the Formspree-compatible
     endpoint in config.js (CONTACT_ENDPOINT) and reports exactly what
     happened — Sending…, then success or a failure with a real mailto
     link. With no endpoint configured there is nothing to post to, so
     the message is handed to the visitor's own mail client instead,
     prefilled and already addressed, and the status line says so.
     An invalid submission stays put with an inline error. Nothing ever
     reaches Supabase, and the message body is never logged.
     The form carries `novalidate`, so every message the visitor reads
     is written below — never a browser bubble, and never a claim of a
     delivery that did not happen.
     ============================================================ */
  (function messageForm() {
    var form = document.getElementById('contact-form');
    if (!form) return;

    var email = document.getElementById('contact-email');
    var message = document.getElementById('contact-message');
    var status = document.getElementById('contact-form-status');
    if (!email || !message) return;

    // The message cap is enforced here as well as on the textarea: the HTML
    // maxlength is the UI guard, this is the enforced one.
    var MESSAGE_MAX = 500;
    var counterCount = document.getElementById('contact-message-count');
    var counterLabel = document.getElementById('contact-message-count-label');

    // Only used if the browser reports no constraint validity at all.
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // ---- Where the message actually goes -------------------------------
    // config.js is loaded *after* this file, so these are read on demand at
    // submit time rather than captured at load.
    //   CONTACT_ENDPOINT — a Formspree-compatible form URL. When present the
    //     message is POSTed and the visitor gets success/failure feedback.
    //   CONTACT_EMAIL — the inbox messages are addressed to.
    // With no endpoint configured the form still works: it hands the message
    // to the visitor's own mail client, prefilled and already addressed.
    var DEFAULT_CONTACT_EMAIL = 'nourhanagag392003@gmail.com';
    var MAILTO_SUBJECT = '?subject=Portfolio%20Inquiry';

    function env() {
      return (window.ENV && typeof window.ENV === 'object') ? window.ENV : {};
    }

    function contactEmail() {
      var configured = String(env().CONTACT_EMAIL || '').trim();
      return configured || DEFAULT_CONTACT_EMAIL;
    }

    function contactEndpoint() {
      var url = String(env().CONTACT_ENDPOINT || '').trim();
      return /^https?:\/\//i.test(url) ? url : '';
    }

    function mailtoHref() {
      return 'mailto:' + contactEmail() + MAILTO_SUBJECT;
    }

    // The submit button doubles as the progress indicator.
    var submitBtn = form.querySelector('.contact-form__submit');
    var submitLabel = submitBtn ? submitBtn.querySelector('span') : null;
    var fallback = document.getElementById('contact-form-fallback');
    var fallbackLink = fallback ? fallback.querySelector('a') : null;

    // ---- Anti-spam ------------------------------------------------------
    // Two cheap traps, neither of which a person can trigger:
    //   · a honeypot field that is hidden from sight, tab order and assistive
    //     tech, so anything in it came from a script filling every input
    //   · a time trap: nobody reads the form and writes a real message in
    //     under a second and a half, but a bot posts immediately
    // Tripping either one is answered with silence — no status message, no
    // request, no hint that the submission was rejected.
    var honeypot = form.querySelector('[name="_hp_company"]');
    var MIN_FILL_MS = 1500;
    var formReadyAt = Date.now();

    function looksAutomated() {
      if (honeypot && String(honeypot.value || '').trim()) return true;
      return Date.now() - formReadyAt < MIN_FILL_MS;
    }

    function setSending(on) {
      if (submitBtn) {
        submitBtn.disabled = !!on;
        if (on) submitBtn.setAttribute('aria-busy', 'true');
        else submitBtn.removeAttribute('aria-busy');
      }
      if (submitLabel) submitLabel.textContent = on ? 'Sending\u2026' : 'Send Message';
    }

    function showFallback(show) {
      if (fallbackLink) fallbackLink.setAttribute('href', mailtoHref());
      if (fallback) fallback.hidden = !show;
    }

    // Hand the message to the visitor's mail client. The address and subject
    // are fixed, so this always composes to the right inbox.
    function handOffToMail(body) {
      if (fallbackLink) fallbackLink.setAttribute('href', mailtoHref());
      window.location.href = mailtoHref() + '&body=' + encodeURIComponent(body);
    }

    function setStatus(text, isError) {
      if (!status) return;
      status.textContent = text;
      if (status.classList) {
        status.classList.toggle('contact-form__status--error', !!isError);
      }
    }

    function markInvalid(field, invalid) {
      if (invalid) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    }

    function emailProblem() {
      var value = email.value.trim();
      if (!value) return 'Please enter your email address.';
      if (email.validity && typeof email.validity.typeMismatch === 'boolean') {
        return email.validity.typeMismatch ? 'Please enter a valid email address.' : '';
      }
      return EMAIL_RE.test(value) ? '' : 'Please enter a valid email address.';
    }

    function messageProblem() {
      var value = message.value.trim();
      if (!value) return 'Please tell me a little about your project.';
      if (value.length > MESSAGE_MAX) {
        return 'Please shorten your message to ' + MESSAGE_MAX + ' characters or fewer.';
      }
      return '';
    }

    // The visible counter, plus the sentence screen readers get. Only the
    // length is read here — the message content is never inspected or logged.
    function paintCounter() {
      var length = message.value.length;
      if (counterCount) counterCount.textContent = length + ' / ' + MESSAGE_MAX;
      if (counterLabel) {
        counterLabel.textContent =
          'Message length: ' + length + ' of ' + MESSAGE_MAX + ' characters';
      }
    }

    // maxlength covers typing and pasting in the browser, but a value written
    // programmatically can still exceed it — clip that back in the UI too.
    function clampMessage() {
      if (message.value.length > MESSAGE_MAX) {
        message.value = message.value.slice(0, MESSAGE_MAX);
      }
      paintCounter();
    }

    // Editing a field clears its error state straight away.
    [email, message].forEach(function (field) {
      field.addEventListener('input', function () {
        markInvalid(field, false);
        if (status && status.classList && status.classList.contains('contact-form__status--error')) {
          setStatus('', false);
        }
      });
    });

    message.addEventListener('input', clampMessage);
    paintCounter();

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      // Silent rejection — deliberately before validation, so a bot learns
      // nothing from the response either.
      if (looksAutomated()) return;

      var emailError = emailProblem();
      var messageError = messageProblem();
      markInvalid(email, !!emailError);
      markInvalid(message, !!messageError);

      if (emailError || messageError) {
        setStatus(emailError || messageError, true);
        (emailError ? email : message).focus();
        return;
      }

      // Final guard, immediately before the message leaves the page: the
      // trimmed text is re-checked here so nothing oversized is ever handed
      // to the hand-off below.
      var trimmedMessage = message.value.trim();
      if (trimmedMessage.length > MESSAGE_MAX) {
        markInvalid(message, true);
        setStatus('Please shorten your message to ' + MESSAGE_MAX + ' characters or fewer.', true);
        message.focus();
        return;
      }

      var fromAddress = email.value.trim();
      var composed =
        'Hi Nourhan, I\u2019m reaching out from your portfolio.\n\n' +
        'Email: ' + fromAddress + '\n\n' +
        'Message:\n' + trimmedMessage;

      var endpoint = contactEndpoint();

      // No endpoint configured → the visitor's mail client is the channel.
      if (!endpoint || typeof window.fetch !== 'function') {
        setSending(false);
        showFallback(true);
        setStatus(
          'Opening your email app with the message ready to send to ' +
            contactEmail() +
            '.',
          false
        );
        handOffToMail(composed);
        return;
      }

      // Endpoint configured → POST it and report the real outcome. Only the
      // two fields and a subject leave the page; the message body is never
      // logged or read anywhere else.
      setSending(true);
      showFallback(false);
      setStatus('Sending\u2026', false);

      var payload = new FormData();
      payload.append('email', fromAddress);
      payload.append('message', trimmedMessage);
      payload.append('_subject', 'Portfolio inquiry from ' + fromAddress);

      window
        .fetch(endpoint, {
          method: 'POST',
          body: payload,
          headers: { Accept: 'application/json' },
        })
        .then(function (response) {
          if (!response.ok) throw new Error('send failed');
          setSending(false);
          form.reset();
          paintCounter();
          showFallback(false);
          setStatus('Thank you! Your message has been sent successfully.', false);
        })
        .catch(function () {
          setSending(false);
          showFallback(true);
          setStatus(
            'Sorry \u2014 I couldn\u2019t send that from here. Use the link below to email me directly.',
            true
          );
        });
    });
  })();

  /* ============================================================
     10 · Theme — manual dark / light mode
     ------------------------------------------------------------
     The initial attribute is written by the inline <head> snippet
     before the first paint, so nothing here can cause a flash.
     This module only wires the control: it flips data-theme,
     remembers the choice under `np-theme` and keeps the icon,
     title and aria-label describing the mode you would switch TO.
     ============================================================ */
  (function theme() {
    var STORAGE_KEY = 'np-theme';
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    if (!buttons.length) return;

    function read() {
      return docEl.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }

    function persist(value) {
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
      } catch (err) {
        /* private mode / disabled storage — the session still switches */
      }
    }

    function paint() {
      var mode = read();
      var target = mode === 'light' ? 'dark' : 'light';
      var label = 'Switch to ' + target + ' mode';
      for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        var icon = button.querySelector('.theme-toggle__icon');
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.setAttribute('data-theme-state', mode);
        button.setAttribute('aria-pressed', mode === 'light' ? 'true' : 'false');
        // moon while the site is dark, sun while it is light
        if (icon) icon.textContent = mode === 'light' ? '\u2600' : '\u263E';
      }
    }

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        var next = read() === 'light' ? 'dark' : 'light';
        docEl.setAttribute('data-theme', next);
        persist(next);
        paint();
      });
    }

    paint();
  })();

  /* ============================================================
     11 · Floating actions — back to top + direct WhatsApp
     ------------------------------------------------------------
     The stack itself lives in the page markup; this only wires behaviour.
     The back-to-top control appears once the visitor is past the hero (or a
     sensible distance on pages without one) and scrolls home smoothly — or
     instantly when reduced motion is requested. The WhatsApp anchor is a
     plain link to the same number the contact section uses, and follows the
     configured value if the CMS has set a different one.
     ============================================================ */
  (function floatingActions() {
    var stack = document.querySelector('[data-fab-stack]');
    if (!stack) return;

    var toTop = document.querySelector('[data-back-to-top]');
    var waLink = document.querySelector('[data-whatsapp-fab]');
    var waRow = document.querySelector('a.contact-row[href*="wa.me/"]');

    // A CMS-configured number wins; the static href is the fallback.
    if (waLink && waRow) {
      var syncWhatsApp = function () {
        var href = waRow.getAttribute('href');
        if (href) waLink.setAttribute('href', href);
      };
      syncWhatsApp();
      if (typeof MutationObserver === 'function') {
        new MutationObserver(syncWhatsApp).observe(waRow, {
          attributes: true,
          attributeFilter: ['href']
        });
      }
    }

    var hero = document.querySelector('.hero');
    var threshold = 280;
    var shown = false;

    // Measured only on load and resize, so the scroll path never reads layout.
    function measure() {
      threshold = hero ? Math.max(hero.offsetHeight * 0.55, 280) : 280;
    }

    // Deliberately synchronous and class-toggle only: nothing here waits on a
    // rendered frame, so the control still appears if frames are throttled.
    function paint() {
      var shouldShow = window.scrollY > threshold;
      if (shouldShow === shown) return;
      shown = shouldShow;
      stack.classList.toggle('is-visible', shouldShow);
    }

    window.addEventListener('scroll', paint, { passive: true });
    window.addEventListener('resize', function () { measure(); paint(); }, { passive: true });
    // A smooth jump can finish without a final scroll event in every engine,
    // so settle the state when the scroll ends (and once more after it).
    window.addEventListener('scrollend', paint, { passive: true });
    measure();
    paint();

    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
        window.setTimeout(paint, 500);
        window.setTimeout(paint, 1100);
      });
    }
  })();

  /* ============================================================
     12 · Reveal safety net — content can never stay invisible
     ------------------------------------------------------------
     The observer above is the primary mechanism, but a throttled or stalled
     rendering loop (background tab, a pane that is not compositing, an engine
     that defers intersection callbacks) can leave parked elements hidden.
     This net simply reveals whatever is already inside the viewport — on
     scroll, on resize, on load and a few timed passes later. It never waits
     on requestAnimationFrame, so it still runs when frames are not being
     produced, and it only ever ADDS .visible, leaving the observer in full
     control of the replay. Reduced motion never parks anything, so this is a
     no-op there.
     ============================================================ */
  (function revealSafetyNet() {
    var SELECTOR =
      '[data-scroll-item], .reveal-line, .service, .xp__item, ' +
      '.contact-row, .contact__intro, .contact__panel, ' +
      '.case:not(.case--skeleton), [data-reveal], [data-reveal-rail]';

    // Reveals whatever is inside the viewport and returns how many elements
    // are still parked somewhere below/above it (0 once the page is settled).
    function settle() {
      var nodes = document.querySelectorAll(SELECTOR);
      var limit = window.innerHeight * 0.9;
      var stillParked = 0;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.classList.contains('visible')) continue;
        // Anything that has reached the threshold is revealed — including a
        // node the page jumped clean past (an instant scroll can overshoot a
        // row while the renderer is stalled), so nothing can be left behind.
        if (node.getBoundingClientRect().top < limit) {
          node.classList.add('visible');
          continue;
        }
        stillParked++;
      }
      return stillParked;
    }

    // Time-throttled rather than frame-throttled: the work is bounded and the
    // class check above makes already-revealed nodes cheap to skip.
    var lastRun = 0;

    function onScroll() {
      var now = Date.now ? Date.now() : new Date().getTime();
      if (now - lastRun < 120) return;
      lastRun = now;
      parked = settle();
    }

    // A stalled renderer can also swallow scroll events, so a light interval
    // keeps checking while anything is still parked. Once nothing is parked a
    // tick costs one variable check and does no layout work at all.
    var parked = settle();

    function tick() {
      if (parked === 0) return;
      parked = settle();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { parked = settle(); }, { passive: true });
    window.addEventListener('load', function () { parked = settle(); });
    [0, 250, 700, 1500, 3000].forEach(function (delay) {
      window.setTimeout(tick, delay);
    });
    window.setInterval(tick, 600);
  })();

  // Keep the "reduced motion" preference live (users can change it mid-session)
  if (!forcedMotion && reduceMotion && typeof reduceMotion.addEventListener === 'function') {
    reduceMotion.addEventListener('change', function () {
      if (reduceMotion.matches) window.location.reload();
    });
  }

  docEl.setAttribute('data-ready', 'true');
})();
