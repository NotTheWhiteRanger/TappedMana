// gameEngine.js
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
const db = getDatabase();

// In-memory cache for card data
const cardCache = new Map();

/**
 * Fetch a card by its exact name from Scryfall. Uses caching.
 */
export async function fetchCardByName(cardName) {
  const cacheKey = `name:${cardName}`;
  if (cardCache.has(cacheKey)) {
    return cardCache.get(cacheKey);
  }
  const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;
  const res = await fetch(url);
  const data = await res.json();
  cardCache.set(cacheKey, data);
  return data;
}

/**
 * Returns the image URL for a card object.
 */
export function getCardImage(card) {
  return card.image_uris?.small ||
         (card.card_faces && card.card_faces[0].image_uris?.small) ||
         `https://via.placeholder.com/80x120.png?text=${encodeURIComponent(card.name)}`;
}

/**
 * Draw cards from the Scryfall random endpoint.
 * (This function is for demonstration only and not used in deck-draw mode.)
 */
export async function drawCards(count = 1) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    const url = 'https://api.scryfall.com/cards/random?q=game:paper';
    let cardData;
    if (cardCache.has(url)) {
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
 * Advances to the next player's turn.
 * After updating the turn, the new player draws one card from their library.
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
 * Draw a number of cards from the player's library stored in Firebase.
 * Drawn cards are removed from the library.
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
 * Gives the player a start-of-turn draw by drawing one card from their library.
 */
async function givePlayerStartTurnDraw(roomCode, playerId) {
  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
  const newCard = await drawFromLibrary(roomCode, playerId, 1);
  const snap = await get(playerRef);
  const player = snap.val();
  const updatedHand = [...(player.hand || []), ...newCard];
  await update(playerRef, { hand: updatedHand });
}

/**
 * Resolves card effects (DRAW, DISCARD, EXILE, COUNTER).
 * For COUNTER effects, counters are added to a card on the battlefield or to the player.
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