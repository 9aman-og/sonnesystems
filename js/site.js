(function () {
  "use strict";

  /*
    SONNE SYSTEMS / SHARED INTERACTION LAYER
    Navigation, local interface audio, reveal motion, and the scroll focus sequence.
    Everything remains usable when JavaScript, motion, or sound is unavailable.
  */

  var root = document.documentElement;
  var body = document.body;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Shared header and footer ---------- */
  var routes = [
    { label: "Home", href: "/" },
    { label: "Research", href: "/research.html" },
    { label: "Ventures", href: "/ventures.html" },
    { label: "Studio", href: "/about.html" }
  ];

  function isCurrent(href) {
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
      '    <a class="brand" href="/" aria-label="Sonne Systems home">',
      '      <span class="brand-mark" aria-hidden="true"><i></i></span>',
      '      <span>Sonne Systems</span>',
      '    </a>',
      '    <nav class="site-nav" aria-label="Primary">',
      routes.map(function (item) {
        return '<a href="' + item.href + '"' + (isCurrent(item.href) ? ' aria-current="page"' : "") + '>' + item.label + "</a>";
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
      '      <p class="footer-statement">Build the claim. Test the boundary.</p>',
      '      <div class="footer-contact"><small>Research and engineering</small><a href="mailto:9aman.aa@gmail.com">9aman.aa@gmail.com</a></div>',
      '    </div>',
      '    <div class="footer-bottom">',
      '      <span>Copyright ' + new Date().getFullYear() + ' Sonne Systems</span>',
      '      <nav class="footer-nav" aria-label="Footer"><a href="/research.html">Research</a><a href="/ventures.html">Ventures</a><a href="/about.html">Studio</a><a href="/papers.html">Paper archive</a></nav>',
      '      <span>Independent AI research</span>',
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
    menuToggle.addEventListener("click", function () { setMenu(!body.classList.contains("menu-open")); });
  }
  document.addEventListener("keydown", function (event) { if (event.key === "Escape") setMenu(false); });

  /* ---------- Quiet, opt-in interface audio ---------- */
  var soundEnabled = false;
  var audioContext = null;
  var soundToggle = document.querySelector("[data-sound-toggle]");
  try { soundEnabled = localStorage.getItem("sonne.sound.clear") === "1"; } catch (error) {}

  function updateSoundButton() {
    if (!soundToggle) return;
    soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    soundToggle.setAttribute("aria-label", soundEnabled ? "Turn interface sound off" : "Turn interface sound on");
  }

  function context() {
    if (!audioContext) {
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) audioContext = new AudioCtor();
    }
    return audioContext;
  }

  function voice(ctx, settings, start) {
    var oscillator = ctx.createOscillator();
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    oscillator.type = settings.type || "sine";
    oscillator.frequency.setValueAtTime(settings.from, start);
    oscillator.frequency.exponentialRampToValueAtTime(settings.to, start + settings.duration);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(settings.filter || 1800, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(settings.level, start + .009);
    gain.gain.exponentialRampToValueAtTime(.0001, start + settings.duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + settings.duration + .02);
  }

  function clickSound(primary) {
    if (!soundEnabled) return;
    var ctx = context();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    var now = ctx.currentTime;
    if (primary) {
      voice(ctx, { from: 286, to: 430, duration: .12, level: .018, type: "triangle", filter: 1250 }, now);
      voice(ctx, { from: 610, to: 780, duration: .09, level: .007, type: "sine", filter: 1900 }, now + .035);
    } else {
      voice(ctx, { from: 520, to: 360, duration: .07, level: .011, type: "triangle", filter: 1400 }, now);
      voice(ctx, { from: 920, to: 700, duration: .045, level: .004, type: "sine", filter: 2100 }, now + .008);
    }
  }

  if (soundToggle) {
    updateSoundButton();
    soundToggle.addEventListener("click", function () {
      soundEnabled = !soundEnabled;
      try { localStorage.setItem("sonne.sound.clear", soundEnabled ? "1" : "0"); } catch (error) {}
      updateSoundButton();
      if (soundEnabled) {
        var ctx = context();
        if (ctx && ctx.state === "suspended") ctx.resume();
        window.setTimeout(function () { clickSound(true); }, 15);
      }
    });
  }

  document.addEventListener("pointerdown", function (event) {
    var target = event.target.closest("a, button");
    if (!target || target === soundToggle) return;
    clickSound(target.classList.contains("button") || target.closest(".venture-card"));
  });

  /* ---------- Fast cross-page transition ---------- */
  var flash = document.createElement("i");
  flash.className = "page-flash";
  flash.setAttribute("aria-hidden", "true");
  body.appendChild(flash);

  if (!reducedMotion) {
    body.classList.add("is-entering");
    requestAnimationFrame(function () { requestAnimationFrame(function () { body.classList.remove("is-entering"); }); });
  }
  window.addEventListener("pageshow", function () { body.classList.remove("is-leaving", "is-entering"); });
  document.addEventListener("click", function (event) {
    if (reducedMotion || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;
    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(mailto:|tel:)/i.test(href)) return;
    var destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
    event.preventDefault();
    body.classList.add("is-leaving");
    window.setTimeout(function () { window.location.href = destination.href; }, 275);
  });

  /* ---------- Reveal only once, with short cognitive pacing ---------- */
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
    }, { threshold: .1, rootMargin: "0px 0px -7%" });
    revealItems.forEach(function (item, index) {
      item.style.transitionDelay = Math.min(index % 3, 2) * 55 + "ms";
      revealObserver.observe(item);
    });
  }

  /* ---------- One idea at a time scroll focus ---------- */
  var focusSequence = document.querySelector("[data-focus-sequence]");
  var focusTitle = focusSequence ? focusSequence.querySelector("[data-focus-title]") : null;
  var focusBody = focusSequence ? focusSequence.querySelector("[data-focus-body]") : null;
  var focusCopy = focusSequence ? focusSequence.querySelector(".focus-copy") : null;
  var focusIndex = -1;
  var focusIdeas = [
    { title: "Change arrives.", body: "A useful system should notice meaningful change without spending the same effort on every moment." },
    { title: "Time becomes data.", body: "Sparse events can preserve timing and structure without carrying all of the empty space between them." },
    { title: "Evidence accumulates.", body: "Events build a confidence-bearing state over time. More work is earned only while uncertainty remains." },
    { title: "The answer gets clear.", body: "Once more processing can no longer improve the decision, the system should stop." }
  ];

  function renderFocus() {
    if (!focusSequence || reducedMotion) return;
    var start = focusSequence.offsetTop;
    var distance = Math.max(1, focusSequence.offsetHeight - window.innerHeight);
    var progress = Math.max(0, Math.min(.999, (window.scrollY - start) / distance));
    var nextIndex = Math.min(focusIdeas.length - 1, Math.floor(progress * focusIdeas.length));
    focusSequence.style.setProperty("--focus-progress", progress.toFixed(4));
    if (nextIndex === focusIndex) return;
    focusIndex = nextIndex;
    if (focusTitle) focusTitle.textContent = focusIdeas[nextIndex].title;
    if (focusBody) focusBody.textContent = focusIdeas[nextIndex].body;
    if (focusCopy) {
      focusCopy.classList.remove("is-changing");
      void focusCopy.offsetWidth;
      focusCopy.classList.add("is-changing");
    }
  }

  /* ---------- Shared scroll state ---------- */
  var scrollQueued = false;
  function updateScroll() {
    scrollQueued = false;
    var max = Math.max(1, root.scrollHeight - window.innerHeight);
    root.style.setProperty("--scroll-progress", (Math.max(0, Math.min(1, window.scrollY / max)) * 100).toFixed(2) + "%");
    if (header) header.classList.toggle("is-condensed", window.scrollY > 32);
    renderFocus();
  }
  function queueScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(updateScroll);
  }
  window.addEventListener("scroll", queueScroll, { passive: true });
  window.addEventListener("resize", queueScroll, { passive: true });
  updateScroll();
})();
