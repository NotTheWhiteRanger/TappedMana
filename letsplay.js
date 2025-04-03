// letsplay.js
import { getDatabase, ref, set, update, get, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { resolveCardEffects, nextPlayerTurn, drawCards } from "./gameEngine.js";
import { commanderDecks } from "./decks.js";

const db = getDatabase();
const auth = getAuth();

let currentRoom = null;
let currentUserId = null;
let currentUserName = "Player" + Math.floor(Math.random() * 1000);
let gamePhase = "Beginning";

// Utility: parse URL parameters
function getQueryParams() {
  const params = {};
  const queryString = window.location.search.substring(1);
  const pairs = queryString.split("&");
  for (const pair of pairs) {
    if (!pair) continue;
    const [key, value] = pair.split("=");
    params[decodeURIComponent(key)] = decodeURIComponent(value || "");
  }
  return params;
}
const queryParams = getQueryParams();

// Get deck selection from URL parameters or from a deck-selection element
function getSelectedDeck() {
  return queryParams.deck ||
         (document.getElementById('deck-selection') && document.getElementById('deck-selection').value) ||
         'deck1';
}

// Join game room: store user info, deck selection, and initial hand.
async function joinGameRoom(roomCode) {
  currentRoom = roomCode;
  const user = auth.currentUser;
  if (!user) return;
  currentUserId = user.uid;
  
  const selectedDeck = getSelectedDeck();
  const playerRef = ref(db, `rooms/${roomCode}/players/${currentUserId}`);
  const openingHand = await drawCards(7);

  await set(playerRef, {
    name: currentUserName,
    hand: openingHand,
    battlefield: [],
    graveyard: [],
    exile: [],
    commandZone: [],
    life: 40,
    deck: selectedDeck,
    counters: {}
  });

  const turnRef = ref(db, `rooms/${roomCode}/turn`);
  const turnSnap = await get(turnRef);
  if (!turnSnap.exists()) {
    await set(turnRef, currentUserId);
    await update(playerRef, { hand: [...openingHand, ...(await drawCards(1))] });
  }

  await set(ref(db, `rooms/${roomCode}/phase`), "Beginning");
  setupRealtimeUpdates(roomCode);
}

// Utility: get a card's image URL
function getCardImage(card) {
  return card.image_uris?.small ||
         card.card_faces?.[0]?.image_uris?.small ||
         "";
}

// Render all players and their fields (including counters and deck info)
function renderAllPlayers(players, currentTurnPlayer) {
  const area = document.getElementById("players-area");
  if (!area) return;
  area.innerHTML = "";
  Object.entries(players).forEach(([uid, data]) => {
    const isYou = uid === currentUserId;
    const isTurn = uid === currentTurnPlayer;
    const board = document.createElement("div");
    board.classList.add("player-board");
    board.innerHTML = `
      <div class="player-header">
        <h3>${data.name}${isYou ? " (You)" : ""}${isTurn ? " 🔁" : ""}</h3>
        <p>Life: ${data.life || 40}</p>
        <p>Deck: ${data.deck}</p>
        ${data.counters ? `<p>Counters: ${JSON.stringify(data.counters)}</p>` : ""}
      </div>
      <div class="player-fields">
        <div class="zone command-zone">
          <p>Command Zone</p>
          ${(data.commandZone || []).map(card => `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" />`).join("")}
        </div>
        <div class="zone battlefield-zone">
          <p>Battlefield</p>
          ${(data.battlefield || []).map(card => {
            const counterText = card.counters ? Object.entries(card.counters)
              .map(([type, amount]) => `${type}: ${amount}`)
              .join(", ") : "";
            return `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}${counterText ? ' (' + counterText + ')' : ''}" />`;
          }).join("")}
        </div>
        <div class="zone graveyard-zone">
          <p>Graveyard</p>
          ${(data.graveyard || []).map(card => `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" />`).join("")}
        </div>
        <div class="zone exile-zone">
          <p>Exile</p>
          ${(data.exile || []).map(card => `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" />`).join("")}
        </div>
        <div class="zone hand-zone">
          <p>Hand</p>
          ${isYou
            ? (data.hand || []).map((card, index) =>
                `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" data-index="${index}" class="hand-card" />`
              ).join("")
            : (data.hand || []).map(() => `<img src="card-back.jpg" alt="Card Back" />`).join("")}
        </div>
      </div>
    `;
    area.appendChild(board);
  });
  attachPlayCardListeners();
}

// Add click listeners to hand cards so they move to the battlefield with a counter effect.
function attachPlayCardListeners() {
  const handCards = document.querySelectorAll(".hand-card");
  handCards.forEach(cardImg => {
    cardImg.addEventListener("click", async () => {
      const index = parseInt(cardImg.getAttribute("data-index"));
      const userRef = ref(db, `rooms/${currentRoom}/players/${currentUserId}`);
      const snap = await get(userRef);
      const data = snap.val();
      const hand = data.hand || [];
      const battlefield = data.battlefield || [];

      if (hand[index]) {
        const card = hand[index];
        battlefield.push(card);
        hand.splice(index, 1);
        // Add a +1/+1 counter when the card is played.
        const effects = card.effects || [];
        effects.push({
          type: 'COUNTER',
          target: 'CARD',
          cardIndex: battlefield.length - 1,
          counterType: '+1/+1',
          amount: 1
        });
        await resolveCardEffects(currentRoom, currentUserId, effects);
        await update(userRef, { hand, battlefield });
      }
    });
  });
}

// Set up realtime Firebase listeners for players, turn, and phase.
function setupRealtimeUpdates(roomCode) {
  const roomRef = ref(db, `rooms/${roomCode}/players`);
  const turnRef = ref(db, `rooms/${roomCode}/turn`);
  const phaseRef = ref(db, `rooms/${roomCode}/phase`);

  let currentTurnPlayer = null;

  onValue(turnRef, snapshot => {
    currentTurnPlayer = snapshot.val();
  });

  onValue(roomRef, snapshot => {
    const players = snapshot.val() || {};
    renderAllPlayers(players, currentTurnPlayer);
  });

  onValue(phaseRef, snapshot => {
    const phaseDisplay = document.getElementById("phase-display");
    gamePhase = snapshot.val() || "Beginning";
    if (phaseDisplay) phaseDisplay.textContent = `Phase: ${gamePhase}`;
  });
}

// UI: Check for room code in URL and join game; otherwise, show a message.
function setupUIEvents() {
  if (!window.location.pathname.includes("letsplay.html")) return;
  const boardContainer = document.getElementById("board-container");
  if (!boardContainer) return;

  if (queryParams.room) {
    const roomCode = queryParams.room;
    const playerCount = queryParams.players || "4";
    boardContainer.classList.remove("players-2", "players-3", "players-4", "players-5");
    boardContainer.classList.add(`players-${playerCount}`);

    const roomCodeOverlay = document.getElementById("room-code");
    if (roomCodeOverlay) {
      roomCodeOverlay.textContent = `Room Code: ${roomCode}`;
      roomCodeOverlay.classList.remove("hidden");
    }
    joinGameRoom(roomCode);
  } else {
    const noRoomEl = document.getElementById("no-room");
    if (noRoomEl) noRoomEl.style.display = "block";
  }

  const phaseButton = document.getElementById("next-phase");
  if (phaseButton) {
    phaseButton.addEventListener("click", async () => {
      const phases = ["Beginning", "Main", "Combat", "Second Main", "End"];
      const currentIndex = phases.indexOf(gamePhase);
      const nextPhase = phases[(currentIndex + 1) % phases.length];
      await set(ref(db, `rooms/${currentRoom}/phase`), nextPhase);

      if (nextPhase === "End") {
        await nextPlayerTurn(currentRoom);
        await set(ref(db, `rooms/${currentRoom}/phase`), "Beginning");
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, user => {
    if (user) {
      setupUIEvents();
    }
  });
});