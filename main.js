document.addEventListener('DOMContentLoaded', () => {
  const createGameButton = document.getElementById('create-game');
  const joinGameButton = document.getElementById('join-game');
  const gameLobby = document.getElementById('game-lobby');
  const gameBoard = document.getElementById('game-board');
  const roomCodeDisplay = document.getElementById('room-code');
  const drawCardButton = document.getElementById('draw-card');

  // Sample players array
  let players = [
    { id: 1, name: "You", life: 40, commanderDamage: {} },
    { id: 2, name: "Player 2", life: 40, commanderDamage: {} },
    { id: 3, name: "Player 3", life: 40, commanderDamage: {} },
    { id: 4, name: "Player 4", life: 40, commanderDamage: {} },
  ];

  // Update the players area with dynamic player panels
  function updatePlayersArea() {
    const playersArea = document.getElementById('players-area');
    playersArea.innerHTML = ''; // Clear any previous content
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

  // Create Game functionality
  createGameButton.addEventListener('click', () => {
    // Generate a sample room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    roomCodeDisplay.textContent = `Room Code: ${roomCode}`;
    roomCodeDisplay.classList.remove('hidden');

    // Switch views from lobby to game board
    gameLobby.classList.add('hidden');
    gameBoard.classList.remove('hidden');

    // Update players area with our sample players
    updatePlayersArea();

    console.log('Game created with room code:', roomCode);
  });

  // Join Game functionality
  joinGameButton.addEventListener('click', () => {
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

    console.log('Joining game with room code:', gameCodeInput);
  });

  // Placeholder for Draw Card functionality
  drawCardButton.addEventListener('click', () => {
    console.log('Draw card clicked.');
    // Future: Add card drawing logic here
  });
});
