// Firebase
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const db = getDatabase();

// Utility: Draw cards using Scryfall API
export async function drawCards(count = 1) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    const res = await fetch('https://api.scryfall.com/cards/random?q=game:paper');
    cards.push(await res.json());
  }
  return cards;
}

// Core: Advance to next player's turn
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

// Draw a card at start of turn
async function givePlayerStartTurnDraw(roomCode, playerId) {
  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
  const snap = await get(playerRef);
  const player = snap.val();

  const newCard = await drawCards(1);
  const updatedHand = [...(player.hand || []), ...newCard];
  await update(playerRef, { hand: updatedHand });
}

// Trigger card effects
export async function resolveCardEffects(roomCode, playerId, effects) {
  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
  const snap = await get(playerRef);
  const player = snap.val();

  for (const effect of effects) {
    switch (effect.type) {
      case 'DRAW':
        const drawn = await drawCards(effect.amount);
        player.hand = [...(player.hand || []), ...drawn];
        break;
      case 'DISCARD':
        player.graveyard = [...(player.graveyard || []), ...(player.hand.splice(0, effect.amount))];
        break;
      case 'EXILE':
        player.exile = [...(player.exile || []), ...(player.hand.splice(0, effect.amount))];
        break;
      // Add more effects as needed
    }
  }

  await update(playerRef, {
    hand: player.hand,
    graveyard: player.graveyard,
    exile: player.exile
  });
}
