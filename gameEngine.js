// gameEngine.js
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
const db = getDatabase();

// In-memory cache for card data
const cardCache = new Map();

/**
 * Fetches card details from Scryfall using the provided query URL.
 * Uses an in-memory cache to avoid redundant network requests.
 */
export async function fetchCardDetails(queryUrl) {
  if (cardCache.has(queryUrl)) {
    return cardCache.get(queryUrl);
  }
  const res = await fetch(queryUrl);
  const data = await res.json();
  cardCache.set(queryUrl, data);
  return data;
}

/**
 * Draws a specified number of cards using the Scryfall random card endpoint.
 * Uses caching to store card data (note: for truly random draws, caching may be less ideal).
 */
export async function drawCards(count = 1) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    const url = 'https://api.scryfall.com/cards/random?q=game:paper';
    let cardData;
    if (cardCache.has(url)) {
      // For demonstration: caching a random card draw (you may want to adjust this behavior)
      cardData = cardCache.get(url);
    } else {
      const res = await fetch(url);
      cardData = await res.json();
      cardCache.set(url, cardData);
    }
    cards.push(cardData);
  }
  return cards;
}

/**
 * Advances the game to the next player's turn.
 * Updates the Firebase room turn data and gives the new player a card draw.
 */
export async function nextPlayerTurn(roomCode) {
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

/**
 * Gives a player a card draw at the start of their turn.
 */
async function givePlayerStartTurnDraw(roomCode, playerId) {
  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
  const snap = await get(playerRef);
  const player = snap.val();

  const newCard = await drawCards(1);
  const updatedHand = [...(player.hand || []), ...newCard];
  await update(playerRef, { hand: updatedHand });
}

/**
 * Resolves an array of card effects for a given player.
 * Supports effects: DRAW, DISCARD, EXILE, and COUNTER.
 * - For COUNTER effects, you can apply counters to a card on the battlefield or directly to the player.
 */
export async function resolveCardEffects(roomCode, playerId, effects) {
  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
  const snap = await get(playerRef);
  const player = snap.val();

  for (const effect of effects) {
    switch (effect.type) {
      case 'DRAW': {
        const drawn = await drawCards(effect.amount);
        player.hand = [...(player.hand || []), ...drawn];
        break;
      }
      case 'DISCARD': {
        player.graveyard = [...(player.graveyard || []), ...player.hand.splice(0, effect.amount)];
        break;
      }
      case 'EXILE': {
        player.exile = [...(player.exile || []), ...player.hand.splice(0, effect.amount)];
        break;
      }
      case 'COUNTER': {
        // For a card: { type: 'COUNTER', target: 'CARD', cardIndex: 0, counterType: '+1/+1', amount: 1 }
        // For a player: { type: 'COUNTER', target: 'PLAYER', counterType: 'poison', amount: 1 }
        if (effect.target === 'CARD') {
          if (player.battlefield && player.battlefield[effect.cardIndex]) {
            const card = player.battlefield[effect.cardIndex];
            card.counters = card.counters || {};
            card.counters[effect.counterType] = (card.counters[effect.counterType] || 0) + effect.amount;
          }
        } else if (effect.target === 'PLAYER') {
          player.counters = player.counters || {};
          player.counters[effect.counterType] = (player.counters[effect.counterType] || 0) + effect.amount;
        }
        break;
      }
      default:
        console.warn("Unhandled effect type:", effect.type);
    }
  }

  await update(playerRef, {
    hand: player.hand,
    graveyard: player.graveyard,
    exile: player.exile,
    battlefield: player.battlefield,
    counters: player.counters
  });
}