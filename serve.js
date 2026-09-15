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
     · text assets (.html .css .js .svg .json .txt) are compressed with gzip
       or deflate when the client asks for it — the ~102 KB stylesheet ships
       as roughly 20 KB on the wire
     · every file response carries a weak ETag derived from the file bytes;
       If-None-Match is answered with 304 Not Modified and no body
*/
const http = require('http');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

/* Compressible types get gzip/deflate negotiation; images do not (they are
   already compressed, re-compressing them wastes CPU for no gain). */
const COMPRESSIBLE = {
  '.html': true,
  '.css': true,
  '.js': true,
  '.svg': true,
  '.json': true,
  '.txt': true,
};

/* Skip compression for tiny bodies — the per-message header/frame overhead
   can exceed the savings at a few hundred bytes. 304s bypass the question. */
const MIN_COMPRESS_LENGTH = 860;

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

/* Weak ETag from the exact response body. A size-based etag is wrong across
   edits, and hashing costs ~1 ms per 100 KB — cheap enough to be correct.
   The W/ prefix marks it as not byte-identical across servers, which is the
   honest claim for a dev server that has no persisted state. */
function etagFor(body) {
  return 'W/"' + crypto.createHash('sha1').update(body).digest('hex').slice(0, 20) + '"';
}

/* True when If-None-Match (a comma list, or *) matches the etag.
   Weak comparison is the right check here: the client is revalidating a full
   representation it received from this same server, not doing range work. */
function etagMatches(ifNoneMatch, etag) {
  const list = String(ifNoneMatch || '').split(',');
  for (var i = 0; i < list.length; i++) {
    const candidate = list[i].trim();
    if (candidate === '*' || candidate === etag) return true;
    /* tolerate clients that echo a strong etag for our weak one */
    if (candidate === etag.replace(/^W\//, '')) return true;
  }
  return false;
}

/* Accept-Encoding → 'gzip' | 'deflate' | null.
   Honours q-values and treats * as "any encoding you support". */
function pickEncoding(acceptHeader, bodyLength, isCompressible) {
  if (!isCompressible) return null;
  if (!acceptHeader || bodyLength < MIN_COMPRESS_LENGTH) return null;

  const parts = String(acceptHeader).split(',');
  let gzipQ = 0;
  let deflateQ = 0;
  let starQ = 0;

  for (var i = 0; i < parts.length; i++) {
    const pair = parts[i].split(';q=');
    const token = pair[0].trim().toLowerCase();
    let q = 1;
    if (pair[1] !== undefined) {
      q = parseFloat(pair[1]);
      if (isNaN(q)) q = 0;
    }
    if (q <= 0) continue;
    if (token === 'gzip' || token === 'x-gzip') gzipQ = Math.max(gzipQ, q);
    else if (token === 'deflate') deflateQ = Math.max(deflateQ, q);
    else if (token === '*') starQ = Math.max(starQ, q);
  }

  /* nothing explicitly named but * is present → map * onto what we support */
  if (gzipQ === 0 && deflateQ === 0 && starQ > 0) gzipQ = starQ;

  if (gzipQ > 0) return 'gzip';
  if (deflateQ > 0) return 'deflate';
  return null;
}

/* Compress once per request; the dev server has no cache worth a LRU here. */
function compress(encoding, body) {
  if (encoding === 'gzip') return zlib.gzipSync(body);
  if (encoding === 'deflate') return zlib.deflateSync(body);
  return body;
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

      const ext = path.extname(file).toLowerCase();
      const type = TYPES[ext] || 'application/octet-stream';
      const etag = etagFor(data);

      /* Revalidation first — a 304 carries no body and no encoding question.
         Vary is still sent so shared caches key on Accept-Encoding. */
      if (req.headers['if-none-match'] && etagMatches(req.headers['if-none-match'], etag)) {
        return send(res, 304, null, { ETag: etag, Vary: 'Accept-Encoding' });
      }

      const encoding = pickEncoding(req.headers['accept-encoding'], data.length, COMPRESSIBLE[ext]);
      if (!encoding) {
        return send(res, 200, data, {
          'Content-Type': type,
          'Content-Length': String(data.length),
          ETag: etag,
          Vary: 'Accept-Encoding',
        });
      }

      const compressed = compress(encoding, data);
      send(res, 200, compressed, {
        'Content-Type': type,
        'Content-Encoding': encoding,
        'Content-Length': String(compressed.length),
        ETag: etag,
        Vary: 'Accept-Encoding',
      });
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`nourhan-portfolio → http://127.0.0.1:${PORT}`);
  });
