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
      '<img src="' + ASSET_ROOT + 'SonneSystemsCompanyLogo.png" alt="" width="48" height="48">' +
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
      '<a class="brand' + (PAGE === "home" ? ' brand-word-only' : '') + '" href="/" aria-label="Sonne Systems home">' +
        (PAGE === "home" ? "" : sunMark("brand-mark")) +
        '<span class="brand-word"><b>Sonne</b><span>Systems</span></span>' +
      "</a>" +
      '<span class="nav-discipline" aria-hidden="true"><i></i> Neuromorphic R&amp;D</span>' +
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
      '<div class="footer-signal"><span><i></i> System online</span><span>Independent neuromorphic research</span></div>' +
      '<div class="footer-inner">' +
        '<div class="footer-identity"><a class="brand' + (PAGE === "home" ? ' brand-word-only' : '') + '" href="/" aria-label="Sonne Systems home">' +
            (PAGE === "home" ? "" : sunMark("brand-mark")) +
            '<span class="brand-word"><b>Sonne</b><span>Systems</span></span>' +
          "</a>" +
          '<p class="footer-line">Sparse intelligence.<br>Built with evidence.</p></div>' +
        '<a class="footer-contact" href="' + MAIL + '"><span>Have a difficult signal?</span><strong>Start a conversation <b aria-hidden="true">&#8599;</b></strong></a>' +
      '</div>' +
      '<div class="footer-bottom">' +
        '<nav class="footer-nav" aria-label="Footer">' +
          '<a href="/demo.html">Demo</a><a href="/research.html">Research</a>' +
          '<a href="/tools.html">Tools</a><a href="/about.html">About</a>' +
          '<a href="' + LINKEDIN + '" target="_blank" rel="noopener">LinkedIn</a>' +
          '<a href="' + GITHUB + '" target="_blank" rel="noopener">GitHub</a>' +
        "</nav>" +
        '<p class="footer-fine">&copy; <span class="year"></span> Sonne Systems &middot; sonnesystems.com</p>' +
      "</div>";
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
      document.querySelectorAll(".reveal").forEach(function (el) {
        el.classList.remove("will-reveal");
        el.classList.add("revealed");
      });
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
      el.classList.remove("will-reveal");
      el.classList.add("revealed");
    };

    if (reduce || !("IntersectionObserver" in window)) {
      reveals.forEach(show);
    } else {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var later = [];
      reveals.forEach(function (el) {
        if (el.getBoundingClientRect().top < vh * 0.96) show(el);
        else { el.classList.add("will-reveal"); later.push(el); }
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

  /* ============================================================
     Experience layer: global progress, responsive depth, magnetic
     actions and a subtle pointer field. All effects are additive;
     content remains complete when motion APIs are unavailable.
     ============================================================ */
  try {
    var motionReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var finePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    var scrollProgress = document.querySelector("[data-scroll-progress]");
    if (!scrollProgress) {
      scrollProgress = document.createElement("div");
      scrollProgress.className = "site-scroll-progress";
      scrollProgress.setAttribute("data-scroll-progress", "");
      scrollProgress.setAttribute("aria-hidden", "true");
      document.body.appendChild(scrollProgress);
    }

    var topbar = document.querySelector(".topbar");
    var globalQueued = false;
    function paintGlobalMotion() {
      globalQueued = false;
      var total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var progress = Math.max(0, Math.min(1, window.scrollY / total));
      scrollProgress.style.transform = "scaleX(" + progress.toFixed(4) + ")";
      if (topbar) topbar.classList.toggle("is-condensed", window.scrollY > 28);
      document.documentElement.style.setProperty("--page-progress", progress.toFixed(4));
    }
    function queueGlobalMotion() {
      if (globalQueued) return;
      globalQueued = true;
      requestAnimationFrame(paintGlobalMotion);
    }
    window.addEventListener("scroll", queueGlobalMotion, { passive: true });
    window.addEventListener("resize", queueGlobalMotion);
    paintGlobalMotion();

    if (!motionReduce && finePointer) {
      var aura = document.createElement("div");
      aura.className = "pointer-aura";
      aura.setAttribute("aria-hidden", "true");
      document.body.appendChild(aura);
      document.addEventListener("pointermove", function (e) {
        document.documentElement.style.setProperty("--pointer-x", e.clientX + "px");
        document.documentElement.style.setProperty("--pointer-y", e.clientY + "px");
        document.body.classList.add("has-pointer");
      }, { passive: true });

      document.querySelectorAll(".page-object,.hero-signal-panel,.focus-timeline,.lyfe-premium-card,.research-entry,.card,.contact-panel").forEach(function (surface) {
        surface.classList.add("motion-surface");
        surface.addEventListener("pointermove", function (e) {
          var rect = surface.getBoundingClientRect();
          var x = (e.clientX - rect.left) / Math.max(1, rect.width);
          var y = (e.clientY - rect.top) / Math.max(1, rect.height);
          surface.style.setProperty("--surface-x", ((x - .5) * 10).toFixed(2) + "px");
          surface.style.setProperty("--surface-y", ((y - .5) * 10).toFixed(2) + "px");
          surface.style.setProperty("--surface-hot-x", (x * 100).toFixed(1) + "%");
          surface.style.setProperty("--surface-hot-y", (y * 100).toFixed(1) + "%");
        }, { passive: true });
        surface.addEventListener("pointerleave", function () {
          surface.style.setProperty("--surface-x", "0px");
          surface.style.setProperty("--surface-y", "0px");
        });
      });

      document.querySelectorAll(".btn").forEach(function (button) {
        button.classList.add("magnetic-action");
        button.addEventListener("pointermove", function (e) {
          var rect = button.getBoundingClientRect();
          button.style.setProperty("--magnet-x", (((e.clientX - rect.left) / rect.width - .5) * 8).toFixed(2) + "px");
          button.style.setProperty("--magnet-y", (((e.clientY - rect.top) / rect.height - .5) * 6).toFixed(2) + "px");
        }, { passive: true });
        button.addEventListener("pointerleave", function () {
          button.style.setProperty("--magnet-x", "0px");
          button.style.setProperty("--magnet-y", "0px");
        });
      });
    }

    var heroSignalPanel = document.querySelector(".hero-signal-panel");
    if (heroSignalPanel && !motionReduce) {
      var heroSignalStep = 0;
      heroSignalPanel.setAttribute("data-state", "0");
      setInterval(function () {
        heroSignalStep = (heroSignalStep + 1) % 3;
        heroSignalPanel.setAttribute("data-state", String(heroSignalStep));
      }, 2400);
    }

    requestAnimationFrame(function () { document.body.classList.add("is-ready"); });
  } catch (e) { document.body.classList.add("is-ready"); }

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
        var cameraProgress = progress * progress * (3 - 2 * progress);
        var step = Math.min(cinemaViews.length - 1, Math.floor(progress * cinemaViews.length));
        var seconds = Math.round(progress * 18);
        var depth = -80 + Math.sin(progress * Math.PI) * 105;
        var bloom = .86 + Math.sin(progress * Math.PI) * .24;
        var coreScale = .88 + progress * .18;
        setCinemaStep(step);
        cinemaFrame.style.setProperty("--cinema-progress", progress.toFixed(4));
        cinemaFrame.style.setProperty("--cinema-yaw", (-28 + cameraProgress * 312 + cinemaManualYaw).toFixed(2) + "deg");
        cinemaFrame.style.setProperty("--cinema-pitch", (12 - cameraProgress * 18).toFixed(2) + "deg");
        cinemaFrame.style.setProperty("--cinema-depth", depth.toFixed(2) + "px");
        cinemaFrame.style.setProperty("--reactor-bloom", bloom.toFixed(3));
        cinemaFrame.style.setProperty("--reactor-twist", (cameraProgress * 168).toFixed(2) + "deg");
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

  /* The live-model section is a second, quieter scroll instrument. Its
     evidence trace fills as the section enters instead of playing on a loop. */
  try {
    var liveFocus = document.querySelector("[data-live-focus]");
    if (liveFocus) {
      var liveBars = Array.prototype.slice.call(liveFocus.querySelectorAll(".timeline-signal i"));
      var liveQueued = false;
      var liveReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      function liveClamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
      function paintLiveFocus() {
        liveQueued = false;
        var rect = liveFocus.getBoundingClientRect();
        var viewport = window.innerHeight || document.documentElement.clientHeight;
        var reveal = liveReduce ? 1 : liveClamp((viewport * .94 - rect.top) / (viewport * .74), 0, 1);
        var journey = liveReduce ? 1 : liveClamp((viewport * .72 - rect.top) / Math.max(viewport * .8, rect.height), 0, 1);
        var eased = journey * journey * (3 - 2 * journey);
        liveFocus.style.setProperty("--live-reveal", reveal.toFixed(4));
        liveFocus.style.setProperty("--live-progress", eased.toFixed(4));
        liveFocus.style.setProperty("--live-rotation", (eased * 118).toFixed(2) + "deg");
        liveFocus.style.setProperty("--live-copy-opacity", (.38 + reveal * .62).toFixed(4));
        liveFocus.style.setProperty("--live-copy-shift", ((1 - reveal) * 58).toFixed(2) + "px");
        liveFocus.style.setProperty("--live-panel-opacity", (.42 + reveal * .58).toFixed(4));
        liveFocus.style.setProperty("--live-panel-shift", ((1 - reveal) * 56).toFixed(2) + "px");
        liveFocus.style.setProperty("--live-panel-scale", (.94 + reveal * .06).toFixed(4));
        liveFocus.style.setProperty("--live-glow-x", (34 + eased * 30).toFixed(2) + "%");
        liveFocus.style.setProperty("--threshold-scale", (.18 + eased * .82).toFixed(4));
        liveFocus.style.setProperty("--signal-label-opacity", (.35 + eased * .65).toFixed(4));
        liveBars.forEach(function (bar, index) {
          var fill = liveClamp(eased * (liveBars.length + 2) - index, 0, 1);
          bar.style.setProperty("--bar-fill", fill.toFixed(3));
          bar.style.setProperty("--bar-opacity", (.34 + fill * .66).toFixed(3));
        });
      }
      function queueLiveFocus() {
        if (liveQueued) return;
        liveQueued = true;
        requestAnimationFrame(paintLiveFocus);
      }
      window.addEventListener("scroll", queueLiveFocus, { passive: true });
      window.addEventListener("resize", queueLiveFocus);
      paintLiveFocus();
    }
  } catch (e) { /* content and evidence remain fully readable */ }

  /* last-resort failsafe, independent of everything above: even if the whole
     boot threw before the reveal step, content becomes visible after 3s. */
  setTimeout(revealAll, 3000);
})();
