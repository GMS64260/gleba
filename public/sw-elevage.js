const CACHE = 'gleba-elevage-shell-v1'
const SHELL = ['/elevage/tournee', '/manifest.json']
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())))
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (event.request.mode === 'navigate' && url.pathname === '/elevage/tournee') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put('/elevage/tournee', copy)); return response
    }).catch(() => caches.match('/elevage/tournee')))
  }
})
