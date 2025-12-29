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

// ----------------- STATE MANAGEMENT -----------------
let players = []; // Array para armazenar todas as instâncias dos players

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
    const container = document.querySelector(`.video-container:nth-child(${playerId + 1})`);
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
    const playerCount = players.length;
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    
    const playerDiv = document.createElement('div');
    const playerId = `player-${playerCount}`;
    playerDiv.id = playerId;

    const overlay = createVideoOverlay(playerCount);

    videoContainer.appendChild(playerDiv);
    videoContainer.appendChild(overlay);
    videoGrid.appendChild(videoContainer);

    // Se a API do YouTube estiver disponível, usa YT.Player. Senão, cria um iframe de fallback.
    let player;
    if (window.YT && YT.Player) {
        player = new YT.Player(playerId, {
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
                'onReady': (event) => onPlayerReady(event, playerCount),
            }
        });

        players.push({ id: playerCount, instance: player, muted: true, videoId: videoId });
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
        document.getElementById(playerId).appendChild(iframe);

        // Helper para enviar comandos via postMessage (funciona com enablejsapi=1)
        function postCommand(cmd, args = []) {
            try {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: args }), '*');
            } catch (err) {
                console.warn('Falha ao enviar comando para iframe:', err);
                showPlayerError(playerCount);
            }
        }

        // Instância que usa postMessage para controlar o player embutido
        players.push({
            id: playerCount,
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

    controls.appendChild(muteBtn);
    controls.appendChild(watchBtn);
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

    // Controle de Remover Vídeo
    if (target.classList.contains('remove-btn')) {
        playerWrapper.instance.getIframe().parentElement.parentElement.remove();
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
