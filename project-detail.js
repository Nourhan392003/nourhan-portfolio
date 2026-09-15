/* nourhan-portfolio · case study page (project.html)
 * ------------------------------------------------------------
 * Read-only view of one published project:
 *
 *   project.html?slug=<slug>  →  the matching record, rendered in full
 *
 * Everything comes from window.ProjectsPublic (js/projects.js), the same
 * published-only source the homepage and the projects index use — this
 * page never writes anywhere and never talks to Supabase directly.
 *
 * Honesty rules:
 *   · only stored values are shown; no invented company, client, timeline,
 *     metrics, users, revenue or performance numbers
 *   · links appear only when the record carries a real URL
 *   · images come from the record's own cover + gallery arrays
 *   · no matching project → a clean "Project not found" state
 *
 * Motion: the entrance is expressed through the site's existing reveal
 * system (data-scroll-item / data-reveal + --reveal-delay), so the page
 * inherits the direction-aware choreography, reduced-motion and the
 * ?motion=full override for free.
 */
(function () {
  'use strict';

  var root = document.getElementById('case-root');
  if (!root) return;

  var API = window.ProjectsPublic;

  /* Shown only when a record carries neither a long nor a short description. */
  var FALLBACK_OVERVIEW =
    'An independent frontend project focused on a clear, responsive, and practical web experience.';

  var params = new URLSearchParams(window.location.search);
  var wantedSlug = (params.get('slug') || '').trim();

  /* ------------------------------------------------------------
     Small DOM helpers — text always goes in as text, never as markup
     ------------------------------------------------------------ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /* stagger a motion item by seconds */
  function delay(node, seconds) {
    node.style.setProperty('--reveal-delay', seconds.toFixed(2) + 's');
    return node;
  }

  /* a direction-aware reveal item (falls/rises with the scroll direction) */
  function motion(node, seconds) {
    node.setAttribute('data-scroll-item', '');
    if (seconds != null) delay(node, seconds);
    return node;
  }

  /* a plain content block that fades up when it enters the viewport */
  function reveal(node) {
    node.setAttribute('data-reveal', '');
    return node;
  }

  function textOf(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  /* ------------------------------------------------------------
     Matching the requested slug to a published record
     ------------------------------------------------------------ */

  function normalizeSlug(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function rowMatches(row, slug) {
    var target = normalizeSlug(slug);
    if (!target) return false;
    if (normalizeSlug(row.slug) === target) return true;
    /* a record without a slug still resolves through its title slug */
    return !!API && normalizeSlug(API.slugify(row.title)) === target;
  }

  /* ------------------------------------------------------------
     Content helpers
     ------------------------------------------------------------ */

  function overviewBlocks(row) {
    var full = textOf(row.full_description);
    if (full) return full.split(/\n{2,}/);
    var short = textOf(row.short_description);
    if (short) return short.split(/\n{2,}/);
    return [FALLBACK_OVERVIEW];
  }

  function technologyList(row) {
    if (!Array.isArray(row.technologies)) return [];
    return row.technologies
      .map(function (t) {
        return t == null ? '' : String(t).trim();
      })
      .filter(Boolean);
  }

  /* cover first, then the gallery — only real stored URLs, nothing reused
     from another project */
  function imageList(row, title) {
    var images = [];
    var cover = row.cover_image_url ? API.safeUrl(row.cover_image_url) : null;
    if (cover) images.push({ src: cover, alt: title + ' — cover', cover: true });

    if (Array.isArray(row.gallery_image_urls)) {
      row.gallery_image_urls.forEach(function (url) {
        var safe = url ? API.safeUrl(url) : null;
        if (!safe) return;
        images.push({
          src: safe,
          alt: title + ' — project image ' + (images.length + 1),
          cover: false
        });
      });
    }
    return images;
  }

  function externalButton(text, variant, href) {
    var link = el('a', 'btn ' + variant + ' cs-action');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.appendChild(el('span', null, text));
    var arrow = el('span', 'cs-action__arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.appendChild(arrow);
    return link;
  }

  /* the site's own section header, so the case study reads as one page with
     the rest of the portfolio */
  function sectionHeader(num, kicker, title, bracket, countText) {
    var head = el('header', 'section__head cs-section__head');

    var line = el('div', 'section__label reveal-line');
    if (num) line.appendChild(el('span', 'section__num', '( ' + num + ' )'));
    line.appendChild(el('span', 'section__kicker', kicker));
    var rule = el('span', 'section__rule');
    rule.setAttribute('aria-hidden', 'true');
    line.appendChild(rule);
    if (bracket) line.appendChild(el('span', 'section__bracket', '( ' + bracket + ' )'));
    head.appendChild(line);

    var heading = el('h2', 'section__title cs-section__title reveal-line', title);
    if (countText) heading.appendChild(el('span', 'section__count', countText));
    head.appendChild(heading);

    return head;
  }

  function section(num, kicker, title, bracket, countText, children) {
    var node = el('section', 'cs-section');
    node.appendChild(sectionHeader(num, kicker, title, bracket, countText));
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  /* ------------------------------------------------------------
     The page itself
     ------------------------------------------------------------ */

  function renderProject(row, all) {
    var title = row.title || 'Untitled';
    var liveHref = row.live_url ? API.safeUrl(row.live_url) : null;
    var gitHref = row.github_url ? API.safeUrl(row.github_url) : null;

    clear(root);
    document.title = title + ' — Nourhan Ashraf';

    var wrap = el('div', 'container cs-wrap');
    var article = el('article', 'cs');

    /* ---- 1 · back link (reveals from above on load) ---- */
    var back = motion(el('a', 'cs-back'), 0);
    back.href = 'projects.html';
    var backArrow = el('span', 'cs-back__arrow', '←');
    backArrow.setAttribute('aria-hidden', 'true');
    back.appendChild(backArrow);
    back.appendChild(el('span', null, 'Back to Projects'));
    article.appendChild(back);

    /* ---- 2 · hero: label, title (word by word), category, actions ---- */
    var hero = el('header', 'cs-hero');
    var step = 0;

    hero.appendChild(motion(el('p', 'cs-label', 'Case Study'), 0.10));

    var heading = el('h1', 'cs-title');
    var words = title.split(/\s+/).filter(Boolean);
    words.forEach(function (word, i) {
      var span = el('span', 'cs-word', word);
      span.setAttribute('data-scroll-item', '');
      delay(span, 0.18 + i * 0.08);
      heading.appendChild(span);
      if (i < words.length - 1) heading.appendChild(document.createTextNode(' '));
    });
    hero.appendChild(heading);
    step = 0.18 + words.length * 0.08;

    var categoryBits = [];
    if (row.project_type) categoryBits.push(String(row.project_type));
    if (row.industry) categoryBits.push(String(row.industry));
    if (categoryBits.length) {
      hero.appendChild(motion(el('p', 'cs-category', categoryBits.join(' · ')), step));
      step += 0.08;
    }

    /* links — rendered only when the record really carries them, and the
       live preview leads as the primary action whenever it exists */
    if (liveHref || gitHref) {
      var actions = motion(el('div', 'cs-actions'), step);
      if (liveHref) {
        actions.appendChild(externalButton('Live Preview', 'btn--primary', liveHref));
      }
      if (gitHref) {
        actions.appendChild(
          externalButton('GitHub', liveHref ? 'btn--ghost' : 'btn--primary', gitHref)
        );
      }
      hero.appendChild(actions);
      step += 0.08;
    }

    article.appendChild(hero);

    /* ---- 3 · information grid: only values that actually exist ---- */
    var cells = [
      ['Role', 'Frontend Developer'],
      ['Company / Team', 'Independent'],
      ['Platform', 'Web Experience']
    ];
    var year = API.rowYear(row);
    if (year) cells.push(['Timeline', year]);

    var info = el('dl', 'cs-info');
    cells.forEach(function (pair, i) {
      var cell = el('div', 'cs-info__cell');
      cell.setAttribute('data-scroll-item', '');
      delay(cell, step + i * 0.07);
      cell.appendChild(el('dt', null, pair[0]));
      cell.appendChild(el('dd', null, pair[1]));
      info.appendChild(cell);
    });
    article.appendChild(info);

    /* ---- 01 / Overview ---- */
    var prose = el('div', 'cs-prose');
    reveal(prose);
    overviewBlocks(row).forEach(function (block) {
      prose.appendChild(el('p', null, block));
    });
    article.appendChild(section('01', 'Overview /', 'Overview', 'Overview', null, [prose]));

    /* ---- 02 / Stack — the stored technologies, as pills ---- */
    var techs = technologyList(row);
    var stackChildren = [];
    if (techs.length) {
      var pills = el('ul', 'cs-pills');
      techs.forEach(function (tech, i) {
        var pill = el('li', 'cs-pill');
        pill.setAttribute('data-scroll-item', '');
        delay(pill, i * 0.07);
        var dot = el('span', 'cs-pill__dot');
        dot.setAttribute('aria-hidden', 'true');
        pill.appendChild(dot);
        pill.appendChild(el('span', null, tech));
        pills.appendChild(pill);
      });
      stackChildren.push(pills);
    } else {
      /* nothing stored → say so, rather than guessing at a stack */
      stackChildren.push(
        el(
          'p',
          'cs-empty',
          'No technologies have been listed for this project yet.'
        )
      );
    }
    article.appendChild(section('02', 'Stack /', 'Stack', 'Stack', null, stackChildren));

    /* ---- 03 / Interface — the record's own images ---- */
    var images = imageList(row, title);
    var interfaceChildren = [];

    if (images.length) {
      var gallery = images.slice(1);
      if (gallery.length) {
        interfaceChildren.push(el('p', 'cs-gallery-label', 'Project Gallery'));
      }

      var grid = el('div', 'cs-gallery');
      images.forEach(function (image) {
        var figure = reveal(el('figure', 'cs-shot' + (image.cover ? ' cs-shot--cover' : '')));
        var img = document.createElement('img');
        img.src = image.src;
        img.alt = image.alt;
        img.loading = 'lazy';
        img.decoding = 'async';
        figure.appendChild(img);
        grid.appendChild(figure);
      });
      interfaceChildren.push(grid);

      if (!gallery.length) {
        interfaceChildren.push(
          el('p', 'cs-gallery-note', 'No additional screenshots have been added yet.')
        );
      }
    } else {
      /* never borrow another project's imagery */
      interfaceChildren.push(
        el('p', 'cs-empty', 'No images have been added for this project yet.')
      );
    }

    article.appendChild(
      section(
        '03',
        'Interface /',
        'Interface',
        'Interface',
        images.length === 1 ? '( 1 image )' : '( ' + images.length + ' images )',
        interfaceChildren
      )
    );

    /* ---- related projects: up to three others ---- */
    var others = all
      .filter(function (p) {
        return p !== row;
      })
      .slice(0, 3);

    if (others.length) {
      var related = el('section', 'cs-section cs-related');
      var head = el('header', 'section__head cs-section__head');
      var line = el('div', 'section__label reveal-line');
      line.appendChild(el('span', 'section__kicker', 'More work /'));
      var rule = el('span', 'section__rule');
      rule.setAttribute('aria-hidden', 'true');
      line.appendChild(rule);
      line.appendChild(el('span', 'section__bracket', '( Related )'));
      head.appendChild(line);
      head.appendChild(
        el('h2', 'section__title cs-section__title reveal-line', 'Related projects')
      );
      related.appendChild(head);

      var relatedGrid = el('div', 'cs-related-grid');
      others.forEach(function (other) {
        /* the reveal module staggers these cards by their index */
        relatedGrid.appendChild(API.renderCard(other));
      });
      related.appendChild(relatedGrid);
      article.appendChild(related);
    }

    /* ---- ending call to action ---- */
    var cta = reveal(el('section', 'cs-cta'));
    cta.appendChild(el('h2', 'cs-cta__title', 'Let\u2019s build something thoughtful.'));
    var ctaLink = el('a', 'btn btn--primary', 'Start a conversation');
    ctaLink.href = 'index.html#contact';
    cta.appendChild(ctaLink);
    article.appendChild(cta);

    wrap.appendChild(article);
    root.appendChild(wrap);

    /* join the site's motion system */
    if (window.NPReveal && window.NPReveal.observeAll) window.NPReveal.observeAll(wrap);
  }

  /* ------------------------------------------------------------
     Not found / could not load
     ------------------------------------------------------------ */

  function renderMissing(message, withRetry) {
    clear(root);
    document.title = 'Project not found — Nourhan Ashraf';

    var wrap = el('div', 'container cs-wrap');
    var box = el('div', 'cs-missing');

    box.appendChild(el('p', 'cs-missing__num', '( 404 )'));
    box.appendChild(el('h1', 'cs-missing__title', 'Project not found'));
    box.appendChild(el('p', 'cs-missing__text', message));

    var actions = el('div', 'cs-missing__actions');

    var back = el('a', 'btn btn--ghost', '← Back to Projects');
    back.href = 'projects.html';
    actions.appendChild(back);

    if (withRetry) {
      var retry = el('button', 'btn btn--ghost', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', start);
      actions.appendChild(retry);
    }

    box.appendChild(actions);
    wrap.appendChild(box);
    root.appendChild(wrap);
  }

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */

  function start() {
    if (!API || typeof API.fetchPublished !== 'function') {
      renderMissing('This case study could not be loaded right now.', true);
      return;
    }

    if (!wantedSlug) {
      renderMissing(
        'No project was named in this link. Browse the published work below.',
        false
      );
      return;
    }

    API.fetchPublished()
      .then(function (rows) {
        var match = null;
        for (var i = 0; i < rows.length; i++) {
          if (rowMatches(rows[i], wantedSlug)) {
            match = rows[i];
            break;
          }
        }

        if (!match) {
          renderMissing(
            'That project isn\u2019t published \u2014 it may have been unpublished, or the link may be incomplete.',
            false
          );
          return;
        }

        renderProject(match, rows);
      })
      .catch(function (err) {
        console.error('[nourhan-portfolio] case study failed:', err);
        renderMissing('This case study could not be loaded right now.', true);
      });
  }

  start();
})();
