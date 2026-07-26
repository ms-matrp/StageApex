// ⚠️ ВСТАВЬТЕ СЮДА ССЫЛКУ НА ВАШ GOOGLE APPS SCRIPT WEB APP
const SCRIPT_URL = "https://script.google.com/macros/s/ВАШ_SCRIPT_ID/exec";

// Элементы переключения вкладок
const tabWorkerBtn = document.getElementById('tabWorkerBtn');
const tabManagerBtn = document.getElementById('tabManagerBtn');
const workerSection = document.getElementById('workerSection');
const managerSection = document.getElementById('managerSection');

// Элементы Сотрудника
const createBtn = document.getElementById('createBtn');
const finishBtn = document.getElementById('finishBtn');
const statusEl = document.getElementById('status');
const boxNumberEl = document.getElementById('boxNumber');
const uploadBlock = document.getElementById('uploadBlock');

// Элементы Менеджера
const refreshManagerBtn = document.getElementById('refreshManagerBtn');
const boxesList = document.getElementById('boxesList');

let currentBox = null; // { number: 'SA-0001', folderId: '...' }

// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
tabWorkerBtn.addEventListener('click', () => {
    tabWorkerBtn.classList.add('active');
    tabManagerBtn.classList.remove('active');
    workerSection.style.display = 'block';
    managerSection.style.display = 'none';
});

tabManagerBtn.addEventListener('click', () => {
    tabManagerBtn.classList.add('active');
    tabWorkerBtn.classList.remove('active');
    workerSection.style.display = 'none';
    managerSection.style.display = 'block';
    loadManagerBoxes();
});

// --- ЛОГИКА СОТРУДНИКА ---

// 1. Нажатие на "Принять коробку"
createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    statusEl.innerText = "Создаём коробку...";

    try {
        const res = await fetch(`${SCRIPT_URL}?action=newBox`);
        const data = await res.json();

        if (data.status === "success" || data.number) {
            currentBox = {
                number: data.number,
                folderId: data.folder
            };

            boxNumberEl.innerText = currentBox.number;
            statusEl.innerText = "На определении";

            // Блокируем кнопку "Принять", пока открыта текущая
            createBtn.style.display = 'none';
            uploadBlock.style.display = 'block';
        } else {
            alert("Ошибка при получении номера коробки");
            statusEl.innerText = "Ожидание";
            createBtn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        alert("Ошибка сети. Проверьте подключение.");
        statusEl.innerText = "Ошибка";
        createBtn.disabled = false;
    }
});

// Конвертер файла в Base64 для отправки в Drive
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve({
            name: file.name,
            mimeType: file.type,
            data: reader.result.split(',')[1]
        });
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// 2. Нажатие на "Завершить"
finishBtn.addEventListener('click', async () => {
    const f1 = document.getElementById('photo1').files[0];
    const f2 = document.getElementById('photo2').files[0];
    const f3 = document.getElementById('photo3').files[0];

    if (!f1 && !f2 && !f3) {
        alert("Загрузите хотя бы одну фотографию!");
        return;
    }

    finishBtn.disabled = true;
    statusEl.innerText = "Сохранение фото на Drive...";

    try {
        const filesData = await Promise.all([
            fileToBase64(f1),
            fileToBase64(f2),
            fileToBase64(f3)
        ]);

        const payload = {
            action: "uploadPhotos",
            folderId: currentBox.folderId,
            files: filesData.filter(f => f !== null)
        };

        // POST-запрос в Apps Script
        await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        alert(`Коробка ${currentBox.number} успешно принята!`);

        // Сброс формы для следующей коробки
        resetWorkerForm();

    } catch (err) {
        console.error(err);
        alert("Ошибка при сохранении фото.");
        finishBtn.disabled = false;
    }
});

function resetWorkerForm() {
    currentBox = null;
    boxNumberEl.innerText = "----";
    statusEl.innerText = "Ожидание";
    
    document.getElementById('photo1').value = "";
    document.getElementById('photo2').value = "";
    document.getElementById('photo3').value = "";

    uploadBlock.style.display = 'none';
    createBtn.style.display = 'block';
    createBtn.disabled = false;
    finishBtn.disabled = false;
}


// --- ЛОГИКА МЕНЕДЖЕРА ---

refreshManagerBtn.addEventListener('click', loadManagerBoxes);

async function loadManagerBoxes() {
    boxesList.innerHTML = "Загрузка списка...";

    try {
        const res = await fetch(`${SCRIPT_URL}?action=getBoxes`);
        const boxes = await res.json();

        // Фильтруем только те, у которых статус "На определении"
        const pendingBoxes = boxes.filter(b => b.status === "На определении");

        if (pendingBoxes.length === 0) {
            boxesList.innerHTML = "<p>Нет коробок, требующих определения 🎉</p>";
            return;
        }

        boxesList.innerHTML = ""; // очищаем

        pendingBoxes.forEach(box => {
            const card = document.createElement('div');
            card.className = "card manager-card";

            let photosMarkup = "";
            if (box.photos && box.photos.length > 0) {
                photosMarkup = box.photos.map(url => `<a href="${url}" target="_blank" class="photo-link">📁 Открыть фото</a>`).join(' | ');
            } else {
                photosMarkup = "<em>Фотографии ещё не загружены</em>";
            }

            card.innerHTML = `
                <h3>Коробка: ${box.number}</h3>
                <div class="photos-container">${photosMarkup}</div>

                <div class="input-group">
                    <label>Что внутри:</label>
                    <input type="text" id="desc_${box.number}" placeholder="Например: Обувь Nike, 2 пары">
                </div>

                <div class="input-group">
                    <label>Номер заказа клиента:</label>
                    <input type="text" id="order_${box.number}" placeholder="Например: ORD-8841">
                </div>

                <button onclick="saveDefinition('${box.number}')">Статус: Определено</button>
            `;

            boxesList.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        boxesList.innerHTML = "Ошибка при загрузке списка коробок.";
    }
}

// Функция сохранения определения менеджером
async function saveDefinition(boxNum) {
    const content = document.getElementById(`desc_${boxNum}`).value.trim();
    const orderNum = document.getElementById(`order_${boxNum}`).value.trim();

    if (!content || !orderNum) {
        alert("Заполните оба поля: что внутри и номер заказа!");
        return;
    }

    const payload = {
        action: "updateBox",
        number: boxNum,
        content: content,
        orderNum: orderNum
    };

    try {
        const res = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.status === "success") {
            alert(`Коробка ${boxNum} успешно определена!`);
            loadManagerBoxes(); // Обновляем список
        } else {
            alert(" Ошибка обновления: " + result.message);
        }
    } catch (err) {
        console.error(err);
        alert(" Ошибка при отправке данных.");
    }
}
