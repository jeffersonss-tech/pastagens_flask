// Service Worker para PastoFlow (v18)
const CACHE_NAME = 'pastoflow-v18';

// Tempo máximo de espera pela rede (ms) antes de usar o cache para APIs
const NETWORK_TIMEOUT = 2500; 

// Arquivos para pré-cachear (incluindo dependências externas críticas)
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
    '/static/icon/PastoFlow-logo.ico',
    // Dependências Externas (CDNs)
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Instalação - Pré-cache de arquivos fundamentais
self.addEventListener('install', (e) => {
    console.log('SW: install');
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: precaching assets');
            return Promise.allSettled(
                PRECACHE_URLS.map(url => cache.add(new Request(url, { mode: 'no-cors' })))
            );
        }).then(() => self.skipWaiting())
    );
});

// Ativação - Limpa versões antigas do cache
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

    // Ignora tiles do mapa (Esri / OSM) - Tratados via IndexedDB no fazenda.js
    if (url.href.includes('arcgisonline.com') || url.href.includes('tile.openstreetmap.org')) {
        return;
    }

    // Ignora requisições não-GET ou verificações de servidor
    if (e.request.method !== 'GET' || url.search.includes('check_server')) return;

    const isApi = url.pathname.startsWith('/api/');
    const isPage = url.pathname === '/' || url.pathname === '/home' || url.pathname.startsWith('/fazenda');
    const isExternal = url.origin !== location.origin;

    // Estratégia para APIs
    if (isApi) {
        e.respondWith(
            fetch(e.request)
                .then(resp => {
                    if (resp.ok) {
                        const clone = resp.clone();
                        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    }
                    return resp;
                })
                .catch(() => {
                    return caches.match(e.request).then(cached => {
                        if (cached) return cached;
                        const path = url.pathname;
                        const isList = path.includes('/lotes') || path.includes('/piquetes');
                        const fallback = isList ? [] : { error: 'offline' };
                        return new Response(JSON.stringify(fallback), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                })
        );
        return;
    }

    // Páginas e Estáticos (Locais e Externos como Leaflet)
    e.respondWith(
        fetch(e.request)
            .then(resp => {
                // Se deu certo, salva no cache (exceto se for resposta de erro)
                if (resp.ok || resp.type === 'opaque') {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return resp;
            })
            .catch(() => {
                // Falhou a rede: tenta o cache
                return caches.match(e.request).then(cached => {
                    if (cached) return cached;
                    
                    // Se não tem no cache e é página da fazenda, tenta a Home
                    if (isPage) {
                        return caches.match('/').then(home => home || caches.match('/home'));
                    }
                    
                    // Resposta vazia padrão para evitar Uncaught TypeError: Failed to convert value to 'Response'
                    return new Response('', { status: 404, statusText: 'Offline' });
                });
            })
    );
});
