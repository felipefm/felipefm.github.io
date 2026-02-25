
/**
 * Cria o overlay com os controles para um vídeo.
 * @param {number} playerId - O ID único do player no nosso array.
 * @returns {HTMLElement} - O elemento do overlay.
 */
export function createVideoOverlay(playerId) {
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

export function injectExtraStyles() {
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

    /* Barra de Progresso */
    #favs-progress-container {
        width: 100%;
        background-color: #555;
        border-radius: 4px;
        margin-bottom: 10px;
        overflow: hidden;
    }
    #favs-progress-bar {
        height: 20px; background-color: #4CAF50; color: white; text-align: center;
        line-height: 20px; transition: width 0.3s ease-in-out;
    }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}

export function createToolsUI() {
    // Botão na barra superior
    const toolsBtn = document.createElement('button');
    toolsBtn.id = 'tools-btn';
    toolsBtn.textContent = 'Mosaico+';
    const audioControls = document.querySelector('.global-audio-controls');
    if (audioControls) {
        audioControls.appendChild(toolsBtn);
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
                <div id="favs-progress-container" style="display: none;">
                    <div id="favs-progress-bar" style="width: 0%;">0%</div>
                </div>
                <div id="favs-list"></div>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
