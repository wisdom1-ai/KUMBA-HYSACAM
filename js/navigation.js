(() => {
  "use strict";

  const init = () => {
    const toggle = document.getElementById("menu-toggle");
    const nav = document.getElementById("main-nav");
    const close = document.getElementById("menu-close");
    const backdrop = document.getElementById("nav-backdrop");
    if (!toggle || !nav) return;

    const mobile = () => window.matchMedia("(max-width: 680px)").matches;
    const setOpen = open => {
      const shouldOpen = Boolean(open && mobile());
      nav.classList.toggle("open", shouldOpen);
      backdrop?.classList.toggle("open", shouldOpen);
      document.body.classList.toggle("nav-open", shouldOpen);
      toggle.setAttribute("aria-expanded", String(shouldOpen));
      toggle.setAttribute("aria-label", shouldOpen ? "Close navigation" : "Open navigation");
      if (backdrop) backdrop.tabIndex = shouldOpen ? 0 : -1;
    };

    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
    close?.addEventListener("click", () => setOpen(false));
    backdrop?.addEventListener("click", () => setOpen(false));

    nav.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && nav.classList.contains("open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    window.addEventListener("resize", () => {
      if (!mobile()) setOpen(false);
    }, { passive: true });

    // Avoid leaving the page locked if the browser restores a prior page state.
    window.addEventListener("pageshow", () => setOpen(false));
    setOpen(false);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
