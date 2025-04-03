// Multiplayer MTG Commander Online - Firebase Sync, UI, & Battlefield Interaction

import { getDatabase, ref, onValue, set, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Use the already‑initialized Firebase app from index.html
const db = getDatabase();
const auth = getAuth();

let currentRoom = null;
let currentUserId = null;
let currentUserName = "Player" + Math.floor(Math.random() * 1000);
let gamePhase = "Beginning";

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getCardImage(card) {
  return card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || "";
}

async function drawCards(count = 1) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    const res = await fetch('https://api.scryfall.com/cards/random?q=game:paper');
    cards.push(await res.json());
  }
  return cards;
}

// Render each player's full board (their "fields")
function renderAllPlayers(players) {
  const area = document.getElementById('players-area');
  area.innerHTML = '';
  Object.entries(players).forEach(([uid, data]) => {
    const isYou = uid === currentUserId;
    const board = document.createElement('div');
    board.classList.add('player-board');
    board.innerHTML = `
      <div class="player-header">
        <h3>${data.name}${isYou ? ' (You)' : ''}</h3>
        <p>Life: ${data.life || 40}</p>
      </div>
      <div class="player-fields">
        <div class="zone command-zone">
          <p>Command Zone</p>
          ${(data.commandZone || []).map(card => `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" />`).join('')}
        </div>
        <div class="zone battlefield-zone">
          <p>Battlefield</p>
          ${(data.battlefield || []).map(card => `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" />`).join('')}
        </div>
        <div class="zone graveyard-zone">
          <p>Graveyard</p>
          ${(data.graveyard || []).map(card => `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" />`).join('')}
        </div>
        <div class="zone exile-zone">
          <p>Exile</p>
          ${(data.exile || []).map(card => `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" />`).join('')}
        </div>
        <div class="zone hand-zone">
          <p>Hand</p>
          ${ isYou 
              ? (data.hand || []).map((card, index) => `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" data-index="${index}" class="hand-card" />`).join('')
              : (data.hand || []).map(() => `<img src="card-back.jpg" alt="Card Back" />`).join('')
          }
        </div>
      </div>
    `;
    area.appendChild(board);
  });
  attachPlayCardListeners();
}

function attachPlayCardListeners() {
  const handCards = document.querySelectorAll('.hand-card');
  handCards.forEach(cardImg => {
    cardImg.addEventListener('click', async () => {
      const index = parseInt(cardImg.getAttribute('data-index'));
      const userRef = ref(db, `rooms/${currentRoom}/players/${currentUserId}`);
      const snap = await get(userRef);
      const data = snap.val();

      const hand = data.hand || [];
      const battlefield = data.battlefield || [];

      if (hand[index]) {
        battlefield.push(hand[index]);
        hand.splice(index, 1);
        await update(userRef, { hand, battlefield });
      }
    });
  });
}

function setupRealtimeUpdates(roomCode) {
  const roomRef = ref(db, `rooms/${roomCode}/players`);
  onValue(roomRef, snapshot => {
    const players = snapshot.val() || {};
    renderAllPlayers(players);
  });
  const phaseRef = ref(db, `rooms/${roomCode}/phase`);
  onValue(phaseRef, snapshot => {
    const phaseDisplay = document.getElementById('phase-display');
    gamePhase = snapshot.val() || "Beginning";
    if (phaseDisplay) phaseDisplay.textContent = `Phase: ${gamePhase}`;
  });
}

async function joinGameRoom(roomCode) {
  currentRoom = roomCode;
  const user = auth.currentUser;
  if (!user) return;
  currentUserId = user.uid;
  const playerRef = ref(db, `rooms/${roomCode}/players/${currentUserId}`);
  const openingHand = await drawCards(7);
  await set(playerRef, {
    name: currentUserName,
    hand: openingHand,
    battlefield: [],
    graveyard: [],
    exile: [],
    commandZone: [],
    life: 40
  });
  await set(ref(db, `rooms/${roomCode}/phase`), "Beginning");
  setupRealtimeUpdates(roomCode);
}

function setupUIEvents() {
  const playerCountSelect = document.getElementById('player-count');

  document.getElementById('create-game').addEventListener('click', async () => {
    const roomCode = generateRoomCode();
    document.getElementById('room-code').textContent = `Room Code: ${roomCode}`;
    document.getElementById('room-code').classList.remove('hidden');

    // Apply layout class to board container based on selected player count
    const count = playerCountSelect.value;
    const boardContainer = document.getElementById('board-container');
    boardContainer.classList.remove('players-2', 'players-3', 'players-4', 'players-5');
    boardContainer.classList.add(`players-${count}`);

    document.getElementById('game-lobby').classList.add('hidden');
    document.getElementById('game-board').classList.remove('hidden');

    await joinGameRoom(roomCode);
  });

  document.getElementById('join-game').addEventListener('click', async () => {
    const code = document.getElementById('game-code').value.trim().toUpperCase();
    if (!code) return alert('Enter a valid game code.');
    document.getElementById('room-code').textContent = `Room Code: ${code}`;
    document.getElementById('room-code').classList.remove('hidden');

    // Apply layout class to board container based on selected player count
    const count = playerCountSelect.value;
    const boardContainer = document.getElementById('board-container');
    boardContainer.classList.remove('players-2', 'players-3', 'players-4', 'players-5');
    boardContainer.classList.add(`players-${count}`);

    document.getElementById('game-lobby').classList.add('hidden');
    document.getElementById('game-board').classList.remove('hidden');

    await joinGameRoom(code);
  });

  document.getElementById('draw-card').addEventListener('click', async () => {
    if (!currentRoom || !currentUserId) return;
    const card = (await drawCards(1))[0];
    const userRef = ref(db, `rooms/${currentRoom}/players/${currentUserId}`);
    const snap = await get(userRef);
    const data = snap.val();
    const newHand = data.hand || [];
    newHand.push(card);
    await update(userRef, { hand: newHand });
  });

  const phaseButton = document.getElementById('next-phase');
  if (phaseButton) {
    phaseButton.addEventListener('click', async () => {
      const phases = ["Beginning", "Main", "Combat", "Second Main", "End"];
      const currentIndex = phases.indexOf(gamePhase);
      const nextPhase = phases[(currentIndex + 1) % phases.length];
      await set(ref(db, `rooms/${currentRoom}/phase`), nextPhase);
    });
  }
}

onAuthStateChanged(auth, user => {
  if (user) {
    setupUIEvents();
  }
});
