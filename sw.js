/*
 * Service worker : permet d'installer l'application et de l'utiliser hors ligne.
 *  - fichiers de l'app : réseau d'abord (les mises à jour arrivent dès qu'on est en ligne),
 *    copie en cache en secours ;
 *  - Three.js (CDN, version figée) : cache d'abord.
 */
const CACHE = 'circuit3d-v1';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/library.js', 'js/model.js', 'js/sim.js', 'js/schematic.js', 'js/library-editor.js',
  'js/view3d.js', 'js/json-editor.js', 'js/app.js',
  'icons/logo.svg', 'icons/favicon-32.png', 'icons/apple-touch-icon.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (cache) => {
    await cache.addAll(CORE);
    // La 3D reste facultative : un échec de téléchargement du CDN ne bloque pas l'installation
    await Promise.all(CDN.map(url => fetch(url, { mode: 'cors' })
      .then(r => r.ok && cache.put(url, r)).catch(() => {})));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (CDN.includes(req.url)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return r;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;

  e.respondWith(fetch(req).then(r => {
    if (r.ok) {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
