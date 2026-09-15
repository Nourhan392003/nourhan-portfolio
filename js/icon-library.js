/* nourhan-portfolio · icon library
 * ------------------------------------------------------------
 * One source of truth for the inline SVG marks used by both the
 * public portfolio and the admin dashboard.
 *
 * Rules:
 *   · icon keys are a FIXED allowlist — nothing else may be stored
 *   · a key is a safe string; raw SVG / HTML is never accepted
 *   · marks render from this file only, never from user input
 *   · no Supabase config, API keys or credentials live here
 *
 * The brand marks are the official Simple Icons (CC0) geometry that
 * the public Stack section already ships; the two practice marks
 * (responsive / animation) are the hand-drawn line marks from the
 * same section. That keeps admin previews identical to the site.
 */
(function () {
  'use strict';

  var KEYS = [
    'html',
    'css',
    'javascript',
    'responsive',
    'animation',
    'git',
    'github',
    'vscode',
    'figma',
    'supabase',
  ];

  var LABELS = {
    html: "HTML",
    css: "CSS",
    javascript: "JavaScript",
    responsive: "Responsive Design",
    animation: "UI Animation",
    git: "Git",
    github: "GitHub",
    vscode: "VS Code",
    figma: "Figma",
    supabase: "Supabase",
  };

  /* exact inline SVG per key — no external fetches, no emoji */
  var MARKS = {
    html:
      "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" focusable=\"false\"><path d=\"M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z\" /></svg>",
    css:
      "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" focusable=\"false\"><path d=\"M1.5 0h21l-1.91 21.563L11.977 24l-8.565-2.438L1.5 0zm17.09 4.413L5.41 4.41l.213 2.622 10.125.002-.255 2.716h-6.64l.24 2.573h6.182l-.366 3.523-2.91.804-2.956-.81-.188-2.11h-2.61l.29 3.855L12 19.288l5.373-1.53L18.59 4.414z\" /></svg>",
    javascript:
      "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" focusable=\"false\"><path d=\"M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z\" /></svg>",
    responsive:
      "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" focusable=\"false\"><rect x=\"1.6\" y=\"3.6\" width=\"12.6\" height=\"9.2\" rx=\"1.8\" /><path d=\"M8 12.8v3.4\" /><path d=\"M5.4 16.2h5.2\" /><rect x=\"15.1\" y=\"8.4\" width=\"7.3\" height=\"11.6\" rx=\"1.8\" /><path d=\"M17.8 17.6h2\" /></svg>",
    animation:
      "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" focusable=\"false\"><path d=\"M3.6 19.4C9.2 19.4 9.8 5.6 20.4 5.6\" /><circle cx=\"3.6\" cy=\"19.4\" r=\"1.9\" /><circle cx=\"20.4\" cy=\"5.6\" r=\"1.9\" /></svg>",
    git:
      "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" focusable=\"false\"><path d=\"M23.546 10.93L13.067.452c-.604-.603-1.582-.603-2.188 0L8.708 2.627l2.76 2.76c.645-.215 1.379-.07 1.889.441.516.515.658 1.258.438 1.9l2.658 2.66c.645-.223 1.387-.078 1.9.435.721.72.721 1.884 0 2.604-.719.719-1.881.719-2.6 0-.539-.541-.674-1.337-.404-1.996L12.86 8.955v6.525c.176.086.342.203.488.348.713.721.713 1.883 0 2.6-.719.721-1.889.721-2.609 0-.719-.719-.719-1.879 0-2.598.182-.18.387-.316.605-.406V8.835c-.217-.091-.424-.222-.6-.401-.545-.545-.676-1.342-.396-2.009L7.636 3.7.45 10.881c-.6.605-.6 1.584 0 2.189l10.48 10.477c.604.604 1.582.604 2.186 0l10.43-10.43c.605-.603.605-1.582 0-2.187\" /></svg>",
    github:
      "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" focusable=\"false\"><path d=\"M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12\" /></svg>",
    vscode:
      "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" focusable=\"false\"><path d=\"M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z\" /></svg>",
    figma:
      "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" focusable=\"false\"><path d=\"M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.097-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h.098c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-.098z\" /></svg>",
    supabase:
      "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" focusable=\"false\"><path d=\"M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z\" /></svg>",
  };

  function safeKey(key) {
    if (typeof key !== 'string') return null;
    var k = key.trim().toLowerCase();
    return KEYS.indexOf(k) === -1 ? null : k;
  }

  function isAllowed(key) {
    return safeKey(key) !== null;
  }

  function labelFor(key) {
    var k = safeKey(key);
    return k ? LABELS[k] : '';
  }

  /* returns inline SVG markup for an allowlisted key, else '' */
  function render(key, extraClass) {
    var k = safeKey(key);
    if (!k) return '';
    var mark = MARKS[k];
    if (!mark) return '';
    if (!extraClass) return mark;
    return mark.replace('<svg ', '<svg class="' + String(extraClass) + '" ');
  }

  /* <option> list for the admin icon selector */
  function options(selected) {
    var sel = safeKey(selected);
    var out = '<option value="">Choose an icon</option>';
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      out += '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' +
        LABELS[k] + '</option>';
    }
    return out;
  }

  window.IconLibrary = {
    keys: KEYS.slice(),
    labels: LABELS,
    isAllowed: isAllowed,
    safeKey: safeKey,
    labelFor: labelFor,
    render: render,
    options: options
  };
})();
