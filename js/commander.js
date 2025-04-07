function searchCard() {
  const name = document.getElementById('cardName').value;
  fetch(`https://api.scryfall.com/cards/named?fuzzy=${name}`)
    .then(res => res.json())
    .then(data => {
      const results = document.getElementById('search-results');
      results.innerHTML = '';

      const img = document.createElement('img');
      img.src = data.image_uris.normal;
      img.className = 'card';
      img.draggable = true;
      img.addEventListener('dragstart', dragStart);

      results.appendChild(img);
    })
    .catch(() => alert('Card not found!'));
}

function dragStart(event) {
  event.dataTransfer.setData('text/plain', event.target.src);
}

document.querySelectorAll('.zone').forEach(zone => {
  zone.addEventListener('dragover', e => e.preventDefault());
  zone.addEventListener('drop', e => {
    e.preventDefault();
    const url = e.dataTransfer.getData('text/plain');
    const img = document.createElement('img');
    img.src = url;
    img.className = 'card';
    img.draggable = true;
    img.addEventListener('dragstart', dragStart);
    zone.appendChild(img);
  });
});

