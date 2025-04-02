document.addEventListener('DOMContentLoaded', () => {
  const createGameButton = document.getElementById('create-game');
  const joinGameButton = document.getElementById('join-game');
  const gameLobby = document.getElementById('game-lobby');
  const gameBoard = document.getElementById('game-board');
  const roomCodeDisplay = document.getElementById('room-code');
  const drawCardButton = document.getElementById('draw-card');

  // Create Game button functionality
  createGameButton.addEventListener('click', () => {
    // Generate a simple room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    roomCodeDisplay.textContent = `Room Code: ${roomCode}`;
    roomCodeDisplay.classList.remove('hidden');

    // Switch from lobby to game board
    gameLobby.classList.add('hidden');
    gameBoard.classList.remove('hidden');

    console.log('Game created with room code:', roomCode);
  });

  // Join Game button functionality
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

    console.log('Joining game with room code:', gameCodeInput);
  });

  // Draw Card button functionality (placeholder)
  drawCardButton.addEventListener('click', () => {
    console.log('Draw card clicked.');
    // Future: Add card drawing logic here
  });
});

