/* Local static server for nourhan-portfolio — zero dependencies.
   Run:  node serve.js   →  http://127.0.0.1:4173

   This is a DEVELOPMENT server, bound to loopback only. It is not the
   deployment: the real site is served by a host/CDN. Hardening here is still
   worth doing, because a dev server that crashes or reads outside its root is
   a real (if local) bug, and because it documents the headers the host should
   be sending for real.

   Guarded:
     · a malformed percent-escape in the URL used to throw an uncaught
       URIError inside the request handler and take the process down — it is
       now answered with 400
     · the traversal check is real path containment (path.relative), not a
       string prefix, so a sibling directory whose name merely starts with
       this one can no longer be reached
     · responses carry no-cache plus the two headers that cannot be expressed
       with a <meta> tag (nosniff, frame-ancestors/clickjacking)
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

/* Headers on every response.
   `Cache-Control: no-cache` means "revalidate before use" rather than "never
   store" — the point is that editing styles.css or script.js and reloading
   always shows the new file instead of a cached copy (the ?v= query strings
   in the HTML exist for the same reason).
   The two security headers are the dev-server mirror of what the host must
   send: frame-ancestors is ignored when a CSP arrives via <meta>, so it can
   only be delivered as a header, and nosniff stops a mis-typed file from
   being sniffed as script or HTML. */
const BASE_HEADERS = {
  'Cache-Control': 'no-cache, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function send(res, status, body, extra) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, BASE_HEADERS, extra || {}));
  res.end(body);
}

http
  .createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (err) {
      // A malformed escape such as /%zz or a lone % — answer it instead of
      // letting the URIError propagate out of the request handler.
      return send(res, 400, 'Bad request');
    }

    // Reject a NUL byte or any request that is not origin-relative before it
    // ever reaches path.join.
    if (urlPath.indexOf('\0') !== -1 || urlPath[0] !== '/') {
      return send(res, 400, 'Bad request');
    }

    if (urlPath.endsWith('/')) urlPath += 'index.html';

    const file = path.resolve(ROOT, '.' + urlPath);

    // Real containment: path.relative returns '' for the root itself, a path
    // beginning with '..' for anything above it, and an absolute path when
    // the two share no common root (a Windows drive change, for instance).
    const rel = path.relative(ROOT, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return send(res, 403, 'Forbidden');
    }

    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      send(res, 200, data, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      });
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`nourhan-portfolio → http://127.0.0.1:${PORT}`);
  });
