// Offline shell for Freedom CC.
// Navigations + API: network-first (fall back to cache, then offline page).
// Hashed build assets & icons: cache-first. Bump VERSION to purge old caches.
const VERSION = "fcc-v3";
const RUNTIME = `${VERSION}-runtime`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(RUNTIME).then((cache) =>
      cache.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icons/icon.svg"])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the dev/HMR pipeline or API writes.
  if (url.pathname.startsWith("/_next/webpack-hmr") || url.pathname.startsWith("/__nextjs")) return;

  // Navigations: always try the network first so markup never goes stale.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Live scorecard API: network-first, keep last good copy for the sideline.
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname.endsWith("/live")) {
      event.respondWith(
        fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
            return res;
          })
          .catch(() => caches.match(request))
      );
    }
    return;
  }

  // Content-hashed build assets & static files: cache-first.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
          }
          return res;
        })
    )
  );
});
