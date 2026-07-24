const CACHE_NAME = 'bible-app-cache-v2';
const urlsToCache = [
  '.',
  'index.html',
  'styles.css',
  'script.js',
  'manifest.json',
  'styles/icon-menu.jpg',
  'logo192.jpg',
  'logo512.jpg',
  'translations/biblia_aa.json',
  'translations/bibliaAveMaria.json'
];

// Evento de Instalação: Salva os arquivos em cache
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
    );
});

// Evento de Ativação: Remove caches de versões antigas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

// Evento de Fetch: Intercepta as requisições
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Se encontrar no cache, retorna do cache.
                if (response) {
                    return response;
                }
                // Se não, busca na rede.
                return fetch(event.request);
            })
    );
});