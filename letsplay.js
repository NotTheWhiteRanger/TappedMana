// letsplay.js
import { getDatabase, ref, set, update, get, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { commanderDecks } from "./decks.js";
import { fetchCardByName, getCardImage, nextPlayerTurn } from "./gameEngine.js";

const db = getDatabase();
const auth = getAuth();

let currentRoom = null;
let currentUserId = null;
let currentUserName = "Player" + Math.floor(Math.random() * 1000);
let gamePhase = "Beginning";

// Utility: Parse URL parameters into an object.
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

// Get the selected deck ID from URL parameters or from the deck-selection element.
function getSelectedDeck() {
  return queryParams.deck ||
         (document.getElementById('deck-selection') && document.getElementById('deck-selection').value) ||
         'deck1';
}

// Helper: Fisher–Yates shuffle algorithm.
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

/**
 * Helper: Draw cards from the player's library.
 * The library is stored as an array of card objects; drawn cards are removed.
 */
async function drawFromLibrary(roomCode, playerId, count = 1) {
  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
  const snap = await get(playerRef);
  const player = snap.val();
  let library = player.library || [];
  if (library.length < count) count = library.length;
  const drawn = library.splice(0, count);
  await update(playerRef, { library });
  return drawn;
}

/**
 * When a player joins a game, load their selected deck, convert each card name into a full card object
 * by fetching details from Scryfall, shuffle the deck, draw an opening hand, and store the remaining library.
 */
async function joinGameRoom(roomCode) {
  currentRoom = roomCode;
  const user = auth.currentUser;
  if (!user) return;
  currentUserId = user.uid;
  
  const selectedDeckId = getSelectedDeck();
  const selectedDeckObj = commanderDecks.find(deck => deck.id === selectedDeckId);
  if (!selectedDeckObj) {
    console.error("Selected deck not found");
    return;
  }
  
  // Clone the deck list (an array of card names) and shuffle it.
  let library = [...selectedDeckObj.deckList];
  library = shuffle(library);
  console.log("Shuffled library (names):", library);
  
  // Convert each card name into a full card object from Scryfall.
  library = await Promise.all(library.map(cardName => fetchCardByName(cardName)));
  console.log("Shuffled library (card objects):", library);
  
  // Draw the top 7 cards as the opening hand.
  const openingHand = library.splice(0, 7);
  console.log("Opening hand:", openingHand);
  
  const playerRef = ref(db, `rooms/${roomCode}/players/${currentUserId}`);
  await set(playerRef, {
    name: currentUserName,
    hand: openingHand,
    library,          // Remaining deck as card objects.
    battlefield: [],
    graveyard: [],
    exile: [],
    commandZone: [],
    life: 40,
    deck: selectedDeckId,
    counters: {}
  });
  
  // Set initial turn if not already set.
  const turnRef = ref(db, `rooms/${roomCode}/turn`);
  const turnSnap = await get(turnRef);
  if (!turnSnap.exists()) {
    await set(turnRef, currentUserId);
    const extraCards = await drawFromLibrary(roomCode, currentUserId, 1);
    await update(playerRef, { hand: [...openingHand, ...extraCards] });
  }
  
  await set(ref(db, `rooms/${roomCode}/phase`), "Beginning");
  setupRealtimeUpdates(roomCode);
}

// Render players' boards (hand and other zones).
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
                `<img src="${getCardImage(card)}" alt="${card.name}" title="${card.name}" data-index="${index}" class="hand-card" />`
              ).join("")
            : (data.hand || []).map(() => `<img src="card-back.jpg" alt="Card Back" />`).join("")}
        </div>
        <!-- Additional zones (battlefield, graveyard, etc.) can be added here -->
      </div>
    `;
    area.appendChild(board);
  });
  attachPlayCardListeners();
}

// Attach click events to hand cards so they can be played (moved to battlefield).
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
        await update(userRef, { hand, battlefield });
      }
    });
  });
}

// Set up realtime Firebase listeners for players, turn, and phase updates.
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

// Set up UI events: join game if room code exists in URL.
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