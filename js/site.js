/* ============================================================
   Sonne Systems - shared site chrome for every page.
   Injects the header + footer, wires nav, scroll-reveal
   animations, the mobile menu, and satisfying click sounds.
   Plain JS, no dependencies.
   ============================================================ */
(function () {
  "use strict";

  var PAGE = document.body.getAttribute("data-page") || "home";
  var MAIL = "mailto:9aman.aa@gmail.com";
  var LINKEDIN = "https://www.linkedin.com/in/aman-agarwal-628880317/";
  var GITHUB = "https://github.com/9aman-og";
  var SCRIPT_SRC = document.currentScript && document.currentScript.src;
  var ASSET_ROOT = new URL("../assets/", SCRIPT_SRC || location.href).href;

  /* ---- reusable Sonne mark ---- */
  function sunMark(cls) {
    return '<span class="' + cls + '" aria-hidden="true">' +
      '<img src="' + ASSET_ROOT + 'sonnesystems_logo.png" alt="" width="48" height="48">' +
      '</span>';
  }

  var NAV = [
    { id: "home", label: "Home", href: "/" },
    { id: "demo", label: "Demo", href: "/demo.html" },
    { id: "research", label: "Research", href: "/research.html" },
    { id: "tools", label: "Tools", href: "/tools.html" },
    { id: "about", label: "About", href: "/about.html" }
  ];

  /* ---- header ---- */
  function buildHeader() {
    var links = NAV.map(function (n) {
      return '<a href="' + n.href + '"' + (n.id === PAGE ? ' class="active" aria-current="page"' : "") + '>' + n.label + "</a>";
    }).join("");

    var el = document.getElementById("site-header");
    if (!el) return;
    el.className = "topbar";
    el.innerHTML =
      '<a class="skip-link" href="#main-content">Skip to content</a>' +
      '<a class="brand" href="/" aria-label="Sonne Systems home">' +
        sunMark("brand-mark") +
        '<span class="brand-word"><b>Sonne</b><span>Systems</span></span>' +
      "</a>" +
      '<button class="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="primary-nav"><span></span><span></span><span></span></button>' +
      '<nav class="topnav" id="primary-nav" aria-label="Primary">' + links +
        '<a class="btn btn-ghost topcta" href="' + MAIL + '">Get in touch</a>' +
      "</nav>" +
      '<button class="sound-toggle" aria-label="Toggle sound" title="Sound"></button>';
  }

  /* ---- footer ---- */
  function buildFooter() {
    var el = document.getElementById("site-footer");
    if (!el) return;
    el.className = "footer";
    el.innerHTML =
      '<div class="footer-inner">' +
        '<a class="brand" href="/" aria-label="Sonne Systems home">' +
          sunMark("brand-mark") +
          '<span class="brand-word"><b>Sonne</b><span>Systems</span></span>' +
        "</a>" +
        '<p class="footer-line">Sparse intelligence. Built with evidence.</p>' +
        '<nav class="footer-nav" aria-label="Footer">' +
          '<a href="/demo.html">Demo</a><a href="/research.html">Research</a>' +
          '<a href="/tools.html">Tools</a><a href="/about.html">About</a>' +
          '<a href="' + LINKEDIN + '" target="_blank" rel="noopener">LinkedIn</a>' +
          '<a href="' + GITHUB + '" target="_blank" rel="noopener">GitHub</a>' +
          '<a href="' + MAIL + '">Contact</a>' +
        "</nav>" +
      "</div>" +
      '<p class="footer-fine">© <span class="year"></span> Sonne Systems · sonnesystems.com</p>';
  }

  /* ---- fill every sun mark with evenly spaced spokes ---- */
  function spokes(group, cx, cy, r0, r1, count) {
    var ns = "http://www.w3.org/2000/svg";
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2 - Math.PI / 2;
      var ln = document.createElementNS(ns, "line");
      ln.setAttribute("x1", (cx + Math.cos(a) * r0).toFixed(1));
      ln.setAttribute("y1", (cy + Math.sin(a) * r0).toFixed(1));
      ln.setAttribute("x2", (cx + Math.cos(a) * r1).toFixed(1));
      ln.setAttribute("y2", (cy + Math.sin(a) * r1).toFixed(1));
      group.appendChild(ln);
    }
  }

  /* ============================================================
     Satisfying click sounds (Web Audio, generated - no files)
     ============================================================ */
  var actx = null, soundOn = true;
  try { soundOn = localStorage.getItem("sonne.sound") !== "off"; } catch (e) {}

  function ping(freq, dur, vol, type, when) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      var t = actx.currentTime + (when || 0);
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  /* A quiet, warm interface signature tuned to the site palette. */
  function clickSound() {
    ping(146.83, 0.12, 0.022, "sine");
    ping(220, 0.09, 0.035, "triangle", .008);
    ping(440, 0.06, 0.012, "sine", .018);
  }
  function softTick() { ping(293.66, 0.055, 0.014, "sine"); ping(440, 0.035, 0.006, "triangle", .008); }

  function updateSoundBtn() {
    var b = document.querySelector(".sound-toggle");
    if (!b) return;
    b.classList.toggle("muted", !soundOn);
    b.setAttribute("aria-label", soundOn ? "Turn sound off" : "Turn sound on");
    b.setAttribute("title", soundOn ? "Turn sound off" : "Turn sound on");
    b.innerHTML = soundOn
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>';
  }

  /* ============================================================
     Boot - every step is isolated so one failing piece (a bad push,
     a missing element, an unsupported API) can never blank the page.
     The reveal content is force-shown no matter what.
     ============================================================ */
  function revealAll() {
    try {
      document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("revealed"); });
    } catch (e) { /* nothing more we can do */ }
  }

  try { buildHeader(); } catch (e) { /* header optional; page still reads */ }
  try { buildFooter(); } catch (e) { /* footer optional */ }

  try {
    document.querySelectorAll(".m-rays").forEach(function (g) { spokes(g, 24, 24, 11.5, 17.5, 12); });
    document.querySelectorAll(".sun-rays").forEach(function (g) { spokes(g, 70, 70, 52, 108, 20); });
    document.querySelectorAll(".year").forEach(function (y) { y.textContent = new Date().getFullYear(); });
  } catch (e) { /* decorative */ }

  try {
    /* mobile menu */
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".topnav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = document.body.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "Close menu" : "Menu");
      });
      nav.addEventListener("click", function (e) {
        if (e.target.tagName === "A") {
          document.body.classList.remove("nav-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.setAttribute("aria-label", "Menu");
        }
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
          document.body.classList.remove("nav-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.setAttribute("aria-label", "Menu");
          toggle.focus();
        }
      });
    }
  } catch (e) { /* menu optional */ }

  try {
    /* sound toggle */
    updateSoundBtn();
    var sbtn = document.querySelector(".sound-toggle");
    if (sbtn) sbtn.addEventListener("click", function () {
      soundOn = !soundOn;
      try { localStorage.setItem("sonne.sound", soundOn ? "on" : "off"); } catch (e) {}
      updateSoundBtn();
      if (soundOn) clickSound();
    });

    /* click sounds, delegated */
    document.addEventListener("pointerdown", function (e) {
      var t = e.target.closest("a, button, .sounds");
      if (!t || t.classList.contains("sound-toggle")) return;
      if (t.classList.contains("btn") || t.tagName === "BUTTON") clickSound();
      else softTick();
    }, true);
  } catch (e) { /* sound is a bonus */ }

  /* scroll-reveal (respects reduced motion).
     Above-fold content must NEVER depend on an observer firing, so anything
     already in the first viewport is revealed immediately; the observer only
     handles elements the visitor scrolls to later. */
  try {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

    var show = function (el) {
      var d = el.getAttribute("data-delay");
      if (d) el.style.transitionDelay = d + "ms";
      el.classList.add("revealed");
    };

    if (reduce || !("IntersectionObserver" in window)) {
      reveals.forEach(show);
    } else {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var later = [];
      reveals.forEach(function (el) {
        if (el.getBoundingClientRect().top < vh * 0.96) show(el);
        else later.push(el);
      });
      if (later.length) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { show(en.target); io.unobserve(en.target); }
          });
        }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
        later.forEach(function (el) { io.observe(el); });
      }
      /* safety net: nothing stays invisible forever */
      setTimeout(revealAll, 2600);
    }
  } catch (e) { revealAll(); }

  /* Cinematic company story. The page scroll behaves like a video timeline:
     it rotates a layered signal volume and advances one explanation at a time. */
  try {
    var cinemaStory = document.querySelector("[data-cinema-story]");
    var cinemaFrame = document.querySelector("[data-cinema-frame]");
    if (cinemaStory && cinemaFrame) {
      var cinemaLabel = cinemaFrame.querySelector("[data-cinema-label]");
      var cinemaTitle = cinemaFrame.querySelector("[data-cinema-title]");
      var cinemaCopy = cinemaFrame.querySelector("[data-cinema-copy]");
      var cinemaChapter = cinemaFrame.querySelector("[data-cinema-chapter]");
      var cinemaTime = cinemaFrame.querySelector("[data-cinema-time]");
      var cinemaProgress = cinemaFrame.querySelector("[data-cinema-progress]");
      var cinemaCopyGroup = cinemaFrame.querySelector(".cinema-copy");
      var pageProgress = document.querySelector("[data-scroll-progress]");
      var cinemaViews = [
        { label: "01 / Observe", chapter: "Observe", title: "Change wakes the system.", copy: "Input becomes computation only when something meaningful changes." },
        { label: "02 / Encode", chapter: "Encode", title: "Change becomes an event.", copy: "Silence disappears. Only useful temporal information moves forward." },
        { label: "03 / Integrate", chapter: "Integrate", title: "Evidence builds over time.", copy: "Sparse events accumulate into a compact, confidence-bearing state." },
        { label: "04 / Decide", chapter: "Decide", title: "Certainty ends the work.", copy: "The system exits as soon as more computation stops adding value." }
      ];
      var cinemaStep = -1, cinemaQueued = false;
      var cinemaManualYaw = 0, cinemaDragging = false, cinemaLastX = 0;

      function cinemaClamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
      function setCinemaStep(index) {
        index = cinemaClamp(index, 0, cinemaViews.length - 1);
        if (index === cinemaStep) return;
        cinemaStep = index;
        var view = cinemaViews[index];
        cinemaFrame.setAttribute("data-step", String(index));
        if (cinemaLabel) cinemaLabel.textContent = view.label;
        if (cinemaTitle) cinemaTitle.textContent = view.title;
        if (cinemaCopy) cinemaCopy.textContent = view.copy;
        if (cinemaChapter) cinemaChapter.textContent = view.chapter;
        if (cinemaCopyGroup) {
          cinemaCopyGroup.classList.remove("is-changing");
          void cinemaCopyGroup.offsetWidth;
          cinemaCopyGroup.classList.add("is-changing");
        }
      }
      function paintCinema() {
        cinemaQueued = false;
        var rect = cinemaStory.getBoundingClientRect();
        var total = Math.max(1, cinemaStory.offsetHeight - window.innerHeight);
        var progress = cinemaClamp(-rect.top / total, 0, 1);
        var step = Math.min(cinemaViews.length - 1, Math.floor(progress * cinemaViews.length));
        var seconds = Math.round(progress * 18);
        var depth = -80 + Math.sin(progress * Math.PI) * 105;
        var bloom = .86 + Math.sin(progress * Math.PI) * .24;
        var coreScale = .88 + progress * .18;
        setCinemaStep(step);
        cinemaFrame.style.setProperty("--cinema-progress", progress.toFixed(4));
        cinemaFrame.style.setProperty("--cinema-yaw", (-28 + progress * 312 + cinemaManualYaw).toFixed(2) + "deg");
        cinemaFrame.style.setProperty("--cinema-pitch", (12 - progress * 18).toFixed(2) + "deg");
        cinemaFrame.style.setProperty("--cinema-depth", depth.toFixed(2) + "px");
        cinemaFrame.style.setProperty("--reactor-bloom", bloom.toFixed(3));
        cinemaFrame.style.setProperty("--reactor-twist", (progress * 168).toFixed(2) + "deg");
        cinemaFrame.style.setProperty("--reactor-core-scale", coreScale.toFixed(3));
        cinemaFrame.style.setProperty("--reactor-glow", (progress * 42).toFixed(2) + "px");
        if (cinemaProgress) cinemaProgress.style.transform = "scaleX(" + progress.toFixed(4) + ")";
        if (cinemaTime) cinemaTime.textContent = "00:" + (seconds < 10 ? "0" : "") + seconds;
        if (pageProgress) {
          var pageTotal = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          pageProgress.style.transform = "scaleX(" + cinemaClamp(window.scrollY / pageTotal, 0, 1).toFixed(4) + ")";
        }
      }
      function queueCinema() {
        if (cinemaQueued) return;
        cinemaQueued = true;
        requestAnimationFrame(paintCinema);
      }
      function stopCinemaDrag(e) {
        if (!cinemaDragging) return;
        cinemaDragging = false;
        cinemaFrame.classList.remove("is-dragging");
        try { cinemaFrame.releasePointerCapture(e.pointerId); } catch (err) {}
      }

      cinemaFrame.addEventListener("pointerdown", function (e) {
        cinemaDragging = true;
        cinemaLastX = e.clientX;
        cinemaFrame.classList.add("is-dragging");
        try { cinemaFrame.setPointerCapture(e.pointerId); } catch (err) {}
      });
      cinemaFrame.addEventListener("pointermove", function (e) {
        if (!cinemaDragging) return;
        cinemaManualYaw += (e.clientX - cinemaLastX) * .34;
        cinemaLastX = e.clientX;
        paintCinema();
      });
      cinemaFrame.addEventListener("pointerup", stopCinemaDrag);
      cinemaFrame.addEventListener("pointercancel", stopCinemaDrag);
      cinemaFrame.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        cinemaManualYaw += e.key === "ArrowLeft" ? -12 : 12;
        paintCinema();
      });

      window.addEventListener("scroll", queueCinema, { passive: true });
      window.addEventListener("resize", queueCinema);
      setCinemaStep(0);
      paintCinema();
    }
  } catch (e) { /* the film remains a readable static explanation */ }

  /* last-resort failsafe, independent of everything above: even if the whole
     boot threw before the reveal step, content becomes visible after 3s. */
  setTimeout(revealAll, 3000);
})();
