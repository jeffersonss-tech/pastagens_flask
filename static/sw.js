// Service Worker para PastoFlow (v2)
const CACHE_NAME = 'pastoflow-v2';

// Arquivos para pré-cachear
const PRECACHE_URLS = [
    '/',
    '/home',
    '/login',
    '/static/css/style.css',
    '/static/css/fazenda.css',
    '/static/css/piquetes.css',
    '/static/css/lotes.css',
    '/static/js/fazenda.js',
    '/static/js/lotes.js',
    '/static/js/piquetes.js',
    '/static/js/rotacao.js',
    '/static/manifest.json',
    '/static/icon/PastoFlow-logo.png',
    '/static/icon/PastoFlow-logo.ico'
];

// Instalação - Pré-cache de arquivos fundamentais
self.addEventListener('install', (e) => {
    console.log('SW: install');
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: precaching assets');
            // Usar addAll com erro ignorado para cada arquivo para não quebrar tudo se um falhar
            return Promise.allSettled(
                PRECACHE_URLS.map(url => cache.add(url))
            );
        }).then(() => self.skipWaiting())
    );
});

// Ativação - Limpa versões antigas do cache e assume controle imediato
self.addEventListener('activate', (e) => {
    console.log('SW: activate');
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - Estratégia híbrida
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Ignora requisições de outros domínios
    if (url.origin !== location.origin) return;

    // Ignora requisições que não sejam GET
    if (e.request.method !== 'GET') return;

    const isApi = url.pathname.startsWith('/api/');
    const isMainPage = url.pathname === '/' || 
                       url.pathname === '/home' || 
                       url.pathname.startsWith('/fazenda/');

    // APIs: Network-first (tenta rede, fallback cache)
    if (isApi) {
        e.respondWith(
            fetch(e.request)
                .then((resp) => {
                    if (resp.ok) {
                        const clone = resp.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
                    }
                    return resp;
                })
                .catch(() => {
                    return caches.match(e.request).then(cached => {
                        if (cached) return cached;
                        // Fallback JSON para APIs offline sem cache
                        return new Response(JSON.stringify({ error: 'offline', status: 'error' }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                })
        );
        return;
    }

    // Páginas e Estáticos: Cache-first
    e.respondWith(
        caches.match(e.request).then((cached) => {
            if (cached) return cached;
            
            return fetch(e.request).then((resp) => {
                if (resp.ok) {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
                }
                return resp;
            }).catch(() => {
                // Se offline total e falhar, tenta retornar a Home do cache
                return caches.match('/') || caches.match('/home');
            });
        })
    );
});
