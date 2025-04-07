// LIFE COUNTER
document.querySelectorAll('.life').forEach(el => {
  const update = (delta) => {
    let current = parseInt(el.textContent, 10);
    el.textContent = current + delta;
  };

  el.addEventListener('click', (e) => {
    if (e.shiftKey) update(-1);
    else update(1);
  });

  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    const newTotal = prompt("Set life total:", el.textContent);
    if (!isNaN(newTotal)) el.textContent = parseInt(newTotal);
  });
});

// PHASE TRACKER
const phases = ["Untap", "Upkeep", "Draw", "Main 1", "Combat", "Main 2", "End"];
const players = [1, 2, 3, 4];
let currentPlayerIndex = 0;
let currentPhase = 0;

function buildPhaseBars() {
  players.forEach(num => {
    const bar = document.getElementById(`phaseBar${num}`);
    bar.innerHTML = '';
    phases.forEach(phase => {
      const span = document.createElement('span');
      span.textContent = phase;
      bar.appendChild(span);
    });
  });
}

function highlightPhase() {
  players.forEach(num => {
    const bar = document.getElementById(`phaseBar${num}`);
    const spans = bar.querySelectorAll('span');
    spans.forEach((span, i) => {
      span.classList.toggle('active', i === currentPhase);
    });
  });
}

function highlightActivePlayer() {
  players.forEach(num => {
    const container = document.getElementById(`player${num}`);
    container.classList.toggle('active', num === players[currentPlayerIndex]);
  });
}

function nextTurn() {
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  currentPhase = 0;
  highlightPhase();
  highlightActivePlayer();
}

function nextPhase() {
  currentPhase = (currentPhase + 1) % phases.length;
  highlightPhase();
}

// INIT
buildPhaseBars();
highlightActivePlayer();
highlightPhase();

// DEMO PHASE CYCLE (every 4s)
setInterval(nextPhase, 4000);

// END TURN BUTTON
document.querySelectorAll('.end-turn').forEach(button => {
  button.addEventListener('click', () => {
    nextTurn();
  });
});
