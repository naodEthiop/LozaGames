const CACHE_NAME = 'loza-games-v4';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_AGE_VIDEOS = 30 * 24 * 60 * 60 * 1000; // 30 days
const VERSION = 'v4.0.0';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/public/manifest.json',
  '/icon/favicon.ico',
  '/icon/favicon-96x96.png',
  '/icon/favicon.svg',
  '/icon/apple-touch-icon.png',
  '/icon/web-app-manifest-192x192.png',
  '/icon/web-app-manifest-512x512.png',
  '/videos/offline-poster.jpg'
];

// Precache these files on install
const PRECACHE_ASSETS = [
  '/css/main.css',
  '/js/main.js',
  '/js/video-player.js',
  '/images/logo.svg',
  '/images/offline.svg'
];

// Network-first resources (try network first, fall back to cache)
const NETWORK_FIRST = [
  /\/api\//,
  /\/videos\/.*\.(mp4|webm|ogg)/
];

// Stale-while-revalidate strategy (serve from cache, update in background)
const STALE_WHILE_REVALIDATE = [
  /\/videos\/.*\.(jpg|jpeg|png|webp|avif|gif|svg)$/i,
  /\/images\/.*\.(jpg|jpeg|png|webp|avif|gif|svg)$/i
];

// Cache-first resources (serve from cache, update in background if expired)
const CACHE_FIRST = [
  /\/assets\/.*\.(js|css|woff2?|ttf|eot)$/i,
  /\/icon\/.*\.(png|svg|ico)$/i,
  /\/videos\/.*-poster\.(jpg|jpeg|png|webp|avif|gif|svg)$/i
];

// Cache only (for versioned assets with hashes in filenames)
const CACHE_ONLY = [
  /\/.*\.[a-f0-9]{8}\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|gif|svg|webp|avif)$/i
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate new service worker immediately
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching core assets');
        // Cache core assets first
        return cache.addAll(CORE_ASSETS)
          .then(() => {
            // Then try to cache precache assets in the background
            return cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' })))
              .catch(err => {
                console.log('[Service Worker] Failed to precache some assets:', err);
              });
          });
      })
  );
});

// Clean up old caches
const cleanOldCaches = async () => {
  const cacheKeepList = [CACHE_NAME];
  const keys = await caches.keys();
  
  return Promise.all(
    keys.map(key => {
      if (!cacheKeepList.includes(key)) {
        console.log('[Service Worker] Removing old cache:', key);
        return caches.delete(key);
      }
      return null;
    })
  );
};

// Clean up expired cache entries
const cleanExpiredCache = async (cache) => {
  const requests = await cache.keys();
  const now = Date.now();
  
  await Promise.all(requests.map(async (request) => {
    try {
      const response = await cache.match(request);
      if (!response) return;
      
      const date = response.headers.get('date');
      const cacheControl = response.headers.get('cache-control') || '';
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
      const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : CACHE_TTL;
      
      // Special handling for videos
      const isVideo = /\/videos\//.test(request.url);
      const ttl = isVideo ? MAX_AGE_VIDEOS : maxAge;
      
      if (date && (now - new Date(date).getTime() > ttl)) {
        console.log(`[Service Worker] Removing expired cache: ${request.url}`);
        await cache.delete(request);
      }
    } catch (error) {
      console.error(`[Service Worker] Error cleaning cache for ${request.url}:`, error);
    }
  }));
};

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log(`[Service Worker] ${VERSION} activated`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cleanExpiredCache)
      .then(() => cleanOldCaches())
      .then(() => self.clients.claim())
      .then(() => {
        // Send message to all clients about the new service worker
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_UPDATED',
              message: 'A new version is available!',
              version: VERSION
            });
          });
        });
      })
  );
});

// Check which strategy to use for a request
const getStrategy = (request) => {
  const url = request.url;
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.startsWith('chrome-extension://')) {
    return null;
  }
  
  // Check for cache-only strategy (versioned assets)
  if (CACHE_ONLY.some(pattern => pattern.test(url))) {
    return 'CACHE_ONLY';
  }
  
  // Check for network-first strategy
  if (NETWORK_FIRST.some(pattern => pattern.test(url))) {
    return 'NETWORK_FIRST';
  }
  
  // Check for stale-while-revalidate strategy
  if (STALE_WHILE_REVALIDATE.some(pattern => pattern.test(url))) {
    return 'STALE_WHILE_REVALIDATE';
  }
  
  // Default to cache-first strategy for other assets
  if (CACHE_FIRST.some(pattern => pattern.test(url))) {
    return 'CACHE_FIRST';
  }
  
  // For HTML pages, use network first with cache fallback
  if (request.headers.get('accept').includes('text/html')) {
    return 'NETWORK_FIRST';
  }
  
  return null;
};

// Network first strategy
const networkFirst = async (request) => {
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log(`[Service Worker] Network error for ${request.url}, serving from cache`, error);
    const cachedResponse = await caches.match(request);
    
    // For HTML requests, return offline page if no cache
    if (!cachedResponse && request.headers.get('accept').includes('text/html')) {
      return caches.match('/offline.html');
    }
    
    return cachedResponse || Response.error();
  }
};

// Cache first strategy
const cacheFirst = async (request) => {
  const cachedResponse = await caches.match(request);
  
  // Update cache in the background
  const fetchPromise = fetchAndCache(request);
  
  // Return cached response if available, otherwise wait for network
  return cachedResponse || fetchPromise;
};

// Stale-while-revalidate strategy
const staleWhileRevalidate = async (request) => {
  // Try to get from cache first
  const cachedResponse = await caches.match(request);
  
  // Update cache in the background
  const fetchPromise = fetchAndCache(request);
  
  // Return cached response if available, otherwise wait for network
  return cachedResponse || fetchPromise;
};

// Cache only strategy
const cacheOnly = async (request) => {
  const cachedResponse = await caches.match(request);
  if (!cachedResponse) {
    console.log(`[Service Worker] Cache miss for ${request.url}`);
    return Response.error();
  }
  return cachedResponse;
};

// Fetch and cache response with error handling
const fetchAndCache = async (request) => {
  try {
    const response = await fetch(request);
    
    // Only cache successful responses and non-opaque responses
    if (response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error(`[Service Worker] Error fetching ${request.url}:`, error);
    throw error;
  }
};

// Background sync for failed requests
const registerBackgroundSync = async () => {
  if ('sync' in self.registration) {
    try {
      await self.registration.sync.register('sync-queue');
      console.log('[Service Worker] Background sync registered');
    } catch (error) {
      console.error('[Service Worker] Background sync registration failed:', error);
    }
  }
};

// Main fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || 
      request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // Skip cross-origin requests that we can't cache
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Handle different caching strategies
  const strategy = getStrategy(request);
  
  switch (strategy) {
    case 'NETWORK_FIRST':
      event.respondWith(networkFirst(request));
      break;
      
    case 'CACHE_FIRST':
      event.respondWith(cacheFirst(request));
      break;
      
    case 'STALE_WHILE_REVALIDATE':
      event.respondWith(staleWhileRevalidate(request));
      break;
      
    case 'CACHE_ONLY':
      event.respondWith(cacheOnly(request));
      break;
      
    default:
      // Default: network first with cache fallback
      event.respondWith(
        fetch(request)
          .catch(() => caches.match(request))
          .catch(() => {
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/offline.html');
            }
            return Response.error();
          })
      );
  }
});

// Background sync event listener
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    console.log('[Service Worker] Background sync event fired');
    // Process any pending background sync tasks here
  }
});

// Push notification event listener
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'New update available';
  const options = {
    body: data.message || 'Click to see what\'s new',
    icon: '/icon/icon-192x192.png',
    badge: '/icon/icon-96x96.png',
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open a new window/tab if none exists
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
