
import { loadState, saveState } from './state.js';
import { createVideoOverlay } from './dom_elements.js';
import { setupDragEvents } from './drag_drop.js';

// ----------------- GLOBAL STATE -----------------
export let players = [];
let nextPlayerId = 0;

export function resetPlayerIdCounter() {
    nextPlayerId = 0;
}

// ----------------- YOUTUBE API BOILERPLATE -----------------
export function loadYouTubeAPI() {
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
}


/**
 * Esta função é chamada automaticamente pela API do YouTube quando o código do player está pronto.
 * É o ponto de entrada para carregar o estado salvo e inicializar os players.
 */
window.onYouTubeIframeAPIReady = function() {
    loadState();
}

/**
 * Exibe um aviso no console e, opcionalmente, na UI sobre falha de CSP.
 */
function showCSPWarning() {
    console.warn(
        'A API do YouTube não pôde ser carregada. ' +
        'Isso geralmente é causado por restrições de Content Security Policy (CSP) em ambientes de extensão. ' +
        'O aplicativo usará um modo de fallback com iframes simples, mas algumas funcionalidades como o status "AO VIVO" não funcionarão.'
    );
    // Opcional: Adicionar um aviso na UI
    if (!document.getElementById('csp-warning')) {
        const warningDiv = document.createElement('div');
        warningDiv.id = 'csp-warning';
        warningDiv.textContent = 'Aviso: API do YouTube bloqueada. Funcionalidade limitada.';
        warningDiv.style.backgroundColor = '#ffc107';
        warningDiv.style.color = 'black';
        warningDiv.style.textAlign = 'center';
        warningDiv.style.padding = '5px';
        document.body.prepend(warningDiv);
    }
}

/**
 * Marca um contêiner de vídeo com um estado de erro visual.
 * @param {number} playerId - O ID do player que encontrou um erro.
 */
export function showPlayerError(playerId) {
    console.error(`Erro no player com ID: ${playerId}. Verifique o ID do vídeo ou problemas de rede/permissão.`);
    const container = document.querySelector(`.video-container[data-player-id="${playerId}"]`);
    if (container) {
        container.classList.add('player-error');
        // Adiciona uma mensagem de erro no overlay
        const overlay = container.querySelector('.video-overlay');
        if (overlay && !overlay.querySelector('.error-message')) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = 'Erro ao carregar';
            overlay.appendChild(errorMsg);
        }
    }
}

/**
 * Extrai o ID do vídeo de uma URL do YouTube.
 * @param {string} url - A URL do YouTube.
 * @returns {string|null} - O ID do vídeo ou nulo se não for encontrado.
 */
export function getYouTubeVideoId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}


/**
 * Cria um novo player de vídeo e o adiciona à grade.
 * @param {string} videoId - O ID do vídeo do YouTube.
 * @param {boolean} save - Se deve salvar o estado após adicionar (padrão: true).
 */
export function addVideo(videoId, save = true) {
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
    const videoGrid = document.getElementById('video-grid');
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
 * Atualiza o badge visual (Ao Vivo vs Gravado) com base nos dados do player.
 */
export function updateVideoStatus(player, playerId) {
    const container = document.querySelector(`.video-container[data-player-id="${playerId}"]`);
    if (!container) return;

    const badge = container.querySelector('.video-status');
    if (!badge) return;

    // getVideoData retorna metadados, incluindo isLive (booleano)
    // Nota: isLive é true para transmissões ativas. Se acabou, vira false.
    let isLive = false;
    let statusKnown = false;

    try {
        // Garante que o método existe (não existe em iframes de fallback)
        if (player && typeof player.getVideoData === 'function') {
            const data = player.getVideoData();
            // Verifica se a propriedade isLive existe (pode ser boolean ou undefined)
            if (data && typeof data.isLive !== 'undefined') {
                isLive = data.isLive;
                statusKnown = true;
            }
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


/**
 * Chamado quando um player está pronto para tocar.
 * Silencia o vídeo por padrão.
 * @param {object} event - O objeto de evento da API do YouTube.
 * @param {number} playerId - O ID do nosso player.
 */
export function onPlayerReady(event, playerId) {
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
export function onPlayerStateChange(event, playerId) {
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
export function onPlayerError(event, playerId) {
    showPlayerError(playerId);
    // Esconde o badge se der erro, para não mostrar "GRAVADO" incorretamente
    const container = document.querySelector(`.video-container[data-player-id="${playerId}"]`);
    if (container) {
        const badge = container.querySelector('.video-status');
        if (badge) badge.style.display = 'none';
    }
}

export function setPlayers(newPlayers) {
    players = newPlayers;
}
