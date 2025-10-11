document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const mainHeader = document.getElementById('main-header');
    const mainContent = document.querySelector('main');
    const bookNameEl = document.getElementById('book-name');
    const chapterNumberEl = document.getElementById('chapter-number');
    const prevChapterBtn = document.getElementById('prev-chapter');
    const nextChapterBtn = document.getElementById('next-chapter');
    const bookInfo = document.getElementById('book-info');

    // Modais
    const translationModal = document.getElementById('translation-modal');
    const bookNavModal = document.getElementById('book-nav-modal');
    const chapterNavModal = document.getElementById('chapter-nav-modal');
    const searchModal = document.getElementById('search-modal');

    // Botões do Header
    const searchButton = document.getElementById('search-button');
    const chapterNavButton = document.getElementById('chapter-nav-button');
    const translationChangeButton = document.getElementById('translation-change-button');
    const menuButton = document.getElementById('menu-button');
    const mainMenu = document.getElementById('main-menu');

    // Conteúdo dos Modais
    const translationList = document.getElementById('translation-list');
    const oldTestamentList = document.getElementById('old-testament-list');
    const newTestamentList = document.getElementById('new-testament-list');
    const chapterGrid = document.getElementById('chapter-grid');
    const searchInput = document.getElementById('search-input');
    const searchExecuteButton = document.getElementById('search-execute-button');
    const searchResultsContainer = document.getElementById('search-results-container');

    // Botões de Fechar Modais
    const closeButtons = document.querySelectorAll('.close-button');
    const translationBadge = document.getElementById('translation-badge');

    // --- Estado da Aplicação ---
    let currentTranslation = null;
    let currentBookIndex = 0;
    let currentChapter = 0;
    let bibleData = [];
    let lastSearchQuery = '';

    const translations = {
        'almeida': { name: 'João Ferreira de Almeida', file: 'biblia_aa.json' },
        'ave-maria': { name: 'Ave Maria', file: 'bibliaAveMaria.json' }
    };

    // Função para transformar o JSON no formato esperado pelo app
    function transformBibleData(data) {
        // O JSON pode ter "antigoTestamento" e "novoTestamento" ou ser uma lista direta
        const booksSource = data.antigoTestamento ? [...data.antigoTestamento, ...(data.novoTestamento || [])] : data;

        return booksSource.map(book => {
            const bookName = book.name || book.nome; // Compatibilidade com 'name' ou 'nome'
            const bookChapters = book.chapters || book.capitulos; // Compatibilidade com 'chapters' ou 'capitulos'
            return {
            name: bookName,
            abbrev: book.abbrev || bookName.substring(0, 3).toLowerCase(),
            chapters: bookChapters.map(chapter => {
                // Se 'versiculos' é um array de objetos, extrai apenas o 'texto'
                if (chapter.versiculos && typeof chapter.versiculos[0] === 'object') {
                    return chapter.versiculos.map(verse => verse.texto);
                }
                // Se já for um array de strings (para compatibilidade futura)
                return chapter.versiculos || chapter;
            })
        }});
    }
    // --- Funções ---

    // Carrega os dados da Bíblia (tradução)
    async function loadBible(translationKey) {
        try {
            const response = await fetch(`./translations/${translations[translationKey].file}`);
            if (!response.ok) {
                throw new Error(`Erro ao carregar a tradução: ${response.statusText}`);
            }
            const rawData = await response.json();
            if (!rawData) {
                throw new Error("Arquivo JSON vazio ou inválido.");
            }
            bibleData = transformBibleData(rawData); // Transforma os dados
            currentTranslation = translationKey;
            localStorage.setItem('bible_translation', translationKey);
            updateTranslationBadge();
            return true;
        } catch (error) {
            console.error(error);
            mainContent.innerHTML = `<p>Erro ao carregar a tradução. Por favor, tente novamente.</p>`;
            bibleData = []; // Garante que bibleData seja um array vazio em caso de falha
            return false;
        }
    }

    function updateTranslationBadge() {
        if (!currentTranslation || !translations[currentTranslation]) {
            translationBadge.textContent = '';
            translationBadge.classList.remove('badge-animate');
            return;
        }
        translationBadge.textContent = translations[currentTranslation].name;
        translationBadge.classList.add('badge-animate');
        setTimeout(() => translationBadge.classList.remove('badge-animate'), 800);
    }

    // Carrega um capítulo específico
    function loadChapter(bookIndex, chapterIndex) {
        currentBookIndex = bookIndex;
        currentChapter = chapterIndex;

        let book = bibleData[bookIndex];
        // Validação para garantir que bibleData está carregado e o livro/capítulo existem.
        if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0 || !book || !book.chapters || !book.chapters[chapterIndex]) {
            console.warn(`Capítulo inválido solicitado: Livro ${bookIndex}, Capítulo ${chapterIndex}. Carregando Gênesis 1.`);
            currentBookIndex = 0; // Atualiza o índice do livro atual
            currentChapter = 0;   // Atualiza o índice do capítulo atual
            // Reatribui o livro para o padrão seguro (Gênesis)
            book = bibleData[currentBookIndex];
        }
        
        // Se mesmo após a tentativa de correção o livro não for encontrado (ex: bibleData vazio), não faz nada.
        if (!book || !book.chapters || !book.chapters[currentChapter]) {
            console.error("Falha crítica: bibleData está vazio ou o livro padrão (Gênesis 1) não foi encontrado APÓS TENTATIVA DE CORREÇÃO.");
            return;
        }

        // Atualiza os estados globais com os valores (potencialmente corrigidos)
        currentBookIndex = bookIndex;
        currentChapter = chapterIndex;

        book = bibleData[currentBookIndex]; // Garante que 'book' reflete os índices atuais

        const chapter = book.chapters[chapterIndex]; // Agora 'book' está garantido de ser válido

        bookNameEl.textContent = book.name;
        chapterNumberEl.textContent = chapterIndex + 1;

        let chapterHtml = '';
        chapter.forEach((verse, index) => {
            chapterHtml += `<p id="v-${index}"><span class="verse-number">${index + 1}</span> ${verse}</p>`; // Adicionado ID para cada versículo
        });

        mainContent.innerHTML = chapterHtml;
        updateChapterControls();

        // Salva o estado atual (usando os índices atuais, que podem ter sido corrigidos)
        localStorage.setItem('bible_book', currentBookIndex);
        localStorage.setItem('bible_chapter', currentChapter);
    }

    // Atualiza os botões de navegação de capítulo
    function updateChapterControls() {
        if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0 || !bibleData[currentBookIndex] || !bibleData[currentBookIndex].chapters) {
            prevChapterBtn.disabled = true;
            nextChapterBtn.disabled = true;
            return;
        }
        prevChapterBtn.disabled = currentChapter === 0; // currentChapter já é o índice atual
        nextChapterBtn.disabled = currentChapter >= bibleData[currentBookIndex].chapters.length - 1; // currentBookIndex já é o índice atual
    }

    // Popula a lista de livros no modal
    function populateBookList() {
        oldTestamentList.innerHTML = '';
        newTestamentList.innerHTML = '';
        bibleData.forEach((book, index) => {
            if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0) {
                console.warn("bibleData está vazio. Não é possível popular a lista de livros.");
                oldTestamentList.innerHTML = '<p>Nenhuma tradução carregada. Selecione uma tradução primeiro.</p>';
                return;
            }
            const listItem = document.createElement('li');
            listItem.textContent = book.name;
            listItem.dataset.bookIndex = index; // 'name' agora é a propriedade correta
            if (index < 39) { // Assumindo 39 livros no AT
                oldTestamentList.appendChild(listItem);
            } else {
                newTestamentList.appendChild(listItem);
            }
        });
    }

    // Popula a grade de capítulos no modal
    function populateChapterGrid() {
        chapterGrid.innerHTML = '';
        if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0 || !bibleData[currentBookIndex]) {
            console.warn("bibleData está vazio ou livro atual inválido. Não é possível popular a grade de capítulos.");
            chapterGrid.innerHTML = '<p>Nenhuma tradução ou livro carregado.</p>';
            return;
        }
        const book = bibleData[currentBookIndex];
        book.chapters.forEach((_, index) => {
            const chapterItem = document.createElement('div');
            chapterItem.classList.add('chapter-grid-item');
            chapterItem.textContent = index + 1;
            chapterItem.dataset.chapterIndex = index;
            chapterGrid.appendChild(chapterItem);
        });
    }

    // Funções de Modal
    function openModal(modal) {
        modal.style.display = 'block';
    }

    function closeModal(modal) {
        modal.style.display = 'none';
    }

    function closeMenu() {
        mainMenu.classList.add('hidden');
    }

    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(closeModal);
    }

    // --- Lógica de Busca ---
    function performSearch() {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 3) {
            searchResultsContainer.innerHTML = '<p>Digite pelo menos 3 caracteres para buscar.</p>';
            return;
        }

        if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0) {
            searchResultsContainer.innerHTML = '<p>Nenhuma tradução carregada para realizar a busca.</p>';
            return;
        }

        // Armazena a última busca para usar no destaque
        lastSearchQuery = query;

        searchResultsContainer.innerHTML = '<p>Buscando...</p>';
        
        // Usar setTimeout para não bloquear a UI
        setTimeout(() => {
            const results = [];
            const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

            bibleData.forEach((book, bookIndex) => {
                // Busca no nome do livro
                if (book.name.toLowerCase().includes(query)) {
                    results.push({
                        bookIndex: bookIndex,
                        chapterIndex: 0, // Aponta para o primeiro capítulo
                        verseIndex: 0, // Leva para o início do livro
                        text: `Livro: ${book.name}`,
                        ref: book.name
                    });
                }

                // Garante que o livro tem capítulos antes de iterar
                if (book.chapters) {
                    book.chapters.forEach((chapter, chapterIndex) => {
                        chapter.forEach((verse, verseIndex) => {
                            if (verse.toLowerCase().includes(query)) {
                                const reference = `${book.name} ${chapterIndex + 1}:${verseIndex + 1}`; // 'name' agora é a propriedade correta
                                const highlightedVerse = verse.replace(regex, `<span class="search-highlight">$&</span>`);
                                results.push({
                                    bookIndex,
                                    chapterIndex,
                                    verseIndex,
                                    text: `<p>${highlightedVerse}</p>`,
                                    ref: reference
                                });
                            }
                        });
                    });
                }
            });

            displaySearchResults(results);
        }, 50); // Pequeno delay para atualizar a UI com "Buscando..."
    }

    function displaySearchResults(results) {
        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<p>Nenhum resultado encontrado.</p>';
            return;
        }

        let resultsHtml = `<h3>${results.length} resultado(s) encontrado(s)</h3>`;
        results.forEach(result => {
            resultsHtml += `
                <div class="search-result-item" data-book="${result.bookIndex}" data-chapter="${result.chapterIndex}" data-verse="${result.verseIndex}">
                    <strong>${result.ref}</strong>
                    ${result.text}
                </div>
            `;
        });
        searchResultsContainer.innerHTML = resultsHtml;
    }

    // --- Event Listeners ---

    // Navegação de capítulos
    prevChapterBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Impede que o clique "borbulhe" para o #book-info
        if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0 || !bibleData[currentBookIndex] || !bibleData[currentBookIndex].chapters) {
            console.warn("Nenhuma tradução ou livro carregado para navegar entre capítulos.");
            return;
        }
        if (currentChapter > 0) {
            loadChapter(currentBookIndex, currentChapter - 1);
        }
    });

    nextChapterBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Impede que o clique "borbulhe" para o #book-info
        if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0 || !bibleData[currentBookIndex] || !bibleData[currentBookIndex].chapters) {
            console.warn("Nenhuma tradução ou livro carregado para navegar entre capítulos.");
            return;
        }
        if (currentChapter < bibleData[currentBookIndex].chapters.length - 1) {
            loadChapter(currentBookIndex, currentChapter + 1);
        }
    });

    // Abrir modais
    // Adiciona verificação para garantir que bibleData está carregado
    // antes de tentar popular a lista de livros.
    bookInfo.addEventListener('click', () => {
        populateBookList();
        openModal(bookNavModal);
    });

    chapterNavButton.addEventListener('click', () => {
        populateChapterGrid();
        openModal(chapterNavModal);
    });

    searchButton.addEventListener('click', () => {
        openModal(searchModal);
        searchInput.focus();
    });

    translationChangeButton.addEventListener('click', () => {
        openModal(translationModal);
    });

    // Abrir/Fechar menu dropdown
    menuButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Impede que o clique feche o menu imediatamente
        mainMenu.classList.toggle('hidden');
    });

    // Fechar modais
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            closeAllModals();
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            closeAllModals();
        }
        // Fecha o menu se clicar fora dele
        if (!mainMenu.classList.contains('hidden') && !event.target.closest('#menu-container')) {
            closeMenu();
        }
    });

    // Seleção nos modais
    translationList.addEventListener('click', async (event) => {
        const target = event.target.closest('.translation-item');
        if (target) {
            const translationKey = target.dataset.key;
            const success = await loadBible(translationKey);
            if (success) {
                // Após carregar, decide o que mostrar
                // Garante que bibleData está populado antes de tentar carregar capítulo
                if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0) {
                    console.error("bibleData vazio após carregamento bem-sucedido. Algo deu errado.");
                    closeAllModals();
                    return;
                }
                const savedBook = localStorage.getItem('bible_book');
                const savedChapter = localStorage.getItem('bible_chapter');

                const bookToLoad = savedBook ? parseInt(savedBook) : 0;
                const chapterToLoad = savedChapter ? parseInt(savedChapter) : 0;
                if (bibleData[bookToLoad] && bibleData[bookToLoad].chapters && bibleData[bookToLoad].chapters[chapterToLoad]) {
                    loadChapter(bookToLoad, chapterToLoad);
                } else { // Fallback para Gênesis 1 se o estado salvo for inválido para a nova tradução
                    loadChapter(0, 0); // Padrão: Gênesis 1
                }
                mainHeader.classList.remove('hidden');
                mainContent.classList.remove('hidden');
                closeAllModals();
                closeMenu();
            }
        }
    });

    bookNavModal.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            const bookIndex = parseInt(event.target.dataset.bookIndex);
            // Garante que bibleData está populado e o livro é válido
            if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0 || !bibleData[bookIndex]) {
                console.error("Tentativa de selecionar livro com bibleData vazio ou livro inválido.");
                return;
            }
            currentBookIndex = bookIndex;
            closeModal(bookNavModal);
            populateChapterGrid();
            openModal(chapterNavModal);
            closeMenu();
        }
    });

    chapterGrid.addEventListener('click', (event) => {
        const target = event.target.closest('.chapter-grid-item');
        if (target) {
            // Garante que bibleData está populado e o capítulo é válido
            if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0 || !bibleData[currentBookIndex] || !bibleData[currentBookIndex].chapters) {
                console.error("Tentativa de selecionar capítulo com bibleData vazio ou livro inválido.");
                return;
            }
            const chapterIndex = parseInt(target.dataset.chapterIndex);
            loadChapter(currentBookIndex, chapterIndex);
            closeAllModals();
            closeMenu();
        }
    });

    // Eventos de Busca
    searchExecuteButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            performSearch();
        }
    });

    searchResultsContainer.addEventListener('click', (event) => {
        const target = event.target.closest('.search-result-item');
        if (target) {
            const bookIndex = parseInt(target.dataset.book);
            const chapterIndex = parseInt(target.dataset.chapter);
            const verseIndex = parseInt(target.dataset.verse);

            // Garante que bibleData está populado e o resultado da busca é válido
            if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0 || !bibleData[bookIndex] || !bibleData[bookIndex].chapters || !bibleData[bookIndex].chapters[chapterIndex]) {
                console.error("Tentativa de navegar para resultado de busca com bibleData vazio ou inválido.");
                return;
            }

            loadChapter(bookIndex, chapterIndex);
            closeAllModals();
            closeMenu();

            // Rola para o versículo específico e o destaca
            setTimeout(() => {
                const verseElement = document.getElementById(`v-${verseIndex}`);
                if (verseElement) {
                    verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    verseElement.classList.add('verse-highlight-animation');

                    const verseNumberSpan = verseElement.querySelector('.verse-number');
                    const originalText = verseElement.textContent.substring(verseNumberSpan.textContent.length).trim();

                    // Destaque temporário para a palavra/termo buscado
                    if (lastSearchQuery && verseNumberSpan) {
                        const regex = new RegExp(lastSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                        const highlightedText = originalText.replace(regex, `<span class="word-highlight-animation">$&</span>`);
                        
                        // Remonta o HTML do versículo de forma segura
                        verseElement.innerHTML = `<span class="verse-number">${verseNumberSpan.textContent}</span> ${highlightedText}`;
                    }

                    // Limpa os destaques (palavra e versículo) após a animação
                    setTimeout(() => {
                        // Restaura o texto original sem o destaque da palavra
                        if (verseNumberSpan) {
                            verseElement.innerHTML = `<span class="verse-number">${verseNumberSpan.textContent}</span> ${originalText}`;
                        }
                        verseElement.classList.remove('verse-highlight-animation');
                    }, 3000);
                }
            }, 100); // Pequeno delay para garantir que o DOM foi atualizado
        }
    });

    // --- Inicialização ---

    function initializeTheme() {
        // Adiciona o botão de tema dinamicamente para não poluir o HTML
        const themeSwitcher = document.createElement('button');
        themeSwitcher.id = 'theme-switcher';
        themeSwitcher.setAttribute('aria-label', 'Alternar tema');
        themeSwitcher.innerHTML = '🎨';
        document.getElementById('main-menu').appendChild(themeSwitcher);

        const savedTheme = localStorage.getItem('bible_theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);

        themeSwitcher.addEventListener('click', () => {
            let currentTheme = document.documentElement.getAttribute('data-theme');
            let newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('bible_theme', newTheme);
            closeMenu();
        });
    }

    async function initializeApp() {
        initializeTheme();

        // Popula o modal de tradução
        translationList.innerHTML = Object.keys(translations).map(key => `
            <div class="translation-item" data-key="${key}">
                ${translations[key].name}
            </div>
        `).join('');

        const savedTranslation = localStorage.getItem('bible_translation');

        if (savedTranslation && translations[savedTranslation]) {
            // Espera o carregamento da Bíblia ser concluído
            const success = await loadBible(savedTranslation);

            if (success) {
                const savedBook = localStorage.getItem('bible_book');
                const savedChapter = localStorage.getItem('bible_chapter');
                const book = savedBook ? parseInt(savedBook) : 0;
                const chapter = savedChapter ? parseInt(savedChapter) : 0;
                loadChapter(book, chapter);
                mainHeader.classList.remove('hidden');
                mainContent.classList.remove('hidden');
                updateTranslationBadge();
            } else {
                // Se o carregamento falhar (ex: arquivo JSON não encontrado), abre o modal de seleção.
                openModal(translationModal);
            }
        } else {
            // Se não houver nada salvo, mostra o modal de tradução
            openModal(translationModal);
        }

        // Registra o Service Worker para funcionalidades PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then(registration => {
                    console.log('Service Worker registrado com sucesso:', registration);
                })
                .catch(error => {
                    console.log('Falha ao registrar o Service Worker:', error);
                });
        }
    }

    initializeApp();
});