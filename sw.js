/* sw.js -- the offline copy of the game (a service worker), for the installed app and for
   playing against bots without a connection.

   Everything comes from the network when there is one, so a new version always shows up on
   the next load. Each response is kept as it arrives (one copy per address, overwritten, never
   piling up), and the saved copy is served only when the network is not there. Partial
   responses (music streamed in ranges) are not kept. Google Fonts and the two libraries the
   online lobby loads are kept the same way. Online play itself needs a connection.
   Bump VERSION to clear the old copies. */
const VERSION = "1";
const CACHE = "blockade-" + VERSION;
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-180.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("blockade-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  const ours = url.origin === self.location.origin;
  if (!ours && !/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) && !/(^|\.)(unpkg\.com|jsdelivr\.net|cdnjs\.cloudflare\.com)$/.test(url.hostname)) return;
  if (ours && /\/(tools|maps)\//.test(url.pathname)) return;        // (dev tools and notes: never kept)
  const page = req.mode === "navigate";
  const key = page ? new URL("./index.html", self.location.href).href : req.url;
  e.respondWith(fetch(req, page ? { cache: "no-cache" } : undefined).then(res => {
    if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  }).catch(() => caches.match(key).then(hit => hit || (page ? caches.match("./") : undefined))
    .then(hit => hit || Response.error())));
});
