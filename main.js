document.addEventListener('DOMContentLoaded', () => {
  const createGameButton = document.getElementById('create-game');
  const joinGameButton = document.getElementById('join-game');
  const gameLobby = document.getElementById('game-lobby');
  const gameBoard = document.getElementById('game-board');
  const roomCodeDisplay = document.getElementById('room-code');
  const drawCardButton = document.getElementById('draw-card');
  const handCardsContainer = document.getElementById('hand-cards');

  // Sample players array
  let players = [
    { id: 1, name: "You", life: 40, commanderDamage: {} },
    { id: 2, name: "Player 2", life: 40, commanderDamage: {} },
    { id: 3, name: "Player 3", life: 40, commanderDamage: {} },
    { id: 4, name: "Player 4", life: 40, commanderDamage: {} },
  ];

  // Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyD2B6KZgtYQPE4K-JF5GQszp5wjNgX6_MY",
    authDomain: "new-chat-8d4f4.firebaseapp.com",
    databaseURL: "https://new-chat-8d4f4-default-rtdb.firebaseio.com",
    projectId: "new-chat-8d4f4",
    storageBucket: "new-chat-8d4f4.firebasestorage.app",
    messagingSenderId: "825077448854",
    appId: "1:825077448854:web:3906174c00e1f6604782b7"
  };

  // Draw and display 7 random cards using Scryfall API
  async function drawOpeningHand() {
    handCardsContainer.innerHTML = '';
    try {
      const res = await fetch('https://api.scryfall.com/cards/random?q=game:paper');
      const hand = await Promise.all(Array.from({ length: 7 }, () =>
        fetch('https://api.scryfall.com/cards/random?q=game:paper').then(res => res.json())
      ));

      hand.forEach(card => {
        const img = document.createElement('img');
        img.src = card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || '';
        img.alt = card.name;
        img.title = card.name;
        img.style.width = '80px';
        img.style.margin = '4px';
        handCardsContainer.appendChild(img);
      });
    } catch (err) {
      console.error("Failed to fetch Scryfall cards:", err);
    }
  }

  function updatePlayersArea() {
    const playersArea = document.getElementById('players-area');
    playersArea.innerHTML = '';
    players.forEach(player => {
      const playerDiv = document.createElement('div');
      playerDiv.classList.add('player-panel');
      playerDiv.innerHTML = `
        <h3>${player.name}</h3>
        <p>Life: <span id="life-${player.id}">${player.life}</span></p>
        <p>Commander Damage: <span id="damage-${player.id}">None</span></p>
      `;
      playersArea.appendChild(playerDiv);
    });
  }

  createGameButton.addEventListener('click', async () => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    roomCodeDisplay.textContent = `Room Code: ${roomCode}`;
    roomCodeDisplay.classList.remove('hidden');

    gameLobby.classList.add('hidden');
    gameBoard.classList.remove('hidden');

    updatePlayersArea();
    await drawOpeningHand();

    console.log('Game created with room code:', roomCode);
  });

  joinGameButton.addEventListener('click', async () => {
    const gameCodeInput = document.getElementById('game-code').value.trim();
    if (!gameCodeInput) {
      alert('Please enter a game code to join.');
      return;
    }

    roomCodeDisplay.textContent = `Room Code: ${gameCodeInput.toUpperCase()}`;
    roomCodeDisplay.classList.remove('hidden');

    gameLobby.classList.add('hidden');
    gameBoard.classList.remove('hidden');

    updatePlayersArea();
    await drawOpeningHand();

    console.log('Joining game with room code:', gameCodeInput);
  });

  drawCardButton.addEventListener('click', async () => {
    try {
      const res = await fetch('https://api.scryfall.com/cards/random?q=game:paper');
      const card = await res.json();
      const img = document.createElement('img');
      img.src = card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || '';
      img.alt = card.name;
      img.title = card.name;
      img.style.width = '80px';
      img.style.margin = '4px';
      handCardsContainer.appendChild(img);

      console.log(`Drew card: ${card.name}`);
    } catch (err) {
      console.error("Failed to draw card:", err);
    }
  });
});
