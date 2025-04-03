// letsplay.js
import { getDatabase, ref, set, update, get, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

// Get deck selection from URL or UI
function getSelectedDeck() {
  return queryParams.deck ||
         (document.getElementById('deck-selection') && document.getElementById('deck-selection').value) ||
         'deck1';
}

// Helper: Fisher–Yates shuffle
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // Swap the elements
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

/**
 * Draws `count` cards from the player's library (deck) stored in Firebase.
 * The drawn cards are removed from the library so they are not drawn again.
 */
async function drawFromLibrary(roomCode, playerId, count = 1) {
  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
  const snap = await get(playerRef);
  const player = snap.val();
  let library = player.library || [];
  // If there aren’t enough cards left, draw as many as possible.
  if (library.length < count) count = library.length;
  const drawn = library.splice(0, count);
  await update(playerRef, { library });
  return drawn;
}

/**
 * When a player joins a game, load their chosen deck, shuffle it, and draw an opening hand.
 */
async function joinGameRoom(roomCode) {
  currentRoom = roomCode;
  const user = auth.currentUser;
  if (!user) return;
  currentUserId = user.uid;
  
  // Get selected deck ID and find the deck object
  const selectedDeckId = getSelectedDeck();
  const selectedDeckObj = commanderDecks.find(deck => deck.id === selectedDeckId);
  if (!selectedDeckObj) {
    console.error("Selected deck not found");
    return;
  }
  
  // Copy and shuffle the deck list to serve as the player's library.
  let library = [...selectedDeckObj.deckList];
  library = shuffle(library);
  
  // Draw the top 7 cards as an opening hand.
  const openingHand = library.splice(0, 7);
  
  const playerRef = ref(db, `rooms/${roomCode}/players/${currentUserId}`);
  await set(playerRef, {
    name: currentUserName,
    hand: openingHand,
    library,          // Store the remaining deck as the library.
    battlefield: [],
    graveyard: [],
    exile: [],
    commandZone: [],
    life: 40,
    deck: selectedDeckId,
    counters: {}
  });
  
  // Set initial turn information if needed.
  const turnRef = ref(db, `rooms/${roomCode}/turn`);
  const turnSnap = await get(turnRef);
  if (!turnSnap.exists()) {
    await set(turnRef, currentUserId);
    // Draw an extra card at turn start (if desired)
    const extraCards = await drawFromLibrary(roomCode, currentUserId, 1);
    await update(playerRef, { hand: [...openingHand, ...extraCards] });
  }
  
  await set(ref(db, `rooms/${roomCode}/phase`), "Beginning");
  setupRealtimeUpdates(roomCode);
}

// Utility: get a card image URL (if you later integrate with an API)
function getCardImage(cardName) {
  // For now, simply return a placeholder or a URL constructed from the card name.
  // You could integrate with Scryfall image search here.
  return `https://via.placeholder.com/80x120.png?text=${encodeURIComponent(cardName)}`;
}

// Render players’ boards including hand and battlefield.
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
        <div class="zone hand-zone">
          <p>Hand</p>
          ${isYou
            ? (data.hand || []).map((card, index) =>
                `<img src="${getCardImage(card)}" alt="${card}" title="${card}" data-index="${index}" class="hand-card" />`
              ).join("")
            : (data.hand || []).map(() => `<img src="card-back.jpg" alt="Card Back" />`).join("")}
        </div>
        <!-- Other zones like battlefield, graveyard, etc. can be added here -->
      </div>
    `;
    area.appendChild(board);
  });
  attachPlayCardListeners();
}

// When a hand card is clicked, move it to the battlefield and (if needed) trigger effects.
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
        // (Optional) Add a +1/+1 counter effect when the card is played.
        // You could implement additional effects here.
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

// UI: If a room code exists in the URL, join the game.
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

      // When moving to "End", advance the turn and draw a card from the library.
      if (nextPhase === "End") {
        await nextPlayerTurn(currentRoom);
        await set(ref(db, `rooms/${currentRoom}/phase`), "Beginning");
      }
    });
  }
}

// Modified turn draw: draw one card from the player's library.
async function nextPlayerTurn(roomCode) {
  const playersRef = ref(db, `rooms/${roomCode}/players`);
  const playersSnap = await get(playersRef);
  const players = playersSnap.val() || {};
  const playerIds = Object.keys(players);

  const turnRef = ref(db, `rooms/${roomCode}/turn`);
  const turnSnap = await get(turnRef);
  const currentId = turnSnap.val() || playerIds[0];

  const currentIndex = playerIds.indexOf(currentId);
  const nextIndex = (currentIndex + 1) % playerIds.length;
  const nextPlayerId = playerIds[nextIndex];

  await set(turnRef, nextPlayerId);
  await givePlayerStartTurnDraw(roomCode, nextPlayerId);
}

async function givePlayerStartTurnDraw(roomCode, playerId) {
  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
  const newCard = await drawFromLibrary(roomCode, playerId, 1);
  const snap = await get(playerRef);
  const player = snap.val();
  const updatedHand = [...(player.hand || []), ...newCard];
  await update(playerRef, { hand: updatedHand });
}

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, user => {
    if (user) {
      setupUIEvents();
    }
  });
});