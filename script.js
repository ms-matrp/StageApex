// ⚠️ ВСТАВЬТЕ СЮДА ССЫЛКУ НА ВАШ GOOGLE APPS SCRIPT WEB APP
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXplNqTIGc6d-_dQiB7-Qa8WsxHuoAfLIFBWJsaCJXuqz8Q5973VJPE-aIa3JpNvEj_w/exec";

// Табы
const tabWorkerBtn = document.getElementById('tabWorkerBtn');
const tabManagerBtn = document.getElementById('tabManagerBtn');
const workerSection = document.getElementById('workerSection');
const managerSection = document.getElementById('managerSection');

// Элементы сотрудника
const createBtn = document.getElementById('createBtn');
const finishBtn = document.getElementById('finishBtn');
const statusEl = document.getElementById('status');
const boxNumberEl = document.getElementById('boxNumber');
const uploadBlock = document.getElementById('uploadBlock');

// Элементы менеджера
const refreshManagerBtn = document.getElementById('refreshManagerBtn');
const boxesList = document.getElementById('boxesList');

let currentBox = null;

// --- Переключение Вкладок ---
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
createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    statusEl.innerText = "Генерация номера...";

    try {
        const res = await fetch(`${SCRIPT_URL}?action=newBox`, { redirect: 'follow' });
        const data = await res.json();

        if (data.status === "success" || data.number) {
            currentBox = { number: data.number, folderId: data.folder };
            boxNumberEl.innerText = currentBox.number;
            statusEl.innerText = "На определении";

            createBtn.style.display = 'none';
            uploadBlock.style.display = 'block';
        } else {
            alert("Ошибка создания коробки");
            statusEl.innerText = "Ожидание";
            createBtn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        alert("Ошибка подключения к серверу");
        statusEl.innerText = "Ошибка";
        createBtn.disabled = false;
    }
});

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

finishBtn.addEventListener('click', async () => {
    const f1 = document.getElementById('photo1').files[0];
    const f2 = document.getElementById('photo2').files[0];
    const f3 = document.getElementById('photo3').files[0];

    if (!f1 && !f2 && !f3) {
        alert("Загрузите хотя бы одно фото!");
        return;
    }

    finishBtn.disabled = true;
    statusEl.innerText = "Загрузка фото в Google Drive...";

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

        await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        alert(`Коробка ${currentBox.number} успешно принята!`);
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
    boxesList.innerHTML = "<p>Загрузка коробок...</p>";

    try {
        const res = await fetch(`${SCRIPT_URL}?action=getBoxes`, { redirect: 'follow' });
        const pendingBoxes = await res.json();

        if (!pendingBoxes || pendingBoxes.length === 0) {
            boxesList.innerHTML = "<p class='empty-msg'>🎉 Нет коробок, требующих определения!</p>";
            return;
        }

        boxesList.innerHTML = "";

        pendingBoxes.forEach(box => {
            const card = document.createElement('div');
            card.className = "card manager-card";

            let photosHtml = "";
            if (box.photos && box.photos.length > 0) {
                photosHtml = box.photos.map((p, idx) => 
                    `<a href="${p.url}" target="_blank" class="photo-link">📷 Фото ${idx + 1}</a>`
                ).join(' ');
            } else {
                photosHtml = "<span class='no-photo'>Фото отсутствуют</span>";
            }

            card.innerHTML = `
                <div class="box-header">
                    <h3>Коробка: ${box.number}</h3>
                    <span class="badge-status">На определении</span>
                </div>
                
                <div class="photos-block">
                    <strong>Файлы:</strong> ${photosHtml}
                </div>

                <div class="input-group">
                    <label>Что внутри:</label>
                    <input type="text" id="desc_${box.number}" placeholder="Например: Кроссовки Nike (42 размер)">
                </div>

                <div class="input-group">
                    <label>Номер заказа клиента:</label>
                    <input type="text" id="order_${box.number}" placeholder="Например: ORD-1092">
                </div>

                <button class="save-btn" onclick="submitDefinition('${box.number}')">Подтвердить (Определено)</button>
            `;

            boxesList.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        boxesList.innerHTML = "<p>Ошибка при загрузке данных.</p>";
    }
}

async function submitDefinition(boxNum) {
    const content = document.getElementById(`desc_${boxNum}`).value.trim();
    const orderNum = document.getElementById(`order_${boxNum}`).value.trim();

    if (!content || !orderNum) {
        alert("Заполните оба поля: что внутри и номер заказа!");
        return;
    }

    const btn = event.target;
    btn.disabled = true;
    btn.innerText = "Сохранение...";

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
            loadManagerBoxes(); // Карточка сразу исчезает из списка менеджера
        } else {
            alert("Ошибка: " + result.message);
            btn.disabled = false;
            btn.innerText = "Подтвердить (Определено)";
        }
    } catch (err) {
        console.error(err);
        alert("Ошибка при сохранении.");
        btn.disabled = false;
        btn.innerText = "Подтвердить (Определено)";
    }
}
