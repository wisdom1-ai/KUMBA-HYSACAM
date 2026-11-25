(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const form = $("resident-report-form");

  /* ---------- Scroll reveal for report cards (they are drawn later by reports.js) ---------- */
  const revealIO = "IntersectionObserver" in window && !reduce
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add("show");
          revealIO.unobserve(el);
          setTimeout(() => { el.style.transitionDelay = "0s"; }, 900);
        });
      }, { threshold: 0.1 })
    : null;

  function revealCards(host) {
    if (!revealIO) return;
    host.querySelectorAll(".rcard:not(.skeleton):not(.reveal)").forEach((el, i) => {
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min(i, 4) * 0.08 + "s";
      revealIO.observe(el);
    });
  }

  /* ---------- Status timeline inside each report card ---------- */
  const STEP_NAMES = ["Submitted", "In Review", "Resolved"];

  function timelineHTML(label) {
    const l = String(label || "").trim().toLowerCase();
    let cur = 0;
    let closed = false;
    if (l === "resolved") cur = 2;
    else if (l === "closed") { cur = 2; closed = true; }
    else if (l === "submitted") cur = 0;
    else cur = 1;

    let html = '<div class="r-timeline" aria-label="Report progress">';
    STEP_NAMES.forEach((name, i) => {
      const isDone = i <= cur;
      let cls = "tl-step";
      if (isDone) cls += " done";
      if (i === cur && cur < 2) cls += " current";
      let text = name;
      if (i === 2 && closed) { cls = "tl-step closed"; text = "Closed"; }
      if (i > 0) html += '<span class="tl-line' + (i <= cur ? " done" : "") + '"></span>';
      html += '<span class="' + cls + '"><i class="tl-dot"></i>' + text + "</span>";
    });
    return html + "</div>";
  }

  function decorateCards(host) {
    host.querySelectorAll("details.rcard").forEach((card) => {
      const body = card.querySelector(".r-body");
      const pill = card.querySelector(".pill");
      if (!body || !pill || body.querySelector(".r-timeline")) return;
      body.insertAdjacentHTML("afterbegin", timelineHTML(pill.textContent));
    });
    revealCards(host);
  }

  function watchCards() {
    ["my-reports-list", "home-recent"].forEach((id) => {
      const host = $(id);
      if (!host) return;
      decorateCards(host);
      new MutationObserver(() => decorateCards(host)).observe(host, { childList: true });
    });
  }

  /* ---------- Count-up for Report Statistics ---------- */
  function tick(el, target) {
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(timer); }
      el.textContent = current;
    }, 35);
  }

  function countEl(el) {
    const go = () => {
      const t = parseInt(el.textContent, 10);
      if (isNaN(t)) return false;
      if (t > 0) tick(el, t);
      return true;
    };
    if (go()) return;
    const mo = new MutationObserver(() => { if (go()) mo.disconnect(); });
    mo.observe(el, { childList: true, characterData: true, subtree: true });
  }

  function initStats() {
    const card = document.querySelector(".stats-card");
    if (!card || reduce || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        obs.unobserve(card);
        ["stat-total", "stat-pending", "stat-resolved", "stat-closed"].forEach((id) => {
          const el = $(id);
          if (el) countEl(el);
        });
      });
    }, { threshold: 0.3 });
    obs.observe(card);
  }

  /* ---------- Everything below needs the form ---------- */
  function initForm() {
    if (!form) return;

    const REQUIRED = ["issue_type", "area", "location_description", "description"];
    const sel = form.querySelector('select[name="issue_type"]');
    const textarea = form.querySelector('textarea[name="description"]');

    /* Progress bar */
    const progress = document.createElement("div");
    progress.className = "form-progress";
    progress.innerHTML = '<div class="fp-track"><div class="fp-bar"></div></div><div class="fp-text"></div>';
    const hint = form.querySelector(".hint");
    if (hint) hint.insertAdjacentElement("afterend", progress);
    else form.insertAdjacentElement("afterbegin", progress);
    const bar = progress.querySelector(".fp-bar");
    const barText = progress.querySelector(".fp-text");

    /* Character counter */
    let counter = null;
    if (textarea) {
      counter = document.createElement("small");
      counter.className = "char-count";
      textarea.insertAdjacentElement("afterend", counter);
    }

    /* Issue-type chips */
    const chips = [];
    if (sel) {
      const icons = {
        "Overflowing dustbin": "\uD83D\uDDD1\uFE0F",
        "Missed waste collection": "\uD83D\uDE9B",
        "Illegal dumping": "\u26A0\uFE0F",
        "Damaged dustbin": "\uD83D\uDD27",
        "Other": "\uD83D\uDCAC"
      };
      const wrap = document.createElement("div");
      wrap.className = "chips";
      wrap.setAttribute("role", "group");
      wrap.setAttribute("aria-label", "Issue type");
      [...sel.options].forEach((opt) => {
        if (!opt.value) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = (icons[opt.value] ? icons[opt.value] + " " : "") + opt.value;
        b.addEventListener("click", () => {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        });
        chips.push([b, opt.value]);
        wrap.appendChild(b);
      });
      sel.classList.add("chip-select-hidden");
      sel.tabIndex = -1;
      sel.insertAdjacentElement("afterend", wrap);
    }

    function refresh() {
      /* progress */
      let done = 0;
      REQUIRED.forEach((name) => {
        const f = form.elements[name];
        if (f && String(f.value).trim() !== "") done++;
      });
      bar.style.width = (done / REQUIRED.length) * 100 + "%";
      if (done === REQUIRED.length) {
        barText.textContent = "All set \u2014 ready to send \u2713";
        barText.classList.add("ready");
      } else {
        barText.textContent = done + " of " + REQUIRED.length + " required fields complete";
        barText.classList.remove("ready");
      }
      /* counter */
      if (counter && textarea) {
        const max = textarea.maxLength > 0 ? textarea.maxLength : 800;
        counter.textContent = textarea.value.length + " / " + max;
        counter.classList.toggle("warn", textarea.value.length > max * 0.9);
      }
      /* chips */
      if (sel) {
        chips.forEach(([btn, val]) => {
          const on = sel.value === val;
          btn.classList.toggle("is-on", on);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
    }

    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    form.addEventListener("reset", () => setTimeout(refresh, 0));
    refresh();

    /* Photo preview (preview only: the photo is not sent to the server) */
    const input = $("report-photo");
    const img = $("report-photo-preview");
    if (input && img) {
      let url = null;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "photo-remove";
      remove.textContent = "Remove photo";
      remove.hidden = true;
      img.insertAdjacentElement("afterend", remove);

      const clear = () => {
        if (url) { URL.revokeObjectURL(url); url = null; }
        img.removeAttribute("src");
        img.hidden = true;
        remove.hidden = true;
        input.value = "";
      };

      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file || !file.type.startsWith("image/")) { clear(); return; }
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(file);
        img.src = url;
        img.hidden = false;
        remove.hidden = false;
      });
      remove.addEventListener("click", clear);
      form.addEventListener("reset", () => setTimeout(clear, 0));
    }

    /* Success celebration */
    let justSubmitted = false;
    let resetTimer;
    form.addEventListener("submit", () => {
      justSubmitted = true;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { justSubmitted = false; }, 10000);
    });

    new MutationObserver(() => {
      const msg = $("resident-report-message");
      const failed = msg && msg.textContent.trim() !== "";
      if (form.hidden && justSubmitted && !failed) {
        justSubmitted = false;
        setTimeout(celebrate, 250);
      }
    }).observe(form, { attributes: true, attributeFilter: ["hidden"] });
  }

  function celebrate() {
    const old = document.querySelector(".celebrate");
    if (old) old.remove();

    const codeEl = document.querySelector("#my-reports-list .r-code");
    const code = codeEl ? codeEl.textContent : "";

    const overlay = document.createElement("div");
    overlay.className = "celebrate";
    overlay.setAttribute("role", "status");
    overlay.innerHTML =
      '<div class="celebrate-box">' +
      '<div class="celebrate-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>' +
      "<h4>Report sent!</h4>" +
      "<p>Thank you for helping keep Kumba clean." + (code ? "<br>Your code: <b>" + code + "</b>" : "") + "</p>" +
      "</div>";

    const close = () => {
      overlay.classList.add("out");
      setTimeout(() => overlay.remove(), 300);
    };
    overlay.addEventListener("click", close);
    document.body.appendChild(overlay);
    setTimeout(close, 2600);
  }

  function start() {
    watchCards();
    initStats();
    initForm();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
