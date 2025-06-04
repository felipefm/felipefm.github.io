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
    const nowPlayingDiv = document.getElementById("nowPlaying");
    const installButtonContainer = document.getElementById("installInstructions");
    const installButton = document.getElementById("installAppButton");
    const toastNotificationDiv = document.getElementById("toastNotification");
    const toastMessageSpan = document.getElementById("toastMessage");
    const exportFavoritesButton = document.getElementById("exportFavoritesButton");
    const importFavoritesButton = document.getElementById("importFavoritesButton");
    const importFileInput = document.getElementById("importFile");
    const toggleHeaders = document.querySelectorAll(".toggle-header");
    const themeToggleButton = document.getElementById("themeToggleButton"); // Botão de tema

    // --- Variáveis de Estado e Configuração ---
    let toastTimeout;
    // Removidas as declarações duplicadas de currentStation, deferredPrompt, currentHlsInstance
    // let currentStation = null; // Duplicado
    // let favorites = JSON.parse(localStorage.getItem("radioFavorites")) || []; // Linha antiga original, agora tratada abaixo
    // let deferredPrompt; // Duplicado
    // let currentHlsInstance = null; // Duplicado


    // Nova inicialização e migração de favoritos
    let rawFavoritesData = JSON.parse(localStorage.getItem('radioFavorites'));
    let favorites = {}; // Nossa nova estrutura será um objeto de categorias

    if (Array.isArray(rawFavoritesData)) {
        // Se encontrou um array (formato antigo), migra para o novo formato
        console.log("Migrando favoritos do formato antigo para categorias...");
        if (rawFavoritesData.length > 0) {
            favorites["Geral"] = rawFavoritesData; // Coloca todos os antigos na categoria "Geral"
        }
        // Salva imediatamente no novo formato para evitar remigrações futuras
        localStorage.setItem('radioFavorites', JSON.stringify(favorites));
    } else if (rawFavoritesData && typeof rawFavoritesData === 'object' && !Array.isArray(rawFavoritesData)) {
        // Se já é um objeto (formato novo ou vazio), apenas carrega
        favorites = rawFavoritesData;
    }
    // Se rawFavoritesData for null (primeira vez usando), favorites permanecerá como {}

    let currentStation = null; // Única declaração necessária
    let deferredPrompt; // Única declaração necessária
    let currentHlsInstance = null; // Única declaração necessária


    // const API_BASE_URL = "https://de1.api.radio-browser.info/json/stations/search";
    const API_BASE_URL = 'https://all.api.radio-browser.info/json/stations/search';

    // --- Função para mostrar Notificações (Toast) ---
    function showToast(message, duration = 3000) {
        if (!toastNotificationDiv || !toastMessageSpan) {
            console.error("Elementos do Toast não encontrados no DOM!");
            alert(message); // Fallback
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

        stopStream(); // Garante que qualquer stream anterior seja parado

        const streamUrl = station.url_resolved;
        nowPlayingDiv.textContent = `Carregando: ${station.name}...`;
        updatePlayerControls(false, station.name); // Desabilita botões enquanto carrega

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
        stopStream(); // Garante que o player pare em caso de erro
    }

    function stopStream() {
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
        // Adicionando um pouco mais de informação ao botão de play (opcional)
        if (isPlaying && stationName) {
            playButton.innerHTML = `▶️ Tocando <span class="playing-station-name">(<span class="math-inline">\{stationName\.substring\(0,15\)\}</span>{stationName.length > 15 ? '...' : ''})</span>`;
        } else if (isPlaying) {
            playButton.innerHTML = "▶️ Tocando...";
        } else {
            playButton.innerHTML = "▶️ Play";
        }
    }

    // --- Busca de Estações (API Radio Browser) ---
    async function searchStations(term) {
        if (!term.trim()) {
            searchResultsDiv.innerHTML = "<p>Digite algo para buscar.</p>";
            return;
        }
        searchResultsDiv.innerHTML = "<p>Buscando...</p>";
        try {
            const apiUrl = `<span class="math-inline">\{API\_BASE\_URL\}?name\=</span>{encodeURIComponent(term)}&limit=30&hidebroken=true&order=clickcount&reverse=true`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Erro na API: <span class="math-inline">\{response\.statusText\} \(</span>{response.status})`);
            const stations = await response.json();
            displayStations(stations, searchResultsDiv, "search"); // Para resultados da busca
        } catch (error) {
            console.error("Erro ao buscar estações:", error);
            searchResultsDiv.innerHTML = `<p>Erro ao buscar: ${error.message}. Tente novamente.</p>`;
            showToast(`Erro na busca: ${error.message}`, 4000);
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
                stationuuid: `manual-<span class="math-inline">\{Date\.now\(\)\}\-</span>{Math.random().toString(36).substr(2, 9)}`,
                name: name,
                url_resolved: url,
                favicon: "", // Adicionei favicon vazio para consistência
                country: "N/A", // Adicionei para consistência
                codec: "N/A",   // Adicionei para consistência
                bitrate: "N/A" // Adicionei para consistência
            };
            playStream(manualStation);
            addToFavorites(manualStation); // Pergunta a categoria ao adicionar manualmente
            manualNameInput.value = "";
            manualUrlInput.value = "";
            // showToast(`"${name}" adicionada e tocando!`, 3000); // Removido, pois addToFavorites já mostra toast
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
                showToast(`"<span class="math-inline">\{station\.name\}" já está nos favoritos na categoria "</span>{cat}".`);
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
        showToast(`"<span class="math-inline">\{station\.name\}" adicionada à categoria "</span>{categoryName}"! ⭐`);
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
            showToast(`"<span class="math-inline">\{stationName\}" removida da categoria "</span>{categoryName}".`);
        } else {
            showToast("Erro: Rádio ou categoria não encontrada para remoção.");
        }
    }

    function saveFavorites() {
        try {
            localStorage.setItem("radioFavorites", JSON.stringify(favorites));
        } catch (error) {
            console.error("Erro ao salvar favoritos no localStorage:", error);
            showToast("Erro ao salvar favoritos.", 3000);
        }
    }

    // Passo 6: Função auxiliar isStationInAnyFavorite
    function isStationInAnyFavorite(stationUuid) {
        for (const category in favorites) {
            if (favorites[category] && favorites[category].some(fav => fav.stationuuid === stationUuid)) {
                return true;
            }
        }
        return false;
    }

    // Passo 6: Modificar updateSearchResultsStates
    function updateSearchResultsStates() {
        const searchItems = searchResultsDiv.querySelectorAll(".station-item");
        searchItems.forEach(item => {
            const stationUuid = item.dataset.stationuuid;
            const favButton = item.querySelector(".fav-btn");
            if (favButton) {
                const isFav = isStationInAnyFavorite(stationUuid); // Usa a nova função auxiliar
                favButton.textContent = isFav ? "Favoritado ★" : "Favoritar ☆";
                favButton.classList.toggle("favorited", isFav);
                favButton.title = isFav ? "Já está nos Favoritos" : "Adicionar aos Favoritos"; // Ajuste no title
            }
        });
    }


    // --- Lógica de Exibição ---

    // Modificado: renderFavorites agora é responsável por iterar categorias
    // e chamar displayStationItem para cada item favorito.
    function renderFavorites() {
        favoritesListDiv.innerHTML = '';
        const categoryNames = Object.keys(favorites);

        if (categoryNames.length === 0) {
            favoritesListDiv.innerHTML = '<p style="text-align:center; padding:10px; color:#666;">Nenhuma rádio favorita ainda.</p>';
            return;
        }

        categoryNames.sort().forEach(categoryName => {
            const categoryStations = favorites[categoryName];
            if (categoryStations && categoryStations.length > 0) {
                const categoryTitleElement = document.createElement('h3');
                categoryTitleElement.classList.add('favorite-category-title');
                categoryTitleElement.textContent = categoryName;
                favoritesListDiv.appendChild(categoryTitleElement);

                const stationsContainer = document.createElement('div');
                stationsContainer.classList.add('station-list-items'); // Para estilização individual se necessário

                categoryStations.forEach(station => {
                    // Passa categoryName para displayStationItem para o botão de remover
                    displayStationItem(station, stationsContainer, "favorites", categoryName);
                });
                favoritesListDiv.appendChild(stationsContainer);
                // Adicionando suporte a drag and drop por categoria (simplificado)
                // Para drag and drop entre categorias ou mais complexo, precisaria de mais lógica.
                // Por ora, o drag and drop interno de `displayStations` não se aplicará aqui diretamente.
                // A lógica de drag and drop precisaria ser adaptada para a estrutura de categorias.
            }
        });
        // Re-anexar listeners de drag and drop se a lógica for implementada para categorias
        // setupDragAndDropForCategories(); // Função hipotética
    }


    // displayStations agora é usado principalmente para os resultados da busca (lista plana)
    // E displayStationItem é o construtor de item individual, chamado por renderFavorites e displayStations
    function displayStations(stationsArray, container, type) {
        container.innerHTML = ""; // Limpa o container
        if (!stationsArray || stationsArray.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:10px; color:#666;">${type === "search" ? "Nenhuma estação encontrada." : "Lista vazia."}</p>`;
            return;
        }
        stationsArray.forEach(station => {
            displayStationItem(station, container, type, null); // categoryName é null para busca
        });

        // Lógica de Drag and Drop foi removida daqui, pois se aplicava a uma lista plana de favoritos.
        // Se o drag and drop for para favoritos, ele deve ser gerenciado por renderFavorites
        // ou por uma lógica que entenda as categorias.
    }

    // Passo 5: Ajustar displayStationItem
    function displayStationItem(station, container, type, categoryName = null) {
        if (!station || !station.stationuuid || !station.name) {
            console.warn("Pulando estação inválida ou sem dados essenciais:", station);
            return;
        }
        // Para resultados de busca, é importante ter url_resolved
        if (type === "search" && !station.url_resolved) {
             console.warn("Pulando estação sem URL resolvida na busca:", station.name, station);
             return;
        }

        const itemDiv = document.createElement("div");
        itemDiv.classList.add("station-item");
        itemDiv.dataset.stationuuid = station.stationuuid;
        if (categoryName) itemDiv.dataset.category = categoryName; // Adiciona a categoria ao dataset

        const stationInfoDiv = document.createElement("div");
        stationInfoDiv.classList.add("station-info");
        let faviconHtml = station.favicon ? `<img src="${station.favicon}" alt="logo" class="station-favicon" onerror="this.style.display='none'; this.onerror=null;">` : `<span class="station-favicon-placeholder">🎵</span>`;
        stationInfoDiv.