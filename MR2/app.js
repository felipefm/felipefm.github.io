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
            playButton.innerHTML = `▶️ Tocando <span class="playing-station-name">(${stationName.substring(0,15)}${stationName.length > 15 ? '...' : ''})</span>`;
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
            const apiUrl = `${API_BASE_URL}?name=${encodeURIComponent(term)}&limit=30&hidebroken=true&order=clickcount&reverse=true`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Erro na API: ${response.statusText} (${response.status})`);
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
                stationuuid: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
        stationInfoDiv.innerHTML = `
            ${faviconHtml}
            <div>
                <span class="name">${station.name}</span>
                <span class="details">${station.country || ""} ${station.codec ? `(${station.codec}, ${station.bitrate || "?"}k)` : ""}</span>
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
            // Opcional: Adicionar handle de drag and drop para itens favoritos se for reimplementar
            // const dragHandle = document.createElement("span");
            // dragHandle.textContent = "☰";
            // dragHandle.classList.add("drag-handle");
            // dragHandle.title = "Arraste para reordenar";
            // actionsDiv.appendChild(dragHandle);

            const removeFavBtn = document.createElement("button");
            removeFavBtn.textContent = "Remover";
            removeFavBtn.classList.add("remove-fav-btn");
            removeFavBtn.title = `Remover ${station.name} dos Favoritos`;
            removeFavBtn.onclick = (e) => {
                e.stopPropagation();
                if (categoryName) { // categoryName deve ser passado por renderFavorites
                    removeFromFavorites(station.stationuuid, categoryName);
                } else {
                    // Fallback caso categoryName não seja passado (deve ser evitado)
                    console.error("Tentativa de remover favorito sem categoryName:", station.name);
                    showToast("Erro ao remover: categoria não especificada.", 3000);
                }
            };
            actionsDiv.appendChild(removeFavBtn);

            // Listeners de Drag and Drop foram removidos daqui, pois a lógica precisa ser
            // refeita para funcionar com categorias.
            // itemDiv.addEventListener("dragstart", handleDragStart);
            // ... outros listeners de drag ...

        } else { // type === "search"
            const isFavorite = isStationInAnyFavorite(station.stationuuid);
            const favBtn = document.createElement("button");
            favBtn.textContent = isFavorite ? "Favoritado ★" : "Favoritar ☆";
            favBtn.classList.add("fav-btn");
            favBtn.classList.toggle("favorited", isFavorite);
            favBtn.title = isFavorite ? `${station.name} já está nos Favoritos` : `Adicionar ${station.name} aos Favoritos`;
            favBtn.onclick = (e) => {
                e.stopPropagation();
                // addToFavorites agora lida com perguntar a categoria e verificar duplicatas
                addToFavorites(station);
                // updateSearchResultsStates(); // Chamado dentro de addToFavorites e removeFromFavorites
            };
            actionsDiv.appendChild(favBtn);
        }

        itemDiv.appendChild(stationInfoDiv);
        itemDiv.appendChild(actionsDiv);
        container.appendChild(itemDiv);
    }


    // --- Funções Auxiliares de Drag and Drop (PRECISAM SER REFEITAS PARA CATEGORIAS) ---
    // A lógica atual de drag and drop (handleDragStart, handleDrop, etc.)
    // foi projetada para uma lista plana de favoritos (favorites como um array).
    // Para funcionar com a nova estrutura de categorias (favorites como um objeto),
    // essa lógica precisaria ser significativamente reescrita.
    // Por exemplo, para permitir arrastar entre categorias ou reordenar dentro de uma categoria.
    // Comentando por enquanto para evitar erros, já que não foi o foco da solicitação atual.
    /*
    let draggedItem = null;
    function handleDragStart(e) { ... }
    function handleDragEnd(e) { ... }
    function handleDragOver(e) { ... }
    function handleDragLeave(e) { ... }
    function handleDrop(e) { ... }
    function handleDragOverContainer(e) { ... }
    function handleDropContainer(e) { ... }
    */

    // --- Funções de Exportar/Importar Favoritos ---
    // Modificar para exportar/importar a nova estrutura de objeto
    function exportFavorites() {
        if (Object.keys(favorites).length === 0) { // Verifica se o objeto de favoritos está vazio
            showToast("Não há favoritos para exportar.", 2000);
            return;
        }
        try {
            const jsonString = JSON.stringify(favorites, null, 2); // favorites já é o objeto
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "radio_favoritos_categorias.json"; // Nome do arquivo atualizado
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
                // Validação básica para a nova estrutura (objeto de categorias)
                if (typeof importedData !== 'object' || Array.isArray(importedData)) {
                    throw new Error("Arquivo não contém um objeto de categorias válido.");
                }

                // Validação mais detalhada (opcional, mas recomendada)
                for (const category in importedData) {
                    if (!Array.isArray(importedData[category])) {
                        throw new Error(`Categoria "${category}" não contém uma lista de estações.`);
                    }
                    const isValidCategory = importedData[category].every(item =>
                        item && typeof item.stationuuid === "string" &&
                        typeof item.name === "string" // && typeof item.url_resolved === "string" // url_resolved pode não estar em todos os favoritos antigos
                    );
                    if (!isValidCategory) {
                        throw new Error(`Dados de estação inválidos na categoria "${category}".`);
                    }
                }

                if (Object.keys(favorites).length > 0 && !confirm("Isso substituirá seus favoritos atuais. Continuar?")) {
                    event.target.value = null;
                    return;
                }

                favorites = importedData; // Substitui com o novo objeto de categorias
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
                // Inicializa o estado baseado na classe 'hidden-section' (se já estiver no HTML)
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
                themeToggleButton.textContent = "☀️"; // Ícone Sol
                themeToggleButton.title = "Mudar para Tema Claro";
            }
        } else {
            document.body.classList.remove("dark-theme");
            if (themeToggleButton) {
                themeToggleButton.textContent = "🌙"; // Ícone Lua
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
        if (window.matchMedia) { // Verifica se matchMedia é suportado
            window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
                 if (!localStorage.getItem("radioTheme")) { // Só aplica se não houver preferência salva
                     applyTheme(e.matches ? "dark" : "light");
                 }
            });
        }
    }

    // --- PWA: Service Worker e Instalação ---
    function registerServiceWorker() {
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => {
                navigator.serviceWorker.register("./sw.js") // Caminho relativo à raiz do site
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
    if (manualAddButton) manualAddButton.addEventListener("click", addManualStation); // Verifica se existe

    playButton.addEventListener("click", () => {
        if (currentStation && audioPlayer.paused) {
             if (currentStation.url_resolved.includes(".m3u8") && !currentHlsInstance) { // Se HLS e instância não existe, recria
                 playStream(currentStation);
             } else if (currentStation.url_resolved.includes(".m3u8") && currentHlsInstance) { // Se HLS e instância existe
                 audioPlayer.play().catch(error => handlePlayError(currentStation, error));
             }
              else { // Não HLS
                 audioPlayer.play().catch(error => handlePlayError(currentStation, error));
             }
        } else if (!currentStation) {
             showToast("Nenhuma rádio selecionada para tocar.", 2000);
        }
    });
    stopButton.addEventListener("click", stopStream);
    volumeControl.addEventListener("input", (e) => audioPlayer.volume = e.target.value);

    // Mudança para addEventListener para consistência e evitar sobrescrita
    audioPlayer.addEventListener("ended", stopStream);
    audioPlayer.addEventListener("error", (e) => {
        console.error("Erro no elemento <audio>:", e);
        // Evita mostrar toast se HLS.js já tratou o erro e parou o stream
        if (currentStation && !currentHlsInstance) { // Só mostra toast se não for um erro HLS já tratado
            showToast(`Erro no stream de "${currentStation.name}".`, 3000);
            stopStream(); // Garante que pare em caso de erro do elemento audio
        } else if (currentStation && currentHlsInstance) {
            console.log("Erro no elemento audio, HLS.js está ativo. Verificar logs do HLS para detalhes.");
            // HLS.js tem seu próprio tratamento de erro que chama stopStream se fatal.
        }
    });


    if (exportFavoritesButton) exportFavoritesButton.addEventListener("click", exportFavorites);
    if (importFavoritesButton && importFileInput) {
        importFavoritesButton.addEventListener("click", () => importFileInput.click());
        importFileInput.addEventListener("change", importFavorites);
    }
    if (themeToggleButton) themeToggleButton.addEventListener("click", toggleTheme);

    // --- Inicialização da Aplicação ---
    initializeTheme(); // Aplica o tema antes de renderizar
    renderFavorites(); // Renderiza favoritos com categorias
    updatePlayerControls(false, null); // Estado inicial dos controles do player
    if (typeof setupToggleSections === "function") setupToggleSections(); // Verifica se a função existe
    registerServiceWorker();
    setupInstallPrompt();

}); // Fim do DOMContentLoaded