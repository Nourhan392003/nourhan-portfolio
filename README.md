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
| `config.example.js` | Template → copy to `config.js` (gitignored) |
| `js/vendor/supabase.js` | Vendored supabase-js, so the client is not a CDN dependency |
| `supabase/01_schema.sql` | `projects` + `profiles` tables, triggers, `is_admin()` helper |
| `supabase/02_policies.sql` | RLS: public reads published rows only; admins write |
| `supabase/03_storage.sql` | Public `project-images` bucket; admin-only writes, folder-scoped |
| `supabase/04_skills.sql` | `public.skills` seed — the CV skillset. Data only; run in the SQL Editor, because `skills` has RLS on with no policy for `anon` |
| `supabase/05_experience.sql` | `public.experiences` seed — the two CV roles. Same reason; it also clears the old dummy row |
| `serve.js` | Zero-dependency local static server (port 4173, loopback only) |

### Load order

Within a page the order matters: `boot.js` → `config.js` →
`supabase-client.js` → **`util.js`** → the module that uses it
(`projects.js` / `public-content.js` / `admin.js`, then `admin-content.js`).
`util.js` defines `window.NPUtil`, which the modules read as they execute, so a
page that loads it late will throw.

## Backend setup (one time)

1. **Create a brand-new Supabase project** (do not reuse an old one).
2. **SQL Editor** → run `supabase/01_schema.sql`, then `02_policies.sql`, then `03_storage.sql`.
3. **Auth → Providers → Email**: disable *"Allow new users to sign up"* (only the admin account should exist).
4. **Auth → Users**: add yourself (email + password).
5. Promote yourself — SQL Editor (you run this yourself):
   ```sql
   update public.profiles set is_admin = true where id = '<your-user-uuid>';
   ```
6. **Settings → API**: copy the Project URL and the **anon public** key. Copy
   `config.example.js` → `config.js` and paste both values, then reload.

> The anon key is public by design — Row Level Security is the safety boundary.
> Never place the `service_role` key in any file here.

### Content summary or empty state

`js/public-content.js` replaces a repeatable list **only** when Supabase returns
visible rows, otherwise the static markup stands as the fallback. So a section
can legitimately show fewer items than the HTML contains — the database is the
source of truth once a row is visible. (As of writing: 1 visible service,
1 visible skill, 1 visible experience.)

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
(`styles.css?v=25`, `script.js?v=17`, …). **Bump the number when you change the
file**, otherwise browsers and the local preview keep serving the old copy.

## No-backend mode

Without `config.js`, the site works exactly as before: the static markup is
shown, `admin.html` explains the setup step, and no errors reach visitors.
DevTools reports one expected 404 for the not-yet-created `config.js`.

## Content rules

- The Grand CTA footer's **Download CV** pill points at `cv/nourhan-ashraf-cv.pdf` —
  drop the real PDF at that path (or update the `href` on the three pages).
- Real projects only: **TCG Vault / Hatartcg**, **Social Culture**.
- No invented metrics, years, clients, testimonials, screenshots or links.
- Real screenshots / profile photo: drop into `images/` or upload via the admin.

## Project boundaries

`nourhan-portfolio` is standalone. Do not modify: `webtest`, `webtest-main`,
`social-culture-portfolio`, `TCGWeb`. No old Supabase project, backup, bucket or
credential is referenced anywhere.
