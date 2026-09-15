/* nourhan-portfolio · admin dashboard logic
 * Login, project CRUD, publish/featured toggles, reorder,
 * image upload (Storage) or URL, delete confirmation,
 * dashboard stats, search/filter, media previews,
 * Arabic/English labels (data-i18n).
 *
 * Security model (see supabase/02_policies.sql):
 *   · RLS is the real gate — anon can only read published rows.
 *   · This UI hides the dashboard behind the Supabase session,
 *     and the session's user must have profiles.is_admin = true
 *     for any write to succeed.
 */
(function () {
  'use strict';

  /* ================= i18n (EN / AR) ================= */

  var I18N = {
    en: {
      brandName: 'Nourhan Ashraf', brandTag: 'Portfolio CMS',
      navDashboard: 'Dashboard', navProjects: 'Projects', navViewSite: 'View site',
      navHero: 'Hero', navContact: 'Contact',
      navServices: 'Services', navSkills: 'Skills',
      navExperience: 'Experience', navAbout: 'About', navFooter: 'Footer',
      signOut: 'Sign out',
      loginTitle: 'Portfolio admin', loginSub: 'Sign in with your admin account.',
      email: 'Email', password: 'Password', signIn: 'Sign in',
      overviewEyebrow: 'Overview', overviewTitle: 'Dashboard',
      overviewSub: 'Manage your portfolio projects', newProject: 'New project',
      statTotal: 'Total projects', statPublished: 'Published',
      statDraft: 'Drafts', statFeatured: 'Featured',
      projectsTitle: 'Projects', searchPlaceholder: 'Search projects…',
      filterAll: 'All statuses', filterPublished: 'Published',
      filterDraft: 'Draft', filterFeatured: 'Featured',
      thOrder: 'Order', thProject: 'Project', thStatus: 'Status', thActions: 'Actions',
      loading: 'Loading…',
      noProjects: 'No projects yet. Click “+ New project” to add your first one.',
      noMatches: 'No projects match the current search/filter.',
      filterCount: '{n} of {total} projects',
      fsBasic: '1 · Basic information', fsClass: '2 · Project classification',
      fsTech: '3 · Technologies', fsMedia: '4 · Cover & gallery media',
      fsLinks: '5 · Links', fsPublishing: '6 · Publishing settings',
      fTitle: 'Title *', fSlug: 'Slug *', fShort: 'Short description *',
      fFull: 'Full description', fIndustry: 'Industry', fType: 'Project type',
      fTech: 'Technologies (comma-separated)', fCover: 'Cover image URL',
      uploadImage: '…or upload an image', replace: 'Replace', remove: 'Remove',
      fGallery: 'Gallery image URLs (one per line)',
      uploadGallery: '…or upload gallery images',
      fLive: 'Live URL', fGithub: 'GitHub URL',
      fSort: 'Sort order', fStatus: 'Status',
      optDraft: 'Draft (not visible publicly)', optPublished: 'Published (visible on the site)',
      fFeatured: 'Featured', optNo: 'No', optYes: 'Yes',
      saveProject: 'Save project', cancel: 'Cancel',
      setupTitle: 'Backend not configured', setupSub: 'Copy', setupTo: 'to',
      setupRest: "and fill in the brand-new Supabase project's URL and anon key (Settings → API). Then reload this page.",
      badgePublished: 'Published', badgeDraft: 'Draft', badgeFeatured: '★ Featured',
      moveUp: 'Move up', moveDown: 'Move down', edit: 'Edit', del: 'Delete',
      deleteTitle: 'Delete “{title}”?',
      deleteMsg: 'This permanently removes the project from the database. This action cannot be undone.',
      deleteConfirm: 'Delete permanently', deleting: 'Deleting…',
      orderUpdated: 'Order updated', reorderFailed: 'Reorder failed',
      updateFailed: 'Update failed', projectSaved: 'Project saved',
      projectCreated: 'Project created', saveFailed: 'Save failed',
      projectDeleted: 'Project deleted', deleteFailed: 'Delete failed',
      published: 'Published', draft: 'Draft', featured: 'Featured',
      galleryUrlTag: 'URL',
    },
    ar: {
      brandName: 'نورهان أشرف', brandTag: 'نظام إدارة الموقع',
      navDashboard: 'الرئيسية', navProjects: 'المشاريع', navViewSite: 'عرض الموقع',
      navHero: 'الهيدر', navContact: 'التواصل',
      navServices: 'الخدمات', navSkills: 'المهارات',
      navExperience: 'الخبرات', navAbout: 'نبذة', navFooter: 'التذييل',
      signOut: 'تسجيل الخروج',
      loginTitle: 'لوحة تحكم الموقع', loginSub: 'سجّل الدخول بحساب المشرف.',
      email: 'البريد الإلكتروني', password: 'كلمة المرور', signIn: 'تسجيل الدخول',
      overviewEyebrow: 'نظرة عامة', overviewTitle: 'لوحة التحكم',
      overviewSub: 'إدارة مشاريع معرض أعمالك', newProject: 'مشروع جديد',
      statTotal: 'إجمالي المشاريع', statPublished: 'منشورة',
      statDraft: 'مسودات', statFeatured: 'مميزة',
      projectsTitle: 'المشاريع', searchPlaceholder: 'ابحث في المشاريع…',
      filterAll: 'كل الحالات', filterPublished: 'منشور',
      filterDraft: 'مسودة', filterFeatured: 'مميز',
      thOrder: 'الترتيب', thProject: 'المشروع', thStatus: 'الحالة', thActions: 'إجراءات',
      loading: 'جارٍ التحميل…',
      noProjects: 'لا توجد مشاريع بعد. اضغط “+ مشروع جديد” لإضافة أول مشروع.',
      noMatches: 'لا توجد مشاريع مطابقة للبحث/التصفية الحالية.',
      filterCount: '{n} من {total} مشروع',
      fsBasic: '١ · المعلومات الأساسية', fsClass: '٢ · تصنيف المشروع',
      fsTech: '٣ · التقنيات', fsMedia: '٤ · الصورة الرئيسية والمعرض',
      fsLinks: '٥ · الروابط', fsPublishing: '٦ · إعدادات النشر',
      fTitle: 'العنوان *', fSlug: 'المعرف (slug) *', fShort: 'وصف مختصر *',
      fFull: 'الوصف الكامل', fIndustry: 'المجال', fType: 'نوع المشروع',
      fTech: 'التقنيات (مفصولة بفواصل)', fCover: 'رابط الصورة الرئيسية',
      uploadImage: '…أو ارفع صورة', replace: 'استبدال', remove: 'إزالة',
      fGallery: 'روابط صور المعرض (رابط في كل سطر)',
      uploadGallery: '…أو ارفع صور المعرض',
      fLive: 'رابط الموقع المباشر', fGithub: 'رابط GitHub',
      fSort: 'الترتيب', fStatus: 'الحالة',
      optDraft: 'مسودة (غير ظاهرة للزوار)', optPublished: 'منشور (ظاهر في الموقع)',
      fFeatured: 'مميز', optNo: 'لا', optYes: 'نعم',
      saveProject: 'حفظ المشروع', cancel: 'إلغاء',
      setupTitle: 'لم يتم إعداد الخلفية بعد', setupSub: 'انسخ', setupTo: 'إلى',
      setupRest: 'وأدخل رابط ومفتاح مشروع Supabase الجديد (Settings ← API)، ثم أعد تحميل الصفحة.',
      badgePublished: 'منشور', badgeDraft: 'مسودة', badgeFeatured: '★ مميز',
      moveUp: 'تحريك للأعلى', moveDown: 'تحريك للأسفل', edit: 'تعديل', del: 'حذف',
      deleteTitle: 'حذف “{title}”؟',
      deleteMsg: 'سيتم حذف المشروع نهائيًا من قاعدة البيانات. لا يمكن التراجع عن هذا الإجراء.',
      deleteConfirm: 'حذف نهائي', deleting: 'جارٍ الحذف…',
      orderUpdated: 'تم تحديث الترتيب', reorderFailed: 'فشل تحديث الترتيب',
      updateFailed: 'فشل التحديث', projectSaved: 'تم حفظ المشروع',
      projectCreated: 'تم إنشاء المشروع', saveFailed: 'فشل الحفظ',
      projectDeleted: 'تم حذف المشروع', deleteFailed: 'فشل الحذف',
      published: 'منشور', draft: 'مسودة', featured: 'مميز',
      galleryUrlTag: 'رابط',
    },
  };

  var lang = 'en';
  function t(key) {
    var dict = I18N[lang] || I18N.en;
    return dict[key] != null ? dict[key] : (I18N.en[key] != null ? I18N.en[key] : key);
  }

  function applyI18n() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (node) {
      node.setAttribute('placeholder', t(node.getAttribute('data-i18n-ph')));
    });
    document.querySelectorAll('[data-i18n-label]').forEach(function (node) {
      node.setAttribute('aria-label', t(node.getAttribute('data-i18n-label')));
    });
    var langBtn = document.getElementById('lang-btn');
    if (langBtn) langBtn.textContent = lang === 'en' ? 'العربية' : 'English';
    renderRows(); // re-render dynamic labels (badges, buttons)
  }

  document.getElementById('lang-btn').addEventListener('click', function () {
    lang = lang === 'en' ? 'ar' : 'en';
    applyI18n();
  });

  /* ================= elements & state ================= */

  var views = {
    login: document.getElementById('login-view'),
    dashboard: document.getElementById('dashboard-view'),
    setup: document.getElementById('setup-view'),
  };
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');
  var projectsError = document.getElementById('projects-error');
  var tbody = document.getElementById('projects-tbody');
  var editorCard = document.getElementById('editor-card');
  var editorHeading = document.getElementById('editor-heading');
  var editorSub = document.getElementById('editor-sub');
  var projectForm = document.getElementById('project-form');
  var modalRoot = document.getElementById('modal-root');
  var toastRoot = document.getElementById('toast-root');
  var filterCount = document.getElementById('filter-count');

  var searchInput = document.getElementById('search-input');
  var filterStatus = document.getElementById('filter-status');

  var statEls = {
    total: document.getElementById('stat-total'),
    published: document.getElementById('stat-published'),
    draft: document.getElementById('stat-draft'),
    featured: document.getElementById('stat-featured'),
  };

  var editingId = null; // null = creating
  var rows = [];        // full list from the database

  // pending (not yet uploaded) media state
  var pendingCoverFile = null;
  var pendingCoverRemoved = false;
  var pendingGalleryFiles = []; // File objects queued for upload
  var coverObjectUrl = null;

  function show(view) {
    Object.keys(views).forEach(function (k) {
      views[k].hidden = k !== view;
    });
    var fab = document.getElementById('a-fab');
    if (fab) fab.hidden = view !== 'dashboard';
  }

  function toast(messageKey, isError) {
    var tEl = document.createElement('div');
    tEl.className = 'admin-toast' + (isError ? ' admin-toast--error' : '');
    tEl.textContent = t(messageKey);
    toastRoot.appendChild(tEl);
    setTimeout(function () { tEl.remove(); }, 3200);
  }

  function fail(el, err) {
    el.textContent = err && err.message ? err.message : String(err);
    el.hidden = false;
  }

  /* The auto-slug field and the public cards must agree on the slug for the
     same title, so this is the shared implementation from js/util.js rather
     than a second copy that could drift. js/util.js loads before this file. */
  var slugify = window.NPUtil.slugify;

  /* ================= auth ================= */

  async function init() {
    applyI18n();
    if (!window.NP || !window.NP.isConfigured()) {
      show('setup');
      return;
    }
    var sb = window.NP.sb;
    var session = null;
    try {
      var res = await sb.auth.getSession();
      session = res.data && res.data.session;
    } catch (e) {
      session = null;
    }
    if (session) {
      await enterDashboard();
      if (window.NPContentAdmin && typeof window.NPContentAdmin.init === 'function') {
        try { window.NPContentAdmin.init(); } catch (e) { console.error('Admin content init failed:', e); }
      }
    } else {
      show('login');
    }

    sb.auth.onAuthStateChange(function (_event, s) {
      if (s) {
        enterDashboard();
        if (window.NPContentAdmin && typeof window.NPContentAdmin.init === 'function') {
          try { window.NPContentAdmin.init(); } catch (e) { console.error('Admin content init failed:', e); }
        }
      } else { show('login'); }
    });
  }

  async function enterDashboard() {
    show('dashboard');
    var user = (await window.NP.sb.auth.getUser()).data.user;
    var email = user && user.email ? user.email : '';
    document.getElementById('admin-email').textContent = email || '(unknown)';
    document.getElementById('admin-avatar').textContent = email ? email.charAt(0).toUpperCase() : '?';
    await loadRows();
  }

  loginForm.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    loginError.hidden = true;
    var btn = document.getElementById('login-btn');
    btn.disabled = true;
    try {
      var email = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      var res = await window.NP.sb.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw res.error;
      if (window.NPContentAdmin && typeof window.NPContentAdmin.init === 'function') {
        try { window.NPContentAdmin.init(); } catch (e) { console.error('Admin content init failed:', e); }
      }
    } catch (err) {
      fail(loginError, err);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('logout-btn').addEventListener('click', function () {
    window.NP.sb.auth.signOut();
  });

  /* ================= stats ================= */

  function updateStats() {
    var published = 0, featured = 0;
    rows.forEach(function (p) {
      if (p.published) published++;
      if (p.featured) featured++;
    });
    statEls.total.textContent = String(rows.length);
    statEls.published.textContent = String(published);
    statEls.draft.textContent = String(rows.length - published);
    statEls.featured.textContent = String(featured);
  }

  /* ================= list: load / filter / render ================= */

  async function loadRows() {
    projectsError.hidden = true;
    tbody.innerHTML = '<tr><td colspan="4">' + t('loading') + '</td></tr>';
    try {
      var res = await window.NP.sb
        .from('projects')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (res.error) throw res.error;
      rows = res.data || [];
      updateStats();
      renderRows();
    } catch (err) {
      tbody.innerHTML = '';
      fail(projectsError, err);
    }
  }

  function getFilteredRows() {
    var q = (searchInput.value || '').trim().toLowerCase();
    var status = filterStatus.value;
    return rows.filter(function (p) {
      if (status === 'published' && !p.published) return false;
      if (status === 'draft' && p.published) return false;
      if (status === 'featured' && !p.featured) return false;
      if (!q) return true;
      var hay = [
        p.title, p.slug, p.industry, p.project_type,
        Array.isArray(p.technologies) ? p.technologies.join(' ') : '',
      ].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function mkBadge(text, cls, clickable, onClick, title) {
    var b = document.createElement('span');
    b.className = 'badge' + (cls ? ' ' + cls : '') + (clickable ? ' is-clickable' : '');
    b.textContent = text;
    if (title) b.title = title;
    if (clickable && onClick) b.addEventListener('click', onClick);
    return b;
  }

  function renderRows() {
    if (!views.dashboard || views.dashboard.hidden) return;
    var list = getFilteredRows();
    tbody.innerHTML = '';

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">' + t('noProjects') + '</td></tr>';
      filterCount.hidden = true;
      return;
    }
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="4">' + t('noMatches') + '</td></tr>';
      filterCount.hidden = false;
      filterCount.textContent = t('filterCount').replace('{n}', '0').replace('{total}', String(rows.length));
      return;
    }
    filterCount.hidden = false;
    filterCount.textContent = t('filterCount')
      .replace('{n}', String(list.length))
      .replace('{total}', String(rows.length));

    list.forEach(function (p, i) {
      var tr = document.createElement('tr');

      // order controls
      var tdOrder = document.createElement('td');
      var wrap = document.createElement('span');
      wrap.className = 'a-orderbtns';
      var up = document.createElement('button');
      up.type = 'button';
      up.className = 'admin-iconbtn'; up.textContent = '↑';
      up.setAttribute('aria-label', t('moveUp')); up.title = t('moveUp');
      up.disabled = i === 0;
      up.addEventListener('click', function () { move(p, -1); });
      var down = document.createElement('button');
      down.type = 'button';
      down.className = 'admin-iconbtn'; down.textContent = '↓';
      down.setAttribute('aria-label', t('moveDown')); down.title = t('moveDown');
      down.disabled = i === list.length - 1;
      down.addEventListener('click', function () { move(p, +1); });
      wrap.appendChild(up); wrap.appendChild(down);
      tdOrder.appendChild(wrap);
      tr.appendChild(tdOrder);

      // project: thumbnail + title + slug
      var tdTitle = document.createElement('td');
      var cell = document.createElement('div');
      cell.className = 'a-titlecell';
      var line = document.createElement('div');
      line.style.display = 'flex';
      line.style.alignItems = 'center';
      line.style.gap = '10px';
      if (p.cover_image_url) {
        var img = document.createElement('img');
        img.className = 'a-thumb';
        img.src = p.cover_image_url;
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('error', function () { img.replaceWith(mkThumbFallback()); });
        line.appendChild(img);
      } else {
        line.appendChild(mkThumbFallback());
      }
      var strong = document.createElement('strong');
      strong.textContent = p.title;
      line.appendChild(strong);
      cell.appendChild(line);
      var slugSpan = document.createElement('span');
      slugSpan.textContent = '/' + (p.slug || '');
      cell.appendChild(slugSpan);
      tdTitle.appendChild(cell);
      tr.appendChild(tdTitle);

      // status badges
      var tdStatus = document.createElement('td');
      tdStatus.style.whiteSpace = 'nowrap';
      tdStatus.appendChild(mkBadge(
        p.published ? t('badgePublished') : t('badgeDraft'),
        p.published ? 'badge--published' : 'badge--draft',
        true,
        function () { toggleField(p, 'published'); },
        t('published') + ' / ' + t('draft') + ' — click to toggle'
      ));
      tdStatus.appendChild(document.createTextNode(' '));
      if (p.featured) {
        tdStatus.appendChild(mkBadge(
          t('badgeFeatured'), 'badge--featured', true,
          function () { toggleField(p, 'featured'); }, 'Featured — click to toggle'
        ));
      } else {
        tdStatus.appendChild(mkBadge('☆', 'badge--muted', true,
          function () { toggleField(p, 'featured'); }, 'Featured — click to toggle'));
      }
      tr.appendChild(tdStatus);

      // actions
      var tdActions = document.createElement('td');
      tdActions.style.whiteSpace = 'nowrap';
      function mkBtn(label, title, danger, fn) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'admin-iconbtn' + (danger ? ' admin-iconbtn--danger' : '');
        b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
        b.addEventListener('click', fn);
        return b;
      }
      tdActions.appendChild(mkBtn(t('edit'), t('edit'), false, function () { openEditor(p); }));
      tdActions.appendChild(document.createTextNode(' '));
      tdActions.appendChild(mkBtn(t('del'), t('del'), true, function () { confirmDelete(p); }));
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  function mkThumbFallback() {
    var d = document.createElement('span');
    d.className = 'a-thumb a-thumb--empty';
    d.textContent = '🖼';
    return d;
  }

  searchInput.addEventListener('input', renderRows);
  filterStatus.addEventListener('change', renderRows);
  document.getElementById('refresh-btn').addEventListener('click', loadRows);

  async function move(p, dir) {
    var idx = rows.findIndex(function (r) { return r.id === p.id; });
    var swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= rows.length) return;
    var a = rows[idx], b = rows[swapIdx];
    try {
      var res1 = await window.NP.sb.from('projects').update({ sort_order: b.sort_order }).eq('id', a.id);
      if (res1.error) throw res1.error;
      var res2 = await window.NP.sb.from('projects').update({ sort_order: a.sort_order }).eq('id', b.id);
      if (res2.error) throw res2.error;
      await loadRows();
      toast('orderUpdated');
    } catch (err) {
      toast(err.message || 'reorderFailed', true);
    }
  }

  async function toggleField(p, field) {
    try {
      var patch = {};
      patch[field] = !p[field];
      var res = await window.NP.sb.from('projects').update(patch).eq('id', p.id);
      if (res.error) throw res.error;
      await loadRows();
    } catch (err) {
      toast(err.message || 'updateFailed', true);
    }
  }

  /* ================= editor ================= */

  document.getElementById('new-project-btn').addEventListener('click', function () {
    openEditor(null);
  });
  document.getElementById('a-fab').addEventListener('click', function () {
    openEditor(null);
  });
  document.getElementById('cancel-btn').addEventListener('click', function () {
    editorCard.hidden = true;
  });
  document.getElementById('editor-close').addEventListener('click', function () {
    editorCard.hidden = true;
  });

  function openEditor(p) {
    editingId = p ? p.id : null;
    pendingCoverFile = null;
    pendingCoverRemoved = false;
    pendingGalleryFiles = [];
    if (coverObjectUrl) { URL.revokeObjectURL(coverObjectUrl); coverObjectUrl = null; }
    editorHeading.textContent = p ? (lang === 'ar' ? 'تعديل المشروع' : 'Edit project')
                                  : t('newProject');
    editorSub.textContent = p ? '/' + (p.slug || '') : '';
    document.getElementById('f-title').value = p ? p.title || '' : '';
    document.getElementById('f-slug').value = p ? p.slug || '' : '';
    document.getElementById('f-slug').dataset.touched = p ? '1' : '';
    document.getElementById('f-short').value = p ? p.short_description || '' : '';
    document.getElementById('f-full').value = p ? p.full_description || '' : '';
    document.getElementById('f-industry').value = p ? p.industry || '' : '';
    document.getElementById('f-type').value = p ? p.project_type || '' : '';
    document.getElementById('f-tech').value =
      p && Array.isArray(p.technologies) ? p.technologies.join(', ') : '';
    document.getElementById('f-cover').value = p ? p.cover_image_url || '' : '';
    document.getElementById('f-gallery').value =
      p && Array.isArray(p.gallery_image_urls) ? p.gallery_image_urls.join('\n') : '';
    document.getElementById('f-live').value = p ? p.live_url || '' : '';
    document.getElementById('f-github').value = p ? p.github_url || '' : '';
    document.getElementById('f-sort').value = p ? String(p.sort_order || 0) : '0';
    document.getElementById('f-published').value = p && p.published ? 'true' : 'false';
    document.getElementById('f-featured').value = p && p.featured ? 'true' : 'false';
    updateCoverPreview();
    renderTechChips();
    renderGalleryGrid();
    editorCard.hidden = false;
    editorCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // auto-slug for new projects
  document.getElementById('f-title').addEventListener('input', function () {
    if (editingId) return;
    var slugField = document.getElementById('f-slug');
    if (!slugField.dataset.touched) slugField.value = slugify(this.value);
  });
  document.getElementById('f-slug').addEventListener('input', function () {
    this.dataset.touched = '1';
  });

  /* ---- technologies chips ---- */

  function renderTechChips() {
    var chips = document.getElementById('tech-chips');
    var techs = parseTech(document.getElementById('f-tech').value);
    chips.innerHTML = '';
    if (!techs.length) { chips.hidden = true; return; }
    chips.hidden = false;
    techs.forEach(function (tech) {
      var chip = document.createElement('span');
      chip.className = 'a-chip';
      chip.textContent = tech;
      chips.appendChild(chip);
    });
  }
  document.getElementById('f-tech').addEventListener('input', renderTechChips);

  /* ---- cover preview / replace / remove ---- */

  function loadPreviewImage(img, src, onFail) {
    var done = false;
    var to = setTimeout(function () { if (!done) { done = true; onFail(); } }, 8000);
    img.onload = function () { if (!done) { done = true; clearTimeout(to); } };
    img.onerror = function () { if (!done) { done = true; clearTimeout(to); onFail(); } };
    img.src = src;
  }

  function updateCoverPreview() {
    var box = document.getElementById('cover-preview');
    var img = document.getElementById('cover-preview-img');
    var nameEl = document.getElementById('cover-preview-name');
    var url = document.getElementById('f-cover').value.trim();

    if (pendingCoverFile) {
      if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
      coverObjectUrl = URL.createObjectURL(pendingCoverFile);
      img.src = coverObjectUrl;
      nameEl.textContent = pendingCoverFile.name;
      box.hidden = false;
      return;
    }
    if (url) {
      loadPreviewImage(img, url, function () {
        img.removeAttribute('src');
        nameEl.textContent = '⚠ ' + url;
      });
      nameEl.textContent = url.split('/').pop() || url;
      box.hidden = false;
    } else {
      img.removeAttribute('src');
      nameEl.textContent = '';
      box.hidden = true;
    }
  }

  document.getElementById('f-cover').addEventListener('input', function () {
    if (pendingCoverFile) { pendingCoverFile = null; }
    pendingCoverRemoved = false;
    updateCoverPreview();
  });

  document.getElementById('f-cover-file').addEventListener('change', function () {
    if (this.files && this.files[0]) {
      pendingCoverFile = this.files[0];
      pendingCoverRemoved = false;
      updateCoverPreview();
    }
    this.value = ''; // allow re-picking the same file
  });

  document.getElementById('cover-replace-btn').addEventListener('click', function () {
    document.getElementById('f-cover-file').click();
  });

  document.getElementById('cover-remove-btn').addEventListener('click', function () {
    pendingCoverFile = null;
    pendingCoverRemoved = true;
    document.getElementById('f-cover').value = '';
    updateCoverPreview();
  });

  /* ---- gallery grid ---- */

  function renderGalleryGrid() {
    var grid = document.getElementById('gallery-grid');
    var urls = parseGallery(document.getElementById('f-gallery').value);
    grid.innerHTML = '';
    if (!urls.length && !pendingGalleryFiles.length) { grid.hidden = true; return; }
    grid.hidden = false;

    urls.forEach(function (url, idx) {
      var item = document.createElement('div');
      item.className = 'a-gallery__item';
      var img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      loadPreviewImage(img, url, function () {
        img.removeAttribute('src');
        item.style.borderColor = 'var(--red)';
      });
      var tag = document.createElement('span');
      tag.className = 'a-gallery__tag';
      tag.textContent = t('galleryUrlTag');
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'a-gallery__remove';
      rm.textContent = '✕';
      rm.setAttribute('aria-label', t('remove'));
      rm.title = t('remove');
      rm.addEventListener('click', function () {
        var ta = document.getElementById('f-gallery');
        var list = parseGallery(ta.value);
        list.splice(idx, 1);
        ta.value = list.join('\n');
        renderGalleryGrid();
      });
      item.appendChild(img); item.appendChild(tag); item.appendChild(rm);
      grid.appendChild(item);
    });

    pendingGalleryFiles.forEach(function (file, idx) {
      var item = document.createElement('div');
      item.className = 'a-gallery__item';
      var img = document.createElement('img');
      img.alt = '';
      img.src = URL.createObjectURL(file);
      var tag = document.createElement('span');
      tag.className = 'a-gallery__tag';
      tag.textContent = 'NEW';
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'a-gallery__remove';
      rm.textContent = '✕';
      rm.setAttribute('aria-label', t('remove'));
      rm.title = t('remove');
      rm.addEventListener('click', function () {
        URL.revokeObjectURL(img.src);
        pendingGalleryFiles.splice(idx, 1);
        renderGalleryGrid();
      });
      item.appendChild(img); item.appendChild(tag); item.appendChild(rm);
      grid.appendChild(item);
    });
  }

  document.getElementById('f-gallery').addEventListener('input', renderGalleryGrid);

  document.getElementById('f-gallery-files').addEventListener('change', function () {
    var incoming = Array.prototype.slice.call(this.files || []);
    incoming.forEach(function (f) { pendingGalleryFiles.push(f); });
    this.value = '';
    renderGalleryGrid();
  });

  /* ---- save ---- */

  function parseTech(text) {
    return text.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function parseGallery(text) {
    return text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  async function uploadImage(file, stem, suffix) {
    var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    var safeStem = slugify(stem) || 'project';
    var path = 'nourhan-portfolio/' + safeStem + '-' + Date.now() + '-' + suffix + '.' + ext;
    var res = await window.NP.sb.storage
      .from('project-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (res.error) throw res.error;
    return window.NP.sb.storage.from('project-images').getPublicUrl(path).data.publicUrl;
  }

  projectForm.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;
    try {
      var payload = {
        title: document.getElementById('f-title').value.trim(),
        slug: slugify(document.getElementById('f-slug').value.trim()),
        short_description: document.getElementById('f-short').value.trim(),
        full_description: document.getElementById('f-full').value.trim() || null,
        industry: document.getElementById('f-industry').value.trim() || null,
        project_type: document.getElementById('f-type').value.trim() || null,
        technologies: parseTech(document.getElementById('f-tech').value),
        live_url: document.getElementById('f-live').value.trim() || null,
        github_url: document.getElementById('f-github').value.trim() || null,
        featured: document.getElementById('f-featured').value === 'true',
        published: document.getElementById('f-published').value === 'true',
        sort_order: parseInt(document.getElementById('f-sort').value, 10) || 0,
      };

      // uploads first, so URLs land in the same row write
      if (pendingCoverFile) {
        payload.cover_image_url = await uploadImage(pendingCoverFile, payload.slug, 'cover');
      } else if (pendingCoverRemoved) {
        payload.cover_image_url = null;
      } else {
        payload.cover_image_url = document.getElementById('f-cover').value.trim() || null;
      }

      var galleryUrls = parseGallery(document.getElementById('f-gallery').value);
      if (pendingGalleryFiles.length) {
        for (var i = 0; i < pendingGalleryFiles.length; i++) {
          galleryUrls.push(await uploadImage(pendingGalleryFiles[i], payload.slug, 'gallery' + (i + 1)));
        }
      }
      payload.gallery_image_urls = galleryUrls;

      var res;
      if (editingId) {
        res = await window.NP.sb.from('projects').update(payload).eq('id', editingId);
      } else {
        res = await window.NP.sb.from('projects').insert(payload);
      }
      if (res.error) throw res.error;

      toast(editingId ? 'projectSaved' : 'projectCreated');
      editorCard.hidden = true;
      await loadRows();
    } catch (err) {
      toast(err.message || 'saveFailed', true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  /* ================= delete ================= */

  function confirmDelete(p) {
    modalRoot.innerHTML = '';
    var backdrop = document.createElement('div');
    backdrop.className = 'admin-modal-backdrop';
    var modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    var h = document.createElement('h3');
    h.textContent = t('deleteTitle').replace('{title}', p.title);
    var msg = document.createElement('p');
    msg.textContent = t('deleteMsg');
    var actions = document.createElement('div');
    actions.className = 'admin-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--ghost'; cancelBtn.type = 'button';
    cancelBtn.textContent = t('cancel');
    cancelBtn.addEventListener('click', function () { modalRoot.innerHTML = ''; });
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) modalRoot.innerHTML = '';
    });

    var delBtn = document.createElement('button');
    delBtn.className = 'btn btn--danger'; delBtn.type = 'button';
    delBtn.textContent = t('deleteConfirm');
    delBtn.addEventListener('click', async function () {
      delBtn.disabled = true;
      delBtn.textContent = t('deleting');
      try {
        var res = await window.NP.sb.from('projects').delete().eq('id', p.id);
        if (res.error) throw res.error;
        modalRoot.innerHTML = '';
        toast('projectDeleted');
        await loadRows();
      } catch (err) {
        toast(err.message || 'deleteFailed', true);
        delBtn.disabled = false;
        delBtn.textContent = t('deleteConfirm');
      }
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(delBtn);
    modal.appendChild(h);
    modal.appendChild(msg);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    modalRoot.appendChild(backdrop);
  }

  /* ================= boot ================= */

  init();
})();
