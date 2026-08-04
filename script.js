* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #ff6b9d 0%, #ff4778 100%);
    min-height: 100vh;
    color: white;
    overflow-x: hidden;
}

.app { min-height: 100vh; position: relative; }

.screen { display: none; min-height: 100vh; padding: 20px; }
.screen.active {
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.5s;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

.hearts-bg { position: absolute; width: 100%; height: 100%; pointer-events: none; overflow: hidden; }
.hearts-bg span { position: absolute; font-size: 30px; opacity: 0.3; animation: float 8s infinite ease-in-out; }
.hearts-bg span:nth-child(1) { left: 10%; animation-delay: 0s; }
.hearts-bg span:nth-child(2) { left: 30%; animation-delay: 2s; }
.hearts-bg span:nth-child(3) { left: 50%; animation-delay: 4s; }
.hearts-bg span:nth-child(4) { left: 70%; animation-delay: 1s; }
.hearts-bg span:nth-child(5) { left: 90%; animation-delay: 3s; }

@keyframes float {
    0%, 100% { transform: translateY(100vh) rotate(0deg); }
    50% { transform: translateY(-100px) rotate(180deg); }
}

.welcome-content { text-align: center; z-index: 10; position: relative; }

.logo {
    font-size: 80px; font-weight: bold; margin-bottom: 10px;
    background: linear-gradient(45deg, #fff, #ffe0eb);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
}

.tagline { font-size: 24px; margin-bottom: 20px; letter-spacing: 2px; }
.subtitle { font-size: 16px; opacity: 0.9; margin-bottom: 40px; max-width: 280px; margin-left: auto; margin-right: auto; }

.btn-primary {
    background: white; color: #ff4778; border: none;
    padding: 16px 40px; font-size: 18px; font-weight: bold;
    border-radius: 50px; cursor: pointer;
    box-shadow: 0 8px 25px rgba(0,0,0,0.2);
    transition: all 0.3s; margin-top: 10px; width: 100%;
}
.btn-primary:active { transform: scale(0.95); }

.btn-secondary {
    background: transparent; color: #ff4778; border: 2px solid #ff4778;
    padding: 14px 30px; font-size: 16px; font-weight: bold;
    border-radius: 50px; cursor: pointer; margin-top: 10px; width: 100%;
}

.form-container {
    background: rgba(255,255,255,0.95); padding: 30px 20px;
    border-radius: 25px; width: 100%; max-width: 400px;
    color: #333; box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}
.form-container h2 { text-align: center; color: #ff4778; margin-bottom: 25px; }

.avatar-upload { display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; cursor: pointer; }

.avatar-circle {
    width: 120px; height: 120px; border-radius: 50%;
    border: 4px solid #ff4778; background-color: #ffe0eb;
    background-size: cover; background-position: center;
    display: flex; align-items: center; justify-content: center;
    font-size: 40px; margin-bottom: 10px; overflow: hidden;
}
.avatar-circle.big { width: 140px; height: 140px; }

.upload-hint { color: #ff4778; font-size: 14px; }

.input {
    width: 100%; padding: 14px 20px; margin-bottom: 12px;
    border: 2px solid #eee; border-radius: 15px; font-size: 16px;
}
.input:focus { outline: none; border-color: #ff4778; }

.gender-select { display: flex; gap: 10px; margin-bottom: 15px; }
.gender-btn {
    flex: 1; padding: 14px; border: 2px solid #eee; background: white;
    border-radius: 15px; font-size: 16px; cursor: pointer;
}
.gender-btn.selected { background: #ff4778; color: white; border-color: #ff4778; }

.profile-card { display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; }
.profile-info { text-align: center; }
.profile-name { font-size: 22px; font-weight: bold; color: #ff4778; margin-top: 10px; }
.profile-line { font-size: 15px; color: #666; margin-top: 4px; }
/* Список игроков */
.players-list { max-height: 55vh; overflow-y: auto; margin-bottom: 15px; }
.player-card {
    display: flex; align-items: center; gap: 12px;
    background: #fff0f5; border-radius: 15px; padding: 10px; margin-bottom: 10px;
}
.player-photo {
    width: 60px; height: 60px; border-radius: 50%;
    background-color: #ffd0e0; background-size: cover; background-position: center;
    display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;
}
.player-name { font-weight: bold; color: #ff4778; }
.player-meta { font-size: 13px; color: #888; }
.loading { text-align: center; color: #888; padding: 20px; }
