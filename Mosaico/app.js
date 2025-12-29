// ----------------- YOUTUBE API BOILERPLATE -----------------
// Carrega a API do IFrame Player do YouTube de forma assíncrona.
// Tenta carregar a API; em caso de falha (CSP), exibe aviso e usa fallback de iframe nos vídeos.
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
tag.onerror = function() {
    console.warn('Falha ao carregar API do YouTube (possível CSP da extensão).');
    showCSPWarning();
};
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
// Se a API demorar, mostra aviso (fallback)
setTimeout(() => { if (!window.YT) showCSPWarning(); }, 2000);

// ----------------- DOM ELEMENTS -----------------
const videoUrlInput = document.getElementById('video-url');
const addVideoBtn = document.getElementById('add-video-btn');
const videoGrid = document.getElementById('video-grid');
const muteAllBtn = document.getElementById('mute-all-btn');
const unmuteAllBtn = document.getElementById('unmute-all-btn');

// Lives modal elems
const openLivesBtn = document.getElementById('open-lives-btn');
const livesModal = document.getElementById('lives-modal');
const closeLivesBtn = document.getElementById('close-lives-btn');
const livesList = document.getElementById('lives-list');
const livesError = document.getElementById('lives-error');
const apiKeyInput = document.getElementById('youtube-api-key');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const refreshLivesBtn = document.getElementById('refresh-lives-btn');
const livesQueryInput = document.getElementById('lives-query');
const livesRegionSelect = document.getElementById('lives-region');
const livesOrderSelect = document.getElementById('lives-order');
const livesDebug = document.getElementById('lives-debug');


// ----------------- STATE MANAGEMENT -----------------
let players = []; // Array para armazenar todas as instâncias dos players
let nextPlayerId = 0; // contador incremental para garantir IDs únicos mesmo após remoções

// Ouve mensagens postMessage vindas dos iframes do YouTube para detectar erros/estado
window.addEventListener('message', (e) => {
    if (!e.data) return;
    let data = e.data;
    try {
        if (typeof data === 'string') data = JSON.parse(data);
    } catch (err) {
        return; // não é JSON do player
    }

    // Detecta erro enviado pelo player embutido (onError)
    if (data && (data.event === 'onError' || data.event === 'error')) {
        // localiza o player pelo contentWindow (quando possível)
        const playerIndex = players.findIndex(p => p.instance && p.instance.getIframe && p.instance.getIframe().contentWindow === e.source);
        if (playerIndex !== -1) {
            showPlayerError(players[playerIndex].id);
        }
    }
});

function showPlayerError(playerId) {
    const container = document.querySelector(`.video-container[data-player-id="${playerId}"]`);
    if (!container) return;
    let errEl = container.querySelector('.player-error');
    if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'player-error';
        errEl.innerHTML = `Erro ao reproduzir (possível restrição de embed). <button class="open-youtube-btn">Abrir no YouTube</button>`;
        container.appendChild(errEl);
        const btn = errEl.querySelector('.open-youtube-btn');
        btn.addEventListener('click', () => {
            const p = players.find(x => x.id === playerId);
            if (p && p.videoId) {
                window.open(`https://www.youtube.com/watch?v=${p.videoId}`, '_blank');
            }
        });
    }
} 

// ----------------- CORE FUNCTIONS -----------------

/**
 * Chamada quando a API do YouTube está pronta.
 * Não precisamos fazer nada aqui no início, mas a função precisa existir.
 */
function onYouTubeIframeAPIReady() {
    console.log("API do YouTube pronta.");
}

function showCSPWarning() {
    const warn = document.getElementById('csp-warning');
    if (warn) {
        warn.style.display = 'block';
        warn.textContent = "Aviso: não foi possível carregar a API do YouTube (CSP). A extensão usará um fallback via iframes; os controles de mudo devem funcionar, mas funcionalidades avançadas podem ficar limitadas.";
    }
}

// ----------------- Lives (YouTube search) -----------------
function openLivesModal() {
    console.log('openLivesModal()');
    // populate api key from localStorage if exists
    const saved = localStorage.getItem('YT_API_KEY');
    if (saved) apiKeyInput.value = saved;
    livesError.style.display = 'none';
    livesList.innerHTML = '';
    if (!livesModal) {
        console.error('livesModal element not found');
        return;
    }
    livesModal.style.display = 'flex';
    fetchLives();
}

function closeLivesModal() {
    livesModal.style.display = 'none';
}

async function fetchLives() {
    const apiKey = apiKeyInput.value.trim() || localStorage.getItem('YT_API_KEY');
    const q = (livesQueryInput && livesQueryInput.value.trim()) || '';
    const region = (livesRegionSelect && livesRegionSelect.value) || '';
    const order = (livesOrderSelect && livesOrderSelect.value) || 'date';

    livesError.style.display = 'none';
    livesList.innerHTML = '';
    livesDebug.style.display = 'none';

    if (!apiKey) {
        livesError.textContent = 'É necessário fornecer uma YouTube Data API key para buscar lives. Cole-a no campo acima e clique em Salvar.';
        livesError.style.display = 'block';
        return;
    }

    // Busca paginada: maxResults=50 por página, até maxPages
    const maxPages = 3; // cuidado com quota: 1 page = 100 unidades (search=100?), ajustar conforme necessidade
    let allItems = [];
    let nextPageToken = null;

    try {
        for (let page = 0; page < maxPages; page++) {
            const params = new URLSearchParams({ part: 'snippet', eventType: 'live', type: 'video', maxResults: '50', key: apiKey });
            if (q) params.set('q', q);
            if (region) params.set('regionCode', region);
            params.set('order', order);
            if (nextPageToken) params.set('pageToken', nextPageToken);

            const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
            const res = await fetch(url);
            if (!res.ok) {
                const body = await res.text();
                throw new Error(`API Error: ${res.status} ${body}`);
            }
            const data = await res.json();

            // acumula e deduplica por videoId
            const items = (data.items || []).filter(i => i.id && i.id.videoId);
            for (const it of items) {
                if (!allItems.find(x => x.id && x.id.videoId === it.id.videoId)) allItems.push(it);
            }

            // Debug increment
            livesDebug.textContent = `Page ${page+1}: received ${items.length} items\nTotal collected: ${allItems.length}\n` + (livesDebug.textContent || '');
            livesDebug.style.display = 'block';

            nextPageToken = data.nextPageToken;
            if (!nextPageToken) break; // sem mais páginas
        }

        if (allItems.length === 0) {
            livesError.textContent = 'Nenhuma live encontrada com os parâmetros atuais. Tente palavra-chave diferente, mude a região ou verifique sua API key/quota.';
            livesError.style.display = 'block';
            return;
        }

        // Se foi solicitado filtro por região, tenta filtrar pelo country do canal
        if (region) {
            try {
                const channelIds = [...new Set(allItems.map(i => i.snippet.channelId).filter(Boolean))];
                const countryMap = await fetchChannelCountries(channelIds.slice(0, 50), apiKey); // limita para 50 por chamada
                // Filtra items cujo canal tenha country === region
                const filtered = allItems.filter(i => countryMap[i.snippet.channelId] === region);
                livesDebug.textContent = `After channel country filter: ${filtered.length} / ${allItems.length} (requested region=${region})\n` + (livesDebug.textContent || '');
                if (filtered.length > 0) {
                    allItems = filtered;
                } else {
                    // fallback: tentar com relevanceLanguage para o idioma pt caso region=BR
                    if (region === 'BR') {
                        livesDebug.textContent += 'No channels matched country; retrying search with relevanceLanguage=pt fallback.\n';
                        // refazer busca com relevanceLanguage=pt (simple fallback limited)
                        const fbParams = new URLSearchParams({ part: 'snippet', eventType: 'live', type: 'video', maxResults: '50', key: apiKey, relevanceLanguage: 'pt', order: order });
                        if (q) fbParams.set('q', q);
                        const fbUrl = `https://www.googleapis.com/youtube/v3/search?${fbParams.toString()}`;
                        const fbRes = await fetch(fbUrl);
                        if (fbRes.ok) {
                            const fbData = await fbRes.json();
                            allItems = fbData.items || [];
                        }
                    }
                }
            } catch (err) {
                livesDebug.textContent += 'Error fetching channel countries: ' + (err.message || err) + '\n';
            }
        }

        // Ordena localmente por viewCount se necessário (requere request adicional a videos.list)
        if (order === 'viewCount') {
            // busca estatísticas dos vídeos (em lotes de 50)
            const videoIds = allItems.map(i => i.id.videoId).slice(0,50).join(',');
            const vidRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${videoIds}&key=${encodeURIComponent(apiKey)}`);
            if (vidRes.ok) {
                const vidData = await vidRes.json();
                const statsMap = {};
                (vidData.items || []).forEach(v => {
                    statsMap[v.id] = v.statistics && v.statistics.viewCount ? parseInt(v.statistics.viewCount,10) : 0;
                });
                allItems.sort((a,b) => (statsMap[b.id.videoId] || 0) - (statsMap[a.id.videoId] || 0));
            }
        }

        renderLives(allItems);
    } catch (err) {
        livesError.textContent = 'Erro ao buscar lives: ' + err.message + '. Verifique se a API Key tem o YouTube Data API v3 ativado e sem restrições de referrer.';
        livesError.style.display = 'block';
        livesDebug.textContent = err.stack || err.message;
        livesDebug.style.display = 'block';
    }
}



// busca informações dos canais (country) em lote
async function fetchChannelCountries(channelIds, apiKey) {
    const map = {};
    if (!channelIds || channelIds.length === 0) return map;
    try {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelIds.join(',')}&key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url);
        if (!res.ok) return map;
        const data = await res.json();
        (data.items || []).forEach(ch => {
            if (ch.id && ch.snippet) {
                map[ch.id] = ch.snippet.country || null; // country may be undefined
            }
        });
    } catch (err) {
        console.warn('fetchChannelCountries error', err);
    }
    return map;
}

function renderLives(items) {
    livesList.innerHTML = '';
    items.forEach(item => {
        const vid = item.id && item.id.videoId ? item.id.videoId : null;
        const thumb = item.snippet.thumbnails && (item.snippet.thumbnails.medium || item.snippet.thumbnails.default) ? (item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : item.snippet.thumbnails.default.url) : '';
        const title = item.snippet.title || '';
        const channel = item.snippet.channelTitle || '';

        const card = document.createElement('div');
        card.className = 'live-card';

        const t = document.createElement('div');
        t.className = 'live-thumb';
        t.style.backgroundImage = `url(${thumb})`;

        const info = document.createElement('div');
        info.className = 'live-info';
        info.innerHTML = `<div class="live-title">${title}</div><div class="live-channel">${channel}</div>`;

        const actions = document.createElement('div');
        actions.className = 'live-actions';

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Adicionar';
        addBtn.addEventListener('click', () => {
            if (vid) {
                addVideo(vid);
                closeLivesModal();
            }
        });

        const openBtn = document.createElement('button');
        openBtn.textContent = 'Abrir';
        openBtn.addEventListener('click', () => {
            if (vid) window.open(`https://www.youtube.com/watch?v=${vid}`, '_blank');
        });

        actions.appendChild(addBtn);
        actions.appendChild(openBtn);

        // estrutura: thumb em cima, info, ações embaixo — evita cortes nos botões
        card.appendChild(t);
        card.appendChild(info);
        card.appendChild(actions);

        livesList.appendChild(card);
    });
}


/**
 * Extrai o ID do vídeo de uma URL do YouTube.
 * @param {string} url - A URL do YouTube.
 * @returns {string|null} - O ID do vídeo ou nulo se não for encontrado.
 */
function getYouTubeVideoId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

/**
 * Cria um novo player de vídeo e o adiciona à grade.
 * @param {string} videoId - O ID do vídeo do YouTube.
 */
function addVideo(videoId) {
    const id = nextPlayerId++;
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.dataset.playerId = id; // usado para localizar e mover o container

    const playerDiv = document.createElement('div');
    const playerDomId = `player-${id}`;
    playerDiv.id = playerDomId;

    const overlay = createVideoOverlay(id);

    videoContainer.appendChild(playerDiv);
    videoContainer.appendChild(overlay);
    videoGrid.appendChild(videoContainer);

    // Se a API do YouTube estiver disponível, usa YT.Player. Senão, cria um iframe de fallback.
    let player;
    if (window.YT && YT.Player) {
        player = new YT.Player(playerDomId, {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'autoplay': 1,
                'controls': 0,
                'modestbranding': 1,
                'rel': 0
            },
            events: {
                'onReady': (event) => onPlayerReady(event, id),
            }
        });

        players.push({ id: id, instance: player, muted: true, videoId: videoId });
    } else {
        console.warn('YT.Player não disponível — usando iframe de fallback');
        const iframe = document.createElement('iframe');
        // adiciona origin para melhorar compatibilidade com enablejsapi
        let originParam = '';
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                originParam = `&origin=${encodeURIComponent('chrome-extension://' + chrome.runtime.id)}`;
            }
        } catch (e) {}
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&enablejsapi=1&mute=1${originParam}`;
        iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        document.getElementById(playerDomId).appendChild(iframe);

        // Helper para enviar comandos via postMessage (funciona com enablejsapi=1)
        function postCommand(cmd, args = []) {
            try {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: args }), '*');
            } catch (err) {
                console.warn('Falha ao enviar comando para iframe:', err);
                showPlayerError(id);
            }
        }

        // Instância que usa postMessage para controlar o player embutido
        players.push({
            id: id,
            instance: {
                getIframe: () => iframe,
                mute: () => postCommand('mute'),
                unMute: () => postCommand('unMute'),
                play: () => postCommand('playVideo'),
                pause: () => postCommand('pauseVideo')
            },
            muted: true,
            videoId: videoId
        });

        // Caso o player interno envie um erro via postMessage, o listener global irá disparar showPlayerError
    }
}

/**
 * Cria o overlay com os controles para um vídeo.
 * @param {number} playerId - O ID único do player no nosso array.
 * @returns {HTMLElement} - O elemento do overlay.
 */
function createVideoOverlay(playerId) {
    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';

    const controls = document.createElement('div');
    controls.className = 'video-controls';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'control-btn mute-toggle-btn';
    muteBtn.innerHTML = '🔈'; // Ícone de som desativado
    muteBtn.dataset.playerId = playerId;
    muteBtn.title = "Ativar/Desativar Som";

    const removeBtn = document.createElement('button');
    removeBtn.className = 'control-btn remove-btn';
    removeBtn.innerHTML = '✖'; // Ícone de fechar
    removeBtn.dataset.playerId = playerId;
    removeBtn.title = "Remover Vídeo";

    const watchBtn = document.createElement('button');
    watchBtn.className = 'control-btn watch-btn';
    watchBtn.innerHTML = '▶'; // Ícone de play
    watchBtn.dataset.playerId = playerId;
    watchBtn.title = "Assistir no YouTube";

    const expandBtn = document.createElement('button');
    expandBtn.className = 'control-btn expand-btn';
    expandBtn.innerHTML = '⤢'; // Ícone de expandir
    expandBtn.dataset.playerId = playerId;
    expandBtn.title = "Expandir/Reduzir vídeo";

    controls.appendChild(muteBtn);
    controls.appendChild(watchBtn);
    controls.appendChild(expandBtn);
    controls.appendChild(removeBtn);
    overlay.appendChild(controls);

    return overlay;
}


// ----------------- EVENT HANDLERS -----------------

/**
 * Chamado quando um player está pronto para tocar.
 * Silencia o vídeo por padrão.
 * @param {object} event - O objeto de evento da API do YouTube.
 * @param {number} playerId - O ID do nosso player.
 */
function onPlayerReady(event, playerId) {
    event.target.mute();
    const playerWrapper = players.find(p => p.id === playerId);
    if (playerWrapper) {
        playerWrapper.muted = true;
    }
}

/**
 * Manipula o clique no botão "Adicionar Vídeo".
 */
function handleAddVideoClick() {
    const url = videoUrlInput.value.trim();
    if (url) {
        const videoId = getYouTubeVideoId(url);
        if (videoId) {
            addVideo(videoId);
            videoUrlInput.value = '';
        } else {
            alert("URL do YouTube inválida!");
        }
    }
}

/**
 * Manipula o clique nos botões de controle do overlay (mute, remover).
 * @param {Event} e - O objeto do evento de clique.
 */
function handleVideoGridClick(e) {
    const target = e.target.closest('.control-btn');
    if (!target) return;

    const playerId = parseInt(target.dataset.playerId, 10);
    const playerWrapper = players.find(p => p.id === playerId);
    if (!playerWrapper) return;

    // Controle de Mudo Individual
    if (target.classList.contains('mute-toggle-btn')) {
        if (playerWrapper.muted) {
            playerWrapper.instance.unMute();
            target.innerHTML = '🔊'; // Ícone de som ativado
        } else {
            playerWrapper.instance.mute();
            target.innerHTML = '🔈'; // Ícone de som desativado
        }
        playerWrapper.muted = !playerWrapper.muted;
    }

    // Botão 'Assistir no YouTube'
    if (target.classList.contains('watch-btn')) {
        if (playerWrapper && playerWrapper.videoId) {
            window.open(`https://www.youtube.com/watch?v=${playerWrapper.videoId}`, '_blank');
        }
        return;
    }

    // Botão de Expandir/Reduzir
    if (target.classList.contains('expand-btn')) {
        const container = videoGrid.querySelector(`.video-container[data-player-id="${playerId}"]`);
        if (!container) return;

        const currentlyExpanded = videoGrid.querySelector('.video-container.expanded');
        // Se outro está expandido, fecha-o primeiro
        if (currentlyExpanded && currentlyExpanded !== container) {
            collapseContainer(currentlyExpanded);
        }

        if (container.classList.contains('expanded')) {
            collapseContainer(container);
        } else {
            // salva referência ao próximo irmão para restaurar a posição depois
            const next = container.nextElementSibling;
            container.dataset.nextSiblingId = next ? next.dataset.playerId : '';
            // move para topo para ocupar toda a largura
            videoGrid.prepend(container);
            container.classList.add('expanded');
            const expBtn = container.querySelector('.expand-btn');
            if (expBtn) expBtn.innerHTML = '⤡';
            container.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
        return;
    }

    // Controle de Remover Vídeo
    if (target.classList.contains('remove-btn')) {
        const container = videoGrid.querySelector(`.video-container[data-player-id="${playerId}"]`);
        if (container) container.remove();
        // Remove o player do array para não ser mais controlado
        players = players.filter(p => p.id !== playerId);
    }
}

/**
 * Silencia todos os vídeos.
 */
function muteAll() {
    players.forEach(p => {
        p.instance.mute();
        p.muted = true;
        // Atualiza o ícone individual
        const btn = videoGrid.querySelector(`.mute-toggle-btn[data-player-id="${p.id}"]`);
        if (btn) btn.innerHTML = '🔈';
    });
}

/**
 * Ativa o som de todos os vídeos.
 */
function unmuteAll() {
    players.forEach(p => {
        p.instance.unMute();
        p.muted = false;
        // Atualiza o ícone individual
        const btn = videoGrid.querySelector(`.mute-toggle-btn[data-player-id="${p.id}"]`);
        if(btn) btn.innerHTML = '🔊';
    });
}

// ----------------- EVENT LISTENERS -----------------
addVideoBtn.addEventListener('click', handleAddVideoClick);
videoUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleAddVideoClick();
    }
});
videoGrid.addEventListener('click', handleVideoGridClick);
muteAllBtn.addEventListener('click', muteAll);
unmuteAllBtn.addEventListener('click', unmuteAll);

// Lives modal listeners — attach after DOMContentLoaded and add delegation fallback
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (openLivesBtn) openLivesBtn.addEventListener('click', () => { console.log('open-lives-btn clicked'); openLivesModal(); });
        if (closeLivesBtn) closeLivesBtn.addEventListener('click', closeLivesModal);
        const closeFooter = document.getElementById('close-lives-btn-footer');
        if (closeFooter) closeFooter.addEventListener('click', closeLivesModal);
        if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', () => {
            const key = apiKeyInput.value.trim();
            if (key) {
                localStorage.setItem('YT_API_KEY', key);
                livesError.style.display = 'none';
                fetchLives();
            }
        });
        if (refreshLivesBtn) refreshLivesBtn.addEventListener('click', fetchLives);
    } catch (err) {
        console.error('Error attaching Lives modal listeners', err);
    }
});

// Delegation fallback: if the button exists but initial listener failed, handle clicks at document level
document.addEventListener('click', (e) => {
    const t = e.target;
    if (t && (t.id === 'open-lives-btn' || t.closest && t.closest('#open-lives-btn'))) {
        console.log('Delegated open-lives-btn click');
        openLivesModal();
    }
});



// Fecha um container expandido e restaura posição anterior (se possível)
function collapseContainer(container) {
    if (!container || !container.classList.contains('expanded')) return;
    container.classList.remove('expanded');
    const nextId = container.dataset.nextSiblingId;
    if (nextId) {
        const nextElem = videoGrid.querySelector(`.video-container[data-player-id="${nextId}"]`);
        if (nextElem) {
            videoGrid.insertBefore(container, nextElem);
        } else {
            videoGrid.appendChild(container);
        }
    } else {
        videoGrid.appendChild(container);
    }
    const expBtn = container.querySelector('.expand-btn');
    if (expBtn) expBtn.innerHTML = '⤢';
}

// Fecha expandidos com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const expanded = document.querySelector('.video-container.expanded');
        if (expanded) collapseContainer(expanded);
    }
});
