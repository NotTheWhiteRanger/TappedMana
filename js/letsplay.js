document.querySelectorAll('.life').forEach(el => {
  el.addEventListener('click', () => {
    const current = parseInt(el.textContent, 10);
    const newLife = prompt("Set new life total:", current);
    if (!isNaN(newLife)) {
      el.textContent = parseInt(newLife);
    }
  });
});
