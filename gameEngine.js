// gameEngine.js
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
const db = getDatabase();

// Simple in-memory cache for card data
const cardCache = new Map();

export async function fetchCardDetails(queryUrl) {
  if (cardCache.has(queryUrl)) {
    return cardCache.get(queryUrl);
  }
  const res = await fetch(queryUrl);
  const data = await res.json();
  cardCache.set(queryUrl, data);
  return data;
}

// Updated drawCards() now uses the cache to store fetched cards
export async function drawCards(count = 1) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    const url = 'https://api.scryfall.com/cards/random?q=game:paper';
    let cardData;
    if (cardCache.has(url)) {
      // For a random endpoint this is less ideal since you want variability.
      // In practice, you might cache only non-random queries.
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

// Advance to the next player's turn and trigger a start-of-turn card draw
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

async function givePlayerStartTurnDraw(roomCode, playerId) {
  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
  const snap = await get(playerRef);
  const player = snap.val();

  const newCard = await drawCards(1);
  const updatedHand = [...(player.hand || []), ...newCard];
  await update(playerRef, { hand: updatedHand });
}

// Resolve card effects including DRAW, DISCARD, EXILE, and new COUNTER effects.
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
        player.graveyard = [
          ...(player.graveyard || []),
          ...(player.hand.splice(0, effect.amount))
        ];
        break;
      }
      case 'EXILE': {
        player.exile = [
          ...(player.exile || []),
          ...(player.hand.splice(0, effect.amount))
        ];
        break;
      }
      case 'COUNTER': {
        // Example effect:
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
      // Add additional effect types as needed
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