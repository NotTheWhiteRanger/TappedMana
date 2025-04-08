// === GLOBAL STATE ===
const phases = ["Untap", "Upkeep", "Draw", "Main 1", "Combat", "Main 2", "End"];
const players = [1, 2];
let currentPlayerIndex = 0;
let currentPhase = 0;
let hasPlayedLandThisTurn = { 1: false, 2: false };

function log(message) {
  console.log(message);
}

// === LIFE COUNTER ===
document.querySelectorAll('.life').forEach(el => {
  const update = (delta) => {
    let current = parseInt(el.textContent, 10);
    el.textContent = Math.max(0, current + delta);
  };
  el.addEventListener('click', (e) => {
    if (e.shiftKey) update(-1);
    else update(1);
  });
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    const newTotal = prompt("Set life total:", el.textContent);
    if (!isNaN(newTotal)) el.textContent = parseInt(newTotal);
  });
});

// === PHASES & TURN SYSTEM ===
function buildPhaseBars() {
  players.forEach(num => {
    const bar = document.getElementById(`phaseBar${num}`);
    bar.innerHTML = '';
    phases.forEach(phase => {
      const span = document.createElement('span');
      span.textContent = phase;
      bar.appendChild(span);
    });
  });
}

function highlightPhase() {
  players.forEach(num => {
    const spans = document.getElementById(`phaseBar${num}`).querySelectorAll('span');
    spans.forEach((span, i) => {
      span.classList.toggle('active', i === currentPhase);
    });
  });
}

function highlightActivePlayer() {
  players.forEach(num => {
    const el = document.getElementById(`player${num}`);
    el.classList.toggle('active', num === players[currentPlayerIndex]);
  });
}

function nextTurn() {
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  currentPhase = 0;
  hasPlayedLandThisTurn[players[currentPlayerIndex]] = false;
  highlightPhase();
  highlightActivePlayer();
}

function nextPhase() {
  currentPhase = (currentPhase + 1) % phases.length;
  highlightPhase();
}

document.querySelectorAll('.end-turn').forEach(btn => {
  btn.addEventListener('click', () => nextTurn());
});

buildPhaseBars();
highlightActivePlayer();
highlightPhase();
setInterval(nextPhase, 4000);

// === CARD DRAW (Scryfall) ===
document.querySelectorAll('[id^="library"]').forEach(lib => {
  lib.addEventListener('click', async () => {
    const playerNum = lib.id.replace('library', '');
    await drawToHand(playerNum, 1);
  });
});

async function drawToHand(playerNum, count = 1) {
  const hand = document.getElementById(`hand${playerNum}`);
  for (let i = 0; i < count; i++) {
    try {
      const res = await fetch("https://api.scryfall.com/cards/random");
      const data = await res.json();
      const imageUrl = data.image_uris?.normal || data.card_faces?.[0]?.image_uris?.normal;
      if (!imageUrl) continue;

      const img = document.createElement('img');
      img.src = imageUrl;
      img.className = 'card';
      img.draggable = true;
      img.dataset.cardName = data.name;
      img.dataset.isLand = (data.type_line || '').includes('Land');
      img.addEventListener('dragstart', dragStart);
      img.addEventListener('click', tapCard);
      img.addEventListener('contextmenu', openCardMenu);
      img.addEventListener('dblclick', zoomCard);
      hand.appendChild(img);
    } catch (err) {
      console.error("Failed to draw:", err);
    }
  }
}

players.forEach(p => drawToHand(p, 7));

// === DRAG & DROP ===
function dragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.src);
  e.dataTransfer.setData('origin-id', e.target.parentElement.id);
  e.dataTransfer.setData('card-name', e.target.dataset.cardName || '');
  e.dataTransfer.setData('is-land', e.target.dataset.isLand || 'false');
  setTimeout(() => e.target.style.display = "none", 1);
}

document.querySelectorAll('.zone, .hand').forEach(zone => {
  zone.addEventListener('dragover', e => e.preventDefault());
  zone.addEventListener('drop', e => {
    e.preventDefault();
    const url = e.dataTransfer.getData('text/plain');
    const origin = e.dataTransfer.getData('origin-id');
    const target = e.currentTarget.id;
    const name = e.dataTransfer.getData('card-name');
    const isLand = e.dataTransfer.getData('is-land') === 'true';

    const playerNum = target.match(/\d+/)?.[0];
    const isMainPhase = ["Main 1", "Main 2"].includes(phases[currentPhase]);
    const isSamePlayer = origin.includes(playerNum);

    if (target.includes("battlefield") && isLand && hasPlayedLandThisTurn[playerNum]) {
      alert("You already played a land this turn.");
      return;
    }

    if (isLand && target.includes("battlefield") && isMainPhase && isSamePlayer) {
      hasPlayedLandThisTurn[playerNum] = true;
    }

    const card = document.createElement('img');
    card.src = url;
    card.className = 'card';
    card.dataset.cardName = name;
    card.dataset.isLand = isLand;
    card.draggable = true;
    card.addEventListener('dragstart', dragStart);
    card.addEventListener('click', tapCard);
    card.addEventListener('contextmenu', openCardMenu);
    card.addEventListener('dblclick', zoomCard);
    e.currentTarget.appendChild(card);

    // Remove from origin
    const originEl = document.getElementById(origin);
    const original = [...originEl.querySelectorAll('img')].find(img => img.src === url);
    if (original) original.remove();
  });
});

// === TAP ===
function tapCard(e) {
  const card = e.currentTarget;
  const zone = card.parentElement.id;
  if (zone.includes('graveyard') || zone.includes('exile')) return;
  const tapped = card.classList.toggle('tapped');
  card.style.transform = tapped ? 'rotate(90deg)' : 'rotate(0deg)';
}

// === RIGHT-CLICK TO MOVE ===
function openCardMenu(e) {
  e.preventDefault();
  const card = e.currentTarget;
  const action = prompt("Move to: battlefield / graveyard / exile / hand / cancel", "cancel");
  if (!action || action === 'cancel') return;

  const zones = document.querySelectorAll('.zone, .hand');
  for (const zone of zones) {
    if (zone.id.toLowerCase().includes(action.toLowerCase())) {
      const clone = card.cloneNode(true);
      clone.draggable = true;
      clone.addEventListener('dragstart', dragStart);
      clone.addEventListener('click', tapCard);
      clone.addEventListener('contextmenu', openCardMenu);
      clone.addEventListener('dblclick', zoomCard);
      zone.appendChild(clone);
      card.remove();
      break;
    }
  }
}

// === DOUBLE CLICK ZOOM ===
function zoomCard(e) {
  const modal = document.getElementById('zoomModal');
  const img = document.getElementById('zoomImg');
  img.src = e.currentTarget.src;
  modal.style.display = 'flex';
}
document.getElementById('zoomModal').addEventListener('click', () => {
  document.getElementById('zoomModal').style.display = 'none';
});
