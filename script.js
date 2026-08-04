// =====================================================
//  ВАЖНО: ВСТАВЬ СВОИ КЛЮЧИ SUPABASE!
// =====================================================
const SUPABASE_URL = 'https://oreexiwvjhwssznwxndn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZWV4aXd2amh3c3N6bnd4bmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzAzNTUsImV4cCI6MjEwMTQwNjM1NX0.Jq33H7nyHOTx00_xBYEOsS5u02C6_i_iDnQyGcbaTZM';
// =====================================================

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let sb = null;
let dbAvailable = false;

// Запасная загрузка SDK, если основная не сработала
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

async function initDB() {
    if (SUPABASE_URL.indexOf('XXXXX') !== -1 || SUPABASE_KEY.indexOf('ВСТАВЬ') !== -1) {
        console.log('⚠️ Ключи Supabase не вставлены!');
        return;
    }
    if (!window.supabase) {
        try { await loadScript('https://unpkg.com/@supabase/supabase-js@2'); }
        catch (e) { console.log('⚠️ SDK Supabase не загрузился'); return; }
    }
    if (window.supabase) {
        try {
            sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            dbAvailable = true;
            console.log('✅ Supabase подключён');
        } catch (e) { console.log('⚠️ Ошибка клиента:', e); }
    }
}
initDB();

// ===== ХРАНЕНИЕ НА УСТРОЙСТВЕ =====
function saveProfile(data) { localStorage.setItem('sup_profile', JSON.stringify(data)); }
function loadProfile() {
    const saved = localStorage.getItem('sup_profile');
    return saved ? JSON.parse(saved) : null;
}

// ===== ОБЛАКО =====
async function saveProfileToCloud(data) {
    if (!dbAvailable || !sb) { console.log('БД недоступна — профиль сохранён только на устройстве'); return; }
    const idNum = Number(data.telegramId);
    if (!idNum) { console.log('Нет Telegram ID — в облако не сохраняем'); return; }
    const { error } = await sb.from('profiles').upsert({
        id: idNum,
        name: data.name,
        age: parseInt(data.age),
        city: data.city,
        gender: data.gender,
        photo: data.photo || null
    });
    if (error) console.log('⚠️ Ошибка сохранения:', error.message);
    else console.log('✅ Профиль сохранён в облако');
}

async function openPlayers() {
    showScreen('players-screen');
    const list = document.getElementById('players-list');

    if (!dbAvailable || !sb) {
        list.innerHTML = '<div class="loading">⚠️ База не подключена.<br><br>Проверь, что вставил свои ключи Supabase вверху файла script.js</div>';
        return;
    }

    list.innerHTML = '<div class="loading">Загружаем игроков...</div>';
    const { data, error } = await sb.from('profiles').select('*');

    if (error) {
        list.innerHTML = '<div class="loading">⚠️ Ошибка базы:<br>' + error.message + '</div>';
        return;
    }

    const others = (data || []).filter(p => String(p.id) !== String(userData.telegramId));
    if (others.length === 0) {
        list.innerHTML = '<div class="loading">Пока нет других игроков 😢<br>Пригласи друзей в игру!</div>';
        return;
    }

    list.innerHTML = others.map(p =>
        '<div class="player-card">' +
            '<div class="player-photo" style="background-image:url(' + (p.photo || '') + ')">' + (p.photo ? '' : '💕') + '</div>' +
            '<div class="player-info">' +
                '<div class="player-name">' + escapeHtml(p.name) + '</div>' +
                '<div class="player-meta">' + p.age + ' лет · ' + escapeHtml(p.city) + '</div>' +
            '</div>' +
        '</div>'
    ).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// ===== ЭКРАНЫ =====
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function setAvatar(elId, src) {
    const el = document.getElementById(elId);
    if (src) { el.style.backgroundImage = 'url(' + src + ')'; el.textContent = ''; }
    else { el.style.backgroundImage = 'none'; el.textContent = '📷'; }
}

// ===== СТАРТ =====
function startApp() {
    const saved = loadProfile();
    if (saved) { userData = saved; showProfile(); }
    else { showScreen('registration-screen'); prefillFromTelegram(); }
}

let userData = {
    name: '', age: '', city: '', gender: '', photo: '',
    telegramId: (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user.id : 'unknown'
};

function prefillFromTelegram() {
    const tgUser = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (tgUser && tgUser.first_name) {
        document.getElementById('user-name').value = tgUser.first_name + ' ' + (tgUser.last_name || '');
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

function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, 300 / Math.max(img.width, img.height));
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
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
            setAvatar('avatar-preview', compressed);
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        });
    };
    input.click();
}

function submitRegistration() {
    const name = document.getElementById('user-name').value.trim();
    const age = document.getElementById('user-age').value.trim();
    const city = document.getElementById('user-city').value.trim();

    if (!name || !age || !city || !userData.gender) { alert('Заполни все поля и выбери пол!'); return; }
    if (parseInt(age) < 16) { alert('Игра доступна с 16 лет!'); return; }

    userData.name = name;
    userData.age = age;
    userData.city = city;

    saveProfile(userData);
    saveProfileToCloud(userData);
    showProfile();
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
}

// ===== ПРОФИЛЬ =====
function showProfile() {
    setAvatar('profile-photo', userData.photo);
    const genderText = userData.gender === 'male' ? '👨 Парень' : '👩 Девушка';
    document.getElementById('profile-info').innerHTML =
        '<div class="profile-name">' + escapeHtml(userData.name) + '</div>' +
        '<div class="profile-line">' + userData.age + ' лет · ' + escapeHtml(userData.city) + '</div>' +
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
