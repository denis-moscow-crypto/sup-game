const SUPABASE_URL = 'https://oreexiwvjhwssznwxndn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZWV4aXd2amh3c3N6bnd4bmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzAzNTUsImV4cCI6MjEwMTQwNjM1NX0.Jq33H7nyHOTx00_xBYEOsS5u02C6_i_iDnQyGcbaTZM';

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
    name: '', age: '', city: '', gender: '', photo: '', username: '', question: '', blind: false, zodiac: '', questionVoice: '',
    score: 0, wins: 0, games_played: 0, superlikes: 0, premium: false, invites: 0,
    telegramId: (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user.id : 'unknown'
};

let currentGame = null;
let currentOpponent = null;
let pollTimer = null;

const ZODIAC = {
    aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋', leo: '♌', virgo: '♍',
    libra: '♎', scorpio: '♏', sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓'
};
const ELEMENTS = {
    aries: 'fire', leo: 'fire', sagittarius: 'fire',
    taurus: 'earth', virgo: 'earth', capricorn: 'earth',
    gemini: 'air', libra: 'air', aquarius: 'air',
    cancer: 'water', scorpio: 'water', pisces: 'water'
};
function zodiacCompat(z1, z2) {
    if (!z1 || !z2 || !ZODIAC[z1] || !ZODIAC[z2]) return null;
    const key = [z1, z2].sort().join('-');
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 1000;
    const percent = 55 + (hash % 45);
    const e1 = ELEMENTS[z1], e2 = ELEMENTS[z2];
    let phrase = 'Интересное сочетание! ✨';
    if (e1 === e2) phrase = 'Вы из одной стихии — полное взаимопонимание! 🔥';
    else if ((e1 === 'fire' && e2 === 'air') || (e1 === 'air' && e2 === 'fire')) phrase = 'Огонь и воздух — искры летят! 🔥';
    else if ((e1 === 'water' && e2 === 'earth') || (e1 === 'earth' && e2 === 'water')) phrase = 'Вода и земля — гармония и уют 🌿';
    else if ((e1 === 'fire' && e2 === 'water') || (e1 === 'water' && e2 === 'fire')) phrase = 'Огонь и вода — буря эмоций! 🌪️';
    else phrase = 'Противоположности притягиваются! 🧲';
    return { percent: percent, phrase: phrase };
}

const waitPhrases = {
    search: ['Сканируем сердца поблизости 🔭', 'Ищем кого-то с добрым сердцем 💕', 'Сверяем ваши улыбки 📸', 'Уже близко... 💫'],
    answer: ['Соперник выбирает лучшие слова 😉', 'Шлифует ответ до блеска ✨', 'Советуется с сердцем 💓', 'Пишет, стирает и снова пишет 🙈'],
    choice: ['Соперник делает важный выбор 🤔', 'Решается судьба твоего сердечка ⚖️', 'Ещё чуть-чуть... 💫', 'Перечитывает твой ответ 👀']
};
const waitTitles = {
    search: 'Ищем тебе пару...',
    answer: 'Соперник отвечает на твой вопрос...',
    choice: 'Соперник делает выбор...'
};
const waitEmojis = { search: '💘', answer: '✍️', choice: '💭' };
let waitTimer = null;
let waitIndex = 0;

function startWaiting(mode) {
    stopWaiting();
    waitIndex = 0;
    const el = document.getElementById('search-status');
    const titleEl = document.getElementById('search-title');
    const heartEl = document.getElementById('search-heart');
    if (titleEl && waitTitles[mode]) titleEl.textContent = waitTitles[mode];
    if (heartEl) heartEl.textContent = waitEmojis[mode] || '💘';
    el.textContent = waitPhrases[mode][0];
    try { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); } catch (e) {}
    waitTimer = setInterval(() => {
        waitIndex = (waitIndex + 1) % waitPhrases[mode].length;
        el.textContent = waitPhrases[mode][waitIndex];
        try { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); } catch (e) {}
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
        question: data.question || null, blind: !!data.blind, zodiac: data.zodiac || null, vq: data.questionVoice || null
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
        '<div class="player-info"><div class="player-name">' + escapeHtml(p.name) + (p.premium ? ' 💎' : '') + (ZODIAC[p.zodiac] ? ' ' + ZODIAC[p.zodiac] : '') + '</div>' +
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
    if (saved) { userData = Object.assign(userData, saved); applyTheme(); startHeartbeat(); openQuestion(); }
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
    reader.onerror = () => callback(null);
    reader.onload = (ev) => {
        const img = new Image();
        img.onerror = () => callback(null);
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const scale = Math.min(1, 300 / Math.max(img.width, img.height));
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                callback(canvas.toDataURL('image/jpeg', 0.7));
            } catch (e) { callback(null); }
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
            if (!compressed) {
                alert('Не удалось обработать это фото 😢\nПопробуй другое — лучше JPG или PNG из галереи.');
                return;
            }
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
    const zodiac = document.getElementById('user-zodiac').value;
    if (!zodiac) { alert('Выбери свой знак зодиака ✨'); return; }
    if (!document.getElementById('agree-checkbox').checked) { alert('Подтверди, что тебе есть 16 лет и ты принимаешь правила!'); return; }
    if (!name || !age || !city || !userData.gender) { alert('Заполни все поля и выбери пол!'); return; }
    if (parseInt(age) < 16) { alert('Игра доступна с 16 лет!'); return; }
    userData.name = name; userData.age = age; userData.city = city; userData.username = username; userData.zodiac = zodiac;
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
        '<div class="profile-line">' + userData.age + ' лет · ' + escapeHtml(userData.city) + (userData.zodiac ? ' · ' + ZODIAC[userData.zodiac] : '') + '</div>' +
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
    document.getElementById('user-zodiac').value = userData.zodiac || '';
    setAvatar('avatar-preview', userData.photo);
    if (userData.gender) selectGender(userData.gender);
    showScreen('registration-screen');
}

function inviteFriends() {
    const link = 'https://t.me/sup_love_game_bot?start=ref_' + userData.telegramId;
    const text = 'Го в СУП 2.0 — отвечаешь на вопросы, влюбляешься, получаешь призы! 💕';
    window.open('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text), '_blank');
}

function initWelcome() {
    const saved = loadProfile();
    if (saved && saved.name) {
        document.getElementById('welcome-instructions').style.display = 'none';
        document.getElementById('welcome-back').style.display = 'block';
        document.getElementById('welcome-name').textContent = saved.name;
        document.getElementById('welcome-subtitle').textContent = 'Рады видеть тебя снова!';
        const btn = document.getElementById('welcome-btn');
        if (btn) btn.textContent = 'Играть 💘';
        userData = Object.assign(userData, saved);
        applyTheme();
        if (sb) {
            sb.from('profiles').select('score, wins, superlikes').eq('id', Number(saved.telegramId)).single().then(function (res) {
                const d = res.data;
                if (d) {
                    document.getElementById('welcome-stats').innerHTML =
                        '💎 ' + (d.score || 0) + ' · ❤️ ' + (d.wins || 0) + ' · ⭐ ' + (d.superlikes || 0);
                }
            });
        }
    }
}
initWelcome();

const AI_QUESTIONS = {
    fun: [
        'Какую самую странную вещь ты ел(а)? 🍜',
        'Если бы ты был(а) мемом — каким? 😄',
        'Твоя суперспособность, но бесполезная?',
        'Какой трек ты можешь слушать бесконечно?',
        'Самая смешная история из школы? 😅',
        'Зомби-апокалипсис: какая у тебя роль в команде?',
        'Какая у тебя странная привычка?',
        'Твоя любимая отмазка, чтобы никуда не идти?',
        'Миллион рублей, но потратить за один день — на что?',
        'Если бы животные умели говорить, кто был бы самым дерзким?'
    ],
    deep: [
        'Чем ты больше всего гордишься? 🌟',
        'Момент, который тебя изменил?',
        'Что ты больше всего ценишь в людях?',
        'О чём ты мечтаешь по-настоящему?',
        'Какой совет ты бы дал(а) себе в прошлом?',
        'Что делает тебя по-настоящему счастливым(ой)?',
        'Какое качество хочешь в себе развить?',
        'Что важнее: чтобы тебя любили или понимали?',
        'Как выглядит твой идеальный день?',
        'В какой эпохе ты бы хотел(а) жить?'
    ],
    flirty: [
        'Что ты заметишь во мне первым? 👀',
        'Идеальное первое свидание — какое оно?',
        'Веришь в любовь с первого взгляда или мне пройти мимо ещё раз? 😏',
        'Сделай мне комплимент, а я верну 😉',
        'Что может сразу тебя покорить?',
        'Самое романтичное, что ты делал(а)?',
        'Ужин при свечах или пицца на крыше? 🍕',
        'Что для тебя привлекательно в человеке?',
        'Представь наше первое свидание — куда идём?',
        'Умеешь готовить? Какое блюдо фирменное? 😋'
    ],
    date: [
        'Как выглядят твои идеальные выходные? ☕',
        'Ты сова или жаворонок?',
        'Твой любимый фильм на все времена? 🎬',
        'Горы или море? 🏔️🌊',
        'Что тебя рассмешило в последний раз до слёз?',
        'Кошки или собаки? 🐱🐶',
        'Как ты отдыхаешь после тяжёлого дня?',
        'Твоя любимая еда?',
        'Лучшее путешествие в твоей жизни?',
        'Чем ты увлекаешься прямо сейчас?'
    ]
};
let lastAiQuestion = '';

function aiQuestion() {
    const vibes = { fun: '🎭 Весёлый', deep: '🌌 Глубокий', flirty: '😏 Флирт', date: '☕ Лайфстайл' };
    const cats = Object.keys(AI_QUESTIONS);
    const cat = cats[Math.floor(Math.random() * cats.length)];
    const pool = AI_QUESTIONS[cat];
    let q = pool[Math.floor(Math.random() * pool.length)];
    let tries = 0;
    while (q === lastAiQuestion && tries < 5) {
        q = pool[Math.floor(Math.random() * pool.length)];
        tries++;
    }
    lastAiQuestion = q;
    const el = document.getElementById('question-input');
    const st = document.getElementById('ai-status');
    if (st) st.textContent = '🤖 ИИ думает...';
    el.value = '';
    let i = 0;
    const timer = setInterval(() => {
        el.value = q.slice(0, i + 1);
        i++;
        if (i >= q.length) {
            clearInterval(timer);
            if (st) st.textContent = vibes[cat] + ' · сгенерировано ИИ ✨';
        }
    }, 22);
}
 
