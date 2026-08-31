(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wipe = document.querySelector(".page-wipe");
  var header = document.querySelector("[data-header]");
  var planToggle = document.querySelector("[data-plan-toggle]");
  var planDetails = document.querySelector("[data-plan-details]");

  if (wipe && !reduceMotion) {
    wipe.classList.add("entering");
    wipe.addEventListener("animationend", function () {
      wipe.classList.remove("entering");
    }, { once: true });
  }

  document.querySelectorAll("a[href]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      var href = link.getAttribute("href") || "";
      if (event.defaultPrevented || reduceMotion || event.metaKey || event.ctrlKey || event.shiftKey || href.startsWith("#") || link.target === "_blank") return;
      var url = new URL(link.href, location.href);
      if (!wipe || url.origin !== location.origin) return;
      event.preventDefault();
      wipe.classList.add("leaving");
      window.setTimeout(function () { location.href = url.href; }, 420);
    });
  });

  function syncHeader() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 18);
  }
  window.addEventListener("scroll", syncHeader, { passive: true });
  syncHeader();

  var reveals = Array.from(document.querySelectorAll(".reveal"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (node) { node.classList.add("visible"); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: "0px 0px -6%" });
    reveals.forEach(function (node, index) {
      node.style.transitionDelay = Math.min(index % 3, 2) * 65 + "ms";
      observer.observe(node);
    });
  }

  if (planToggle && planDetails) {
    planToggle.addEventListener("click", function () {
      var opening = planDetails.hidden;
      planDetails.hidden = !opening;
      planToggle.setAttribute("aria-expanded", String(opening));
      planToggle.textContent = opening ? "Close review" : "Review 4 changes";
    });
  }

  document.querySelectorAll("[data-year]").forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });
})();
