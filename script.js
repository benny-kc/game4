
/* --- LOGIKA --- */
const playersContainer = document.getElementById("playersContainer");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const totalScoreEl = document.getElementById("totalScore");
const resetAllBtn = document.getElementById("resetAllBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

let players = [];
let playerIdCounter = 1;

/* --- SPEECH RECOGNITION --- */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;

if (SpeechRecognition) {
    recognizer = new SpeechRecognition();
    recognizer.lang = "pl-PL";
    recognizer.interimResults = false;
}

/* --- PARSER KOMEND GŁOSOWYCH --- */
function parseVoiceCommand(text) {
    text = text.toLowerCase();

    const numbers = {
        "zero": 0, "jeden": 1, "dwa": 2, "trzy": 3, "cztery": 4, "piec": 5, "pięć": 5,
        "szesc": 6, "sześć": 6, "siedem": 7, "osiem": 8, "dziewiec": 9, "dziewięć": 9,
        "dziesiec": 10, "dziesięć": 10
    };

    let value = null;

    // liczby słowne
    for (const word in numbers) {
        if (text.includes(word)) value = numbers[word];
    }

    // liczby cyfrowe
    const match = text.match(/\d+/);
    if (match) value = parseInt(match[0]);

    if (value === null) return null;

    if (text.includes("dodaj") || text.includes("plus")) return +value;
    if (text.includes("odejmij") || text.includes("minus")) return -value;

    return null;
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
        card.addEventListener("touchstart", () => {
            holdTimer = setTimeout(() => startVoiceMode(player.id, card), 600);
        });
        card.addEventListener("touchend", () => clearTimeout(holdTimer));

        /* --- KOLOROWY NAGŁÓWEK --- */
        const header = document.createElement("div");
        header.className = "player-header";

        const nameInput = document.createElement("input");
        nameInput.className = "player-name-input";
        nameInput.value = player.name;
        nameInput.placeholder = "Nazwa gracza";
        nameInput.addEventListener("input", e => { player.name = e.target.value; });

        const removeBtn = document.createElement("span");
        removeBtn.className = "player-remove";
        removeBtn.textContent = "Usuń";
        removeBtn.addEventListener("click", () => {
            players = players.filter(p => p.id !== player.id);
            updateTotal();
            renderPlayers();
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
}

/* --- ZMIANA PUNKTÓW --- */
function changeScore(id, delta) {
    const p = players.find(x => x.id === id);
    if (!p) return;
    p.score += delta;
    document.getElementById("score-" + id).textContent = p.score;
    updateTotal();
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
}

/* --- RESET --- */
function resetAll() {
    if (!players.length) return;
    if (!confirm("Wyzerować punkty wszystkich graczy?")) return;
    players.forEach(p => p.score = 0);
    renderPlayers();
    updateTotal();
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
        const delta = parseVoiceCommand(text);

        if (delta !== null) {
            changeScore(playerId, delta);
        } else {
            alert("Nie rozumiem komendy: " + text);
        }
    };

    recognizer.onend = () => {
        cardEl.classList.remove("listening");
    };
}

/* --- EVENTY --- */
addPlayerBtn.addEventListener("click", addPlayer);
resetAllBtn.addEventListener("click", resetAll);
fullscreenBtn.addEventListener("click", toggleFullscreen);

/* --- START --- */
addPlayer();
addPlayer();


/* --- rejestracja na telefonie jako aplikacja --- */
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
        .then(() => console.log("SW zarejestrowany"))
        .catch(err => console.error("SW error:", err));
}
