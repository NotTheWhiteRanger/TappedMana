
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  push,
  get,
  child
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2B6KZgtYQPE4K-JF5GQszp5wjNgX6_MY",
  authDomain: "new-chat-8d4f4.firebaseapp.com",
  databaseURL: "https://new-chat-8d4f4-default-rtdb.firebaseio.com",
  projectId: "new-chat-8d4f4",
  storageBucket: "new-chat-8d4f4.firebasestorage.app",
  messagingSenderId: "825077448854",
  appId: "1:825077448854:web:3906174c00e1f6604782b7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let currentRoom = null;
let currentUserId = null;
let currentUserName = "Player" + Math.floor(Math.random() * 1000);

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

function renderAllPlayers(players) {
  const area = document.getElementById('players-area');
  area.innerHTML = '';

  Object.entries(players).forEach(([uid, data]) => {
    const isYou = uid === currentUserId;
    const panel = document.createElement('div');
    panel.classList.add('player-zone');
    panel.innerHTML = `
      <div class="player-header">
        <h3>${data.name}${isYou ? ' (You)' : ''}</h3>
        <p>Life: ${data.life || 40}</p>
      </div>
      <div class="battlefield">
        ${(data.battlefield || []).map(card => `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" />`).join('')}
      </div>
      <div class="hand-view">
        ${isYou ? (data.hand || []).map(card => `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" />`).join('') : (data.hand || []).map(() => `<img src="/card-back.jpg" alt="Card Back" />`).join('')}
      </div>
    `;
    area.appendChild(panel);
  });
}

function setupRealtimeUpdates(roomCode) {
  const roomRef = ref(db, `rooms/${roomCode}/players`);
  onValue(roomRef, snapshot => {
    const players = snapshot.val() || {};
    renderAllPlayers(players);
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

  setupRealtimeUpdates(roomCode);
}

function setupUIEvents() {
  document.getElementById('create-game').addEventListener('click', async () => {
    const roomCode = generateRoomCode();
    document.getElementById('room-code').textContent = `Room Code: ${roomCode}`;
    document.getElementById('room-code').classList.remove('hidden');

    document.getElementById('game-lobby').classList.add('hidden');
    document.getElementById('game-board').classList.remove('hidden');

    await joinGameRoom(roomCode);
  });

  document.getElementById('join-game').addEventListener('click', async () => {
    const code = document.getElementById('game-code').value.trim().toUpperCase();
    if (!code) return alert('Enter a valid game code.');

    document.getElementById('room-code').textContent = `Room Code: ${code}`;
    document.getElementById('room-code').classList.remove('hidden');

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
}

onAuthStateChanged(auth, user => {
  if (user) {
    setupUIEvents();
  }
});
