const CACHE_NAME = 'net-monitor-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/cadastro.html',
  '/relatorios.html',
  '/css/style.css',
  '/js/dashboard.js',
  '/js/cadastro.js',
  '/js/relatorios.js',
  '/manifest.json'
];

// Instalar e cachear recursos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('Erro ao cachear:', err))
  );
  self.skipWaiting();
});

// Interceptar requisições
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna do cache ou faz fetch
        if (response) {
          return response;
        }
        return fetch(event.request)
          .catch(() => {
            // Se offline e for API, retorna dados vazios
            if (event.request.url.includes('/api/')) {
              return new Response(JSON.stringify([]), {
                headers: {'Content-Type': 'application/json'}
              });
            }
          });
      })
  );
});

// Ativar e limpar caches antigos
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
  self.clients.claim();
});

// Receber mensagens do cliente (para notificações)
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});