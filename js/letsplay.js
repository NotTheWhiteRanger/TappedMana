// Life Counter: Click to add/subtract, right-click to set
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

// Phase Tracker: highlight current phase
const phases = ["Untap", "Upkeep", "Draw", "Main 1", "Combat", "Main 2", "End"];
const phaseTrackers = document.querySelectorAll('.phase-bar');

phaseTrackers.forEach(bar => {
  phases.forEach(phase => {
    const span = document.createElement('span');
    span.textContent = phase;
    bar.appendChild(span);
  });
});

let currentPhase = 0;
function updatePhaseHighlight() {
  document.querySelectorAll('.phase-bar span').forEach(span => span.classList.remove('active'));
  document.querySelectorAll(`.phase-bar span:nth-child(${currentPhase + 1})`)
    .forEach(span => span.classList.add('active'));
}

setInterval(() => {
  currentPhase = (currentPhase + 1) % phases.length;
  updatePhaseHighlight();
}, 4000);
