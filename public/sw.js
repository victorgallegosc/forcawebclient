/* Minimal service worker so the app can be installed as a PWA.
 *
 * League data is scraped live via `/_serverFn/*` and SSR HTML — never
 * cache those, or the calendario keeps showing partidos viejos after
 * Zione publica jornadas nuevas.
 */
const CACHE = "cancha-shell-v2";
const PRECACHE = ["/favicon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

function isLiveDataRequest(url) {
  return (
    url.pathname.startsWith("/_serverFn/") ||
    url.pathname.startsWith("/api/") ||
    url.searchParams.has("_serverFn")
  );
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/favicon.svg" ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/apple-touch-icon.png" ||
      url.pathname === "/site.webmanifest" ||
      url.pathname === "/sw.js")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Always hit the network for live league / server-function data.
  if (isLiveDataRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-first for navigations so SSR league data stays fresh.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match("/") || caches.match(request)),
    );
    return;
  }

  // Cache-first only for hashed static assets / icons.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetched;
      }),
    );
    return;
  }

  // Default: network only (do not poison the cache with HTML shells / RPCs).
  event.respondWith(fetch(request));
});
