import { loadYouTubeAPI } from './js/youtube_player.js';
import { initExtraFeatures } from './js/mosaico_plus.js';
import { initEventListeners } from './js/events.js';


/**
 * Ponto de entrada principal da aplicação.
 * Orquestra a inicialização dos módulos.
 */
function main() {
    // Inicializa as funcionalidades do "Mosaico+" (botão, modal, etc.)
    // Isso fará com que o botão "Mosaico+" volte a aparecer.
    initExtraFeatures();

    // Centraliza a configuração de todos os event listeners principais da UI.
    initEventListeners();

    // Carrega a API do YouTube. A função de callback da API (onYouTubeIframeAPIReady)
    // se encarregará de chamar o loadState() para carregar os vídeos salvos.
    loadYouTubeAPI();
}

// Adiciona um listener para quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', main);
