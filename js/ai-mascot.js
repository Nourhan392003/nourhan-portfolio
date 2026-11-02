/* nourhan-portfolio · js/ai-mascot.js
 * ============================================================
 * Draws the AI Recruiter mascot — a chibi cartoon GIRL — as inline SVG, in
 * the site's violet palette. Modeled on the reference character (big head,
 * huge sparkling eyes, hoodie) with Nourhan's identity swapped in:
 *
 *   · chibi proportions, big round head that gently tilts
 *   · lavender twintails + an ahoge curl on top
 *   · huge anime eyes with highlights that blink together
 *   · a violet hoodie with a glowing cyan star on the chest
 *   · one raised hand waving hello; the other holds a glowing `</>` card —
 *     her dev identity in place of the reference's trading card
 *
 * No image to download: it costs no request and stays crisp at any size.
 * The motion is all CSS (see styles.css): float, sway, head tilt, waving
 * arm, synchronized blink, beating chest star, a drifting welcome bubble.
 *
 * One live signal is exposed:
 *
 *   window.NPMascot.think(true|false)
 *
 *     The chat panel calls think(true) while a reply is in flight — speeds
 *     the blink, the halo and the float so the character visibly reacts.
 * ============================================================ */
(function () {
  'use strict';

  function mascotSVG(p) {
    return (
      '<span class="air-mascot__halo"></span>' +
      '<svg class="air-mascot__svg" viewBox="0 0 240 312" focusable="false" aria-hidden="true">' +
        '<defs>' +
          /* hair */
          '<linearGradient id="' + p + 'Hair" x1="0.2" y1="0" x2="0.8" y2="1">' +
            '<stop offset="0%" stop-color="#E9E1FB"/>' +
            '<stop offset="48%" stop-color="#C9BCF0"/>' +
            '<stop offset="100%" stop-color="#9C86DB"/>' +
          '</linearGradient>' +
          '<linearGradient id="' + p + 'HairDeep" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#B9A7F5"/>' +
            '<stop offset="100%" stop-color="#7A64C4"/>' +
          '</linearGradient>' +
          /* hoodie */
          '<linearGradient id="' + p + 'Hood" x1="0.2" y1="0" x2="0.8" y2="1">' +
            '<stop offset="0%" stop-color="#B9A7F5"/>' +
            '<stop offset="55%" stop-color="#8A72E0"/>' +
            '<stop offset="100%" stop-color="#5B47A6"/>' +
          '</linearGradient>' +
          /* eyes */
          '<radialGradient id="' + p + 'Iris" cx="50%" cy="38%" r="68%">' +
            '<stop offset="0%" stop-color="#9BE8FF"/>' +
            '<stop offset="55%" stop-color="#4FB7E8"/>' +
            '<stop offset="100%" stop-color="#3A2F6E"/>' +
          '</radialGradient>' +
          /* shoes */
          '<linearGradient id="' + p + 'Shoe" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#8BE4FF"/>' +
            '<stop offset="100%" stop-color="#357AC8"/>' +
          '</linearGradient>' +
          '<radialGradient id="' + p + 'CoreGlow" cx="50%" cy="50%" r="50%">' +
            '<stop offset="0%" stop-color="rgba(125, 211, 252, 0.55)"/>' +
            '<stop offset="100%" stop-color="rgba(125, 211, 252, 0)"/>' +
          '</radialGradient>' +
        '</defs>' +

        /* ground shadow */
        '<ellipse class="air-mascot__shadow" cx="120" cy="300" rx="54" ry="9"/>' +

        '<g class="air-mascot__float">' +

          /* ================= HAIR — back + twintails ================= */
          '<g class="air-mascot__hair">' +
            '<path d="M120 32 C176 32 202 74 200 118 C199 148 190 170 186 184 C170 200 70 200 54 184 C50 170 41 148 40 118 C38 74 64 32 120 32 Z" fill="url(#' + p + 'HairDeep)"/>' +
            /* hair ties */
          '</g>' +

          /* ================= LEGS + SHOES ================= */
          '<g class="air-mascot__legs">' +
            '<rect x="100" y="232" width="13" height="34" rx="6.5" fill="#FFEBDD"/>' +
            '<rect x="127" y="232" width="13" height="34" rx="6.5" fill="#FFEBDD"/>' +
            '<rect x="98" y="256" width="17" height="10" rx="5" fill="#EFEAFF"/>' +
            '<rect x="125" y="256" width="17" height="10" rx="5" fill="#EFEAFF"/>' +
            '<rect x="93" y="264" width="26" height="16" rx="8" fill="url(#' + p + 'Shoe)"/>' +
            '<rect x="121" y="264" width="26" height="16" rx="8" fill="url(#' + p + 'Shoe)"/>' +
            '<path d="M99 271 h12 M127 271 h12" stroke="#0E1024" stroke-width="2" stroke-linecap="round" opacity="0.35"/>' +
          '</g>' +

          /* ================= SKIRT ================= */
          '<rect x="80" y="224" width="80" height="26" rx="10" fill="#2A2344"/>' +
          '<path d="M84 238 h72" stroke="url(#' + p + 'Shoe)" stroke-width="2" opacity="0.35" stroke-linecap="round"/>' +

          /* ================= HOODIE BODY ================= */
          '<g class="air-mascot__torso">' +
            '<path d="M96 142 h48 v18 c14 4 26 14 27 34 c1 24 -6 44 -20 46 c-24 4 -64 4 -82 0 c-14 -2 -21 -22 -20 -46 c1 -20 13 -30 27 -34 v-18 Z" fill="url(#' + p + 'Hood)"/>' +
            /* hood collar */
            '<path d="M94 150 Q120 170 146 150" fill="none" stroke="#5B47A6" stroke-width="8" stroke-linecap="round"/>' +
            /* drawstrings */
            '<path d="M108 164 v20 M132 164 v20" stroke="#EFEAFF" stroke-width="3" stroke-linecap="round"/>' +
            '<circle cx="108" cy="186" r="2.6" fill="#EFEAFF"/>' +
            '<circle cx="132" cy="186" r="2.6" fill="#EFEAFF"/>' +
            /* kangaroo pocket */
            '<path d="M92 214 Q120 226 148 214 L148 232 Q120 240 92 232 Z" fill="#4B3C8F" opacity="0.5"/>' +
            /* chest star + glow */
            '<circle class="air-mascot__core-glow" cx="118" cy="196" r="26" fill="url(#' + p + 'CoreGlow)"/>' +
            '<path class="air-mascot__core" d="M118 180 L123.4 191.2 L135.8 193 L126.9 201.6 L129 214 L118 208.2 L107 214 L109.1 201.6 L100.2 193 L112.6 191.2 Z" fill="#8BE4FF"/>' +
          '</g>' +

          /* ============ ARM — raised, waving hello ============ */
          '<g class="air-mascot__arm air-mascot__arm--left">' +
            '<path d="M88 160 C66 152 52 138 46 124" fill="none" stroke="#6D58C9" stroke-width="20" stroke-linecap="round"/>' +
            '<circle cx="44" cy="116" r="11" fill="#FFEBDD"/>' +
            '<path d="M40 112 v8 M45 111 v9 M50 112 v8" stroke="#E4BFA0" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>' +
          '</g>' +

          /* ============ ARM — holding the glowing code card ============ */
          '<g class="air-mascot__card-hand">' +
            '<path d="M152 160 C166 164 174 168 180 174" fill="none" stroke="#6D58C9" stroke-width="18" stroke-linecap="round"/>' +
            '<g class="air-mascot__card">' +
              '<circle cx="186" cy="160" r="22" fill="url(#' + p + 'CoreGlow)"/>' +
              '<g transform="rotate(-10 186 158)">' +
                '<rect x="171" y="136" width="30" height="42" rx="5" fill="#101427" stroke="#7DD3FC" stroke-width="2"/>' +
                '<path d="M181 150 L175 158 L181 166 M191 150 L197 158 L191 166" fill="none" stroke="#7DD3FC" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<path d="M187 148 L185 168" stroke="#A78BFA" stroke-width="2.6" stroke-linecap="round"/>' +
              '</g>' +
              '<circle cx="180" cy="178" r="7" fill="#FFEBDD"/>' +
            '</g>' +
          '</g>' +

          /* twintails in front — framing the face */
          '<g class="air-mascot__tails">' +
            '<path d="M64 96 C24 108 14 158 36 200 C44 216 60 218 64 204 C48 170 50 124 86 100 Z" fill="url(#' + p + 'Hair)"/>' +
            '<path d="M176 96 C216 108 226 158 204 200 C196 216 180 218 176 204 C192 170 190 124 154 100 Z" fill="url(#' + p + 'Hair)"/>' +
            '<circle cx="60" cy="104" r="6" fill="#7DD3FC" opacity="0.9"/>' +
            '<circle cx="180" cy="104" r="6" fill="#7DD3FC" opacity="0.9"/>' +
          '</g>' +

          /* ================= HEAD ================= */
          '<g class="air-mascot__head">' +
            /* neck */
            '<rect x="110" y="138" width="20" height="18" rx="8" fill="#F5D5C0"/>' +
            /* face */
            '<ellipse cx="120" cy="102" rx="60" ry="56" fill="#FFEBDD"/>' +
            /* fringe */
            '<path d="M62 92 C58 44 96 30 120 30 C144 30 182 44 178 92 C168 66 152 82 138 66 C126 82 108 64 96 80 C86 70 70 70 62 92 Z" fill="url(#' + p + 'Hair)"/>' +
            /* ahoge — little curl on top */
            '<path class="air-mascot__ahoge" d="M116 32 C110 16 132 10 128 26" fill="none" stroke="url(#' + p + 'Hair)" stroke-width="5" stroke-linecap="round"/>' +
            /* brows */
            '<path d="M82 94 Q96 86 110 93" fill="none" stroke="#9C86DB" stroke-width="3" stroke-linecap="round"/>' +
            '<path d="M130 93 Q144 86 158 94" fill="none" stroke="#9C86DB" stroke-width="3" stroke-linecap="round"/>' +
            /* eyes (blink together via .air-mascot__eye) */
            '<g class="air-mascot__eyes">' +
              '<g class="air-mascot__eye">' +
                '<ellipse cx="96" cy="112" rx="13" ry="16" fill="url(#' + p + 'Iris)"/>' +
                '<ellipse cx="96" cy="113" rx="5.5" ry="8" fill="#241C44"/>' +
                '<circle cx="92" cy="106" r="4.6" fill="#F4F6FF" opacity="0.95"/>' +
                '<circle cx="100" cy="117" r="2" fill="#F4F6FF" opacity="0.8"/>' +
                '<path d="M80 102 Q96 88 112 101" fill="none" stroke="#3A2F6E" stroke-width="5" stroke-linecap="round"/>' +
              '</g>' +
              '<g class="air-mascot__eye">' +
                '<ellipse cx="144" cy="112" rx="13" ry="16" fill="url(#' + p + 'Iris)"/>' +
                '<ellipse cx="144" cy="113" rx="5.5" ry="8" fill="#241C44"/>' +
                '<circle cx="140" cy="106" r="4.6" fill="#F4F6FF" opacity="0.95"/>' +
                '<circle cx="148" cy="117" r="2" fill="#F4F6FF" opacity="0.8"/>' +
                '<path d="M128 101 Q144 88 160 102" fill="none" stroke="#3A2F6E" stroke-width="5" stroke-linecap="round"/>' +
              '</g>' +
            '</g>' +
            /* blush */
            '<ellipse cx="80" cy="130" rx="10" ry="5.5" fill="#FF9FB2" opacity="0.45"/>' +
            '<ellipse cx="160" cy="130" rx="10" ry="5.5" fill="#FF9FB2" opacity="0.45"/>' +
            /* nose + mouth */
            '<path d="M119 126 q2 3 0 5" fill="none" stroke="#E8B08C" stroke-width="2" stroke-linecap="round"/>' +
            '<path class="air-mascot__mouth" d="M106 138 Q120 154 134 138 Q120 147 106 138 Z" fill="#B0505C"/>' +
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
