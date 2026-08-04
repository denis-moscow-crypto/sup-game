const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let userData = {
    name: '', age: '', city: '', gender: '', photo: '',
    telegramId: (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user.id : 'unknown'
};

// ===== СОХРАНЕНИЕ ДАННЫХ =====
function saveProfile(data) {
    localStorage.setItem('sup_profile', JSON.stringify(data));
}
function loadProfile() {
    const saved = localStorage.getItem('sup_profile');
    return saved ? JSON.parse(saved) : null;
}

// ===== ЭКРАНЫ =====
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ===== АВАТАР =====
function setAvatar(elId, src) {
    const el = document.getElementById(elId);
    if (src) {
        el.style.backgroundImage = 'url(' + src + ')';
        el.textContent = '';
    } else {
        el.style.backgroundImage = 'none';
        el.textContent = '📷';
    }
}

// ===== СТАРТ =====
function startApp() {
    const saved = loadProfile();
    if (saved) {
        userData = saved;
        showProfile();  // сразу показываем сохранённый профиль
    } else {
        showScreen('registration-screen');
        prefillFromTelegram();
    }
}

function prefillFromTelegram() {
    const tgUser = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (tgUser && tgUser.first_name) {
        document.getElementById('user-name').value =
            tgUser.first_name + ' ' + (tgUser.last_name || '');
    }
}

// ===== РЕГИСТРАЦИЯ =====
function selectGender(gender) {
    userData.gender = gender;
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.gender === gender);
    });
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

// Сжатие фото, чтобы не переполнить память
function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, 400 / Math.max(img.width, img.height));
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function uploadPhoto() {
    const input = document.getElementById('photo-input');
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        compressImage(file, (compressed) => {
            userData.photo = compressed;
            setAvatar('avatar-preview', compressed);  // фото появляется СРАЗУ
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        });
    };
    input.click();
}

function submitRegistration() {
    const name = document.getElementById('user-name').value.trim();
    const age = document.getElementById('user-age').value.trim();
    const city = document.getElementById('user-city').value.trim();

    if (!name || !age || !city || !userData.gender) {
        alert('Заполни все поля и выбери пол!');
        return;
    }
    if (parseInt(age) < 16) {
        alert('Игра доступна с 16 лет!');
        return;
    }

    userData.name = name;
    userData.age = age;
    userData.city = city;

    saveProfile(userData);  // ← ВОТ ТУТ СОХРАНЯЕМ!
    showProfile();
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
}

// ===== ПРОФИЛЬ =====
function showProfile() {
    setAvatar('profile-photo', userData.photo);
    const genderText = userData.gender === 'male' ? '👨 Парень' : '👩 Девушка';
    document.getElementById('profile-info').innerHTML =
        '<div class="profile-name">' + userData.name + '</div>' +
        '<div class="profile-line">' + userData.age + ' лет · ' + userData.city + '</div>' +
        '<div class="profile-line">' + genderText + '</div>';
    showScreen('profile-screen');
}

function editProfile() {
    document.getElementById('user-name').value = userData.name;
    document.getElementById('user-age').value = userData.age;
    document.getElementById('user-city').value = userData.city;
    setAvatar('avatar-preview', userData.photo);
    if (userData.gender) selectGender(userData.gender);
    showScreen('registration-screen');
}

function nextStep() {
    alert('Скоро здесь будет создание вопроса для противоположного пола! 😉');
}
