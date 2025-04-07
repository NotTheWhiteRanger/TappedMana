// === LIFE COUNTER ===
document.querySelectorAll('.life').forEach(el => {
  const update = (delta) => {
    let current = parseInt(el.textContent, 10);
    el.textContent = current + delta;
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

// === PHASE & TURNS ===
const phases = ["Untap", "Upkeep", "Draw", "Main 1", "Combat", "Main 2", "End"];
const players = [1, 2];
let currentPlayerIndex = 0;
let currentPhase = 0;

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
    const bar = document.getElementById(`phaseBar${num}`);
    const spans = bar.querySelectorAll('span');
    spans.forEach((span, i) => {
      span.classList.toggle('active', i === currentPhase);
    });
  });
}

function highlightActivePlayer() {
  players.forEach(num => {
    const container = document.getElementById(`player${num}`);
    container.classList.toggle('active', num === players[currentPlayerIndex]);
  });
}

function nextTurn() {
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  currentPhase = 0;
  highlightPhase();
  highlightActivePlayer();
}

function nextPhase() {
  currentPhase = (currentPhase + 1) % phases.length;
  highlightPhase();
}

// Initialize
buildPhaseBars();
highlightActivePlayer();
highlightPhase();
setInterval(nextPhase, 4000);

document.querySelectorAll('.end-turn').forEach(button => {
  button.addEventListener('click', () => nextTurn());
});

// === DRAW CARDS FROM SCRYFALL ===
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
      img.addEventListener('dragstart', dragStart);
      img.addEventListener('click', tapCard);
      img.addEventListener('contextmenu', openCardMenu);
      hand.appendChild(img);
    } catch (err) {
      console.error("Draw failed:", err);
    }
  }
}

// Start hands
players.forEach(p => drawToHand(p, 7));

// === DRAG & DROP SYSTEM ===
function dragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.src);
  e.dataTransfer.setData('source-zone', e.target.parentElement.id);
}

document.querySelectorAll('.zone, .hand').forEach(zone => {
  zone.addEventListener('dragover', e => e.preventDefault());
  zone.addEventListener('drop', e => {
    e.preventDefault();
    const url = e.dataTransfer.getData('text/plain');
    const card = document.createElement('img');
    card.src = url;
    card.className = 'card';
    card.draggable = true;
    card.addEventListener('dragstart', dragStart);
    card.addEventListener('click', tapCard);
    card.addEventListener('contextmenu', openCardMenu);
    e.currentTarget.appendChild(card);
  });
});

// === TAP CARD (rotate 90°) ===
function tapCard(e) {
  e.preventDefault();
  const card = e.currentTarget;
  const tapped = card.classList.toggle('tapped');
  card.style.transform = tapped ? 'rotate(90deg)' : 'rotate(0deg)';
}

// === RIGHT-CLICK CARD ACTION MENU (basic) ===
function openCardMenu(e) {
  e.preventDefault();
  const card = e.currentTarget;
  const action = prompt("Move card to: battlefield / graveyard / exile / hand / cancel", "cancel");
  const zones = document.querySelectorAll('.zone, .hand');

  if (!action || action === 'cancel') return;

  for (const zone of zones) {
    if (zone.id.toLowerCase().includes(action.toLowerCase())) {
      const clone = card.cloneNode(true);
      clone.addEventListener('dragstart', dragStart);
      clone.addEventListener('click', tapCard);
      clone.addEventListener('contextmenu', openCardMenu);
      zone.appendChild(clone);
      card.remove();
      break;
    }
  }
}
