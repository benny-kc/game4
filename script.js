
/* --- LOGIKA --- */
const playersContainer = document.getElementById("playersContainer");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const removePlayerBtn = document.getElementById("removePlayerBtn");
const totalScoreEl = document.getElementById("totalScore");
const resetAllBtn = document.getElementById("resetAllBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

let players = [];
let playerIdCounter = 1;
let removeMode = false;

/* --- SPEECH RECOGNITION --- */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;

if (SpeechRecognition) {
    recognizer = new SpeechRecognition();
    recognizer.lang = "pl-PL";
    recognizer.interimResults = false;
}

/* --- PARSER KOMEND GŁOSOWYCH --- */
// Returns: { type: 'score', delta } | { type: 'score_all', delta } | { type: 'rename', name } | null
function parseVoiceCommand(text) {
    text = text.toLowerCase().trim();

    // --- ZMIANA NAZWY ---
    // "nazwij X", "nazwij na X", "zmień nazwę na X", "zmień nazwę gracza na X"
    const renameKeywords = ["zmień nazwę gracza", "zmień nazwę", "nazwij gracza", "nazwij"];
    for (const kw of renameKeywords) {
        if (text.includes(kw)) {
            let rest = text.slice(text.indexOf(kw) + kw.length).trim();
            rest = rest.replace(/^(na|gracza)\s+/, "").trim();
            if (rest) return { type: "rename", name: rest.charAt(0).toUpperCase() + rest.slice(1) };
        }
    }

    // --- LICZBY ---
    const numbers = {
        "zero": 0, "jeden": 1, "dwa": 2, "trzy": 3, "cztery": 4,
        "pięć": 5, "piec": 5, "sześć": 6, "szesc": 6, "siedem": 7, "osiem": 8,
        "dziewięć": 9, "dziewiec": 9, "dziesięć": 10, "dziesiec": 10,
        "jedenaście": 11, "jedenascie": 11, "dwanaście": 12, "dwanascie": 12,
        "trzynaście": 13, "czternaście": 14, "piętnaście": 15, "pietnascie": 15,
        "szesnaście": 16, "siedemnaście": 17, "osiemnaście": 18, "dziewiętnaście": 19,
        "dwadzieścia": 20, "dwadziescia": 20, "trzydzieści": 30, "trzydziesci": 30,
        "czterdzieści": 40, "czterdziesci": 40, "pięćdziesiąt": 50, "piecdziesiat": 50,
        "sto": 100,
    };

    let value = null;
    for (const word in numbers) {
        if (text.includes(word)) value = numbers[word];
    }
    const match = text.match(/\d+/);
    if (match) value = parseInt(match[0]);

    if (value === null) return null;

    const add = text.includes("dodaj") || text.includes("plus") || text.includes("podaj");
    const sub = text.includes("odejmij") || text.includes("minus");
    if (!add && !sub) return null;
    const delta = add ? +value : -value;

    // --- WSZYSCY GRACZE ---
    if (text.includes("wszystkim") || text.includes("wszystkich")) {
        return { type: "score_all", delta };
    }

    return { type: "score", delta };
}

/* --- GRID LAYOUT --- */
function getGridDimensions(n) {
    const portrait = window.innerHeight >= window.innerWidth;
    // [cols, rows] lookup — portrait prefers tall stacks, landscape prefers wide rows
    const table = portrait
        ? [[1,1],[1,1],[1,2],[1,3],[2,2],[2,3],[2,3],[3,3],[3,3],[3,3]]
        : [[1,1],[1,1],[2,1],[3,1],[2,2],[3,2],[3,2],[4,2],[4,2],[3,3]];
    if (n < table.length) return table[n];
    const cols = Math.ceil(Math.sqrt(n));
    return [cols, Math.ceil(n / cols)];
}

function applyGridLayout() {
    const n = players.length;
    if (n === 0) return;

    const [cols, rows] = getGridDimensions(n);

    // Reset any previous spanning
    playersContainer.querySelectorAll('.player-card').forEach(c => {
        c.style.gridColumn = '';
    });

    playersContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    playersContainer.style.gridTemplateRows    = `repeat(${rows}, 1fr)`;

    // Span last-row cards when cols divides evenly into the remainder
    // e.g. 5 players, cols=2 → last row has 1 card → spans 2 (full width)
    //      3 players, cols=1 → last row always full → no-op
    const lastRowCount = n % cols || cols;
    if (lastRowCount < cols && cols % lastRowCount === 0) {
        const span = cols / lastRowCount;
        const cards = [...playersContainer.querySelectorAll('.player-card')];
        cards.slice(n - lastRowCount).forEach(c => {
            c.style.gridColumn = `span ${span}`;
        });
    }

    // Scale score font to available card size
    const scoreSize = n <= 2 ? 4 : n <= 4 ? 2.8 : n <= 6 ? 2.1 : 1.6;
    playersContainer.style.setProperty('--score-size', `${scoreSize}rem`);
}

/* --- RENDER --- */
function renderPlayers() {
    playersContainer.innerHTML = "";

    players.forEach(player => {
        const card = document.createElement("div");
        card.className = "player-card";
        card.dataset.id = player.id;
        card.dataset.color = player.colorIndex;

        /* --- PRZYTRZYMANIE DO GŁOSU --- */
        let holdTimer = null;
        let touchOriginX = 0, touchOriginY = 0;
        const HOLD_MOVE_LIMIT = 10; // px — more than this = scroll intent, not hold

        card.addEventListener("touchstart", e => {
            const t = e.touches[0];
            touchOriginX = t.clientX;
            touchOriginY = t.clientY;
            holdTimer = setTimeout(() => startVoiceMode(player.id, card), 600);
        });
        card.addEventListener("touchmove", e => {
            if (holdTimer === null) return;
            const t = e.touches[0];
            const dx = t.clientX - touchOriginX;
            const dy = t.clientY - touchOriginY;
            if (dx * dx + dy * dy > HOLD_MOVE_LIMIT * HOLD_MOVE_LIMIT) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        });
        card.addEventListener("touchend",    () => { clearTimeout(holdTimer); holdTimer = null; });
        card.addEventListener("touchcancel", () => { clearTimeout(holdTimer); holdTimer = null; });

        /* --- KOLOROWY NAGŁÓWEK --- */
        const header = document.createElement("div");
        header.className = "player-header";

        const nameInput = document.createElement("input");
        nameInput.className = "player-name-input";
        nameInput.value = player.name;
        nameInput.placeholder = "Nazwa gracza";
        nameInput.addEventListener("input", e => { player.name = e.target.value; saveState(); });

        const removeBtn = document.createElement("span");
        removeBtn.className = "player-remove";
        removeBtn.textContent = "Usuń";
        removeBtn.addEventListener("click", () => {
            players = players.filter(p => p.id !== player.id);
            updateTotal();
            renderPlayers();
            saveState();
        });

        header.appendChild(nameInput);
        header.appendChild(removeBtn);

        /* --- WYNIK --- */
        const scoreSection = document.createElement("div");
        scoreSection.className = "player-score-section";
        scoreSection.innerHTML = `
            <div class="score" id="score-${player.id}">${player.score}</div>
            <div class="score-label">Punkty</div>
        `;

        /* --- PRZYCISKI --- */
        const controls = document.createElement("div");
        controls.className = "controls";

        [
            { label: "−10", delta: -10, cls: "btn-score btn-minus" },
            { label: "−1",  delta:  -1, cls: "btn-score btn-minus" },
            { label: "+1",  delta:   1, cls: "btn-score btn-plus"  },
            { label: "+10", delta:  10, cls: "btn-score btn-plus"  },
        ].forEach(b => {
            const btn = document.createElement("button");
            btn.textContent = b.label;
            btn.className = b.cls;
            btn.addEventListener("click", () => changeScore(player.id, b.delta));
            controls.appendChild(btn);
        });

        card.appendChild(header);
        card.appendChild(scoreSection);
        card.appendChild(controls);

        playersContainer.appendChild(card);
    });

    applyGridLayout();
}

/* --- PERSYSTENCJA --- */
function saveState() {
    localStorage.setItem("scoreApp", JSON.stringify({ players, playerIdCounter }));
}

function loadState() {
    try {
        const raw = localStorage.getItem("scoreApp");
        if (!raw) return false;
        const { players: saved, playerIdCounter: counter } = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length > 0) {
            players = saved;
            playerIdCounter = counter || saved.length + 1;
            return true;
        }
    } catch (e) {}
    return false;
}

/* --- PARTICLES --- */
function spawnParticles(cardEl, delta) {
    const count = Math.min(Math.abs(delta), 10);
    const isPos = delta > 0;
    const scoreEl = cardEl.querySelector('.score');
    const cardRect  = cardEl.getBoundingClientRect();
    const scoreRect = scoreEl.getBoundingClientRect();

    const cx = scoreRect.left - cardRect.left + scoreRect.width  / 2;
    const cy = scoreRect.top  - cardRect.top  + scoreRect.height / 2;

    for (let i = 0; i < count; i++) {
        const el = document.createElement('span');
        el.className = 'score-particle ' + (isPos ? 'score-particle--plus' : 'score-particle--minus');
        el.textContent = isPos ? '+' : '−';

        const angle = Math.random() * Math.PI * 2;
        const dist  = 38 + Math.random() * 58;          // 38–96 px travel
        const dx    = Math.cos(angle) * dist;
        const dy    = Math.sin(angle) * dist;
        const size  = 0.85 + Math.random() * 0.85;      // 0.85–1.7 rem
        const dur   = 900 + Math.random() * 1600;        // 0.9–2.5 s
        const delay = Math.random() * 300;               // 0–300 ms stagger
        const rot   = (Math.random() - 0.5) * 80;       // ±40 deg spin

        el.style.cssText = `left:${cx}px;top:${cy}px;--dx:${dx}px;--dy:${dy}px;--rot:${rot}deg;font-size:${size}rem;animation-duration:${dur}ms;animation-delay:${delay}ms;`;

        cardEl.appendChild(el);
        setTimeout(() => el.remove(), dur + delay + 50);
    }
}

/* --- ZMIANA PUNKTÓW --- */
function changeScore(id, delta) {
    const p = players.find(x => x.id === id);
    if (!p) return;
    p.score += delta;
    const scoreEl = document.getElementById("score-" + id);
    scoreEl.textContent = p.score;
    spawnParticles(scoreEl.closest('.player-card'), delta);
    updateTotal();
    saveState();
}

/* --- SUMA --- */
function updateTotal() {
    totalScoreEl.textContent = players.reduce((s, p) => s + p.score, 0);
}

/* --- DODAWANIE GRACZA --- */
function addPlayer() {
    players.push({
        id: playerIdCounter++,
        name: "Gracz " + (players.length + 1),
        score: 0,
        colorIndex: players.length % 8
    });
    renderPlayers();
    updateTotal();
    saveState();
}

/* --- RESET --- */
function resetAll() {
    if (!players.length) return;
    if (!confirm("Wyzerować punkty wszystkich graczy?")) return;
    players.forEach(p => p.score = 0);
    renderPlayers();
    updateTotal();
    saveState();
}

/* --- FULLSCREEN --- */
function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
}

/* --- TRYB GŁOSOWY --- */
function startVoiceMode(playerId, cardEl) {
    if (!recognizer) {
        alert("Twoja przeglądarka nie obsługuje rozpoznawania mowy.");
        return;
    }

    cardEl.classList.add("listening");

    recognizer.start();

    recognizer.onresult = e => {
        const text = e.results[0][0].transcript;
        const action = parseVoiceCommand(text);

        if (!action) {
            alert("Nie rozumiem komendy: " + text);
            return;
        }

        if (action.type === "score") {
            changeScore(playerId, action.delta);
        } else if (action.type === "score_all") {
            players.forEach(p => changeScore(p.id, action.delta));
        } else if (action.type === "rename") {
            const p = players.find(x => x.id === playerId);
            if (p) { p.name = action.name; renderPlayers(); saveState(); }
        }
    };

    recognizer.onend = () => {
        cardEl.classList.remove("listening");
    };
}

/* --- TRYB USUWANIA --- */
function toggleRemoveMode() {
    removeMode = !removeMode;
    document.querySelector(".app").classList.toggle("remove-mode", removeMode);
    removePlayerBtn.classList.toggle("active", removeMode);
}

/* --- EVENTY --- */
addPlayerBtn.addEventListener("click", addPlayer);
removePlayerBtn.addEventListener("click", toggleRemoveMode);
resetAllBtn.addEventListener("click", resetAll);
fullscreenBtn.addEventListener("click", toggleFullscreen);
window.addEventListener("resize", applyGridLayout);

/* --- AUTO FULLSCREEN on first gesture --- */
(function () {
    let requested = false;
    function tryFullscreen() {
        if (requested || document.fullscreenElement) return;
        requested = true;
        document.documentElement.requestFullscreen().catch(() => { requested = false; });
    }
    document.addEventListener("touchstart", tryFullscreen, { once: true });
    document.addEventListener("click",      tryFullscreen, { once: true });
})();

/* --- START --- */
if (!loadState()) {
    addPlayer();
    addPlayer();
} else {
    renderPlayers();
    updateTotal();
}


/* --- rejestracja na telefonie jako aplikacja --- */
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
        .then(() => console.log("SW zarejestrowany"))
        .catch(err => console.error("SW error:", err));
}
