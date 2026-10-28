/* nourhan-portfolio · ai-mascot.js
 * ============================================================
 * Draws the AI Recruiter mascot — a friendly standing robot — as inline
 * SVG, in the site's violet palette. Modeled on the reference character:
 *
 *   · a large egg-shaped head tilted slightly
 *   · a big glossy black visor covering most of the face
 *   · two thick upward-curving "happy" eyes  ( ⌣  ⌣ )
 *   · a small smile dot
 *   · thick side rings on the head
 *   · a segmented, mechanical body with panel lines
 *   · raised arms, as if waving hello
 *   · standing on two jointed feet
 *
 * No image to download, so it costs no request and stays crisp at any size.
 * The static shell is markup built here; the motion is all CSS (see
 * styles.css). One live signal is exposed:
 *
 *   window.NPMascot.think(true|false)
 *
 *     The chat panel calls think(true) while a reply is in flight. That sets
 *     [data-thinking] on the host, which speeds the bulb, the visor sweep and
 *     the motes, and makes the mascot wave harder — so the character visibly
 *     reacts to what the chat is doing.
 * ============================================================ */
(function () {
  'use strict';

  function mascotSVG(p) {
    return (
      '<span class="air-mascot__halo"></span>' +
      '<svg class="air-mascot__svg" viewBox="0 0 240 300" focusable="false" aria-hidden="true">' +
        '<defs>' +
          /* white shell with a violet undertone, lit from the top-left */
          '<linearGradient id="' + p + 'Shell" x1="0.15" y1="0" x2="0.85" y2="1">' +
            '<stop offset="0%" stop-color="#FFFFFF"/>' +
            '<stop offset="42%" stop-color="#F0ECFF"/>' +
            '<stop offset="78%" stop-color="#D6CBF6"/>' +
            '<stop offset="100%" stop-color="#A793E0"/>' +
          '</linearGradient>' +
          '<linearGradient id="' + p + 'ShellShade" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#C9BCF0"/>' +
            '<stop offset="100%" stop-color="#9C86DB"/>' +
          '</linearGradient>' +
          /* the glossy visor */
          '<linearGradient id="' + p + 'Visor" x1="0.1" y1="0" x2="0.6" y2="1">' +
            '<stop offset="0%" stop-color="#2A2350"/>' +
            '<stop offset="45%" stop-color="#120F28"/>' +
            '<stop offset="100%" stop-color="#05060F"/>' +
          '</linearGradient>' +
          '<linearGradient id="' + p + 'Gloss" x1="0" y1="0" x2="0.9" y2="1">' +
            '<stop offset="0%" stop-color="rgba(255,255,255,0.85)"/>' +
            '<stop offset="35%" stop-color="rgba(255,255,255,0.12)"/>' +
            '<stop offset="100%" stop-color="rgba(255,255,255,0)"/>' +
          '</linearGradient>' +
          /* violet trim / joints */
          '<linearGradient id="' + p + 'Trim" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#B9A7F5"/>' +
            '<stop offset="100%" stop-color="#5B47A6"/>' +
          '</linearGradient>' +
          '<radialGradient id="' + p + 'Core" cx="50%" cy="42%" r="62%">' +
            '<stop offset="0%" stop-color="#F6F2FF"/>' +
            '<stop offset="45%" stop-color="#7DD3FC"/>' +
            '<stop offset="100%" stop-color="#A78BFA"/>' +
          '</radialGradient>' +
        '</defs>' +

        /* orbiting motes */
        '<g class="air-mascot__motes">' +
          '<circle class="air-mascot__mote air-mascot__mote--1" cx="28" cy="96" r="3.4"/>' +
          '<circle class="air-mascot__mote air-mascot__mote--2" cx="212" cy="120" r="2.6"/>' +
          '<circle class="air-mascot__mote air-mascot__mote--3" cx="40" cy="228" r="2.8"/>' +
        '</g>' +

        '<g class="air-mascot__float">' +

          '<ellipse class="air-mascot__shadow" cx="120" cy="288" rx="52" ry="9"/>' +

          /* ============ HEAD ============ */
          '<g class="air-mascot__head">' +

            /* antenna */
            '<line class="air-mascot__stem" x1="120" y1="34" x2="120" y2="16"/>' +
            '<circle class="air-mascot__bulb" cx="120" cy="13" r="6.4"/>' +

            /* head shell: an egg, slightly wider at the bottom */
            '<path d="M120 30 C178 30 208 70 208 118 C208 166 168 196 120 196 C72 196 32 166 32 118 C32 70 62 30 120 30 Z" fill="url(#' + p + 'Shell)"/>' +

            /* thick side rings */
            '<circle cx="42" cy="112" r="15" fill="none" stroke="url(#' + p + 'Trim)" stroke-width="6"/>' +
            '<circle cx="198" cy="112" r="15" fill="none" stroke="url(#' + p + 'Trim)" stroke-width="6"/>' +

            /* the big glossy visor */
            '<path class="air-mascot__visor" d="M120 54 C170 54 196 88 196 122 C196 158 164 182 120 182 C76 182 44 158 44 122 C44 88 70 54 120 54 Z" fill="url(#' + p + 'Visor)"/>' +
            /* moving sheen */
            '<path class="air-mascot__sheen" d="M84 74 C104 60 138 60 156 76 C132 72 104 74 84 92 Z" fill="url(#' + p + 'Gloss)"/>' +

            /* eyes: two THICK upward arcs  ( ⌣ ⌣ ) */
            '<g class="air-mascot__eyes">' +
              '<path class="air-mascot__eye" d="M72 132 q20 -26 40 0" />' +
              '<path class="air-mascot__eye" d="M128 132 q20 -26 40 0" />' +
            '</g>' +
            /* small smile */
            '<path class="air-mascot__mouth" d="M109 150 q11 9 22 0"/>' +
          '</g>' +

          /* ============ BODY ============ */
          '<g class="air-mascot__torso">' +
            /* neck */
            '<rect x="106" y="186" width="28" height="14" rx="7" fill="url(#' + p + 'ShellShade)"/>' +
            /* chest plate */
            '<path d="M84 198 C84 198 120 190 156 198 C176 202 182 216 182 232 L182 246 C182 258 172 266 158 266 L82 266 C68 266 58 258 58 246 L58 232 C58 216 64 202 84 198 Z" fill="url(#' + p + 'Shell)"/>' +
            /* chest panel lines */
            '<path d="M74 232 h92" stroke="url(#' + p + 'Trim)" stroke-width="3" stroke-linecap="round" opacity="0.75"/>' +
            /* core */
            '<circle class="air-mascot__core" cx="120" cy="234" r="15" fill="url(#' + p + 'Core)"/>' +
            '<circle class="air-mascot__core-ring" cx="120" cy="234" r="21"/>' +
            /* hip */
            '<path d="M74 262 L166 262 C170 262 172 268 170 274 L166 282 C150 288 90 288 74 282 L70 274 C68 268 70 262 74 262 Z" fill="url(#' + p + 'ShellShade)"/>' +
            /* hip trim */
            '<rect x="86" y="266" width="68" height="4" rx="2" fill="url(#' + p + 'Trim)" opacity="0.8"/>' +
          '</g>' +

          /* ============ ARMS (raised, waving) ============ */
          '<g class="air-mascot__arm air-mascot__arm--left">' +
            '<rect x="34" y="196" width="18" height="52" rx="9" fill="url(#' + p + 'ShellShade)"/>' +
            '<circle cx="43" cy="192" r="13" fill="#F4F1FF"/>' +
            '<circle cx="43" cy="192" r="6" fill="url(#' + p + 'Trim)" opacity="0.55"/>' +
          '</g>' +
          '<g class="air-mascot__arm air-mascot__arm--right">' +
            '<rect x="188" y="196" width="18" height="52" rx="9" fill="url(#' + p + 'ShellShade)"/>' +
            '<circle cx="197" cy="192" r="13" fill="#F4F1FF"/>' +
            '<circle cx="197" cy="192" r="6" fill="url(#' + p + 'Trim)" opacity="0.55"/>' +
          '</g>' +

          /* ============ LEGS (jointed, standing) ============ */
          '<g class="air-mascot__legs">' +
            '<rect x="82" y="282" width="20" height="16" rx="8" fill="url(#' + p + 'ShellShade)"/>' +
            '<rect x="138" y="282" width="20" height="16" rx="8" fill="url(#' + p + 'ShellShade)"/>' +
            '<ellipse cx="92" cy="296" rx="17" ry="8" fill="#EFEAFF"/>' +
            '<ellipse cx="148" cy="296" rx="17" ry="8" fill="#EFEAFF"/>' +
          '</g>' +
        '</g>' +
      '</svg>'
    );
  }

  function mount(node, idPrefix) {
    if (!node || node.getAttribute('data-mascot-ready') === 'true') return;
    node.insertAdjacentHTML('afterbegin', mascotSVG(idPrefix));
    node.setAttribute('data-mascot-ready', 'true');
  }

  function boot() {
    var big = document.querySelector('[data-air-mascot]');
    if (big) mount(big, 'air');
    var smalls = document.querySelectorAll('[data-mascot-mini]');
    Array.prototype.forEach.call(smalls, function (n) {
      mount(n, 'airMini');
    });
  }

  window.NPMascot = {
    think: function (on) {
      var nodes = document.querySelectorAll('[data-air-mascot]');
      Array.prototype.forEach.call(nodes, function (n) {
        if (on) n.setAttribute('data-thinking', 'true');
        else n.removeAttribute('data-thinking');
      });
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
