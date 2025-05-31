const CACHE_NAME = 'radio-player-cache-v2'; // Incremente a versão ao atualizar arquivos
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
    // Adicione aqui outros assets estáticos que você queira cachear
];

// Evento de Instalação: Cacheia os arquivos do App Shell
self.addEventListener('install', event => {
    console.log('Service Worker: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Cache aberto, adicionando App Shell ao cache.');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Service Worker: Falha ao cachear App Shell durante a instalação.', error);
            })
    );
    self.skipWaiting(); // Força o service worker a ativar imediatamente
});

// Evento de Ativação: Limpa caches antigos
self.addEventListener('activate', event => {
    console.log('Service Worker: Ativando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deletando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim(); // Torna-se o service worker ativo para todas as abas abertas
});

// Evento Fetch: Intercepta requisições de rede
self.addEventListener('fetch', event => {
    // Apenas para requisições GET. Streams de áudio não devem ser cacheados dessa forma.
    if (event.request.method !== 'GET') {
        return;
    }

    // Estratégia: Cache first, then network para os assets do App Shell
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // console.log('Service Worker: Recurso encontrado no cache:', event.request.url);
                    return cachedResponse;
                }
                // console.log('Service Worker: Recurso não encontrado no cache, buscando na rede:', event.request.url);
                return fetch(event.request).then(networkResponse => {
                    // Não cacheia respostas de erro ou de extensões (ex: chrome-extension://)
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                         // Não cacheia streams de áudio via SW, pois podem ser grandes e dinâmicos
                        if (event.request.url.includes('.mp3') || event.request.url.includes('.aac') || event.request.headers.get('accept').includes('audio/')) {
                            return networkResponse;
                        }
                        // Cacheia outros recursos básicos que não foram pegos no install
                        return caches.open(CACHE_NAME).then(cache => {
                            // console.log('Service Worker: Cacheando novo recurso da rede:', event.request.url);
                            // cache.put(event.request, networkResponse.clone()); // Desabilitado para evitar cache excessivo de chamadas de API não intencionais
                            return networkResponse;
                        });
                    }
                    return networkResponse;
                }).catch(error => {
                    console.error('Service Worker: Erro de fetch:', error);
                    // Você pode retornar uma página offline padrão aqui se desejar
                    // return caches.match('/offline.html');
                });
            })
    );
});
