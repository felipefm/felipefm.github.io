# APP Bíblia

Um aplicativo simples para leitura da Bíblia, com funcionalidades de busca, seleção de livros e capítulos, e troca de traduções.

## Funcionalidades

*   **Seleção de Traduções:** Escolha entre as traduções disponíveis (Ave Maria e João Ferreira de Almeida).
*   **Navegação Fácil:** Navegue facilmente entre livros e capítulos.
*   **Busca Inteligente:** Realize buscas por palavras-chave em toda a Bíblia, filtrando por Antigo Testamento, Novo Testamento ou apenas o livro atual, com opção de busca por palavra exata.
*   **Favoritos:** Marque versículos como favoritos clicando neles. Os favoritos ficam salvos no navegador e podem ser exportados/importados como um arquivo `.json`, garantindo que não se percam mesmo limpando o cache/cookies do navegador.
*   **Copiar e Compartilhar Versículos:** Clique em um versículo para copiar o texto (com referência) para a área de transferência ou compartilhá-lo diretamente (via Web Share API, em dispositivos compatíveis). Para selecionar vários versículos de uma vez, clique no primeiro e depois no último do intervalo desejado — favoritar, copiar e compartilhar passam a valer para o trecho todo.
*   **Ajuste de Fonte:** Aumente ou diminua o tamanho do texto de leitura pelo menu.
*   **Temas:** Escolha entre o tema claro e escuro, com persistência da sua escolha.
*   **PWA/Offline:** Funciona offline após o primeiro carregamento, graças ao Service Worker.

## Como Usar

> **Importante:** não abra o `index.html` com duplo clique (`file://`). O carregamento das traduções usa `fetch()`, que os navegadores bloqueiam por segurança quando a página é aberta direto do disco. Sirva a pasta com um servidor local, por exemplo:
> - VS Code: extensão "Live Server" (botão "Go Live");
> - Node: `npx serve` na pasta do projeto;
> - Python: `python -m http.server` na pasta do projeto.
>
> Depois acesse pelo endereço `http://localhost:...` indicado pela ferramenta escolhida.

1.  Inicie um servidor local na pasta do projeto (veja acima) e abra o endereço indicado no navegador.
2.  Selecione uma tradução da Bíblia.
3.  Selecione um livro e um capítulo para começar a ler.
4.  Use os botões no cabeçalho para navegar, buscar e trocar de tradução.
5.  Clique em um versículo para favoritá-lo, copiá-lo ou compartilhá-lo. Para um intervalo, clique no primeiro e depois no último versículo desejado (o "✕" na barra de ação cancela a seleção).
6.  Use o menu (☰) para abrir seus favoritos, ajustar o tamanho da fonte ou trocar de tema (🎨).
7.  Na tela de Favoritos, use "Exportar" para baixar um backup em `.json` e "Importar" para restaurá-lo depois.
