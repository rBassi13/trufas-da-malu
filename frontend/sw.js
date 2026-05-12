const CACHE_NAME = 'trufas-da-malu-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/style.css',
  '/js/app.js',
  '/js/admin.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Ignorar chamadas da API no cache
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('push', event => {
  let data = { title: 'Nova Notificação', body: 'Você tem uma atualização!', url: '/' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    data: {
      url: data.url
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
// O Chrome EXIGE esse evento 'fetch' para liberar o botão de Instalar Aplicativo!
const CACHE_NAME = 'trufas-malu-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Uma estratégia simples: tenta ir na rede, se falhar (sem internet), procura no cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
