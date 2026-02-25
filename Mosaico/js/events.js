import { getYouTubeVideoId, addVideo, players, setPlayers } from './youtube_player.js';
import { saveState } from './state.js';

/**
 * Anexa todos os event listeners principais da aplicação.
 */
export function initEventListeners() {
    const videoUrlInput = document.getElementById('video-url');
    const addVideoBtn = document.getElementById('add-video-btn');
    const videoGrid = document.getElementById('video-grid');
    const muteAllBtn = document.getElementById('mute-all-btn');
    const unmuteAllBtn = document.getElementById('unmute-all-btn');

    addVideoBtn.addEventListener('click', handleAddVideoClick);
    videoUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddVideoClick();
    });
    videoGrid.addEventListener('click', handleVideoGridClick);
    muteAllBtn.addEventListener('click', muteAll);
    unmuteAllBtn.addEventListener('click', unmuteAll);
    document.addEventListener('keydown', handleEscKey);
}

/**
 * Manipula o clique no botão "Adicionar Vídeo".
 */
function handleAddVideoClick() {
    const videoUrlInput = document.getElementById('video-url');
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
 * Manipula cliques na grade de vídeos, usando delegação de eventos.
 * @param {Event} e O objeto do evento de clique.
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
            target.innerHTML = '🔊';
        } else {
            playerWrapper.instance.mute();
            target.innerHTML = '🔈';
        }
        playerWrapper.muted = !playerWrapper.muted;
    }

    // Botão 'Assistir no YouTube'
    if (target.classList.contains('watch-btn')) {
        window.open(`https://www.youtube.com/watch?v=${playerWrapper.videoId}`, '_blank');
        return;
    }

    // Botão de Expandir/Reduzir
    if (target.classList.contains('expand-btn')) {
        const container = document.querySelector(`.video-container[data-player-id="${playerId}"]`);
        if (!container) return;

        const videoGrid = document.getElementById('video-grid');
        const currentlyExpanded = videoGrid.querySelector('.video-container.expanded');
        
        if (currentlyExpanded && currentlyExpanded !== container) {
            collapseContainer(currentlyExpanded);
        }

        if (container.classList.contains('expanded')) {
            collapseContainer(container);
        } else {
            expandContainer(container);
        }
        return;
    }

    // Controle de Remover Vídeo
    if (target.classList.contains('remove-btn')) {
        const container = document.querySelector(`.video-container[data-player-id="${playerId}"]`);
        if (container) {
            container.remove();
            const updatedPlayers = players.filter(p => p.id !== playerId);
            setPlayers(updatedPlayers);
            saveState();
        }
    }
}

/**
 * Silencia todos os vídeos.
 */
function muteAll() {
    players.forEach(p => {
        if (!p.muted) {
            p.instance.mute();
            p.muted = true;
            const btn = document.querySelector(`.mute-toggle-btn[data-player-id="${p.id}"]`);
            if (btn) btn.innerHTML = '🔈';
        }
    });
}

/**
 * Ativa o som de todos os vídeos.
 */
function unmuteAll() {
    players.forEach(p => {
        if (p.muted) {
            p.instance.unMute();
            p.muted = false;
            const btn = document.querySelector(`.mute-toggle-btn[data-player-id="${p.id}"]`);
            if (btn) btn.innerHTML = '🔊';
        }
    });
}

/**
 * Expande um container de vídeo.
 * @param {HTMLElement} container 
 */
function expandContainer(container) {
    const videoGrid = document.getElementById('video-grid');
    const next = container.nextElementSibling;
    container.dataset.nextSiblingId = next ? next.dataset.playerId : '';
    videoGrid.prepend(container);
    container.classList.add('expanded');
    const expBtn = container.querySelector('.expand-btn');
    if (expBtn) expBtn.innerHTML = '⤡';
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Recolhe um container de vídeo expandido e restaura sua posição.
 * @param {HTMLElement} container 
 */
function collapseContainer(container) {
    if (!container || !container.classList.contains('expanded')) return;
    
    const videoGrid = document.getElementById('video-grid');
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

/**
 * Manipula a tecla 'Escape' para fechar modais ou vídeos expandidos.
 * @param {KeyboardEvent} e 
 */
function handleEscKey(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('tools-modal');
        const expanded = document.querySelector('.video-container.expanded');

        if (modal && modal.style.display === 'flex') {
            modal.style.display = 'none';
        } else if (expanded) {
            collapseContainer(expanded);
        }
    }
}