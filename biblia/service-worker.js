const CACHE_NAME = 'bible-app-cache-v1';
const urlsToCache = [
  '.',
  'index.html',
  'styles.css',
  'script.js',
  'manifest.json',
  'styles/icon-menu.jpg',
  'styles/icon-192.png',
  'styles/icon-512.png',
  'translations/biblia_aa.json',
  'translations/bibliaAveMaria.json'
];

// Evento de Instalação: Salva os arquivos em cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
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