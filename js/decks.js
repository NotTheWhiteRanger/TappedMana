const sampleDecks = [
  {
    title: "Atraxa Superfriends",
    description: "Control, proliferate, and dominate the board with Planeswalkers.",
    commander: "Atraxa, Praetors' Voice"
  },
  {
    title: "Vampire Aggro",
    description: "Fast-paced tribal strategy using Edgar's vampire swarm.",
    commander: "Edgar Markov"
  },
  {
    title: "Lands Matter",
    description: "Ramp hard, draw cards, and take over with value engines.",
    commander: "Tatyova, Benthic Druid"
  }
];

function createDeckCard(deck) {
  const card = document.createElement("div");
  card.className = "bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition";

  card.innerHTML = `
    <h2 class="text-xl font-semibold mb-1">${deck.title}</h2>
    <p class="text-sm text-gray-600 mb-2">Commander: ${deck.commander}</p>
    <p class="text-gray-700 text-sm">${deck.description}</p>
    <button class="mt-4 bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700">Open</button>
  `;

  return card;
}

function loadDecks() {
  const container = document.getElementById("deckList");
  sampleDecks.forEach(deck => container.appendChild(createDeckCard(deck)));
}

document.getElementById("createDeck").onclick = () => {
  window.location.href = "/deck-editor.html"; // Placeholder for now
};

window.onload = loadDecks;
