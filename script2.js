function openQuestion() {
    const savedQ = userData.question || '';
    document.getElementById('question-input').value = savedQ.indexOf('🎤') === 0 ? '' : savedQ;
    document.getElementById('blind-checkbox').checked = !!userData.blind;
    const prev = document.getElementById('qrec-preview');
    if (userData.questionVoice) {
        prev.src = userData.questionVoice; prev.style.display = 'block';
        setRecStatusEl('qrec-status', '✅ Голосовой вопрос прикреплён');
    } else {
        prev.style.display = 'none'; setRecStatusEl('qrec-status', '');
    }
    document.getElementById('qrec-btn').textContent = '🎤 Записать голосом';
    showScreen('question-screen');
}

async function saveQuestionAndSearch() {
    const q = document.getElementById('question-input').value.trim();
    if (!q && !voiceQuestionData) { alert('Напиши вопрос или запиши его голосом 🎤'); return; }
    userData.question = q || '🎤 Голосовой вопрос';
    if (voiceQuestionData) userData.questionVoice = voiceQuestionData;
    voiceQuestionData = null;
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
        const g = games[0];
        const age = Date.now() - new Date(g.created_at).getTime();
        if (age > 20 * 60 * 1000) {
            await sb.from('games').update({ status: 'done' }).eq('id', g.id);
            await sb.from('profiles').update({ status: 'idle' }).in('id', [g.player1, g.player2]);
        } else {
            stopPolling();
            currentGame = g;
            renderRound();
            return;
        }
    }
    const { data: candidates } = await sb.from('profiles').select('*')
        .eq('status', 'searching').neq('id', myId).neq('gender', userData.gender).limit(1);
    if (candidates && candidates.length) {
        const opp = candidates[0];
        const { error } = await sb.from('games').insert({
            player1: myId, player2: opp.id, q1: userData.question, q2: opp.question,
            vq1: userData.questionVoice || null, vq2: opp.vq || null,
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
    if (currentGame) {
        await sb.from('games').update({ status: 'done' }).eq('id', currentGame.id);
        await sb.from('profiles').update({ status: 'idle' }).in('id', [currentGame.player1, currentGame.player2]);
        currentGame = null;
    } else if (sb) {
        await sb.from('profiles').update({ status: 'idle' }).eq('id', Number(userData.telegramId));
    }
    showProfile();
}

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
            const oppVQ = role === 'p1' ? g.vq2 : g.vq1;
            const vqEl = document.getElementById('round-question-voice');
            if (vqEl) {
                if (oppVQ) { vqEl.src = oppVQ; vqEl.style.display = 'block'; }
                else { vqEl.style.display = 'none'; }
            }
            document.getElementById('rec-preview').style.display = 'none';
            setRecStatusEl('rec-status', '');
            document.getElementById('rec-btn').textContent = '🎤 Записать голос';
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
                setAvatar('choose-photo', null);
                document.getElementById('choose-photo').textContent = '🕶️';
                document.getElementById('choose-info').innerHTML =
                    '<div class="profile-name">Таинственный незнакомец ' + (ZODIAC[opp.zodiac] || '') + '</div>' +
                    '<div class="profile-line">' + (opp.age || '') + ' лет · ' + escapeHtml(opp.city || '') + '</div>';
            } else {
                setAvatar('choose-photo', opp.photo);
                document.getElementById('choose-info').innerHTML =
                    '<div class="profile-name">' + escapeHtml(opp.name) + ' ' + (ZODIAC[opp.zodiac] || '') + '</div>' +
                    '<div class="profile-line">' + (opp.age || '') + ' лет · ' + escapeHtml(opp.city || '') + '</div>';
            }
            document.getElementById('choose-answer').textContent = oppAnswer || '...';
            const oppVoice = role === 'p1' ? g.va2 : g.va1;
            const vp = document.getElementById('choose-voice');
            if (vp) {
                if (oppVoice) { vp.src = oppVoice; vp.style.display = 'block'; }
                else { vp.style.display = 'none'; }
            }
            const oppSl = role === 'p1' ? g.sl2 : g.sl1;
            document.getElementById('superlike-banner').style.display = oppSl ? 'block' : 'none';
            const oppC = role === 'p1' ? g.c2 : g.c1;
            document.getElementById('premium-hint').style.display = (userData.premium && oppC === true) ? 'block' : 'none';
            document.getElementById('superlike-btn').style.display = (userData.superlikes || 0) > 0 ? 'inline-block' : 'none';
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

async function applyRefBonus(pid) {
    const { data: p } = await sb.from('profiles').select('referred_by, ref_counted, score').eq('id', pid).single();
    if (p && p.referred_by && !p.ref_counted) {
        await sb.from('profiles').update({ ref_counted: true, score: (p.score || 0) + 5 }).eq('id', pid);
        const { data: ref } = await sb.from('profiles').select('invites, score').eq('id', p.referred_by).single();
        if (ref) {
            await sb.from('profiles').update({ invites: (ref.invites || 0) + 1, score: (ref.score || 0) + 5 }).eq('id', p.referred_by);
        }
    }
}

async function finishGameStats(data) {
    const match = data.c1 && data.c2;
    for (const pid of [data.player1, data.player2]) {
        const { data: prof } = await sb.from('profiles').select('score, wins, games_played').eq('id', pid).single();
        if (prof) {
            await sb.from('profiles').update({
                games_played: (prof.games_played || 0) + 1,
                wins: (prof.wins || 0) + (match ? 1 : 0),
                score: (prof.score || 0) + (match ? 10 : 2)
            }).eq('id', pid);
        }
        await applyRefBonus(pid);
    }
}

async function submitAnswer() {
    const text = document.getElementById('round-answer-input').value.trim();
    if (!text && !voiceData) { alert('Напиши ответ или запиши голос 🎤'); return; }
    const role = myRole(currentGame);
    const field = role === 'p1' ? 'a1' : 'a2';
    const upd = {};
    upd[field] = text || '🎤 Голосовое сообщение';
    if (voiceData) upd[role === 'p1' ? 'va1' : 'va2'] = voiceData;
    await sb.from('games').update(upd).eq('id', currentGame.id);
    voiceData = null;
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
        await finishGameStats(data);
        currentGame.status = 'done';
    }
    renderRound();
}

async function submitSuperlike() {
    if ((userData.superlikes || 0) <= 0) { alert('Нет суперлайков! Купи в магазине 💎'); return; }
    await sb.from('profiles').update({ superlikes: (userData.superlikes || 0) - 1 }).eq('id', Number(userData.telegramId));
    userData.superlikes = (userData.superlikes || 0) - 1;
    const role = myRole(currentGame);
    const upd = {};
    upd[role === 'p1' ? 'sl1' : 'sl2'] = true;
    upd[role === 'p1' ? 'c1' : 'c2'] = true;
    await sb.from('games').update(upd).eq('id', currentGame.id);
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    const { data } = await sb.from('games').select('*').eq('id', currentGame.id).single();
    currentGame = data;
    if (data.c1 !== null && data.c2 !== null && data.status !== 'done') {
        await sb.from('games').update({ status: 'done' }).eq('id', data.id);
        await sb.from('profiles').update({ status: 'idle' }).in('id', [data.player1, data.player2]);
        await finishGameStats(data);
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
        const comp = zodiacCompat(userData.zodiac, opp.zodiac);
        if (comp) {
            body += '<div class="profile-line" style="margin-top:8px;background:#fff0f5;border-radius:12px;padding:8px;">' +
                ZODIAC[userData.zodiac] + ' + ' + ZODIAC[opp.zodiac] + ' — ' + comp.percent + '% совместимости<br>' + comp.phrase + '</div>';
        }
        if (opp.username) {
            const u = opp.username.replace('@', '');
            body += '<br>Напиши скорее: <a href="https://t.me/' + u + '" target="_blank">@' + u + '</a>';
        }
        body += '<div style="margin-top:12px;font-size:14px;color:#777;"><b>Сделай подарок совпадению:</b></div>' +
            '<div class="choice-buttons" style="margin-top:6px;">' +
            '<button class="btn-yes" style="background:#ffe0eb;color:#d6336c;font-size:14px;" onclick="openGift(\'rose\')">🌹 15⭐</button>' +
            '<button class="btn-yes" style="background:#ffe0eb;color:#d6336c;font-size:14px;" onclick="openGift(\'teddy\')">🧸 50⭐</button>' +
            '<button class="btn-yes" style="background:#ffe0eb;color:#d6336c;font-size:14px;" onclick="openGift(\'ring\')">💍 150⭐</button>' +
            '</div>';
        document.getElementById('result-body').innerHTML = body;
    } else {
        document.getElementById('result-emoji').textContent = '💔';
        document.getElementById('result-title').textContent = 'Не в этот раз...';
        document.getElementById('result-body').innerHTML = currentGame.blind
            ? 'Таинственный незнакомец остался тайной 🕶️<br>Но впереди ещё много сердец!'
            : 'Симпатия не совпала. Но впереди ещё много сердец!';
    }
    if (match) burstHearts();
    showScreen('result-screen');
}

async function playAgain() {
    if (sb) await sb.from('profiles').update({ status: 'idle' }).eq('id', Number(userData.telegramId));
    currentGame = null;
    currentOpponent = null;
    openQuestion();
}

async function openRating() {
    showScreen('rating-screen');
    const list = document.getElementById('rating-list');
    if (!sb) { list.innerHTML = '<div class="loading">⚠️ База не подключена</div>'; return; }
    list.innerHTML = '<div class="loading">Загружаем рейтинг...</div>';
    const { data, error } = await sb.from('profiles').select('*').order('score', { ascending: false }).limit(10);
    if (error) { list.innerHTML = '<div class="loading">⚠️ ' + error.message + '</div>'; return; }
    const medals = ['🥇', '🥈', '🥉'];
    list.innerHTML = (data || []).map((p, i) =>
        '<div class="player-card"><div class="player-photo" style="background-image:url(' + (p.photo || '') + ')">' + (p.photo ? '' : '💕') + '</div>' +
        '<div class="player-info"><div class="player-name">' + (medals[i] || (i + 1) + '.') + ' ' + escapeHtml(p.name) + (p.premium ? ' 💎' : '') + '</div>' +
        '<div class="player-meta">💎 ' + (p.score || 0) + ' · ❤️ ' + (p.wins || 0) + ' · 🎮 ' + (p.games_played || 0) + '</div></div></div>'
    ).join('');
}

const BADGES = [
    { id: 'first', emoji: '🌱', name: 'Первые шаги', desc: 'Сыграть первую игру', test: s => (s.games_played || 0) >= 1 },
    { id: 'love1', emoji: '💘', name: 'Сердцеед', desc: 'Первая взаимная симпатия', test: s => (s.wins || 0) >= 1 },
    { id: 'love3', emoji: '🔥', name: 'Казанова', desc: '3 взаимные симпатии', test: s => (s.wins || 0) >= 3 },
    { id: 'love10', emoji: '👑', name: 'Легенда СУП', desc: '10 взаимных симпатий', test: s => (s.wins || 0) >= 10 },
    { id: 'games10', emoji: '🎮', name: 'Завсегдатай', desc: 'Сыграть 10 игр', test: s => (s.games_played || 0) >= 10 },
    { id: 'score100', emoji: '💎', name: 'Богач', desc: 'Набрать 100 очков', test: s => (s.score || 0) >= 100 },
    { id: 'ref3', emoji: '💌', name: 'Посол любви', desc: 'Пригласить 3 друзей', test: s => (s.invites || 0) >= 3 }
];

function badgesFor(stats) {
    return BADGES.filter(b => b.test(stats));
}

async function openAchievements() {
    showScreen('achievements-screen');
    const list = document.getElementById('achievements-list');
    list.innerHTML = '<div class="loading">Загружаем...</div>';
    let stats = userData;
    if (sb) {
        const { data } = await sb.from('profiles').select('score, wins, games_played, invites').eq('id', Number(userData.telegramId)).single();
        if (data) stats = data;
    }
    const unlocked = badgesFor(stats);
    list.innerHTML = BADGES.map(b => {
        const has = unlocked.some(u => u.id === b.id);
        return '<div class="player-card" style="' + (has ? '' : 'opacity:0.45;') + '">' +
            '<div class="player-photo" style="background:#ffe0eb;">' + (has ? b.emoji : '🔒') + '</div>' +
            '<div class="player-info"><div class="player-name">' + b.name + '</div>' +
            '<div class="player-meta">' + b.desc + (has ? ' · ПОЛУЧЕНО!' : '') + '</div></div></div>';
    }).join('');
}

function openShop() { showScreen('shop-screen'); }

function openBuy(param) {
    window.open('https://t.me/sup_love_game_bot?start=' + param, '_blank');
}

async function leaveRound() {
    if (!confirm('Соперник не в сети? Выйти из раунда?')) return;
    if (currentGame) {
        await sb.from('games').update({ status: 'done' }).eq('id', currentGame.id);
        await sb.from('profiles').update({ status: 'idle' }).in('id', [currentGame.player1, currentGame.player2]);
    }
    currentGame = null;
    stopPolling(); stopWaiting();
    showProfile();
}

function burstHearts() {
    const emojis = ['💖', '', '💕', '❤️', '💗'];
    for (let i = 0; i < 18; i++) {
        const s = document.createElement('span');
        s.className = 'burst-heart';
        s.textContent = emojis[i % emojis.length];
        const ang = Math.random() * Math.PI * 2;
        const dist = 90 + Math.random() * 140;
        s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
        s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 1300);
    }
}

async function openMatches() {
    showScreen('matches-screen');
    const list = document.getElementById('matches-list');
    if (!sb) { list.innerHTML = '<div class="loading">⚠️ База не подключена</div>'; return; }
    list.innerHTML = '<div class="loading">Загружаем совпадения...</div>';
    const myId = Number(userData.telegramId);
    const { data, error } = await sb.from('games').select('*')
        .or('player1.eq.' + myId + ',player2.eq.' + myId)
        .eq('status', 'done').eq('c1', true).eq('c2', true)
        .order('created_at', { ascending: false });
    if (error) { list.innerHTML = '<div class="loading">⚠️ ' + error.message + '</div>'; return; }
    if (!data || !data.length) {
        list.innerHTML = '<div class="loading">Пока нет совпадений 😢<br>Играй — любовь близко!</div>';
        return;
    }
    let html = '';
    for (const g of data) {
        const oppId = String(g.player1) === String(myId) ? g.player2 : g.player1;
        const { data: opp } = await sb.from('profiles').select('*').eq('id', oppId).single();
        const p = opp || {};
        html += '<div class="player-card"><div class="player-photo" style="background-image:url(' + (p.photo || '') + ')">' + (p.photo ? '' : '💖') + '</div>' +
            '<div class="player-info"><div class="player-name">' + escapeHtml(p.name) + '</div>' +
            '<div class="player-meta">' + (p.city ? escapeHtml(p.city) + ' · ' : '') + 'ваше совпадение 💖</div>' +
            (p.username ? '<div class="player-meta"><a href="https://t.me/' + escapeHtml(p.username).replace('@', '') + '" target="_blank">' + escapeHtml(p.username) + '</a></div>' : '') +
            '</div></div>';
    }
    list.innerHTML = html;
}

function openGift(type) {
    if (!currentOpponent || !currentOpponent.id) { alert('Сначала сыграй раунд!'); return; }
    window.open('https://t.me/sup_love_game_bot?start=gift_' + type + '_' + currentOpponent.id, '_blank');
}

let mediaRecorder = null;
let recChunks = [];
let voiceData = null;
let voiceQuestionData = null;
let recTimer = null;
let recSeconds = 0;

function setRecStatusEl(id, t) {
    const el = document.getElementById(id);
    if (el) el.textContent = t;
}
function setRecStatus(t) { setRecStatusEl('rec-status', t); }

async function toggleRecording(target) {
    target = target || 'answer';
    const btnId = target === 'question' ? 'qrec-btn' : 'rec-btn';
    const stId = target === 'question' ? 'qrec-status' : 'rec-status';
    const prevId = target === 'question' ? 'qrec-preview' : 'rec-preview';
    const btn = document.getElementById(btnId);
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        clearInterval(recTimer);
        mediaRecorder.stop();
        btn.textContent = target === 'question' ? '🎤 Записать голосом' : '🎤 Записать голос';
        return;
    }
    if (target === 'question') voiceQuestionData = null; else voiceData = null;
    document.getElementById(prevId).style.display = 'none';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        recChunks = [];
        mediaRecorder.ondataavailable = (e) => recChunks.push(e.data);
        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(recChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
            if (blob.size > 900 * 1024) {
                alert('Слишком длинно 🙈 Запиши до 60 секунд.');
                setRecStatusEl(stId, '');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                if (target === 'question') voiceQuestionData = reader.result;
                else voiceData = reader.result;
                const prev = document.getElementById(prevId);
                prev.src = reader.result;
                prev.style.display = 'block';
                setRecStatusEl(stId, '✅ Голос прикреплён!');
            };
            reader.readAsDataURL(blob);
        };
        mediaRecorder.start();
        recSeconds = 0;
        setRecStatusEl(stId, '🔴 Идёт запись... 0 сек');
        btn.textContent = '⏹ Стоп';
        recTimer = setInterval(() => {
            recSeconds++;
            setRecStatusEl(stId, '🔴 Идёт запись... ' + recSeconds + ' сек');
            if (recSeconds >= 60) toggleRecording(target);
        }, 1000);
    } catch (e) {
        alert('Микрофон недоступен 🙏 Используй текст.');
    }
}
