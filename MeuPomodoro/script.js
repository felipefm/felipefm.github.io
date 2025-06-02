// Firebase SDK imports - Essas devem ficar fora do DOMContentLoaded
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, onSnapshot, writeBatch, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Adicione esta linha se for usar setLogLevel

// --- Firebase Configuration (DO NOT EDIT THESE LINES) ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
                                                                                                        apiKey: "AIzaSyBZdcBC18mRBsV5CWjMRbDbReYsDDpMm1A",
                                                                                                        authDomain: "meu-pomodoro-app.firebaseapp.com",
                                                                                                        projectId: "meu-pomodoro-app",
                                                                                                        storageBucket: "meu-pomodoro-app.firebasestorage.app",
                                                                                                        messagingSenderId: "205270432856",
                                                                                                        appId: "1:205270432856:web:b05ef929321fdea48d1e2d",
                                                                                                        measurementId: "G-BVPSS4FQFS"
                                                                                                    }; // Fallback for local dev
const appId = typeof __app_id !== 'undefined' ? __app_id : 'pomodoro-deluxe-app'; // Fallback for local dev
// --- End Firebase Configuration ---

// Todo o restante do seu código JavaScript deve ser envolvido por este listener:
document.addEventListener("DOMContentLoaded", () => {
    let db, auth, userId, isAuthReady = false;
    let app;

    // --- UI Elements ---
    const timeDisplay = document.getElementById('time-display');
    const timerProgress = document.getElementById('timer-progress');
    const startPauseBtn = document.getElementById('start-pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const coinCountDisplay = document.getElementById('coin-count');
    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskListDiv = document.getElementById('task-list');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsModalBtn = document.getElementById('close-settings-modal-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn'); // Corrected typo here, was "document = document.getElementById"
    const workDurationInput = document.getElementById('work-duration-input');
    const shortBreakDurationInput = document.getElementById('short-break-duration-input');
    const longBreakDurationInput = document.getElementById('long-break-duration-input');
    const pomodorosPerLongBreakInput = document.getElementById('pomodoros-per-long-break-input');
    const soundEnabledCheckbox = document.getElementById('sound-enabled-checkbox');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const workModeBtn = document.getElementById('work-mode-btn');
    const shortBreakModeBtn = document.getElementById('short-break-mode-btn');
    const longBreakModeBtn = document.getElementById('long-break-mode-btn');
    const modeButtons = [workModeBtn, shortBreakModeBtn, longBreakModeBtn];
    const currentTaskTimerDisplay = document.getElementById('current-task-timer');
    const userIdDisplay = document.getElementById('user-id-display');
    const toggleTaskSectionBtn = document.getElementById('toggle-task-section-btn');
    const taskSection = document.getElementById('task-section');

    const messageBox = document.getElementById('message-box');
    const messageBoxText = document.getElementById('message-box-text');
    const messageBoxOkBtn = document.getElementById('message-box-ok-btn');

    // Adicione esta linha
    const resetCoinsBtn = document.getElementById('reset-coins-btn');


// --- Timer State ---
let timerInterval;
let timeLeft; // in seconds
let totalTime; // in seconds for progress calculation
let currentMode = 'work'; // 'work', 'shortBreak', 'longBreak'
let pomodorosCompletedSession = 0; // Pomodoros completed in the current set for long break
let isRunning = false;
let activeTaskId = null; // ID of the task currently associated with the timer

// --- Default Settings ---
let settings = {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    pomodorosPerLongBreak: 4,
    soundEnabled: true,
};

let coins = 0;
let tasks = []; // Array of task objects { id, text, completed, createdAt, pomodoros: 0 }

const FULL_DASH_ARRAY = 2 * Math.PI * 110; // Circumference of the progress circle

// --- Sound Synthesis (Tone.js) ---
let synth;
// Placeholder for custom sound URLs - user can replace these
const soundUrls = {
    workEnd: null, // Example: 'sounds/work_end.mp3'
    breakEnd: null, // Example: 'sounds/break_end.mp3'
    taskComplete: null // Example: 'sounds/task_complete.mp3'
};
let soundPlayers = {};

function initializeSounds() {
    if (typeof Tone !== 'undefined') {
        synth = new Tone.Synth().toDestination();
        // Pre-load custom sounds if URLs are provided
        Object.keys(soundUrls).forEach(key => {
            if (soundUrls[key]) {
                soundPlayers[key] = new Tone.Player(soundUrls[key]).toDestination();
            }
        });
        console.log("Tone.js initialized.");
    } else {
        console.warn("Tone.js not loaded. Sounds will be disabled.");
    }
}

function playSound(type) {
    if (!settings.soundEnabled || typeof Tone === 'undefined') return;

    if (soundPlayers[type] && soundUrls[type]) {
        soundPlayers[type].start();
    } else {
        // Fallback to synthesized sounds if custom URL not provided or Tone.Player failed
        try {
            if (type === 'workEnd' || type === 'breakEnd') {
                synth.triggerAttackRelease("C5", "8n", Tone.now());
                synth.triggerAttackRelease("G5", "8n", Tone.now() + 0.2);
            } else if (type === 'taskComplete') {
                synth.triggerAttackRelease("E5", "16n", Tone.now());
                synth.triggerAttackRelease("G5", "16n", Tone.now() + 0.1);
                synth.triggerAttackRelease("C6", "8n", Tone.now() + 0.2);
            }
        } catch (error) {
            console.error("Error playing synthesized sound:", error);
        }
    }
}

// --- Fullscreen API ---
function enterFullscreen() {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) { /* Firefox */
        document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
        document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) { /* IE/Edge */
        document.documentElement.msRequestFullscreen();
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { /* Firefox */
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { /* Chrome, Safari & Opera */
        document.webkitExitFullscreen();
    } else if (document.documentElement.msExitFullscreen) { /* IE/Edge */
        document.documentElement.msExitFullscreen();
    }
}

fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        enterFullscreen();
    } else {
        exitFullscreen();
    }
});

document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        fullscreenBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7 2.5a.5.5 0 00-1 0V5a.5.5 0 01-.5.5H4a.5.5 0 000 1h2.5A1.5 1.5 0 008 5V2.5a.5.5 0 00-1 0zM13 2.5a.5.5 0 00-1 0V5a1.5 1.5 0 001.5 1.5H16a.5.5 0 000-1h-2.5a.5.5 0 01-.5-.5V2.5zM7 17.5a.5.5 0 001 0V15a.5.5 0 01.5-.5H11a.5.5 0 000-1H8.5A1.5 1.5 0 007 15v2.5a.5.5 0 000 0zM13 17.5a.5.5 0 001 0V15a1.5 1.5 0 00-1.5-1.5H10a.5.5 0 000 1h2.5a.5.5 0 01.5.5v2.5z" clip-rule="evenodd" />
            </svg>
            <span>Sair Tela Cheia</span>`;
    } else {
         fullscreenBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v2.5a.5.5 0 001 0V3.5a.5.5 0 01.5-.5h2.5a.5.5 0 000-1H4.5zM15.5 2a.5.5 0 00-.5.5v2.5a.5.5 0 001 0V3.5a.5.5 0 00-.5-.5h-2.5a.5.5 0 000 1H15.5zM4.5 18a.5.5 0 00.5-.5v-2.5a.5.5 0 00-1 0v2.5a.5.5 0 00.5.5h2.5a.5.5 0 000-1H4.5zM15.5 18a1.5 1.5 0 001.5-1.5v-2.5a.5.5 0 00-1 0v2.5a.5.5 0 01-.5.5h-2.5a.5.5 0 000 1H15.5z" clip-rule="evenodd" />
            </svg>
            <span>Tela Cheia</span>`;
    }
});

// --- Timer Logic ---
function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const progress = ((totalTime - timeLeft) / totalTime) * FULL_DASH_ARRAY;
    timerProgress.style.strokeDashoffset = Math.max(0, FULL_DASH_ARRAY - progress);

    // Update document title
    document.title = `${timeDisplay.textContent} - ${currentMode === 'work' ? 'Foco' : (currentMode === 'shortBreak' ? 'Pausa Curta' : 'Pausa Longa')} - Pomodoro Deluxe`;
}

function setMode(mode) {
    currentMode = mode;
    isRunning = false;
    clearInterval(timerInterval);
    startPauseBtn.textContent = 'Iniciar';
    startPauseBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
    startPauseBtn.classList.add('bg-emerald-500', 'hover:bg-emerald-600');


    modeButtons.forEach(btn => {
        if (btn.dataset.mode === mode) {
            btn.classList.remove('opacity-75');
            btn.classList.add('ring-2', 'ring-offset-2', 'ring-offset-gray-800');
             if (mode === 'work') {
                btn.classList.add('ring-emerald-400');
                timerProgress.classList.remove('text-sky-400', 'text-indigo-400');
                timerProgress.classList.add('text-emerald-400');
            } else if (mode === 'shortBreak') {
                btn.classList.add('ring-sky-400');
                timerProgress.classList.remove('text-emerald-400', 'text-indigo-400');
                timerProgress.classList.add('text-sky-400');
            } else { // longBreak
                btn.classList.add('ring-indigo-400');
                timerProgress.classList.remove('text-emerald-400', 'text-sky-400');
                timerProgress.classList.add('text-indigo-400');
            }
        } else {
            btn.classList.add('opacity-75');
            btn.classList.remove('ring-2', 'ring-offset-2', 'ring-offset-gray-800', 'ring-emerald-400', 'ring-sky-400', 'ring-indigo-400');
        }
    });

    switch (mode) {
        case 'work':
            timeLeft = settings.workDuration * 60;
            break;
        case 'shortBreak':
            timeLeft = settings.shortBreakDuration * 60;
            break;
        case 'longBreak':
            timeLeft = settings.longBreakDuration * 60;
            break;
    }
    totalTime = timeLeft;
    updateDisplay();
}

function startTimer() {
    if (isRunning) return; // Prevent multiple intervals
    isRunning = true;
    startPauseBtn.textContent = 'Pausar';
    startPauseBtn.classList.remove('bg-emerald-500', 'hover:bg-emerald-600');
    startPauseBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');

    if (settings.soundEnabled) enterFullscreen(); // Enter fullscreen on timer start if sound is on

    timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            isRunning = false;
            if (settings.soundEnabled) exitFullscreen(); // Exit fullscreen when timer ends

            if (currentMode === 'work') {
                playSound('workEnd');
                pomodorosCompletedSession++;
                addCoins(1); // 1 coin per Pomodoro
                if (activeTaskId) {
                    incrementTaskPomodoro(activeTaskId);
                    addCoins(1); // Extra coin if task was active
                }

                if (pomodorosCompletedSession >= settings.pomodorosPerLongBreak) {
                    setMode('longBreak');
                    pomodorosCompletedSession = 0;
                    showCustomMessage(`Hora da pausa longa! Você completou ${settings.pomodorosPerLongBreak} pomodoros.`);
                } else {
                    setMode('shortBreak');
                    showCustomMessage("Sessão de foco concluída! Hora de uma pausa curta.");
                }
            } else { // shortBreak or longBreak ended
                playSound('breakEnd');
                setMode('work');
                showCustomMessage("Pausa finalizada! Pronto para mais uma sessão de foco?");
            }
            saveUserData(); // Save coins and pomodoros count
             // Automatically start the next timer after a short delay
            setTimeout(() => {
                if(!isRunning) startTimer(); // Start if not already manually started/paused
            }, 1500);
        }
    }, 1000);
}

function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);
    startPauseBtn.textContent = 'Continuar';
    startPauseBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
    startPauseBtn.classList.add('bg-emerald-500', 'hover:bg-emerald-600');
}

function resetTimer() {
    pauseTimer(); // Ensure timer is stopped
    setMode(currentMode); // Reset to current mode's default time
    if (document.fullscreenElement) exitFullscreen(); // Exit fullscreen on reset
}

startPauseBtn.addEventListener('click', () => {
    if (!isAuthReady) {
        showCustomMessage("Aguarde, conectando ao servidor...");
        return;
    }
    if (isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
});

resetBtn.addEventListener('click', () => {
    if (!isAuthReady) {
         showCustomMessage("Aguarde, conectando ao servidor...");
        return;
    }
    resetTimer();
});

modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (!isAuthReady) {
            showCustomMessage("Aguarde, conectando ao servidor...");
            return;
        }
        const newMode = btn.dataset.mode;
        if (newMode !== currentMode) {
            resetTimer(); // Reset before switching mode completely
            setMode(newMode);
        }
    });
});

// --- Task Management ---
function renderTasks() {
    taskListDiv.innerHTML = '';
    if (tasks.length === 0) {
        taskListDiv.innerHTML = '<p class="text-gray-500 italic text-center">Nenhuma tarefa adicionada ainda.</p>';
        return;
    }
    tasks.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.className = `flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-150 ease-in-out group ${task.completed ? 'bg-gray-700 opacity-60' : 'bg-gray-700 hover:bg-gray-600'} ${task.id === activeTaskId ? 'ring-2 ring-emerald-400' : ''}`;
        taskEl.dataset.id = task.id;

        const textSpan = document.createElement('span');
        textSpan.textContent = task.text;
        textSpan.className = `flex-grow ${task.completed ? 'line-through text-gray-500' : 'text-gray-200'}`;

        const pomodoroCountSpan = document.createElement('span');
        pomodoroCountSpan.textContent = ` (${task.pomodoros || 0}🍅)`;
        pomodoroCountSpan.className = 'text-xs text-gray-400 mr-2';

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity';

        const completeBtn = document.createElement('button');
        completeBtn.innerHTML = task.completed ?
            '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-400 hover:text-yellow-300" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 001.414 1.414L9 9.414l3.293 3.293a1 1 0 001.414-1.414l-4-4z" clip-rule="evenodd" /></svg>' :
            '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400 hover:text-green-300" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>';
        completeBtn.title = task.completed ? "Marcar como não concluída" : "Marcar como concluída";
        completeBtn.onclick = (e) => { e.stopPropagation(); toggleTaskComplete(task.id); };

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.w3.org/2000/svg" class="h-5 w-5 text-red-400 hover:text-red-300" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>';
        deleteBtn.title = "Excluir tarefa";
        deleteBtn.onclick = (e) => { e.stopPropagation(); deleteTask(task.id); };

        actionsDiv.appendChild(completeBtn);
        actionsDiv.appendChild(deleteBtn);

        const taskContentDiv = document.createElement('div');
        taskContentDiv.className = 'flex-grow flex items-center';
        taskContentDiv.appendChild(textSpan);
        taskContentDiv.appendChild(pomodoroCountSpan);

        taskEl.appendChild(taskContentDiv);
        taskEl.appendChild(actionsDiv);

        taskEl.onclick = () => setActiveTask(task.id);
        taskListDiv.appendChild(taskEl);
    });
    updateCurrentTaskTimerDisplay();
}

// Função auxiliar para construir a referência da coleção de tarefas
// Isso evita repetição e erros em cascata, e corrige o erro de referência de coleção
function getTasksCollectionRef() {
    // Correção: Remova "pomodoro" como um segmento aqui
    return collection(db, "artifacts", appId, "users", userId, "tasks");
}

async function addTask() {
    const text = taskInput.value.trim();
    if (!text || !isAuthReady) return;

    const newTask = {
        text,
        completed: false,
        createdAt: serverTimestamp(), // Use server timestamp
        pomodoros: 0,
        userId: userId
    };

    try {
        const docRef = await addDoc(getTasksCollectionRef(), newTask);
        taskInput.value = '';
    } catch (error) {
        console.error("Error adding task to Firestore: ", error);
        showCustomMessage("Erro ao adicionar tarefa. Tente novamente.");
    }
}

async function toggleTaskComplete(id) {
    if (!isAuthReady) return;
    const taskRef = doc(getTasksCollectionRef(), id);
    const task = tasks.find(t => t.id === id);
    if (task) {
        try {
            await updateDoc(taskRef, { completed: !task.completed });
            if (!task.completed) { // Task is being marked as complete
                playSound('taskComplete');
                addCoins(5); // 5 coins for completing a task
                saveUserData();
            }
        } catch (error) {
            console.error("Error updating task completion: ", error);
            showCustomMessage("Erro ao atualizar tarefa.");
        }
    }
}

async function deleteTask(id) {
    if (!isAuthReady) return;
    const taskRef = doc(getTasksCollectionRef(), id);
    try {
        await deleteDoc(taskRef);
        if (activeTaskId === id) {
            activeTaskId = null; // Clear active task if it's deleted
        }
    } catch (error) {
        console.error("Error deleting task: ", error);
        showCustomMessage("Erro ao excluir tarefa.");
    }
}

function setActiveTask(id) {
    if (activeTaskId === id) { // Clicked on already active task
        activeTaskId = null; // Deactivate it
    } else {
        activeTaskId = id;
    }
    renderTasks(); // Re-render to show selection highlight
}

function updateCurrentTaskTimerDisplay() {
    if (activeTaskId) {
        const task = tasks.find(t => t.id === activeTaskId);
        if (task) {
            currentTaskTimerDisplay.textContent = `Foco em: ${task.text.substring(0,30)}${task.text.length > 30 ? '...' : ''}`;
        } else {
             currentTaskTimerDisplay.textContent = "Tarefa ativa não encontrada.";
             activeTaskId = null; // Clear if task not found
        }
    } else {
        currentTaskTimerDisplay.textContent = "Nenhuma tarefa selecionada";
    }
}

async function incrementTaskPomodoro(taskId) {
    if (!isAuthReady || !taskId) return;
    const taskRef = doc(getTasksCollectionRef(), taskId);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        try {
            await updateDoc(taskRef, { pomodoros: (task.pomodoros || 0) + 1 });
        } catch (error) {
            console.error("Error incrementing task pomodoros: ", error);
        }
    }
}

addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});

toggleTaskSectionBtn.addEventListener('click', () => {
    taskSection.classList.toggle('hidden');
    const icon = toggleTaskSectionBtn.querySelector('svg');
    if (taskSection.classList.contains('hidden')) {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />'; // Down arrow
    } else {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />'; // Up arrow
    }
});

// --- Coin System ---
function addCoins(amount) {
    coins += amount;
    coinCountDisplay.textContent = coins;
}

// Nova função para zerar moedas
async function resetCoins() {
    if (!isAuthReady || !userId) {
        showCustomMessage("Aguarde, conectando ao servidor ou usuário não autenticado.");
        return;
    }

    // Pede confirmação para evitar cliques acidentais
    if (!confirm("Tem certeza que deseja zerar todas as suas moedas? Esta ação é irreversível!")) {
        return;
    }

    try {
        coins = 0; // Zera as moedas localmente
        coinCountDisplay.textContent = coins; // Atualiza a UI imediatamente

        // Atualiza no Firestore
        const userDataRef = doc(db, `artifacts/<span class="math-inline">\{appId\}/users/</span>{userId}/userData`);
        await updateDoc(userDataRef, { coins: 0 }); // Usa updateDoc para só mudar 'coins'
        showCustomMessage("Suas moedas foram zeradas com sucesso!");
        settingsModal.classList.remove('active'); // Fecha o modal de configurações
    } catch (error) {
        console.error("Erro ao zerar moedas no Firestore:", error);
        showCustomMessage("Erro ao zerar moedas. Tente novamente.");
    }
}

// --- Settings Modal ---
settingsBtn.addEventListener('click', () => {
    loadSettingsToModal();
    settingsModal.classList.add('active');
});
closeSettingsModalBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

function loadSettingsToModal() {
    workDurationInput.value = settings.workDuration;
    shortBreakDurationInput.value = settings.shortBreakDuration;
    longBreakDurationInput.value = settings.longBreakDuration;
    pomodorosPerLongBreakInput.value = settings.pomodorosPerLongBreak;
    soundEnabledCheckbox.checked = settings.soundEnabled;
}

async function saveSettingsFromModal() {
    if (!isAuthReady) return;

    const newSettings = {
        workDuration: parseInt(workDurationInput.value) || 25,
        shortBreakDuration: parseInt(shortBreakDurationInput.value) || 5,
        longBreakDuration: parseInt(longBreakDurationInput.value) || 15,
        pomodorosPerLongBreak: parseInt(pomodorosPerLongBreakInput.value) || 4,
        soundEnabled: soundEnabledCheckbox.checked,
    };
    settings = newSettings; // Update local settings immediately for responsiveness

    try {
        // const settingsRef = doc(db, `artifacts/${appId}/users/${userId}/pomodoro/settings`);
        const settingsRef = doc(db, `artifacts/<span class="math-inline">\{appId\}/users/</span>{userId}/settings`);
        await setDoc(settingsRef, settings);
        showCustomMessage("Configurações salvas!");
        settingsModal.classList.remove('active');
        resetTimer(); // Apply new settings to current timer
        setMode(currentMode); // Re-apply current mode with new durations
    } catch (error) {
        console.error("Error saving settings to Firestore: ", error);
        showCustomMessage("Erro ao salvar configurações.");
    }
}
saveSettingsBtn.addEventListener('click', saveSettingsFromModal);

// Adicione este listener para o novo botão
resetCoinsBtn.addEventListener('click', resetCoins);

// --- Message Box ---
function showCustomMessage(message) {
    messageBoxText.textContent = message;
    messageBox.classList.add('active');
}
messageBoxOkBtn.addEventListener('click', () => {
    messageBox.classList.remove('active');
});

// --- Firebase Initialization and Data Handling ---
async function initializeFirebase() {
    try {
        console.log("Initializing Firebase with config:", firebaseConfig);
        console.log("App ID:", appId);
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        // setLogLevel('debug'); // Uncomment for detailed Firestore logs

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("User is signed in:", user.uid);
                userId = user.uid;
                userIdDisplay.textContent = userId;
                isAuthReady = true;
                await loadInitialData();
                setupRealtimeListeners();
            } else {
                console.log("User is signed out. Attempting to sign in...");
                 // If __initial_auth_token is not defined, sign in anonymously
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    console.log("Signing in with custom token...");
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    console.log("Signing in anonymously...");
                    await signInAnonymously(auth);
                }
            }
        });
    } catch (error) {
        console.error("Firebase initialization error:", error);
        showCustomMessage("Erro ao conectar com o servidor. Algumas funcionalidades podem não estar disponíveis.");
        // Fallback to local-only mode or disable features
        isAuthReady = false; // Ensure app knows auth failed
        userIdDisplay.textContent = "Offline";
    }
}

async function loadInitialData() {
    if (!isAuthReady || !userId) {
        console.warn("Auth not ready or no userId, skipping initial data load.");
        setMode('work'); // Initialize timer with default if no data
        renderTasks();
        return;
    }
    console.log(`Loading initial data for user: ${userId}`);

    // Load Settings
    const settingsRef = doc(db, `artifacts/<span class="math-inline">\{appId\}/users/</span>{userId}/settings`);

    try {
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
            settings = { ...settings, ...settingsSnap.data() };
            console.log("Settings loaded from Firestore:", settings);
        } else {
            console.log("No settings found in Firestore, using defaults and saving them.");
            await setDoc(settingsRef, settings); // Save default settings if none exist
        }
    } catch (error) {
        console.error("Error loading settings:", error);
        showCustomMessage("Erro ao carregar configurações.");
    }
    loadSettingsToModal(); // Populate modal with loaded/default settings
    setMode(currentMode); // Apply loaded settings to the timer

    // Load User Data (coins)
    // const userDataRef = doc(db, `artifacts/${appId}/users/${userId}/pomodoro/userData`);
    const userDataRef = doc(db, `artifacts/<span class="math-inline">\{appId\}/users/</span>{userId}/userData`);
    try {
        const userDataSnap = await getDoc(userDataRef);
        if (userDataSnap.exists()) {
            const data = userDataSnap.data();
            coins = data.coins || 0;
            // pomodorosCompletedSession might also be stored here if needed across sessions
            console.log("User data loaded:", data);
        } else {
            console.log("No user data found, initializing with defaults.");
            await setDoc(userDataRef, { coins: 0, completedPomodorosTotal: 0 });
        }
    } catch (error) {
        console.error("Error loading user data:", error);
        showCustomMessage("Erro ao carregar dados do usuário.");
    }
    coinCountDisplay.textContent = coins;
}

function setupRealtimeListeners() {
    if (!isAuthReady || !userId) {
        console.warn("Auth not ready or no userId, skipping realtime listeners setup.");
        return;
    }
    console.log(`Setting up realtime listeners for user: ${userId}`);

    // Settings listener
    // const settingsRef = doc(db, `artifacts/${appId}/users/${userId}/pomodoro/settings`);
    const settingsRef = doc(db, `artifacts/<span class="math-inline">\{appId\}/users/</span>{userId}/settings`);
    onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
            const newSettings = docSnap.data();
            const settingsChanged = JSON.stringify(settings) !== JSON.stringify(newSettings);
            settings = { ...settings, ...newSettings };
            if (settingsChanged) {
                console.log("Settings updated via snapshot:", settings);
                loadSettingsToModal();
                // Only reset timer if it's not running to avoid interruption
                if (!isRunning) {
                    setMode(currentMode);
                }
            }
        }
    }, (error) => {
        console.error("Error in settings snapshot listener:", error);
    });

    // UserData (coins) listener
    // const userDataRef = doc(db, `artifacts/${appId}/users/${userId}/pomodoro/userData`);
    const userDataRef = doc(db, `artifacts/<span class="math-inline">\{appId\}/users/</span>{userId}/userData`);
    onSnapshot(userDataRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            coins = data.coins || 0;
            coinCountDisplay.textContent = coins;
            console.log("User data (coins) updated via snapshot:", coins);
        }
    }, (error) => {
        console.error("Error in userData snapshot listener:", error);
    });

    // Tasks listener
    const tasksQuery = query(getTasksCollectionRef()); // Usando a função auxiliar aqui
    onSnapshot(tasksQuery, (querySnapshot) => {
        const fetchedTasks = [];
        querySnapshot.forEach((doc) => {
            fetchedTasks.push({ id: doc.id, ...doc.data() });
        });
        // Sort tasks by createdAt (newest first if createdAt is a Timestamp)
        // Firestore Timestamps can be compared directly or using .toDate()
        tasks = fetchedTasks.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA; // Newest first
        });
        console.log("Tasks updated via snapshot:", tasks);
        renderTasks();
    }, (error) => {
        console.error("Error in tasks snapshot listener:", error);
    });
}

async function saveUserData() { // For coins and other general user stats
    if (!isAuthReady || !userId) return;
    // const userDataRef = doc(db, `artifacts/${appId}/users/${userId}/pomodoro/userData`);
    const userDataRef = doc(db, `artifacts/<span class="math-inline">\{appId\}/users/</span>{userId}/userData`);
    try {
        await setDoc(userDataRef, { coins: coins }, { merge: true }); // Merge to not overwrite other fields
        console.log("User data (coins) saved to Firestore.");
    } catch (error) {
        console.error("Error saving user data to Firestore: ", error);
    }
}

// --- PWA Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}


    initializeSounds();
        initializeFirebase().then(() => {
            setMode('work');
            renderTasks();
        });
}); // Fechamento do DOMContentLoaded