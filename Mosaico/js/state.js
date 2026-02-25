
import { addVideo, players } from './youtube_player.js';

export function saveState() {
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

export function loadState() {
    const state = JSON.parse(localStorage.getItem('mosaico_state') || '[]');
    // Carrega os vídeos sem salvar a cada inserção (save=false) para performance
    state.forEach(vid => addVideo(vid, false));
}
