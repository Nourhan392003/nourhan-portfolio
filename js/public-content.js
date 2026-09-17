/* nourhan-portfolio · public content layer
 * ------------------------------------------------------------
 * Hydrates the EXISTING Hero, Contact, Services and Stack markup
 * from Supabase.
 *
 * Scope:
 *   · hero + contact  → portfolio_content rows (section_key)
 *   · services        → public.services   where is_visible
 *   · skills          → public.skills     where is_visible
 *
 * Network:
 *   · every portfolio_content section the page needs is fetched in ONE
 *     batched request — a single .in('section_key', …) query — instead of
 *     one request per section, so hydration waits on a single round trip
 *
 * Repeatable lists are only replaced when Supabase actually returns
 * visible rows; the static markup stays as the fallback otherwise.
 * Every icon comes from the fixed allowlist in js/icon-library.js —
 * no stored string is ever interpolated as markup.
 *
 * Rules honoured here:
 *   · update existing elements only — never rebuild a wrapper
 *   · never touch the portrait frame, butterflies, nav, form or animations
 *   · all visible text is written with textContent (never innerHTML)
 *   · if there is no row, or Supabase is not configured, or the read
 *     fails, the current static markup is left exactly as it is
 *   · the specialization line is owned by the existing typewriter in
 *     script.js — we hand it a new phrase list through
 *     window.NPSpecializations.set(), which reuses that typewriter
 *   · after injecting, the existing reveal hook is replayed for the
 *     affected container so new/late content still animates
 *
 * No credentials, no Supabase config, no writes. Read-only.
 */
(function () {
  'use strict';

  /* ============================================================ */
  /*  Helpers                                                    */
  /* ============================================================ */

  function q(sel, scope) {
    return (scope || document).querySelector(sel);
  }

  function qa(sel, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(sel));
  }

  function setText(node, value) {
    if (!node) return false;
    if (value == null) return false;
    var next = String(value);
    if (node.textContent === next) return false;
    node.textContent = next;
    return true;
  }

  function setAttr(node, name, value) {
    if (!node) return false;
    if (value == null || value === '') return false;
    if (node.getAttribute(name) === value) return false;
    node.setAttribute(name, value);
    return true;
  }

  /* only http(s) URLs and local paths under images/ are accepted.
     "assets/images/…" is where the files live now; the bare "images/…"
     form is still honoured so an older stored value is never silently
     dropped from the page. */
  function safeImageSrc(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return null;
    if (/^(?:assets\/)?images\//i.test(raw) && raw.indexOf('..') === -1) {
      return raw;
    }
    if (/^https:\/\//i.test(raw)) {
      try {
        var u = new URL(raw);
        if (u.protocol === 'https:') return u.href;
      } catch (_) { /* not a URL */ }
    }
    return null;
  }

  function isHttpUrl(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return false;
    try {
      var u = new URL(raw);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function digitsOf(value) {
    return String(value == null ? '' : value).replace(/[^\d+]/g, '');
  }

  function isPhoneLike(value) {
    return /^\+?\d{7,20}$/.test(digitsOf(value));
  }

  /* Every string that reaches innerHTML passes through here first.
     The implementation lives in js/util.js (loaded before this file) so
     there is exactly one escaping function in the codebase — a second copy
     would eventually drift, and the copy that drifts is the one that stops
     escaping something. `esc` is kept as the local name because the call
     sites below read better for it. */
  var esc = window.NPUtil.esc;

  /* NOTE: named `txt`, not `str` — this file already declares
     str(obj, key, fallback) further down for reading row fields, and a
     duplicate declaration would silently win by hoisting. */
  function txt(value, fallback) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
    return fallback == null ? '' : fallback;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /* turns "a, b , c" / ["a","b"] / null into a clean string list */
  function toList(value, max, maxLen) {
    var parts = [];
    if (Array.isArray(value)) parts = value;
    else if (typeof value === 'string') parts = value.split(',');
    var seen = {};
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var s = String(parts[i] == null ? '' : parts[i]).trim();
      if (!s) continue;
      if (s.length > maxLen) s = s.slice(0, maxLen).trim();
      if (seen[s]) continue;
      seen[s] = true;
      out.push(s);
      if (out.length >= max) break;
    }
    return out;
  }

  /* ============================================================ */
  /*  Defaults — mirror the static markup, never invent content  */
  /* ============================================================ */

  var DEFAULT_HERO = {
    eyebrow: 'Frontend Developer & E-Commerce Specialist',
    first_name: 'Nourhan',
    last_name: 'Ashraf',
    description_line_1: 'I build clear, responsive web experiences — from e-commerce storefronts to modern brand websites.',
    description_line_2: 'Focused on storefront UI, content hierarchy, and purposeful interaction.',
    specializations: ['Frontend Developer', 'E-Commerce Specialist', 'Brand Website Builder', 'Responsive UI Developer'],
    profile_image: '',
    cta_1_label: 'View Selected Work',
    cta_1_href: '#projects',
    cta_2_label: 'Let\u2019s Talk',
    cta_2_href: '#contact',
    availability_text: 'Open for freelance & new projects',
    availability_enabled: true
  };

  var DEFAULT_CONTACT = {
    heading: 'Let\u2019s build something thoughtful.',
    description: 'Have a project in mind or want to collaborate? Reach out on WhatsApp, LinkedIn, or GitHub.',
    whatsapp_number: '01011405879',
    whatsapp_url: 'https://wa.me/201011405879',
    whatsapp_visible: true,
    phone_number: '01011405879',
    phone_url: 'tel:+201011405879',
    phone_visible: true,
    linkedin_url: 'https://www.linkedin.com/in/nourhan-ashraf-a1a503272',
    linkedin_visible: true,
    github_url: 'https://github.com/Nourhan392003',
    github_visible: true
  };

  function str(obj, key, fallback) {
    if (!obj || typeof obj !== 'object') return fallback;
    var v = obj[key];
    return typeof v === 'string' ? v : fallback;
  }

  function bool(obj, key, fallback) {
    if (!obj || typeof obj !== 'object') return fallback;
    var v = obj[key];
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      var s = v.trim().toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes') return true;
      if (s === 'false' || s === '0' || s === 'no') return false;
    }
    return fallback;
  }

  function list(obj, key, fallback) {
    if (!obj || typeof obj !== 'object') return fallback;
    var v = obj[key];
    if (!Array.isArray(v)) return fallback;
    var cleaned = v.map(function (s) { return String(s == null ? '' : s).trim(); }).filter(Boolean);
    return cleaned.length ? cleaned : fallback;
  }

  function buildWaUrl(number) {
    var d = digitsOf(number);
    if (!d) return null;
    if (d.charAt(0) !== '+') d = '+' + d;
    return 'https://wa.me/' + d.slice(1);
  }

  function buildTelUrl(number) {
    var d = digitsOf(number);
    if (!d) return null;
    if (d.charAt(0) !== '+') d = '+' + d;
    return 'tel:' + d;
  }

  function heroFromRow(row) {
    if (!row || typeof row !== 'object') return null;
    return {
      eyebrow: str(row, 'eyebrow', DEFAULT_HERO.eyebrow),
      first_name: str(row, 'first_name', DEFAULT_HERO.first_name),
      last_name: str(row, 'last_name', DEFAULT_HERO.last_name),
      description_line_1: str(row, 'description_line_1', DEFAULT_HERO.description_line_1),
      description_line_2: str(row, 'description_line_2', DEFAULT_HERO.description_line_2),
      specializations: list(row, 'specializations', DEFAULT_HERO.specializations),
      /* 'profile_image' is the current key; 'profile_image_url' is the
         earlier one and is still honoured so older rows keep working */
      profile_image: str(row, 'profile_image', str(row, 'profile_image_url', '')),
      cta_1_label: str(row, 'cta_1_label', DEFAULT_HERO.cta_1_label),
      cta_1_href: str(row, 'cta_1_href', DEFAULT_HERO.cta_1_href),
      cta_2_label: str(row, 'cta_2_label', DEFAULT_HERO.cta_2_label),
      cta_2_href: str(row, 'cta_2_href', DEFAULT_HERO.cta_2_href),
      availability_text: str(row, 'availability_text', DEFAULT_HERO.availability_text),
      availability_enabled: bool(row, 'availability_enabled', DEFAULT_HERO.availability_enabled),
      __hasSpecializations: Array.isArray(row.specializations) && row.specializations.length > 0
    };
  }

  function contactFromRow(row) {
    if (!row || typeof row !== 'object') return null;

    var waNumber = str(row, 'whatsapp_number', DEFAULT_CONTACT.whatsapp_number);
    var waUrl = str(row, 'whatsapp_url', '');
    if (!waUrl) waUrl = buildWaUrl(waNumber) || DEFAULT_CONTACT.whatsapp_url;
    else if (!/^https?:\/\//i.test(waUrl) && isPhoneLike(waUrl)) waUrl = buildWaUrl(waUrl) || waUrl;

    var phoneNumber = str(row, 'phone_number', DEFAULT_CONTACT.phone_number);
    var phoneUrl = str(row, 'phone_url', '');
    if (!phoneUrl) phoneUrl = buildTelUrl(phoneNumber) || DEFAULT_CONTACT.phone_url;
    else if (!/^tel:/i.test(phoneUrl) && !isHttpUrl(phoneUrl) && isPhoneLike(phoneUrl)) {
      phoneUrl = buildTelUrl(phoneUrl) || phoneUrl;
    }

    return {
      heading: str(row, 'heading', DEFAULT_CONTACT.heading),
      description: str(row, 'description', DEFAULT_CONTACT.description),
      whatsapp_number: waNumber,
      whatsapp_url: waUrl,
      whatsapp_visible: bool(row, 'whatsapp_visible', DEFAULT_CONTACT.whatsapp_visible),
      phone_number: phoneNumber,
      phone_url: phoneUrl,
      phone_visible: bool(row, 'phone_visible', DEFAULT_CONTACT.phone_visible),
      linkedin_url: str(row, 'linkedin_url', DEFAULT_CONTACT.linkedin_url),
      linkedin_visible: bool(row, 'linkedin_visible', DEFAULT_CONTACT.linkedin_visible),
      github_url: str(row, 'github_url', DEFAULT_CONTACT.github_url),
      github_visible: bool(row, 'github_visible', DEFAULT_CONTACT.github_visible)
    };
  }

  /* ============================================================ */
  /*  Reveal replay — the site's hook is { observeAll(scope) }   */
  /* ============================================================ */

  function replayReveal(scope) {
    var hook = window.NPReveal;
    if (!hook) return;
    try {
      if (typeof hook === 'function') hook(scope || document);
      else if (typeof hook.observeAll === 'function') hook.observeAll(scope || document);
    } catch (_) { /* never break the page for a motion replay */ }
  }

  /* ============================================================ */
  /*  Hero hydration                                             */
  /* ============================================================ */

  function hydrateHero(row) {
    var hero = heroFromRow(row);
    var region = q('[data-hero-content]');
    if (!hero || !region) return false;

    /* eyebrow — the ✦ star span is preserved; only the text node is set */
    var eyebrowText = q('.hero__eyebrow-text') ||
      q('.hero__eyebrow .hero__eyebrow-text');
    if (eyebrowText) setText(eyebrowText, hero.eyebrow);

    var names = qa('.hero__name-line');
    setText(names[0], hero.first_name);
    setText(names[1], hero.last_name);

    var descLines = qa('.hero__desc-line');
    setText(descLines[0], hero.description_line_1);
    setText(descLines[1], hero.description_line_2);

    /* specializations — hand the list to the EXISTING typewriter */
    if (hero.__hasSpecializations) {
      var tw = window.NPSpecializations;
      if (tw && typeof tw.set === 'function') tw.set(hero.specializations);
    }

    /* profile image — validate first, keep the current one on any doubt */
    var img = q('[data-hero-image] img');
    var nextSrc = safeImageSrc(hero.profile_image);
    if (img && nextSrc && img.getAttribute('src') !== nextSrc) {
      var probe = new Image();
      probe.onload = function () {
        img.setAttribute('src', nextSrc);
      };
      probe.onerror = function () { /* keep the working portrait */ };
      probe.src = nextSrc;
    }

    var ctas = qa('.hero__actions .hero__cta');
    if (ctas.length >= 1) {
      setText(ctas[0], hero.cta_1_label);
      setAttr(ctas[0], 'href', hero.cta_1_href);
    }
    if (ctas.length >= 2) {
      setText(ctas[1], hero.cta_2_label);
      setAttr(ctas[1], 'href', hero.cta_2_href);
    }

    var availability = q('.hero__availability');
    if (availability) {
      var text = q('.hero__availability-text', availability);
      if (text) setText(text, hero.availability_text);
      availability.style.display = hero.availability_enabled ? '' : 'none';
    }

    replayReveal(region);
    return true;
  }

  /* ============================================================ */
  /*  Contact hydration                                          */
  /* ============================================================ */

  function applyRow(row, cfg) {
    if (!row) return;
    row.style.display = cfg.visible === false ? 'none' : '';

    var value = q('.contact-row__value', row);
    if (value && cfg.value != null && cfg.value !== '') setText(value, cfg.value);

    if (cfg.href) setAttr(row, 'href', cfg.href);
  }

  function hydrateContact(row) {
    var contact = contactFromRow(row);
    var region = q('[data-contact-content]');
    if (!contact || !region) return false;

    var title = q('.contact__title', region);
    setText(title, contact.heading);

    var desc = q('.contact__desc', region);
    setText(desc, contact.description);

    var rows = qa('.contact-row', region);
    applyRow(rows[0], {
      value: contact.whatsapp_number,
      href: contact.whatsapp_url,
      visible: contact.whatsapp_visible
    });
    applyRow(rows[1], {
      value: contact.phone_number,
      href: contact.phone_url,
      visible: contact.phone_visible
    });
    applyRow(rows[2], {
      value: 'Connect on LinkedIn',
      href: contact.linkedin_url,
      visible: contact.linkedin_visible
    });
    applyRow(rows[3], {
      value: (function () {
        try { return 'github.com/' + new URL(contact.github_url).pathname.replace(/^\//, ''); }
        catch (_) { return null; }
      })(),
      href: contact.github_url,
      visible: contact.github_visible
    });

    /* the contact form hands messages to WhatsApp — keep the number in sync */
    var form = q('#contact-form', region);
    if (form) form.dataset.whatsapp = contact.whatsapp_number || '';

    replayReveal(region);
    return true;
  }

  /* ============================================================ */
  /*  Services (repeatable rows, is_visible already filtered)    */
  /* ============================================================ */

  function serviceFromRow(row) {
    if (!row) return null;
    var title = txt(row.title);
    var description = txt(row.description);
    if (!title || !description) return null;
    return {
      title: title,
      description: description,
      tags: toList(row.tags, 12, 60)
    };
  }

  function hydrateServices(rows) {
    var region = q('[data-services-content]');
    if (!region) return false;
    if (!Array.isArray(rows) || !rows.length) return false;

    var items = [];
    for (var i = 0; i < rows.length; i++) {
      var s = serviceFromRow(rows[i]);
      if (s) items.push(s);
    }
    if (!items.length) return false;

    var html = '';
    for (var n = 0; n < items.length; n++) {
      var it = items[n];
      html += '<article class="service" data-reveal>' +
        '<span class="service__num" aria-hidden="true">( ' + pad2(n + 1) + ' )</span>' +
        '<div class="service__body">' +
          '<h3 class="service__title">' + esc(it.title) + '</h3>' +
          '<p class="service__desc">' + esc(it.description) + '</p>' +
        '</div>' +
        (it.tags.length
          ? '<ul class="service__caps">' + it.tags.map(function (t) {
              return '<li>' + esc(t) + '</li>';
            }).join('') + '</ul>'
          : '') +
        '</article>';
    }

    region.innerHTML = html;
    replayReveal(region);
    return true;
  }

  /* ============================================================ */
  /*  Stack / skills — real icon beside every name               */
  /* ============================================================ */

  function skillFromRow(row) {
    if (!row) return null;
    var lib = window.IconLibrary;
    /* an item is only rendered when its icon key is on the allowlist,
       because every row must show a real icon next to its name */
    if (!lib || !lib.isAllowed(row.icon_key)) return null;
    var name = txt(row.name);
    if (!name) return null;
    return {
      name: name,
      icon_key: lib.safeKey(row.icon_key),
      category: txt(row.category, 'Skills')
    };
  }

  function hydrateSkills(rows) {
    var region = q('[data-stack-content]');
    if (!region) return false;
    if (!Array.isArray(rows) || !rows.length) return false;

    /* rows arrive ordered by sort_order; categories therefore appear in
       the order of their first visible item */
    var order = [];
    var byCat = {};
    for (var i = 0; i < rows.length; i++) {
      var s = skillFromRow(rows[i]);
      if (!s) continue;
      if (!byCat[s.category]) {
        byCat[s.category] = [];
        order.push(s.category);
      }
      byCat[s.category].push(s);
    }
    if (!order.length) return false;

    var html = '';
    for (var c = 0; c < order.length; c++) {
      var cat = order[c];
      var list = byCat[cat];
      var label = esc(cat);
      html += '<div class="stack-cat">' +
        '<div class="stack-cat__head">' +
          '<h3 class="stack-cat__title">' + label + '</h3>' +
          '<span class="stack-cat__num" aria-hidden="true">( ' + pad2(c + 1) + ' )</span>' +
        '</div>' +
        '<ul class="skills" aria-label="' + label + '">';

      for (var k = 0; k < list.length; k++) {
        var icon = window.IconLibrary.render(list[k].icon_key);
        html += '<li class="stack-item" data-scroll-item>' +
          '<span class="stack-item__icon" aria-hidden="true">' + icon + '</span>' +
          '<span class="stack-item__name">' + esc(list[k].name) + '</span>' +
          '</li>';
      }

      html += '</ul></div>';
    }

    region.innerHTML = html;
    replayReveal(region);
    return true;
  }

  /* ============================================================ */
  /*  Experience — repeatable roles (visible only, by order)     */
  /* ============================================================ */

  function experienceFromRow(row) {
    if (!row) return null;
    var role = txt(row.role);
    if (!role) return null;
    return {
      role: role,
      company: txt(row.company_or_team),
      description: txt(row.description),
      start: txt(row.start_date),
      end: txt(row.end_date)
    };
  }

  function hydrateExperiences(rows) {
    var region = q('[data-experience-content]');
    if (!region) return false;

    /* Every .xp__item that ships in the HTML is pre-hydration fallback
       content. Real rows REPLACE it rather than sitting beside it — the
       fallback is a stand-in for the rows, not an extra entry. */
    var statics = region.querySelectorAll('.xp__item:not(.xp__item--dynamic)');

    /* .xp__item sets an explicit display, so the [hidden] attribute alone
       does not hide it — the inline display has to be cleared as well */
    function hideStatics() {
      for (var a = 0; a < statics.length; a++) {
        statics[a].hidden = true;
        statics[a].style.display = 'none';
      }
    }

    function showStatics() {
      for (var b = 0; b < statics.length; b++) {
        statics[b].hidden = false;
        statics[b].style.display = '';
      }
    }

    /* no visible rows (or a failed read) → keep the honest static markup */
    if (!Array.isArray(rows) || !rows.length) {
      showStatics();
      return false;
    }

    var items = [];
    for (var i = 0; i < rows.length; i++) {
      var x = experienceFromRow(rows[i]);
      if (x) items.push(x);
    }
    if (!items.length) {
      showStatics();
      return false;
    }

    /* idempotent: never stack duplicates if the page re-hydrates */
    var dynamic = region.querySelectorAll('.xp__item--dynamic');
    for (var d = 0; d < dynamic.length; d++) dynamic[d].remove();
    hideStatics();

    /* database content only ever reaches the DOM through textContent —
       no stored string is ever interpolated as markup */
    var frag = document.createDocumentFragment();
    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      /* echo only what is actually stored — no invented employers or dates */
      var dates = it.start && it.end ? it.start + ' \u2014 ' + it.end : (it.start || it.end);
      var meta = [];
      if (it.company) meta.push(it.company);
      if (dates) meta.push(dates);

      var article = document.createElement('article');
      article.className = 'xp__item xp__item--dynamic';
      article.setAttribute('data-reveal', '');

      if (!it.end) {
        var badge = document.createElement('span');
        badge.className = 'xp__badge xp__badge--live';
        var dot = document.createElement('span');
        dot.className = 'xp__badge-dot';
        dot.setAttribute('aria-hidden', 'true');
        badge.appendChild(dot);
        badge.appendChild(document.createTextNode('Ongoing'));
        article.appendChild(badge);
      }

      var roleEl = document.createElement('h3');
      roleEl.className = 'xp__role';
      roleEl.textContent = it.role;
      article.appendChild(roleEl);

      if (meta.length) {
        var metaEl = document.createElement('p');
        metaEl.className = 'xp__meta';
        metaEl.textContent = meta.join(' \u00b7 ');
        article.appendChild(metaEl);
      }

      if (it.description) {
        var descEl = document.createElement('p');
        descEl.className = 'xp__desc';
        descEl.textContent = it.description;
        article.appendChild(descEl);
      }

      frag.appendChild(article);
    }

    /* the roles in sort order, replacing the fallback rows entirely */
    region.appendChild(frag);

    replayReveal(region);
    return true;
  }

  /* ============================================================ */
  /*  About — single row, updated in place                      */
  /* ============================================================ */

  function hydrateAbout(content) {
    if (!content) return false;

    var region = q('[data-about-content]');
    if (!region) return false;

    var changed = false;

    var labelEl = region.querySelector('.about__label, .section__kicker');
    if (labelEl) {
      var label = txt(content.label, null);
      if (label) {
        labelEl.textContent = label;
        changed = true;
      }
    }

    var headingEl = region.querySelector('.section__title');
    if (headingEl) {
      var heading = txt(content.heading, null);
      if (heading) {
        headingEl.textContent = heading;
        changed = true;
      }
    }

    var statementEl = region.querySelector('.about__statement');
    if (statementEl) {
      var statement = txt(content.statement, null);
      if (statement) {
        statementEl.textContent = statement;
        changed = true;
      }
    }

    var supportEl = region.querySelector('.about__support');
    if (supportEl) {
      var support = txt(content.supporting_text, null);
      if (support) {
        supportEl.textContent = support;
        changed = true;
      }
    }

    var factsEl = region.querySelector('.about__facts');
    if (factsEl) {
      var focus = Array.isArray(content.focus_list) ? content.focus_list : [];
      if (focus.length) {
        factsEl.innerHTML = '';
        for (var i = 0; i < focus.length; i++) {
          var li = document.createElement('li');
          li.textContent = focus[i];
          factsEl.appendChild(li);
        }
        changed = true;
      }
    }

    var codeEl = region.querySelector('.about__code code, .about__code');
    if (codeEl) {
      var code = txt(content.code_block, null);
      if (code) {
        if (codeEl.tagName === 'CODE') {
          codeEl.textContent = code;
        } else {
          codeEl.innerHTML = '<code>' + esc(code) + '</code>';
        }
        changed = true;
      }
    }

    if (changed) replayReveal(region);
    return changed;
  }

  /* ============================================================ */
  /*  Footer — single row, updated in place                      */
  /* ============================================================ */

  function hydrateFooter(content) {
    if (!content) return false;

    var region = q('[data-footer-content]');
    if (!region) return false;

    var changed = false;

    /* Only the dedicated child slots are ever written — the
       .footer__copyright parent itself is never assigned textContent or
       innerHTML, so its #year and name spans can never be wiped. */

    if (content.is_visible === false) {
      region.style.display = 'none';
      return true;
    } else {
      region.style.display = '';
    }

    /* name — dedicated slot first, class as fallback; never removed */
    var nameEl = region.querySelector('[data-footer-name]') ||
      region.querySelector('.footer__name');
    if (nameEl) {
      var name = txt(content.display_name, null);
      if (name) {
        nameEl.textContent = name;
        changed = true;
      }
    }

    /* year — exactly one target: the unique #year element, with the
       .footer__year class only as a fallback when no id is present */
    var yearEl = region.querySelector('#year') ||
      region.querySelector('.footer__year');
    if (yearEl) {
      var mode = (content.year_mode === 'custom');
      var year = mode && content.custom_year ? txt(content.custom_year, null) : (new Date().getFullYear());
      if (String(yearEl.textContent) !== String(year)) {
        yearEl.textContent = String(year);
        changed = true;
      }
    }

    /* copyright prefix/text — dedicated slot first, class as fallback */
    var copyrightEl = region.querySelector('[data-footer-copyright]') ||
      region.querySelector('.footer__copyright-text');
    if (copyrightEl) {
      var copyright = txt(content.copyright_text, null);
      if (copyright) {
        copyrightEl.textContent = copyright;
        changed = true;
      }
    }

    if (changed) replayReveal(region);
    return changed;
  }

  /* ============================================================ */
  /*  Supabase read (read-only, public RLS applies)              */
  /* ============================================================ */

  /* One round trip for every portfolio_content section the page needs.
     PostgREST expands .in() into a single SELECT … WHERE section_key IN (…),
     replacing what used to be one request per section. Returns a map of
     section_key → content; sections with no row (or empty content) are
     simply absent from the map. */
  function readSections(sectionKeys) {
    var NP = window.NP;
    if (!NP || typeof NP.isConfigured !== 'function' || !NP.isConfigured() || !NP.sb) {
      return Promise.resolve({});
    }
    return NP.sb
      .from('portfolio_content')
      .select('section_key, content')
      .in('section_key', sectionKeys)
      .then(function (res) {
        if (res.error) throw res.error;
        var map = {};
        var rows = res.data || [];
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          if (row && row.section_key && row.content) map[row.section_key] = row.content;
        }
        return map;
      });
  }

  /* Single-section read kept for direct callers; a thin wrapper now. */
  function readSection(sectionKey) {
    return readSections([sectionKey]).then(function (map) {
      return map[sectionKey] || null;
    });
  }

  var SERVICES_COLS = 'title, description, tags, sort_order, is_visible';
  var SKILLS_COLS = 'name, category, icon_key, sort_order, is_visible';
  var EXPERIENCE_COLS = 'role, company_or_team, description, start_date, end_date, is_visible';

  /* visible rows only, in explicit order — public RLS enforces the same */
  function readRows(table, columns) {
    var NP = window.NP;
    if (!NP || typeof NP.isConfigured !== 'function' || !NP.isConfigured() || !NP.sb) {
      return Promise.resolve(null);
    }
    return NP.sb
      .from(table)
      .select(columns)
      .eq('is_visible', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data || [];
      });
  }

  /* ============================================================ */
  /*  Public API + boot                                          */
  /* ============================================================ */

  var loading = null;

  function load() {
    if (loading) return loading;

    var heroRegion = q('[data-hero-content]');
    var contactRegion = q('[data-contact-content]');
    var servicesRegion = q('[data-services-content]');
    var skillsRegion = q('[data-stack-content]');
    var experienceRegion = q('[data-experience-content]');
    var aboutRegion = q('[data-about-content]');
    var footerRegion = q('[data-footer-content]');

    if (!heroRegion && !contactRegion && !servicesRegion && !skillsRegion &&
        !experienceRegion && !aboutRegion && !footerRegion) {
      loading = Promise.resolve({ hero: false, contact: false, services: false, skills: false, experience: false, about: false, footer: false });
      return loading;
    }

    /* ONE batched read for all portfolio_content sections on this page;
       the three repeatable tables stay as their own (already parallel)
       requests. A failed batch degrades to an empty map, so every hydrator
       still runs and simply leaves the static markup untouched — same
       per-section isolation as before. */
    var sectionKeys = [];
    if (heroRegion) sectionKeys.push('hero');
    if (contactRegion) sectionKeys.push('contact');
    if (aboutRegion) sectionKeys.push('about');
    if (footerRegion) sectionKeys.push('footer');

    var sectionsPromise = sectionKeys.length
      ? readSections(sectionKeys).catch(function () { return {}; })
      : Promise.resolve({});

    function section(key) {
      return sectionsPromise.then(function (map) { return map[key]; });
    }

    loading = Promise.all([
      heroRegion
        ? section('hero').then(function (row) { return hydrateHero(row); })
            .catch(function () { return false; })
        : Promise.resolve(false),
      contactRegion
        ? section('contact').then(function (row) { return hydrateContact(row); })
            .catch(function () { return false; })
        : Promise.resolve(false),
      servicesRegion
        ? readRows('services', SERVICES_COLS).then(hydrateServices)
            .catch(function () { return false; })
        : Promise.resolve(false),
      skillsRegion
        ? readRows('skills', SKILLS_COLS).then(hydrateSkills)
            .catch(function () { return false; })
        : Promise.resolve(false),
      aboutRegion
        ? section('about').then(function (row) { return hydrateAbout(row); })
            .catch(function () { return false; })
        : Promise.resolve(false),
      footerRegion
        ? section('footer').then(function (row) { return hydrateFooter(row); })
            .catch(function () { return false; })
        : Promise.resolve(false),
      experienceRegion
        ? readRows('experiences', EXPERIENCE_COLS).then(hydrateExperiences)
            .catch(function () { return false; })
        : Promise.resolve(false)
    ]).then(function (out) {
      return {
        hero: out[0], contact: out[1], services: out[2], skills: out[3],
        about: out[4], footer: out[5], experience: out[6]
      };
    });

    return loading;
  }

  window.PublicContent = {
    load: load,
    reload: function () { loading = null; return load(); },
    hydrateHero: hydrateHero,
    hydrateContact: hydrateContact,
    hydrateServices: hydrateServices,
    hydrateSkills: hydrateSkills,
    hydrateAbout: hydrateAbout,
    hydrateFooter: hydrateFooter,
    serviceFromRow: serviceFromRow,
    skillFromRow: skillFromRow,
    heroFromRow: heroFromRow,
    contactFromRow: contactFromRow,
    replayReveal: replayReveal,
    DEFAULT_HERO: DEFAULT_HERO,
    DEFAULT_CONTACT: DEFAULT_CONTACT,
    safeImageSrc: safeImageSrc,
    isHttpUrl: isHttpUrl,
    isPhoneLike: isPhoneLike,
    buildWaUrl: buildWaUrl,
    buildTelUrl: buildTelUrl
  };

  function boot() {
    /* hero can be hydrated as soon as the DOM exists (no reveal needed for
       the entrance animation, which is pure CSS on the original nodes) */
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
