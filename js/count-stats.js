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
const revealTargets = document.querySelectorAll(
  ".tile, .hmc-head, .hmc-stat, .sec-head, .home-recent, .site-footer"
);

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("show");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

revealTargets.forEach((el, i) => {
  el.classList.add("reveal");
  el.style.transitionDelay = (i % 4) * 0.1 + "s";
  revealObserver.observe(el);
});