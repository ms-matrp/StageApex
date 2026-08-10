const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Картинки для Байка и Водителя
let bikeImg = new Image();
bikeImg.src = 'bike.png'; // Стандартный байк по умолчанию

let customRiderImg = null; // По умолчанию водитель нарисованный

const loader = document.getElementById('loader');
const bikePreviewImg = document.getElementById('bike-preview-img');

// Настройки смещения байка и водителя в игре
const BIKE_CONFIG = { width: 180, height: 120, x: -35, y: -95 };
const RIDER_CONFIG = { width: 80, height: 100, x: 10, y: -120 };

// UI Элементы
const mainMenu = document.getElementById('main-menu');
const garageMenu = document.getElementById('garage-menu');
const settingsMenu = document.getElementById('settings-menu');
const pauseMenu = document.getElementById('pause-menu');
const gameoverOverlay = document.getElementById('gameover-overlay');
const hud = document.getElementById('hud');
const controls = document.getElementById('controls');

// Кнопки и Инпуты
const mainPlayBtn = document.getElementById('main-play-btn');
const mainOptionsBtn = document.getElementById('main-options-btn');
const garageBackBtn = document.getElementById('garage-back-btn');
const startRideBtn = document.getElementById('start-ride-btn');
const settingsCloseBtn = document.getElementById('settings-close-btn');

const uploadBikeBtn = document.getElementById('upload-bike-btn');
const uploadRiderBtn = document.getElementById('upload-rider-btn');
const bikeFileInput = document.getElementById('bike-file-input');
const riderFileInput = document.getElementById('rider-file-input');

const pauseTriggerBtn = document.getElementById('pause-trigger-btn');
const pauseResumeBtn = document.getElementById('pause-resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const pauseMenuBtn = document.getElementById('pause-menu-btn');
const restartBtn = document.getElementById('restart-btn');

// Счетчики
const mainBestScoreEl = document.getElementById('main-best-score');
const garageBestScoreEl = document.getElementById('garage-best-score');
const timerEl = document.getElementById('timer');
const speedEl = document.getElementById('speedometer');
const multiplierEl = document.getElementById('multiplier');
const scoreEl = document.getElementById('score');
const finalScoreValEl = document.getElementById('final-score-val');

canvas.width = 375;
canvas.height = 667;

let gameState = 'MAIN_MENU';
let bestScore = localStorage.getItem('wheelie_best_score') || 0;
updateBestScoreUI();

const keys = { left: false, right: false, up: false };

// Физика
let speed = 0;
let score = 0;
let angle = 0;
let angularVelocity = 0;
let startTime = 0;
let elapsedTime = 0;
let kneePose = false;
let roadOffset = 0;

// Функция автоматического удаления фона через нейросеть
async function processAndRemoveBackground(file) {
    loader.classList.remove('hidden');
    try {
        // Запуск модели удаления фона @imgly/background-removal
        const blob = await imglyRemoveBackground(file);
        const url = URL.createObjectURL(blob);
        return url;
    } catch (error) {
        console.error("Ошибка при удалении фона:", error);
        alert("Не удалось вырезать фон, используем оригинал.");
        return URL.createObjectURL(file);
    } finally {
        loader.classList.add('hidden');
    }
}

// Загрузка Байка
uploadBikeBtn.addEventListener('click', () => bikeFileInput.click());
bikeFileInput.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files[0]) {
        const processedUrl = await processAndRemoveBackground(e.target.files[0]);
        bikeImg = new Image();
        bikeImg.src = processedUrl;
        bikePreviewImg.src = processedUrl;
    }
});

// Загрузка Водителя
uploadRiderBtn.addEventListener('click', () => riderFileInput.click());
riderFileInput.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files[0]) {
        const processedUrl = await processAndRemoveBackground(e.target.files[0]);
        customRiderImg = new Image();
        customRiderImg.src = processedUrl;
        alert("Водитель успешно вырезан и добавлен!");
    }
});

// Управление клавиатурой
window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'ArrowUp') keys.up = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowUp') keys.up = false;
});

function bindTouch(id, keyName) {
    const btn = document.getElementById(id);
    const setKey = (val) => (e) => {
        e.preventDefault();
        keys[keyName] = val;
    };
    btn.addEventListener('mousedown', setKey(true));
    btn.addEventListener('mouseup', setKey(false));
    btn.addEventListener('touchstart', setKey(true));
    btn.addEventListener('touchend', setKey(false));
}

bindTouch('btn-left', 'left');
bindTouch('btn-up', 'up');
bindTouch('btn-right', 'right');

// Меню
mainPlayBtn.addEventListener('click', () => showScreen('GARAGE'));
mainOptionsBtn.addEventListener('click', () => showScreen('SETTINGS'));
garageBackBtn.addEventListener('click', () => showScreen('MAIN_MENU'));
settingsCloseBtn.addEventListener('click', () => showScreen('MAIN_MENU'));

startRideBtn.addEventListener('click', startRide);
restartBtn.addEventListener('click', startRide);

pauseTriggerBtn.addEventListener('click', pauseGame);
pauseResumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', () => {
    pauseMenu.classList.add('hidden');
    startRide();
});
pauseMenuBtn.addEventListener('click', () => showScreen('GARAGE'));

function updateBestScoreUI() {
    mainBestScoreEl.textContent = bestScore;
    garageBestScoreEl.textContent = bestScore;
}

function showScreen(screen) {
    gameState = screen;
    mainMenu.classList.add('hidden');
    garageMenu.classList.add('hidden');
    settingsMenu.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    hud.classList.add('hidden');
    controls.classList.add('hidden');

    if (screen === 'MAIN_MENU') mainMenu.classList.remove('hidden');
    if (screen === 'GARAGE') garageMenu.classList.remove('hidden');
    if (screen === 'SETTINGS') settingsMenu.classList.remove('hidden');
}

function startRide() {
    gameState = 'PLAYING';
    mainMenu.classList.add('hidden');
    garageMenu.classList.add('hidden');
    settingsMenu.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    hud.classList.remove('hidden');
    controls.classList.remove('hidden');

    speed = 14;
    score = 0;
    angle = 0;
    angularVelocity = 0;
    startTime = Date.now();
    
    requestAnimationFrame(gameLoop);
}

function pauseGame() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseMenu.classList.remove('hidden');
    }
}

function resumeGame() {
    if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        pauseMenu.classList.add('hidden');
        requestAnimationFrame(gameLoop);
    }
}

function gameOver() {
    gameState = 'GAMEOVER';
    const finalScore = Math.floor(score);
    if (finalScore > bestScore) {
        bestScore = finalScore;
        localStorage.setItem('wheelie_best_score', bestScore);
        updateBestScoreUI();
    }
    
    finalScoreValEl.textContent = finalScore;
    gameoverOverlay.classList.remove('hidden');
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;

    update();
    render();

    requestAnimationFrame(gameLoop);
}

function update() {
    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    kneePose = keys.up;

    const cruiseSpeed = 16;
    if (keys.left) {
        speed = Math.max(0, speed - 0.15);
    } else if (keys.right) {
        speed = Math.min(26, speed + 0.1);
    } else {
        if (speed < cruiseSpeed) speed += 0.05;
        if (speed > cruiseSpeed) speed -= 0.03;
    }

    roadOffset = (roadOffset + speed) % 60;

    if (keys.right && speed > 1) {
        angularVelocity += 0.0018; 
    } else if (keys.left) {
        angularVelocity -= 0.0022;
    } else {
        let gravity = 0.0008;
        if (angle < 0.25) gravity = 0.0004;
        angularVelocity -= gravity;
    }

    angularVelocity *= 0.978;
    angle += angularVelocity;

    if (angle <= 0) {
        angle = 0;
        angularVelocity = 0;
    }

    if (angle >= 1.42) {
        gameOver();
        return;
    }

    if (angle > 0.1) {
        let mult = 1;
        if (angle > 0.5) mult = 2;
        if (angle > 0.85) mult = 3;
        if (kneePose) mult *= 2;

        score += mult * (speed / 12);
        multiplierEl.textContent = `X${mult * 10}`;
    } else {
        multiplierEl.textContent = `X1`;
    }

    const mins = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
    const secs = String(elapsedTime % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
    speedEl.textContent = `${Math.floor(speed * 3.6)} km/h`;
    scoreEl.textContent = `Score: ${Math.floor(score)}`;
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();
    drawRoad();
    drawBikeAndRider();
}

function drawBackground() {
    ctx.fillStyle = '#6ec6ff';
    ctx.fillRect(0, 0, canvas.width, 300);

    ctx.fillStyle = '#0088cc';
    ctx.fillRect(0, 300, canvas.width, 50);

    ctx.fillStyle = '#e6c280';
    ctx.fillRect(0, 350, canvas.width, 30);
}

function drawRoad() {
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(0, 380, canvas.width, 150);

    ctx.fillStyle = '#b5b5b5';
    ctx.fillRect(0, 370, canvas.width, 10);
    ctx.fillStyle = '#7a7a7a';
    ctx.fillRect(0, 380, canvas.width, 5);

    for (let x = -roadOffset; x < canvas.width; x += 60) {
        ctx.fillStyle = '#8c8c8c';
        ctx.fillRect(x + 20, 350, 8, 30);
    }

    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(0, 420, canvas.width, 4);
    ctx.fillRect(0, 428, canvas.width, 4);

    ctx.fillStyle = '#d9a752';
    ctx.fillRect(0, 530, canvas.width, 137);
}

function drawBikeAndRider() {
    ctx.save();

    const rearWheelX = 130;
    const rearWheelY = 480;

    ctx.translate(rearWheelX, rearWheelY);
    ctx.rotate(-angle);

    // Рисуем вырезанный байк
    ctx.drawImage(bikeImg, BIKE_CONFIG.x, BIKE_CONFIG.y, BIKE_CONFIG.width, BIKE_CONFIG.height);

    // Рисуем водителя (вырезанное фото или векторного)
    if (customRiderImg) {
        ctx.save();
        if (kneePose) {
            // Анимация станта для фото-водителя (небольшое смещение при зажатии «Колено»)
            ctx.translate(-10, -10);
        }
        ctx.drawImage(customRiderImg, RIDER_CONFIG.x, RIDER_CONFIG.y, RIDER_CONFIG.width, RIDER_CONFIG.height);
        ctx.restore();
    } else {
        drawDefaultRider(kneePose);
    }

    ctx.restore();
}

function drawDefaultRider(isKneeOnSeat) {
    ctx.save();

    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(30, -85, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillRect(34, -87, 8, 4);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(25, -73);
    ctx.lineTo(40, -70);
    ctx.lineTo(30, -45);
    ctx.lineTo(15, -45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(35, -68);
    ctx.lineTo(58, -60);
    ctx.lineTo(78, -55);
    ctx.stroke();

    ctx.fillStyle = '#222';
    if (isKneeOnSeat) {
        ctx.beginPath();
        ctx.moveTo(20, -45);
        ctx.lineTo(0, -40);
        ctx.lineTo(-10, -55);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#e0ac69';
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.moveTo(20, -45);
        ctx.lineTo(35, -30);
        ctx.lineTo(30, -10);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#e0ac69';
        ctx.stroke();
    }

    ctx.restore();
}
