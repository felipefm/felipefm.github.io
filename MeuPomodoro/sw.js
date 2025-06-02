// sw.js (Service Worker)
const CACHE_NAME = 'pomodoro-deluxe-cache-v2'; // Incremente a versão ao mudar os assets
const urlsToCache = [
    '/',
    'index.html', // Se você renomear seu HTML principal, atualize aqui
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js',
    // Adicione aqui caminhos para sons locais se você os usar:
    // 'sounds/work_end.mp3',
    // 'sounds/break_end.mp3',
    // 'sounds/task_complete.mp3'
];

// Firebase SDKs são carregados dinamicamente e geralmente não são cacheados pelo service worker
// devido à sua natureza dinâmica e dependência de conexão de rede para autenticação e dados.
// A estratégia de cache para eles é complexa e pode interferir no funcionamento do Firebase.
// O SDK do Firebase já possui seu próprio mecanismo de cache offline para dados do Firestore.

self.addEventListener('install', event => {
    console.log('Service Worker: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Cache aberto, adicionando URLs principais.');
                return cache.addAll(urlsToCache.map(url => new Request(url, {mode: 'cors'})));
            })
            .catch(error => {
                console.error('Service Worker: Falha ao abrir cache ou adicionar URLs:', error);
            })
    );
});

self.addEventListener('activate', event => {
    console.log('Service Worker: Ativando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Limpando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim(); // Torna o SW ativo imediatamente
});

self.addEventListener('fetch', event => {
    // console.log('Service Worker: Fetching', event.request.url);

    // Estratégia: Network first, then cache for non-Firebase requests
    // Para requisições do Firebase, sempre vá para a rede.
    if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebaseinstallations.googleapis.com') || event.request.url.includes('identitytoolkit.googleapis.com')) {
        // console.log('Service Worker: Passando requisição do Firebase para a rede:', event.request.url);
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Para outras requisições, tente a rede primeiro, depois o cache.
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // console.log('Service Worker: Resposta da rede para:', event.request.url);
                // Opcional: atualizar o cache com a resposta da rede se for uma requisição GET bem-sucedida
                if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // console.log('Service Worker: Falha na rede, tentando cache para:', event.request.url);
                return caches.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            // console.log('Service Worker: Servindo do cache:', event.request.url);
                            return cachedResponse;
                        }
                        // console.log('Service Worker: Não encontrado no cache nem na rede:', event.request.url);
                        // Se nem a rede nem o cache tiverem, você pode retornar uma página offline padrão, se tiver uma.
                        // Por enquanto, deixaremos o navegador lidar com o erro.
                    });
            })
    );
});