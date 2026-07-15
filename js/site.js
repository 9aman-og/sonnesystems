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
      '<img src="' + ASSET_ROOT + 'logo-options/sonne-mark-signal.svg" alt="" width="48" height="48">' +
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

  /* Homepage story and 360-degree intelligence engine. Scroll controls the
     four-part explanation; drag and arrow keys let visitors inspect the
     object without exposing mechanical pause or reset controls. */
  try {
    var story = document.querySelector("[data-company-story]");
    var engine = document.querySelector("[data-company-engine]");
    if (story && engine) {
      var engineScene = engine.querySelector(".engine-scene");
      var engineIndex = engine.querySelector("[data-engine-index]");
      var engineTitle = engine.querySelector("[data-engine-title]");
      var engineCopy = engine.querySelector("[data-engine-copy]");
      var storySteps = Array.prototype.slice.call(story.querySelectorAll("[data-story-step]"));
      var progressLabel = story.querySelector("[data-story-progress-label]");
      var progressBar = story.querySelector("[data-story-progress-bar]");
      var pageProgress = document.querySelector("[data-scroll-progress]");
      var reduceEngineMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var engineViews = [
        { index: "SONNE / 00", title: "Event-driven intelligence", copy: "Compute begins only when the signal has something to say." },
        { index: "01 / OBSERVE", title: "Change becomes an event", copy: "Sparse sensors wake only when input changes." },
        { index: "02 / INTEGRATE", title: "Evidence compounds", copy: "Events accumulate into a confidence-bearing state." },
        { index: "03 / DECIDE", title: "Certainty ends the work", copy: "Inference stops when more compute adds no value." }
      ];
      var engineYaw = -18, enginePitch = 8, scrollYaw = 0;
      var engineDragging = false, engineLastX = 0, engineLastY = 0;
      var engineLastTime = 0, activeStoryStep = -1, scrollQueued = false;

      function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
      function setStoryStep(index) {
        index = clamp(index, 0, storySteps.length - 1);
        if (index === activeStoryStep) return;
        activeStoryStep = index;
        storySteps.forEach(function (step, stepIndex) {
          var active = stepIndex === index;
          step.classList.toggle("is-active", active);
          step.setAttribute("aria-hidden", reduceEngineMotion ? "false" : (active ? "false" : "true"));
        });
        var view = engineViews[index];
        if (view) {
          if (engineIndex) engineIndex.textContent = view.index;
          if (engineTitle) engineTitle.textContent = view.title;
          if (engineCopy) engineCopy.textContent = view.copy;
        }
        if (progressLabel) progressLabel.textContent = "0" + (index + 1) + " / 04";
      }
      function paintEngine() {
        engine.style.setProperty("--engine-pitch", enginePitch.toFixed(2) + "deg");
        engine.style.setProperty("--engine-yaw", (engineYaw + scrollYaw).toFixed(2) + "deg");
      }
      function paintScroll() {
        scrollQueued = false;
        var rect = story.getBoundingClientRect();
        var total = Math.max(1, story.offsetHeight - window.innerHeight);
        var storyProgress = clamp(-rect.top / total, 0, 1);
        var step = Math.min(storySteps.length - 1, Math.floor(storyProgress * storySteps.length));
        setStoryStep(step);
        scrollYaw = storyProgress * 210;
        if (progressBar) progressBar.style.transform = "scaleX(" + storyProgress.toFixed(4) + ")";
        if (pageProgress) {
          var pageTotal = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          pageProgress.style.transform = "scaleX(" + clamp(window.scrollY / pageTotal, 0, 1).toFixed(4) + ")";
        }
        paintEngine();
      }
      function queueScrollPaint() {
        if (scrollQueued) return;
        scrollQueued = true;
        requestAnimationFrame(paintScroll);
      }
      function stopEngineDrag(e) {
        if (!engineDragging) return;
        engineDragging = false;
        engine.classList.remove("is-dragging");
        try { engine.releasePointerCapture(e.pointerId); } catch (err) {}
      }

      engine.addEventListener("pointerdown", function (e) {
        engineDragging = true;
        engineLastX = e.clientX;
        engineLastY = e.clientY;
        engine.classList.add("is-dragging");
        try { engine.setPointerCapture(e.pointerId); } catch (err) {}
      });
      engine.addEventListener("pointermove", function (e) {
        if (!engineDragging) return;
        engineYaw += (e.clientX - engineLastX) * .68;
        enginePitch = clamp(enginePitch - (e.clientY - engineLastY) * .38, -28, 28);
        engineLastX = e.clientX;
        engineLastY = e.clientY;
        paintEngine();
      });
      engine.addEventListener("pointerup", stopEngineDrag);
      engine.addEventListener("pointercancel", stopEngineDrag);
      engine.addEventListener("keydown", function (e) {
        var handled = true;
        if (e.key === "ArrowLeft") engineYaw -= 12;
        else if (e.key === "ArrowRight") engineYaw += 12;
        else if (e.key === "ArrowUp") enginePitch = clamp(enginePitch - 5, -28, 28);
        else if (e.key === "ArrowDown") enginePitch = clamp(enginePitch + 5, -28, 28);
        else handled = false;
        if (handled) { e.preventDefault(); paintEngine(); }
      });

      function engineLoop(now) {
        if (!engineLastTime) engineLastTime = now;
        var elapsed = Math.min(40, now - engineLastTime);
        engineLastTime = now;
        if (!reduceEngineMotion && !engineDragging && engineScene) {
          engineYaw += elapsed * .006;
          paintEngine();
        }
        requestAnimationFrame(engineLoop);
      }

      window.addEventListener("scroll", queueScrollPaint, { passive: true });
      window.addEventListener("resize", queueScrollPaint);
      setStoryStep(0);
      paintScroll();
      requestAnimationFrame(engineLoop);
    }
  } catch (e) { /* the model remains readable and static */ }

  /* last-resort failsafe, independent of everything above: even if the whole
     boot threw before the reveal step, content becomes visible after 3s. */
  setTimeout(revealAll, 3000);
})();
