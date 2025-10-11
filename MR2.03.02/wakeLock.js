// Variável para armazenar a instância do wake lock
let wakeLock = null;

/**
 * Tenta solicitar o Screen Wake Lock.
 * Se bem-sucedido, a tela permanecerá ligada.
 */
async function requestWakeLock() {
    // Verifica se a API Screen Wake Lock é suportada.
    if (!('wakeLock' in navigator)) {
        console.warn('API Screen Wake Lock não é suportada neste navegador.');
        return; // Sai da função se a API não for suportada.
    }

    // Se já houver um wake lock ativo, não é necessário solicitar novamente.
    // Isso evita múltiplas requisições desnecessárias.
    if (wakeLock !== null) {
        console.log('Screen Wake Lock já está ativo.');
        return;
    }

    try {
        // Solicita o wake lock para a tela.
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Screen Wake Lock está ativo.');

        // Adiciona um ouvinte para o evento 'release'.
        // Isso nos permite saber quando o wake lock foi liberado por algum motivo (ex: usuário mudou de aba).
        wakeLock.addEventListener('release', () => {
            console.log('Screen Wake Lock foi liberado.');
            // Reseta a variável para null, indicando que não há mais um wake lock ativo.
            wakeLock = null;
            // Opcional: Você pode querer re-solicitar o wake lock aqui se for crucial mantê-lo ativo,
            // mas geralmente o evento 'visibilitychange' já cuida disso.
        });
    } catch (err) {
        // Captura e loga quaisquer erros que ocorram durante a requisição.
        console.error(`Erro ao solicitar Screen Wake Lock: ${err.name} - ${err.message}`);
        // Assegura que a variável wakeLock seja null em caso de falha.
        wakeLock = null;
    }
}

/**
 * Tenta liberar o Screen Wake Lock.
 */
function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        console.log('Screen Wake Lock liberado manualmente.');
        wakeLock = null; // Reseta a variável após a liberação.
    }
}

// ====================================================================
// Gerenciamento de Ciclo de Vida do Wake Lock
// ====================================================================

// Solicita o wake lock quando a página é totalmente carregada.
document.addEventListener('DOMContentLoaded', () => {
    requestWakeLock();
});

// Resolicita o wake lock quando a página volta a ser visível.
// Isso é crucial porque o wake lock pode ser liberado automaticamente
// quando a página fica em segundo plano ou o navegador perde o foco.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Somente solicita se não houver um wake lock ativo.
        // Isso evita erros caso o navegador tente reativar um wake lock que já está ativo.
        if (wakeLock === null) {
            console.log('Página se tornou visível, tentando re-solicitar Screen Wake Lock...');
            requestWakeLock();
        }
    } else {
        // Opcional: Libera o wake lock quando a página não está visível.
        // Isso pode economizar bateria em alguns cenários, embora o navegador
        // já faça isso automaticamente em muitos casos.
        // Se você precisa que a tela permaneça ligada mesmo em segundo plano (raro para 'screen' wake lock),
        // remova esta parte.
        if (wakeLock !== null) {
            console.log('Página não visível, liberando Screen Wake Lock temporariamente.');
            releaseWakeLock();
        }
    }
});

// Opcional: Adicione um botão ou algum evento para liberar o wake lock manualmente
// Exemplo:
// const releaseButton = document.getElementById('releaseWakeLockButton');
// if (releaseButton) {
//     releaseButton.addEventListener('click', releaseWakeLock);
// }