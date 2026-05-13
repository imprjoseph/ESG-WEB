/**
 * GreenStep Service Worker
 * PWA 離線快取與背景同步
 */

const CACHE_NAME = 'greenstep-v1.0.0';
const STATIC_CACHE = 'greenstep-static-v1';
const DATA_CACHE   = 'greenstep-data-v1';

// 靜態資源快取清單
const STATIC_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './events.html',
  './missions.html',
  './leaderboard.html',
  './esg.html',
  './rewards.html',
  './profile.html',
  './config.js',
  './manifest.json',
];

// ─── Install ─────────────────────────────────────────────
self.addEventListener('install', e => {
  console.log('[SW] Installing GreenStep Service Worker...');
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate ────────────────────────────────────────────
self.addEventListener('activate', e => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== DATA_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // GAS API 請求：Network First（優先網路，失敗才快取）
  if (url.hostname.includes('script.google.com')) {
    e.respondWith(networkFirst(e.request, DATA_CACHE));
    return;
  }

  // CDN 資源：Cache First
  if (url.hostname.includes('cdn') || url.hostname.includes('cdnjs')) {
    e.respondWith(cacheFirst(e.request, STATIC_CACHE));
    return;
  }

  // 本地靜態資源：Stale While Revalidate
  if (e.request.method === 'GET') {
    e.respondWith(staleWhileRevalidate(e.request, STATIC_CACHE));
  }
});

// ─── 快取策略 ─────────────────────────────────────────────
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ success: false, offline: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fetchPromise;
}

// ─── Push Notifications ──────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  const options = {
    body: data.body || '您有新的 ESG 任務等待完成！',
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './missions.html' },
    actions: [
      { action: 'open', title: '立即查看' },
      { action: 'close', title: '稍後再說' },
    ],
  };
  e.waitUntil(
    self.registration.showNotification(data.title || 'GreenStep 通知', options)
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'open' || !e.action) {
    e.waitUntil(clients.openWindow(e.notification.data?.url || './'));
  }
});
