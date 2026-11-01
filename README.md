# Nourhan Ashraf — Personal Portfolio

A static portfolio for a frontend / e-commerce developer, with an optional
**Supabase** backend that powers the Projects section and a login-protected
admin dashboard. Plain HTML, CSS and vanilla JavaScript — **no framework and no
build step**.

## Run it locally

```bash
node serve.js        # → http://127.0.0.1:4173
```

The admin dashboard is at <http://127.0.0.1:4173/admin.html>.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | The public site: hero, services, skills, experience, about, projects, contact |
| `projects.html` | Full project index (`#projects-index`) |
| `project.html` | Case study, driven by `?slug=` |
| `admin.html` | Login-protected CMS — projects CRUD plus hero/contact/services/skills/experience/about/footer editors |

## Files

### Styles and behaviour

| Path | Purpose |
|---|---|
| `styles.css` | Design system, layout, entrance choreography, theme tokens |
| `admin.css` | Dashboard-only styles (admin.html loads both) |
| `script.js` | Public behaviour: theme toggle, nav, hero choreography, parallax, scroll reveal, typewriter, contact form, floating buttons |
| `project-detail.js` | Case-study renderer used by `project.html` |

### Boot and shared code

| Path | Purpose |
|---|---|
| `js/boot.js` | Runs before paint on all three public pages: `html.js`, saved theme, `?motion` override. Kept out of the `<head>` as inline script so the CSP can avoid `'unsafe-inline'` |
| `js/util.js` | The single HTML-escaping (`esc`) and slug (`slugify`) implementation, shared by every module — must load before them |

### Data / CMS

| Path | Purpose |
|---|---|
| `js/supabase-client.js` | Shared Supabase client; exposes `window.NP` (reads `config.js`) |
| `js/projects.js` | Public projects renderer — loading / empty / error states, self-initialising per page |
| `js/public-content.js` | Read-only hydration of hero, about, skills, services, experience, contact and footer from Supabase |
| `js/admin.js` | Admin login, project CRUD, publish/featured toggles, reorder, uploads, i18n (EN/AR) |
| `js/admin-content.js` | The section editors (hero, contact, services, skills, experience, about, footer) |
| `js/icon-library.js` | Fixed icon allowlist (22 keys) — no stored string is ever rendered as markup. A skill whose `icon_key` is not on the allowlist is skipped by the public hydration, on purpose |
| `config.js` | **Committed:** the public Supabase URL + publishable key. See “`config.js` is committed” below |
| `config.example.js` | Template for a fresh clone |
| `js/vendor/supabase.js` | Vendored supabase-js, so the client is not a CDN dependency |
| `supabase/01_schema.sql` | `projects` + `profiles` tables, triggers, `is_admin()` helper |
| `supabase/02_policies.sql` | RLS: public reads published rows only; admins write |
| `supabase/03_storage.sql` | Public `project-images` bucket; admin-only writes, folder-scoped |
| `supabase/04_skills.sql` | `public.skills` seed — the CV skillset. Data only; run in the SQL Editor, because `skills` has RLS on with no policy for `anon` |
| `supabase/05_experience.sql` | `public.experiences` seed — the two CV roles. Same reason; it also clears the old dummy row |
| `supabase/06_hero_specializations.sql` | Sets the hero's rotating `specializations` to the three roles, in order. A `jsonb_set` on one key, so the hero's other twelve fields survive. Needed because a stored list wins over the code default and the row still holds five older entries |
| `serve.js` | Zero-dependency local static server (port 4173, loopback only) |

### Load order

Within a page the order matters: `boot.js` → `config.js` →
`supabase-client.js` → **`util.js`** → the module that uses it
(`projects.js` / `public-content.js` / `admin.js`, then `admin-content.js`).
`util.js` defines `window.NPUtil`, which the modules read as they execute, so a
page that loads it late will throw.

## Backend setup (one time)

1. **Create a brand-new Supabase project** (do not reuse an old one).
2. **SQL Editor** → run `supabase/01_schema.sql`, then `02_policies.sql`, then `03_storage.sql`, then `07_content_policies.sql` (RLS for the CMS content tables).
3. **Auth → Providers → Email**: disable *"Allow new users to sign up"* (only the admin account should exist).
4. **Auth → Users**: add yourself (email + password).
5. Promote yourself — SQL Editor (you run this yourself):
   ```sql
   update public.profiles set is_admin = true where id = '<your-user-uuid>';
   ```
6. **Settings → API**: copy the Project URL and the **anon public** key into
   `config.js` (use `config.example.js` as the template for a fresh clone).

> The anon key is public by design — Row Level Security is the safety boundary.
> Never place the `service_role` key in any file here.

### `config.js` is committed

`config.js` ships in the repository on purpose. A static page cannot read
environment variables, and all four pages load it with
`<script src="config.js">`, so a deploy built from this repo needs the file
present. It contains **only** two values:

| key | why it is safe to publish |
|---|---|
| `SUPABASE_URL` | the address the browser already talks to |
| `SUPABASE_ANON_KEY` | Supabase's publishable key (`sb_publishable_…`), designed to be visible in client code — RLS is what protects the data, and anonymous writes to every table are refused |

Anything secret belongs on a server, never here: the `service_role` key
bypasses RLS entirely, so adding it to this file would publish full write
access to the database. `CONTACT_ENDPOINT` and `CONTACT_EMAIL` are optional and
omitted here — `script.js` falls back to its built-in default inbox and to the
visitor's mail client when no endpoint is set, so the form works either way.

### Content summary or empty state

`js/public-content.js` replaces a repeatable list **only** when Supabase returns
visible rows, otherwise the static markup stands as the fallback. So a section
can legitimately show fewer items than the HTML contains — the database is the
source of truth once a row is visible. (As of writing: 3 visible services,
18 visible skills, 2 visible experiences.)

## Contact form

The form validates, then delivers by email:

- **With `CONTACT_ENDPOINT` set** in `config.js` (any Formspree-compatible URL,
  e.g. `https://formspree.io/f/abcdwxyz`), the message is POSTed there and the
  visitor sees *Sending…*, then a success or failure message. Failure — and the
  no-endpoint case — reveals a real `mailto:` link as the fallback.
- **With `CONTACT_ENDPOINT` empty**, there is nothing to post to, so the message
  is handed to the visitor's own mail client, prefilled and addressed to
  `CONTACT_EMAIL`. Nothing is ever claimed that did not happen.
- The message is capped at **500 characters**, enforced in four places: the
  textarea `maxlength`, an input-event clip, a trimmed check on submit, and a
  final re-check immediately before the payload is built.
- **Anti-spam**: a hidden honeypot field (`_hp_company`) plus a 1.5-second
  time-trap. Either one being tripped produces silence — no request, no status
  message, no signal back to the sender.

## Theme and motion

- `data-theme="dark"` is the default; the toggle writes `np-theme` to
  `localStorage`. `js/boot.js` applies the saved value **before first paint**, so
  the page never flashes the wrong mode. All colours come from CSS custom
  properties in `styles.css`.
- Motion is opt-in-safe: the OS `prefers-reduced-motion` setting is honoured by
  default. It governs *movement*, not rhythm — the hero still appears, the
  butterflies stay visible as static art, and every scroll entrance becomes a
  plain opacity fade with the same stagger (`quietFadeIn`), so the page still
  assembles as you scroll; it just never slides, rotates, scales or chases the
  pointer. `?motion=full` forces the complete choreography for the session (it
  is also how the motion gets reviewed on a machine whose OS reports reduced
  motion), `?motion=system` undoes it. The reveal engine and its safety net run
  in both modes, so a fade can never leave content stranded at opacity 0.
- The hero is copy-left / portrait-right on one row from **601px** up (flex on
  `.hero__grid`, with the order on the two children rather than an area map);
  only phones stack it, and then the portrait goes first.
- The hero's **SPECIALIZING** line is a rotating typewriter (`script.js` · module
  3). The label is static; the role after it is typed letter by letter, held,
  then deleted letter by letter, then the next one starts — `TYPE_MS` 70,
  `HOLD_MS` 1400, `ERASE_MS` 38, `GAP_MS` 380, looping forever. The rotation is
  `Frontend Developer → UI/UX Designer → E-Commerce Specialist` **in that
  order**, and the first entry is what a reduced-motion visitor sees. The list
  is data: a stored `public.portfolio_content` hero row replaces it wholesale
  through `window.NPSpecializations.set()` (the CMS field is authoritative —
  `supabase/06_hero_specializations.sql` seeds the three roles). Under
  `prefers-reduced-motion` the line shows the first role statically instead of
  animating; the caret keeps blinking in both modes.
- That line must not resize as the text changes, so the row is deliberately
  **not** `flex-wrap: wrap`: with wrapping, the label plus a long role wraps and
  the label plus an empty line does not, so the row changed height as the text
  was typed and everything below it jumped (measured at 390px: 18.4px → 58.1px,
  i.e. the buttons moved 38.7px every cycle). Two rules keep it still instead —
  `line-height: 1.65` with a matching `min-height` on the typed element, so its
  box is the same height whether or not it holds text (an empty inline-block is
  0px tall, which was a 9–11px jump per cycle at every width), and a
  `max-width: 360px` block that moves the label onto its own line, where the
  copy column is narrower than the label + longest role and flex would otherwise
  shrink the text and cut the role off mid-word.
- Selected projects (`index.html`) are full-width centred panels — the copy on
  the LEFT, the large cover on the RIGHT, the same way round on every row —
  that pin at 110px and stack as you scroll (`width: 100%`, `max-width:
  1100px`, `margin: 0 auto 3.5rem`). The pin starts at **520px**, so the stack
  is visible in a narrow desktop window and in this app's own preview pane;
  below 601px the numeral simply moves from its side gutter to a line above
  its card, and below 520px the rows become the phone list (cover over copy,
  nothing pinned). The big numeral lives in the rail INSIDE each row, so a
  card never gives up width for it. Nothing outside the rows holds a column:
  an earlier revision put the numeral in its own grid track beside them, and
  the cards collapsed into that ~130px track whenever the numeral was hidden.
- The stack pins **without** a `prefers-reduced-motion` gate: pinning is layout,
  not movement. Such a visitor still loses every entrance animation, and on a
  phone the section reads as an ordinary list.
- Experience (`index.html`) is a centre-rail timeline. One 2px rail spans the
  whole list and its fill grows from 0 to 100% of that rail as the entries climb
  from 70% of the viewport to its centre, with a glowing head riding the leading
  edge (`script.js` · module 13, `experienceRail`). Its geometry is measured on
  a time throttle and cached, so a scroll event does arithmetic and at most one
  style write. It re-measures on `animationend`/`transitionend`, 250ms after the
  scroll stops, and at 0/250/700/1500/3000ms — hydration and late webfonts both
  change the list height, and the list is itself a reveal target parked with a
  `translateY` + `rotateX`, so a reading taken mid-entrance is a few pixels out
  (a `rotateX` is a projection: it moves the rect without moving the layout).
  That is why the fill can read up to ~1% off while an entrance is still
  playing and is exact once it settles, in both scroll directions. From **900px** up the rail sits
  dead centre with a column either side (role + company left, dates right, one
  bullet per description sentence on the right); below that it hugs the left
  edge and the rows stack, keeping the same line. The rail is markup, not a
  painted decoration, so it survives hydration untouched: stored descriptions
  are split into bullets on the same rule the static fallback is written with
  (one sentence per bullet), so nothing shifts when the database rows land.
  Reduced motion shows the rail **fully filled** — it reports position rather
  than performing an entrance — and the head stops pulsing (`xp__rail-dot`).

## Security headers

`index.html`, `projects.html`, `project.html` and `admin.html` carry a
`<meta http-equiv="Content-Security-Policy">`. The policy allows exactly the
origins in use: self, the GSAP timeline on jsDelivr, Supabase
(`https://*.supabase.co`), Google Fonts, `data:` images (the CSS film grain) and
the Formspree endpoint for the contact form. There is **no inline script** on
any of those pages — the head bootstrap lives in `js/boot.js` and the admin
boot block in `js/admin-boot.js` — which is why `script-src` needs no
`'unsafe-inline'`.

The admin policy is deliberately the strictest of the four:
`script-src 'self'` only (Supabase is vendored locally, no CDN), and `img-src`
adds `blob:` because the upload previews go through `URL.createObjectURL`.

Two things a `<meta>` policy cannot do, and the host must send as real headers:

```
Content-Security-Policy: frame-ancestors 'none'
X-Content-Type-Options: nosniff
```

`serve.js` sends `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and
`Cache-Control: no-cache` for local development so those protections are
exercised while working.

## Caching

Static assets are requested with a manual `?v=` query string
(`styles.css?v=38`, `script.js?v=25`, `js/public-content.js?v=11`, …). **Bump the
number when you change the file**, otherwise browsers and the local preview keep
serving the old copy. `admin.html` makes no reference to `styles.css`, so a
stylesheet bump does not touch it; the two secondary pages (`projects.html`,
`project.html`) carry their own `?v=` for `styles.css` and `public-content.js`,
and must be bumped alongside `index.html`.

## No-backend mode

Without `config.js`, the site works exactly as before: the static markup is
shown, `admin.html` explains the setup step, and no errors reach visitors.
DevTools reports one expected 404 for the missing `config.js`. The repository
ships the file, so this only happens if it is deleted locally.

## Content rules

- The Grand CTA footer's **Download CV** pill points at `cv/nourhan-ashraf-cv.pdf` —
  drop the real PDF at that path (or update the `href` on the three pages).
- Real projects only: **TCG Vault / Hatartcg**, **Social Culture**.
- No invented metrics, years, clients, testimonials, screenshots or links.
- Real screenshots / profile photo: drop into `assets/images/` or upload via the admin.
- The CV PDF lives in `assets/docs/`; the **Download CV** buttons on all three
  public pages link to it directly.

## Project boundaries

`nourhan-portfolio` is standalone. Do not modify: `webtest`, `webtest-main`,
`social-culture-portfolio`, `TCGWeb`. No old Supabase project, backup, bucket or
credential is referenced anywhere.

## First-visit name hook

The day's first open greets a dark stage: **NOURHAN** forms white, **ASHRAF**
forms in the accent, letter by letter out of a blur, a thin REAL progress bar
tracks the actual hero turntable frames and the webfonts, and an **OPEN** pill
lifts the stage away into the hero.

| Guard | Behaviour |
|---|---|
| `localStorage` day stamp (`np-hook-day`) | shows at most once per calendar day per browser |
| back/forward restore (`performance.type === 2`) | skipped instantly |
| JS blocked (no `html.js`) | overlay never displays (markup exists, CSS hides it) |
| script fails after boot | CSS auto-fade lifts the stage at 9s — nobody strands |
| impatient | auto-enters ~7s after ready, hard cap 11s |

**Reduced motion:** the ceremony plays for everyone — a plain skip read as
breakage. When the OS asks for less motion the letter entrance swaps to a
soft opacity-only sequential fade (`np-letter-in-soft`; no blur, no scale,
no travel), so the stage still forms and breathes.

Markup lives at the top of `<body>` in `index.html`; logic in
`js/nameloader.js`; styles in `styles.css` → "The first-visit name hook". The
progress bar counts the same nine frames `js/hero-turntable.js` needs (the
browser dedupes the requests) plus `document.fonts.ready`.

## Hero floating chips

Four small glass squares — `TS`, `JS`, a code glyph, a cart glyph — drift
around the hero portrait like the reference site's orbiting tool icons, in the
site's own palette. They live inside `.hero__bg` (behind everything,
`pointer-events: none`, `aria-hidden`), pin to measured safe zones so they
never sit on copy (1 & 3 hover above the portrait; 2 & 4 hold the side
margins), hide two of themselves under 720px, and freeze under reduced
motion. Marked positions collide-checked at an 800px viewport.

## Butterflies always fly

The hero's five butterflies were previously frozen to static art under
`prefers-reduced-motion`, which — on machines whose OS actually reports
reduced motion — made them read as deleted. As of 2026-11 (owner decision)
the flock flies unconditionally: the drift and wing-flap are gentle,
ornamental motion with no large excursions. Every *travelling/entrance*
animation on the site is still softened or skipped under the same setting.

## Uppercase section titles

`.section__title` renders 900-weight uppercase (`MY STACK`, `ABOUT`, …) —
the reference site's typographic signature, achieved with the existing Inter
stack (no new font, no new dependency).

## AI Recruiter (chatbot)

A recruiter-facing assistant on the homepage: it answers questions about
Nourhan's skills, projects, experience and contact details, grounded **only** in
verified facts — never invented ones. It is the one part of the site that talks
to an external model, and it is built so the model key never reaches a browser.

### How it is wired

| Piece | Path | Role |
|---|---|---|
| Backend endpoint | `api/chat.js` | Vercel Serverless Function. The only holder of the key. Validates, rate-limits, calls Gemini, returns `{ reply }` or a safe error. |
| Verified facts | `api/_knowledge.js` | The single source of truth the model may answer from. Built from the CV and the Supabase content rows. |
| System prompt | `api/_prompt.js` | Grounding, honesty and privacy rules (answer only from the facts, admit gaps, never reveal secrets). |
| Rate limit | `api/_rate-limit.js` | In-memory, per-IP burst guard. |
| Front end | `js/ai-recruiter.js` | Renders the chat, suggestions and states. Calls `/api/chat` only. |

The panel appears **twice**: an inline section (`#ai-recruiter`) and a floating
dock opened by the AI button in the floating stack. Both share one conversation.

### Configuration

The key is **server-side only** — never in `config.js`, never in any front-end
file, never in the repo.

1. Create a key at <https://aistudio.google.com> (billing is separate from any
   consumer subscription).
2. **Vercel** → your project → Settings → Environment Variables → add:
   - `GEMINI_API_KEY` — the key (required)
   - `GEMINI_MODEL` — optional, defaults to `gemini-3.5-flash`
3. **Locally**, copy `.env.example` to `.env` and fill the same values. `.env`
   is git-ignored; `serve.js` loads it for the dev server.
4. Redeploy. With no key set the endpoint answers `503 not_configured` and the
   UI tells the visitor to use the contact details — **it never fakes a reply.**

### What is protected

- The browser only ever calls `/api/chat` on the same origin, so there is no
  CORS surface and the CSP needs no new origin.
- Message length, history turns and history characters are capped server-side.
- The endpoint has a 12-requests-per-minute-per-IP burst limit, a 20s upstream
  timeout, and returns only short, safe error strings (details go to the
  server log, never the client).
- The prompt instructs the model to treat visitor text as an untrusted question
  and to refuse to reveal the key, the instructions or private config.

> The rate limiter is per serverless instance — a burst guard, not a global
> quota. Set a usage cap on the Google Cloud / AI Studio side as the real cost
> ceiling.
