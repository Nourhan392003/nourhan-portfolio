/* nourhan-portfolio · js/ai-recruiter.js
 * ============================================================
 * The AI Recruiter chat panel — public behaviour, no libraries.
 *
 * It is the ONLY thing on the site that talks to /api/chat, and it
 * knows nothing about Gemini or any API key: the backend owns the
 * secret and the portfolio facts. This file just renders the
 * conversation and handles loading / error / retry states.
 *
 * Two entry points on the page:
 *   · the inline section  ([data-ai-recruiter])  — always visible
 *   · the floating launcher ([data-ai-launcher]) — opens a docked panel
 * Both drive the same composer and message renderer.
 *
 * Progressive enhancement: with no JS the section still shows its
 * heading, intro and the static contact fallback. Nothing is hidden
 * that only JS can reveal, and no message is ever faked — if the
 * backend is not configured the visitor is told so and pointed at the
 * real contact details.
 * ============================================================ */
(function () {
  'use strict';

  var endpoint = 'api/chat';

  /* Bilingual copy, so an Arabic-speaking recruiter is answered in Arabic
     by the model and the surrounding chrome matches. */
  var COPY = {
    placeholder: 'Ask about skills, projects or experience…',
    send: 'Send',
    thinking: 'Thinking…',
    errorTitle: 'Something went wrong',
    retry: 'Try again',
    notConfigured:
      'The AI Recruiter is not switched on yet. Please reach out directly instead.',
    welcome:
      "Hi! I'm the AI Recruiter for Nourhan Ashraf. Ask me about her skills, " +
      'projects, experience or how to get in touch.',
  };

  var SUGGESTIONS = [
    'What are her strongest technical skills?',
    'Tell me about the TCG Vault platform.',
    'What is her experience with payment integrations?',
    'How can I contact her?',
  ];

  /* Conversation state, shared by both entry points. */
  var history = []; // [{role:'user'|'assistant', text}]
  var busy = false;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text; // textContent only — never innerHTML
    return node;
  }

  /* ---------------- message rendering ---------------- */

  /* A deliberately tiny, SAFE Markdown subset: **bold**, `* ` / `- `
     bullets and `### ` headings. Everything is built with DOM nodes —
     textContent and createElement only, never innerHTML — so model output
     can never become markup, even if it contains HTML. Anything not
     matched is shown as literal text. */
  function appendInline(parent, line) {
    var parts = String(line).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    parts.forEach(function (part) {
      if (!part) return;
      if (part.length > 4 && part.slice(0, 2) === '**' && part.slice(-2) === '**') {
        var strong = document.createElement('strong');
        strong.textContent = part.slice(2, -2);
        parent.appendChild(strong);
      } else if (part.length > 2 && part[0] === '`' && part[part.length - 1] === '`') {
        var code = document.createElement('code');
        code.textContent = part.slice(1, -1);
        parent.appendChild(code);
      } else {
        parent.appendChild(document.createTextNode(part));
      }
    });
  }

  function renderMessage(container, role, text) {
    var wrap = el('div', 'air-msg air-msg--' + role);
    var bubble = el('div', 'air-msg__bubble');

    var lines = String(text).split('\n');
    var list = null; // an open <ul>, so consecutive bullets share one list

    function closeList() {
      if (list) {
        bubble.appendChild(list);
        list = null;
      }
    }

    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, '');
      var bullet = line.match(/^\s*[*-]\s+(.*)$/);
      var heading = line.match(/^\s*#{1,6}\s+(.*)$/);

      if (bullet) {
        if (!list) list = document.createElement('ul');
        var li = document.createElement('li');
        appendInline(li, bullet[1]);
        list.appendChild(li);
        return;
      }
      closeList();

      if (!line.trim()) {
        /* collapse a blank line into a small gap, never an empty element */
        var gap = el('span', 'air-gap');
        bubble.appendChild(gap);
        return;
      }

      var p = document.createElement('p');
      p.className = 'air-p';
      appendInline(p, heading ? heading[1] : line);
      if (heading) p.classList.add('air-p--heading');
      bubble.appendChild(p);
    });
    closeList();

    wrap.appendChild(bubble);
    container.appendChild(wrap);
    scrollToEnd(container);
    return wrap;
  }

  function scrollToEnd(container) {
    /* The scroll container is the panel, not the page. */
    var scrollable = container.closest('.air-panel__body') || container.parentNode;
    if (scrollable && typeof scrollable.scrollTop === 'number') {
      scrollable.scrollTop = scrollable.scrollHeight;
    }
  }

  function renderTyping(container) {
    var wrap = el('div', 'air-msg air-msg--assistant air-msg--typing');
    var bubble = el('div', 'air-msg__bubble');
    bubble.appendChild(el('span', 'air-dot'));
    bubble.appendChild(el('span', 'air-dot'));
    bubble.appendChild(el('span', 'air-dot'));
    wrap.appendChild(bubble);
    container.appendChild(wrap);
    scrollToEnd(container);
    return wrap;
  }

  function renderError(container, message, onRetry) {
    var wrap = el('div', 'air-msg air-msg--error');
    var bubble = el('div', 'air-msg__bubble');
    bubble.appendChild(el('p', 'air-msg__error-title', COPY.errorTitle));
    bubble.appendChild(el('p', 'air-msg__error-text', message));
    if (onRetry) {
      var retry = el('button', 'air-retry', COPY.retry);
      retry.type = 'button';
      retry.addEventListener('click', function () {
        wrap.remove();
        onRetry();
      });
      bubble.appendChild(retry);
    }
    wrap.appendChild(bubble);
    container.appendChild(wrap);
    scrollToEnd(container);
  }

  /* ---------------- the request ---------------- */

  function ask(panel, text) {
    if (busy) return;
    var message = String(text || '').trim();
    if (!message) return;

    var log = panel.querySelector('[data-air-log]');

    busy = true;
    setBusy(panel, true);
    renderMessage(log, 'user', message);
    var typing = renderTyping(log);

    /* Only the last handful of turns are sent; the server caps them too. */
    var payloadHistory = history.slice(-8);

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message, history: payloadHistory }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        typing.remove();
        busy = false;
        setBusy(panel, false);

        var data = result.data || {};

        if (result.ok && typeof data.reply === 'string' && data.reply) {
          history.push({ role: 'user', text: message });
          history.push({ role: 'assistant', text: data.reply });
          renderMessage(log, 'assistant', data.reply);
          return;
        }

        /* A configured-but-empty answer still comes back as a normal
           assistant bubble (see the backend), so anything else here is
           a real failure the visitor can retry. */
        var msg = typeof data.error === 'string' && data.error
          ? data.error
          : COPY.notConfigured;
        renderError(log, msg, function () {
          ask(panel, message);
        });
      })
      .catch(function () {
        typing.remove();
        busy = false;
        setBusy(panel, false);
        renderError(log, COPY.notConfigured, function () {
          ask(panel, message);
        });
      });
  }

  function setBusy(panel, isBusy) {
    panel.setAttribute('data-busy', isBusy ? 'true' : 'false');
    var input = panel.querySelector('[data-air-input]');
    var button = panel.querySelector('[data-air-send]');
    if (input) input.disabled = isBusy;
    if (button) button.disabled = isBusy;

    /* The mascot reacts to the request: its think() speeds the animations up
       for as long as a reply is in flight (see js/ai-mascot.js + styles.css).
       Guarded, because the mascot script is optional. */
    if (window.NPMascot && typeof window.NPMascot.think === 'function') {
      window.NPMascot.think(isBusy);
    }
  }

  /* ---------------- panel construction ---------------- */

  function buildSuggestions(panel) {
    var holder = panel.querySelector('[data-air-suggestions]');
    if (!holder) return;
    SUGGESTIONS.forEach(function (q) {
      var chip = el('button', 'air-chip', q);
      chip.type = 'button';
      chip.addEventListener('click', function () {
        ask(panel, q);
      });
      holder.appendChild(chip);
    });
  }

  function buildWelcome(panel) {
    var log = panel.querySelector('[data-air-log]');
    if (!log || log.childElementCount) return;
    renderMessage(log, 'assistant', COPY.welcome);
  }

  function wireForm(panel) {
    var form = panel.querySelector('[data-air-form]');
    var input = panel.querySelector('[data-air-input]');
    var button = panel.querySelector('[data-air-send]');
    if (button) button.textContent = COPY.send;
    if (input) input.setAttribute('placeholder', COPY.placeholder);
    if (!form || !input) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var value = input.value;
      input.value = '';
      ask(panel, value);
    });
    /* Keep the disabled state honest while a reply is in flight. */
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        /* The submit handler owns the send; let it fire. */
        return;
      }
    });
  }

  function initPanel(panel) {
    buildWelcome(panel);
    buildSuggestions(panel);
    wireForm(panel);
  }

  /* ---------------- open/close ---------------- */

  /* Any element marked [data-ai-open] opens the chat that lives in the
     section (directly under the mascot) — the section's own button, the
     mascot itself, and the floating launcher all carry it. The floating one
     is the only trigger that has to scroll, because the chat is not in view
     when you press a button fixed to the corner. */
  function initChat() {
    var chat = document.querySelector('[data-ai-chat]');
    if (!chat) return;

    var open = false;

    /* Scroll the window to the chat — computed by hand instead of
       scrollIntoView, whose smooth behaviour browsers can silently cancel
       when competing focus/scroll work is in flight. */
    function scrollToChat(smooth) {
      var rect = chat.getBoundingClientRect();
      var absTop = rect.top + (window.scrollY || window.pageYOffset || 0);
      var target = absTop - Math.max(24, (window.innerHeight - rect.height) / 2);
      window.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
    }

    function setOpen(next, shouldScroll) {
      open = next;
      chat.setAttribute('data-open', open ? 'true' : 'false');
      chat.setAttribute('aria-hidden', open ? 'false' : 'true');
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-ai-open]'),
        function (btn) {
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
      );
      if (open) {
        if (shouldScroll) scrollToChat(true);
        /* focus after the open transition paints — preventScroll keeps the
           focus call from yanking or cancelling any scroll in flight */
        var input = chat.querySelector('[data-air-input]');
        window.setTimeout(function () {
          if (open && input && input.focus) {
            try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
          }
        }, 80);
      }
    }

    Array.prototype.forEach.call(
      document.querySelectorAll('[data-ai-open]'),
      function (btn) {
        btn.setAttribute('aria-controls', 'ai-chat');
        btn.setAttribute('aria-expanded', 'false');
        /* The floating launcher is the one that must scroll to the chat — and
           it performs first: the girl jumps, squashes and sparkles, THEN the
           chat slides open (see fab--ai.np-girl-jump in styles.css). */
        var isFab = btn.classList && btn.classList.contains('fab--ai');
        btn.addEventListener('click', function () {
          if (isFab && btn.classList.contains('has-girl')) {
            if (btn.classList.contains('np-girl-jump')) return;
            btn.classList.add('np-girl-jump');
            /* the window glides WHILE she leaps — scroll lands as she lands */
            scrollToChat(true);
            /* safety: if the smooth glide was interrupted, snap the rest */
            window.setTimeout(function () {
              var r = chat.getBoundingClientRect();
              if (r.top < -40 || r.top > window.innerHeight) scrollToChat(false);
            }, 500);
            window.setTimeout(function () {
              btn.classList.remove('np-girl-jump');
              setOpen(true, false);
            }, 440);
            return;
          }
          setOpen(true, isFab);
        });
      }
    );

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && open) setOpen(false, false);
    });

    var closer = chat.querySelector('[data-air-close]');
    if (closer) {
      closer.addEventListener('click', function () {
        setOpen(false, false);
      });
    }
  }

  /* ---------------- boot ---------------- */

  function boot() {
    /* The chat lives in the section, under the mascot. It is hidden until
       the visitor asks for it — from the section button, the mascot, or the
       floating launcher. All three carry [data-ai-open]. */
    var chat = document.querySelector('[data-ai-chat]');
    if (chat) {
      initPanel(chat);
      initChat();
    }

    /* When the chibi girl image exists, she becomes the floating launcher:
       flag the button so CSS swaps the fallback hexagon out for her, and the
       jump-and-pop click performance can run. A 404 or a missing file just
       leaves the crisp SVG fallback — the control is never broken. */
    var fab = document.querySelector('.fab--ai');
    var girl = fab ? fab.querySelector('.fab__girl') : null;
    if (fab && girl) {
      var flag = function () {
        if (girl.naturalWidth > 1) fab.classList.add('has-girl');
        else girl.style.display = 'none';
      };
      if (girl.complete) flag();
      else {
        girl.addEventListener('load', flag);
        girl.addEventListener('error', function () {
          girl.style.display = 'none';
        });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
