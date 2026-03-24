// TutorLedger Service Worker
const CACHE = 'tutorledger-v1';
const FONTS = 'tutorledger-fonts-v1';

const APP_SHELL = [
  './',
  './index.html',
];

const FONT_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

// ── Install: cache the app shell ─────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ───────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE && k !== FONTS)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ───────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept Google OAuth / Sheets API calls — let them fail naturally offline
  if (
    url.hostname === 'accounts.google.com' ||
    url.hostname === 'sheets.googleapis.com' ||
    url.hostname === 'oauth2.googleapis.com'
  ) {
    return; // pass-through
  }

  // Fonts: cache-first with long-lived font cache
  if (FONT_ORIGINS.some(o => e.request.url.startsWith(o))) {
    e.respondWith(
      caches.open(FONTS).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const fresh = await fetch(e.request);
          cache.put(e.request, fresh.clone());
          return fresh;
        } catch {
          return cached || new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // App shell + everything else: network-first with cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Only cache same-origin GET responses
        if (e.request.method === 'GET' && url.origin === self.location.origin) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
