function countUp(el, target) {
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 40));

  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current;
  }, 30);
}
const statNumbers = document.querySelectorAll("#hmc-stats .hmc-stat b");

statNumbers.forEach((el) => {
  let busy = false;

  const watcher = new MutationObserver(() => {
    if (busy) return;

    const target = parseInt(el.textContent, 10);
    if (isNaN(target)) return;

    busy = true;
    el.textContent = "0";
    countUp(el, target);
  });

  watcher.observe(el, { childList: true, characterData: true, subtree: true });
});