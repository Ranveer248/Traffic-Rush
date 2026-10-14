// Cargo Run offline helper. Keeps a copy of the game on the device so it opens and plays without internet.
// The game file is always fetched fresh when there's a connection (so updates arrive straight away); the saved copy is
// only used when the network fails. Online saving and the leaderboard (Supabase) are never cached.
var CACHE = 'cargo-run-v1';

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(['./', './privacy.html']); }).catch(function () {}));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url), same = url.origin === self.location.origin, font = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return;   // everything else (sign-in, saves, leaderboard) goes straight to the network

  if (font) {
    // fonts never change: use the saved copy, fetch once
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res; });
    }));
    return;
  }

  // the game itself: network first, saved copy when offline
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok && !url.search) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('./'); });
  }));
});
