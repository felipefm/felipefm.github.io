
import { injectExtraStyles, createToolsUI } from './dom_elements.js';
import { saveState } from './state.js';
import { addVideo, setPlayers, resetPlayerIdCounter } from './youtube_player.js';


// 2. Inicialização e UI
export function initExtraFeatures() {
    injectExtraStyles();
    createToolsUI();
    setupToolsLogic();
    // loadState() foi movido para onYouTubeIframeAPIReady para garantir que a API seja carregada primeiro.
}

export function setupToolsLogic() {
    const modal = document.getElementById('tools-modal');
    const openBtn = document.getElementById('tools-btn');
    const closeBtn = document.getElementById('close-tools-btn');
    
    openBtn.addEventListener('click', () => { modal.style.display = 'flex'; renderPresets(); renderFavorites(); });
    closeBtn.addEventListener('click', () => modal.style.display = 'none');

    // Fecha o modal ao clicar fora da área de conteúdo
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
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
            const videoGrid = document.getElementById('video-grid');
            videoGrid.className = 'video-grid ' + btn.dataset.layout; // Reseta e aplica classe
            modal.style.display = 'none';
        });
    });

    // --- Favorites Logic ---
    document.getElementById('add-fav-btn').addEventListener('click', async () => {
        const input = document.getElementById('fav-channel-id').value.trim();
        if (!input) return;

        const btn = document.getElementById('add-fav-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Buscando...';
        btn.disabled = true;

        try {
            // Usa o novo endpoint do backend para validar o canal e obter os detalhes
            const res = await fetch(`http://192.168.0.6:8000/get-channel-details/${encodeURIComponent(input)}`);
            
            if (!res.ok) {
                if (res.status === 404) {
                    alert('Canal não encontrado. Verifique o ID ou o @handle.');
                } else {
                    alert(`Erro ao contatar a API local: ${res.statusText}`);
                }
                return;
            }

            const data = await res.json();

            const newFav = {
                id: data.id,
                title: data.title
            };

            const favs = JSON.parse(localStorage.getItem('mosaico_favorites') || '[]');
            const exists = favs.some(f => (typeof f === 'string' ? f === newFav.id : f.id === newFav.id));
            
            if (!exists) {
                favs.push(newFav);
                localStorage.setItem('mosaico_favorites', JSON.stringify(favs));
                renderFavorites();
            }
            document.getElementById('fav-channel-id').value = '';

        } catch (err) {
            console.error(err);
            alert('Erro ao conectar com a API local. Verifique se o backend está rodando.');
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

    // Delegação de evento para remover favoritos
    document.getElementById('favs-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-fav-btn')) {
            const idToRemove = e.target.dataset.favId;
            let favs = JSON.parse(localStorage.getItem('mosaico_favorites') || '[]');
            favs = favs.filter(f => (typeof f === 'string' ? f : f.id) !== idToRemove);
            localStorage.setItem('mosaico_favorites', JSON.stringify(favs));
            renderFavorites();
        }
    });
}

function renderPresets() {
    const list = document.getElementById('presets-list');
    const presets = JSON.parse(localStorage.getItem('mosaico_presets') || '{}');
    const videoGrid = document.getElementById('video-grid');
    list.innerHTML = '';
    Object.keys(presets).forEach(name => {
        const div = document.createElement('div');
        div.className = 'preset-item';
        div.innerHTML = `<span>${name} (${presets[name].length} vídeos)</span>`;
        
        const loadBtn = document.createElement('button');
        loadBtn.className = 'tool-btn primary';
        loadBtn.textContent = 'Carregar';
        loadBtn.onclick = () => {
            videoGrid.innerHTML = ''; 
            setPlayers([]);
            resetPlayerIdCounter();

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
        const title = typeof item === 'string' ? 'Canal ' + item : item.title;

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
                <button class="tool-btn danger remove-fav-btn" data-fav-id="${id}">X</button>
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

/**
 * Processa os resultados da verificação de lives de forma gradual para animar a barra de progresso.
 * @param {Array} results - Os resultados da API.
 * @param {Array<string>} channelIds - IDs dos canais a serem processados.
 * @param {object} cache - O objeto de cache para ser atualizado.
 * @param {number} now - O timestamp da verificação.
 * @returns {Promise<void>}
 */
function processFavoritesGradually(results, channelIds, cache, now) {
    const progressBar = document.getElementById('favs-progress-bar');

    return new Promise(resolve => {
        const returnedChannels = new Map(results.map(c => [c.channel_name, c]));
        const liveChannels = new Map(results.filter(c => c.is_live).map(c => [c.channel_name, c]));
        const total = channelIds.length;

        function processOne(index) {
            if (index >= total) {
                resolve();
                return;
            }

            const channelId = channelIds[index];
            const domItem = document.querySelector(`.fav-item[data-channel-id="${channelId}"]`);
            
            if (domItem) {
                const badge = domItem.querySelector('.live-badge');
                const existingBtn = domItem.querySelector('.watch-fav-btn');
                if (existingBtn) existingBtn.remove();

                if (!returnedChannels.has(channelId)) {
                    cache[channelId] = { isLive: false, videoId: null, timestamp: now, status: 'mismatch' };
                    if (badge) {
                        badge.textContent = 'VERIFICAR';
                        badge.style.backgroundColor = '#ff9800';
                        badge.classList.add('on');
                    }
                } else {
                    const liveData = liveChannels.get(channelId);
                    if (liveData) {
                        cache[channelId] = { isLive: true, videoId: liveData.video_id, timestamp: now };
                        if (badge) {
                            badge.textContent = 'AO VIVO';
                            badge.style.backgroundColor = '';
                            badge.classList.add('on');
                        }
                        const watchBtn = document.createElement('button');
                        watchBtn.className = 'tool-btn primary watch-fav-btn';
                        watchBtn.textContent = 'Assistir';
                        watchBtn.style.marginLeft = '10px';
                        watchBtn.onclick = () => { addVideo(liveData.video_id); document.getElementById('tools-modal').style.display = 'none'; };
                        const statusRow = domItem.querySelector('.fav-status-row');
                        if (statusRow) statusRow.appendChild(watchBtn);
                    } else {
                        cache[channelId] = { isLive: false, videoId: null, timestamp: now };
                        if (badge) badge.classList.remove('on');
                    }
                }
            }

            const progress = Math.round(((index + 1) / total) * 100);
            progressBar.style.width = `${progress}%`;
            progressBar.textContent = `${progress}%`;

            // Pausa de 50ms para permitir que a UI seja atualizada, criando a animação.
            setTimeout(() => processOne(index + 1), 50);
        }

        processOne(0);
    });
}

async function checkFavoritesLive() {
    const favs = JSON.parse(localStorage.getItem('mosaico_favorites') || '[]');
    if (favs.length === 0) return;

    const btn = document.getElementById('check-favs-btn');
    const progressContainer = document.getElementById('favs-progress-container');
    const progressBar = document.getElementById('favs-progress-bar');

    btn.textContent = 'Verificando...';
    btn.disabled = true;
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';

    const cache = JSON.parse(localStorage.getItem('mosaico_favorites_cache') || '{}');
    const now = Date.now();
    
    const favsMap = new Map(favs.map(item => {
        const id = typeof item === 'string' ? item : item.id;
        return [id, item];
    }));
    const channelIds = [...favsMap.keys()];

    try {
        const res = await fetch('http://192.168.0.6:8000/check-live-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_ids: channelIds }),
        });

        if (!res.ok) {
            throw new Error(`API em lote falhou com status: ${res.status}`);
        }

        const results = await res.json();

        // Aguarda o processamento gradual para dar um efeito visual à barra de progresso.
        await processFavoritesGradually(results, channelIds, cache, now);

    } catch (e) {
        console.error('Erro ao verificar canais em lote:', e);
        // Em caso de falha total da API, marca todos com erro para feedback
        channelIds.forEach(channelId => {
            const domItem = document.querySelector(`.fav-item[data-channel-id="${channelId}"]`);
            if (domItem) {
                const badge = domItem.querySelector('.live-badge');
                if (badge) {
                    badge.textContent = "ERRO API";
                    badge.style.backgroundColor = '#f44336'; // Vermelho para erro de API
                    badge.classList.add('on');
                }
            }
        });
    } finally {
        localStorage.setItem('mosaico_favorites_cache', JSON.stringify(cache));
        
        // Aguarda um pouco para o usuário ver o 100% antes de esconder
        setTimeout(() => {
            progressContainer.style.display = 'none';
            btn.textContent = 'Verificar Lives Agora';
            btn.disabled = false;
        }, 1000);
    }
}


