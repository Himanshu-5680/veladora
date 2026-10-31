const CACHE = "veladora-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css?v=5",
  "./js/app.js",
  "./js/analyzer.js",
  "./js/draft.js",
  "./js/export.js",
  "./js/garbage.js",
  "./js/languages.js",
  "./js/samples.js",
  "./js/timeline.js",
  "./js/worker.js",
  "./favicon.svg",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
  )));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request)),
  );
});
