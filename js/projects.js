/* nourhan-portfolio · public projects rendering
 * ------------------------------------------------------------
 * One read-only source of truth for the public project data:
 *
 *   index.html    → ProjectsPublic.load()        selected rows (homepage)
 *   projects.html → ProjectsPublic.loadIndex()   every published project
 *   project.html  → ProjectsPublic.fetchPublished() (see project-detail.js)
 *
 * Ordering: featured first, then sort_order, then newest first.
 *
 * Rules honored here:
 *   · published rows only (also enforced by RLS)
 *   · a field is rendered ONLY when it exists (title, cover, description,
 *     industry, type, technologies, links)
 *   · no cover → refined neutral visual with the project initials
 *   · no links → links row is omitted entirely
 *   · no fake fallback images, no invented copy
 *
 * States:
 *   · loading → skeleton rows
 *   · error   → inline message + retry button
 *   · empty   → honest "nothing published yet" note (also used when the
 *               backend is not configured)
 *
 * Exposes: window.ProjectsPublic = {
 *   load, loadIndex, fetchPublished, caseUrl, slugFor, slugify, safeUrl
 * }
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------
     Small shared helpers
     ------------------------------------------------------------ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* only allow http(s) URLs into href/src */
  function safeUrl(url) {
    if (typeof url !== 'string') return null;
    try {
      var u = new URL(url, window.location.href);
      return /^https?:$/.test(u.protocol) ? u.href : null;
    } catch (_) {
      return null;
    }
  }

  /* A URL-safe slug from any title, used when a row carries no slug of its
     own — so every card still links to a real case-study URL. The single
     implementation lives in js/util.js (loaded before this file), which also
     gives it to the admin's auto-slug field, so both produce the same slug. */
  var slugify = window.NPUtil.slugify;

  /* the stored slug when there is one, otherwise one derived from the title */
  function slugFor(project) {
    var stored = project && typeof project.slug === 'string' ? project.slug.trim() : '';
    return stored || slugify(project && project.title);
  }

  function caseUrl(project) {
    return 'project.html?slug=' + encodeURIComponent(slugFor(project));
  }

  /* every column the public site needs — one list, so the homepage rows,
     the index grid and the case study can never drift apart */
  var COLUMNS =
    'id,title,slug,short_description,full_description,industry,project_type,' +
    'technologies,cover_image_url,gallery_image_urls,live_url,github_url,' +
    'featured,published,sort_order,created_at';

  function rowYear(row) {
    if (!row || !row.created_at) return '';
    var date = new Date(row.created_at);
    return isNaN(date.getTime()) ? '' : String(date.getFullYear());
  }

  function initialsFor(title) {
    var words = String(title || 'Untitled')
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) return 'NA';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* featured first, then sort_order, then newest */
  function byPresentationOrder(a, b) {
    var fa = a.featured ? 1 : 0;
    var fb = b.featured ? 1 : 0;
    if (fa !== fb) return fb - fa;
    var sa = typeof a.sort_order === 'number' ? a.sort_order : 0;
    var sb = typeof b.sort_order === 'number' ? b.sort_order : 0;
    if (sa !== sb) return sa - sb;
    var ca = a.created_at ? new Date(a.created_at).getTime() : 0;
    var cb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return cb - ca;
  }

  /* ------------------------------------------------------------
     Data — the one query every public page goes through
     ------------------------------------------------------------ */

  function fetchPublished() {
    if (!window.NP || !window.NP.isConfigured()) {
      return Promise.reject(new Error('Supabase is not configured.'));
    }

    return window.NP.sb
      .from('projects')
      .select(COLUMNS)
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .then(function (result) {
        if (result.error) throw result.error;
        return (result.data || []).slice().sort(byPresentationOrder);
      });
  }

  /* ------------------------------------------------------------
     Shared blocks
     ------------------------------------------------------------ */

  function skeletonRows(n, className) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      frag.appendChild(el('article', className || 'case case--skeleton'));
    }
    return frag;
  }

  /* Warm state card used by the projects index and the case-study page. */
  function panel(kind, message, actionText, actionHref, onAction) {
    var card = el('div', 'projects__state projects__state--' + kind);
    card.appendChild(el('p', 'projects__state-text', message));

    if (actionText && actionHref) {
      var link = el('a', 'btn btn--ghost projects__state-action', actionText);
      link.href = actionHref;
      card.appendChild(link);
    } else if (actionText && onAction) {
      var btn = el('button', 'btn btn--ghost projects__state-action', actionText);
      btn.type = 'button';
      btn.addEventListener('click', onAction);
      card.appendChild(btn);
    }

    return card;
  }

  function stateCard(kind, message, withRetry) {
    var card = el('div', 'projects__state projects__state--' + kind);
    var icon = el('span', 'projects__state-icon', kind === 'error' ? '⚠' : '🗂');
    var text = el('p', 'projects__state-text', message);
    card.appendChild(icon);
    card.appendChild(text);
    if (withRetry) {
      var btn = el('button', 'btn btn--ghost projects__retry', 'Retry');
      btn.type = 'button';
      btn.addEventListener('click', function () {
        window.ProjectsPublic.load();
      });
      card.appendChild(btn);
    }
    return card;
  }

  function updateCount(node, n) {
    if (!node) return;
    if (n > 0) {
      node.textContent = '( ' + n + ' )';
      node.hidden = false;
    } else {
      node.textContent = '';
      node.hidden = true;
    }
  }

  /* ------------------------------------------------------------
     Homepage — selected rows (index.html)
     ------------------------------------------------------------ */

  function renderCase(p, index) {
    var isFlip = index % 2 === 1;
    var title = p.title || 'Untitled';
    var liveHref = p.live_url ? safeUrl(p.live_url) : null;
    var gitHref = p.github_url ? safeUrl(p.github_url) : null;

    var article = el('article', 'case' + (isFlip ? ' case--flip' : ''));
    article.setAttribute('data-reveal', '');

    /* ----- left rail: the huge sticky numeral ---------------------------
       It is its own column (not part of the card body) so CSS can pin it
       while this project is the active row. Decorative either way, so it is
       hidden from assistive tech and the ordinal is not announced twice. */
    var rail = el('div', 'case__rail');
    rail.setAttribute('aria-hidden', 'true');
    var numeral = el('span', 'case__index', pad(index + 1) + '.');
    rail.appendChild(numeral);
    article.appendChild(rail);

    /* ----- the card surface --------------------------------------------- */
    var card = el('div', 'case__card');

    /* ----- media side: the cover dominates the row ----- */
    // When a live site exists the whole cover becomes the link, so the
    // arrow is a real affordance rather than decoration.
    var media;
    if (liveHref) {
      media = el('a', 'case__media');
      media.href = liveHref;
      media.target = '_blank';
      media.rel = 'noopener noreferrer';
      media.setAttribute('aria-label', title + ' — open live site');
    } else {
      media = el('div', 'case__media');
    }

    var safeCover = p.cover_image_url ? safeUrl(p.cover_image_url) : null;
    if (safeCover) {
      var img = document.createElement('img');
      img.src = safeCover;
      img.alt = p.title ? p.title + ' — cover' : '';
      img.loading = 'lazy';
      img.decoding = 'async';
      media.appendChild(img);
      media.appendChild(el('span', 'case__media-veil'));
      var arrow = el('span', 'case__arrow', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      media.appendChild(arrow);
    } else {
      // refined neutral visual — initials only, no fake imagery
      media.classList.add('case__media--initials');
      media.appendChild(el('span', 'case__initials', initialsFor(p.title)));
      media.setAttribute('aria-hidden', 'true');
      if (liveHref) media.setAttribute('tabindex', '-1');
    }
    card.appendChild(media);

    /* ----- body side ----- */
    var body = el('div', 'case__body');

    if (p.featured) {
      body.appendChild(el('span', 'case__badge', 'Featured'));
    }

    body.appendChild(el('h3', 'case__title', title));

    if (p.short_description) {
      body.appendChild(el('p', 'case__desc', p.short_description));
    }

    // type / industry — only when present
    var metaBits = [];
    if (p.project_type) metaBits.push(String(p.project_type));
    if (p.industry) metaBits.push(String(p.industry));
    if (metaBits.length) {
      body.appendChild(el('p', 'case__meta', metaBits.join(' · ')));
    }

    // technologies — only when present
    if (Array.isArray(p.technologies) && p.technologies.length) {
      var tech = el('ul', 'case__tech');
      p.technologies.forEach(function (t) {
        if (t != null && String(t).trim()) tech.appendChild(el('li', null, String(t)));
      });
      if (tech.children.length) body.appendChild(tech);
    }

    // links — hidden entirely when both are empty
    if (liveHref || gitHref) {
      var links = el('div', 'case__links');
      if (liveHref) {
        var live = el('a', 'case__link', 'Live site');
        live.href = liveHref;
        live.target = '_blank';
        live.rel = 'noopener noreferrer';
        links.appendChild(live);
      }
      if (gitHref) {
        var src = el('a', 'case__link', 'Source');
        src.href = gitHref;
        src.target = '_blank';
        src.rel = 'noopener noreferrer';
        links.appendChild(src);
      }
      body.appendChild(links);
    }

    card.appendChild(body);
    article.appendChild(card);
    return article;
  }

  async function load() {
    var grid = document.getElementById('projects-grid');
    if (!grid) return;

    var countEl = document.getElementById('projects-count');
    var configured = window.NP && window.NP.isConfigured();

    if (!configured) {
      // Backend not configured — show the honest empty state.
      grid.textContent = '';
      grid.appendChild(
        stateCard('empty', 'Projects are being prepared — nothing published yet.', false)
      );
      updateCount(countEl, 0);
      return;
    }

    grid.classList.add('is-loading');
    grid.textContent = '';
    grid.appendChild(skeletonRows(2));

    try {
      var rows = await fetchPublished();

      grid.textContent = '';
      grid.classList.remove('is-loading');

      if (!rows.length) {
        grid.appendChild(
          stateCard('empty', 'No published projects yet — check back soon.', false)
        );
        updateCount(countEl, 0);
        return;
      }

      rows.forEach(function (p, i) {
        grid.appendChild(renderCase(p, i));
      });
      // let rendered cases join the scroll-reveal system (if present)
      if (window.NPReveal) window.NPReveal.observeAll(grid);
      updateCount(countEl, rows.length);
    } catch (err) {
      console.error('[nourhan-portfolio] projects load failed:', err);
      grid.textContent = '';
      grid.classList.remove('is-loading');
      grid.appendChild(
        stateCard('error', 'Could not load projects just now.', true)
      );
      updateCount(countEl, 0);
    }
  }

  /* ------------------------------------------------------------
     Projects index — every published project (projects.html)
     ------------------------------------------------------------ */

  function renderIndexCard(p) {
    var title = p.title || 'Untitled';
    var href = caseUrl(p);
    var featured = !!p.featured;

    var card = el('article', 'pi-card' + (featured ? ' pi-card--featured' : ''));
    card.setAttribute('data-reveal', '');

    /* ----- cover, itself a link to the case study ----- */
    var media = el('a', 'pi-card__media');
    media.href = href;
    media.setAttribute('aria-label', title + ' — read the case study');

    var safeCover = p.cover_image_url ? safeUrl(p.cover_image_url) : null;
    if (safeCover) {
      var img = document.createElement('img');
      img.src = safeCover;
      img.alt = title + ' — cover';
      img.loading = 'lazy';
      img.decoding = 'async';
      media.appendChild(img);
    } else {
      media.classList.add('pi-card__media--initials');
      media.appendChild(el('span', 'pi-card__initials', initialsFor(p.title)));
    }
    media.appendChild(el('span', 'pi-card__veil'));
    card.appendChild(media);

    /* ----- body ----- */
    var body = el('div', 'pi-card__body');

    if (featured) body.appendChild(el('span', 'pi-card__badge', 'Featured'));

    // type · industry · year — only the values that actually exist
    var metaBits = [];
    if (p.project_type) metaBits.push(String(p.project_type));
    if (p.industry) metaBits.push(String(p.industry));
    var year = rowYear(p);
    if (year) metaBits.push(year);
    if (metaBits.length) {
      body.appendChild(el('p', 'pi-card__meta', metaBits.join(' · ')));
    }

    body.appendChild(el('h3', 'pi-card__title', title));

    if (p.short_description) {
      body.appendChild(el('p', 'pi-card__desc', p.short_description));
    }

    // technologies — only when present
    if (Array.isArray(p.technologies) && p.technologies.length) {
      var tech = el('ul', 'pi-card__tech');
      p.technologies.forEach(function (t) {
        if (t != null && String(t).trim()) tech.appendChild(el('li', null, String(t)));
      });
      if (tech.children.length) body.appendChild(tech);
    }

    var cta = el('a', 'pi-card__cta');
    cta.href = href;
    cta.appendChild(el('span', null, 'View Case Study'));
    var arrow = el('span', 'pi-card__cta-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    cta.appendChild(arrow);
    body.appendChild(cta);

    card.appendChild(body);
    return card;
  }

  async function loadIndex() {
    var grid = document.getElementById('projects-index');
    if (!grid) return;

    var countEl = document.getElementById('projects-index-count');

    if (!window.NP || !window.NP.isConfigured()) {
      grid.textContent = '';
      grid.appendChild(
        panel('empty', 'Projects are being prepared — nothing published yet.', null, null, null)
      );
      updateCount(countEl, 0);
      return;
    }

    grid.classList.add('is-loading');
    grid.textContent = '';
    grid.appendChild(skeletonRows(2, 'pi-card pi-card--skeleton'));

    try {
      var rows = await fetchPublished();

      grid.textContent = '';
      grid.classList.remove('is-loading');

      if (!rows.length) {
        grid.appendChild(
          panel('empty', 'No published projects yet — check back soon.', null, null, null)
        );
        updateCount(countEl, 0);
        return;
      }

      rows.forEach(function (p, i) {
        grid.appendChild(renderIndexCard(p, i));
      });
      if (window.NPReveal) window.NPReveal.observeAll(grid);
      updateCount(countEl, rows.length);
    } catch (err) {
      console.error('[nourhan-portfolio] projects index failed:', err);
      grid.textContent = '';
      grid.classList.remove('is-loading');
      grid.appendChild(
        panel('error', 'Could not load projects just now.', 'Retry', null, function () {
          loadIndex();
        })
      );
      updateCount(countEl, 0);
    }
  }

  window.ProjectsPublic = {
    load: load,
    loadIndex: loadIndex,
    /* the index card, reused by the case study's related-projects strip */
    renderCard: renderIndexCard,
    fetchPublished: fetchPublished,
    caseUrl: caseUrl,
    slugFor: slugFor,
    slugify: slugify,
    safeUrl: safeUrl,
    initialsFor: initialsFor,
    rowYear: rowYear,
    panel: panel
  };

  /* ------------------------------------------------------------
     Self-init
     ------------------------------------------------------------
     The pages used to carry a one-line inline loader each
     (ProjectsPublic.load() on the homepage, loadIndex() on
     projects.html). Inline script is blocked by this site's CSP, and
     keeping script-src free of 'unsafe-inline' is worth more than the
     saved line, so the file now decides from the markup which view it
     was loaded for. The two containers are distinct (#projects-grid vs
     #projects-index), so the wrong page's entry point can never run,
     and project.html — which has neither — stays untouched.
     ============================================================ */
  function autoload() {
    if (document.getElementById('projects-index')) loadIndex();
    else if (document.getElementById('projects-grid')) load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoload);
  } else {
    autoload();
  }
})();
