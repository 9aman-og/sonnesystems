(function () {
  "use strict";

  /*
    SONNE SYSTEMS / SHARED EXPERIENCE LAYER
    Navigation, restrained audio, reveal motion, scroll film and orbital input.
    No framework, no hidden dependencies.
  */

  var root = document.documentElement;
  var body = document.body;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Fast, legible page transitions ---------- */
  var transitionLayer = document.createElement("i");
  transitionLayer.className = "page-transition";
  transitionLayer.setAttribute("aria-hidden", "true");
  body.appendChild(transitionLayer);
  window.addEventListener("pageshow", function () { body.classList.remove("is-leaving"); });
  document.addEventListener("click", function (event) {
    if (reducedMotion || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;
    var rawHref = link.getAttribute("href");
    if (!rawHref || rawHref.charAt(0) === "#" || /^(mailto:|tel:)/i.test(rawHref)) return;
    var destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin) return;
    event.preventDefault();
    body.classList.add("is-leaving");
    window.setTimeout(function () { window.location.href = destination.href; }, 430);
  });

  /* ---------- Shared header and footer ---------- */
  var routes = [
    { label: "Home", href: "/" },
    { label: "Research", href: "/research.html" },
    { label: "Demo", href: "/demo.html" },
    { label: "Tools", href: "/tools.html" },
    { label: "About", href: "/about.html" }
  ];

  function currentRoute(href) {
    var path = window.location.pathname;
    if (href === "/") return path === "/" || path.endsWith("/index.html");
    return path.endsWith(href);
  }

  var headerTarget = document.querySelector("[data-site-header]");
  if (headerTarget) {
    headerTarget.outerHTML = [
      '<header class="site-header" data-header>',
      '  <a class="skip-link" href="#main-content">Skip to content</a>',
      '  <div class="header-inner">',
      '    <a class="brand" href="/" aria-label="Sonne Systems home" data-sound>',
      '      <span class="brand-mark" aria-hidden="true"></span>',
      '      <span>Sonne Systems</span>',
      '    </a>',
      '    <nav class="site-nav" aria-label="Primary">',
      routes.map(function (item) {
        return '<a href="' + item.href + '"' + (currentRoute(item.href) ? ' aria-current="page"' : "") + ' data-sound>' + item.label + "</a>";
      }).join(""),
      '    </nav>',
      '    <div class="header-actions">',
      '      <button class="sound-toggle" type="button" aria-pressed="false" aria-label="Turn interface sound on" data-sound-toggle>',
      '        <span class="sound-glyph" aria-hidden="true"><i></i><i></i><i></i></span>',
      '      </button>',
      '      <button class="menu-toggle" type="button" aria-expanded="false" aria-label="Open menu" data-menu-toggle><span></span></button>',
      '    </div>',
      '  </div>',
      '  <i class="scroll-progress" aria-hidden="true"></i>',
      '</header>'
    ].join("");
  }

  var footerTarget = document.querySelector("[data-site-footer]");
  if (footerTarget) {
    footerTarget.outerHTML = [
      '<footer class="site-footer">',
      '  <div class="footer-inner">',
      '    <div class="footer-top">',
      '      <p class="footer-statement">Build intelligence that earns every operation.</p>',
      '      <div class="footer-contact">',
      '        <small>Independent neuromorphic R&amp;D</small>',
      '        <a href="mailto:9aman.aa@gmail.com" data-sound>Start a conversation</a>',
      '      </div>',
      '    </div>',
      '    <div class="footer-bottom">',
      '      <span>Copyright ' + new Date().getFullYear() + ' Sonne Systems</span>',
      '      <nav class="footer-nav" aria-label="Footer">',
      '        <a href="/research.html">Research</a><a href="/demo.html">Demo</a><a href="/tools.html">Tools</a><a href="/about.html">About</a>',
      '      </nav>',
      '      <span>Signal over spectacle</span>',
      '    </div>',
      '  </div>',
      '</footer>'
    ].join("");
  }

  var header = document.querySelector("[data-header]");
  var menuToggle = document.querySelector("[data-menu-toggle]");

  function setMenu(open) {
    body.classList.toggle("menu-open", open);
    if (!menuToggle) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      setMenu(!body.classList.contains("menu-open"));
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setMenu(false);
  });
  document.querySelectorAll(".site-nav a").forEach(function (link) {
    link.addEventListener("click", function () { setMenu(false); });
  });

  /* ---------- Optional interface sound ---------- */
  var soundEnabled = false;
  var audioContext = null;
  var soundToggle = document.querySelector("[data-sound-toggle]");
  try { soundEnabled = localStorage.getItem("sonne.sound.origin") === "1"; } catch (error) {}

  function updateSoundButton() {
    if (!soundToggle) return;
    soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    soundToggle.setAttribute("aria-label", soundEnabled ? "Turn interface sound off" : "Turn interface sound on");
  }

  function getAudioContext() {
    if (!audioContext) {
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) audioContext = new AudioCtor();
    }
    return audioContext;
  }

  function playVoice(context, voice, start) {
    var oscillator = context.createOscillator();
    var gain = context.createGain();
    oscillator.type = voice.type || "sine";
    oscillator.frequency.setValueAtTime(voice.from, start);
    oscillator.frequency.exponentialRampToValueAtTime(voice.to || voice.from, start + voice.duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(voice.level, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + voice.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + voice.duration + 0.01);
  }

  function playSignal(kind) {
    if (!soundEnabled) return;
    var context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") context.resume();
    var now = context.currentTime;
    var sounds = {
      tap: [
        { from: 430, to: 310, duration: .065, level: .012, type: "triangle" },
        { from: 980, to: 760, duration: .038, level: .005, type: "sine", delay: .008 }
      ],
      select: [
        { from: 510, to: 570, duration: .09, level: .012, type: "sine" },
        { from: 760, to: 830, duration: .105, level: .008, type: "triangle", delay: .022 }
      ],
      activate: [
        { from: 280, to: 540, duration: .13, level: .014, type: "triangle" },
        { from: 820, to: 940, duration: .1, level: .007, type: "sine", delay: .038 }
      ],
      rotate: [
        { from: 690, to: 610, duration: .052, level: .007, type: "sine" },
        { from: 1040, to: 920, duration: .032, level: .003, type: "triangle" }
      ],
      chapter: [
        { from: 330, to: 370, duration: .14, level: .009, type: "sine" },
        { from: 495, to: 555, duration: .16, level: .006, type: "triangle", delay: .018 }
      ],
      boot: [
        { from: 360, to: 420, duration: .13, level: .01, type: "sine" },
        { from: 540, to: 620, duration: .14, level: .009, type: "sine", delay: .055 },
        { from: 720, to: 860, duration: .16, level: .007, type: "triangle", delay: .11 }
      ]
    };
    (sounds[kind] || sounds.tap).forEach(function (voice) { playVoice(context, voice, now + (voice.delay || 0)); });
  }

  if (soundToggle) {
    updateSoundButton();
    soundToggle.addEventListener("click", function () {
      soundEnabled = !soundEnabled;
      try { localStorage.setItem("sonne.sound.origin", soundEnabled ? "1" : "0"); } catch (error) {}
      updateSoundButton();
      if (soundEnabled) {
        getAudioContext();
        playSignal("boot");
      }
    });
  }
  document.addEventListener("pointerdown", function (event) {
    var target = event.target.closest("a, button, [role='button']");
    if (!target || target.matches("[data-route-tab], [data-sound-toggle]") || target.closest("[data-aperture]")) return;
    playSignal(target.classList.contains("button-primary") ? "activate" : "tap");
  });

  /* ---------- Reveal system ---------- */
  var revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (item) { item.classList.add("is-visible"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7%" });
    revealItems.forEach(function (item, index) {
      item.style.transitionDelay = Math.min(index % 4, 3) * 60 + "ms";
      revealObserver.observe(item);
    });
  }

  /* ---------- Scroll progress and header state ---------- */
  var scrollScheduled = false;
  function renderScrollState() {
    scrollScheduled = false;
    var max = Math.max(1, root.scrollHeight - window.innerHeight);
    var progress = Math.min(1, Math.max(0, window.scrollY / max));
    root.style.setProperty("--scroll-progress", (progress * 100).toFixed(2) + "%");
    if (header) header.classList.toggle("is-condensed", window.scrollY > 36);
    renderFilm();
    renderApertureScroll();
  }
  function scheduleScroll() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(renderScrollState);
  }
  window.addEventListener("scroll", scheduleScroll, { passive: true });
  window.addEventListener("resize", scheduleScroll, { passive: true });

  /* ---------- Interactive aperture ---------- */
  var aperture = document.querySelector("[data-aperture]");
  var apertureRoot = document.querySelector("[data-aperture-root]");
  var apertureStatus = document.querySelector("[data-aperture-status]");
  var apertureYaw = 0;
  var aperturePitch = 0;
  var dragging = false;
  var dragX = 0;
  var dragY = 0;
  var apertureVelocityX = 0;
  var apertureVelocityY = 0;
  var apertureInertiaFrame = 0;

  function drawAperture() {
    if (!apertureRoot) return;
    var displayedAngle = Math.round(((apertureYaw % 360) + 360) % 360);
    apertureRoot.style.setProperty("--aperture-yaw", apertureYaw.toFixed(2) + "deg");
    apertureRoot.style.setProperty("--aperture-pitch", (aperturePitch * .35).toFixed(2) + "deg");
    if (apertureStatus) apertureStatus.textContent = "Orbit / " + String(displayedAngle).padStart(3, "0") + "°";
  }

  function stopApertureInertia() {
    if (apertureInertiaFrame) cancelAnimationFrame(apertureInertiaFrame);
    apertureInertiaFrame = 0;
  }

  function coastAperture() {
    if (reducedMotion || dragging) return;
    apertureYaw += apertureVelocityX;
    aperturePitch = Math.max(-90, Math.min(90, aperturePitch + apertureVelocityY));
    apertureVelocityX *= .925;
    apertureVelocityY *= .925;
    drawAperture();
    if (Math.abs(apertureVelocityX) + Math.abs(apertureVelocityY) > .08) apertureInertiaFrame = requestAnimationFrame(coastAperture);
    else apertureInertiaFrame = 0;
  }

  if (aperture) {
    aperture.addEventListener("pointerdown", function (event) {
      stopApertureInertia();
      dragging = true;
      dragX = event.clientX;
      dragY = event.clientY;
      apertureVelocityX = 0;
      apertureVelocityY = 0;
      if (apertureRoot) apertureRoot.classList.add("is-engaged");
      aperture.setPointerCapture(event.pointerId);
      playSignal("rotate");
    });
    aperture.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      apertureVelocityX = (event.clientX - dragX) * .65;
      apertureVelocityY = (event.clientY - dragY) * -.45;
      apertureYaw += apertureVelocityX;
      aperturePitch = Math.max(-90, Math.min(90, aperturePitch + apertureVelocityY));
      dragX = event.clientX;
      dragY = event.clientY;
      drawAperture();
    });
    ["pointerup", "pointercancel"].forEach(function (name) {
      aperture.addEventListener(name, function (event) {
        dragging = false;
        if (apertureRoot) apertureRoot.classList.remove("is-engaged");
        try { aperture.releasePointerCapture(event.pointerId); } catch (error) {}
        coastAperture();
      });
    });
    aperture.addEventListener("keydown", function (event) {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") apertureYaw -= 12;
      if (event.key === "ArrowRight") apertureYaw += 12;
      if (event.key === "ArrowUp") aperturePitch = Math.min(90, aperturePitch + 8);
      if (event.key === "ArrowDown") aperturePitch = Math.max(-90, aperturePitch - 8);
      drawAperture();
      playSignal("rotate");
    });
    drawAperture();
  }

  if (apertureRoot && precisePointer && !reducedMotion) {
    apertureRoot.addEventListener("pointermove", function (event) {
      var rect = apertureRoot.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width;
      var y = (event.clientY - rect.top) / rect.height;
      apertureRoot.style.setProperty("--hero-light-x", (x * 100).toFixed(1) + "%");
      apertureRoot.style.setProperty("--hero-light-y", (y * 100).toFixed(1) + "%");
      apertureRoot.style.setProperty("--aperture-parallax-x", ((x - .5) * 18).toFixed(1) + "px");
      apertureRoot.style.setProperty("--aperture-parallax-y", ((y - .5) * 14).toFixed(1) + "px");
    });
    apertureRoot.addEventListener("pointerleave", function () {
      ["--aperture-parallax-x", "--aperture-parallax-y"].forEach(function (property) {
        apertureRoot.style.setProperty(property, "0px");
      });
      apertureRoot.style.setProperty("--hero-light-x", "57%");
      apertureRoot.style.setProperty("--hero-light-y", "42%");
    });
  }

  function renderApertureScroll() {
    if (!apertureRoot || reducedMotion || dragging) return;
    var rect = apertureRoot.getBoundingClientRect();
    var visibleProgress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
    var scrollOrbit = Math.max(0, Math.min(1, visibleProgress)) * 110;
    apertureRoot.style.setProperty("--aperture-scroll-yaw", scrollOrbit.toFixed(2) + "deg");
    apertureRoot.style.setProperty("--aperture-shift", (scrollOrbit * -0.07).toFixed(2) + "px");
  }

  /* ---------- One-idea-at-a-time scroll film ---------- */
  var film = document.querySelector("[data-film]");
  var filmSticky = film ? film.querySelector("[data-film-sticky]") : null;
  var filmCopy = film ? film.querySelector("[data-film-copy]") : null;
  var filmCount = film ? film.querySelector("[data-film-count]") : null;
  var filmTitle = film ? film.querySelector("[data-film-title]") : null;
  var filmBody = film ? film.querySelector("[data-film-body]") : null;
  var filmChapterNodes = film ? Array.from(film.querySelectorAll("[data-film-chapter]")) : [];
  var filmIndex = -1;
  var chapters = [
    { count: "01 / Detect", title: "Change arrives.", body: "The system stays quiet until the signal departs from its baseline. Silence creates no work." },
    { count: "02 / Encode", title: "Time becomes data.", body: "Meaningful changes become sparse events, preserving order without carrying the empty space between them." },
    { count: "03 / Integrate", title: "Evidence accumulates.", body: "Events build a confidence-bearing state over time. More work is earned only when uncertainty remains." },
    { count: "04 / Exit", title: "Certainty stops compute.", body: "Once further processing no longer improves the answer, the system exits. Efficiency becomes a behavior, not a slogan." }
  ];

  function renderFilm() {
    if (!film || !filmSticky) return;
    var start = film.offsetTop;
    var distance = Math.max(1, film.offsetHeight - window.innerHeight);
    var progress = Math.max(0, Math.min(0.999, (window.scrollY - start) / distance));
    var nextIndex = Math.min(chapters.length - 1, Math.floor(progress * chapters.length));
    filmSticky.style.setProperty("--film-progress", progress.toFixed(4));
    filmSticky.style.setProperty("--film-bar", (progress * 100).toFixed(2) + "%");
    filmSticky.style.setProperty("--film-shift", (progress * -1.8).toFixed(2) + "%");
    filmSticky.style.setProperty("--film-scale", (1.08 + progress * .07).toFixed(3));
    filmSticky.style.setProperty("--film-rotation", ((progress - .5) * 4.5).toFixed(2) + "deg");
    if (nextIndex === filmIndex) return;
    filmIndex = nextIndex;
    var chapter = chapters[filmIndex];
    if (filmCount) filmCount.textContent = chapter.count;
    if (filmTitle) filmTitle.textContent = chapter.title;
    if (filmBody) filmBody.textContent = chapter.body;
    filmChapterNodes.forEach(function (node, index) { node.classList.toggle("is-active", index === filmIndex); });
    if (filmCopy) {
      filmCopy.classList.remove("is-changing");
      void filmCopy.offsetWidth;
      filmCopy.classList.add("is-changing");
    }
    filmSticky.classList.remove("is-chapter-changing");
    void filmSticky.offsetWidth;
    filmSticky.classList.add("is-chapter-changing");
    playSignal("chapter");
  }

  /* ---------- Game-like route selector ---------- */
  var routeDeck = document.querySelector("[data-route-deck]");
  var routeConsole = document.querySelector("[data-route-console]");
  var routeTabs = routeDeck ? Array.from(routeDeck.querySelectorAll("[data-route-tab]")) : [];
  var routeScreen = routeDeck ? routeDeck.querySelector("[data-route-screen]") : null;
  var routeNumber = routeDeck ? routeDeck.querySelector("[data-route-number]") : null;
  var routeLabel = routeDeck ? routeDeck.querySelector("[data-route-label]") : null;
  var routeTitle = routeDeck ? routeDeck.querySelector("[data-route-title]") : null;
  var routeBody = routeDeck ? routeDeck.querySelector("[data-route-body]") : null;
  var routeLink = routeDeck ? routeDeck.querySelector("[data-route-link]") : null;
  var routeIndex = 0;
  var routeData = [
    { number: "01", label: "Live system / Observe", title: "See evidence form in time.", body: "Bring an image and inspect how visible change becomes a short event sequence, entirely in your browser.", link: "demo.html", action: "Open the demo", accent: "#ff8266", rgb: "255,130,102" },
    { number: "02", label: "Research record / Test", title: "Challenge the claim.", body: "Inspect active questions, matched controls, methods, known boundaries, and the evidence behind each direction.", link: "research.html", action: "Read the ledger", accent: "#72eaff", rgb: "114,234,255" },
    { number: "03", label: "Useful software / Use", title: "Protect your attention.", body: "Open local-first tools that remain useful without engagement loops, mandatory accounts, or a permanent network connection.", link: "tools.html", action: "Explore the tools", accent: "#a18cff", rgb: "161,140,255" },
    { number: "04", label: "Independent studio / About", title: "Meet the work behind the system.", body: "Learn why Sonne Systems stays compact, how it chooses questions, and what a serious collaboration looks like.", link: "about.html", action: "Enter the studio", accent: "#dce8f3", rgb: "220,232,243" }
  ];

  function activateRoute(index, moveFocus) {
    routeIndex = (index + routeData.length) % routeData.length;
    var item = routeData[routeIndex];
    if (routeDeck) {
      routeDeck.style.setProperty("--route-accent", item.accent);
      routeDeck.style.setProperty("--route-accent-rgb", item.rgb);
    }
    routeTabs.forEach(function (tab, tabIndex) {
      var active = tabIndex === routeIndex;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    if (routeNumber) routeNumber.textContent = item.number;
    if (routeLabel) routeLabel.textContent = item.label;
    if (routeTitle) routeTitle.textContent = item.title;
    if (routeBody) routeBody.textContent = item.body;
    if (routeLink) {
      routeLink.href = item.link;
      var labelNode = routeLink.querySelector("span");
      if (labelNode) labelNode.textContent = item.action;
    }
    if (routeScreen) {
      routeScreen.classList.remove("is-switching");
      void routeScreen.offsetWidth;
      routeScreen.classList.add("is-switching");
    }
    if (moveFocus) routeTabs[routeIndex].focus();
    playSignal("select");
  }

  routeTabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () { activateRoute(index, false); });
    tab.addEventListener("keydown", function (event) {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Home") activateRoute(0, true);
      else if (event.key === "End") activateRoute(routeData.length - 1, true);
      else activateRoute(routeIndex + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1), true);
    });
  });

  if (routeConsole && precisePointer && !reducedMotion) {
    routeConsole.addEventListener("pointermove", function (event) {
      var rect = routeConsole.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      routeConsole.style.setProperty("--deck-yaw", (x * 3.5).toFixed(2) + "deg");
      routeConsole.style.setProperty("--deck-pitch", (y * -2.4).toFixed(2) + "deg");
      if (routeScreen) {
        routeScreen.style.setProperty("--route-x", ((x + .5) * 100).toFixed(1) + "%");
        routeScreen.style.setProperty("--route-y", ((y + .5) * 100).toFixed(1) + "%");
      }
    });
    routeConsole.addEventListener("pointerleave", function () {
      routeConsole.style.setProperty("--deck-yaw", "0deg");
      routeConsole.style.setProperty("--deck-pitch", "0deg");
      if (routeScreen) {
        routeScreen.style.setProperty("--route-x", "72%");
        routeScreen.style.setProperty("--route-y", "44%");
      }
    });
  }

  /* ---------- Soft-club reactive surfaces ---------- */
  if (precisePointer && !reducedMotion) {
    document.querySelectorAll(".proof-card, .value-card, .method-card, .product-stage").forEach(function (surface) {
      surface.addEventListener("pointermove", function (event) {
        var rect = surface.getBoundingClientRect();
        surface.style.setProperty("--surface-x", (((event.clientX - rect.left) / rect.width) * 100).toFixed(1) + "%");
        surface.style.setProperty("--surface-y", (((event.clientY - rect.top) / rect.height) * 100).toFixed(1) + "%");
        surface.classList.add("is-sensing");
      });
      surface.addEventListener("pointerleave", function () { surface.classList.remove("is-sensing"); });
    });
  }

  /* ---------- Precision cursor, never used as a required affordance ---------- */
  if (precisePointer && !reducedMotion) {
    body.classList.add("has-precise-pointer");
    var cursor = document.createElement("i");
    cursor.className = "signal-cursor";
    cursor.setAttribute("aria-hidden", "true");
    body.appendChild(cursor);
    var pointerFrame = 0;
    var pointerX = window.innerWidth * .72;
    var pointerY = window.innerHeight * .22;
    window.addEventListener("pointermove", function (event) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(function () {
        pointerFrame = 0;
        cursor.style.left = pointerX + "px";
        cursor.style.top = pointerY + "px";
        root.style.setProperty("--pointer-x", pointerX + "px");
        root.style.setProperty("--pointer-y", pointerY + "px");
      });
    }, { passive: true });
    document.addEventListener("pointerover", function (event) {
      cursor.classList.toggle("is-hot", Boolean(event.target.closest("a, button, input, [tabindex]")));
    });
  }

  renderScrollState();
})();
