// Offline support for the 2D game. Increment this cache name with each asset release.
// Online accounts, saves and leaderboards always go directly to their own server.
var CACHE = 'traffic-rush-2026-10-27.5';
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c) {
    return c.addAll(['./', './privacy.html', './cars/detail/hauler-top.webp']);
  }).catch(function() {}));
});
self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return (k.indexOf('cargo-run-') === 0 || k.indexOf('traffic-rush-') === 0) && k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e) {
  var req=e.request;if(req.method!=='GET')return;
  var url=new URL(req.url),same=url.origin===self.location.origin;
  var font=/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if(!same&&!font)return;
  // Cache the versioned sprite requests too, so previously viewed cars work offline.
  var asset=same&&/\.(webp|png|jpg|jpeg|svg|woff2?)$/i.test(url.pathname);
  if(asset||font) {
    var key=asset?url.origin+url.pathname:req;
    e.respondWith(caches.open(CACHE).then(function(c) {
      return c.match(key).then(function(hit) {
        return hit||fetch(req).then(function(res) {
          if(res.ok){var copy=res.clone();e.waitUntil(c.put(key,copy));}return res;
        });
      });
    }).catch(function(){return new Response('',{status:503});}));
    return;
  }
  e.respondWith(fetch(req).then(function(res) {
    if(res.ok&&!url.search){var copy=res.clone();e.waitUntil(caches.open(CACHE).then(function(c){return c.put(req,copy);}));}
    return res;
  }).catch(function() {
    return caches.open(CACHE).then(function(c) {
      return c.match(req,{ignoreSearch:true}).then(function(hit){
        if(hit)return hit;
        if(req.mode==='navigate')return c.match('./').then(function(home){return home||new Response('Offline',{status:503});});
        return new Response('',{status:503});
      });
    });
  }));
});
