/* ==========================================================================
   KRYPTOBIT — interactions
   Modules: preloader → hero entrance, header state, scroll reveals,
   parallax, custom cursor, ticker drift, mobile menu
   ========================================================================== */
(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const header = $("#header");
  const preloader = $("#preloader");
  const heroTitle = $(".hero__title");
  const heroVisual = $("#heroVisual");
  const heroDevices = $("#heroDevices");

  /* ---------------------------------------------------------------------
     1. Preloader → hero entrance
     --------------------------------------------------------------------- */
  if (preloader) document.body.classList.add("is-loading");

  // split titles into words (word-by-word reveal)
  const splitWords = (el) => {
    if (el.dataset.split) return;
    el.dataset.split = "1";
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement("span"); w.className = "w"; w.textContent = part; frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains("w")) walk(n);
      });
    };
    walk(el);
    $$(".w", el).forEach((w, i) => w.style.setProperty("--i", i));
  };
  $$(".split-words, .text-reveal").forEach(splitWords);

  const revealHero = () => {
    header.classList.add("is-ready");
    if (heroTitle) heroTitle.classList.add("is-in");
    if (heroVisual) heroVisual.classList.add("is-in");
    $$(".page-hero .reveal-up, .page-hero .line__inner, .page-hero .split-words").forEach((el) => el.classList.add("is-in"));
    if (heroVisual) setTimeout(() => heroVisual.classList.add("is-floating"), 2000);
    $$(".hero .reveal-up").forEach((el) => {
      const d = parseFloat(el.dataset.delay || 0) * 1000;
      setTimeout(() => el.classList.add("is-in"), d);
    });
  };

  const finishLoading = () => {
    preloader.classList.add("is-done");
    document.body.classList.remove("is-loading");
    // the curtain slides up; reveal just as it clears the hero
    setTimeout(revealHero, reduceMotion ? 0 : 350);
    setTimeout(() => preloader.remove(), 1400);
  };

  if (!preloader) {
    document.body.classList.add("is-entering");
    requestAnimationFrame(() => setTimeout(revealHero, 60));
  }
  const MIN_LOADER = reduceMotion ? 0 : (document.body.dataset.loader === "short" ? 900 : 1900);
  const start = performance.now();
  const heroImgReady = new Promise((res) => {
    if (!heroDevices || heroDevices.complete) return res();
    heroDevices.addEventListener("load", res, { once: true });
    heroDevices.addEventListener("error", res, { once: true });
    setTimeout(res, 3500); // never block forever
  });
  if (preloader) {
    Promise.all([heroImgReady, document.fonts ? document.fonts.ready : Promise.resolve()]).then(() => {
      const wait = Math.max(0, MIN_LOADER - (performance.now() - start));
      setTimeout(finishLoading, wait);
    });
  }

  /* ---------------------------------------------------------------------
     2. Header scroll state
     --------------------------------------------------------------------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      header.classList.toggle("is-scrolled", y > 12);
      updateParallax(y);
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------------------------------------------------------------------
     3. Scroll reveals (everything outside the hero)
     --------------------------------------------------------------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const d = parseFloat(el.dataset.delay || 0) * 1000;
      setTimeout(() => el.classList.add("is-in"), d);
      io.unobserve(el);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  $$(".reveal-up:not(.hero .reveal-up), .split-words:not(.page-hero .split-words), .text-reveal, .draw, .ob").forEach((el) => io.observe(el));
  $$(".ob div").forEach((d, i) => d.style.setProperty("--i", i));

  /* ---------------------------------------------------------------------
     3b. Count-up numbers (.stat strong)
     --------------------------------------------------------------------- */
  const counters = $$(".stat strong");
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target); countUp(e.target);
    });
  }, { threshold: 0.4 });
  counters.forEach((c) => cio.observe(c));
  function countUp(el) {
    const text = el.textContent.trim();
    const m = text.match(/^([^\d]*)([\d.]+)(?:,(\d+))?(.*)$/);
    if (!m || reduceMotion) return;
    const [, prefix, intPart, decPart, suffix] = m;
    const target = parseFloat(intPart.replace(/\./g, "") + (decPart ? "." + decPart : ""));
    const decimals = decPart ? decPart.length : 0;
    const useThousands = intPart.includes(".");
    const dur = 1400, t0 = performance.now();
    const fmt = (v) => {
      let str = v.toFixed(decimals);
      let [i, d] = str.split(".");
      if (useThousands) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return prefix + i + (d ? "," + d : "") + suffix;
    };
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = text;
    };
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------------
     4. Hero parallax (very subtle, desktop only)
     --------------------------------------------------------------------- */
  const parallaxEnabled = finePointer && !reduceMotion;
  let heroH = 0;
  const measure = () => { heroH = ($(".hero") && $(".hero").offsetHeight) || 1; };
  measure();
  window.addEventListener("resize", measure, { passive: true });

  function updateParallax(y) {
    if (!parallaxEnabled || !heroDevices) return;
    const p = Math.min(1, y / heroH);
    // devices drift upward by at most ~18px; the whole visual eases slightly
    heroDevices.style.transform = `translate3d(0, ${(-18 * p).toFixed(2)}px, 0)`;
    heroVisual.style.setProperty("--p", p.toFixed(3));
  }

  // tiny pointer-driven tilt on the hero visual (±4px), only once it's revealed
  if (parallaxEnabled && heroVisual && $(".hero")) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    const hero = $(".hero");
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 8;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 6;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    hero.addEventListener("pointerleave", () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tick); });
    function tick() {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      heroVisual.style.setProperty("--mx", cx.toFixed(2) + "px");
      heroVisual.style.setProperty("--my", cy.toFixed(2) + "px");
      if (heroVisual.classList.contains("is-in")) {
        heroVisual.style.translate = `${cx.toFixed(2)}px ${cy.toFixed(2)}px`;
      }
      raf = (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) ? requestAnimationFrame(tick) : null;
    }
  }

  /* ---------------------------------------------------------------------
     4b. Cursor-lit grid in hero backgrounds (desktop only)
     --------------------------------------------------------------------- */
  if (finePointer && !reduceMotion) {
    $$(".hero, .page-hero").forEach((sec) => {
      const grid = document.createElement("div");
      grid.className = "hero__grid"; grid.setAttribute("aria-hidden", "true");
      sec.insertBefore(grid, sec.firstChild);
      sec.addEventListener("pointermove", (e) => {
        const r = sec.getBoundingClientRect();
        grid.style.setProperty("--gx", (e.clientX - r.left) + "px");
        grid.style.setProperty("--gy", (e.clientY - r.top) + "px");
      }, { passive: true });
    });
  }

  /* ---------------------------------------------------------------------
     4c. Mouse glow + 3D tilt on cards (desktop only)
     --------------------------------------------------------------------- */
  const glowTargets = $$(".card, .stat, .ticker__strip, .step, .trade-mock > div, .visual-panel, .market");
  glowTargets.forEach((el) => el.classList.add("glow"));
  if (finePointer && !reduceMotion) {
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest(".glow");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left) + "px");
      el.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, { passive: true });

    $$(".card, .stat").forEach((el) => {
      el.classList.add("tilt");
      let raf = null, rx = 0, ry = 0;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        ry = ((e.clientX - r.left) / r.width - 0.5) * 8;
        rx = -((e.clientY - r.top) / r.height - 0.5) * 8;
        if (!raf) raf = requestAnimationFrame(() => {
          el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px)`;
          raf = null;
        });
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
    $$(".cta-band, .app__banner, .trade-mock").forEach((el) => el.classList.add("border-sweep"));
  }

  /* ---------------------------------------------------------------------
     4d. "Live" prices — subtle random ticks on the ticker & market tables
     --------------------------------------------------------------------- */
  const prices = $$(".coin__meta em, .market-row .num:not(.num--muted)").filter((el) => /R\$\s[\d.]+,\d{2}$/.test(el.textContent.trim()));
  if (prices.length && !reduceMotion) {
    const bump = () => {
      const el = prices[Math.floor(Math.random() * prices.length)];
      const m = el.textContent.trim().match(/^R\$\s([\d.]+),(\d{2})$/);
      if (!m) return;
      const cents = (parseInt(m[2], 10) + (Math.random() < 0.5 ? -1 : 1) * Math.ceil(Math.random() * 7) + 100) % 100;
      el.textContent = `R$ ${m[1]},${String(cents).padStart(2, "0")}`;
      el.classList.remove("flash-up"); void el.offsetWidth; el.classList.add("flash-up");
      setTimeout(bump, 1800 + Math.random() * 2600);
    };
    setTimeout(bump, 3500);
  }

  /* ---------------------------------------------------------------------
     5. Custom cursor (desktop only)
     --------------------------------------------------------------------- */
  const cursor = $("#cursor");
  if (cursor && finePointer && !reduceMotion) {
    let mx = -100, my = -100, x = -100, y = -100, raf = null;
    const loop = () => {
      x += (mx - x) * 0.32; y += (my - y) * 0.32;
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = (Math.abs(mx - x) > 0.1 || Math.abs(my - y) > 0.1) ? requestAnimationFrame(loop) : null;
    };
    window.addEventListener("pointermove", (e) => {
      mx = e.clientX; my = e.clientY;
      cursor.classList.add("is-visible");
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));
    document.addEventListener("pointerenter", () => cursor.classList.add("is-visible"));

    const hoverables = "a, button, .coin, .feature, .market-row, .card, .stat, .step";
    document.addEventListener("pointerover", (e) => {
      if (e.target.closest(hoverables)) cursor.classList.add("is-hover");
    });
    document.addEventListener("pointerout", (e) => {
      if (e.target.closest(hoverables) && !e.relatedTarget?.closest?.(hoverables)) cursor.classList.remove("is-hover");
    });

  }

  /* ---------------------------------------------------------------------
     6. Ticker — almost imperceptible drift on desktop (pauses on hover)
     --------------------------------------------------------------------- */
  const track = $("#tickerTrack");
  if (track && !reduceMotion) {
    let amp = 0, dir = 1, paused = false, last = performance.now();
    const strip = track.parentElement;
    strip.addEventListener("pointerenter", () => (paused = true));
    strip.addEventListener("pointerleave", () => (paused = false));
    const drift = (now) => {
      const dt = Math.min(48, now - last); last = now;
      if (!paused && window.innerWidth > 1100) {
        amp += dir * dt * 0.0009;              // ~6px over ~7s, back and forth
        if (amp > 6 || amp < -6) dir *= -1;
        track.style.transform = `translate3d(${amp.toFixed(2)}px,0,0)`;
      }
      requestAnimationFrame(drift);
    };
    requestAnimationFrame(drift);
  }

  /* ---------------------------------------------------------------------
     7. Mobile menu
     --------------------------------------------------------------------- */
  const burger = $("#burger");
  const menu = $("#mobileMenu");
  if (burger && menu) {
    const close = () => { burger.setAttribute("aria-expanded", "false"); menu.classList.remove("is-open"); };
    burger.addEventListener("click", () => {
      const open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open));
      menu.classList.toggle("is-open", !open);
    });
    $$("a", menu).forEach((a) => a.addEventListener("click", close));
    window.addEventListener("resize", () => { if (window.innerWidth > 1100) close(); }, { passive: true });
  }

  /* ---------------------------------------------------------------------
     8. Smooth anchor scrolling with header offset
     --------------------------------------------------------------------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    const target = id && document.getElementById(id);
    if (!target) { e.preventDefault(); return; }
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - (header.offsetHeight - 1);
    window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
  });
})();
