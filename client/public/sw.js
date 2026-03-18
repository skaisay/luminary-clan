const CACHE_NAME = 'clan-command-v4';

self.addEventListener('install', (event) => {
  // Сразу активируем новый SW, не ждём закрытия вкладок
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Удаляем ВСЕ старые кеши и берём контроль над всеми вкладками
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API и auth запросы — ВСЕГДА только сеть, никакого кеширования
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Навигация (HTML страницы) — ВСЕГДА сеть, fallback на кеш
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html') || caches.match(event.request))
    );
    return;
  }

  // Статика (JS/CSS/images с хешами в имени) — кеш, обновляем в фоне (stale-while-revalidate)
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2?)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request).then((response) => {
            cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // Всё остальное — только сеть
  event.respondWith(fetch(event.request));
});
