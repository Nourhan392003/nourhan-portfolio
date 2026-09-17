/* nourhan-portfolio · admin content management (phase 1)
 * ------------------------------------------------------------
 * Hero + Contact editors for the admin dashboard.
 *
 * Writes go to ONE row per section in public.portfolio_content:
 *   section_key = 'hero'   |   section_key = 'contact'
 * using an upsert with onConflict: 'section_key', so a second
 * save can never create a duplicate row.
 *
 * Hero profile image:
 *   · real file picker (JPG / PNG / WebP, max 5 MB)
 *   · local preview immediately, uploaded only on Save
 *   · stored in the existing public `project-images` bucket at
 *     nourhan-portfolio/portfolio/profile/<auth-user-id>/profile-<timestamp>.<ext>
 *     (the leading `nourhan-portfolio/` folder is required by the
 *     existing storage policy in supabase/03_storage.sql)
 *   · NOTE: the brief asked for a bucket named `imgs`, but no such
 *     bucket exists in this project — the Storage API answers
 *     `NoSuchBucket`. `project-images` is the only bucket that exists
 *     and already carries admin-only upload/update/delete policies,
 *     so the upload targets it. No storage policy was changed.
 *   · the saved URL lands in content.profile_image
 *   · if the DB write fails after an upload, the new object is
 *     removed again so no orphan is left behind
 *
 * Every write is additionally gated on profiles.is_admin = true.
 * The real gate is RLS (`public.is_admin()`); this check only
 * decides what the operator is allowed to see.
 *
 * No raw HTML is ever rendered from a field. No credentials here.
 */
(function () {
  'use strict';

  if (!window.NP || !window.NP.sb) return;

  var sb = window.NP.sb;

  /* ============================================================ */
  /*  storage / limits                                            */
  /* ============================================================ */

  var BUCKET = 'project-images';
  /* supabase/03_storage.sql confines admin writes to this folder */
  var PROFILE_FOLDER = 'nourhan-portfolio/portfolio/profile/';

  var ALLOWED_IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  var MAX_IMAGE_BYTES = 5 * 1024 * 1024; /* 5 MB */

  var MAX = {
    eyebrow: 120,
    name: 60,
    description: 300,
    specialization: 60,
    specializations: 8,
    imageUrl: 300,
    ctaLabel: 40,
    ctaHref: 300,
    availability: 120,
    heading: 120,
    contactDescription: 400,
    phone: 24,
    url: 300
  };

  /* ============================================================ */
  /*  helpers                                                    */
  /* ============================================================ */

  function $(id) { return document.getElementById(id); }

  function sectionLabel(key) {
    return key === 'hero' ? 'Hero' : key === 'contact' ? 'Contact' : 'Section';
  }

  function digitsOf(value) {
    return String(value == null ? '' : value).replace(/[^\d+]/g, '');
  }

  function isPhoneLike(value) {
    return /^\+?\d{7,20}$/.test(digitsOf(value));
  }

  function isHttpUrl(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return false;
    try {
      var u = new URL(raw);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch (_) {
      return false;
    }
  }

  /* the public renderer accepts a local path under images/ or an https URL.
     "assets/images/…" is the current location; the bare "images/…" form is
     still accepted so an older stored value can round-trip through the form. */
  function isSafeImageRef(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return true; /* empty = keep the current portrait */
    if (/^(?:assets\/)?images\//i.test(raw) && raw.indexOf('..') === -1) return true;
    return /^https:\/\//i.test(raw) && isHttpUrl(raw);
  }

  function isAnchorOrUrl(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return false;
    if (raw.charAt(0) === '#') return raw.length > 1;
    if (raw.charAt(0) === '/') return true;
    return isHttpUrl(raw);
  }

  function buildWaUrl(number) {
    var d = digitsOf(number);
    if (!d) return '';
    if (d.charAt(0) !== '+') d = '+' + d;
    return 'https://wa.me/' + d.slice(1);
  }

  function buildTelUrl(number) {
    var d = digitsOf(number);
    if (!d) return '';
    if (d.charAt(0) !== '+') d = '+' + d;
    return 'tel:' + d;
  }

  function lines(text, max) {
    return String(text || '')
      .split(/\r?\n/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .slice(0, max || 99);
  }

  function prettyBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function setMsg(el, message, kind, busy) {
    if (!el) return;
    if (!message) {
      el.textContent = '';
      el.hidden = true;
      el.className = 'admin-status';
      return;
    }
    el.hidden = false;
    el.className = (kind === 'error' ? 'admin-error' : 'admin-status') + (busy ? ' is-busy' : '');
    el.textContent = message;
  }

  /* ============================================================ */
  /*  image validation + upload                                  */
  /* ============================================================ */

  /* returns an error string, or null when the file is acceptable */
  function validateImageFile(file) {
    if (!file) return 'No file was selected.';
    var type = String(file.type || '').toLowerCase();

    if (type === 'image/svg+xml' || /\.svg$/i.test(file.name || '')) {
      return 'SVG files are not allowed. Use a JPG, PNG or WebP image.';
    }
    if (type === 'image/gif' || /\.gif$/i.test(file.name || '')) {
      return 'GIF files are not allowed. Use a JPG, PNG or WebP image.';
    }
    if (type.indexOf('video/') === 0) {
      return 'Video files cannot be uploaded here.';
    }
    if (!ALLOWED_IMAGE_TYPES[type]) {
      return 'Only JPG, PNG or WebP images are allowed.';
    }
    if (!file.size) {
      return 'That file appears to be empty.';
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return 'That image is ' + prettyBytes(file.size) + '. The maximum size is 5 MB.';
    }
    return null;
  }

  async function uploadProfileImage(file, userId) {
    var ext = ALLOWED_IMAGE_TYPES[String(file.type || '').toLowerCase()];
    if (!ext) throw new Error('Only JPG, PNG or WebP images are allowed.');

    var path = PROFILE_FOLDER + userId + '/profile-' + Date.now() + '.' + ext;

    var res = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });
    if (res.error) throw res.error;

    var pub = sb.storage.from(BUCKET).getPublicUrl(path);
    var url = pub && pub.data ? pub.data.publicUrl : '';
    if (!url) throw new Error('The upload succeeded but no public URL was returned.');

    return { path: path, url: url };
  }

  /* ============================================================ */
  /*  admin gate                                                 */
  /* ============================================================ */

  var navLinks = { hero: null, contact: null, services: null, skills: null, experience: null, about: null, footer: null };
  var gateMessage = null;
  var contentPanels = function () { return document.querySelectorAll('.a-panel--content'); };
  var showOnlyContentPanel = function (id) {
    var panels = contentPanels();
    for (var i = 0; i < panels.length; i++) {
      panels[i].hidden = panels[i].id !== id;
    }
    if (id === 'projects-panel') {
      var p = document.getElementById('projects-panel');
      if (p) p.hidden = false;
    }
  };
  var showProjectsPanel = function () {
    contentPanels().forEach(function (p) { p.hidden = true; });
    var projectsPanel = document.getElementById('projects-panel');
    if (projectsPanel) projectsPanel.hidden = false;
  };

  async function isAdminSession() {
    var user = null;
    try {
      var res = await sb.auth.getUser();
      user = res && res.data ? res.data.user : null;
    } catch (_) {
      user = null;
    }
    if (!user) return { ok: false, reason: 'no-session' };

    var isAdmin = false;
    try {
      var p = await sb.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
      if (p.error) throw p.error;
      isAdmin = !!(p.data && p.data.is_admin === true);
    } catch (_) {
      isAdmin = false;
    }
    return { ok: isAdmin, reason: isAdmin ? 'ok' : 'not-admin', user: user };
  }

  /* ============================================================ */
  /*  persistence                                                */
  /* ============================================================ */

  async function readSection(sectionKey) {
    var res = await sb
      .from('portfolio_content')
      .select('section_key, content')
      .eq('section_key', sectionKey)
      .maybeSingle();
    if (res.error) throw res.error;
    return res.data && res.data.content ? res.data.content : null;
  }

  async function saveSection(sectionKey, content) {
    var res = await sb
      .from('portfolio_content')
      .upsert({ section_key: sectionKey, content: content }, { onConflict: 'section_key' })
      .select('section_key');
    if (res.error) throw res.error;
    return res.data;
  }

  /* ============================================================ */
  /*  generic editor wiring                                      */
  /* ============================================================ */

  function makeEditor(cfg) {
    var ed = {
      key: cfg.key,
      panelId: cfg.panelId,
      statusId: cfg.statusId,
      dirtyId: cfg.dirtyId,
      formId: cfg.formId,
      saveId: cfg.saveId,
      cancelId: cfg.cancelId,
      closeId: cfg.closeId,
      saveLabel: cfg.saveLabel,
      afterReset: cfg.afterReset,
      dirty: false,
      loaded: false,
      built: false,
      base: null,
      collect: cfg.collect,
      validate: cfg.validate,
      apply: cfg.apply,
      beforeSave: cfg.beforeSave,
      defaults: cfg.defaults,
      pendingUploadPath: null
    };

    ed.setDirty = function (on) {
      ed.dirty = !!on;
      var d = $(ed.dirtyId);
      if (d) d.hidden = !ed.dirty;
    };

    ed.load = async function () {
      var status = $(ed.statusId);
      var save = $(ed.saveId);
      var name = sectionLabel(ed.key);
      setMsg(status, 'Loading ' + name + '…', 'ok', true);
      if (save) save.disabled = true;
      try {
        var content = await readSection(ed.key);
        var merged = Object.assign({}, ed.defaults, content || {});
        ed.base = merged;
        ed.apply(merged);
        ed.setDirty(false);
        setMsg(status, name + ' loaded.', 'ok');
      } catch (err) {
        setMsg(status, 'Could not load ' + name + '. Please reload the page.', 'error');
      } finally {
        if (save) save.disabled = false;
      }
    };

    ed.reset = function () {
      if (!ed.base) return;
      ed.apply(ed.base);
      ed.setDirty(false);
      setMsg($(ed.statusId), '', 'ok');
      if (ed.afterReset) ed.afterReset();
    };

    ed.save = async function () {
      var status = $(ed.statusId);
      var save = $(ed.saveId);
      var data;

      try {
        data = ed.collect();
      } catch (err) {
        setMsg(status, (err && err.message) || 'Invalid input.', 'error');
        return;
      }

      var problems = ed.validate(data);
      if (problems.length) {
        setMsg(status, problems.join(' '), 'error');
        return;
      }

      if (save) save.disabled = true;
      setMsg(status, 'Saving…', 'ok', true);

      try {
        if (ed.beforeSave) {
          data = await ed.beforeSave(data, function (message) {
            setMsg(status, message, 'ok', true);
          });
        }
        await saveSection(ed.key, data);
        ed.pendingUploadPath = null;
        ed.base = Object.assign({}, ed.base, data);
        ed.setDirty(false);
        setMsg(status, name + ' saved successfully.', 'ok');
        if (ed.afterSave) ed.afterSave(data);
      } catch (err) {
        /* never leave an orphaned upload behind when the row write failed */
        if (ed.pendingUploadPath) {
          try { await sb.storage.from(BUCKET).remove([ed.pendingUploadPath]); } catch (_) { /* best effort */ }
          if (ed.afterUploadRollback) ed.afterUploadRollback();
          ed.pendingUploadPath = null;
        }
        var detail = (err && err.message) || 'Save failed.';
        var msg;
        if (/row-level security|permission denied|42501/i.test(detail)) {
          msg = 'You do not have permission to edit portfolio content.';
        } else if (err && err.statusCode === '403') {
          msg = 'The upload was refused by storage policy. Please try again.';
        } else {
          msg = 'Could not save ' + name + '. Please try again. (' + detail + ')';
        }
        setMsg(status, msg, 'error');
      } finally {
        if (save) save.disabled = false;
      }
    };

    ed.open = function () {
      showOnlyContentPanel(ed.panelId);
      if (!ed.built) return;
      if (!ed.loaded) {
        ed.loaded = true;
        ed.load();
      }
    };

    ed.bind = function () {
      var form = $(ed.formId);
      if (form) {
        form.addEventListener('input', function () { ed.setDirty(true); });
        form.addEventListener('change', function () { ed.setDirty(true); });
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          ed.save();
        });
      }
      var cancel = $(ed.cancelId);
      if (cancel) {
        cancel.addEventListener('click', function () {
          if (ed.dirty && !confirm('You have unsaved changes. Discard them?')) return;
          ed.reset();
        });
      }
      var close = $(ed.closeId);
      if (close) {
        close.addEventListener('click', function () {
          if (ed.dirty && !confirm('You have unsaved changes. Discard them?')) return;
          ed.reset();
          $(ed.panelId).hidden = true;
          showProjectsPanel();
        });
      }
    };

    return ed;
  }

  /* ============================================================ */
  /*  HERO                                                       */
  /* ============================================================ */

  var HERO_FIELDS = {
    eyebrow: 'hero-eyebrow',
    first_name: 'hero-first-name',
    last_name: 'hero-last-name',
    description_line_1: 'hero-description-1',
    description_line_2: 'hero-description-2',
    specializations: 'hero-specializations',
    cta_1_label: 'hero-cta-1-label',
    cta_1_href: 'hero-cta-1-href',
    cta_2_label: 'hero-cta-2-label',
    cta_2_href: 'hero-cta-2-href',
    availability_text: 'hero-availability-text',
    availability_enabled: 'hero-availability-enabled'
  };

  var HERO_DEFAULTS = {
    eyebrow: 'Frontend Developer & E-Commerce Specialist',
    first_name: 'Nourhan',
    last_name: 'Ashraf',
    description_line_1: 'I build clear, responsive web experiences — from e-commerce storefronts to modern brand websites.',
    description_line_2: 'Focused on storefront UI, content hierarchy, and purposeful interaction.',
    specializations: ['Frontend Developer', 'UI/UX Designer', 'E-Commerce Specialist'],
    profile_image: '',
    cta_1_label: 'View Selected Work',
    cta_1_href: '#projects',
    cta_2_label: 'Let\u2019s Talk',
    cta_2_href: '#contact',
    availability_text: 'Open for freelance & new projects',
    availability_enabled: true
  };

  /* image state: what is saved, what is pending, what was removed */
  var heroImage = {
    saved: '',      /* URL currently stored in the row */
    file: null,     /* newly picked File, not uploaded yet */
    removed: false, /* "Remove image" pressed */
    objectUrl: null
  };

  function heroSavedUrl(content) {
    if (!content) return '';
    if (typeof content.profile_image === 'string') return content.profile_image.trim();
    /* backward compatible with the earlier key */
    if (typeof content.profile_image_url === 'string') return content.profile_image_url.trim();
    return '';
  }

  function releaseObjectUrl() {
    if (heroImage.objectUrl) {
      try { URL.revokeObjectURL(heroImage.objectUrl); } catch (_) { /* noop */ }
      heroImage.objectUrl = null;
    }
  }

  function renderHeroImage() {
    var img = $('hero-image-preview-img');
    var empty = $('hero-image-empty');
    var name = $('hero-image-name');
    var removeBtn = $('hero-image-remove');
    var fileInput = $('hero-profile-image');
    if (!img || !empty || !name) return;

    var showSrc = '';
    var labelText = '';
    var isPending = false;

    if (heroImage.file) {
      releaseObjectUrl();
      try { heroImage.objectUrl = URL.createObjectURL(heroImage.file); } catch (_) { heroImage.objectUrl = null; }
      showSrc = heroImage.objectUrl || '';
      labelText = heroImage.file.name + ' · ' + prettyBytes(heroImage.file.size) + ' · not uploaded yet';
      isPending = true;
    } else if (heroImage.removed) {
      showSrc = '';
      labelText = 'No image — the portrait will fall back to the site default.';
    } else if (heroImage.saved) {
      showSrc = heroImage.saved;
      labelText = heroImage.saved;
    } else {
      showSrc = '';
      labelText = 'Using the portrait already on the site (assets/images/profile.jpg).';
    }

    if (showSrc) {
      img.onerror = function () {
        img.removeAttribute('src');
        img.hidden = true;
        empty.hidden = false;
        empty.textContent = 'That image could not be loaded.';
      };
      img.onload = function () {
        img.hidden = false;
        empty.hidden = true;
      };
      img.hidden = false;
      img.setAttribute('src', showSrc);
      empty.hidden = true;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
      empty.hidden = false;
      empty.textContent = heroImage.removed
        ? 'No image selected'
        : 'No image saved yet';
    }

    name.textContent = labelText;

    if (removeBtn) {
      /* only offered when there is something saved to remove */
      removeBtn.hidden = !(heroImage.saved && !heroImage.removed && !isPending);
    }
    /* A file input's .value is read-only unless it is set to '' — and
       reading it returns a fake "C:\\fakepath\\name" string, so the
       value must never be written back to itself. Only ever clear it,
       and only while no new file is pending. */
    if (fileInput && !isPending) fileInput.value = '';
  }

  var heroEditor = makeEditor({
    key: 'hero',
    panelId: 'content-hero',
    statusId: 'hero-status',
    dirtyId: 'hero-dirty',
    formId: 'hero-form',
    saveId: 'hero-save',
    cancelId: 'hero-cancel',
    closeId: 'hero-close',
    defaults: HERO_DEFAULTS,
    apply: function (c) {
      var v = function (k) { return $(HERO_FIELDS[k]); };
      v('eyebrow').value = c.eyebrow || '';
      v('first_name').value = c.first_name || '';
      v('last_name').value = c.last_name || '';
      v('description_line_1').value = c.description_line_1 || '';
      v('description_line_2').value = c.description_line_2 || '';
      v('specializations').value = (Array.isArray(c.specializations) ? c.specializations : []).join('\n');
      v('cta_1_label').value = c.cta_1_label || '';
      v('cta_1_href').value = c.cta_1_href || '';
      v('cta_2_label').value = c.cta_2_label || '';
      v('cta_2_href').value = c.cta_2_href || '';
      v('availability_text').value = c.availability_text || '';
      v('availability_enabled').checked = c.availability_enabled !== false;

      releaseObjectUrl();
      heroImage.file = null;
      heroImage.removed = false;
      heroImage.saved = heroSavedUrl(c);
      renderHeroImage();
    },
    afterReset: function () {
      renderHeroImage();
    },
    collect: function () {
      var v = function (k) { return $(HERO_FIELDS[k]).value.trim(); };
      return {
        eyebrow: v('eyebrow'),
        first_name: v('first_name'),
        last_name: v('last_name'),
        description_line_1: v('description_line_1'),
        description_line_2: v('description_line_2'),
        specializations: lines($(HERO_FIELDS.specializations).value, MAX.specializations),
        /* uploaded in beforeSave when a new file is pending */
        profile_image: heroImage.removed ? '' : heroImage.saved,
        cta_1_label: v('cta_1_label'),
        cta_1_href: v('cta_1_href'),
        cta_2_label: v('cta_2_label'),
        cta_2_href: v('cta_2_href'),
        availability_text: v('availability_text'),
        availability_enabled: !!$(HERO_FIELDS.availability_enabled).checked
      };
    },
    validate: function (d) {
      var p = [];
      if (!d.eyebrow) p.push('Eyebrow is required.');
      if (d.eyebrow.length > MAX.eyebrow) p.push('Eyebrow is too long (max ' + MAX.eyebrow + ').');
      if (!d.first_name) p.push('First name is required.');
      if (d.first_name.length > MAX.name) p.push('First name is too long (max ' + MAX.name + ').');
      if (!d.last_name) p.push('Last name is required.');
      if (d.last_name.length > MAX.name) p.push('Last name is too long (max ' + MAX.name + ').');
      if (!d.description_line_1) p.push('Description line 1 is required.');
      if (d.description_line_1.length > MAX.description) p.push('Description line 1 is too long.');
      if (d.description_line_2.length > MAX.description) p.push('Description line 2 is too long.');
      if (d.cta_1_label.length > MAX.ctaLabel) p.push('Primary CTA label is too long.');
      if (d.cta_2_label.length > MAX.ctaLabel) p.push('Secondary CTA label is too long.');
      if (d.cta_1_href && !isAnchorOrUrl(d.cta_1_href)) p.push('Primary CTA link must be a #section or a full URL.');
      if (d.cta_2_href && !isAnchorOrUrl(d.cta_2_href)) p.push('Secondary CTA link must be a #section or a full URL.');
      if (d.availability_text.length > MAX.availability) p.push('Availability text is too long.');
      if (!isSafeImageRef(d.profile_image)) p.push('The profile image must be a local assets/images/ path or an https URL.');
      if (d.profile_image.length > MAX.imageUrl) p.push('The profile image URL is too long.');
      d.specializations.forEach(function (s) {
        if (s.length > MAX.specialization) p.push('Specialization "' + s.slice(0, 20) + '…" is too long (max ' + MAX.specialization + ').');
      });
      /* the picker itself is validated before we get here, but re-check so a
         file swapped in programmatically can never slip through */
      if (heroImage.file) {
        var fileError = validateImageFile(heroImage.file);
        if (fileError) p.push(fileError);
      }
      return p;
    },
    beforeSave: async function (data, setBusy) {
      if (!heroImage.file) return data; /* nothing new — keep what is saved */

      setBusy('Checking permission…');
      var gate = await isAdminSession();
      if (!gate.ok) throw new Error('You do not have permission to edit portfolio content.');

      var fileError = validateImageFile(heroImage.file);
      if (fileError) throw new Error(fileError);

      setBusy('Uploading ' + heroImage.file.name + '… please wait.');
      var uploaded = await uploadProfileImage(heroImage.file, gate.user.id);

      heroEditor.pendingUploadPath = uploaded.path;
      data.profile_image = uploaded.url;
      return data;
    },
    afterSave: function () {
      /* the upload is now the saved image */
      if (heroImage.file) {
        releaseObjectUrl();
        heroImage.file = null;
      }
      heroImage.removed = false;
    }
  });

  heroEditor.afterUploadRollback = function () {
    /* the row write failed, so keep the previously working image on screen */
    renderHeroImage();
  };

  function heroTemplate() {
    var L = MAX;
    return '' +
    '<section class="a-panel a-panel--content" id="content-hero" hidden>' +
      '<div class="a-panel__head">' +
        '<div>' +
          '<h2 class="a-panel__title">Hero</h2>' +
          '<p class="a-panel__sub">Edit the homepage headline, portrait, and buttons.</p>' +
        '</div>' +
        '<div class="a-panel__tools">' +
          '<span class="admin-dirty" id="hero-dirty" hidden>Unsaved changes</span>' +
          '<button class="admin-iconbtn" type="button" id="hero-close" aria-label="Close hero editor">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-status" id="hero-status" role="status" aria-live="polite" hidden></div>' +
      '<form id="hero-form" autocomplete="off" novalidate>' +

        '<fieldset class="a-fieldset"><legend>Portrait</legend>' +
          '<div class="admin-media">' +
            '<div class="admin-media__preview">' +
              '<img id="hero-image-preview-img" alt="" hidden />' +
              '<span class="admin-media__empty" id="hero-image-empty">No image saved yet</span>' +
            '</div>' +
            '<div class="admin-media__meta">' +
              '<p class="admin-media__name" id="hero-image-name">Using the portrait already on the site.</p>' +
              '<p class="admin-media__hint">JPG, PNG or WebP · max 5 MB.</p>' +
              '<div class="admin-media__actions">' +
                '<input id="hero-profile-image" name="hero-profile-image" type="file" ' +
                  'class="admin-file-input" accept="image/jpeg,image/png,image/webp" />' +
                '<label class="btn btn--ghost admin-filebtn" for="hero-profile-image">Choose image</label>' +
                '<button type="button" class="btn btn--ghost" id="hero-image-remove" hidden>Remove image</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</fieldset>' +

        '<fieldset class="a-fieldset"><legend>Copy</legend>' +
          field('hero-eyebrow', 'Eyebrow', 'text', L.eyebrow) +
          '<div class="a-grid a-grid--2">' +
            field('hero-first-name', 'First name', 'text', L.name) +
            field('hero-last-name', 'Last name', 'text', L.name) +
          '</div>' +
          field('hero-description-1', 'Description line 1', 'text', L.description) +
          field('hero-description-2', 'Description line 2', 'text', L.description) +
        '</fieldset>' +

        '<fieldset class="a-fieldset"><legend>Specializations</legend>' +
          '<p class="admin-hint">One per line (max ' + L.specializations + '). The homepage rotates through these.</p>' +
          '<div class="admin-field">' +
            '<label for="hero-specializations">Specializations</label>' +
            '<textarea id="hero-specializations" rows="4" autocomplete="off" placeholder="Frontend Developer&#10;UI/UX Designer&#10;E-Commerce Specialist"></textarea>' +
          '</div>' +
        '</fieldset>' +

        '<fieldset class="a-fieldset"><legend>Call to action</legend>' +
          '<div class="a-grid a-grid--2">' +
            field('hero-cta-1-label', 'Primary CTA label', 'text', L.ctaLabel) +
            field('hero-cta-1-href', 'Primary CTA link', 'text', L.ctaHref, '#projects') +
          '</div>' +
          '<div class="a-grid a-grid--2">' +
            field('hero-cta-2-label', 'Secondary CTA label', 'text', L.ctaLabel) +
            field('hero-cta-2-href', 'Secondary CTA link', 'text', L.ctaHref, '#contact') +
          '</div>' +
        '</fieldset>' +

        '<fieldset class="a-fieldset"><legend>Availability</legend>' +
          field('hero-availability-text', 'Availability text', 'text', L.availability) +
          '<div class="admin-field"><label class="admin-checkbox">' +
            '<input id="hero-availability-enabled" type="checkbox" checked />' +
            '<span>Show the availability line</span>' +
          '</label></div>' +
        '</fieldset>' +

        '<div class="admin-form-actions">' +
          '<button type="button" class="btn btn--ghost" id="hero-cancel">Reset</button>' +
          '<button type="submit" class="btn btn--primary" id="hero-save">Save Hero</button>' +
        '</div>' +
      '</form>' +
    '</section>';
  }

  function field(id, label, type, maxlength, placeholder) {
    return '<div class="admin-field">' +
      '<label for="' + id + '">' + label + '</label>' +
      '<input id="' + id + '" type="' + type + '" maxlength="' + maxlength + '" autocomplete="off"' +
      (placeholder ? ' placeholder="' + placeholder + '"' : '') + ' />' +
      '</div>';
  }

  function bindHeroImage() {
    var input = $('hero-profile-image');
    if (!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';

    input.addEventListener('change', function () {
      var file = this.files && this.files[0] ? this.files[0] : null;
      var status = $('hero-status');
      if (!file) return;

      var problem = validateImageFile(file);
      if (problem) {
        heroImage.file = null;
        /* clear the picker so the same bad file can be re-chosen after fixing it */
        this.value = '';
        renderHeroImage();
        setMsg(status, problem, 'error');
        return;
      }

      heroImage.file = file;
      heroImage.removed = false;
      renderHeroImage();
      setMsg(status, 'Image selected — not uploaded yet. It uploads when you save.', 'ok');
      heroEditor.setDirty(true);
    });

    var removeBtn = $('hero-image-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        if (!heroImage.saved) return;
        if (!confirm('Remove the saved profile image? The row will be saved without it.')) return;
        releaseObjectUrl();
        heroImage.file = null;
        heroImage.removed = true;
        var picker = $('hero-profile-image');
        if (picker) picker.value = '';
        renderHeroImage();
        heroEditor.setDirty(true);
      });
    }
  }

  /* ============================================================ */
  /*  CONTACT                                                    */
  /* ============================================================ */

  var C_FIELDS = {
    heading: 'contact-heading',
    description: 'contact-description',
    whatsapp_number: 'contact-whatsapp',
    whatsapp_visible: 'contact-whatsapp-visible',
    phone_number: 'contact-phone',
    phone_visible: 'contact-phone-visible',
    linkedin_url: 'contact-linkedin',
    linkedin_visible: 'contact-linkedin-visible',
    github_url: 'contact-github',
    github_visible: 'contact-github-visible'
  };

  var CONTACT_DEFAULTS = {
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

  var contactEditor = makeEditor({
    key: 'contact',
    panelId: 'content-contact',
    statusId: 'contact-status',
    dirtyId: 'contact-dirty',
    formId: 'contact-form',
    saveId: 'contact-save',
    cancelId: 'contact-cancel',
    closeId: 'contact-close',
    defaults: CONTACT_DEFAULTS,
    apply: function (c) {
      var v = function (k) { return $(C_FIELDS[k]); };
      v('heading').value = c.heading || '';
      v('description').value = c.description || '';
      v('whatsapp_number').value = c.whatsapp_number || '';
      v('whatsapp_visible').checked = c.whatsapp_visible !== false;
      v('phone_number').value = c.phone_number || '';
      v('phone_visible').checked = c.phone_visible !== false;
      v('linkedin_url').value = c.linkedin_url || '';
      v('linkedin_visible').checked = c.linkedin_visible !== false;
      v('github_url').value = c.github_url || '';
      v('github_visible').checked = c.github_visible !== false;
    },
    collect: function () {
      var v = function (k) { return $(C_FIELDS[k]).value.trim(); };
      var wa = v('whatsapp_number');
      var ph = v('phone_number');
      return {
        heading: v('heading'),
        description: v('description'),
        whatsapp_number: wa,
        whatsapp_url: buildWaUrl(wa),
        whatsapp_visible: !!$(C_FIELDS.whatsapp_visible).checked,
        phone_number: ph,
        phone_url: buildTelUrl(ph),
        phone_visible: !!$(C_FIELDS.phone_visible).checked,
        linkedin_url: v('linkedin_url'),
        linkedin_visible: !!$(C_FIELDS.linkedin_visible).checked,
        github_url: v('github_url'),
        github_visible: !!$(C_FIELDS.github_visible).checked
      };
    },
    validate: function (d) {
      var p = [];
      if (!d.heading) p.push('Heading is required.');
      if (d.heading.length > MAX.heading) p.push('Heading is too long.');
      if (!d.description) p.push('Description is required.');
      if (d.description.length > MAX.contactDescription) p.push('Description is too long.');
      if (!d.whatsapp_number) p.push('WhatsApp number is required.');
      else if (!isPhoneLike(d.whatsapp_number)) p.push('WhatsApp number is not a valid phone number.');
      else if (d.whatsapp_number.length > MAX.phone) p.push('WhatsApp number is too long.');
      if (!d.phone_number) p.push('Phone number is required.');
      else if (!isPhoneLike(d.phone_number)) p.push('Phone number is not a valid phone number.');
      else if (d.phone_number.length > MAX.phone) p.push('Phone number is too long.');
      if (!d.linkedin_url) p.push('LinkedIn URL is required.');
      else if (!isHttpUrl(d.linkedin_url)) p.push('LinkedIn URL must be a full http(s) URL.');
      else if (d.linkedin_url.length > MAX.url) p.push('LinkedIn URL is too long.');
      if (!d.github_url) p.push('GitHub URL is required.');
      else if (!isHttpUrl(d.github_url)) p.push('GitHub URL must be a full http(s) URL.');
      else if (d.github_url.length > MAX.url) p.push('GitHub URL is too long.');
      return p;
    }
  });

  function contactTemplate() {
    return '' +
    '<section class="a-panel a-panel--content" id="content-contact" hidden>' +
      '<div class="a-panel__head">' +
        '<div>' +
          '<h2 class="a-panel__title">Contact</h2>' +
          '<p class="a-panel__sub">Edit the contact heading and the ways visitors can reach you.</p>' +
        '</div>' +
        '<div class="a-panel__tools">' +
          '<span class="admin-dirty" id="contact-dirty" hidden>Unsaved changes</span>' +
          '<button class="admin-iconbtn" type="button" id="contact-close" aria-label="Close contact editor">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-status" id="contact-status" role="status" aria-live="polite" hidden></div>' +
      '<form id="contact-form" autocomplete="off" novalidate>' +
        '<fieldset class="a-fieldset"><legend>Copy</legend>' +
          field('contact-heading', 'Heading', 'text', MAX.heading) +
          '<div class="admin-field">' +
            '<label for="contact-description">Description</label>' +
            '<textarea id="contact-description" rows="3" maxlength="' + MAX.contactDescription + '" autocomplete="off"></textarea>' +
          '</div>' +
        '</fieldset>' +
        '<fieldset class="a-fieldset"><legend>WhatsApp</legend>' +
          '<div class="a-grid a-grid--2">' +
            field('contact-whatsapp', 'Number', 'tel', MAX.phone, '+201011405879') +
            '<div class="admin-field"><label class="admin-checkbox">' +
              '<input id="contact-whatsapp-visible" type="checkbox" checked />' +
              '<span>Show this row</span>' +
            '</label></div>' +
          '</div>' +
        '</fieldset>' +
        '<fieldset class="a-fieldset"><legend>Phone</legend>' +
          '<div class="a-grid a-grid--2">' +
            field('contact-phone', 'Number', 'tel', MAX.phone, '+201011405879') +
            '<div class="admin-field"><label class="admin-checkbox">' +
              '<input id="contact-phone-visible" type="checkbox" checked />' +
              '<span>Show this row</span>' +
            '</label></div>' +
          '</div>' +
        '</fieldset>' +
        '<fieldset class="a-fieldset"><legend>LinkedIn</legend>' +
          '<div class="a-grid a-grid--2">' +
            field('contact-linkedin', 'LinkedIn URL', 'url', MAX.url, 'https://linkedin.com/in/…') +
            '<div class="admin-field"><label class="admin-checkbox">' +
              '<input id="contact-linkedin-visible" type="checkbox" checked />' +
              '<span>Show this row</span>' +
            '</label></div>' +
          '</div>' +
        '</fieldset>' +
        '<fieldset class="a-fieldset"><legend>GitHub</legend>' +
          '<div class="a-grid a-grid--2">' +
            field('contact-github', 'GitHub URL', 'url', MAX.url, 'https://github.com/…') +
            '<div class="admin-field"><label class="admin-checkbox">' +
              '<input id="contact-github-visible" type="checkbox" checked />' +
              '<span>Show this row</span>' +
            '</label></div>' +
          '</div>' +
        '</fieldset>' +
        '<div class="admin-form-actions">' +
          '<button type="button" class="btn btn--ghost" id="contact-cancel">Reset</button>' +
          '<button type="submit" class="btn btn--primary" id="contact-save">Save Contact</button>' +
        '</div>' +
      '</form>' +
    '</section>';
  }

  /* ============================================================ */
  /*  Repeatable lists — Services and Skills                     */
  /* ============================================================ */

  /* The one escaping function for stored values that reach innerHTML lives
     in js/util.js, which loads before this file — this used to be a second,
     byte-identical copy of the same helper in js/public-content.js. */
  var escapeHtml = window.NPUtil.esc;

  function toInt(value, fallback) {
    var n = parseInt(String(value == null ? '' : value).trim(), 10);
    if (isNaN(n)) return fallback;
    return n;
  }

  /* "a, b , c" → ['a','b','c'], trimmed, deduped, capped */
  function parseCsv(value, max, maxLen) {
    var parts = String(value == null ? '' : value).split(',');
    var seen = {};
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i].trim();
      if (!s) continue;
      if (s.length > maxLen) s = s.slice(0, maxLen).trim();
      if (seen[s.toLowerCase()]) continue;
      seen[s.toLowerCase()] = true;
      out.push(s);
      if (out.length >= max) break;
    }
    return out;
  }

  var LIST_MAX = {
    serviceTitle: 120,
    serviceDesc: 600,
    tag: 60,
    tags: 12,
    skillName: 60,
    category: 40,
    order: 9999
  };

  function makeListEditor(cfg) {
    var ed = {
      table: cfg.table,
      columns: cfg.columns,
      noun: cfg.noun,
      plural: cfg.plural,
      panelId: cfg.panelId,
      statusId: cfg.statusId,
      formId: cfg.formId,
      formTitleId: cfg.formTitleId,
      listId: cfg.listId,
      countId: cfg.countId,
      rows: [],
      editingId: null,
      built: false,
      loaded: false,
      collect: cfg.collect,
      validate: cfg.validate,
      rowMarkup: cfg.rowMarkup
    };

    ed.name = function (n) {
      return n === 1 ? ed.noun : ed.plural;
    };

    ed.setStatus = function (message, kind, busy) {
      setMsg($(ed.statusId), message, kind, busy);
    };

    /* ---------- read ---------- */

    ed.load = async function () {
      ed.setStatus('Loading ' + ed.plural + '…', 'ok', true);
      try {
        var res = await sb.from(ed.table).select(ed.columns)
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true });
        if (res.error) throw res.error;
        ed.rows = res.data || [];
        ed.render();
        ed.setStatus(ed.rows.length
          ? ed.rows.length + ' ' + ed.name(ed.rows.length) + ' loaded.'
          : 'No ' + ed.plural + ' yet. Use “Add ' + ed.noun + '” to create one.', 'ok');
      } catch (err) {
        var detail = (err && err.message) || '';
        ed.setStatus(/permission denied|row-level security|42501/i.test(detail)
          ? 'You do not have permission to view ' + ed.plural + '.'
          : 'Could not load ' + ed.plural + '. Please reload the page.', 'error');
      }
    };

    /* ---------- render ---------- */

    ed.render = function () {
      var host = $(ed.listId);
      var count = $(ed.countId);
      if (count) {
        count.textContent = ed.rows.length ? '( ' + ed.rows.length + ' )' : '';
      }
      if (!host) return;
      if (!ed.rows.length) {
        host.innerHTML = '<p class="admin-hint">Nothing here yet.</p>';
        return;
      }
      var html = '<' + 'ul class="admin-list">';
      for (var i = 0; i < ed.rows.length; i++) {
        html += ed.rowMarkup(ed.rows[i], i, ed.rows.length);
      }
      html += '</' + 'ul>';
      host.innerHTML = html;
    };

    function rowById(id) {
      for (var i = 0; i < ed.rows.length; i++) {
        if (String(ed.rows[i].id) === String(id)) return ed.rows[i];
      }
      return null;
    }

    function setField(name, value) {
      var el = $(name);
      if (el) el.value = value == null ? '' : String(value);
    }

    function setCheck(name, on) {
      var el = $(name);
      if (el) el.checked = !!on;
    }

    function fieldValue(name) {
      var el = $(name);
      return el ? el.value : '';
    }

    /* ---------- the shared add/edit form ---------- */

    ed.openForm = function (row) {
      ed.editingId = row ? row.id : null;
      var title = $(ed.formTitleId);
      if (title) title.textContent = row ? 'Edit ' + ed.noun : 'New ' + ed.noun;
      cfg.fill(row || {});
      var form = $(ed.formId);
      if (form) form.hidden = false;
      ed.setStatus('', 'ok');
      var first = form && form.querySelector('input, textarea, select');
      if (first) first.focus();
      if (form) form.scrollIntoView({ block: 'nearest' });
    };

    ed.closeForm = function () {
      ed.editingId = null;
      var form = $(ed.formId);
      if (form) form.hidden = true;
      cfg.fill({});
    };

    ed.submit = async function (ev) {
      if (ev) ev.preventDefault();
      var data;
      try {
        data = ed.collect(fieldValue, toInt, parseCsv, LIST_MAX);
      } catch (err) {
        ed.setStatus((err && err.message) || 'Invalid input.', 'error');
        return;
      }

      var problems = ed.validate(data, LIST_MAX);
      if (problems.length) {
        ed.setStatus(problems.join(' '), 'error');
        return;
      }

      var save = $(cfg.saveId);
      if (save) save.disabled = true;
      ed.setStatus('Saving…', 'ok', true);

      try {
        if (ed.editingId == null) {
          var ins = await sb.from(ed.table).insert(data).select(ed.columns);
          if (ins.error) throw ins.error;
          var created = ins.data && ins.data[0];
          if (created) ed.rows.push(created);
          ed.setStatus('New ' + ed.noun + ' saved.', 'ok');
        } else {
          var upd = await sb.from(ed.table).update(data).eq('id', ed.editingId).select(ed.columns);
          if (upd.error) throw upd.error;
          var changed = upd.data && upd.data[0];
          for (var i = 0; i < ed.rows.length; i++) {
            if (String(ed.rows[i].id) === String(ed.editingId)) {
              ed.rows[i] = changed || Object.assign({}, ed.rows[i], data);
              break;
            }
          }
          ed.setStatus(ed.noun.charAt(0).toUpperCase() + ed.noun.slice(1) + ' updated.', 'ok');
        }
        ed.closeForm();
        ed.sortLocal();
        ed.render();
      } catch (err) {
        var d = (err && err.message) || 'Save failed.';
        ed.setStatus(/row-level security|permission denied|42501/i.test(d)
          ? 'You do not have permission to edit ' + ed.plural + '.'
          : 'Could not save this ' + ed.noun + '. Please try again.', 'error');
      } finally {
        if (save) save.disabled = false;
      }
    };

    ed.sortLocal = function () {
      ed.rows.sort(function (a, b) {
        var ao = toInt(a.sort_order, 0);
        var bo = toInt(b.sort_order, 0);
        if (ao !== bo) return ao - bo;
        return toInt(a.id, 0) - toInt(b.id, 0);
      });
    };

    /* ---------- row actions (event delegation) ---------- */

    ed.bindList = function () {
      var host = $(ed.listId);
      if (!host || host.dataset.bound === '1') return;
      host.dataset.bound = '1';
      host.addEventListener('click', function (ev) {
        var btn = ev.target.closest ? ev.target.closest('[data-action]') : null;
        if (!btn || !host.contains(btn)) return;
        var rowEl = btn.closest('.admin-list__row');
        if (!rowEl) return;
        var id = rowEl.dataset.id;
        var action = btn.dataset.action;
        ev.preventDefault();
        if (action === 'edit') {
          var row = rowById(id);
          if (row) ed.openForm(row);
        } else if (action === 'delete') {
          cfg.onDelete(ed, rowById(id));
        } else if (action === 'up' || action === 'down') {
          ed.move(id, action === 'up' ? -1 : 1);
        }
      });
      host.addEventListener('change', function (ev) {
        var box = ev.target;
        if (!box || !box.dataset || box.dataset.action !== 'visible') return;
        var rowEl = box.closest('.admin-list__row');
        if (!rowEl) return;
        ed.setVisible(rowEl.dataset.id, box.checked);
      });
    };

    ed.remove = async function (id) {
      ed.setStatus('Deleting…', 'ok', true);
      try {
        var res = await sb.from(ed.table).delete().eq('id', id);
        if (res.error) throw res.error;
        ed.rows = ed.rows.filter(function (r) { return String(r.id) !== String(id); });
        ed.render();
        ed.setStatus(ed.noun.charAt(0).toUpperCase() + ed.noun.slice(1) + ' deleted.', 'ok');
      } catch (err) {
        var d = (err && err.message) || 'Delete failed.';
        ed.setStatus(/row-level security|permission denied|42501/i.test(d)
          ? 'You do not have permission to delete ' + ed.plural + '.'
          : 'Could not delete this ' + ed.noun + '. Please try again.', 'error');
      }
    };

    ed.setVisible = async function (id, on) {
      var row = rowById(id);
      if (!row) return;
      var previous = !!row.is_visible;
      row.is_visible = !!on;           /* optimistic, so the UI never lies */
      ed.render();
      try {
        var res = await sb.from(ed.table).update({ is_visible: !!on }).eq('id', id).select(ed.columns);
        if (res.error) throw res.error;
        if (res.data && res.data[0]) {
          for (var i = 0; i < ed.rows.length; i++) {
            if (String(ed.rows[i].id) === String(id)) { ed.rows[i] = res.data[0]; break; }
          }
        }
        ed.render();
        ed.setStatus(on
          ? ed.noun.charAt(0).toUpperCase() + ed.noun.slice(1) + ' is now visible on the site.'
          : ed.noun.charAt(0).toUpperCase() + ed.noun.slice(1) + ' is now hidden from the site.', 'ok');
      } catch (err) {
        row.is_visible = previous;      /* put the switch back where it was */
        ed.render();
        var d = (err && err.message) || '';
        ed.setStatus(/row-level security|permission denied|42501/i.test(d)
          ? 'You do not have permission to change visibility.'
          : 'Could not change visibility. Please try again.', 'error');
      }
    };

    /* Swaps with the neighbouring row and rewrites 1..n, so the order is
       always deterministic and never depends on two equal values. */
    ed.move = async function (id, delta) {
      var index = -1;
      for (var i = 0; i < ed.rows.length; i++) {
        if (String(ed.rows[i].id) === String(id)) { index = i; break; }
      }
      if (index < 0) return;
      var target = index + delta;
      if (target < 0 || target >= ed.rows.length) return;

      var reordered = ed.rows.slice();
      var moved = reordered.splice(index, 1)[0];
      reordered.splice(target, 0, moved);

      var previous = ed.rows.slice();
      ed.rows = reordered.map(function (r, i) {
        return Object.assign({}, r, { sort_order: i + 1 });
      });
      ed.render();
      ed.setStatus('Saving order…', 'ok', true);

      try {
        for (var n = 0; n < ed.rows.length; n++) {
          if (toInt(previous[n] && previous[n].id, -1) === toInt(ed.rows[n].id, -2) &&
              toInt(previous[n].sort_order, null) === ed.rows[n].sort_order) {
            continue;   /* unchanged — skip the write */
          }
          var res = await sb.from(ed.table)
            .update({ sort_order: ed.rows[n].sort_order })
            .eq('id', ed.rows[n].id);
          if (res.error) throw res.error;
        }
        ed.render();
        ed.setStatus('Order saved.', 'ok');
      } catch (err) {
        ed.rows = previous;            /* roll the list back */
        ed.render();
        var d = (err && err.message) || '';
        ed.setStatus(/row-level security|permission denied|42501/i.test(d)
          ? 'You do not have permission to reorder ' + ed.plural + '.'
          : 'Could not save the new order.', 'error');
      }
    };

    ed.open = function () {
      showOnlyContentPanel(ed.panelId);
      if (!ed.loaded) { ed.loaded = true; ed.load(); }
    };

    ed.bind = function () {
      var form = $(ed.formId);
      if (form) {
        form.addEventListener('submit', function (ev) { ed.submit(ev); });
        var cancel = $(cfg.formCancelId);
        if (cancel) cancel.addEventListener('click', function () { ed.closeForm(); });
      }
      var add = $(cfg.addId);
      if (add) add.addEventListener('click', function () { ed.openForm(null); });
      var reload = $(cfg.reloadId);
      if (reload) reload.addEventListener('click', function () { ed.load(); });
      var close = $(cfg.closeId);
      if (close) close.addEventListener('click', function () {
        ed.closeForm();
        $(ed.panelId).hidden = true;
        showProjectsPanel();
      });
      ed.bindList();
    };

    return ed;
  }

  function listRowShell(inner, row, index, total) {
    var hidden = row.is_visible === false;
    return '<li class="admin-list__row' + (hidden ? ' is-hidden-row' : '') + '" data-id="' +
      escapeHtml(row.id) + '">' +
      '<span class="admin-list__order">' +
        '<button type="button" class="admin-iconbtn" data-action="up"' +
          (index === 0 ? ' disabled' : '') + ' aria-label="Move up" title="Move up">↑</button>' +
        '<button type="button" class="admin-iconbtn" data-action="down"' +
          (index === total - 1 ? ' disabled' : '') + ' aria-label="Move down" title="Move down">↓</button>' +
        '<span class="admin-list__pos">' + (index + 1) + '</span>' +
      '</span>' +
      inner +
      '<span class="admin-list__state">' + (hidden ? 'Hidden' : 'Visible') + '</span>' +
      '<label class="admin-checkbox admin-list__toggle">' +
        '<input type="checkbox" data-action="visible"' + (hidden ? '' : ' checked') + ' />' +
        '<span class="admin-list__toggle-text">Show</span>' +
      '</label>' +
      '<span class="admin-list__actions">' +
        '<button type="button" class="btn btn--ghost" data-action="edit">Edit</button>' +
        '<button type="button" class="btn btn--danger" data-action="delete">Delete</button>' +
      '</span>' +
      '</li>';
  }

  function confirmDelete(ed, row) {
    if (!row) return;
    var label = row.title || row.name || 'this item';
    if (!confirm('Delete “' + label + '”?\n\nThis removes it from the site and cannot be undone.')) return;
    ed.remove(row.id);
  }

  /* ---------- services ---------- */

  var servicesEditor = makeListEditor({
    table: 'services',
    columns: 'id, title, description, tags, sort_order, is_visible, created_at, updated_at',
    noun: 'service',
    plural: 'services',
    panelId: 'content-services',
    statusId: 'services-status',
    formId: 'services-form',
    formTitleId: 'services-form-title',
    listId: 'services-list',
    countId: 'services-count',
    addId: 'services-add',
    saveId: 'services-form-save',
    formCancelId: 'services-form-cancel',
    reloadId: 'services-reload',
    closeId: 'services-close',
    fill: function (row) {
      var set = function (id, v) { var el = $(id); if (el) el.value = v == null ? '' : String(v); };
      set('service-title', row.title || '');
      set('service-description', row.description || '');
      set('service-tags', Array.isArray(row.tags) ? row.tags.join(', ') : (row.tags || ''));
      set('service-order', row.sort_order == null ? '' : row.sort_order);
      var box = $('service-visible');
      if (box) box.checked = row.is_visible !== false;
    },
    collect: function (val, toIntFn, parseCsvFn, M) {
      return {
        title: val('service-title').trim(),
        description: val('service-description').trim(),
        tags: parseCsvFn(val('service-tags'), M.tags, M.tag),
        sort_order: toIntFn(val('service-order'), 0),
        is_visible: !!($('service-visible') && $('service-visible').checked)
      };
    },
    validate: function (d, M) {
      var p = [];
      if (!d.title) p.push('A title is required.');
      else if (d.title.length > M.serviceTitle) p.push('The title is too long (max ' + M.serviceTitle + ').');
      if (!d.description) p.push('A description is required.');
      else if (d.description.length > M.serviceDesc) p.push('The description is too long (max ' + M.serviceDesc + ').');
      if (d.sort_order < 0 || d.sort_order > M.order) p.push('Order must be between 0 and ' + M.order + '.');
      return p;
    },
    rowMarkup: function (row, index, total) {
      var tags = Array.isArray(row.tags) ? row.tags : [];
      var meta = tags.length ? tags.slice(0, 4).join(' · ') : 'No tags';
      var inner =
        '<span class="admin-list__main">' +
          '<span class="admin-list__title">' + escapeHtml(row.title || '(untitled)') + '</span>' +
          '<span class="admin-list__meta">' + escapeHtml(meta) + '</span>' +
        '</span>';
      return listRowShell(inner, row, index, total);
    },
    onDelete: confirmDelete
  });

  /* ---------- skills ---------- */

  var skillsEditor = makeListEditor({
    table: 'skills',
    columns: 'id, name, category, icon_key, sort_order, is_visible, created_at, updated_at',
    noun: 'skill',
    plural: 'skills',
    panelId: 'content-skills',
    statusId: 'skills-status',
    formId: 'skills-form',
    formTitleId: 'skills-form-title',
    listId: 'skills-list',
    countId: 'skills-count',
    addId: 'skills-add',
    saveId: 'skills-form-save',
    formCancelId: 'skills-form-cancel',
    reloadId: 'skills-reload',
    closeId: 'skills-close',
    fill: function (row) {
      var set = function (id, v) { var el = $(id); if (el) el.value = v == null ? '' : String(v); };
      set('skill-name', row.name || '');
      set('skill-category', row.category || '');
      var sel = $('skill-icon');
      if (sel) {
        var lib = window.IconLibrary;
        var key = row.icon_key || '';
        sel.innerHTML = lib ? lib.options(key) : '<option value="">Icons unavailable</option>';
      }
      set('skill-order', row.sort_order == null ? '' : row.sort_order);
      var box = $('skill-visible');
      if (box) box.checked = row.is_visible !== false;
      renderSkillPreview($('skill-icon') ? $('skill-icon').value : '');
    },
    collect: function (val, toIntFn, parseCsvFn, M) {
      return {
        name: val('skill-name').trim(),
        category: val('skill-category').trim(),
        icon_key: val('skill-icon'),
        sort_order: toIntFn(val('skill-order'), 0),
        is_visible: !!($('skill-visible') && $('skill-visible').checked)
      };
    },
    validate: function (d, M) {
      var p = [];
      var lib = window.IconLibrary;
      if (!d.name) p.push('A name is required.');
      else if (d.name.length > M.skillName) p.push('The name is too long (max ' + M.skillName + ').');
      if (!d.category) p.push('A category is required.');
      else if (d.category.length > M.category) p.push('The category is too long (max ' + M.category + ').');
      if (!lib) p.push('The icon library failed to load, so no icon can be saved.');
      else if (!lib.isAllowed(d.icon_key)) p.push('Choose an icon from the list.');
      if (d.sort_order < 0 || d.sort_order > M.order) p.push('Order must be between 0 and ' + M.order + '.');
      return p;
    },
    rowMarkup: function (row, index, total) {
      var lib = window.IconLibrary;
      var allowed = lib && lib.isAllowed(row.icon_key);
      var icon = allowed ? lib.render(row.icon_key, 'admin-list__icon-svg') : '';
      var inner =
        '<span class="admin-list__icon" aria-hidden="true">' + icon + '</span>' +
        '<span class="admin-list__main">' +
          '<span class="admin-list__title">' + escapeHtml(row.name || '(unnamed)') + '</span>' +
          '<span class="admin-list__meta">' + escapeHtml(row.category || 'No category') +
            (allowed ? '' : ' · icon not recognised') + '</span>' +
        '</span>';
      return listRowShell(inner, row, index, total);
    },
    onDelete: confirmDelete
  });

  function renderSkillPreview(key) {
    var host = $('skill-icon-preview');
    if (!host) return;
    var lib = window.IconLibrary;
    if (!lib || !lib.isAllowed(key)) {
      host.innerHTML = '<span class="admin-hint">No icon selected</span>';
      return;
    }
    host.innerHTML = '<span class="stack-item__icon" aria-hidden="true">' +
      lib.render(key) + '</span>' +
      '<span class="admin-hint">' + escapeHtml(lib.labelFor(key)) + '</span>';
  }

  function servicesTemplate() {
    return '' +
    '<section class="a-panel a-panel--content" id="content-services" hidden>' +
      '<div class="a-panel__head">' +
        '<div>' +
          '<h2 class="a-panel__title">Services <span class="admin-count" id="services-count"></span></h2>' +
          '<p class="a-panel__sub">What you offer. These are the cards in the Services section.</p>' +
        '</div>' +
        '<div class="a-panel__tools">' +
          '<button class="btn btn--ghost" type="button" id="services-reload">Reload</button>' +
          '<button class="btn btn--primary" type="button" id="services-add">Add service</button>' +
          '<button class="admin-iconbtn" type="button" id="services-close" aria-label="Close services editor">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-status" id="services-status" role="status" aria-live="polite" hidden></div>' +

      '<div id="services-list"></div>' +

      '<form id="services-form" class="a-fieldset admin-form-card" autocomplete="off" novalidate hidden>' +
        '<h3 class="admin-form-title" id="services-form-title">New service</h3>' +
        field('service-title', 'Title', 'text', LIST_MAX.serviceTitle, 'E-Commerce Frontend') +
        '<div class="admin-field">' +
          '<label for="service-description">Description</label>' +
          '<textarea id="service-description" rows="4" maxlength="' + LIST_MAX.serviceDesc + '" ' +
            'placeholder="What this service actually delivers."></textarea>' +
        '</div>' +
        field('service-tags', 'Tags (comma separated, max ' + LIST_MAX.tags + ')', 'text', 400,
          'Storefront UI, Responsive shopping flows') +
        '<div class="a-grid a-grid--2">' +
          field('service-order', 'Order', 'number', 4, '1') +
          '<div class="admin-field"><label class="admin-checkbox">' +
            '<input id="service-visible" type="checkbox" checked />' +
            '<span>Show on the site</span>' +
          '</label></div>' +
        '</div>' +
        '<div class="admin-form-actions">' +
          '<button type="button" class="btn btn--ghost" id="services-form-cancel">Cancel</button>' +
          '<button type="submit" class="btn btn--primary" id="services-form-save">Save Service</button>' +
        '</div>' +
      '</form>' +
    '</section>';
  }

  function skillsTemplate() {
    var lib = window.IconLibrary;
    var opts = lib ? lib.options('') : '<option value="">Icons unavailable</option>';
    return '' +
    '<section class="a-panel a-panel--content" id="content-skills" hidden>' +
      '<div class="a-panel__head">' +
        '<div>' +
          '<h2 class="a-panel__title">Skills <span class="admin-count" id="skills-count"></span></h2>' +
          '<p class="a-panel__sub">Your stack. Every skill shows its icon beside its name on the site.</p>' +
        '</div>' +
        '<div class="a-panel__tools">' +
          '<button class="btn btn--ghost" type="button" id="skills-reload">Reload</button>' +
          '<button class="btn btn--primary" type="button" id="skills-add">Add skill</button>' +
          '<button class="admin-iconbtn" type="button" id="skills-close" aria-label="Close skills editor">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-status" id="skills-status" role="status" aria-live="polite" hidden></div>' +

      '<div id="skills-list"></div>' +

      '<form id="skills-form" class="a-fieldset admin-form-card" autocomplete="off" novalidate hidden>' +
        '<h3 class="admin-form-title" id="skills-form-title">New skill</h3>' +
        '<div class="a-grid a-grid--2">' +
          field('skill-name', 'Name', 'text', LIST_MAX.skillName, 'JavaScript') +
          field('skill-category', 'Category', 'text', LIST_MAX.category, 'Frontend') +
        '</div>' +
        '<div class="admin-field">' +
          '<label for="skill-icon">Icon</label>' +
          '<select id="skill-icon">' + opts + '</select>' +
        '</div>' +
        '<div class="admin-field">' +
          '<span class="a-field-label">Preview</span>' +
          '<span class="admin-icon-preview" id="skill-icon-preview"></span>' +
        '</div>' +
        '<div class="a-grid a-grid--2">' +
          field('skill-order', 'Order', 'number', 4, '1') +
          '<div class="admin-field"><label class="admin-checkbox">' +
            '<input id="skill-visible" type="checkbox" checked />' +
            '<span>Show on the site</span>' +
          '</label></div>' +
        '</div>' +
        '<div class="admin-form-actions">' +
          '<button type="button" class="btn btn--ghost" id="skills-form-cancel">Cancel</button>' +
          '<button type="submit" class="btn btn--primary" id="skills-form-save">Save Skill</button>' +
        '</div>' +
      '</form>' +
    '</section>';
  }

  /* ============================================================ */
  /*  panel switching                                            */
  /* ============================================================ */

  function contentPanels() {
    return Array.prototype.slice.call(document.querySelectorAll('#content-panels .a-panel--content'));
  }

  function showOnlyContentPanel(panelId) {
    var projectsPanel = $('projects-panel');
    var editorCard = $('editor-card');
    if (projectsPanel) projectsPanel.hidden = true;
    if (editorCard) editorCard.hidden = true;
    if (gateMessage) gateMessage.hidden = true;

    contentPanels().forEach(function (p) { p.hidden = p.id !== panelId; });
    var target = $(panelId);
    if (target) target.hidden = false;
  }

  function showProjectsPanel() {
    contentPanels().forEach(function (p) { p.hidden = true; });
    var projectsPanel = $('projects-panel');
    if (projectsPanel) projectsPanel.hidden = false;
  }

  /* ============================================================ */
  /*  boot                                                       */
  /* ============================================================ */

  function build() {
    var root = $('content-panels');
    if (!root || root.dataset.built === '1') return;
    root.dataset.built = '1';
    root.insertAdjacentHTML('beforeend', heroTemplate());
    root.insertAdjacentHTML('beforeend', contactTemplate());
    root.insertAdjacentHTML('beforeend', servicesTemplate());
    root.insertAdjacentHTML('beforeend', skillsTemplate());
    heroEditor.built = true;
    contactEditor.built = true;
    servicesEditor.built = true;
    skillsEditor.built = true;
    heroEditor.bind();
    contactEditor.bind();
    servicesEditor.bind();
    skillsEditor.bind();
    bindHeroImage();
    var iconSelect = $('skill-icon');
    if (iconSelect && !iconSelect.dataset.bound) {
      iconSelect.dataset.bound = '1';
      iconSelect.addEventListener('change', function () { renderSkillPreview(this.value); });
    }
  }

  function findNav() {
    navLinks.hero = document.querySelector('#a-side nav a[data-nav="hero"]');
    navLinks.contact = document.querySelector('#a-side nav a[data-nav="contact"]');
    navLinks.services = document.querySelector('#a-side nav a[data-nav="services"]');
    navLinks.skills = document.querySelector('#a-side nav a[data-nav="skills"]');
    navLinks.experience = document.querySelector('#a-side nav a[data-nav="experience"]');
    navLinks.about = document.querySelector('#a-side nav a[data-nav="about"]');
    navLinks.footer = document.querySelector('#a-side nav a[data-nav="footer"]');
  }

  function bindNav() {
    if (navLinks.hero && !navLinks.hero.dataset.bound) {
      navLinks.hero.dataset.bound = '1';
      navLinks.hero.addEventListener('click', function (ev) {
        ev.preventDefault();
        heroEditor.open();
      });
    }
    if (navLinks.contact && !navLinks.contact.dataset.bound) {
      navLinks.contact.dataset.bound = '1';
      navLinks.contact.addEventListener('click', function (ev) {
        ev.preventDefault();
        contactEditor.open();
      });
    }
    if (navLinks.services && !navLinks.services.dataset.bound) {
      navLinks.services.dataset.bound = '1';
      navLinks.services.addEventListener('click', function (ev) {
        ev.preventDefault();
        servicesEditor.open();
      });
    }
    if (navLinks.skills && !navLinks.skills.dataset.bound) {
      navLinks.skills.dataset.bound = '1';
      navLinks.skills.addEventListener('click', function (ev) {
        ev.preventDefault();
        skillsEditor.open();
      });
    }
    var projectsNav = document.querySelector('#a-side nav a[data-nav="projects"]');
    if (projectsNav && !projectsNav.dataset.boundGo) {
      projectsNav.dataset.boundGo = '1';
      projectsNav.addEventListener('click', function () { showProjectsPanel(); });
    }
    var dashNav = document.querySelector('#a-side nav a[data-nav="dashboard"]');
    if (dashNav && !dashNav.dataset.boundGo) {
      dashNav.dataset.boundGo = '1';
      dashNav.addEventListener('click', function () { showProjectsPanel(); });
    }
  }

  function ensureGateMessage() {
    if (gateMessage) return gateMessage;
    var host = $('dashboard-view');
    if (!host) return null;
    gateMessage = document.createElement('div');
    gateMessage.id = 'content-gate';
    gateMessage.className = 'admin-error';
    gateMessage.hidden = true;
    gateMessage.style.margin = '16px 0';
    var anchor = $('content-panels');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(gateMessage, anchor);
    else host.insertBefore(gateMessage, host.firstChild);
    return gateMessage;
  }

  var lastState = null;

  async function init() {
    var ready = $('content-ready');
    if (ready) ready.hidden = true;

    build();
    findNav();
    ensureGateMessage();

    var state = await isAdminSession();
    var signature = state.reason + (state.user ? ':' + state.user.id : '');
    if (signature === lastState) return; /* no redundant work on repeat calls */
    lastState = signature;

    var canEdit = state.ok;
    if (navLinks.hero) navLinks.hero.hidden = !canEdit;
    if (navLinks.contact) navLinks.contact.hidden = !canEdit;
    if (navLinks.services) navLinks.services.hidden = !canEdit;
    if (navLinks.skills) navLinks.skills.hidden = !canEdit;

    if (!canEdit) {
      showProjectsPanel();
      if (gateMessage) {
        gateMessage.textContent = 'You do not have permission to edit portfolio content.';
        gateMessage.hidden = state.reason === 'no-session';
      }
      return;
    }

    bindNav();
    if (gateMessage) gateMessage.hidden = true;

    if (!heroEditor.loaded) { heroEditor.loaded = true; heroEditor.load(); }
    if (!contactEditor.loaded) { contactEditor.loaded = true; contactEditor.load(); }
    /* services + skills are only fetched when their tab is opened, so the
       dashboard does not fire four reads on every sign-in */
  }

  window.NPContentAdmin = {
    init: init,
    _hero: heroEditor,
    _contact: contactEditor,
    _services: servicesEditor,
    _skills: skillsEditor,
    _experiences: experiencesEditor,
    _about: aboutEditor,
    _footer: footerEditor,
    _renderSkillPreview: renderSkillPreview,
    _heroImage: heroImage,
    _validateImageFile: validateImageFile,
    _renderHeroImage: renderHeroImage,
    _bindHeroImage: bindHeroImage,
    _uploadProfileImage: uploadProfileImage,
    BUCKET: BUCKET,
    MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
    _showProjectsPanel: showProjectsPanel
  };

  /* ============================================================ */
  /*  Experience — repeatable rows                              */
  /* ============================================================ */

  var experiencesEditor = makeListEditor({
    table: 'experiences',
    columns: 'id, role, company_or_team, description, start_date, end_date, sort_order, is_visible, created_at, updated_at',
    noun: 'experience',
    plural: 'experiences',
    panelId: 'content-experience',
    statusId: 'experience-status',
    formId: 'experience-form',
    formTitleId: 'experience-form-title',
    listId: 'experience-list',
    countId: 'experience-count',
    addId: 'experience-add',
    saveId: 'experience-form-save',
    formCancelId: 'experience-form-cancel',
    reloadId: 'experience-reload',
    closeId: 'experience-close',
    fill: function (row) {
      var set = function (id, v) { var el = $(id); if (el) el.value = v == null ? '' : String(v); };
      set('exp-role', row.role || '');
      set('exp-company', row.company_or_team || '');
      set('exp-description', row.description || '');
      set('exp-start', row.start_date || '');
      set('exp-end', row.end_date || '');
      set('exp-order', row.sort_order == null ? '' : row.sort_order);
      var box = $('exp-visible');
      if (box) box.checked = row.is_visible !== false;
    },
    collect: function (val, toIntFn, parseCsvFn, M) {
      return {
        role: val('exp-role').trim(),
        company_or_team: val('exp-company').trim(),
        description: val('exp-description').trim(),
        start_date: val('exp-start').trim(),
        end_date: val('exp-end').trim(),
        sort_order: toIntFn(val('exp-order'), 0),
        is_visible: !!($('exp-visible') && $('exp-visible').checked)
      };
    },
    validate: function (d, M) {
      var p = [];
      if (!d.role) p.push('A role is required.');
      else if (d.role.length > M.skillName) p.push('The role is too long (max ' + M.skillName + ').');
      if (d.description.length > M.serviceDesc) p.push('The description is too long (max ' + M.serviceDesc + ').');
      if (d.start_date.length > MAX.url) p.push('The start date is too long. Keep it short or leave it empty.');
      if (d.end_date.length > MAX.url) p.push('The end date is too long. Keep it short or leave it empty.');
      if (d.sort_order < 0 || d.sort_order > M.order) p.push('Order must be between 0 and ' + M.order + '.');
      return p;
    },
    rowMarkup: function (row, index, total) {
      var meta = (row.company_or_team && row.company_or_team.trim())
        ? (row.start_date ? (escapeHtml(row.company_or_team) + ' · ' + escapeHtml(row.start_date)) : escapeHtml(row.company_or_team))
        : (row.start_date ? escapeHtml(row.start_date) : '');
      var inner =
        '<span class="admin-list__main">' +
          '<span class="admin-list__title">' + escapeHtml(row.role || '(unnamed role)') + '</span>' +
          '<span class="admin-list__meta">' + (meta || 'No context') + '</span>' +
        '</span>';
      return listRowShell(inner, row, index, total);
    },
    onDelete: confirmDelete
  });

  function experienceTemplate() {
    return '' +
    '<section class="a-panel a-panel--content" id="content-experience" hidden>' +
      '<div class="a-panel__head">' +
        '<div>' +
          '<h2 class="a-panel__title">Experience <span class="admin-count" id="experience-count"></span></h2>' +
          '<p class="a-panel__sub">Past and current roles. No fabricated dates or employers — leave a field empty if you are not sure yet.</p>' +
        '</div>' +
        '<div class="a-panel__tools">' +
          '<button class="btn btn--ghost" type="button" id="experience-reload">Reload</button>' +
          '<button class="btn btn--primary" type="button" id="experience-add">Add role</button>' +
          '<button class="admin-iconbtn" type="button" id="experience-close" aria-label="Close experience editor">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-status" id="experience-status" role="status" aria-live="polite" hidden></div>' +
      '<div id="experience-list"></div>' +
      '<form id="experience-form" class="a-fieldset admin-form-card" autocomplete="off" novalidate hidden>' +
        '<h3 class="admin-form-title" id="experience-form-title">New role</h3>' +
        '<div class="a-grid a-grid--2">' +
          field('exp-role', 'Role', 'text', LIST_MAX.skillName, 'Frontend Developer') +
          field('exp-company', 'Company / context', 'text', LIST_MAX.category, 'Studio name or leave empty') +
        '</div>' +
        '<div class="admin-field">' +
          '<label for="exp-description">Description</label>' +
          '<textarea id="exp-description" rows="4" maxlength="' + LIST_MAX.serviceDesc + '" ' +
            'placeholder="What this role actually involved — one or two honest sentences."></textarea>' +
        '</div>' +
        '<div class="a-grid a-grid--2">' +
          field('exp-start', 'Start date', 'text', MAX.url, '2022 or “Present”') +
          field('exp-end', 'End date', 'text', MAX.url, '2024 or leave empty') +
        '</div>' +
        '<div class="a-grid a-grid--2">' +
          field('exp-order', 'Order', 'number', 4, '1') +
          '<div class="admin-field"><label class="admin-checkbox">' +
            '<input id="exp-visible" type="checkbox" checked />' +
            '<span>Show on the site</span>' +
          '</label></div>' +
        '</div>' +
        '<div class="admin-form-actions">' +
          '<button type="button" class="btn btn--ghost" id="experience-form-cancel">Cancel</button>' +
          '<button type="submit" class="btn btn--primary" id="experience-form-save">Save Role</button>' +
        '</div>' +
      '</form>' +
    '</section>';
  }

  /* ============================================================ */
  /*  About — single row in portfolio_content                    */
  /* ============================================================ */

  var ABOUT_DEFAULTS = {
    label: 'Who I am',
    heading: 'About',
    headline: '',
    statement: '',
    supporting_text: '',
    focus_list: '',
    role_title: '',
    sub_role: '',
    code_block: '',
    is_visible: true
  };

  var aboutEditor = makeEditor({
    key: 'about',
    panelId: 'content-about',
    statusId: 'about-status',
    dirtyId: 'about-dirty',
    formId: 'about-form',
    saveId: 'about-save',
    cancelId: 'about-cancel',
    closeId: 'about-close',
    defaults: ABOUT_DEFAULTS,
    apply: function (c) {
      var v = function (k) { return $(k).value; };
      v('ab-label').value = c.label || '';
      v('ab-heading').value = c.heading || '';
      v('ab-headline').value = c.headline || '';
      v('ab-statement').value = c.statement || '';
      v('ab-supporting').value = c.supporting_text || '';
      v('ab-focus').value = (Array.isArray(c.focus_list) ? c.focus_list.join('\n') : (c.focus_list || ''));
      v('ab-role-title').value = c.role_title || '';
      v('ab-sub-role').value = c.sub_role || '';
      v('ab-code').value = c.code_block || '';
      v('ab-visible').checked = c.is_visible !== false;
    },
    collect: function () {
      var v = function (k) { return $(k).value.trim(); };
      return {
        label: v('ab-label'),
        heading: v('ab-heading'),
        headline: v('ab-headline'),
        statement: v('ab-statement'),
        supporting_text: v('ab-supporting'),
        focus_list: v('ab-focus').split('\n').map(function (s) { return String(s).trim(); }).filter(Boolean),
        role_title: v('ab-role-title'),
        sub_role: v('ab-sub-role'),
        code_block: v('ab-code'),
        is_visible: !!$('ab-visible').checked
      };
    },
    validate: function (d) {
      var p = [];
      if (!d.statement) p.push('A sentence is required.');
      else if (d.statement.length > LIST_MAX.serviceDesc) p.push('The sentence is too long.');
      if (!d.supporting_text) p.push('A second sentence is required.');
      else if (d.supporting_text.length > LIST_MAX.serviceDesc) p.push('The second sentence is too long.');
      if (d.focus_list.length > 6) p.push('Focus areas are capped at 6.');
      for (var i = 0; i < d.focus_list.length; i++) {
        if (d.focus_list[i].length > LIST_MAX.tag) p.push('Focus item ' + (i + 1) + ' is too long.');
      }
      if (d.role_title.length > LIST_MAX.skillName) p.push('Role title is too long.');
      if (d.code_block.length > 1200) p.push('The code block is too long.');
      return p;
    }
  });

  function aboutTemplate() {
    return '' +
    '<section class="a-panel a-panel--content" id="content-about" hidden>' +
      '<div class="a-panel__head">' +
        '<div>' +
          '<h2 class="a-panel__title">About <span class="admin-count" id="about-count"></span></h2>' +
          '<p class="a-panel__sub">The single sentence and focus areas in the About section. These are the honest copy shown on the public site — no invented stack stored here.</p>' +
        '</div>' +
        '<div class="a-panel__tools">' +
          '<span class="admin-dirty" id="about-dirty" hidden>Unsaved changes</span>' +
          '<button class="admin-iconbtn" type="button" id="about-close" aria-label="Close about editor">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-status" id="about-status" role="status" aria-live="polite" hidden></div>' +
      '<form id="about-form" autocomplete="off" novalidate>' +
        '<fieldset class="a-fieldset"><legend>About copy</legend>' +
          '<div class="admin-field">' +
            '<label for="ab-label">Section label</label>' +
            '<input id="ab-label" type="text" maxlength="' + LIST_MAX.skillName + '" ' +
              'placeholder="Who I am">' +
          '</div>' +
          '<div class="admin-field">' +
            '<label for="ab-heading">Main heading</label>' +
            '<input id="ab-heading" type="text" maxlength="' + LIST_MAX.skillName + '" ' +
              'placeholder="About">' +
          '</div>' +
          '<div class="admin-field">' +
            '<label for="ab-headline">Headline (optional)</label>' +
            '<input id="ab-headline" type="text" maxlength="' + LIST_MAX.skillName + '" ' +
              'placeholder="Short headline if needed">' +
          '</div>' +
          '<div class="admin-field">' +
            '<label for="ab-statement">Sentence</label>' +
            '<textarea id="ab-statement" rows="3" maxlength="' + LIST_MAX.serviceDesc + '" ' +
              'placeholder="I’m a frontend developer focused on building clear, responsive digital experiences —"></textarea>' +
          '</div>' +
          '<div class="admin-field">' +
            '<label for="ab-supporting">Second sentence</label>' +
            '<textarea id="ab-supporting" rows="3" maxlength="' + LIST_MAX.serviceDesc + '" ' +
              'placeholder="What the work covers: storefront UI, content hierarchy, mobile-first implementation —"></textarea>' +
          '</div>' +
          '<div class="admin-field">' +
            '<label for="ab-focus">Focus areas <span class="admin-hint-inline">(one per line, max 6 — use real wording only)</span></label>' +
            '<textarea id="ab-focus" rows="4" maxlength="' + (LIST_MAX.tag + 6) + '" ' +
              'placeholder="Storefront UI\nContent hierarchy\nMobile-first layouts"></textarea>' +
          '</div>' +
        '</fieldset>' +
        '<fieldset class="a-fieldset"><legend>Role cards</legend>' +
          '<p class="admin-hint">Optional role card. Leave blank to keep the simple “About” look.</p>' +
          '<div class="a-grid a-grid--2">' +
            field('ab-role-title', 'Role title', 'text', LIST_MAX.skillName, 'Frontend Developer') +
            field('ab-sub-role', 'Sub-role / alternative title', 'text', LIST_MAX.skillName, 'E-Commerce Specialist') +
          '</div>' +
          '<div class="admin-field">' +
            '<label for="ab-code">About card code <span class="admin-hint-inline">(plain text · gets wrapped in <code> · keep it small)</span></label>' +
            '<textarea id="ab-code" rows="5" maxlength="1200" ' +
              'placeholder="const developer = {\n  name: \'Nourhan Ashraf\',\n  role: \'Frontend Developer &amp; E-Commerce\',\n  focus: [\'Storefront UI\', \'Brand sites\', \'Responsive UI\'],\n  hireable: true\n};"></textarea>' +
          '</div>' +
        '</fieldset>' +
        '<div class="a-grid a-grid--2">' +
          '<div class="admin-field"><label class="admin-checkbox">' +
            '<input id="ab-visible" type="checkbox" checked />' +
            '<span>Show on the site</span>' +
          '</label></div>' +
        '</div>' +
        '<div class="admin-form-actions">' +
          '<button type="button" class="btn btn--ghost" id="about-cancel">Reset</button>' +
          '<button type="submit" class="btn btn--primary" id="about-save">Save About</button>' +
        '</div>' +
      '</form>' +
    '</section>';
  }

  /* ============================================================ */
  /*  Experience — repeatable roles (real table)                 */
  /* ============================================================ */

  var experienceEditor = makeListEditor({
    table: 'experiences',
    columns: 'id, role, company_or_team, description, start_date, end_date, sort_order, is_visible, created_at, updated_at',
    noun: 'role',
    plural: 'roles',
    panelId: 'content-experience',
    statusId: 'experience-status',
    formId: 'experience-form',
    formTitleId: 'experience-form-title',
    listId: 'experience-list',
    countId: 'experience-count',
    addId: 'experience-add',
    saveId: 'experience-form-save',
    formCancelId: 'experience-form-cancel',
    reloadId: 'experience-reload',
    closeId: 'experience-close',
    fill: function (row) {
      var set = function (id, v) { var el = $(id); if (el) el.value = v == null ? '' : String(v); };
      set('exp-role', row.role || '');
      set('exp-company', row.company_or_team || '');
      set('exp-description', row.description || '');
      set('exp-start', row.start_date || '');
      set('exp-end', row.end_date || '');
      set('exp-order', row.sort_order == null ? '' : row.sort_order);
      var box = $('exp-visible');
      if (box) box.checked = row.is_visible !== false;
    },
    collect: function (val, toIntFn, parseCsvFn, M) {
      return {
        role: val('exp-role').trim(),
        company_or_team: val('exp-company').trim(),
        description: val('exp-description').trim(),
        start_date: val('exp-start').trim(),
        end_date: val('exp-end').trim(),
        sort_order: toIntFn(val('exp-order'), 0),
        is_visible: !!($('exp-visible') && $('exp-visible').checked)
      };
    },
    validate: function (d, M) {
      var p = [];
      if (!d.role) p.push('Role is required.');
      else if (d.role.length > M.skillName) p.push('Role is too long.');
      if (d.description.length > M.serviceDesc) p.push('Description is too long.');
      if (d.company_or_team.length > M.category) p.push('Company / team is too long.');
      if (d.start_date && d.start_date.length > M.url) p.push('Start date is too long.');
      if (d.end_date && d.end_date.length > M.url) p.push('End date is too long.');
      if (d.sort_order < 0 || d.sort_order > M.order) p.push('Order must be between 0 and ' + M.order + '.');
      return p;
    },
    rowMarkup: function (row, index, total) {
      var inner =
        '<span class="admin-list__main">' +
          '<span class="admin-list__title">' +
            (row.role ? escapeHtml(row.role) : '(no role)') +
          '</span>' +
          '<span class="admin-list__meta">' +
            (row.company_or_team ? escapeHtml(row.company_or_team) : '') +
            (row.start_date ? ' · ' + escapeHtml(row.start_date) : '') +
          '</span>' +
        '</span>';
      return listRowShell(inner, row, index, total);
    },
    onDelete: confirmDelete
  });

  function experienceTemplate() {
    return '' +
    '<section class="a-panel a-panel--content" id="content-experience" hidden>' +
      '<div class="a-panel__head">' +
        '<div>' +
          '<h2 class="a-panel__title">Experience <span class="admin-count" id="experience-count"></span></h2>' +
          '<p class="a-panel__sub">Past and current roles. No fabricated dates or employers — leave a field empty if you are not sure yet.</p>' +
        '</div>' +
        '<div class="a-panel__tools">' +
          '<button class="btn btn--ghost" type="button" id="experience-reload">Reload</button>' +
          '<button class="btn btn--primary" type="button" id="experience-add">Add role</button>' +
          '<button class="admin-iconbtn" type="button" id="experience-close" aria-label="Close experience editor">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-status" id="experience-status" role="status" aria-live="polite" hidden></div>' +
      '<div id="experience-list"></div>' +
      '<form id="experience-form" class="a-fieldset admin-form-card" autocomplete="off" novalidate hidden>' +
        '<h3 class="admin-form-title" id="experience-form-title">New role</h3>' +
        '<div class="a-grid a-grid--2">' +
          field('exp-role', 'Role', 'text', LIST_MAX.skillName, 'Frontend Developer') +
          field('exp-company', 'Company / context', 'text', LIST_MAX.category, 'Studio name or leave empty') +
        '</div>' +
        '<div class="admin-field">' +
          '<label for="exp-description">Description</label>' +
          '<textarea id="exp-description" rows="4" maxlength="' + LIST_MAX.serviceDesc + '" ' +
            'placeholder="What this role actually involved — one or two honest sentences."></textarea>' +
        '</div>' +
        '<div class="a-grid a-grid--2">' +
          field('exp-start', 'Start date', 'text', LIST_MAX.url, '2022 or “Present”') +
          field('exp-end', 'End date', 'text', LIST_MAX.url, '2024 or leave empty') +
        '</div>' +
        '<div class="a-grid a-grid--2">' +
          field('exp-order', 'Order', 'number', 4, '1') +
          '<div class="admin-field"><label class="admin-checkbox">' +
            '<input id="exp-visible" type="checkbox" checked />' +
            '<span>Show on the site</span>' +
          '</label></div>' +
        '</div>' +
        '<div class="admin-form-actions">' +
          '<button type="button" class="btn btn--ghost" id="experience-form-cancel">Cancel</button>' +
          '<button type="submit" class="btn btn--primary" id="experience-form-save">Save Role</button>' +
        '</div>' +
      '</form>' +
    '</section>';
  }

  function bindAboutForm() {
    var form = $('about-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (ev) { ev.preventDefault(); aboutEditor.save(); });
    var cancel = $('about-cancel');
    if (cancel) cancel.addEventListener('click', function () {
      if (aboutEditor.dirty && !confirm('You have unsaved changes. Discard them?')) return;
      aboutEditor.reset();
    });
    var close = $('about-close');
    if (close) close.addEventListener('click', function () {
      if (aboutEditor.dirty && !confirm('You have unsaved changes. Discard them?')) return;
      aboutEditor.reset();
      $('content-about').hidden = true;
      showProjectsPanel();
    });
  }

  function bindFooterForm() {
    var form = $('footer-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (ev) { ev.preventDefault(); footerEditor.save(); });
    var cancel = $('footer-cancel');
    if (cancel) cancel.addEventListener('click', function () {
      if (footerEditor.dirty && !confirm('You have unsaved changes. Discard them?')) return;
      footerEditor.reset();
    });
    var close = $('footer-close');
    if (close) close.addEventListener('click', function () {
      if (footerEditor.dirty && !confirm('You have unsaved changes. Discard them?')) return;
      footerEditor.reset();
      $('content-footer').hidden = true;
      showProjectsPanel();
    });
  }

  /* ============================================================ */
  /*  boot                                                       */
  /* ============================================================ */

  var FOOTER_DEFAULTS = {
    display_name: 'Nourhan Ashraf',
    copyright_text: '© Nourhan Ashraf',
    year_mode: 'auto',
    custom_year: '',
    footer_links: '',
    is_visible: true
  };

  var footerEditor = makeEditor({
    key: 'footer',
    panelId: 'content-footer',
    statusId: 'footer-status',
    dirtyId: 'footer-dirty',
    formId: 'footer-form',
    saveId: 'footer-save',
    cancelId: 'footer-cancel',
    closeId: 'footer-close',
    defaults: FOOTER_DEFAULTS,
    apply: function (c) {
      var v = function (k) { return $(k); };
      v('footer-display-name').value = (c.display_name || '');
      v('footer-copyright').value = (c.copyright_text || '');
      var ym = v('footer-year-mode');
      if (ym) {
        if (c.year_mode === 'custom' && !c.year_mode) {
          ym.value = 'auto';
        } else {
          ym.value = c.year_mode === 'custom' ? 'custom' : 'auto';
        }
      }
      v('footer-custom-year').value = (c.custom_year || '');
      v('footer-links').value = (c.footer_links || '');
      v('footer-visible').checked = c.is_visible !== false;
    },
    collect: function () {
      var v = function (k) { return $(k).value.trim(); };
      var yearModeEl = $('footer-year-mode');
      var yearMode = (yearModeEl && yearModeEl.value) === 'custom' ? 'custom' : 'auto';
      return {
        display_name: v('footer-display-name'),
        copyright_text: v('footer-copyright'),
        year_mode: yearMode,
        custom_year: v('footer-custom-year'),
        footer_links: v('footer-links'),
        is_visible: !!$('footer-visible').checked
      };
    },
    validate: function (d) {
      var p = [];
      if (!d.display_name) p.push('A display name is required.');
      else if (d.display_name.length > LIST_MAX.skillName) p.push('Display name is too long.');
      if (!d.copyright_text) p.push('Copyright text is required.');
      else if (d.copyright_text.length > LIST_MAX.skillName) p.push('Copyright text is too long.');
      if (!d.year_mode) p.push('Year mode is required.');
      else if (d.year_mode !== 'auto' && d.year_mode !== 'custom') p.push('Year mode must be auto or custom.');
      if (d.year_mode === 'custom') {
        if (!d.custom_year || d.custom_year.length < 1) p.push('A custom year is required.');
        else if (d.custom_year.length > 4) p.push('Custom year is too long.');
      }
      return p;
    }
  });

  function footerTemplate() {
    return '' +
    '<section class="a-panel a-panel--content" id="content-footer" hidden>' +
      '<div class="a-panel__head">' +
        '<div>' +
          '<h2 class="a-panel__title">Footer <span class="admin-count" id="footer-count"></span></h2>' +
          '<p class="a-panel__sub">Copyright text, display name, year behaviour, and a few small links if you want them.</p>' +
        '</div>' +
        '<div class="a-panel__tools">' +
          '<span class="admin-dirty" id="footer-dirty" hidden>Unsaved changes</span>' +
          '<button class="admin-iconbtn" type="button" id="footer-close" aria-label="Close footer editor">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-status" id="footer-status" role="status" aria-live="polite" hidden></div>' +
      '<form id="footer-form" autocomplete="off" novalidate>' +
        '<fieldset class="a-fieldset"><legend>Footer</legend>' +
          field('footer-display-name', 'Display name', 'text', LIST_MAX.skillName, 'Nourhan Ashraf') +
          field('footer-copyright', 'Copyright text', 'text', LIST_MAX.skillName, '© Nourhan Ashraf') +
        '</fieldset>' +
        '<fieldset class="a-fieldset"><legend>Year</legend>' +
          '<div class="a-grid a-grid--2">' +
            '<div class="admin-field"><label for="footer-year-mode">Year behaviour</label>' +
              '<select id="footer-year-mode">' +
                '<option value="auto">Auto (current year)</option>' +
                '<option value="custom">Custom (write year below)</option>' +
              '</select>' +
            '</div>' +
            '<div class="admin-field"><label for="footer-custom-year">Custom year</label>' +
              '<input id="footer-custom-year" type="text" maxlength="4" placeholder="2026" ' +
                'style="width:auto;">' +
            '</div>' +
          '</div>' +
        '</fieldset>' +
        '<fieldset class="a-fieldset"><legend>Optional links</legend>' +
          '<div class="admin-field">' +
            '<label for="footer-links">Footer links <span class="admin-hint-inline">(one label/URL pair per line: label\nurl)</span></label>' +
            '<textarea id="footer-links" rows="4" ' +
              'placeholder="About\n#about"></textarea>' +
          '</div>' +
        '</fieldset>' +
        '<div class="a-grid a-grid--2">' +
          '<div class="admin-field"><label class="admin-checkbox">' +
            '<input id="footer-visible" type="checkbox" checked />' +
            '<span>Show on the site</span>' +
          '</label></div>' +
        '</div>' +
        '<div class="admin-form-actions">' +
          '<button type="button" class="btn btn--ghost" id="footer-cancel">Reset</button>' +
          '<button type="submit" class="btn btn--primary" id="footer-save">Save Footer</button>' +
        '</div>' +
      '</form>' +
    '</section>';
  }

  /* ============================================================ */
  /*  boot                                                       */
  /* ============================================================ */

  function build() {
    var root = $('content-panels');
    if (!root || root.dataset.built === '1') return;
    root.dataset.built = '1';
    root.insertAdjacentHTML('beforeend', heroTemplate());
    root.insertAdjacentHTML('beforeend', contactTemplate());
    root.insertAdjacentHTML('beforeend', servicesTemplate());
    root.insertAdjacentHTML('beforeend', skillsTemplate());
    root.insertAdjacentHTML('beforeend', experienceTemplate());
    root.insertAdjacentHTML('beforeend', aboutTemplate());
    root.insertAdjacentHTML('beforeend', footerTemplate());
    heroEditor.built = true;
    contactEditor.built = true;
    servicesEditor.built = true;
    skillsEditor.built = true;
    experiencesEditor.built = true;
    aboutEditor.built = true;
    footerEditor.built = true;
    heroEditor.bind();
    contactEditor.bind();
    servicesEditor.bind();
    skillsEditor.bind();
    experiencesEditor.bind();
    aboutEditor.bind();
    footerEditor.bind();
    bindAboutForm();
    bindFooterForm();
    bindAboutForm();
    bindFooterForm();
    bindHeroImage();
    var iconSelect = $('skill-icon');
    if (iconSelect && !iconSelect.dataset.bound) {
      iconSelect.dataset.bound = '1';
      iconSelect.addEventListener('change', function () { renderSkillPreview(this.value); });
    }
  }

  function findNav() {
    navLinks.hero = document.querySelector('#a-side nav a[data-nav="hero"]');
    navLinks.contact = document.querySelector('#a-side nav a[data-nav="contact"]');
    navLinks.services = document.querySelector('#a-side nav a[data-nav="services"]');
    navLinks.skills = document.querySelector('#a-side nav a[data-nav="skills"]');
    navLinks.experience = document.querySelector('#a-side nav a[data-nav="experience"]');
    navLinks.about = document.querySelector('#a-side nav a[data-nav="about"]');
    navLinks.footer = document.querySelector('#a-side nav a[data-nav="footer"]');
  }

  function bindNav() {
    if (navLinks.hero && !navLinks.hero.dataset.bound) {
      navLinks.hero.dataset.bound = '1';
      navLinks.hero.addEventListener('click', function (ev) {
        ev.preventDefault();
        heroEditor.open();
      });
    }
    if (navLinks.contact && !navLinks.contact.dataset.bound) {
      navLinks.contact.dataset.bound = '1';
      navLinks.contact.addEventListener('click', function (ev) {
        ev.preventDefault();
        contactEditor.open();
      });
    }
    if (navLinks.services && !navLinks.services.dataset.bound) {
      navLinks.services.dataset.bound = '1';
      navLinks.services.addEventListener('click', function (ev) {
        ev.preventDefault();
        servicesEditor.open();
      });
    }
    if (navLinks.skills && !navLinks.skills.dataset.bound) {
      navLinks.skills.dataset.bound = '1';
      navLinks.skills.addEventListener('click', function (ev) {
        ev.preventDefault();
        skillsEditor.open();
      });
    }
    if (navLinks.experience && !navLinks.experience.dataset.bound) {
      navLinks.experience.dataset.bound = '1';
      navLinks.experience.addEventListener('click', function (ev) {
        ev.preventDefault();
        experiencesEditor.open();
      });
    }
    if (navLinks.about && !navLinks.about.dataset.bound) {
      navLinks.about.dataset.bound = '1';
      navLinks.about.addEventListener('click', function (ev) {
        ev.preventDefault();
        aboutEditor.open();
      });
    }
    if (navLinks.footer && !navLinks.footer.dataset.bound) {
      navLinks.footer.dataset.bound = '1';
      navLinks.footer.addEventListener('click', function (ev) {
        ev.preventDefault();
        footerEditor.open();
      });
    }
    var projectsNav = document.querySelector('#a-side nav a[data-nav="projects"]');
    if (projectsNav && !projectsNav.dataset.boundGo) {
      projectsNav.dataset.boundGo = '1';
      projectsNav.addEventListener('click', function () { showProjectsPanel(); });
    }
    var dashNav = document.querySelector('#a-side nav a[data-nav="dashboard"]');
    if (dashNav && !dashNav.dataset.boundGo) {
      dashNav.dataset.boundGo = '1';
      dashNav.addEventListener('click', function () { showProjectsPanel(); });
    }
  }

  function ensureGateMessage() {
    if (gateMessage) return gateMessage;
    var host = $('dashboard-view');
    if (!host) return null;
    gateMessage = document.createElement('div');
    gateMessage.id = 'content-gate';
    gateMessage.className = 'admin-error';
    gateMessage.hidden = true;
    gateMessage.style.margin = '16px 0';
    var anchor = $('content-panels');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(gateMessage, anchor);
    else host.insertBefore(gateMessage, host.firstChild);
    return gateMessage;
  }

  async function init() {
    var ready = $('content-ready');
    if (ready) ready.hidden = true;

    build();
    findNav();
    ensureGateMessage();

    var state = await isAdminSession();
    var signature = state.reason + (state.user ? ':' + state.user.id : '');
    if (signature === lastState) return; /* no redundant work on repeat calls */
    lastState = signature;

    var canEdit = state.ok;
    if (navLinks.hero) navLinks.hero.hidden = !canEdit;
    if (navLinks.contact) navLinks.contact.hidden = !canEdit;
    if (navLinks.services) navLinks.services.hidden = !canEdit;
    if (navLinks.skills) navLinks.skills.hidden = !canEdit;
    if (navLinks.experience) navLinks.experience.hidden = !canEdit;
    if (navLinks.about) navLinks.about.hidden = !canEdit;
    if (navLinks.footer) navLinks.footer.hidden = !canEdit;

    if (!canEdit) {
      showProjectsPanel();
      if (gateMessage) {
        gateMessage.textContent = 'You do not have permission to edit portfolio content.';
        gateMessage.hidden = state.reason === 'no-session';
      }
      return;
    }

    bindNav();
    if (gateMessage) gateMessage.hidden = true;

    if (!heroEditor.loaded) { heroEditor.loaded = true; heroEditor.load(); }
    if (!contactEditor.loaded) { contactEditor.loaded = true; contactEditor.load(); }
    if (!servicesEditor.loaded) { servicesEditor.loaded = true; servicesEditor.load(); }
    if (!skillsEditor.loaded) { skillsEditor.loaded = true; skillsEditor.load(); }
    if (!experiencesEditor.loaded) { experiencesEditor.loaded = true; experiencesEditor.load(); }
    if (!aboutEditor.loaded) { aboutEditor.loaded = true; aboutEditor.load(); }
    if (!footerEditor.loaded) { footerEditor.loaded = true; footerEditor.load(); }
    bindAboutForm();
    bindFooterForm();
    bindAboutForm();
    bindFooterForm();
  }

  window.NPContentAdmin = {
    init: init,
    _hero: heroEditor,
    _contact: contactEditor,
    _services: servicesEditor,
    _skills: skillsEditor,
    _experiences: experiencesEditor,
    _about: aboutEditor,
    _footer: footerEditor,
    _renderSkillPreview: renderSkillPreview,
    _heroImage: heroImage,
    _validateImageFile: validateImageFile,
    _renderHeroImage: renderHeroImage,
    _bindHeroImage: bindHeroImage,
    _uploadProfileImage: uploadProfileImage,
    BUCKET: BUCKET,
    MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
    _showProjectsPanel: showProjectsPanel
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
})();
