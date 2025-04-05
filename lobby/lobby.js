const { ref, set, onValue } = window.firebaseRefs;
const db = window.db;

let currentRoom = null;
let playerName = "Player" + Math.floor(Math.random() * 1000);

window.createRoom = function () {
  const room = document.getElementById('roomName').value || "room-" + Date.now();
  currentRoom = room;
  set(ref(db, "rooms/" + room + "/players/" + playerName), true);
  listenForPlayers();
};

window.joinRoom = function () {
  const room = document.getElementById('roomName').value;
  if (!room) return alert("Enter room name");
  currentRoom = room;
  set(ref(db, "rooms/" + room + "/players/" + playerName), true);
  listenForPlayers();
};

function listenForPlayers() {
  const playersRef = ref(db, "rooms/" + currentRoom + "/players");
  onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};
    const list = Object.keys(players).join(", ");
    document.getElementById("playersList").innerText = "Players: " + list;

    if (Object.keys(players).length >= 2) {
      document.getElementById("startBtn").style.display = "inline-block";
    }
  });
}

window.startGame = function () {
  set(ref(db, "rooms/" + currentRoom + "/gameStarted"), true);
  alert("Game starting!");
  // Redirect to game board later
};
