/* Service Worker：離線快取 + 更新。
 * 策略：HTML 網路優先（確保更新）；同源圖片/JS/CSS cache-first＋背景更新；
 * API / 第三方動態資源（SkyHelper、Discord、wikia、Firebase）一律走網路、不快取。
 */
const CACHE = 'sky-companion-v1';
const BYPASS = /api\.skyhelper\.xyz|cdn\.discordapp\.com|static\.wikia\.nocookie\.net|sky-planner\.com|gstatic\.com|googleapis\.com|firebaseio\.com|firebase|fandom\.com/i;

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 動態/第三方：直接走網路，不攔截
  if (BYPASS.test(url.host + url.pathname)) return;
  // 跨網域其他資源也不快取
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isHTML) {
    // 網路優先，失敗才用快取（離線時）
    e.respondWith(
      fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); return r; })
        .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }
  // 圖片/JS/CSS：cache-first + 背景更新
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(r => {
        if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); }
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
