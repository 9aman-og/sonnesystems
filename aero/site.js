(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wipe = document.querySelector(".page-wipe");
  var header = document.querySelector("[data-header]");
  var modelButton = document.querySelector("[data-model-button]");
  var modelMenu = document.querySelector("[data-model-menu]");
  var reviewButton = document.querySelector("[data-review]");
  var reviewDetails = document.querySelector("[data-action-details]");
  var heroReview = document.querySelector("[data-hero-review]");
  var heroDetails = document.querySelector("[data-hero-details]");
  var previewInput = document.querySelector("[data-preview-input]");

  var modes = {
    plan: {
      title: "Launch week",
      prompt: "Make tomorrow calm around the launch.",
      answer: "I found one collision, two movable tasks, and a follow-up that can stay a draft. I prepared the smallest plan that protects the build.",
      count: "4 changes",
      summary: "Protect the build block and clear the runway."
    },
    research: {
      title: "Memory notes",
      prompt: "Compare these notes. Where do they actually disagree?",
      answer: "Two notes use the same term for different promotion rules. I kept both sources, separated the claims, and left the threshold unresolved.",
      count: "3 claims",
      summary: "One conflict remains for your decision."
    },
    write: {
      title: "Application draft",
      prompt: "Make this clearer without making it sound inflated.",
      answer: "I kept the concrete result, removed two unsupported superlatives, and made the unproven part explicit.",
      count: "6 edits",
      summary: "Clearer language. Same intended meaning."
    },
    admin: {
      title: "Friday admin",
      prompt: "Close what does not need my judgment.",
      answer: "I grouped five reversible updates, left the email send out of scope, and stopped at the one decision that changes the outcome.",
      count: "5 changes",
      summary: "Routine work ready. One decision remains."
    }
  };

  function setDisclosure(button, panel, opening, openLabel, closedLabel) {
    if (!button || !panel) return;
    panel.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
    button.textContent = opening ? openLabel : closedLabel;
  }

  if (wipe && !reduceMotion) {
    wipe.classList.add("entering");
    wipe.addEventListener("animationend", function () { wipe.classList.remove("entering"); }, { once: true });
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
    }, { threshold: .1, rootMargin: "0px 0px -6%" });
    reveals.forEach(function (node, index) {
      node.style.transitionDelay = Math.min(index % 3, 2) * 65 + "ms";
      observer.observe(node);
    });
  }

  if (heroReview && heroDetails) {
    heroReview.addEventListener("click", function () {
      var opening = heroDetails.hidden;
      setDisclosure(heroReview, heroDetails, opening, "Close review", "Review plan →");
    });
  }

  if (reviewButton && reviewDetails) {
    reviewButton.addEventListener("click", function () {
      var opening = reviewDetails.hidden;
      setDisclosure(reviewButton, reviewDetails, opening, "Close review", "Review changes");
    });
  }

  if (modelButton && modelMenu) {
    modelButton.addEventListener("click", function () {
      var opening = modelMenu.hidden;
      modelMenu.hidden = !opening;
      modelButton.setAttribute("aria-expanded", String(opening));
    });
    modelMenu.querySelectorAll("[data-model]").forEach(function (button) {
      button.addEventListener("click", function () {
        modelButton.querySelector("b").textContent = button.dataset.model;
        modelMenu.hidden = true;
        modelButton.setAttribute("aria-expanded", "false");
      });
    });
  }

  function selectMode(name) {
    var mode = modes[name] || modes.plan;
    document.getElementById("preview-title").textContent = mode.title;
    document.getElementById("preview-prompt").textContent = mode.prompt;
    document.getElementById("preview-answer").textContent = mode.answer;
    document.getElementById("change-count").textContent = mode.count;
    document.getElementById("action-summary").textContent = mode.summary;
    document.querySelectorAll("[data-mode]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.mode === name);
    });
    document.querySelectorAll("[data-thread]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.thread === name);
    });
    setDisclosure(reviewButton, reviewDetails, false, "Close review", "Review changes");
  }

  document.querySelectorAll("[data-mode]").forEach(function (button) {
    button.addEventListener("click", function () { selectMode(button.dataset.mode); });
  });
  document.querySelectorAll("[data-thread]").forEach(function (button) {
    button.addEventListener("click", function () { selectMode(button.dataset.thread); });
  });

  var form = document.querySelector("[data-preview-form]");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = (previewInput.value || "").trim();
      if (!value) return;
      document.getElementById("preview-prompt").textContent = value;
      document.getElementById("preview-answer").textContent = "This preview does not send your text anywhere. Open Aero to use your private workspace and enabled routes.";
      document.getElementById("change-count").textContent = "Preview only";
      document.getElementById("action-summary").textContent = "Your message stayed on this page.";
      previewInput.value = "";
    });
  }

  document.addEventListener("click", function (event) {
    if (modelMenu && !modelMenu.hidden && !modelMenu.contains(event.target) && !modelButton.contains(event.target)) {
      modelMenu.hidden = true;
      modelButton.setAttribute("aria-expanded", "false");
    }
  });

  document.querySelectorAll("[data-year]").forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });
})();
