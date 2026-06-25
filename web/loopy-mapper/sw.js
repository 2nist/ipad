const CACHE_NAME = "loopy-mapper-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./template/drum-looper.lpproj/Info.plist",
  "./template/drum-looper.lpproj/Project.sqlite",
  "./template/drum-looper.lpproj/Resources.plist",
  "./template/drum-looper.lpproj/Control%20Profile.lpcontrolprofile/Internal.Internal.controllerprofile",
  "./template/drum-looper.lpproj/Control%20Profiles/Drums.lpcontrolprofile/ATOM%20SQ.MIDI.ATOM%20SQ.controllerprofile",
  "./template/drum-looper.lpproj/Control%20Profiles/Drums.lpcontrolprofile/mVave%20Chocolate.MIDI.Chocolate.controllerprofile"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
