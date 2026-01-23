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

let isStateLoaded = false; // Flag para evitar carregamento duplo
/**
 * Chamada quando a API do YouTube está pronta.
 * Não precisamos fazer nada aqui no início, mas a função precisa existir.
 */
function onYouTubeIframeAPIReady() {
    console.log("API do YouTube pronta.");
    // Carrega os vídeos salvos agora que a API (YT.Player) está garantida
    if (!isStateLoaded) {
        loadState();
        isStateLoaded = true;
    }
}

function showCSPWarning() {
    const warn = document.getElementById('csp-warning');
    if (warn) {
        warn.style.display = 'block';
        warn.textContent = "Aviso: não foi possível carregar a API do YouTube (CSP). A extensão usará um fallback via iframes; os controles de mudo devem funcionar, mas funcionalidades avançadas podem ficar limitadas.";
    }
}

// Fallback de segurança: se a API do YouTube demorar ou falhar, carrega os vídeos mesmo assim
setTimeout(() => { 
    if (!window.YT && !isStateLoaded) {
        showCSPWarning();
        loadState(); 
        isStateLoaded = true;
    }
}, 2000);

// ----------------- Lives (YouTube search) -----------------
function openLivesModal() {
    console.log('openLivesModal()');
    // populate api key from localStorage if exists
    const saved = localStorage.getItem('YT_API_KEY');
    if (saved) apiKeyInput.value = saved;
    livesError.style.display = 'none';
    if (!livesModal) {
        console.error('livesModal element not found');
        return;
    }
    livesModal.style.display = 'flex';
    // Só busca se a lista estiver vazia para economizar quota (evita re-fetch ao reabrir modal)
    if (livesList.children.length === 0) {
        fetchLives();
    }
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
    const maxPages = 1; // Reduzido para 1 página (50 itens) para economizar quota (cada busca = 100 unidades)
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

// ----------------- DRAG AND DROP -----------------
let dragSrcEl = null;

function setupDragEvents(elem) {
    elem.addEventListener('dragstart', handleDragStart);
    elem.addEventListener('dragover', handleDragOver);
    elem.addEventListener('dragenter', handleDragEnter);
    elem.addEventListener('dragleave', handleDragLeave);
    elem.addEventListener('drop', handleDrop);
    elem.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    this.style.opacity = '0.4'; // Visual feedback
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('over');
}

function handleDragLeave(e) {
    this.classList.remove('over');
}

function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    if (dragSrcEl !== this) {
        const grid = this.parentNode;
        const children = Array.from(grid.children);
        const srcIndex = children.indexOf(dragSrcEl);
        const targetIndex = children.indexOf(this);
        
        if (srcIndex < targetIndex) {
            this.after(dragSrcEl);
        } else {
            this.before(dragSrcEl);
        }
        saveState(); // Salva a nova ordem após arrastar
    }
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    const items = document.querySelectorAll('.video-container');
    items.forEach(item => item.classList.remove('over'));
}

/**
 * Cria um novo player de vídeo e o adiciona à grade.
 * @param {string} videoId - O ID do vídeo do YouTube.
 * @param {boolean} save - Se deve salvar o estado após adicionar (padrão: true).
 */
function addVideo(videoId, save = true) {
    const id = nextPlayerId++;
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.dataset.playerId = id; // usado para localizar e mover o container

    // Habilita Drag and Drop
    videoContainer.setAttribute('draggable', true);
    setupDragEvents(videoContainer);

    const playerDiv = document.createElement('div');
    const playerDomId = `player-${id}`;
    playerDiv.id = playerDomId;
    playerDiv.style.width = '100%';
    playerDiv.style.height = '100%';

    const overlay = createVideoOverlay(id);
    
    // Cria o badge de status (Ao Vivo / Gravado)
    const statusBadge = document.createElement('div');
    statusBadge.className = 'video-status';
    videoContainer.appendChild(statusBadge);

    videoContainer.appendChild(playerDiv);
    videoContainer.appendChild(overlay);
    videoGrid.appendChild(videoContainer);

    // Se a API do YouTube estiver disponível, usa YT.Player. Senão, cria um iframe de fallback.
    let player;
    if (window.YT && YT.Player) {
        const playerVars = {
            'autoplay': 1,
            'controls': 0,
            'modestbranding': 1,
            'rel': 0
        };
        // Adiciona origin se estiver em http/https para evitar erros de CORS/Embed
        if (window.location.protocol.startsWith('http')) {
            playerVars.origin = window.location.origin;
        }

        player = new YT.Player(playerDomId, {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: playerVars,
            events: {
                'onReady': (event) => onPlayerReady(event, id),
                'onStateChange': (event) => onPlayerStateChange(event, id),
                'onError': (event) => onPlayerError(event, id)
            }
        });

        // Correção para erros de "Violation" e Autoplay:
        // A API cria o iframe, mas às vezes sem as permissões completas. Vamos forçar.
        const generatedIframe = player.getIframe();
        if (generatedIframe) {
            // Remove atributo legado para evitar aviso no console, pois já usamos 'allow="... fullscreen ..."'
            generatedIframe.removeAttribute('allowfullscreen');
            generatedIframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write; accelerometer; gyroscope');
        }

        players.push({ id: id, instance: player, muted: true, videoId: videoId });
    } else {
        console.warn('YT.Player não disponível — usando iframe de fallback');
        const iframe = document.createElement('iframe');
        // adiciona origin para melhorar compatibilidade com enablejsapi
        let originParam = '';
        try {
            if (window.location.protocol.startsWith('http')) {
                originParam = `&origin=${encodeURIComponent(window.location.origin)}`;
            } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
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

    // Salva o estado atual (se não estivermos carregando um backup)
    if (save) saveState();
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

/**
 * Atualiza o badge visual (Ao Vivo vs Gravado) com base nos dados do player.
 */
function updateVideoStatus(player, playerId) {
    const container = document.querySelector(`.video-container[data-player-id="${playerId}"]`);
    if (!container) return;
    
    const badge = container.querySelector('.video-status');
    if (!badge) return;

    // getVideoData retorna metadados, incluindo isLive (booleano)
    // Nota: isLive é true para transmissões ativas. Se acabou, vira false.
    let isLive = false;
    let statusKnown = false;

    try {
        if (typeof player.getVideoData !== 'function') return;
        const data = player.getVideoData();
        // Verifica se a propriedade isLive existe (pode ser boolean ou undefined)
        if (data && typeof data.isLive !== 'undefined') {
            isLive = data.isLive;
            statusKnown = true;
        }
    } catch(e) { console.warn(e); }

    if (isLive) {
        container.dataset.wasLive = 'true'; // Marca que detectamos como live
        badge.textContent = 'AO VIVO';
        badge.className = 'video-status status-live';
        badge.style.display = ''; // Garante que o CSS da classe (display: block) funcione
    } else if (container.dataset.wasLive === 'true') {
        // Só mostra status de gravado/encerrado se sabíamos que era uma live antes
        badge.textContent = 'ENCERRADO';
        badge.className = 'video-status status-recorded';
        badge.style.display = '';
    } else {
        // Vídeos normais ou lives antigas (sem histórico na sessão) ficam sem badge
        badge.style.display = 'none';
    }
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
    // Verifica se é live ou gravado assim que carrega
    updateVideoStatus(event.target, playerId);
}

/**
 * Chamado quando o estado do player muda (ex: terminou, pausou).
 */
function onPlayerStateChange(event, playerId) {
    // Atualiza status em Play (1), Buffer (3), Ended (0) ou Cued (5)
    // Isso garante que peguemos o status 'isLive' assim que os metadados carregarem
    if (event.data === 1 || event.data === 3 || event.data === 0 || event.data === 5) {
        // Re-verifica o status
        updateVideoStatus(event.target, playerId);
    }
}

/**
 * Chamado quando ocorre erro no player.
 */
function onPlayerError(event, playerId) {
    showPlayerError(playerId);
    // Esconde o badge se der erro, para não mostrar "GRAVADO" incorretamente
    const container = document.querySelector(`.video-container[data-player-id="${playerId}"]`);
    if (container) {
        const badge = container.querySelector('.video-status');
        if (badge) badge.style.display = 'none';
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
        saveState(); // Salva o estado após remover
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

        // Inicializa funcionalidades extras (Persistência, Menu Mosaico+, etc)
        initExtraFeatures();
    } catch (err) {
        console.error('Error attaching Lives modal listeners', err);
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

// ----------------- NOVAS FUNCIONALIDADES (Mosaico+) -----------------

// 1. Persistência de Estado
function saveState() {
    const currentVideos = [];
    // Itera sobre o DOM para garantir a ordem visual correta
    const containers = document.querySelectorAll('.video-container');
    containers.forEach(container => {
        const pid = parseInt(container.dataset.playerId, 10);
        const p = players.find(pl => pl.id === pid);
        if (p) currentVideos.push(p.videoId);
    });
    localStorage.setItem('mosaico_state', JSON.stringify(currentVideos));
}

function loadState() {
    const state = JSON.parse(localStorage.getItem('mosaico_state') || '[]');
    // Carrega os vídeos sem salvar a cada inserção (save=false) para performance
    state.forEach(vid => addVideo(vid, false));
}

// 2. Inicialização e UI
function initExtraFeatures() {
    injectExtraStyles();
    createToolsUI();
    // loadState() removido daqui e movido para onYouTubeIframeAPIReady para garantir uso da API
}

function injectExtraStyles() {
    const css = `
    /* Layouts Inteligentes */
    .layout-grid-2x2 {
        display: grid !important;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        height: calc(100vh - 80px);
        overflow: hidden;
    }
    .layout-grid-2x2 .video-container { width: 100% !important; height: 100% !important; margin: 0 !important; }
    
    .layout-focus {
        display: grid !important;
        grid-template-columns: 3fr 1fr;
        grid-template-rows: repeat(3, 1fr);
        height: calc(100vh - 80px);
        overflow: hidden;
    }
    .layout-focus .video-container { width: 100% !important; height: 100% !important; margin: 0 !important; }
    .layout-focus .video-container:first-child { grid-row: 1 / -1; grid-column: 1 / 2; }
    .layout-focus .video-container:not(:first-child) { grid-column: 2 / 3; }

    /* Botão Mosaico+ */
    #tools-btn {
        background-color: #4CAF50; color: white; border: none; padding: 8px 15px;
        margin-left: 10px; cursor: pointer; border-radius: 4px; font-weight: bold;
    }
    #tools-btn:hover { background-color: #45a049; }

    /* Modal Mosaico+ */
    .tools-modal {
        display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 3000; justify-content: center; align-items: center;
    }
    .tools-content {
        background: #222; color: #eee; padding: 20px; border-radius: 8px;
        width: 600px; max-width: 95%; max-height: 90vh; overflow-y: auto;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    }
    .tools-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .tools-tabs { display: flex; border-bottom: 1px solid #444; margin-bottom: 15px; }
    .tools-tab {
        padding: 10px 20px; cursor: pointer; background: transparent; border: none;
        color: #aaa; font-weight: bold; font-size: 14px;
    }
    .tools-tab.active { color: #fff; border-bottom: 3px solid #4CAF50; }
    .tools-panel { display: none; }
    .tools-panel.active { display: block; }
    
    .preset-item, .fav-item {
        background: #333; padding: 10px; margin-bottom: 8px; border-radius: 4px;
        display: flex; justify-content: space-between; align-items: center;
    }
    .tool-btn {
        padding: 5px 10px; cursor: pointer; background: #555; color: white;
        border: none; border-radius: 4px; margin-left: 5px;
    }
    .tool-btn.danger { background: #d32f2f; }
    .tool-btn.primary { background: #1976D2; }
    .tool-input { padding: 8px; border-radius: 4px; border: 1px solid #555; background: #333; color: white; width: 70%; }
    .live-badge {
        background: #f00; color: white; padding: 2px 6px; border-radius: 3px;
        font-size: 10px; text-transform: uppercase; font-weight: bold; margin-left: 8px;
        display: none;
    }
    .live-badge.on { display: inline-block; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}

function createToolsUI() {
    // Botão na barra superior
    const toolsBtn = document.createElement('button');
    toolsBtn.id = 'tools-btn';
    toolsBtn.textContent = 'Mosaico+';
    if (openLivesBtn && openLivesBtn.parentNode) {
        openLivesBtn.parentNode.insertBefore(toolsBtn, openLivesBtn.nextSibling);
    }
    
    // Modal
    const modalHtml = `
    <div id="tools-modal" class="tools-modal">
        <div class="tools-content">
            <div class="tools-header">
                <h2>Ferramentas Mosaico+</h2>
                <button id="close-tools-btn" class="tool-btn">Fechar</button>
            </div>
            <div class="tools-tabs">
                <button class="tools-tab active" data-tab="presets">Presets</button>
                <button class="tools-tab" data-tab="layouts">Layouts</button>
                <button class="tools-tab" data-tab="favorites">Favoritos</button>
            </div>
            
            <!-- Presets Panel -->
            <div id="panel-presets" class="tools-panel active">
                <div style="margin-bottom: 15px; display: flex; gap: 10px;">
                    <input type="text" id="preset-name" class="tool-input" placeholder="Nome do grupo (ex: Notícias)">
                    <button id="save-preset-btn" class="tool-btn primary">Salvar Atual</button>
                </div>
                <div id="presets-list"></div>
            </div>

            <!-- Layouts Panel -->
            <div id="panel-layouts" class="tools-panel">
                <p>Escolha como os vídeos são organizados na tela:</p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="tool-btn layout-btn" data-layout="">Automático (Flex)</button>
                    <button class="tool-btn layout-btn" data-layout="layout-grid-2x2">Grade 2x2 Fixa</button>
                    <button class="tool-btn layout-btn" data-layout="layout-focus">Foco (1 Grande + 3 Pequenos)</button>
                </div>
            </div>

            <!-- Favorites Panel -->
            <div id="panel-favorites" class="tools-panel">
                <div style="margin-bottom: 15px; display: flex; gap: 10px;">
                    <input type="text" id="fav-channel-id" class="tool-input" placeholder="ID (UC...) ou Handle (@canal)">
                    <button id="add-fav-btn" class="tool-btn primary">Adicionar</button>
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <button id="export-favs-btn" class="tool-btn" style="flex: 1;">Exportar</button>
                    <button id="import-favs-btn" class="tool-btn" style="flex: 1;">Importar</button>
                </div>
                <button id="check-favs-btn" class="tool-btn" style="width:100%; margin-bottom:10px;">Verificar Lives Agora</button>
                <div id="favs-list"></div>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setupToolsLogic();
}

function setupToolsLogic() {
    const modal = document.getElementById('tools-modal');
    const openBtn = document.getElementById('tools-btn');
    const closeBtn = document.getElementById('close-tools-btn');
    
    openBtn.addEventListener('click', () => { modal.style.display = 'flex'; renderPresets(); renderFavorites(); });
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    
    // Tabs
    document.querySelectorAll('.tools-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tools-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tools-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // --- Presets Logic ---
    const savePresetBtn = document.getElementById('save-preset-btn');
    savePresetBtn.addEventListener('click', () => {
        const name = document.getElementById('preset-name').value.trim();
        if (!name) return alert('Digite um nome para o preset.');
        const currentVideos = JSON.parse(localStorage.getItem('mosaico_state') || '[]');
        if (currentVideos.length === 0) return alert('Adicione vídeos antes de salvar.');
        
        const presets = JSON.parse(localStorage.getItem('mosaico_presets') || '{}');
        presets[name] = currentVideos;
        localStorage.setItem('mosaico_presets', JSON.stringify(presets));
        document.getElementById('preset-name').value = '';
        renderPresets();
    });

    // --- Layouts Logic ---
    document.querySelectorAll('.layout-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            videoGrid.className = 'video-grid ' + btn.dataset.layout; // Reseta e aplica classe
            modal.style.display = 'none';
        });
    });

    // --- Favorites Logic ---
    document.getElementById('add-fav-btn').addEventListener('click', async () => {
        const input = document.getElementById('fav-channel-id').value.trim();
        if (!input) return;

        const apiKey = localStorage.getItem('YT_API_KEY');
        if (!apiKey) return alert('Configure a API Key na aba de Lives para adicionar favoritos.');

        const btn = document.getElementById('add-fav-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Buscando...';
        btn.disabled = true;

        let channelId = null;
        let handle = null;

        // Lógica para extrair ID ou Handle
        const idMatch = input.match(/\/channel\/(UC[^/?&]+)/);
        if (idMatch) {
            channelId = idMatch[1];
        } else if (input.includes('@')) {
            const match = input.match(/@([^/?&]+)/);
            if (match) handle = '@' + match[1];
        } else if (input.startsWith('UC') && input.length > 15) {
            channelId = input;
        } else {
            handle = '@' + input;
        }

        try {
            let url;
            if (channelId) {
                url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,id&id=${channelId}&key=${apiKey}`;
            } else {
                url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
            }

            const res = await fetch(url);
            const data = await res.json();

            if (data.items && data.items.length > 0) {
                const item = data.items[0];
                const newFav = {
                    id: item.id,
                    title: item.snippet.title
                };

                const favs = JSON.parse(localStorage.getItem('mosaico_favorites') || '[]');
                // Verifica duplicidade (suporta formato antigo string e novo objeto)
                const exists = favs.some(f => (typeof f === 'string' ? f === newFav.id : f.id === newFav.id));
                
                if (!exists) {
                    favs.push(newFav);
                    localStorage.setItem('mosaico_favorites', JSON.stringify(favs));
                    renderFavorites();
                }
                document.getElementById('fav-channel-id').value = '';
            } else {
                alert('Canal não encontrado.');
            }
        } catch (err) {
            console.error(err);
            alert('Erro: ' + err.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    // --- Export Favorites ---
    document.getElementById('export-favs-btn').addEventListener('click', () => {
        const favs = localStorage.getItem('mosaico_favorites') || '[]';
        const blob = new Blob([favs], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "mosaico_favoritos.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // --- Import Favorites ---
    document.getElementById('import-favs-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (!Array.isArray(imported)) throw new Error('Formato inválido');
                    
                    const current = JSON.parse(localStorage.getItem('mosaico_favorites') || '[]');
                    let count = 0;
                    imported.forEach(item => {
                        const id = typeof item === 'string' ? item : item.id;
                        const exists = current.some(c => (typeof c === 'string' ? c : c.id) === id);
                        if (!exists) { current.push(item); count++; }
                    });
                    
                    localStorage.setItem('mosaico_favorites', JSON.stringify(current));
                    renderFavorites();
                    alert(`${count} favoritos importados com sucesso!`);
                } catch (err) { alert('Erro ao importar: ' + err.message); }
            };
            reader.readAsText(file);
        };
        input.click();
    });

    document.getElementById('check-favs-btn').addEventListener('click', checkFavoritesLive);
}

function renderPresets() {
    const list = document.getElementById('presets-list');
    const presets = JSON.parse(localStorage.getItem('mosaico_presets') || '{}');
    list.innerHTML = '';
    Object.keys(presets).forEach(name => {
        const div = document.createElement('div');
        div.className = 'preset-item';
        div.innerHTML = `<span>${name} (${presets[name].length} vídeos)</span>`;
        
        const loadBtn = document.createElement('button');
        loadBtn.className = 'tool-btn primary';
        loadBtn.textContent = 'Carregar';
        loadBtn.onclick = () => {
            videoGrid.innerHTML = ''; players = []; // Limpa tudo
            presets[name].forEach(vid => addVideo(vid, false));
            saveState();
            document.getElementById('tools-modal').style.display = 'none';
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'tool-btn danger';
        delBtn.textContent = 'X';
        delBtn.onclick = () => {
            delete presets[name];
            localStorage.setItem('mosaico_presets', JSON.stringify(presets));
            renderPresets();
        };

        const actions = document.createElement('div');
        actions.append(loadBtn, delBtn);
        div.appendChild(actions);
        list.appendChild(div);
    });
}

function renderFavorites() {
    const list = document.getElementById('favs-list');
    const favs = JSON.parse(localStorage.getItem('mosaico_favorites') || '[]');
    const cache = JSON.parse(localStorage.getItem('mosaico_favorites_cache') || '{}');
    const now = Date.now();

    list.innerHTML = '';
    favs.forEach(item => {
        const id = typeof item === 'string' ? item : item.id;
        const title = typeof item === 'string' ? item : item.title;

        let isLive = false;
        let videoId = null;
        if (cache[id] && (now - cache[id].timestamp < 3600000)) { // 1 hora de cache
            isLive = cache[id].isLive;
            videoId = cache[id].videoId;
        }

        const div = document.createElement('div');
        div.className = 'fav-item';
        div.dataset.channelId = id;
        div.innerHTML = `
            <div style="display:flex; flex-direction:column; flex:1;">
                <span style="font-weight:bold;">${title}</span>
                <div class="fav-status-row" style="display:flex; align-items:center; gap:5px; font-size:0.8em; color:#aaa;">
                    <span>${id}</span> <span class="live-badge ${isLive ? 'on' : ''}">AO VIVO</span>
                </div>
            </div>
            <div>
                <button class="tool-btn danger" onclick="removeFavorite('${id}')">X</button>
            </div>`;

        if (isLive && videoId) {
            const row = div.querySelector('.fav-status-row');
            const watchBtn = document.createElement('button');
            watchBtn.className = 'tool-btn primary watch-fav-btn';
            watchBtn.textContent = 'Assistir';
            watchBtn.style.marginLeft = '10px';
            watchBtn.onclick = () => { addVideo(videoId); document.getElementById('tools-modal').style.display = 'none'; };
            row.appendChild(watchBtn);
        }

        list.appendChild(div);
    });
}

window.removeFavorite = function(idToRemove) {
    let favs = JSON.parse(localStorage.getItem('mosaico_favorites') || '[]');
    favs = favs.filter(f => (typeof f === 'string' ? f : f.id) !== idToRemove);
    localStorage.setItem('mosaico_favorites', JSON.stringify(favs));
    renderFavorites();
};

async function checkFavoritesLive() {
    const favs = JSON.parse(localStorage.getItem('mosaico_favorites') || '[]');
    if (favs.length === 0) return;
    
    const apiKey = localStorage.getItem('YT_API_KEY');
    if (!apiKey) return alert('Configure a API Key na aba de Lives primeiro.');

    const btn = document.getElementById('check-favs-btn');
    btn.textContent = 'Verificando...';
    
    const cache = JSON.parse(localStorage.getItem('mosaico_favorites_cache') || '{}');
    const now = Date.now();
    
    for (const item of favs) {
        const channelId = typeof item === 'string' ? item : item.id;
        try {
            // Busca se há vídeo do tipo 'live' para este canal
            const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`);
            const data = await res.json();
            const item = document.querySelector(`.fav-item[data-channel-id="${channelId}"]`);
            
            if (data.items && data.items.length > 0) {
                const videoId = data.items[0].id.videoId;
                cache[channelId] = { isLive: true, videoId: videoId, timestamp: now };

                if (item) {
                    const badge = item.querySelector('.live-badge');
                    badge.classList.add('on');
                    // Adiciona botão de assistir se não existir
                    if (!item.querySelector('.watch-fav-btn')) {
                        const watchBtn = document.createElement('button');
                        watchBtn.className = 'tool-btn primary watch-fav-btn';
                        watchBtn.textContent = 'Assistir';
                        watchBtn.style.marginLeft = '10px';
                        watchBtn.onclick = () => { addVideo(videoId); document.getElementById('tools-modal').style.display = 'none'; };
                        const statusRow = item.querySelector('.fav-status-row');
                        if (statusRow) statusRow.appendChild(watchBtn);
                    }
                }
            } else {
                cache[channelId] = { isLive: false, timestamp: now };
                if (item) {
                    item.querySelector('.live-badge').classList.remove('on');
                    const existingBtn = item.querySelector('.watch-fav-btn');
                    if (existingBtn) existingBtn.remove();
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
    localStorage.setItem('mosaico_favorites_cache', JSON.stringify(cache));
    btn.textContent = 'Verificar Lives Agora';
}
