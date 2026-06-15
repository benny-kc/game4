const CACHE_NAME = "score-app-v1";
const FILES = [
  "index.html",
  "manifest.json",
  "service-worker.js",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

// Instalacja SW – cache plików
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
});

// Aktywacja – czyszczenie starych cache
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
});

// Tryb offline – cache-first
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
