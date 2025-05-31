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
    let currentStation = null;
    let favorites = JSON.parse(localStorage.getItem("radioFavorites")) || [];
    let deferredPrompt;
    let currentHlsInstance = null;
    const API_BASE_URL = "https://de1.api.radio-browser.info/json/stations/search";

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
            displayStations(stations, searchResultsDiv, "search");
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
                favicon: "",
            };
            playStream(manualStation);
            addToFavorites(manualStation);
            manualNameInput.value = "";
            manualUrlInput.value = "";
            showToast(`"${name}" adicionada e tocando!`, 3000);
        } else {
            showToast("Preencha o nome e a URL da rádio.", 3000);
        }
    }

    // --- Gerenciamento de Favoritos ---
    function addToFavorites(station) {
        if (!favorites.find(fav => fav.stationuuid === station.stationuuid)) {
            favorites.push(station);
            saveFavorites();
            renderFavorites();
            updateSearchResultsStates();
            showToast(`"${station.name}" adicionada aos favoritos! ⭐`, 2000);
        } else {
            showToast(`"${station.name}" já está nos favoritos.`, 2000);
        }
    }

    function removeFromFavorites(stationUuid) {
        const stationIndex = favorites.findIndex(fav => fav.stationuuid === stationUuid);
        if (stationIndex > -1) {
            const stationName = favorites[stationIndex].name;
            favorites.splice(stationIndex, 1);
            saveFavorites();
            renderFavorites();
            updateSearchResultsStates();
            showToast(`"${stationName}" removida dos favoritos.`, 2000);
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

    function renderFavorites() {
        displayStations(favorites, favoritesListDiv, "favorites");
    }

    function updateSearchResultsStates() {
        const searchItems = searchResultsDiv.querySelectorAll(".station-item");
        searchItems.forEach(item => {
            const stationUuid = item.dataset.stationuuid;
            const favButton = item.querySelector(".fav-btn");
            if (favButton) {
                const isFav = favorites.some(fav => fav.stationuuid === stationUuid);
                favButton.textContent = isFav ? "Favoritado ★" : "Favoritar ☆";
                favButton.classList.toggle("favorited", isFav);
                favButton.title = isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos";
            }
        });
    }

    // --- Lógica de Exibição das Estações (Renderização) ---
    function displayStations(stations, container, type) {
        container.innerHTML = "";
        if (!stations || stations.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:10px; color:#666;">${type === "favorites" ? "Nenhuma rádio favorita ainda." : "Nenhuma estação encontrada."}</p>`;
            return;
        }

        stations.forEach((station) => {
            if (!station || !station.stationuuid || !station.name) {
                console.warn("Pulando estação inválida:", station);
                return;
            }
            if (type !== "favorites" && !station.url_resolved) {
                 console.warn("Pulando estação sem URL resolvida na busca:", station.name);
                 return;
            }

            const itemDiv = document.createElement("div");
            itemDiv.classList.add("station-item");
            itemDiv.dataset.stationuuid = station.stationuuid;

            const stationInfoDiv = document.createElement("div");
            stationInfoDiv.classList.add("station-info");
            let faviconHtml = station.favicon ? `<img src="${station.favicon}" alt="logo" class="station-favicon" onerror="this.style.display='none'; this.onerror=null;">` : "";
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
                itemDiv.draggable = true;
                const dragHandle = document.createElement("span");
                dragHandle.textContent = "☰";
                dragHandle.classList.add("drag-handle");
                dragHandle.title = "Arraste para reordenar";
                actionsDiv.appendChild(dragHandle);

                const removeFavBtn = document.createElement("button");
                removeFavBtn.textContent = "Remover";
                removeFavBtn.classList.add("remove-fav-btn");
                removeFavBtn.title = "Remover dos Favoritos";
                removeFavBtn.onclick = (e) => { e.stopPropagation(); removeFromFavorites(station.stationuuid); };
                actionsDiv.appendChild(removeFavBtn);

                itemDiv.addEventListener("dragstart", handleDragStart);
                itemDiv.addEventListener("dragend", handleDragEnd);
                itemDiv.addEventListener("dragover", handleDragOver);
                itemDiv.addEventListener("dragleave", handleDragLeave);
                itemDiv.addEventListener("drop", handleDrop);

            } else {
                const isFavorite = favorites.some(fav => fav.stationuuid === station.stationuuid);
                const favBtn = document.createElement("button");
                favBtn.textContent = isFavorite ? "Favoritado ★" : "Favoritar ☆";
                favBtn.classList.add("fav-btn");
                favBtn.classList.toggle("favorited", isFavorite);
                favBtn.title = isFavorite ? "Remover dos Favoritos" : "Adicionar aos Favoritos";
                favBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (favorites.some(fav => fav.stationuuid === station.stationuuid)) {
                        removeFromFavorites(station.stationuuid);
                    } else {
                        addToFavorites(station);
                    }
                    const nowIsFavorite = favorites.some(fav => fav.stationuuid === station.stationuuid);
                    favBtn.textContent = nowIsFavorite ? "Favoritado ★" : "Favoritar ☆";
                    favBtn.classList.toggle("favorited", nowIsFavorite);
                    favBtn.title = nowIsFavorite ? "Remover dos Favoritos" : "Adicionar aos Favoritos";
                };
                actionsDiv.appendChild(favBtn);
            }

            itemDiv.appendChild(stationInfoDiv);
            itemDiv.appendChild(actionsDiv);
            container.appendChild(itemDiv);
        });

        if (type === "favorites") {
            container.addEventListener("dragover", handleDragOverContainer);
            container.addEventListener("drop", handleDropContainer);
        }
    }

    // --- Funções Auxiliares de Drag and Drop ---
    let draggedItem = null;

    function handleDragStart(e) {
        draggedItem = e.target;
        e.dataTransfer.setData("text/plain", draggedItem.dataset.stationuuid);
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => e.target.classList.add("dragging"), 0);
    }

    function handleDragEnd(e) {
        if (e.target) e.target.classList.remove("dragging");
        document.querySelectorAll(".station-item.drag-over-top, .station-item.drag-over-bottom").forEach(el => {
            el.classList.remove("drag-over-top", "drag-over-bottom");
        });
        draggedItem = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const targetItem = e.currentTarget;
        if (targetItem !== draggedItem) {
            const rect = targetItem.getBoundingClientRect();
            const halfwayY = rect.top + rect.height / 2;
            // Clear previous indicators before setting new one
            const parent = targetItem.parentNode;
            if (parent) {
                parent.querySelectorAll('.station-item').forEach(item => {
                    item.classList.remove('drag-over-top', 'drag-over-bottom');
                });
            }
            targetItem.classList.toggle("drag-over-top", e.clientY < halfwayY);
            targetItem.classList.toggle("drag-over-bottom", e.clientY >= halfwayY);
        }
    }

    function handleDragLeave(e) {
        // Check if the mouse is truly leaving the element, not just moving over a child
        if (!e.currentTarget.contains(e.relatedTarget)) {
             e.currentTarget.classList.remove("drag-over-top", "drag-over-bottom");
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const targetItem = e.currentTarget;
        targetItem.classList.remove("drag-over-top", "drag-over-bottom");

        const draggedUuid = e.dataTransfer.getData("text/plain");
        const targetUuid = targetItem.dataset.stationuuid;

        if (draggedUuid === targetUuid || !draggedItem) return;

        const draggedIndex = favorites.findIndex(fav => fav.stationuuid === draggedUuid);
        let targetIndex = favorites.findIndex(fav => fav.stationuuid === targetUuid);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const [movedItem] = favorites.splice(draggedIndex, 1);
        targetIndex = favorites.findIndex(fav => fav.stationuuid === targetUuid); // Recalculate index after splice

        if (targetIndex === -1) { // Should not happen if target wasn't the dragged item
            favorites.push(movedItem); // Add to end as fallback
        } else {
            const rect = targetItem.getBoundingClientRect();
            const halfwayY = rect.top + rect.height / 2;
            const insertBefore = e.clientY < halfwayY;
            favorites.splice(insertBefore ? targetIndex : targetIndex + 1, 0, movedItem);
        }

        saveFavorites();
        renderFavorites();
        showToast("Ordem dos favoritos atualizada.", 1500);
    }

    function handleDragOverContainer(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }

    function handleDropContainer(e) {
        e.preventDefault();
        if (e.target === favoritesListDiv) {
            const draggedUuid = e.dataTransfer.getData("text/plain");
            const draggedIndex = favorites.findIndex(fav => fav.stationuuid === draggedUuid);
            if (draggedIndex !== -1) {
                const [movedItem] = favorites.splice(draggedIndex, 1);
                favorites.push(movedItem);
                saveFavorites();
                renderFavorites();
                showToast("Favorito movido para o final.", 1500);
            }
        }
        document.querySelectorAll(".station-item.drag-over-top, .station-item.drag-over-bottom").forEach(el => {
            el.classList.remove("drag-over-top", "drag-over-bottom");
        });
    }

    // --- Funções de Exportar/Importar Favoritos ---
    function exportFavorites() {
        if (favorites.length === 0) {
            showToast("Não há favoritos para exportar.", 2000);
            return;
        }
        try {
            const jsonString = JSON.stringify(favorites, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "radio_favoritos.json";
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
                if (!Array.isArray(importedData)) throw new Error("Arquivo não contém um array.");

                const isValid = importedData.every(item =>
                    item && typeof item.stationuuid === "string" && typeof item.name === "string" && typeof item.url_resolved === "string"
                );
                if (!isValid) throw new Error("Dados inválidos no arquivo.");

                if (favorites.length > 0 && !confirm("Isso substituirá seus favoritos atuais. Continuar?")) {
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
            themeToggleButton.textContent = "☀️"; // Ícone Sol
            themeToggleButton.title = "Mudar para Tema Claro";
        } else {
            document.body.classList.remove("dark-theme");
            themeToggleButton.textContent = "🌙"; // Ícone Lua
            themeToggleButton.title = "Mudar para Tema Escuro";
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
        // Listener para mudança de preferência do sistema (opcional)
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
             // Só aplica se não houver preferência salva pelo usuário
             if (!localStorage.getItem("radioTheme")) {
                 applyTheme(e.matches ? "dark" : "light");
             }
        });
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
    manualAddButton.addEventListener("click", addManualStation);
    playButton.addEventListener("click", () => {
        if (currentStation && audioPlayer.paused) {
             if (currentStation.url_resolved.includes(".m3u8") && !currentHlsInstance) {
                 playStream(currentStation);
             } else {
                 audioPlayer.play().catch(error => handlePlayError(currentStation, error));
             }
        } else if (!currentStation) {
             showToast("Nenhuma rádio selecionada para tocar.", 2000);
        }
    });
    stopButton.addEventListener("click", stopStream);
    volumeControl.addEventListener("input", (e) => audioPlayer.volume = e.target.value);
    audioPlayer.addEventListener("ended", stopStream);
    audioPlayer.addEventListener("error", (e) => {
        console.error("Erro no elemento <audio>:", e);
        if (currentStation && !currentHlsInstance) {
            showToast(`Erro no stream de "${currentStation.name}".`, 3000);
            stopStream();
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
    renderFavorites();
    updatePlayerControls(false, null);
    setupToggleSections();
    registerServiceWorker();
    setupInstallPrompt();

}); // Fim do DOMContentLoaded

