document.addEventListener("DOMContentLoaded", () => {
    // --- Seletores de Elementos DOM ---
    const searchInput = document.getElementById("searchInput");
    const searchButton = document.getElementById("searchButton");
    const searchResultsDiv = document.getElementById("searchResults");
    const manualNameInput = document.getElementById("manualName");
    const manualUrlInput = document.getElementById("manualUrl");
    const manualAddButton = document.getElementById("manualAddButton");
    const favoritesListDiv = document.getElementById("favoritesList");
    const audioPlayer = document.getElementById("audioPlayer");
    const playButton = document.getElementById("playButton");
    const stopButton = document.getElementById("stopButton");
    const volumeControl = document.getElementById("volumeControl");
    const muteButton = document.getElementById("muteButton");
    const volumeUpButton = document.getElementById("volumeUp");
    const volumeDownButton = document.getElementById("volumeDown");
    const volumeDisplay = document.getElementById("volumeDisplay");
    const nowPlayingDiv = document.getElementById("nowPlaying");
    const installButtonContainer = document.getElementById("installInstructions");
    const installButton = document.getElementById("installAppButton");
    const toastNotificationDiv = document.getElementById("toastNotification");
    const toastMessageSpan = document.getElementById("toastMessage");
    const exportFavoritesButton = document.getElementById("exportFavoritesButton");
    const importFavoritesButton = document.getElementById("importFavoritesButton");
    const importFileInput = document.getElementById("importFile");
    const toggleHeaders = document.querySelectorAll(".toggle-header");
    const themeToggleButton = document.getElementById("themeToggleButton");
    const titleColorSelect = document.getElementById("titleColorSelect");
    const clicksTab = document.getElementById("clicksTab");
    const timeTab = document.getElementById("timeTab");
    const analyticsResults = document.getElementById("analyticsResults");
    const exportAnalyticsButton = document.getElementById("exportAnalyticsButton");
    const clearAnalyticsButton = document.getElementById("clearAnalyticsButton");
    const topRadiosButtons = document.getElementById("topRadiosButtons");

    // --- Variáveis de Estado e Configuração ---
    let toastTimeout;
    let favorites = {};
    let rawFavoritesData = JSON.parse(localStorage.getItem('radioFavorites'));

    if (Array.isArray(rawFavoritesData)) {
        console.log("Migrando favoritos do formato antigo para categorias...");
        if (rawFavoritesData.length > 0) {
            favorites["Geral"] = rawFavoritesData;
        }
        localStorage.setItem('radioFavorites', JSON.stringify(favorites));
    } else if (rawFavoritesData && typeof rawFavoritesData === 'object' && !Array.isArray(rawFavoritesData)) {
        favorites = rawFavoritesData;
    }

    let currentStation = null;
    let deferredPrompt;
    let currentHlsInstance = null;
    let lastVolume = 1;
    let isMuted = false;
    let categoryOrder = JSON.parse(localStorage.getItem('categoryOrder')) || [];

    // Múltiplas URLs da API para fallback
    const API_URLS = [
        'https://all.api.radio-browser.info/json/stations/search',
        'https://de1.api.radio-browser.info/json/stations/search',
        'https://fr1.api.radio-browser.info/json/stations/search',
        'https://nl1.api.radio-browser.info/json/stations/search'
    ];

    // --- Função para mostrar Notificações (Toast) ---
    function showToast(message, duration = 3000) {
        if (!toastNotificationDiv || !toastMessageSpan) {
            console.error("Elementos do Toast não encontrados no DOM!");
            alert(message);
            return;
        }
        clearTimeout(toastTimeout);
        toastMessageSpan.textContent = message;
        toastNotificationDiv.classList.add("show");
        toastTimeout = setTimeout(() => {
            toastNotificationDiv.classList.remove("show");
        }, duration);
    }

    // --- Funções do Player de Áudio (com HLS.js) ---
    function playStream(station) {
        if (!station || !station.url_resolved) {
            showToast("URL da estação inválida ou não disponível.", 3000);
            nowPlayingDiv.textContent = "Erro ao tocar rádio.";
            updatePlayerControls(false, null);
            return;
        }

        stopStream();
        
        // RadioData: Registrar click
        if (window.radioData) {
            window.radioData.recordClick(station);
        }

        const streamUrl = station.url_resolved;
        nowPlayingDiv.textContent = `Carregando: ${station.name}...`;
        updatePlayerControls(false, station.name);

        if (streamUrl.includes(".m3u8")) {
            if (Hls.isSupported()) {
                console.log("Tentando tocar HLS stream:", streamUrl);
                currentHlsInstance = new Hls();
                currentHlsInstance.loadSource(streamUrl);
                currentHlsInstance.attachMedia(audioPlayer);
                currentHlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
                    audioPlayer.play()
                        .then(() => {
                            nowPlayingDiv.textContent = `Tocando: ${station.name}`;
                            currentStation = station;
                            updatePlayerControls(true, station.name);
                            document.title = `▶ ${station.name} - Rádio Player`;
                            
                            // RadioData: Iniciar sessão
                            if (window.radioData) {
                                window.radioData.startListeningSession(station);
                            }
                            
                            // Atualizar top rádios quando uma nova rádio começa a tocar
                            setTimeout(updateTopRadiosButtons, 1000);
                        })
                        .catch(error => handlePlayError(station, error));
                });
                currentHlsInstance.on(Hls.Events.ERROR, function(event, data) {
                    console.error("HLS.js Erro:", event, data);
                    if (data.fatal) {
                        let errorMsg = `Erro fatal ao tocar HLS stream para "${station.name}".`;
                         if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                            errorMsg = `Erro de rede ao carregar "${station.name}". Verifique a URL ou sua conexão.`;
                         } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                            errorMsg = `Erro de mídia ao tocar "${station.name}". Formato pode não ser suportado.`;
                         }
                        showToast(errorMsg, 4000);
                        stopStream();
                    }
                });
            } else {
                showToast("Seu navegador não suporta HLS.js, necessário para esta rádio.", 4000);
                stopStream();
            }
        } else {
            console.log("Tentando tocar stream direto:", streamUrl);
            audioPlayer.src = streamUrl;
            audioPlayer.load();
            audioPlayer.play()
                .then(() => {
                    nowPlayingDiv.textContent = `Tocando: ${station.name}`;
                    currentStation = station;
                    updatePlayerControls(true, station.name);
                    document.title = `▶ ${station.name} - Rádio Player`;
                    
                    // RadioData: Iniciar sessão
                    if (window.radioData) {
                        window.radioData.startListeningSession(station);
                    }
                    
                    // Atualizar top rádios quando uma nova rádio começa a tocar
                    setTimeout(updateTopRadiosButtons, 1000);
                })
                .catch(error => handlePlayError(station, error));
        }
    }

    function handlePlayError(station, error) {
        console.error("Erro ao tocar rádio:", error, "Estação:", station);
        let errorMsg = `Erro ao tocar "${station.name}".`;
        if (error.name === "NotSupportedError") {
            errorMsg += " O formato do áudio pode não ser suportado.";
        } else if (station.url_resolved.startsWith("http:") && window.location.protocol === "https:") {
            errorMsg += " Pode ser um problema de conteúdo misto (HTTP em HTTPS).";
        } else {
            errorMsg += " A URL pode estar offline, incorreta ou bloqueada.";
        }
        showToast(errorMsg, 4000);
        stopStream();
    }

    function stopStream() {
        // RadioData: Finalizar sessão
        if (window.radioData) {
            window.radioData.endListeningSession();
        }
        
        audioPlayer.pause();
        if (currentHlsInstance) {
            currentHlsInstance.destroy();
            currentHlsInstance = null;
        }
        audioPlayer.src = "";
        audioPlayer.removeAttribute("src");
        nowPlayingDiv.textContent = "Nenhuma rádio tocando...";
        updatePlayerControls(false, null);
        currentStation = null;
        document.title = "Rádio Player Online";
        console.log("Stream parado.");
    }

    function updatePlayerControls(isPlaying, stationName) {
        playButton.disabled = isPlaying;
        stopButton.disabled = !isPlaying;
        if (isPlaying && stationName) {
            playButton.innerHTML = `▶️ Tocando <span class="playing-station-name">(${stationName.substring(0,15)}${stationName.length > 15 ? '...' : ''})</span>`;
        } else if (isPlaying) {
            playButton.innerHTML = "▶️ Tocando...";
        } else {
            playButton.innerHTML = "▶️ Play";
        }
    }

    // --- Busca de Estações (API Radio Browser) com Fallback ---
    async function searchStations(term) {
        if (!term.trim()) {
            searchResultsDiv.innerHTML = "<p>Digite algo para buscar.</p>";
            return;
        }
        
        searchResultsDiv.innerHTML = "<p>Buscando...</p>";
        
        for (let i = 0; i < API_URLS.length; i++) {
            try {
                const apiUrl = `${API_URLS[i]}?name=${encodeURIComponent(term)}&limit=30&hidebroken=true&order=clickcount&reverse=true`;
                console.log(`Tentando API ${i + 1}: ${apiUrl}`);
                
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'RadioPlayerApp/1.0',
                        'Accept': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const stations = await response.json();
                console.log(`API ${i + 1} retornou ${stations.length} estações`);
                
                if (stations && Array.isArray(stations)) {
                    displayStations(stations, searchResultsDiv, "search");
                    return; // Sucesso, sai da função
                } else {
                    throw new Error("Resposta inválida da API");
                }
                
            } catch (error) {
                console.error(`Erro na API ${i + 1}:`, error);
                
                // Se é a última tentativa, mostra o erro
                if (i === API_URLS.length - 1) {
                    searchResultsDiv.innerHTML = `<p>Erro ao buscar estações. Todas as APIs falharam. Último erro: ${error.message}</p>`;
                    showToast(`Erro na busca: ${error.message}`, 4000);
                } else {
                    // Continua para a próxima API
                    console.log(`Tentando próxima API...`);
                }
            }
        }
    }

    // --- Adicionar Manualmente ---
    function isValidHttpUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch (_) {
            return false;
        }
    }

    function addManualStation() {
        const name = manualNameInput.value.trim();
        const url = manualUrlInput.value.trim();
        if (name && url) {
            if (!isValidHttpUrl(url)) {
                showToast("URL inválida. Use http:// ou https://", 3000);
                return;
            }
            const manualStation = {
                stationuuid: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: name,
                url_resolved: url,
                favicon: "",
                country: "N/A",
                codec: "N/A",
                bitrate: "N/A"
            };
            playStream(manualStation);
            addToFavorites(manualStation);
            manualNameInput.value = "";
            manualUrlInput.value = "";
        } else {
            showToast("Preencha o nome e a URL da rádio.", 3000);
        }
    }

    // --- Gerenciamento de Favoritos (Com Categorias) ---
    function addToFavorites(station) {
        const defaultCategory = "Geral";
        const categoryInput = prompt(`Em qual categoria você gostaria de adicionar "${station.name}"?`, defaultCategory);

        if (categoryInput === null) {
            return;
        }
        const categoryName = categoryInput.trim() || defaultCategory;

        for (const cat in favorites) {
            if (favorites[cat] && favorites[cat].find(fav => fav.stationuuid === station.stationuuid)) {
                showToast(`"${station.name}" já está nos favoritos na categoria "${cat}".`);
                return;
            }
        }

        if (!favorites[categoryName]) {
            favorites[categoryName] = [];
        }
        favorites[categoryName].push(station);
        saveFavorites();
        renderFavorites();
        updateSearchResultsStates();
        showToast(`"${station.name}" adicionada à categoria "${categoryName}"! ⭐`);
    }

    function removeFromFavorites(stationUuid, categoryName) {
        if (favorites[categoryName] && favorites[categoryName].find(fav => fav.stationuuid === stationUuid)) {
            const stationIndex = favorites[categoryName].findIndex(fav => fav.stationuuid === stationUuid);
            const stationName = favorites[categoryName][stationIndex].name;
            
            favorites[categoryName].splice(stationIndex, 1);
            
            if (favorites[categoryName].length === 0) {
                delete favorites[categoryName];
            }
            
            saveFavorites();
            renderFavorites();
            updateSearchResultsStates();
            showToast(`"${stationName}" removida da categoria "${categoryName}".`);
        } else {
            showToast("Erro: Rádio ou categoria não encontrada para remoção.");
        }
    }

    function saveFavorites() {
        try {
            localStorage.setItem("radioFavorites", JSON.stringify(favorites));
            // Atualizar ordem das categorias quando uma nova categoria é criada
            const currentCategories = Object.keys(favorites);
            const newCategories = currentCategories.filter(cat => !categoryOrder.includes(cat));
            if (newCategories.length > 0) {
                categoryOrder = [...categoryOrder, ...newCategories];
                saveCategoryOrder();
            }
        } catch (error) {
            console.error("Erro ao salvar favoritos no localStorage:", error);
            showToast("Erro ao salvar favoritos.", 3000);
        }
    }

    function isStationInAnyFavorite(stationUuid) {
        for (const category in favorites) {
            if (favorites[category] && favorites[category].some(fav => fav.stationuuid === stationUuid)) {
                return true;
            }
        }
        return false;
    }

    function updateSearchResultsStates() {
        const searchItems = searchResultsDiv.querySelectorAll(".station-item");
        searchItems.forEach(item => {
            const stationUuid = item.dataset.stationuuid;
            const favButton = item.querySelector(".fav-btn");
            if (favButton) {
                const isFav = isStationInAnyFavorite(stationUuid);
                favButton.textContent = isFav ? "Favoritado ★" : "Favoritar ☆";
                favButton.classList.toggle("favorited", isFav);
                favButton.title = isFav ? "Já está nos Favoritos" : "Adicionar aos Favoritos";
            }
        });
    }

    function renderFavorites() {
        favoritesListDiv.innerHTML = '';
        const categoryNames = getSortedCategoryNames();

        if (categoryNames.length === 0) {
            favoritesListDiv.innerHTML = '<p style="text-align:center; padding:10px; color:#666;">Nenhuma rádio favorita ainda.</p>';
            return;
        }

        categoryNames.forEach(categoryName => {
            const categoryStations = favorites[categoryName];
            if (!categoryStations || categoryStations.length === 0) {
                return;
            }

            const categoryHeader = document.createElement('div');
            categoryHeader.classList.add('favorite-category-header');
            categoryHeader.draggable = true;
            categoryHeader.dataset.categoryName = categoryName;
            categoryHeader.innerHTML = `
                <span class="category-drag-handle">⋮⋮</span>
                <span class="category-name">${categoryName}</span>
                <span class="category-toggle-icon">▶</span>
            `;
            
            setupCategoryDragAndDrop(categoryHeader, categoryName);

            const stationsContainer = document.createElement('div');
            stationsContainer.classList.add('station-list-items', 'hidden-section');

            categoryStations.forEach(station => {
                displayStationItem(station, stationsContainer, "favorites", categoryName);
            });

            categoryHeader.addEventListener('click', () => {
                stationsContainer.classList.toggle('hidden-section');
                categoryHeader.classList.toggle('expanded');
            });

            favoritesListDiv.appendChild(categoryHeader);
            favoritesListDiv.appendChild(stationsContainer);
        });
    }

    function displayStations(stationsArray, container, type) {
        container.innerHTML = "";
        if (!stationsArray || stationsArray.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:10px; color:#666;">${type === "search" ? "Nenhuma estação encontrada." : "Lista vazia."}</p>`;
            return;
        }
        stationsArray.forEach(station => {
            displayStationItem(station, container, type, null);
        });
    }

    function displayStationItem(station, container, type, categoryName = null) {
        if (!station || !station.stationuuid || !station.name) {
            console.warn("Pulando estação inválida:", station);
            return;
        }
        if (type === "search" && !station.url_resolved) {
            console.warn("Pulando estação sem URL na busca:", station.name);
            return;
        }

        const itemDiv = document.createElement("div");
        itemDiv.classList.add("station-item");
        itemDiv.dataset.stationuuid = station.stationuuid;
        if (categoryName) itemDiv.dataset.category = categoryName;
        
        // Adicionar drag and drop apenas para favoritos
        if (type === "favorites") {
            itemDiv.draggable = true;
            setupDragAndDrop(itemDiv, station, categoryName);
        }

        const stationInfoDiv = document.createElement("div");
        stationInfoDiv.classList.add("station-info");
        
        // Corrigindo o problema das classes vazias
        const faviconHtml = station.favicon ? 
            `<img src="${station.favicon}" alt="logo" class="station-favicon" onerror="this.style.display='none'; this.onerror=null;">` : 
            `<span class="station-favicon-placeholder">🎵</span>`;
            
        // Sanitizando os dados para evitar strings vazias
        const country = station.country && station.country.trim() ? station.country.trim() : "";
        const codec = station.codec && station.codec.trim() ? station.codec.trim() : "";
        const bitrate = station.bitrate && station.bitrate.toString().trim() ? station.bitrate.toString().trim() : "";
        
        let detailsText = "";
        if (country) detailsText += country;
        if (codec) {
            if (detailsText) detailsText += " ";
            detailsText += `(${codec}`;
            if (bitrate && bitrate !== "0") {
                detailsText += `, ${bitrate}k`;
            }
            detailsText += ")";
        }
        
        stationInfoDiv.innerHTML = `
            ${type === "favorites" ? '<span class="drag-handle">⋮⋮</span>' : ''}
            ${faviconHtml}
            <div>
                <span class="name">${station.name}</span>
                <span class="details">${detailsText}</span>
            </div>
        `;

        const actionsDiv = document.createElement("div");
        actionsDiv.classList.add("station-actions");

        const playBtn = document.createElement("button");
        playBtn.textContent = "Tocar";
        playBtn.classList.add("play-station-btn");
        playBtn.title = `Tocar ${station.name}`;
        playBtn.onclick = (e) => { e.stopPropagation(); playStream(station); };
        actionsDiv.appendChild(playBtn);

        if (type === "favorites") {
            const moveBtn = document.createElement("button");
            moveBtn.textContent = "Mover";
            moveBtn.classList.add("move-btn");
            moveBtn.title = `Mover ${station.name} para outra categoria`;
            moveBtn.onclick = (e) => {
                e.stopPropagation();
                addMoveToCategory(station, categoryName);
            };
            actionsDiv.appendChild(moveBtn);
            
            const removeFavBtn = document.createElement("button");
            removeFavBtn.textContent = "Remover";
            removeFavBtn.classList.add("remove-fav-btn");
            removeFavBtn.title = `Remover ${station.name} dos Favoritos`;
            removeFavBtn.onclick = (e) => {
                e.stopPropagation();
                if (categoryName) {
                    removeFromFavorites(station.stationuuid, categoryName);
                } else {
                    console.error("Erro: Tentativa de remover favorito sem o nome da categoria.");
                    showToast("Erro ao remover: categoria não especificada.", 3000);
                }
            };
            actionsDiv.appendChild(removeFavBtn);
        } else {
            const isFavorite = isStationInAnyFavorite(station.stationuuid);
            const favBtn = document.createElement("button");
            favBtn.textContent = isFavorite ? "Favoritado ★" : "Favoritar ☆";
            
            // Corrigindo o problema de classes vazias
            favBtn.classList.add("fav-btn");
            if (isFavorite) {
                favBtn.classList.add("favorited");
            }
            
            favBtn.title = isFavorite ? `${station.name} já está nos Favoritos` : `Adicionar ${station.name} aos Favoritos`;
            favBtn.onclick = (e) => {
                e.stopPropagation();
                addToFavorites(station);
            };
            actionsDiv.appendChild(favBtn);
        }

        itemDiv.appendChild(stationInfoDiv);
        itemDiv.appendChild(actionsDiv);
        container.appendChild(itemDiv);
    }

    // --- Funções de Ordenação de Categorias ---
    function getSortedCategoryNames() {
        const allCategories = Object.keys(favorites);
        const orderedCategories = categoryOrder.filter(cat => allCategories.includes(cat));
        const newCategories = allCategories.filter(cat => !categoryOrder.includes(cat));
        return [...orderedCategories, ...newCategories.sort()];
    }

    function saveCategoryOrder() {
        try {
            localStorage.setItem('categoryOrder', JSON.stringify(categoryOrder));
        } catch (error) {
            console.error('Erro ao salvar ordem das categorias:', error);
        }
    }

    function updateCategoryOrder(draggedCategory, targetCategory, insertBefore) {
        const currentOrder = getSortedCategoryNames();
        const draggedIndex = currentOrder.indexOf(draggedCategory);
        const targetIndex = currentOrder.indexOf(targetCategory);
        
        if (draggedIndex === -1 || targetIndex === -1) return;
        
        currentOrder.splice(draggedIndex, 1);
        const newTargetIndex = currentOrder.indexOf(targetCategory);
        const insertIndex = insertBefore ? newTargetIndex : newTargetIndex + 1;
        currentOrder.splice(insertIndex, 0, draggedCategory);
        
        categoryOrder = currentOrder;
        saveCategoryOrder();
        renderFavorites();
        showToast(`Categoria "${draggedCategory}" reordenada`);
    }

    function setupCategoryDragAndDrop(headerElement, categoryName) {
        headerElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                type: 'category',
                categoryName: categoryName
            }));
            headerElement.classList.add('dragging');
        });

        headerElement.addEventListener('dragend', () => {
            headerElement.classList.remove('dragging');
            document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
                el.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        });

        headerElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            const rect = headerElement.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                headerElement.classList.add('drag-over-top');
                headerElement.classList.remove('drag-over-bottom');
            } else {
                headerElement.classList.add('drag-over-bottom');
                headerElement.classList.remove('drag-over-top');
            }
        });

        headerElement.addEventListener('dragleave', () => {
            headerElement.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        headerElement.addEventListener('drop', (e) => {
            e.preventDefault();
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            
            if (data.type === 'category') {
                const rect = headerElement.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const insertBefore = e.clientY < midY;
                updateCategoryOrder(data.categoryName, categoryName, insertBefore);
            }
        });
    }

    // --- Funções de Drag and Drop ---
    function setupDragAndDrop(itemDiv, station, categoryName) {
        itemDiv.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                stationuuid: station.stationuuid,
                sourceCategory: categoryName
            }));
            itemDiv.classList.add('dragging');
        });

        itemDiv.addEventListener('dragend', () => {
            itemDiv.classList.remove('dragging');
            document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
                el.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        });

        itemDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            const rect = itemDiv.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                itemDiv.classList.add('drag-over-top');
                itemDiv.classList.remove('drag-over-bottom');
            } else {
                itemDiv.classList.add('drag-over-bottom');
                itemDiv.classList.remove('drag-over-top');
            }
        });

        itemDiv.addEventListener('dragleave', () => {
            itemDiv.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        itemDiv.addEventListener('drop', (e) => {
            e.preventDefault();
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const targetCategory = itemDiv.dataset.category;
            const rect = itemDiv.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertBefore = e.clientY < midY;
            
            moveStation(data.stationuuid, data.sourceCategory, targetCategory, itemDiv, insertBefore);
        });
    }

    function moveStation(stationUuid, sourceCategory, targetCategory, targetElement, insertBefore) {
        const station = favorites[sourceCategory]?.find(s => s.stationuuid === stationUuid);
        if (!station) return;

        // Remover da categoria origem
        const sourceIndex = favorites[sourceCategory].findIndex(s => s.stationuuid === stationUuid);
        favorites[sourceCategory].splice(sourceIndex, 1);
        
        // Se categoria origem ficou vazia, remover
        if (favorites[sourceCategory].length === 0) {
            delete favorites[sourceCategory];
        }

        // Adicionar na categoria destino
        if (!favorites[targetCategory]) {
            favorites[targetCategory] = [];
        }
        
        const targetStationUuid = targetElement.dataset.stationuuid;
        const targetIndex = favorites[targetCategory].findIndex(s => s.stationuuid === targetStationUuid);
        const insertIndex = insertBefore ? targetIndex : targetIndex + 1;
        
        favorites[targetCategory].splice(insertIndex, 0, station);
        
        saveFavorites();
        renderFavorites();
        
        if (sourceCategory !== targetCategory) {
            showToast(`"${station.name}" movida para "${targetCategory}"`);
        } else {
            showToast(`"${station.name}" reordenada`);
        }
    }

    function addMoveToCategory(station, currentCategory) {
        const categories = Object.keys(favorites).filter(cat => cat !== currentCategory);
        if (categories.length === 0) {
            const newCategory = prompt('Nome da nova categoria:');
            if (newCategory && newCategory.trim()) {
                moveStationToCategory(station, currentCategory, newCategory.trim());
            }
            return;
        }
        
        const options = categories.map(cat => `${cat}`).join('\n');
        const choice = prompt(`Mover "${station.name}" para qual categoria?\n\n${options}\n\nOu digite o nome de uma nova categoria:`);
        
        if (choice && choice.trim()) {
            moveStationToCategory(station, currentCategory, choice.trim());
        }
    }

    function moveStationToCategory(station, fromCategory, toCategory) {
        // Remover da categoria atual
        const index = favorites[fromCategory].findIndex(s => s.stationuuid === station.stationuuid);
        favorites[fromCategory].splice(index, 1);
        
        if (favorites[fromCategory].length === 0) {
            delete favorites[fromCategory];
        }
        
        // Adicionar na nova categoria
        if (!favorites[toCategory]) {
            favorites[toCategory] = [];
        }
        favorites[toCategory].push(station);
        
        saveFavorites();
        renderFavorites();
        showToast(`"${station.name}" movida para "${toCategory}"`);
    }

    // --- Funções de Exportar/Importar Favoritos ---
    function exportFavorites() {
        if (Object.keys(favorites).length === 0) {
            showToast("Não há favoritos para exportar.", 2000);
            return;
        }
        try {
            const jsonString = JSON.stringify(favorites, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "radio_favoritos_categorias.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast("Favoritos exportados!", 2000);
        } catch (error) {
            console.error("Erro ao exportar:", error);
            showToast("Erro ao exportar favoritos.", 3000);
        }
    }

    function importFavorites(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (typeof importedData !== 'object' || Array.isArray(importedData) || importedData === null) {
                    throw new Error("Arquivo inválido. Deve ser um arquivo de categorias de favoritos.");
                }

                if (Object.keys(favorites).length > 0 && !confirm("Isso substituirá seus favoritos atuais. Deseja continuar?")) {
                    event.target.value = null;
                    return;
                }

                favorites = importedData;
                saveFavorites();
                renderFavorites();
                updateSearchResultsStates();
                showToast("Favoritos importados com sucesso!", 2000);
            } catch (error) {
                console.error("Erro ao importar:", error);
                showToast(`Erro ao importar: ${error.message}`, 4000);
            } finally {
                event.target.value = null;
            }
        };
        reader.onerror = () => {
            showToast("Erro ao ler o arquivo.", 3000);
            event.target.value = null;
        };
        reader.readAsText(file);
    }

    // --- Lógica para Ocultar/Exibir Seções ---
    function setupToggleSections() {
        toggleHeaders.forEach(header => {
            const targetId = header.dataset.target;
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                const isInitiallyHidden = targetContent.classList.contains("hidden-section");
                header.classList.toggle("expanded", !isInitiallyHidden);

                header.addEventListener("click", () => {
                    const isHidden = targetContent.classList.toggle("hidden-section");
                    header.classList.toggle("expanded", !isHidden);
                });
            } else {
                console.warn(`Conteúdo alvo não encontrado para o header: ${targetId}`);
            }
        });
    }

    // --- Lógica do Tema Claro/Escuro ---
    function applyTheme(theme) {
        if (theme === "dark") {
            document.body.classList.add("dark-theme");
            if (themeToggleButton) {
                themeToggleButton.textContent = "☀️";
                themeToggleButton.title = "Mudar para Tema Claro";
            }
        } else {
            document.body.classList.remove("dark-theme");
            if (themeToggleButton) {
                themeToggleButton.textContent = "🌙";
                themeToggleButton.title = "Mudar para Tema Escuro";
            }
        }
    }

    function toggleTheme() {
        const currentTheme = document.body.classList.contains("dark-theme") ? "dark" : "light";
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(newTheme);
        try {
            localStorage.setItem("radioTheme", newTheme);
        } catch (error) {
            console.error("Erro ao salvar preferência de tema:", error);
        }
    }

    // --- Controles de Volume ---
    function updateVolumeDisplay() {
        const volume = Math.round(audioPlayer.volume * 100);
        volumeDisplay.textContent = `${volume}%`;
        
        if (volume === 0 || isMuted) {
            muteButton.textContent = '🔇';
            muteButton.title = 'Ativar Som';
        } else if (volume < 50) {
            muteButton.textContent = '🔉';
            muteButton.title = 'Silenciar';
        } else {
            muteButton.textContent = '🔊';
            muteButton.title = 'Silenciar';
        }
    }

    function toggleMute() {
        if (isMuted) {
            audioPlayer.volume = lastVolume;
            volumeControl.value = lastVolume;
            isMuted = false;
        } else {
            lastVolume = audioPlayer.volume;
            audioPlayer.volume = 0;
            volumeControl.value = 0;
            isMuted = true;
        }
        updateVolumeDisplay();
    }

    function changeVolume(delta) {
        const newVolume = Math.max(0, Math.min(1, audioPlayer.volume + delta));
        audioPlayer.volume = newVolume;
        volumeControl.value = newVolume;
        if (isMuted && newVolume > 0) {
            isMuted = false;
        }
        updateVolumeDisplay();
    }

    // --- Lógica da Cor dos Títulos ---
    function applyTitleColor(color) {
        // Remove todas as classes de cor existentes
        document.body.classList.remove('title-color-blue', 'title-color-green', 'title-color-purple', 'title-color-red', 'title-color-orange');
        
        // Aplica a nova cor se não for padrão
        if (color !== 'default') {
            document.body.classList.add(`title-color-${color}`);
        }
    }

    function changeTitleColor() {
        const selectedColor = titleColorSelect.value;
        applyTitleColor(selectedColor);
        try {
            localStorage.setItem("radioTitleColor", selectedColor);
        } catch (error) {
            console.error("Erro ao salvar preferência de cor dos títulos:", error);
        }
    }

    function initializeTitleColor() {
        let savedColor = 'default';
        try {
            savedColor = localStorage.getItem("radioTitleColor") || 'default';
        } catch (error) {
            console.error("Erro ao ler preferência de cor dos títulos:", error);
        }
        titleColorSelect.value = savedColor;
        applyTitleColor(savedColor);
    }

    function initializeTheme() {
        let savedTheme = null;
        try {
            savedTheme = localStorage.getItem("radioTheme");
        } catch (error) {
            console.error("Erro ao ler preferência de tema do localStorage:", error);
        }
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
        applyTheme(initialTheme);
        if (window.matchMedia) {
            window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
                 if (!localStorage.getItem("radioTheme")) {
                     applyTheme(e.matches ? "dark" : "light");
                 }
            });
        }
    }

    // --- PWA: Service Worker e Instalação ---
    function registerServiceWorker() {
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => {
                navigator.serviceWorker.register("./sw.js")
                    .then(registration => console.log("ServiceWorker: Registrado, escopo:", registration.scope))
                    .catch(error => console.log("ServiceWorker: Falha no registro:", error));
            });
        }
    }

    function setupInstallPrompt() {
        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            deferredPrompt = e;
            if (installButtonContainer && installButton) {
                 installButtonContainer.style.display = "block";
                 installButton.onclick = () => {
                     installButtonContainer.style.display = "none";
                     deferredPrompt.prompt();
                     deferredPrompt.userChoice.then((choiceResult) => {
                         console.log(`Resultado A2HS: ${choiceResult.outcome}`);
                         deferredPrompt = null;
                     });
                 };
            } else {
                 console.warn("Elementos do botão de instalação não encontrados.");
            }
        });

        window.addEventListener("appinstalled", () => {
            console.log("App instalado!");
            if(installButtonContainer) installButtonContainer.style.display = "none";
            deferredPrompt = null;
        });
    }

    // --- Event Listeners Principais ---
    searchButton.addEventListener("click", () => searchStations(searchInput.value));
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") searchStations(searchInput.value);
    });
    if (manualAddButton) manualAddButton.addEventListener("click", addManualStation);

    playButton.addEventListener("click", () => {
        if (currentStation && audioPlayer.paused) {
             if (currentStation.url_resolved.includes(".m3u8") && !currentHlsInstance) {
                 playStream(currentStation);
             } else if (currentStation.url_resolved.includes(".m3u8") && currentHlsInstance) {
                 audioPlayer.play().catch(error => handlePlayError(currentStation, error));
             }
              else {
                 audioPlayer.play().catch(error => handlePlayError(currentStation, error));
             }
        } else if (!currentStation) {
             showToast("Nenhuma rádio selecionada para tocar.", 2000);
        }
    });
    stopButton.addEventListener("click", stopStream);
    volumeControl.addEventListener("input", (e) => {
        audioPlayer.volume = e.target.value;
        if (isMuted && e.target.value > 0) {
            isMuted = false;
        }
        updateVolumeDisplay();
    });
    
    if (muteButton) muteButton.addEventListener("click", toggleMute);
    if (volumeUpButton) volumeUpButton.addEventListener("click", () => changeVolume(0.1));
    if (volumeDownButton) volumeDownButton.addEventListener("click", () => changeVolume(-0.1));

    audioPlayer.addEventListener("ended", stopStream);
    audioPlayer.addEventListener("error", (e) => {
        console.error("Erro no elemento <audio>:", e);
        if (currentStation && !currentHlsInstance) {
            showToast(`Erro no stream de "${currentStation.name}".`, 3000);
            stopStream();
        } else if (currentStation && currentHlsInstance) {
            console.log("Erro no elemento audio, HLS.js está ativo. Verificar logs do HLS para detalhes.");
        }
    });

    if (exportFavoritesButton) exportFavoritesButton.addEventListener("click", exportFavorites);
    if (importFavoritesButton && importFileInput) {
        importFavoritesButton.addEventListener("click", () => importFileInput.click());
        importFileInput.addEventListener("change", importFavorites);
    }
    if (themeToggleButton) themeToggleButton.addEventListener("click", toggleTheme);
    if (titleColorSelect) titleColorSelect.addEventListener("change", changeTitleColor);

    // --- Funções das Top Rádios ---
    async function updateTopRadiosButtons() {
        if (!window.radioData || !topRadiosButtons) {
            return;
        }
        
        try {
            const topRadios = await window.radioData.getTopByTime(7);
            
            if (topRadios.length === 0) {
                topRadiosButtons.innerHTML = '<p style="text-align:center; color:#666; font-style:italic;">Nenhuma rádio ouvida ainda</p>';
                return;
            }
            
            topRadiosButtons.innerHTML = topRadios.map((radio, index) => {
                const station = {
                    stationuuid: radio.stationId,
                    name: radio.name,
                    url_resolved: radio.url,
                    favicon: "",
                    country: "N/A",
                    codec: "N/A",
                    bitrate: "N/A"
                };
                return `
                    <button class="top-radio-btn" data-station='${JSON.stringify(station)}' title="${radio.name} - ${window.radioData.formatTime(radio.totalTime)}">
                        ${index + 1}. ${radio.name.length > 15 ? radio.name.substring(0, 15) + '...' : radio.name}
                    </button>
                `;
            }).join('');
            
            // Adicionar event listeners aos botões
            topRadiosButtons.querySelectorAll('.top-radio-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    try {
                        const station = JSON.parse(btn.dataset.station);
                        playStream(station);
                    } catch (error) {
                        console.error('Erro ao tocar rádio do top:', error);
                        showToast('Erro ao tocar esta rádio', 3000);
                    }
                });
            });
        } catch (error) {
            console.error('Erro ao atualizar top rádios:', error);
            topRadiosButtons.innerHTML = '<p style="text-align:center; color:#666;">Erro ao carregar top rádios</p>';
        }
    }

    // --- Funções de Estatísticas ---
    async function showAnalytics(type = 'clicks') {
        if (!window.radioData) {
            analyticsResults.innerHTML = '<p>Módulo de estatísticas não disponível.</p>';
            return;
        }
        
        try {
            const data = type === 'clicks' ? 
                await window.radioData.getTopByClicks(10) : 
                await window.radioData.getTopByTime(10);
            
            if (data.length === 0) {
                analyticsResults.innerHTML = '<p>Nenhum dado disponível ainda.</p>';
                return;
            }
            
            analyticsResults.innerHTML = data.map(station => `
                <div class="analytics-item">
                    <div class="analytics-station-info">
                        <div class="analytics-station-name">${station.name}</div>
                    </div>
                    <div class="analytics-stats">
                        ${type === 'clicks' ? 
                            `${station.clicks} clicks` : 
                            window.radioData.formatTime(station.totalTime)
                        }
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
            analyticsResults.innerHTML = '<p>Erro ao carregar estatísticas.</p>';
        }
    }
    
    async function exportAnalytics() {
        if (!window.radioData) {
            showToast('Módulo de estatísticas não disponível.', 3000);
            return;
        }
        
        try {
            const data = await window.radioData.exportData();
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'radio_analytics.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Estatísticas exportadas!', 2000);
        } catch (error) {
            console.error('Erro ao exportar estatísticas:', error);
            showToast('Erro ao exportar estatísticas.', 3000);
        }
    }
    
    async function clearAnalytics() {
        if (!window.radioData) {
            showToast('Módulo de estatísticas não disponível.', 3000);
            return;
        }
        
        if (confirm('Tem certeza que deseja limpar todas as estatísticas?')) {
            try {
                await window.radioData.clearAllData();
                showAnalytics(clicksTab.classList.contains('active') ? 'clicks' : 'time');
                showToast('Estatísticas limpas!', 2000);
            } catch (error) {
                console.error('Erro ao limpar estatísticas:', error);
                showToast('Erro ao limpar estatísticas.', 3000);
            }
        }
    }
    
    // Event listeners para estatísticas
    if (clicksTab) {
        clicksTab.addEventListener('click', () => {
            clicksTab.classList.add('active');
            timeTab.classList.remove('active');
            showAnalytics('clicks');
        });
    }
    
    if (timeTab) {
        timeTab.addEventListener('click', () => {
            timeTab.classList.add('active');
            clicksTab.classList.remove('active');
            showAnalytics('time');
        });
    }
    
    if (exportAnalyticsButton) {
        exportAnalyticsButton.addEventListener('click', exportAnalytics);
    }
    
    if (clearAnalyticsButton) {
        clearAnalyticsButton.addEventListener('click', clearAnalytics);
    }

    // --- Inicialização da Aplicação ---
    initializeTheme();
    initializeTitleColor();
    renderFavorites();
    updatePlayerControls(false, null);
    updateVolumeDisplay();
    setupToggleSections();
    registerServiceWorker();
    setupInstallPrompt();
    
    // Carregar estatísticas iniciais e top rádios
    setTimeout(() => {
        if (window.radioData && clicksTab) {
            showAnalytics('clicks');
            updateTopRadiosButtons();
        }
    }, 1000);
    
    // Atualizar top rádios periodicamente
    setInterval(() => {
        if (window.radioData) {
            updateTopRadiosButtons();
        }
    }, 30000); // A cada 30 segundos

});