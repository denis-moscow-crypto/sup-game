const SUPABASE_URL = 'https://oreexiwvjhwssznwxndn.supabase.co';
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZWV4aXd2amh3c3N6bnd4bmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzAzNTUsImV4cCI6MjEwMTQwNjM1NX0.Jq33H7nyHOTx00_xBYEOsS5u02C6_i_iDnQyGcbaTZM"

let sb = null;
try {
    if (window.supabase && SUPABASE_URL.indexOf('https://') === 0 && SUPABASE_KEY.length > 30) {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) { console.log('Supabase ошибка:', e); }

const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : {
    ready: function () {}, expand: function () {},
    initDataUnsafe: {},
    HapticFeedback: { impactOccurred: function () {}, notificationOccurred: function () {} },
    MainButton: { setText: function () {}, show: function () {} },
    sendData: function () {}
};
try { tg.ready(); tg.expand(); } catch (e) {}

let userData = {
    name: '', age: '', city: '', gender: '', photo: '', username: '', question: '', blind: false,
    score: 0, wins: 0, games_played: 0, superlikes: 0, premium: false, invites: 0,
    telegramId: (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user.id : 'unknown'
};

let currentGame = null;
let currentOpponent = null;
let pollTimer = null;

const waitPhrases = {
    search: ['Сканируем сердца поблизости 🔭', 'Ищем кого-то с добрым сердцем 💕', 'Сверяем ваши улыбки 📸', 'Уже близко... 💫'],
    answer: ['Соперник выбирает лучшие слова 😉', 'Шлифует ответ до блеска ✨', 'Советуется с сердцем 💓', 'Пишет, стирает и снова пишет 🙈'],
    choice: ['Соперник делает важный выбор 🤔', 'Решается судьба твоего сердечка ⚖️', 'Ещё чуть-чуть... 💫', 'Перечитывает твой ответ 👀']
};
let waitTimer = null;
let waitIndex = 0;

function startWaiting(mode) {
    stopWaiting();
    waitIndex = 0;
    const el = document.getElementById('search-status');
    el.textContent = waitPhrases[mode][0];
    waitTimer = setInterval(() => {
        waitIndex = (waitIndex + 1) % waitPhrases[mode].length;
        el.textContent = waitPhrases[mode][waitIndex];
    }, 4000);
}
function stopWaiting() { if (waitTimer) { clearInterval(waitTimer); waitTimer = null; } }

function saveProfile(data) { localStorage.setItem('sup_profile', JSON.stringify(data)); }
function loadProfile() {
    const saved = localStorage.getItem('sup_profile');
    return saved ? JSON.parse(saved) : null;
}

function startHeartbeat() {
    if (window.__hb) return;
    const beat = async () => {
        if (!sb || !userData.telegramId || userData.telegramId === 'unknown') return;
        await sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', Number(userData.telegramId));
    };
    beat();
    window.__hb = setInterval(beat, 30000);
}

async function saveProfileToCloud(data) {
    if (!sb) return;
    const idNum = Number(data.telegramId);
    if (!idNum) return;
    const { error } = await sb.from('profiles').upsert({
        id: idNum, name: data.name, age: parseInt(data.age), city: data.city,
        gender: data.gender, photo: data.photo || null, username: data.username || null,
        question: data.question || null, blind: !!data.blind
    });
    if (error) console.log('Ошибка сохранения:', error.message);
}

async function openPlayers() {
    showScreen('players-screen');
    const list = document.getElementById('players-list');
    if (!sb) { list.innerHTML = '<div class="loading">⚠️ База не подключена</div>'; return; }
    list.innerHTML = '<div class="loading">Загружаем игроков...</div>';
    const cutoff = new Date(Date.now() - 90000).toISOString();
    const { data, error } = await sb.from('profiles').select('*').gt('last_seen', cutoff);
    if (error) { list.innerHTML = '<div class="loading">⚠️ ' + error.message + '</div>'; return; }
    const others = (data || []).filter(p => String(p.id) !== String(userData.telegramId));
    if (!others.length) { list.innerHTML = '<div class="loading">Сейчас никого нет онлайн 😢<br>Позови друзей!</div>'; return; }
    list.innerHTML = others.map(p =>
        '<div class="player-card"><div class="player-photo" style="background-image:url(' + (p.photo || '') + ')">' + (p.photo ? '' : '💕') + '</div>' +
        '<div class="player-info"><div class="player-name">' + escapeHtml(p.name) + (p.premium ? ' 💎' : '') + '</div>' +
        '<div class="player-meta">' + p.age + ' лет · ' + escapeHtml(p.city) + '</div></div></div>'
    ).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function setAvatar(elId, src) {
    const el = document.getElementById(elId);
    if (src) { el.style.backgroundImage = 'url(' + src + ')'; el.textContent = ''; }
    else { el.style.backgroundImage = 'none'; el.textContent = '📷'; }
}
function applyTheme() {
    document.body.classList.remove('theme-male', 'theme-female');
    if (userData.gender === 'male') document.body.classList.add('theme-male');
    if (userData.gender === 'female') document.body.classList.add('theme-female');
}
function startApp() {
    if (!sb) { alert('⚠️ База не подключена! Проверь ключ SUPABASE_KEY.'); }
    const saved = loadProfile();
    if (saved) { userData = Object.assign(userData, saved); startHeartbeat(); showProfile(); }
    else { showScreen('registration-screen'); prefillFromTelegram(); }
}

function prefillFromTelegram() {
    const tgUser = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (tgUser && tgUser.first_name) {
        document.getElementById('user-name').value = tgUser.first_name + ' ' + (tgUser.last_name || '');
    }
    if (tgUser && tgUser.username) {
        document.getElementById('user-username').value = '@' + tgUser.username;
    }
}

function selectGender(gender) {
    userData.gender = gender;
    applyTheme();
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
        });
    };
    input.click();
}

function submitRegistration() {
    const name = document.getElementById('user-name').value.trim();
    const age = document.getElementById('user-age').value.trim();
    const city = document.getElementById('user-city').value.trim();
    const username = document.getElementById('user-username').value.trim();
    if (!document.getElementById('agree-checkbox').checked) { alert('Подтверди, что тебе есть 16 лет и ты принимаешь правила!'); return; }
    if (!name || !age || !city || !userData.gender) { alert('Заполни все поля и выбери пол!'); return; }
    if (parseInt(age) < 16) { alert('Игра доступна с 16 лет!'); return; }
    userData.name = name; userData.age = age; userData.city = city; userData.username = username;
    saveProfile(userData);
    saveProfileToCloud(userData);
    startHeartbeat();
    showProfile();
}

function showProfile() {
    stopPolling(); stopWaiting();
    applyTheme();
    setAvatar('profile-photo', userData.photo);
    renderProfileInfo();
    showScreen('profile-screen');
    refreshMyStats();
}

function renderProfileInfo() {
    const genderText = userData.gender === 'male' ? '👨 Парень' : '👩 Девушка';
    document.getElementById('profile-info').innerHTML =
        '<div class="profile-name">' + escapeHtml(userData.name) + (userData.premium ? ' 💎' : '') + '</div>' +
        '<div class="profile-line">' + userData.age + ' лет · ' + escapeHtml(userData.city) + '</div>' +
        '<div class="profile-line">' + genderText + '</div>' +
        '<div class="profile-line">💎 ' + (userData.score || 0) + ' · ❤️ ' + (userData.wins || 0) + ' · 🎮 ' + (userData.games_played || 0) + ' · ⭐ ' + (userData.superlikes || 0) + ' · 💌 ' + (userData.invites || 0) + '</div>';
}

async function refreshMyStats() {
    if (!sb) return;
    const { data } = await sb.from('profiles').select('score, wins, games_played, superlikes, premium, invites').eq('id', Number(userData.telegramId)).single();
    if (data) {
        userData.score = data.score || 0;
        userData.wins = data.wins || 0;
        userData.games_played = data.games_played || 0;
        userData.superlikes = data.superlikes || 0;
        userData.premium = !!data.premium;
        userData.invites = data.invites || 0;
        renderProfileInfo();
    }
}

function editProfile() {
    document.getElementById('user-name').value = userData.name;
    document.getElementById('user-age').value = userData.age;
    document.getElementById('user-city').value = userData.city;
    document.getElementById('user-username').value = userData.username || '';
    setAvatar('avatar-preview', userData.photo);
    if (userData.gender) selectGender(userData.gender);
    showScreen('registration-screen');
}

function inviteFriends() {
    const link = 'https://t.me/sup_love_game_bot?start=ref_' + userData.telegramId;
    const text = 'Го в СУП 2.0 — отвечаешь на вопросы, влюбляешься, получаешь призы! 💕';
    window.open('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text), '_blank');
}
