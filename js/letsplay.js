function dragStart(event) {
  event.dataTransfer.setData('text/plain', event.target.src);
}

document.querySelectorAll('.zone, .hand').forEach(zone => {
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
