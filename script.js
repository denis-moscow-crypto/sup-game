// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let userData = {
    name: '',
    age: '',
    city: '',
    gender: '',
    photo: '',
    telegramId: tg.initDataUnsafe?.user?.id
};

// Автозаполнение имени из Telegram
const tgUser = tg.initDataUnsafe?.user;
if (tgUser) {
    userData.name = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
    if (tgUser.photo_url) {
        userData.photo = tgUser.photo_url;
    }
}

// Переход между экранами
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function startRegistration() {
    showScreen('registration-screen');
    // Заполняем имя и фото из Telegram
    if (userData.name) {
        document.getElementById('user-name').value = userData.name;
    }
    if (userData.photo) {
        document.getElementById('avatar-preview').src = userData.photo;
    }
}

function selectGender(gender) {
    userData.gender = gender;
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.gender === gender);
    });
    // Haptic feedback
    tg.HapticFeedback.impactOccurred('light');
}

function uploadPhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('avatar-preview').src = event.target.result;
                userData.photo = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

function submitRegistration() {
    const name = document.getElementById('user-name').value.trim();
    const age = document.getElementById('user-age').value.trim();
    const city = document.getElementById('user-city').value.trim();

    // Валидация
    if (!name || !age || !city || !userData.gender) {
        alert('Пожалуйста, заполни все поля и выбери пол!');
        tg.HapticFeedback.notificationOccurred('error');
        return;
    }

    if (parseInt(age) < 16) {
        alert('Игра доступна с 16 лет!');
        tg.HapticFeedback.notificationOccurred('error');
        return;
    }

    userData.name = name;
    userData.age = age;
    userData.city = city;

    // Показываем уведомление Telegram
    tg.MainButton.setText('Профиль создан! 🎉');
    tg.MainButton.show();
    tg.HapticFeedback.notificationOccurred('success');

    // Отправляем данные боту
    tg.sendData(JSON.stringify(userData));
}