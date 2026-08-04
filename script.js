// =====================================================
//  ВСТАВЬ СВОИ КЛЮЧИ SUPABASE (из старого файла)!
// =====================================================
const SUPABASE_URL = 'https://oreexiwvjhwssznwxndn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZWV4aXd2amh3c3N6bnd4bmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzAzNTUsImV4cCI6MjEwMTQwNjM1NX0.Jq33H7nyHOTx00_xBYEOsS5u02C6_i_iDnQyGcbaTZM';
// =====================================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let userData = {
    name: '', age: '', city: '', gender: '', photo: '', username: '', question: '',
    telegramId: (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user.id : 'unknown'
};

let currentGame = null;
let currentOpponent = null;
let pollTimer = null;

// ===== ЖИВЫЕ ФРАЗЫ ВО ВРЕМЯ ОЖИДАНИЯ =====
const waitPhrases = {
    search: [
        'Сканируем сердца поблизости 🔭',
        'Ищем кого-то с добрым сердцем 💕',
        'Сверяем ваши улыбки 📸',
        'Уже близко... 💫'
    ],
    answer: [
        'Игрок выбирает лучшие слова 😉',
        'Шлифует ответ до блеска ✨',
        'Советуется с сердцем 💓',
        'Пишет, стирает и снова пишет 🙈'
    ],
    choice: [
        'Игрок делает важный выбор 🤔',
        'Решается судьба твоего сердечка ⚖️',
        'Ещё чуть-чуть... 💫',
        'Перечитывает твой ответ 👀'
    ]
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
    }, 
