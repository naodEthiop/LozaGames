const CACHE_NAME = 'color-move-v2';
const CACHE_TIMEOUT = 86400; // 24 hours in seconds
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/index-CHKBdGBU.css',
  '/assets/index-GrIU3NQ6.js'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching core assets');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event with Cache-First strategy with network fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and chrome-extension requests
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Handle API requests with Network-First strategy
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Cache the API response for offline use
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseToCache));
          return networkResponse;
        })
        .catch(() => {
          // If network fails, try to get it from cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // For static assets, use Cache-First strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          // Check if the cached response is still fresh
          const cachedDate = new Date(cachedResponse.headers.get('date'));
          const cacheAge = (Date.now() - cachedDate.getTime()) / 1000; // in seconds
          
          if (cacheAge < CACHE_TIMEOUT) {
            return cachedResponse;
          }
        }
        
        // Otherwise, fetch from network
        return fetch(event.request)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, show a fallback
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/offline.html');
            }
          });
      })
  );
});

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    // Handle background sync logic here
  }
});
