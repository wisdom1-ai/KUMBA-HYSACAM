(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const form = $("resident-report-form");
  const H = window.Hys || {};

  const toast = (msg, type) => { try { if (H.toast) H.toast(msg, type); } catch (e) { /* ignore */ } };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* =========================================================
     1. Scroll reveal
     ========================================================= */
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

  /* =========================================================
     2. Report cards: timeline + copy-code button
     ========================================================= */
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
      let cls = "tl-step";
      if (i <= cur) cls += " done";
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
      let extra = timelineHTML(pill.textContent);
      const code = card.dataset.code;
      if (code) {
        const safe = code.replace(/[&<>"']/g, "");
        extra += '<button type="button" class="copy-code" data-code="' + safe + '">Copy code</button>';
      }
      body.insertAdjacentHTML("afterbegin", extra);
    });
    revealCards(host);
    if (host.id === "my-reports-list") applyFilter();
  }

  function watchCards() {
    ["my-reports-list", "home-recent"].forEach((id) => {
      const host = $(id);
      if (!host) return;
      decorateCards(host);
      new MutationObserver(() => decorateCards(host)).observe(host, { childList: true });
    });
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".copy-code");
    if (!btn) return;
    copyText(btn.dataset.code || "").then((ok) => {
      btn.textContent = ok ? "Copied \u2713" : "Could not copy";
      setTimeout(() => { btn.textContent = "Copy code"; }, 1600);
    });
  });

  /* =========================================================
     3. Your Reports: filter tabs + search (shows from 3 reports up)
     ========================================================= */
  const filterState = { status: "all", q: "" };
  let filterUI = null;

  function cardKey(card) {
    const p = card.querySelector(".pill");
    if (!p) return "pending";
    if (p.classList.contains("st-resolved")) return "resolved";
    if (p.classList.contains("st-closed")) return "closed";
    return "pending";
  }

  function initFilter() {
    const host = $("my-reports-list");
    if (!host) return;

    const root = document.createElement("div");
    root.className = "rfilter";
    root.hidden = true;
    root.innerHTML =
      '<input type="search" class="rf-search" placeholder="Search by code or area" aria-label="Search your reports" autocomplete="off">' +
      '<div class="rf-tabs" role="group" aria-label="Filter reports by status">' +
      '<button type="button" class="rf-tab is-on" data-f="all" aria-pressed="true">All <b>0</b></button>' +
      '<button type="button" class="rf-tab" data-f="pending" aria-pressed="false">Pending <b>0</b></button>' +
      '<button type="button" class="rf-tab" data-f="resolved" aria-pressed="false">Resolved <b>0</b></button>' +
      '<button type="button" class="rf-tab" data-f="closed" aria-pressed="false">Closed <b>0</b></button>' +
      "</div>" +
      '<p class="rf-empty" hidden>No reports match your search</p>';
    host.insertAdjacentElement("beforebegin", root);

    filterUI = {
      root,
      tabs: [...root.querySelectorAll(".rf-tab")],
      empty: root.querySelector(".rf-empty"),
      search: root.querySelector(".rf-search")
    };

    filterUI.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        filterState.status = tab.dataset.f;
        applyFilter();
      });
    });
    filterUI.search.addEventListener("input", () => {
      filterState.q = filterUI.search.value;
      applyFilter();
    });
  }

  function applyFilter() {
    const host = $("my-reports-list");
    if (!filterUI || !host) return;
    const cards = [...host.querySelectorAll("details.rcard")];
    const useFilter = cards.length >= 3;
    const q = filterState.q.trim().toLowerCase();
    const counts = { all: cards.length, pending: 0, resolved: 0, closed: 0 };
    let shown = 0;

    cards.forEach((card) => {
      const key = cardKey(card);
      counts[key]++;
      let show = true;
      if (useFilter) {
        const okStatus = filterState.status === "all" || filterState.status === key;
        const okText = !q || card.textContent.toLowerCase().includes(q);
        show = okStatus && okText;
      }
      card.classList.toggle("rf-hide", !show);
      if (show) shown++;
    });

    filterUI.root.hidden = !useFilter;
    filterUI.tabs.forEach((tab) => {
      const on = tab.dataset.f === filterState.status;
      tab.classList.toggle("is-on", on);
      tab.setAttribute("aria-pressed", on ? "true" : "false");
      tab.querySelector("b").textContent = counts[tab.dataset.f];
    });
    filterUI.empty.hidden = !(useFilter && shown === 0);
  }

  /* =========================================================
     4. Report Statistics count-up
     ========================================================= */
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

  /* =========================================================
     5. The report form
     ========================================================= */
  const REQUIRED = ["issue_type", "area", "location_description", "description"];
  const DRAFT_KEY = "hysacam-report-draft-v1";   // phone number is never saved in the draft
  const QUICK_DETAILS = [
    "Strong smell",
    "Blocking the road",
    "Near a market",
    "There for several days",
    "Spreading onto the street"
  ];

  function initForm() {
    if (!form) return;

    const opener = $("open-report-form");
    const sel = form.elements["issue_type"];
    const textarea = form.elements["description"];

    /* --- progress bar + draft status --- */
    const progress = document.createElement("div");
    progress.className = "form-progress";
    progress.innerHTML =
      '<div class="fp-track"><div class="fp-bar"></div></div>' +
      '<div class="fp-row"><span class="fp-text"></span><span class="draft-status"></span></div>';
    const hint = form.querySelector(".hint");
    if (hint) hint.insertAdjacentElement("afterend", progress);
    else form.insertAdjacentElement("afterbegin", progress);
    const bar = progress.querySelector(".fp-bar");
    const barText = progress.querySelector(".fp-text");
    const draftStatus = progress.querySelector(".draft-status");

    /* --- restored-draft banner --- */
    const banner = document.createElement("div");
    banner.className = "draft-banner";
    banner.hidden = true;
    banner.innerHTML = '<span>Draft restored. You can carry on where you stopped</span><button type="button">Discard</button>';
    progress.insertAdjacentElement("afterend", banner);

    /* --- character counter + short-description hint --- */
    let counter = null;
    let counterHint = null;
    let counterNum = null;
    if (textarea) {
      counter = document.createElement("small");
      counter.className = "char-count";
      counter.innerHTML = '<span class="cc-hint"></span><span class="cc-num"></span>';
      textarea.insertAdjacentElement("afterend", counter);
      counterHint = counter.querySelector(".cc-hint");
      counterNum = counter.querySelector(".cc-num");

      /* quick-detail chips that add a ready sentence */
      const qd = document.createElement("div");
      qd.className = "qd";
      qd.innerHTML = '<span class="qd-label">Tap to add a detail</span>';
      QUICK_DETAILS.forEach((text) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "qd-chip";
        b.textContent = "+ " + text;
        b.addEventListener("click", () => {
          const current = textarea.value.trim();
          if (current.toLowerCase().includes(text.toLowerCase())) return;
          const joined = current
            ? current + (/[.!?]$/.test(current) ? " " : ". ") + text + "."
            : text + ".";
          if (textarea.maxLength > 0 && joined.length > textarea.maxLength) return;
          textarea.value = joined;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        });
        qd.appendChild(b);
      });
      counter.insertAdjacentElement("afterend", qd);
    }

    /* --- issue-type chips --- */
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

    /* --- offline notice above the submit button --- */
    const net = document.createElement("div");
    net.className = "net-banner";
    net.setAttribute("role", "status");
    net.textContent = "You are offline. Your draft is saved on this phone, so you can send it when you are back online";
    net.hidden = navigator.onLine !== false;
    const submitBtn = $("submit-resident-report");
    if (submitBtn) submitBtn.insertAdjacentElement("beforebegin", net);
    window.addEventListener("offline", () => { net.hidden = false; });
    window.addEventListener("online", () => { net.hidden = true; toast("Back online", "ok"); });

    /* --- suggestions from the resident's own earlier reports --- */
    initSuggest();

    /* --- refresh the progress bar, counter and chips --- */
    function refresh() {
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

      if (counter && textarea) {
        const len = textarea.value.length;
        const max = textarea.maxLength > 0 ? textarea.maxLength : 800;
        counterNum.textContent = len + " / " + max;
        counterNum.classList.toggle("warn", len > max * 0.9);
        counterHint.textContent = len > 0 && len < 20 ? "Add a little more detail so the team can find the problem" : "";
      }

      if (sel) {
        chips.forEach(([btn, val]) => {
          const on = sel.value === val;
          btn.classList.toggle("is-on", on);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
    }

    /* --- draft: save while typing, restore on return --- */
    let saveTimer;
    function setDraftPill(on) {
      if (!opener) return;
      const old = opener.querySelector(".draft-pill");
      if (on && !old) {
        const s = document.createElement("span");
        s.className = "draft-pill";
        s.textContent = "Draft saved";
        opener.appendChild(s);
      } else if (!on && old) old.remove();
    }

    function saveDraft() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const d = {};
        let any = false;
        REQUIRED.forEach((name) => {
          const f = form.elements[name];
          const v = f ? String(f.value) : "";
          if (v.trim()) any = true;
          d[name] = v;
        });
        if (any) {
          store.set(DRAFT_KEY, JSON.stringify({ t: Date.now(), d }));
          draftStatus.textContent = "Draft saved on this phone";
          setDraftPill(true);
        } else {
          store.del(DRAFT_KEY);
          draftStatus.textContent = "";
          setDraftPill(false);
        }
      }, 500);
    }

    function restoreDraft() {
      const raw = store.get(DRAFT_KEY);
      if (!raw) return;
      let obj;
      try { obj = JSON.parse(raw); } catch (e) { store.del(DRAFT_KEY); return; }
      if (!obj || !obj.d) return;
      let restored = false;
      REQUIRED.forEach((name) => {
        const f = form.elements[name];
        const v = obj.d[name];
        if (!f || typeof v !== "string" || !v.trim()) return;
        if (String(f.value).trim() !== "") return;
        f.value = v;
        if (f.value) restored = true;
      });
      if (restored) {
        banner.hidden = false;
        draftStatus.textContent = "Draft saved on this phone";
        setDraftPill(true);
      }
    }

    banner.querySelector("button").addEventListener("click", () => form.reset());

    form.addEventListener("input", () => { refresh(); saveDraft(); });
    form.addEventListener("change", () => { refresh(); saveDraft(); });
    form.addEventListener("reset", () => {
      clearTimeout(saveTimer);
      store.del(DRAFT_KEY);
      banner.hidden = true;
      draftStatus.textContent = "";
      setDraftPill(false);
      setTimeout(refresh, 0);
    });

    restoreDraft();
    refresh();

    /* --- photo preview (preview only: the photo is not sent to the server) --- */
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

    /* --- success celebration --- */
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

  /* Suggest areas and places the resident used before */
  function initSuggest() {
    const area = form.elements["area"];
    const loc = form.elements["location_description"];
    if (!area || !loc) return;

    const dlArea = document.createElement("datalist");
    dlArea.id = "past-areas";
    const dlLoc = document.createElement("datalist");
    dlLoc.id = "past-locations";
    form.appendChild(dlArea);
    form.appendChild(dlLoc);
    area.setAttribute("list", "past-areas");
    loc.setAttribute("list", "past-locations");

    const fill = (dl, values) => {
      dl.innerHTML = "";
      values.forEach((v) => {
        const o = document.createElement("option");
        o.value = v;
        dl.appendChild(o);
      });
    };

    const