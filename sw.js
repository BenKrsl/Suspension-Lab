/* Suspension Lab — Offline-Cache.
   Strategie:
   - App-Dateien (HTML, Icons, Manifest) beim Installieren vorab cachen.
   - HTML: Netz zuerst, Cache als Fallback → Updates kommen an, offline läuft's trotzdem.
   - Alles andere (z. B. Google Fonts): Cache zuerst, im Hintergrund nachladen.
   Bei Änderungen an der App die VERSION hochzählen, dann tauscht der
   Browser den Cache beim nächsten Besuch aus. */
const VERSION = "sl-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const isHTML = req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    // Netz zuerst, damit Updates ankommen; offline aus dem Cache.
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(hit => hit || caches.match("./index.html"))
        )
    );
    return;
  }

  // Rest: Cache zuerst, sonst Netz und fürs nächste Mal merken.
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res.ok && (req.url.startsWith(self.location.origin) ||
                       req.url.includes("fonts.googleapis.com") ||
                       req.url.includes("fonts.gstatic.com"))) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
