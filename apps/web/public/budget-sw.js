/*
 * Gravity Budget offline: keeps the app on the phone so it opens without internet.
 *  - Pages: from the internet when it answers within a few seconds (so a new version is picked up),
 *    otherwise the copy kept on the phone.
 *  - App files (/assets, fonts, icons): kept on first use; their names change with every version.
 *  - The data (/api) is never handled here: the app keeps its own copy and sends waiting records itself.
 */
const SHELL = 'budget-shell-v1';
const FILES = 'budget-files-v1';
const NETWORK_WAIT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.add(new Request('/', { cache: 'reload' })))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('budget-') && k !== SHELL && k !== FILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function pageFromNetwork(request) {
  return fetch(request).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(SHELL).then((c) => c.put('/', copy));
    }
    return res;
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/download/') || url.pathname === '/budget-sw.js') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/', { cacheName: SHELL }).then((kept) => {
        const network = pageFromNetwork(req);
        if (!kept) return network;
        const slow = new Promise((resolve) => setTimeout(() => resolve(kept), NETWORK_WAIT_MS));
        return Promise.race([network.catch(() => kept), slow]);
      }),
    );
    return;
  }

  if (/^\/(assets|fonts|budget|stamps)\//.test(url.pathname) || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(FILES).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
