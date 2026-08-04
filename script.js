// =====================================================
//  ВСТАВЬ СВОЙ КЛЮЧ!
// =====================================================
const SUPABASE_URL = 'https://oreexiwvjhwssznwxndn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZWV4aXd2amh3c3N6bnd4bmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzAzNTUsImV4cCI6MjEwMTQwNjM1NX0.Jq33H7nyHOTx00_xBYEOsS5u02C6_i_iDnQyGcbaTZM';
// =====================================================

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
    const { data, error } = await sb.from('profiles').select('*');
    if (error) { list.innerHTML = '<div class="loading">⚠️ ' + error.message + '</div>'; return; }
    const others = (data || []).filter(p => String(p.id) !== String(userData.telegramId));
    if (!others.length) { list.innerHTML = '<div class="loading">Пока нет других игроков 😢</div>'; return; }
    list.innerHTML = others.map(p =>
        '<div class="player-card"><div class="player-photo" style="background-image:url(' + (p.photo || '') + ')">' + (p.photo ? '' : '💕') + '</div>' +
        '<div class="player-info"><div class="player-name">' + escapeHtml(p.name) + '</div>' +
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

function startApp() {
    if (!sb) { alert('⚠️ База не подключена! Проверь ключ SUPABASE_KEY.'); }
    const saved = loadProfile();
    if (saved) { userData = Object.assign(userData, saved); showProfile(); }
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
    if (!name || !age || !city || !userData.gender) { alert('Заполни все поля и выбери пол!'); return; }
    if (parseInt(age) < 16) { alert('Игра доступна с 16 лет!'); return; }
    userData.name = name; userData.age = age; userData.city = city; userData.username = username;
    saveProfile(userData);
    saveProfileToCloud(userData);
    showProfile();
}

function showProfile() {
    stopPolling(); stopWaiting();
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
    document.getElementById('user-username').value = userData.username || '';
    setAvatar('avatar-preview', userData.photo);
    if (userData.gender) selectGender(userData.gender);
    showScreen('registration-screen');
}

// ===== ВОПРОС И ПОИСК =====
function openQuestion() {
    document.getElementById('question-input').value = userData.question || '';
    document.getElementById('blind-checkbox').checked = !!userData.blind;
    showScreen('question-screen');
}

async function saveQuestionAndSearch() {
    const q = document.getElementById('question-input').value.trim();
    if (!q) { alert('Придумай вопрос!'); return; }
    userData.question = q;
    userData.blind = document.getElementById('blind-checkbox').checked;
    saveProfile(userData);
    await saveProfileToCloud(userData);
    startSearch();
}

function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

async function startSearch() {
    if (!sb) { alert('⚠️ База не подключена! Проверь ключ SUPABASE_KEY.'); return; }
    showScreen('search-screen');
    startWaiting('search');
    await sb.from('profiles').update({ status: 'searching' }).eq('id', Number(userData.telegramId));
    stopPolling();
    pollTimer = setInterval(searchTick, 3000);
    searchTick();
}

async function searchTick() {
    const myId = Number(userData.telegramId);
    const { data: games } = await sb.from('games').select('*')
        .or('player1.eq.' + myId + ',player2.eq.' + myId)
        .neq('status', 'done').limit(1);
    if (games && games.length) {
        stopPolling();
        currentGame = games[0];
        renderRound();
        return;
    }
    const { data: candidates } = await sb.from('profiles').select('*')
        .eq('status', 'searching').neq('id', myId).neq('gender', userData.gender).limit(1);
    if (candidates && candidates.length) {
        const opp = candidates[0];
        const { error } = await sb.from('games').insert({
            player1: myId, player2: opp.id, q1: userData.question, q2: opp.question,
            blind: !!(userData.blind || opp.blind)
        });
        if (!error) {
            await sb.from('profiles').update({ status: 'in_game' }).in('id', [myId, opp.id]);
            document.getElementById('search-status').textContent = 'Пара найдена! 🎉';
        }
    }
}

async function cancelSearch() {
    stopPolling(); stopWaiting();
    if (sb) await sb.from('profiles').update({ status: 'idle' }).eq('id', Number(userData.telegramId));
    showProfile();
}

// ===== РАУНД =====
function myRole(g) { return String(g.player1) === String(userData.telegramId) ? 'p1' : 'p2'; }

async function loadOpponent(g) {
    const oppId = myRole(g) === 'p1' ? g.player2 : g.player1;
    const { data } = await sb.from('profiles').select('*').eq('id', oppId).single();
    return data;
}

async function renderRound() {
    stopWaiting();
    const g = currentGame;
    const role = myRole(g);
    const myAnswer = role === 'p1' ? g.a1 : g.a2;
    const oppAnswer = role === 'p1' ? g.a2 : g.a1;
    const myChoice = role === 'p1' ? g.c1 : g.c2;

    if (g.status === 'done') { showResult(); return; }

    if (g.status === 'answers' && !myAnswer) {
        if (!document.getElementById('round-answer-screen').classList.contains('active')) {
            const oppQ = role === 'p1' ? g.q2 : g.q1;
            document.getElementById('round-question-text').textContent = oppQ || 'Расскажи о себе 😉';
            showScreen('round-answer-screen');
        }
        return;
    }
    if (g.status === 'answers' && myAnswer) {
        showScreen('search-screen');
        startWaiting('answer');
        startRoundPolling();
        return;
    }
    if (g.status === 'choose' && myChoice === null) {
        if (!document.getElementById('round-choose-screen').classList.contains('active')) {
            currentOpponent = await loadOpponent(g);
            const opp = currentOpponent || {};
            if (g.blind) {
                // СЛЕПОЙ РЕЖИМ: скрываем фото и имя
                setAvatar('choose-photo', null);
                document.getElementById('choose-photo').textContent = '🕶️';
                document.getElementById('choose-info').innerHTML =
                    '<div class="profile-name">Таинственный незнакомец</div>' +
                    '<div class="profile-line">' + (opp.age || '') + ' лет · ' + escapeHtml(opp.city || '') + '</div>';
            } else {
                setAvatar('choose-photo', opp.photo);
                document.getElementById('choose-info').innerHTML =
                    '<div class="profile-name">' + escapeHtml(opp.name) + '</div>' +
                    '<div class="profile-line">' + (opp.age || '') + ' лет · ' + escapeHtml(opp.city || '') + '</div>';
            }
            document.getElementById('choose-answer').textContent = oppAnswer || '...';
            showScreen('round-choose-screen');
        }
        return;
    }
    if (g.status === 'choose' && myChoice !== null) {
        showScreen('search-screen');
        startWaiting('choice');
        startRoundPolling();
        return;
    }
}

function startRoundPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
        const { data } = await sb.from('games').select('*').eq('id', currentGame.id).single();
        if (data) { currentGame = data; renderRound(); }
    }, 3000);
}

async function submitAnswer() {
    const text = document.getElementById('round-answer-input').value.trim();
    if (!text) { alert('Напиши ответ!'); return; }
    const role = myRole(currentGame);
    const field = role === 'p1' ? 'a1' : 'a2';
    await sb.from('games').update({ [field]: text }).eq('id', currentGame.id);
    const { data } = await sb.from('games').select('*').eq('id', currentGame.id).single();
    currentGame = data;
    if (data.a1 && data.a2 && data.status === 'answers') {
        await sb.from('games').update({ status: 'choose' }).eq('id', data.id);
        currentGame.status = 'choose';
    }
    renderRound();
}

async function submitChoice(like) {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    const role = myRole(currentGame);
    const field = role === 'p1' ? 'c1' : 'c2';
    await sb.from('games').update({ [field]: like }).eq('id', currentGame.id);
    const { data } = await sb.from('games').select('*').eq('id', currentGame.id).single();
    currentGame = data;
    if (data.c1 !== null && data.c2 !== null && data.status !== 'done') {
        await sb.from('games').update({ status: 'done' }).eq('id', data.id);
        await sb.from('profiles').update({ status: 'idle' }).in('id', [data.player1, data.player2]);
        currentGame.status = 'done';
    }
    renderRound();
}

async function showResult() {
    stopPolling(); stopWaiting();
    currentOpponent = currentOpponent || await loadOpponent(currentGame);
    const opp = currentOpponent || {};
    const match = currentGame.c1 && currentGame.c2;

    if (match) {
        document.getElementById('result-emoji').textContent = currentGame.blind ? '🕶️' : '💖';
        document.getElementById('result-title').textContent = currentGame.blind ? 'Завеса раскрыта!' : 'Это взаимно!';
        let body = '';
        if (opp.photo) {
            body += '<div class="avatar-circle big" style="margin:0 auto 10px;background-image:url(' + opp.photo + ')"></div>';
        }
        body += '<div class="profile-name">' + escapeHtml(opp.name) + '</div>';
        body += '<div class="profile-line">тоже выбрал(а) тебя! 🎉</div>';
        if (opp.username) {
            const u = opp.username.replace('@', '');
            body += '<br>Напиши скорее: <a href="https://t.me/' + u + '" target="_blank">@' + u + '</a>';
        }
        document.getElementById('result-body').innerHTML = body;
    } else {
        document.getElementById('result-emoji').textContent = '💔';
        document.getElementById('result-title').textContent = 'Не в этот раз...';
        document.getElementById('result-body').innerHTML = currentGame.blind
            ? 'Таинственный незнакомец остался тайной 🕶️<br>Но впереди ещё много сердец!'
            : 'Симпатия не совпала. Но впереди ещё много сердец!';
    }
    showScreen('result-screen');
}

async function playAgain() {
    if (sb) await sb.from('profiles').update({ status: 'idle' }).eq('id', Number(userData.telegramId));
   
