/* Notes service worker
   A small, explicit shell cache. Bump CACHE_VERSION when shipping new assets. */

const CACHE_VERSION = "notes-shell-v1.1.0";
const SHELL = [
  "./",
  "./index.html",
  "./assets/styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/favicon.svg",
  "./icons/favicon-32.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        cache.addAll(
          SHELL.map(
            (url) =>
              new Request(url, {
                cache: "reload",
                credentials: "same-origin",
              })
          )
        )
      )
      .then(() => {
        // Activate immediately on first install. Updates wait for the in-app
        // "Reload" action so an open note is never interrupted.
        if (!self.registration.active) return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("notes-shell-") && key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isCacheable(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.protocol === "http:" || url.protocol === "https:";
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok && response.type === "basic") {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function navigationFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put("./index.html", response.clone()).catch(() => {});
      return response;
    }
    throw new Error(`Navigation returned ${response?.status}`);
  } catch (_) {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match("./index.html")) ||
      (await cache.match("./"));
    if (cached) return cached;
    return new Response(
      "<!doctype html><html><body style=\"font-family:system-ui;padding:40px;background:#fbf9f4;color:#1d1d1f\"><h1>Notes is offline</h1><p>Open Notes once while online to store the app for offline use.</p></body></html>",
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isCacheable(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationFirst(request));
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    cacheFirst(request).catch(async () => {
      const cache = await caches.open(CACHE_VERSION);
      return (
        (await cache.match(request, { ignoreSearch: true })) ||
        new Response("", { status: 504, statusText: "Offline" })
      );
    })
  );
});
