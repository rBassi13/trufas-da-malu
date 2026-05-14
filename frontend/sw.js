const CACHE_NAME = 'trufas-da-malu-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/style.css',
  '/js/app.js',
  '/js/admin.js',
  '/manifest.json'
];

// Instala o Service Worker e salva os arquivos no cache
self.addEventListener('install', event => {
  self.skipWaiting(); // Força a ativação imediata
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Limpa caches antigos quando uma nova versão sobe (Evita arquivos zumbis)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Estratégia de Fetch: Tenta a Rede (Network). Se falhar (Offline), puxa do Cache.
self.addEventListener('fetch', event => {
  // Ignorar chamadas da API no cache (sempre queremos os pedidos em tempo real)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
