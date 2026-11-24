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