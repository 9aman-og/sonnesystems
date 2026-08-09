(function () {
  "use strict";

  var STORAGE_KEY = "lyfe.connect.preview.v1";
  var SPARKS = [
    "All", "AI", "Community", "Creative tech", "Design", "Engineering",
    "Open source", "Product", "Research", "Science", "Startups", "Writing"
  ];

  /* Every profile, post, opportunity, and circle below is fictional. The
     preview demonstrates the product without pretending generated people are
     real members or sending data outside this browser. */
  var PROFILES = [
    {
      id: "mira",
      name: "Mira",
      role: "Product designer",
      city: "Bengaluru · UTC+5:30",
      initials: "MI",
      color: "#72cfe8",
      meta: "Civic technology · open to research collaborations",
      thought: "I am turning field interviews about public transport into a lightweight route-planning prototype.",
      prompt: "How might a city app help someone without asking them to learn the city’s bureaucracy first?",
      answer: "The current prototype starts with a plain-language goal, then reveals the official terms only when they become useful.",
      interests: ["Design", "Product", "Research", "Community"],
      why: "You both care about making complicated systems understandable without flattening the real problem.",
      availability: "Can offer user-research feedback · looking for a frontend collaborator"
    },
    {
      id: "noor",
      name: "Noor",
      role: "Climate data researcher",
      city: "Pune · UTC+5:30",
      initials: "NO",
      color: "#789cff",
      meta: "Open data · looking for visualization peers",
      thought: "I am cleaning a local heat-risk dataset and documenting every assumption before making a public map.",
      prompt: "What is the clearest way to show uncertainty without making the result feel useless?",
      answer: "I am testing ranges, plain-language confidence notes, and a visible record of what the data cannot support.",
      interests: ["Research", "Science", "Open source", "Writing"],
      why: "You both value honest evidence and tools that explain their limits instead of hiding them.",
      availability: "Can review data methods · needs help with accessible visual storytelling"
    },
    {
      id: "arjun",
      name: "Arjun",
      role: "Indie developer",
      city: "Mumbai · UTC+5:30",
      initials: "AR",
      color: "#9184ed",
      meta: "Creative tools · open to small experimental builds",
      thought: "I am building a collaborative story tool where every edit leaves a visible branch instead of erasing the previous idea.",
      prompt: "What is the smallest collaboration feature that would make you return to a creative tool?",
      answer: "My current bet is a thoughtful handoff: leave one question, one constraint, and one thing the next person can change freely.",
      interests: ["Creative tech", "Engineering", "Design", "Open source"],
      why: "You both like small prototypes that expose a deeper interaction question.",
      availability: "Can build browser prototypes · looking for writers and interaction designers"
    },
    {
      id: "leena",
      name: "Leena",
      role: "Neuroscience educator",
      city: "Delhi · UTC+5:30",
      initials: "LE",
      color: "#6f9ff1",
      meta: "Public learning · open to curriculum experiments",
      thought: "I am rewriting a memory lesson so someone with no science background can question the model, not just memorize it.",
      prompt: "Where does a useful simplification become a misleading one?",
      answer: "I mark every metaphor with what it explains, what it leaves out, and one observation that would challenge it.",
      interests: ["Science", "Writing", "Research", "Community"],
      why: "You both care about explaining technical ideas without assuming prior knowledge.",
      availability: "Can review learning material · looking for visual and web collaborators"
    },
    {
      id: "kabir",
      name: "Kabir",
      role: "Urban systems researcher",
      city: "Ahmedabad · UTC+5:30",
      initials: "KA",
      color: "#65b9d6",
      meta: "Public space · building a local knowledge archive",
      thought: "I am mapping ordinary street adaptations that never appear in formal planning documents.",
      prompt: "How can a community archive remain useful to the people who contributed to it?",
      answer: "Every entry should be easy to correct, downloadable, and connected to a real local decision rather than sitting as a showcase.",
      interests: ["Research", "Community", "Design", "Open source"],
      why: "You both notice how knowledge changes when the people described can edit the record.",
      availability: "Can share field methods · looking for mapping and archive experience"
    },
    {
      id: "isha",
      name: "Isha",
      role: "Ocean science communicator",
      city: "Chennai · UTC+5:30",
      initials: "IS",
      color: "#88aef5",
      meta: "Science communication · starting a coastal learning circle",
      thought: "I am pairing one local observation with one research paper and one practical question each week.",
      prompt: "What would make a research reading group useful after the meeting ends?",
      answer: "A short public note with the disagreement, the unresolved question, and who wants to test the next step.",
      interests: ["Science", "Writing", "Community", "Research"],
      why: "You both prefer communities that leave behind useful work instead of only conversation.",
      availability: "Can host monthly sessions · looking for facilitators and editors"
    }
  ];

  var POSTS = [
    {
      id: "route-notes",
      profileId: "mira",
      label: "BUILD LOG",
      title: "Three onboarding screens became one question.",
      body: "Field interviews showed that people knew what they wanted to do, but not which department owned it. The prototype now begins with the goal and delays official language.",
      tags: ["Product", "Design"],
      visual: "flow"
    },
    {
      id: "heat-map",
      profileId: "noor",
      label: "RESEARCH NOTE",
      title: "A map can look certain long before the data is.",
      body: "I am testing a legend that shows observation density beside the estimate. Looking for feedback from people who design for low-bandwidth public use.",
      tags: ["Research", "Science"],
      visual: "map"
    },
    {
      id: "branch-tool",
      profileId: "arjun",
      label: "OPEN CALL",
      title: "Need two writers to break a branching story prototype.",
      body: "One 45-minute session. The goal is to find where collaboration becomes confusing, not to produce polished writing.",
      tags: ["Creative tech", "Open source"],
      visual: "branches"
    }
  ];

  var CIRCLES = [
    { id: "responsible-ai", name: "Responsible AI builders", label: "RESEARCH + ENGINEERING", description: "Share evaluations, failure cases, interface questions, and implementation notes without turning uncertainty into hype.", prompt: "What did your latest test disprove?" },
    { id: "design-humans", name: "Design for humans", label: "PRODUCT + DESIGN", description: "Critique flows, research plans, and prototypes in plain language. Bring work that is still changeable.", prompt: "Where is the interface asking too much from the person?" },
    { id: "open-lab", name: "Open research lab", label: "SCIENCE + WRITING", description: "A reading and methods circle for making research understandable, reproducible, and useful outside a specialist audience.", prompt: "Which assumption deserves to be visible?" },
    { id: "indie-builders", name: "Indie builders", label: "ENGINEERING + CREATIVE TECH", description: "Small tools, honest build logs, sharp feedback, and collaborators who care more about usefulness than launch theatre.", prompt: "What is the smallest version that tests the real question?" }
  ];

  function applyLyfeTheme() {
    var choice = "light";
    try {
      var lyfe = JSON.parse(localStorage.getItem("lyfe.v1") || "null");
      choice = lyfe && lyfe.settings ? String(lyfe.settings.theme || "light") : "light";
    } catch (error) {}
    if (choice === "auto") {
      var hour = new Date().getHours();
      choice = hour >= 7 && hour < 18 ? "light" : "dark";
    }
    if (choice === "day") choice = "light";
    if (choice === "night") choice = "dark";
    var mode = choice === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "dark" ? "#050505" : "#edf5ff");
  }

  applyLyfeTheme();

  function syncProfileFromLyfe(target) {
    try {
      var lyfe = JSON.parse(localStorage.getItem("lyfe.v1") || "null");
      var settings = lyfe && lyfe.settings;
      if (!settings || settings.connectSync === false) return target;
      var profile = target.profile;
      if (settings.name) profile.name = String(settings.name).slice(0, 40);
      if (settings.username) profile.username = String(settings.username).slice(0, 32);
      if (settings.city || settings.country) profile.city = String(settings.city || settings.country).slice(0, 60);
      if (settings.headline) profile.headline = String(settings.headline).slice(0, 100);
      if (settings.bio) profile.bio = String(settings.bio).slice(0, 500);
      if (settings.website) profile.website = String(settings.website).slice(0, 200);
      if (Array.isArray(settings.profileInterests) && settings.profileInterests.length) {
        profile.sparks = settings.profileInterests.filter(function (x) { return SPARKS.indexOf(x) > 0; }).slice(0, 8);
      }
      if (!profile.prompt && (profile.bio || profile.headline)) profile.prompt = String(profile.bio || profile.headline).slice(0, 280);
      if (profile.name) target.onboarded = true;
    } catch (error) {}
    return target;
  }

  function defaultState() {
    return {
      version: 4,
      onboarded: false,
      paused: false,
      filter: "All",
      profile: {
        name: "",
        username: "",
        city: "",
        headline: "",
        bio: "",
        website: "",
        intent: "collaborators",
        sparks: [],
        prompt: ""
      },
      passed: [],
      saved: [],
      blocked: [],
      savedPosts: [],
      usefulPosts: [],
      myPosts: [],
      notifications: [],
      conversations: [],
      plans: [],
      circles: [],
      customCircles: [],
      circleDrafts: {},
      settings: {
        compactFeed: false,
        showMatchReasons: true,
        quietNotifications: false
      }
    };
  }

  function loadState() {
    var base = defaultState();
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!raw || typeof raw !== "object") return syncProfileFromLyfe(base);
      base.onboarded = raw.onboarded === true;
      base.paused = raw.paused === true;
      base.filter = SPARKS.indexOf(raw.filter) >= 0 ? raw.filter : "All";
      if (raw.profile && typeof raw.profile === "object") {
        base.profile.name = String(raw.profile.name || "").slice(0, 40);
        base.profile.username = String(raw.profile.username || "").slice(0, 32);
        base.profile.city = String(raw.profile.city || "").slice(0, 60);
        base.profile.headline = String(raw.profile.headline || "").slice(0, 100);
        base.profile.bio = String(raw.profile.bio || "").slice(0, 500);
        base.profile.website = String(raw.profile.website || "").slice(0, 200);
        base.profile.intent = String(raw.profile.intent || "collaborators");
        base.profile.sparks = Array.isArray(raw.profile.sparks)
          ? raw.profile.sparks.filter(function (x) { return SPARKS.indexOf(x) > 0; }).slice(0, 8)
          : [];
        base.profile.prompt = String(raw.profile.prompt || "").slice(0, 280);
      }
      ["passed", "saved", "blocked", "savedPosts", "usefulPosts", "circles"].forEach(function (key) {
        base[key] = Array.isArray(raw[key]) ? raw[key].map(String).slice(0, 100) : [];
      });
      base.conversations = Array.isArray(raw.conversations) ? raw.conversations.filter(validConversation).slice(0, 50) : [];
      base.plans = Array.isArray(raw.plans) ? raw.plans.filter(validPlan).slice(0, 100) : [];
      base.myPosts = Array.isArray(raw.myPosts) ? raw.myPosts.filter(validPost).slice(0, 80).map(function (item) {
        return {
          id: String(item.id || uid()),
          label: String(item.label || "BUILD LOG").slice(0, 30),
          title: String(item.title || "").slice(0, 140),
          body: String(item.body || "").slice(0, 900),
          tags: Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean).slice(0, 6) : [],
          visual: ["flow", "map", "branches"].indexOf(String(item.visual)) >= 0 ? String(item.visual) : "flow",
          image: /^data:image\/(?:png|jpe?g|webp);base64,/i.test(String(item.image || "")) ? String(item.image).slice(0, 2200000) : "",
          link: cleanLink(item.link),
          createdAt: Number(item.createdAt || Date.now()),
          updatedAt: Number(item.updatedAt || item.createdAt || Date.now())
        };
      }) : [];
      base.notifications = Array.isArray(raw.notifications) ? raw.notifications.filter(validNotification).slice(0, 60) : [];
      base.customCircles = Array.isArray(raw.customCircles)
        ? raw.customCircles.filter(function (item) { return item && String(item.name || "").trim(); }).slice(0, 30)
        : [];
      base.circleDrafts = raw.circleDrafts && typeof raw.circleDrafts === "object" ? raw.circleDrafts : {};
      if (raw.settings && typeof raw.settings === "object") {
        base.settings.compactFeed = raw.settings.compactFeed === true;
        base.settings.showMatchReasons = raw.settings.showMatchReasons !== false;
        base.settings.quietNotifications = raw.settings.quietNotifications === true;
      }
      return syncProfileFromLyfe(base);
    } catch (error) {
      return syncProfileFromLyfe(base);
    }
  }

  function validConversation(item) {
    return item && typeof item === "object" && profileById(item.profileId) &&
      Array.isArray(item.messages);
  }

  function validPlan(item) {
    return item && typeof item === "object" && String(item.title || "").trim();
  }

  function validPost(item) {
    return item && typeof item === "object" && String(item.title || "").trim() && String(item.body || "").trim();
  }

  function validNotification(item) {
    return item && typeof item === "object" && String(item.text || "").trim();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      toast("This browser could not save the change.");
      return false;
    }
  }

  function syncProfileToLyfe() {
    try {
      var lyfe = JSON.parse(localStorage.getItem("lyfe.v1") || "null");
      if (!lyfe || !lyfe.settings || lyfe.settings.connectSync === false) return false;
      lyfe.settings.name = state.profile.name;
      lyfe.settings.username = state.profile.username;
      lyfe.settings.city = state.profile.city;
      lyfe.settings.headline = state.profile.headline;
      lyfe.settings.bio = state.profile.bio;
      lyfe.settings.website = state.profile.website;
      lyfe.settings.profileInterests = state.profile.sparks.slice(0, 8);
      lyfe.rev = Number(lyfe.rev || 0) + 1;
      lyfe.savedAt = Date.now();
      localStorage.setItem("lyfe.v1", JSON.stringify(lyfe));
      return true;
    } catch (error) {
      return false;
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cleanLink(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    try {
      var url = new URL(raw);
      return /^(https?):$/.test(url.protocol) ? url.href.slice(0, 500) : "";
    } catch (error) {
      return "";
    }
  }

  function preparePostImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.name) { resolve(""); return; }
      if (!/^image\//.test(file.type || "") || file.size > 12 * 1024 * 1024) {
        reject(new Error("Choose an image smaller than 12 MB."));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("That image could not be read.")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("That image format is not supported.")); };
        img.onload = function () {
          var max = 1200;
          var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          var context = canvas.getContext("2d");
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/webp", .8));
        };
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function profileById(id) {
    return PROFILES.find(function (profile) { return profile.id === id; }) || null;
  }

  function ownProfile() {
    var name = String(state.profile.name || "You").trim() || "You";
    var initials = name.split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0); }).join("").toUpperCase() || "LY";
    return {
      id: "me",
      name: name,
      role: state.profile.headline || "Lyfe Connect member",
      city: state.profile.city || "Your network",
      initials: initials,
      color: "var(--accent)"
    };
  }

  function allPosts() {
    return state.myPosts.map(function (post) {
      return Object.assign({}, post, { mine: true, profileId: "me" });
    }).concat(POSTS);
  }

  function addNotification(message, kind) {
    state.notifications.unshift({
      id: uid(),
      text: String(message || "").slice(0, 240),
      kind: String(kind || "activity"),
      createdAt: Date.now(),
      read: false
    });
    state.notifications = state.notifications.slice(0, 60);
    renderNotificationCount();
  }

  function shortDate(timestamp) {
    var date = new Date(Number(timestamp) || Date.now());
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function timeAgo(timestamp) {
    var seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp || Date.now())) / 1000));
    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
    return shortDate(timestamp);
  }

  function dayKey() {
    var date = new Date();
    return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  }

  function seededNumber(text) {
    var n = 0;
    for (var i = 0; i < text.length; i += 1) n = ((n << 5) - n + text.charCodeAt(i)) | 0;
    return Math.abs(n);
  }

  function todayProfiles() {
    var ordered = PROFILES.slice().sort(function (a, b) {
      return seededNumber(dayKey() + a.id) - seededNumber(dayKey() + b.id);
    });
    var filtered = ordered.filter(function (profile) {
      var matches = state.filter === "All" || profile.interests.indexOf(state.filter) >= 0;
      return matches && state.blocked.indexOf(profile.id) < 0 && state.passed.indexOf(profile.id) < 0;
    });
    return filtered.slice(0, state.filter === "All" ? 4 : 3);
  }

  var state = loadState();
  var ui = {
    view: "discover",
    profileIndex: 0,
    activeConversation: state.conversations.length ? state.conversations[0].id : null,
    onboardingSparks: state.profile.sparks.slice(),
    returnFocus: null,
    toastTimer: null
  };

  function renderSparkControls() {
    var filterRoot = document.getElementById("spark-filters");
    filterRoot.innerHTML = SPARKS.map(function (spark) {
      return "<button class=\"spark-chip " + (state.filter === spark ? "active" : "") +
        "\" type=\"button\" data-action=\"filter\" data-spark=\"" + esc(spark) +
        "\" aria-pressed=\"" + (state.filter === spark ? "true" : "false") + "\">" + esc(spark) + "</button>";
    }).join("");

    var profileRoot = document.getElementById("profile-sparks");
    profileRoot.innerHTML = SPARKS.slice(1).map(function (spark) {
      var selected = state.profile.sparks.indexOf(spark) >= 0;
      return "<button class=\"profile-spark " + (selected ? "active" : "") +
        "\" type=\"button\" data-action=\"profile-spark\" data-spark=\"" + esc(spark) +
        "\" aria-pressed=\"" + (selected ? "true" : "false") + "\">" + esc(spark) + "</button>";
    }).join("");
  }

  function renderActiveSignals() {
    var root = document.getElementById("active-signals");
    if (!root) return;
    root.innerHTML = PROFILES.slice(0, 4).map(function (profile) {
      return [
        "<button class=\"signal-person\" type=\"button\" data-action=\"signal-profile\" data-id=\"", esc(profile.id), "\" style=\"--signal-color:", esc(profile.color), "\">",
          "<span class=\"signal-avatar\">", esc(profile.initials), "</span><span><strong>", esc(profile.name), "</strong><small>", esc(profile.role), "</small></span>",
        "</button>"
      ].join("");
    }).join("");
  }

  function currentProfile() {
    var candidates = todayProfiles();
    if (!candidates.length) return null;
    ui.profileIndex = Math.min(ui.profileIndex, candidates.length - 1);
    return candidates[ui.profileIndex] || candidates[0];
  }

  function personCard(profile) {
    var saved = state.saved.indexOf(profile.id) >= 0;
    return [
      "<article class=\"person-card\" style=\"--profile-color:", esc(profile.color), "\">",
        "<div class=\"person-top\">",
          "<div class=\"person-avatar\" aria-hidden=\"true\"><span>", esc(profile.initials), "</span></div>",
          "<div>",
            "<span class=\"sample-label\">FICTIONAL NETWORK PROFILE</span>",
            "<div class=\"person-name-row\"><h2>", esc(profile.name), "</h2><span>", esc(profile.role), "</span></div>",
            "<p class=\"person-meta\">", esc(profile.city), " · ", esc(profile.meta), "</p>",
            "<p class=\"person-thought\">", esc(profile.thought), "</p>",
          "</div>",
          "<button class=\"more-button\" type=\"button\" data-action=\"profile-menu\" aria-label=\"Safety choices for ", esc(profile.name), "\">···</button>",
        "</div>",
        "<div class=\"person-body\">",
          "<div class=\"person-prompt\">",
            "<span class=\"prompt-label\">A THOUGHT TO RESPOND TO</span>",
            "<blockquote>“", esc(profile.prompt), "”</blockquote>",
            "<p>", esc(profile.answer), "</p>",
          "</div>",
          "<aside class=\"person-side\">",
            "<span class=\"section-label\">WHY THIS INTRODUCTION MAY BE USEFUL</span>",
            "<p class=\"why-match\">", esc(profile.why), "</p>",
            "<div class=\"interest-tags\">",
              profile.interests.map(function (interest) { return "<span>" + esc(interest) + "</span>"; }).join(""),
            "</div>",
            "<div class=\"availability\"><strong>", esc(profile.availability), "</strong><span>", saved ? "Saved in your private network" : "No follower count or public activity score" , "</span></div>",
          "</aside>",
        "</div>",
      "</article>"
    ].join("");
  }

  function renderDiscover() {
    var root = document.getElementById("profile-card");
    var actions = document.getElementById("discover-actions");
    var profile = currentProfile();
    var candidates = todayProfiles();
    document.getElementById("remaining-count").textContent = String(candidates.length);
    document.getElementById("pause-label").textContent = state.paused ? "Resume introductions" : "Pause introductions";

    if (state.paused) {
      root.innerHTML = [
        "<section class=\"empty-discover\">",
          "<div><div class=\"empty-core\" aria-hidden=\"true\"></div>",
          "<p class=\"eyebrow\">DISCOVERY IS PAUSED</p>",
          "<h2>Your network can wait.</h2>",
          "<p>Your profile, saved people, drafts, workspace pages, and circles are still here. Pausing does not lower a score or hide a penalty somewhere else.</p>",
          "<button class=\"primary-button\" type=\"button\" data-action=\"resume\">Resume introductions</button></div>",
        "</section>"
      ].join("");
      actions.hidden = true;
      return;
    }

    if (!profile) {
      root.innerHTML = [
        "<section class=\"empty-discover\">",
          "<div><div class=\"empty-core\" aria-hidden=\"true\"></div>",
          "<p class=\"eyebrow\">THAT IS ENOUGH FOR TODAY</p>",
          "<h2>You reached the end of this small set.</h2>",
          "<p>Saved profiles are still in your Network view. You can also clear today’s quiet passes if you want another look.</p>",
          "<button class=\"primary-button\" type=\"button\" data-action=\"clear-passes\">Look through today again</button></div>",
        "</section>"
      ].join("");
      actions.hidden = true;
      return;
    }

    root.innerHTML = personCard(profile);
    actions.hidden = false;
    var saveButton = actions.querySelector("[data-action='save-profile'] strong");
    if (saveButton) saveButton.textContent = state.saved.indexOf(profile.id) >= 0 ? "Saved to network" : "Save to network";
  }

  function renderFeed() {
    var root = document.getElementById("feed-list");
    if (!root) return;
    root.innerHTML = allPosts().map(function (post) {
      var profile = post.mine ? ownProfile() : profileById(post.profileId);
      var saved = state.savedPosts.indexOf(post.id) >= 0;
      var useful = state.usefulPosts.indexOf(post.id) >= 0;
      return [
        "<article class=\"feed-card ", post.mine ? "my-feed-card" : "", "\">",
          "<header class=\"feed-author\"><span class=\"thread-avatar\" style=\"--thread-color:", esc(profile.color), "\">", esc(profile.initials),
          "</span><span><strong>", esc(profile.name), "</strong><small>", esc(profile.role), " · ", esc(profile.city), post.mine ? " · YOUR POST" : "", "</small></span></header>",
          post.image
            ? "<div class=\"feed-photo\"><img src=\"" + esc(post.image) + "\" alt=\"Image attached to " + esc(post.title) + "\"><span>" + esc(post.label) + "</span></div>"
            : "<div class=\"feed-visual visual-" + esc(post.visual) + "\" aria-label=\"Abstract project preview\"><i></i><i></i><i></i><span>" + esc(post.label) + "</span></div>",
          "<div class=\"feed-copy\"><p class=\"eyebrow\">", esc(post.label), "</p><h3>", esc(post.title), "</h3><p>", esc(post.body), "</p>",
          cleanLink(post.link) ? "<a class=\"post-source\" href=\"" + esc(cleanLink(post.link)) + "\" target=\"_blank\" rel=\"noopener noreferrer\">Open source ↗</a>" : "",
          "<div class=\"interest-tags\">", post.tags.map(function (tag) { return "<span>" + esc(tag) + "</span>"; }).join(""), "</div></div>",
          "<footer class=\"feed-actions\">",
            post.mine
              ? "<button type=\"button\" data-action=\"edit-post\" data-id=\"" + esc(post.id) + "\">Edit</button><button type=\"button\" data-action=\"delete-post\" data-id=\"" + esc(post.id) + "\">Delete</button><span class=\"local-post-note\">LOCAL PREVIEW</span>"
              : "<button type=\"button\" data-action=\"useful-post\" data-id=\"" + esc(post.id) + "\" class=\"" + (useful ? "active" : "") + "\">" + (useful ? "Marked useful" : "Useful") + "</button><button type=\"button\" data-action=\"save-post\" data-id=\"" + esc(post.id) + "\" class=\"" + (saved ? "active" : "") + "\">" + (saved ? "Saved" : "Save") + "</button><button type=\"button\" data-action=\"post-reply\" data-id=\"" + esc(post.id) + "\">Respond privately ↗</button>",
          "</footer>",
        "</article>"
      ].join("");
    }).join("");
  }

  function allCircles() {
    return CIRCLES.concat(state.customCircles);
  }

  function renderCircles() {
    var root = document.getElementById("circle-list");
    if (!root) return;
    root.innerHTML = allCircles().map(function (circle, index) {
      var joined = state.circles.indexOf(circle.id) >= 0;
      var drafts = Array.isArray(state.circleDrafts[circle.id]) ? state.circleDrafts[circle.id].length : 0;
      return [
        "<article class=\"circle-card\">",
          "<div class=\"circle-index\">", String(index + 1).padStart(2, "0"), "</div>",
          "<p class=\"eyebrow\">", esc(circle.label || "YOUR CIRCLE"), "</p>",
          "<h2>", esc(circle.name), "</h2>",
          "<p>", esc(circle.description), "</p>",
          "<blockquote>“", esc(circle.prompt), "”</blockquote>",
          "<div class=\"circle-status\">", joined ? "Joined in this preview" : "Focused, small, and topic-led", drafts ? " · " + drafts + " private draft" + (drafts === 1 ? "" : "s") : "", "</div>",
          "<div class=\"circle-actions\">",
            "<button type=\"button\" data-action=\"join-circle\" data-id=\"", esc(circle.id), "\" class=\"", joined ? "active" : "", "\">", joined ? "Leave circle" : "Join circle", "</button>",
            "<button type=\"button\" data-action=\"open-circle\" data-id=\"", esc(circle.id), "\">Open channel ↗</button>",
          "</div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderConnectionList() {
    var root = document.getElementById("connection-list");
    var count = state.conversations.length;
    document.getElementById("thread-total").textContent = String(count);
    document.getElementById("connection-count").textContent = String(count);
    document.getElementById("connection-count").hidden = count === 0;

    if (!count) {
      root.innerHTML = "<div class=\"empty-panel\"><div><h2>No drafts yet.</h2><p>When a detail feels worth answering, save an opening from Discover. It remains private here.</p></div></div>";
      return;
    }

    root.innerHTML = state.conversations.map(function (thread) {
      var profile = profileById(thread.profileId);
      var last = thread.messages[thread.messages.length - 1];
      return [
        "<button class=\"thread-button ", ui.activeConversation === thread.id ? "active" : "",
          "\" type=\"button\" data-action=\"thread\" data-id=\"", esc(thread.id),
          "\" style=\"--thread-color:", esc(profile.color), "\">",
          "<span class=\"thread-avatar\">", esc(profile.initials), "</span>",
          "<span class=\"thread-copy\"><strong>", esc(profile.name),
          "</strong><span>", esc(last ? last.text : "Draft started"),
          "</span><small>PRIVATE DRAFT · ", esc(shortDate(last ? last.createdAt : thread.createdAt)), "</small></span>",
        "</button>"
      ].join("");
    }).join("");
  }

  function activeThread() {
    return state.conversations.find(function (thread) { return thread.id === ui.activeConversation; }) || state.conversations[0] || null;
  }

  function renderConversationPanel() {
    var root = document.getElementById("conversation-panel");
    var thread = activeThread();
    if (!thread) {
      root.innerHTML = "<div class=\"empty-panel\"><div><h2>Begin with a detail.</h2><p>Choose a fictional preview profile in Discover and respond to something specific they wrote.</p><button class=\"primary-button\" type=\"button\" data-action=\"view\" data-view=\"discover\">Go to Discover</button></div></div>";
      return;
    }
    ui.activeConversation = thread.id;
    var profile = profileById(thread.profileId);
    var threadContext = String(thread.context || profile.prompt).replace(/\.:\s+/g, ". ");
    root.style.setProperty("--thread-color", profile.color);
    root.innerHTML = [
      "<header class=\"chat-head\">",
        "<div class=\"chat-person\"><span class=\"thread-avatar\" style=\"--thread-color:", esc(profile.color), "\">", esc(profile.initials),
        "</span><div><strong>", esc(profile.name), "</strong><span>Fictional preview · drafts only</span></div></div>",
        "<button type=\"button\" data-action=\"profile-menu\" data-profile=\"", esc(profile.id), "\">Safety ···</button>",
      "</header>",
      "<div class=\"chat-log\">",
        "<p class=\"preview-notice\">PRIVATE OUTREACH WORKSPACE · NOTHING HAS BEEN SENT</p>",
        "<div class=\"prompt-context\"><span>THE WORK YOU RESPONDED TO</span><p>", esc(threadContext), "</p></div>",
        thread.messages.map(function (message) {
          return "<div class=\"message-bubble\"><p>" + esc(message.text) +
            "</p><span>Saved " + esc(shortDate(message.createdAt)) + " · private draft</span></div>";
        }).join(""),
      "</div>",
      "<form class=\"chat-compose\" data-form=\"reply\">",
        "<input type=\"hidden\" name=\"threadId\" value=\"", esc(thread.id), "\">",
        "<textarea name=\"message\" maxlength=\"600\" rows=\"2\" placeholder=\"Add another thought to your private draft\"></textarea>",
        "<button class=\"primary-button\" type=\"submit\">Save draft</button>",
      "</form>"
    ].join("");
  }

  function lyfeUrl(plan) {
    var params = new URLSearchParams();
    params.set("connectPlan", String(plan.title || "").slice(0, 200));
    params.set("connectNote", String(plan.note || "").slice(0, 500));
    return "./index.html?" + params.toString() + "#/tasks";
  }

  function renderPlans() {
    var root = document.getElementById("plan-list");
    if (!state.plans.length) {
      root.innerHTML = [
        "<section class=\"empty-plans\"><div>",
          "<p class=\"eyebrow\">YOUR WORKSPACE IS OPEN</p><h2>Create the first useful page.</h2>",
          "<p>A brief, research note, decision log, collaborator map, or project outline is enough. Keep the work here and send only the next action into Lyfe.</p>",
          "<button class=\"primary-button\" type=\"button\" data-action=\"new-plan\">New page</button>",
        "</div></section>"
      ].join("");
      return;
    }
    root.innerHTML = state.plans.map(function (plan, index) {
      var profile = profileById(plan.profileId);
      return [
        "<article class=\"plan-card\">",
          "<div class=\"plan-card-top\"><span>PAGE ", String(index + 1).padStart(2, "0"), "</span><span>", esc(plan.when || "NO NEXT DECISION YET"), "</span></div>",
          "<h2>", esc(plan.title), "</h2>",
          "<p>", esc(plan.note || "No note yet."), "</p>",
          "<span class=\"plan-with\">", profile ? "Collaborating with " + esc(profile.name) + " · preview page" : "Personal workspace page", "</span>",
          "<div class=\"plan-actions\"><button type=\"button\" data-action=\"edit-plan\" data-id=\"", esc(plan.id), "\">Open page</button><a href=\"", esc(lyfeUrl(plan)), "\">Send action to Lyfe ↗</a>",
          "<button type=\"button\" data-action=\"delete-plan\" data-id=\"", esc(plan.id), "\">Remove</button></div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function fillProfileForm() {
    var form = document.getElementById("profile-form");
    form.elements.name.value = state.profile.name;
    form.elements.username.value = state.profile.username;
    form.elements.city.value = state.profile.city;
    form.elements.headline.value = state.profile.headline;
    form.elements.bio.value = state.profile.bio;
    form.elements.website.value = state.profile.website;
    form.elements.intent.value = state.profile.intent;
    form.elements.prompt.value = state.profile.prompt;
  }

  function renderProfilePreview() {
    var root = document.getElementById("connect-profile-preview");
    if (!root) return;
    var profile = ownProfile();
    var handle = state.profile.username ? "@" + state.profile.username : "Choose a username";
    var site = cleanLink(state.profile.website);
    root.innerHTML = [
      "<article class=\"profile-preview-card\">",
        "<div class=\"profile-preview-avatar\">", esc(profile.initials), "</div>",
        "<div class=\"profile-preview-main\"><p class=\"eyebrow\">YOUR PUBLIC-FACING PREVIEW</p><h2>", esc(profile.name), "</h2><span>", esc(handle), " · ", esc(profile.city), "</span>",
        "<h3>", esc(state.profile.headline || "Add a headline that gives people a place to begin."), "</h3><p>", esc(state.profile.bio || state.profile.prompt || "Your profile can explain what you care about, what you are working on, and where another person could genuinely help."), "</p>",
        "<div class=\"interest-tags\">", state.profile.sparks.map(function (spark) { return "<span>" + esc(spark) + "</span>"; }).join(""), "</div>",
        site ? "<a href=\"" + esc(site) + "\" target=\"_blank\" rel=\"noopener noreferrer\">Visit your website ↗</a>" : "", "</div>",
        "<dl class=\"profile-preview-stats\"><div><dt>", String(state.myPosts.length), "</dt><dd>posts</dd></div><div><dt>", String(state.saved.length), "</dt><dd>people saved</dd></div><div><dt>", String(state.plans.length), "</dt><dd>workspace pages</dd></div></dl>",
      "</article>"
    ].join("");
  }

  function renderNotificationCount() {
    var badge = document.getElementById("notification-count");
    if (!badge) return;
    var count = state.notifications.filter(function (item) { return !item.read; }).length;
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0 || state.settings.quietNotifications;
  }

  function renderNavigation() {
    document.querySelectorAll("[data-action='view']").forEach(function (button) {
      var active = button.dataset.view === ui.view;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function renderAll() {
    document.body.classList.toggle("compact-feed", state.settings.compactFeed);
    document.body.classList.toggle("hide-match-reasons", !state.settings.showMatchReasons);
    renderSparkControls();
    renderActiveSignals();
    renderDiscover();
    renderFeed();
    renderConnectionList();
    renderConversationPanel();
    renderPlans();
    renderCircles();
    fillProfileForm();
    renderProfilePreview();
    renderNotificationCount();
    renderNavigation();
  }

  function setView(view, focusMain) {
    var target = document.querySelector("[data-screen='" + view + "']");
    if (!target) return;
    ui.view = view;
    document.querySelectorAll("[data-screen]").forEach(function (screen) {
      var active = screen === target;
      screen.hidden = !active;
      screen.classList.toggle("active", active);
    });
    renderNavigation();
    if (view === "connections") {
      renderConnectionList();
      renderConversationPanel();
    }
    if (view === "plans") renderPlans();
    if (view === "circles") renderCircles();
    try { history.replaceState(null, "", "#" + view); } catch (error) {}
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (focusMain !== false) setTimeout(function () { target.focus({ preventScroll: true }); }, 250);
  }

  function toast(message) {
    var root = document.getElementById("toast-root");
    root.innerHTML = "<div class=\"toast\">" + esc(message) + "</div>";
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(function () { root.innerHTML = ""; }, 3200);
  }

  function openModal(content, wide) {
    ui.returnFocus = document.activeElement;
    document.body.classList.add("modal-open");
    document.getElementById("modal-root").innerHTML = [
      "<div class=\"modal-overlay\" data-action=\"modal-backdrop\">",
        "<section class=\"modal-card ", wide ? "wide" : "", "\" role=\"dialog\" aria-modal=\"true\">",
          content,
        "</section>",
      "</div>"
    ].join("");
    setTimeout(function () {
      var focusable = document.querySelector("#modal-root input, #modal-root textarea, #modal-root select, #modal-root button");
      if (focusable) focusable.focus();
    }, 0);
  }

  function closeModal() {
    var back = ui.returnFocus;
    ui.returnFocus = null;
    document.getElementById("modal-root").innerHTML = "";
    document.body.classList.remove("modal-open");
    if (back && back.isConnected) back.focus();
  }

  function modalHead(title, copy) {
    return [
      "<header class=\"modal-head\"><div><h2>", esc(title), "</h2><p>", esc(copy), "</p></div>",
      "<button class=\"modal-close\" type=\"button\" data-action=\"modal-close\" aria-label=\"Close\">×</button></header>"
    ].join("");
  }

  function showPostModal(post, draft) {
    var item = post || { id: "", label: "BUILD LOG", title: "", body: String(draft || ""), tags: [], visual: "flow", link: "" };
    openModal([
      modalHead(item.id ? "Edit your post." : "Share work with context.", "Connect posts are for progress, questions, useful resources, and open calls, not polished personal branding."),
      "<form class=\"modal-body\" data-form=\"post\">",
        "<input type=\"hidden\" name=\"postId\" value=\"", esc(item.id), "\">",
        "<label><span>Post type</span><select name=\"label\"><option ", item.label === "BUILD LOG" ? "selected" : "", ">BUILD LOG</option><option ", item.label === "RESEARCH NOTE" ? "selected" : "", ">RESEARCH NOTE</option><option ", item.label === "QUESTION" ? "selected" : "", ">QUESTION</option><option ", item.label === "OPEN CALL" ? "selected" : "", ">OPEN CALL</option><option ", item.label === "RESOURCE" ? "selected" : "", ">RESOURCE</option></select></label>",
        "<label><span>Title</span><input name=\"title\" maxlength=\"140\" required placeholder=\"What changed, what did you learn, or what do you need?\" value=\"", esc(item.title), "\"></label>",
        "<label><span>Context</span><textarea name=\"body\" rows=\"7\" maxlength=\"900\" required placeholder=\"Give people enough context to understand the work and respond usefully.\">", esc(item.body), "</textarea></label>",
        "<label><span>Useful link or source (optional)</span><input name=\"link\" type=\"url\" maxlength=\"500\" placeholder=\"https://…\" value=\"", esc(item.link || ""), "\"><small class=\"field-help\">Use the original paper, project, article, repository, or event page when you have one.</small></label>",
        "<label><span>Topics, separated by commas</span><input name=\"tags\" maxlength=\"160\" placeholder=\"Design, research, open source\" value=\"", esc((item.tags || []).join(", ")), "\"></label>",
        item.image ? "<div class=\"post-image-current\"><img src=\"" + esc(item.image) + "\" alt=\"Current post image\"><label class=\"inline-check\"><input type=\"checkbox\" name=\"removeImage\" value=\"yes\"><span>Remove this image</span></label></div>" : "",
        "<label><span>", item.image ? "Replace image (optional)" : "Add an image (optional)", "</span><input type=\"file\" name=\"image\" accept=\"image/*\"></label>",
        "<label><span>Visual language when there is no image</span><select name=\"visual\"><option value=\"flow\" ", item.visual === "flow" ? "selected" : "", ">Flow</option><option value=\"map\" ", item.visual === "map" ? "selected" : "", ">Map</option><option value=\"branches\" ", item.visual === "branches" ? "selected" : "", ">Branches</option></select></label>",
        "<p class=\"form-note\">This saves a post inside the private preview on this device. It is not published to a live network.</p>",
        "<div class=\"modal-actions\"><button class=\"quiet-button\" type=\"button\" data-action=\"modal-close\">Cancel</button><button class=\"primary-button\" type=\"submit\">", item.id ? "Save changes" : "Save post to preview", "</button></div>",
      "</form>"
    ].join(""), true);
  }

  function showNotifications() {
    var items = state.notifications.length ? state.notifications.map(function (item) {
      return "<article class=\"notification-item " + (!item.read ? "unread" : "") + "\"><i aria-hidden=\"true\"></i><div><p>" + esc(item.text) + "</p><span>" + esc(timeAgo(item.createdAt)) + " · " + esc(item.kind || "activity") + "</span></div></article>";
    }).join("") : "<div class=\"notification-empty\"><div class=\"empty-core\"></div><h3>Nothing needs your attention.</h3><p>Saved posts, workspace changes, circles, and private outreach activity will appear here.</p></div>";
    openModal([
      modalHead("Connect notifications", "A small, chronological inbox for useful activity, without likes, streaks, or urgency theatre."),
      "<div class=\"modal-body notification-list\">", items, "</div>",
      state.notifications.length ? "<div class=\"modal-actions\"><button class=\"quiet-button\" type=\"button\" data-action=\"clear-notifications\">Clear activity</button></div>" : ""
    ].join(""), true);
    state.notifications.forEach(function (item) { item.read = true; });
    saveState();
    renderNotificationCount();
  }

  function showSignalProfile(profile) {
    openModal([
      modalHead(profile.name, profile.role + " · " + profile.city),
      "<div class=\"modal-body signal-profile-modal\"><div class=\"signal-profile-lead\"><span class=\"signal-avatar large\" style=\"--signal-color:", esc(profile.color), "\">", esc(profile.initials), "</span><div><p>", esc(profile.thought), "</p><strong>", esc(profile.availability), "</strong></div></div>",
      "<div class=\"context-card\"><span>A USEFUL PLACE TO BEGIN</span><p>“", esc(profile.prompt), "”</p></div>",
      "<div class=\"interest-tags\">", profile.interests.map(function (interest) { return "<span>" + esc(interest) + "</span>"; }).join(""), "</div>",
      "<p class=\"form-note\">This is a clearly labelled fictional profile used to demonstrate the private preview.</p></div>",
      "<div class=\"modal-actions\"><button class=\"quiet-button\" type=\"button\" data-action=\"modal-close\">Close</button><button class=\"primary-button\" type=\"button\" data-action=\"signal-respond\" data-id=\"", esc(profile.id), "\">Respond to their work</button></div>"
    ].join(""), true);
  }

  function connectSearchItems(query) {
    var q = String(query || "").trim().toLowerCase();
    var items = [];
    function hit() { return !q || Array.prototype.some.call(arguments, function (value) { return String(value || "").toLowerCase().indexOf(q) >= 0; }); }
    PROFILES.forEach(function (profile) {
      if (hit(profile.name, profile.role, profile.city, profile.thought, profile.interests.join(" "))) items.push({ kind: "profile", id: profile.id, title: profile.name, meta: profile.role + " · person" });
    });
    allPosts().forEach(function (post) {
      if (hit(post.title, post.body, post.label, (post.tags || []).join(" "))) items.push({ kind: "post", id: post.id, title: post.title, meta: post.label.toLowerCase() + " · post" });
    });
    state.plans.forEach(function (plan) {
      if (hit(plan.title, plan.note)) items.push({ kind: "plan", id: plan.id, title: plan.title, meta: "workspace page" });
    });
    allCircles().forEach(function (circle) {
      if (hit(circle.name, circle.description, circle.prompt)) items.push({ kind: "circle", id: circle.id, title: circle.name, meta: "circle" });
    });
    return items.slice(0, 14);
  }

  function renderConnectSearch(query) {
    var root = document.getElementById("connect-search-results");
    if (!root) return;
    var items = connectSearchItems(query);
    root.innerHTML = items.length ? items.map(function (item) {
      return "<button type=\"button\" class=\"search-result\" data-action=\"search-result\" data-kind=\"" + esc(item.kind) + "\" data-id=\"" + esc(item.id) + "\"><span>" + esc(item.title) + "</span><small>" + esc(item.meta) + "</small></button>";
    }).join("") : "<div class=\"search-empty\">No people, posts, workspace pages, or circles match that search.</div>";
  }

  function showConnectSearch() {
    openModal([
      modalHead("Search Connect", "Find a person, post, useful resource, workspace page, or circle without hunting through tabs."),
      "<div class=\"modal-body connect-search\"><label><span class=\"sr-only\">Search Connect</span><input id=\"connect-search-input\" type=\"search\" autocomplete=\"off\" placeholder=\"Search people, work, resources, and rooms\"></label><div id=\"connect-search-results\" class=\"connect-search-results\"></div></div>"
    ].join(""), true);
    renderConnectSearch("");
  }

  function exportConnectData() {
    var payload = { type: "lyfe-connect-backup", version: 4, exportedAt: new Date().toISOString(), data: state };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "lyfe-connect-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 2000);
    toast("Connect backup downloaded.");
  }

  function importConnectData(input) {
    var file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || ""));
        var incoming = parsed && parsed.type === "lyfe-connect-backup" ? parsed.data : parsed;
        if (!incoming || typeof incoming !== "object" || !incoming.profile) throw new Error("invalid");
        localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
        state = loadState();
        ui.activeConversation = state.conversations.length ? state.conversations[0].id : null;
        closeModal();
        renderAll();
        toast("Connect backup restored on this device.");
      } catch (error) {
        toast("That is not a valid Lyfe Connect backup.");
      }
    };
    reader.readAsText(file);
  }

  function showConnectSettings() {
    openModal([
      modalHead("Connect settings", "Control discovery, attention, profile sharing, and local data from one place."),
      "<form class=\"modal-body connect-settings-form\" data-form=\"connect-settings\">",
        "<section class=\"connect-settings-section\"><div><span>01</span><h3>Profile & Lyfe</h3><p>Your approved profile fields can stay consistent across both products.</p></div><div><p class=\"settings-status\"><strong>", esc(state.profile.name || "Your profile"), "</strong><span>", esc(state.profile.headline || "Add a useful headline in your profile."), "</span></p><button class=\"quiet-button\" type=\"button\" data-action=\"settings-profile\">Review profile</button></div></section>",
        "<section class=\"connect-settings-section\"><div><span>02</span><h3>Discovery & attention</h3><p>Choose how much context and activity the interface puts in front of you.</p></div><div class=\"settings-checks\">",
          "<label class=\"settings-check\"><input type=\"checkbox\" name=\"compactFeed\" ", state.settings.compactFeed ? "checked" : "", "><span><strong>Compact work feed</strong><small>Show more posts with smaller previews.</small></span></label>",
          "<label class=\"settings-check\"><input type=\"checkbox\" name=\"showMatchReasons\" ", state.settings.showMatchReasons ? "checked" : "", "><span><strong>Show introduction reasons</strong><small>Explain why a person may be relevant instead of using a hidden score.</small></span></label>",
          "<label class=\"settings-check\"><input type=\"checkbox\" name=\"quietNotifications\" ", state.settings.quietNotifications ? "checked" : "", "><span><strong>Quiet notification badge</strong><small>Keep activity available without a number on the top bar.</small></span></label>",
          "<button class=\"quiet-button\" type=\"button\" data-action=\"pause-from-modal\">", state.paused ? "Resume introductions" : "Pause introductions", "</button>",
        "</div></section>",
        "<section class=\"connect-settings-section\"><div><span>03</span><h3>Data & privacy</h3><p>This preview is local-first. You can move it, inspect it, or erase it.</p></div><div><p class=\"settings-status\"><strong>Stored in this browser</strong><span>Profile, drafts, posts, circles, notifications, and workspace pages.</span></p><div class=\"settings-data-buttons\"><button class=\"quiet-button\" type=\"button\" data-action=\"export-connect\">Download backup</button><button class=\"quiet-button\" type=\"button\" data-action=\"import-connect\">Restore backup</button><button class=\"quiet-button danger-text\" type=\"button\" data-action=\"reset\">Erase preview</button></div></div></section>",
        "<div class=\"modal-actions\"><button class=\"quiet-button\" type=\"button\" data-action=\"modal-close\">Cancel</button><button class=\"primary-button\" type=\"submit\">Save settings</button></div>",
      "</form>"
    ].join(""), true);
  }

  function showDeletePostConfirm(post) {
    openModal([
      modalHead("Remove this post?", "It will be removed from this local preview. Your profile and other Connect data stay unchanged."),
      "<div class=\"context-card modal-body\"><span>YOUR POST</span><p>", esc(post.title), "</p></div>",
      "<div class=\"modal-actions\"><button class=\"quiet-button\" type=\"button\" data-action=\"modal-close\">Keep post</button><button class=\"primary-button\" type=\"button\" data-action=\"delete-post-confirm\" data-id=\"", esc(post.id), "\">Remove post</button></div>"
    ].join(""));
  }

  function showOnboarding() {
    ui.onboardingSparks = state.profile.sparks.slice();
    var chips = SPARKS.slice(1).map(function (spark) {
      var active = ui.onboardingSparks.indexOf(spark) >= 0;
      return "<button class=\"profile-spark " + (active ? "active" : "") +
        "\" type=\"button\" data-action=\"onboard-spark\" data-spark=\"" + esc(spark) +
        "\" aria-pressed=\"" + (active ? "true" : "false") + "\">" + esc(spark) + "</button>";
    }).join("");
    openModal([
      "<img class=\"onboard-mark\" src=\"../assets/lyfe_connect_mark_v2.png\" alt=\"\">",
      modalHead("Build a network around your work.", "Choose a few fields so the private preview can show useful people, posts, projects, and circles."),
      "<div class=\"onboard-steps\"><i class=\"active\"></i><i class=\"active\"></i><i></i></div>",
      "<form class=\"modal-body\" data-form=\"onboarding\">",
        "<label><span>What should we call you?</span><input name=\"name\" maxlength=\"40\" autocomplete=\"name\" placeholder=\"First name\" value=\"", esc(state.profile.name), "\"></label>",
        "<label><span>Your city or time zone (optional)</span><input name=\"city\" maxlength=\"60\" autocomplete=\"address-level2\" placeholder=\"City, region, or UTC offset\" value=\"", esc(state.profile.city), "\"></label>",
        "<label><span>Choose a few fields</span><div class=\"profile-sparks\">", chips, "</div></label>",
        "<p class=\"form-note\">This preview stores your choices in this browser. It does not create an account, publish a profile, or contact anyone.</p>",
        "<div class=\"modal-actions\"><button class=\"primary-button\" type=\"submit\">Enter the private preview</button></div>",
      "</form>"
    ].join(""), true);
  }

  function showRespond(profile, context) {
    var source = String(context || profile.prompt);
    openModal([
      modalHead("Respond to " + profile.name + "’s work.", "Lead with a useful observation, question, or concrete way to help."),
      "<form class=\"modal-body\" data-form=\"opening\">",
        "<input type=\"hidden\" name=\"profileId\" value=\"", esc(profile.id), "\">",
        "<input type=\"hidden\" name=\"context\" value=\"", esc(source), "\">",
        "<div class=\"context-card\"><span>THE WORK YOU ARE RESPONDING TO</span><p>“", esc(source), "”</p></div>",
        "<ul class=\"thinking-cues\" aria-label=\"Ways to think about your reply\">",
          "<li>Name the specific detail that made you stop.</li>",
          "<li>Offer relevant experience without turning it into a pitch.</li>",
          "<li>Ask one question that can move the work forward.</li>",
        "</ul>",
        "<label><span>Your introduction</span><textarea name=\"message\" rows=\"6\" maxlength=\"600\" placeholder=\"Write the message you would actually send\"></textarea></label>",
        "<p class=\"form-note\">Saved as a private outreach draft on this device. It is not delivered to a person.</p>",
        "<div class=\"modal-actions\"><button class=\"quiet-button\" type=\"button\" data-action=\"modal-close\">Cancel</button><button class=\"primary-button\" type=\"submit\">Save outreach draft</button></div>",
      "</form>"
    ].join(""), true);
  }

  function showProfileMenu(profile) {
    openModal([
      modalHead("Your control stays visible.", "These preview controls act immediately on this device."),
      "<div class=\"modal-body safety-list\">",
        "<div class=\"safety-item\"><span>×</span><div><h3>Hide this sample profile</h3><p>Remove ", esc(profile.name), " from Discover on this browser.</p><div class=\"safety-links\"><button class=\"quiet-button danger-text\" type=\"button\" data-action=\"block-profile\" data-profile=\"", esc(profile.id), "\">Hide profile</button></div></div></div>",
        "<div class=\"safety-item\"><span>!</span><div><h3>Report a problem with the preview</h3><p>Tell Sonne Systems about confusing, unsafe, or inappropriate product behaviour. This does not report a real person.</p><div class=\"safety-links\"><a class=\"quiet-button\" href=\"mailto:aman@sonnesystems.com?subject=Lyfe%20Connect%20preview%20safety%20feedback\">Email preview feedback</a></div></div></div>",
      "</div>"
    ].join(""));
  }

  function showSafety() {
    openModal([
      modalHead("Safety is part of the product.", "The preview keeps control close and makes its current limits explicit."),
      "<div class=\"modal-body safety-list\">",
        "<div class=\"safety-item\"><span>1</span><div><h3>Nothing is published or sent from this preview.</h3><p>Sample profiles, sample posts, and sample circles are fictional. Your own posts, outreach drafts, workspace pages, circle notes, and profile details stay in this browser unless you deliberately add a task to Lyfe.</p></div></div>",
        "<div class=\"safety-item\"><span>2</span><div><h3>Pause, hide, and erase are always available.</h3><p>There is no penalty for taking a break. Hidden profiles stay hidden, and erasing removes the local preview record.</p></div></div>",
        "<div class=\"safety-item\"><span>3</span><div><h3>A live network needs real trust operations.</h3><p>Identity and organization checks, trained moderation, scam and spam detection, reporting operations, and appeal paths must exist before public accounts launch.</p></div></div>",
        "<div class=\"safety-item\"><span>4</span><div><h3>This is not an emergency service.</h3><p>If anyone is in immediate danger, contact the appropriate local emergency service or a trusted person nearby.</p></div></div>",
        "<div class=\"safety-links\"><button class=\"quiet-button\" type=\"button\" data-action=\"pause-from-modal\">Pause introductions</button><button class=\"quiet-button danger-text\" type=\"button\" data-action=\"reset\">Erase preview data</button></div>",
      "</div>"
    ].join(""), true);
  }

  function showPlanModal(plan) {
    var page = plan || { id: "", title: "", profileId: "", when: "", note: "" };
    var options = state.conversations.map(function (thread) {
      var profile = profileById(thread.profileId);
      return "<option value=\"" + esc(profile.id) + "\" " + (page.profileId === profile.id ? "selected" : "") + ">" + esc(profile.name) + "</option>";
    }).join("");
    openModal([
      modalHead(page.id ? "Edit workspace page." : "Create a workspace page.", "Capture the brief, collaborators, next decision, and action without turning it into a heavy project system."),
      "<form class=\"modal-body\" data-form=\"plan\">",
        "<input type=\"hidden\" name=\"planId\" value=\"", esc(page.id), "\">",
        "<label><span>Page title</span><input name=\"title\" maxlength=\"200\" required placeholder=\"Accessible heat-risk map\" value=\"", esc(page.title), "\"></label>",
        "<label><span>Collaborator (optional)</span><select name=\"profileId\"><option value=\"\">Personal workspace page</option>", options, "</select></label>",
        "<label><span>Next decision or milestone</span><input name=\"when\" maxlength=\"80\" placeholder=\"Choose the public legend by Friday\" value=\"", esc(page.when), "\"></label>",
        "<label><span>Brief and working notes</span><textarea name=\"note\" rows=\"7\" maxlength=\"1200\" placeholder=\"Problem, current evidence, open questions, and the next useful action\">", esc(page.note), "</textarea></label>",
        "<p class=\"form-note\">Only the page title and note are offered to Lyfe when you choose “Add to Lyfe”.</p>",
        "<div class=\"modal-actions\"><button class=\"quiet-button\" type=\"button\" data-action=\"modal-close\">Cancel</button><button class=\"primary-button\" type=\"submit\">", page.id ? "Save changes" : "Create page", "</button></div>",
      "</form>"
    ].join(""), true);
  }

  function circleById(id) {
    return allCircles().find(function (circle) { return circle.id === id; }) || null;
  }

  function showCircle(circle) {
    var joined = state.circles.indexOf(circle.id) >= 0;
    var drafts = Array.isArray(state.circleDrafts[circle.id]) ? state.circleDrafts[circle.id] : [];
    openModal([
      modalHead(circle.name, circle.description),
      "<div class=\"modal-body\">",
        "<div class=\"context-card\"><span>THIS CIRCLE’S CURRENT QUESTION</span><p>“", esc(circle.prompt), "”</p></div>",
        "<div class=\"channel-note\"><strong>Preview channel</strong><p>This demonstrates a focused Slack-like room. No message is published and there are no fictional replies pretending to be real people.</p></div>",
        "<div class=\"channel-drafts\">",
          drafts.length ? drafts.map(function (draft) {
            return "<article><span>YOUR PRIVATE DRAFT · " + esc(shortDate(draft.createdAt)) + "</span><p>" + esc(draft.text) + "</p></article>";
          }).join("") : "<p class=\"channel-empty\">No draft contributions yet.</p>",
        "</div>",
        joined ? [
          "<form data-form=\"circle-message\">",
            "<input type=\"hidden\" name=\"circleId\" value=\"", esc(circle.id), "\">",
            "<label><span>Draft a contribution</span><textarea name=\"message\" rows=\"4\" maxlength=\"700\" placeholder=\"Share evidence, a concrete question, a useful resource, or a request for help\"></textarea></label>",
            "<p class=\"form-note\">Saved only to your browser. The live product would publish only after a clear final confirmation.</p>",
            "<div class=\"modal-actions\"><button class=\"primary-button\" type=\"submit\">Save channel draft</button></div>",
          "</form>"
        ].join("") : "<div class=\"modal-actions\"><button class=\"primary-button\" type=\"button\" data-action=\"join-circle\" data-id=\"" + esc(circle.id) + "\">Join this circle</button></div>",
      "</div>"
    ].join(""), true);
  }

  function showNewCircle() {
    openModal([
      modalHead("Start a focused circle.", "A good circle has a clear subject, a useful question, and a reason to stay small."),
      "<form class=\"modal-body\" data-form=\"new-circle\">",
        "<label><span>Circle name</span><input name=\"name\" maxlength=\"80\" required placeholder=\"Accessible data tools\"></label>",
        "<label><span>What is this room for?</span><textarea name=\"description\" rows=\"4\" maxlength=\"360\" required placeholder=\"Describe the work people bring and the kind of help they can expect.\"></textarea></label>",
        "<label><span>Opening question</span><input name=\"prompt\" maxlength=\"200\" required placeholder=\"What are you trying to make clearer this week?\"></label>",
        "<p class=\"form-note\">This creates a private local preview circle. It does not invite or notify anyone.</p>",
        "<div class=\"modal-actions\"><button class=\"quiet-button\" type=\"button\" data-action=\"modal-close\">Cancel</button><button class=\"primary-button\" type=\"submit\">Create circle</button></div>",
      "</form>"
    ].join(""), true);
  }

  function showResetConfirm() {
    openModal([
      modalHead("Erase this Connect preview?", "This removes your profile choices, passes, saved profiles and posts, outreach drafts, workspace pages, circles, and channel drafts from this browser."),
      "<div class=\"modal-actions\"><button class=\"quiet-button\" type=\"button\" data-action=\"modal-close\">Keep my data</button><button class=\"primary-button\" type=\"button\" data-action=\"reset-confirm\">Erase everything</button></div>"
    ].join(""));
  }

  function toggleInList(list, value) {
    var index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
    else list.push(value);
  }

  document.addEventListener("click", function (event) {
    var el = event.target.closest("[data-action]");
    if (!el) return;
    var action = el.dataset.action;

    if (action === "view") {
      setView(el.dataset.view);
      return;
    }
    if (action === "notifications") {
      showNotifications();
      return;
    }
    if (action === "search") {
      showConnectSearch();
      return;
    }
    if (action === "connect-settings") {
      showConnectSettings();
      return;
    }
    if (action === "export-connect") {
      exportConnectData();
      return;
    }
    if (action === "import-connect") {
      document.getElementById("connect-import-file").click();
      return;
    }
    if (action === "settings-profile") {
      closeModal();
      setView("profile");
      return;
    }
    if (action === "signal-profile") {
      var signalProfile = profileById(el.dataset.id);
      if (signalProfile) showSignalProfile(signalProfile);
      return;
    }
    if (action === "signal-respond") {
      var signalResponseProfile = profileById(el.dataset.id);
      if (signalResponseProfile) showRespond(signalResponseProfile);
      return;
    }
    if (action === "search-result") {
      var resultKind = el.dataset.kind;
      var resultId = el.dataset.id;
      if (resultKind === "profile") {
        var foundProfile = profileById(resultId);
        if (foundProfile) showSignalProfile(foundProfile);
      } else {
        closeModal();
        setView(resultKind === "plan" ? "plans" : resultKind === "circle" ? "circles" : "discover");
        setTimeout(function () {
          var target = resultKind === "post" ? document.getElementById("feed-title") : document.querySelector("[data-screen='" + (resultKind === "plan" ? "plans" : "circles") + "'] .screen-heading");
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 220);
      }
      return;
    }
    if (action === "clear-notifications") {
      state.notifications = [];
      saveState();
      closeModal();
      renderNotificationCount();
      toast("Connect activity cleared from this device.");
      return;
    }
    if (action === "new-post") {
      showPostModal();
      return;
    }
    if (action === "edit-post") {
      var editablePost = state.myPosts.find(function (post) { return post.id === el.dataset.id; });
      if (editablePost) showPostModal(editablePost);
      return;
    }
    if (action === "delete-post") {
      var removablePost = state.myPosts.find(function (post) { return post.id === el.dataset.id; });
      if (removablePost) showDeletePostConfirm(removablePost);
      return;
    }
    if (action === "delete-post-confirm") {
      state.myPosts = state.myPosts.filter(function (post) { return post.id !== el.dataset.id; });
      saveState();
      closeModal();
      renderFeed();
      toast("Post removed from the private preview.");
      return;
    }
    if (action === "filter") {
      state.filter = el.dataset.spark;
      ui.profileIndex = 0;
      saveState();
      renderSparkControls();
      renderDiscover();
      return;
    }
    if (action === "profile-spark") {
      toggleInList(state.profile.sparks, el.dataset.spark);
      state.profile.sparks = state.profile.sparks.slice(0, 8);
      saveState();
      renderSparkControls();
      return;
    }
    if (action === "onboard-spark") {
      toggleInList(ui.onboardingSparks, el.dataset.spark);
      ui.onboardingSparks = ui.onboardingSparks.slice(0, 8);
      el.classList.toggle("active", ui.onboardingSparks.indexOf(el.dataset.spark) >= 0);
      el.setAttribute("aria-pressed", el.classList.contains("active") ? "true" : "false");
      return;
    }
    if (action === "pause" || action === "resume" || action === "pause-from-modal") {
      state.paused = action === "resume" ? false : !state.paused;
      saveState();
      closeModal();
      renderDiscover();
      toast(state.paused ? "Introductions paused. Nothing is lost." : "Introductions resumed.");
      return;
    }
    if (action === "pass") {
      var passedProfile = currentProfile();
      if (!passedProfile) return;
      if (state.passed.indexOf(passedProfile.id) < 0) state.passed.push(passedProfile.id);
      ui.profileIndex = 0;
      saveState();
      renderDiscover();
      toast("Moved on quietly.");
      return;
    }
    if (action === "save-profile") {
      var savedProfile = currentProfile();
      if (!savedProfile) return;
      toggleInList(state.saved, savedProfile.id);
      saveState();
      renderDiscover();
      toast(state.saved.indexOf(savedProfile.id) >= 0 ? "Saved to your private network." : "Removed from your network.");
      return;
    }
    if (action === "respond") {
      var responseProfile = currentProfile();
      if (responseProfile) showRespond(responseProfile);
      return;
    }
    if (action === "clear-passes") {
      state.passed = [];
      ui.profileIndex = 0;
      saveState();
      renderDiscover();
      toast("Today’s profiles are available again.");
      return;
    }
    if (action === "profile-menu") {
      var menuProfile = profileById(el.dataset.profile) || currentProfile();
      if (menuProfile) showProfileMenu(menuProfile);
      return;
    }
    if (action === "block-profile") {
      var blockId = el.dataset.profile;
      if (state.blocked.indexOf(blockId) < 0) state.blocked.push(blockId);
      state.saved = state.saved.filter(function (id) { return id !== blockId; });
      saveState();
      closeModal();
      renderAll();
      toast("Profile hidden on this device.");
      return;
    }
    if (action === "save-post" || action === "useful-post") {
      var postList = action === "save-post" ? state.savedPosts : state.usefulPosts;
      toggleInList(postList, el.dataset.id);
      saveState();
      renderFeed();
      toast(action === "save-post" ? "Post saved privately." : "Marked useful for your own reference.");
      return;
    }
    if (action === "post-reply") {
      var replyPost = POSTS.find(function (post) { return post.id === el.dataset.id; });
      if (replyPost) showRespond(profileById(replyPost.profileId), replyPost.title + " " + replyPost.body);
      return;
    }
    if (action === "thread") {
      ui.activeConversation = el.dataset.id;
      renderConnectionList();
      renderConversationPanel();
      return;
    }
    if (action === "new-plan") {
      showPlanModal();
      return;
    }
    if (action === "edit-plan") {
      var editPage = state.plans.find(function (plan) { return plan.id === el.dataset.id; });
      if (editPage) showPlanModal(editPage);
      return;
    }
    if (action === "delete-plan") {
      state.plans = state.plans.filter(function (plan) { return plan.id !== el.dataset.id; });
      saveState();
      renderPlans();
      toast("Workspace page removed.");
      return;
    }
    if (action === "new-circle") {
      showNewCircle();
      return;
    }
    if (action === "join-circle") {
      toggleInList(state.circles, el.dataset.id);
      var joinedCircle = circleById(el.dataset.id);
      addNotification((state.circles.indexOf(el.dataset.id) >= 0 ? "Joined " : "Left ") + (joinedCircle ? joinedCircle.name : "a circle") + ".", "circle");
      saveState();
      closeModal();
      renderCircles();
      renderNotificationCount();
      toast(state.circles.indexOf(el.dataset.id) >= 0 ? "Circle joined in this private preview." : "You left the circle.");
      return;
    }
    if (action === "open-circle") {
      var openCircle = circleById(el.dataset.id);
      if (openCircle) showCircle(openCircle);
      return;
    }
    if (action === "safety") {
      showSafety();
      return;
    }
    if (action === "profile-privacy") {
      setView("profile");
      setTimeout(function () {
        var card = document.querySelector(".privacy-card");
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
      return;
    }
    if (action === "reset") {
      showResetConfirm();
      return;
    }
    if (action === "reset-confirm") {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
      return;
    }
    if (action === "modal-close") {
      closeModal();
      return;
    }
    if (action === "modal-backdrop" && event.target === el) closeModal();
  });

  document.addEventListener("submit", async function (event) {
    var form = event.target;
    var kind = form.dataset.form;
    if (!kind && form.id !== "profile-form") return;
    event.preventDefault();
    var data = new FormData(form);

    if (kind === "quick-post") {
      var quickDraft = String(data.get("draft") || "").trim();
      if (!quickDraft) return;
      showPostModal(null, quickDraft);
      return;
    }

    if (kind === "connect-settings") {
      state.settings.compactFeed = data.get("compactFeed") === "on";
      state.settings.showMatchReasons = data.get("showMatchReasons") === "on";
      state.settings.quietNotifications = data.get("quietNotifications") === "on";
      saveState();
      closeModal();
      renderAll();
      toast("Connect settings saved.");
      return;
    }

    if (kind === "post") {
      var postId = String(data.get("postId") || "");
      var postTitle = String(data.get("title") || "").trim();
      var postBody = String(data.get("body") || "").trim();
      if (!postTitle || !postBody) return;
      var postValues = {
        label: String(data.get("label") || "BUILD LOG").slice(0, 30),
        title: postTitle.slice(0, 140),
        body: postBody.slice(0, 900),
        link: cleanLink(data.get("link")),
        tags: String(data.get("tags") || "").split(",").map(function (tag) { return tag.trim(); }).filter(Boolean).slice(0, 6),
        visual: ["flow", "map", "branches"].indexOf(String(data.get("visual"))) >= 0 ? String(data.get("visual")) : "flow",
        image: ""
      };
      var existingPost = state.myPosts.find(function (post) { return post.id === postId; });
      postValues.image = existingPost && data.get("removeImage") !== "yes" ? String(existingPost.image || "") : "";
      var imageFile = data.get("image");
      if (imageFile && imageFile.name) {
        try { postValues.image = await preparePostImage(imageFile); }
        catch (imageError) { toast(imageError.message || "That image could not be added."); return; }
      }
      if (existingPost) Object.assign(existingPost, postValues, { updatedAt: Date.now() });
      else state.myPosts.unshift(Object.assign({ id: uid(), createdAt: Date.now() }, postValues));
      addNotification(existingPost ? "Updated your post: " + postValues.title : "Saved your new post: " + postValues.title, "post");
      saveState();
      closeModal();
      renderFeed();
      renderNotificationCount();
      setView("discover");
      document.getElementById("feed-title").scrollIntoView({ behavior: "smooth", block: "start" });
      toast(existingPost ? "Post updated in the private preview." : "Post saved to the private preview.");
      return;
    }

    if (kind === "onboarding") {
      state.profile.name = String(data.get("name") || "").trim().slice(0, 40);
      state.profile.city = String(data.get("city") || "").trim().slice(0, 60);
      state.profile.sparks = ui.onboardingSparks.slice();
      state.onboarded = true;
      saveState();
      closeModal();
      renderAll();
      toast("Your private preview is ready.");
      return;
    }

    if (kind === "opening") {
      var opening = String(data.get("message") || "").trim();
      var profileId = String(data.get("profileId") || "");
      var openingContext = String(data.get("context") || "").trim().slice(0, 900);
      if (opening.length < 12) {
        toast("Write at least one complete, specific thought.");
        form.elements.message.focus();
        return;
      }
      var thread = state.conversations.find(function (item) { return item.profileId === profileId; });
      if (!thread) {
        thread = { id: uid(), profileId: profileId, context: openingContext, createdAt: Date.now(), messages: [] };
        state.conversations.unshift(thread);
      }
      if (openingContext) thread.context = openingContext;
      thread.messages.push({ id: uid(), text: opening.slice(0, 600), createdAt: Date.now() });
      ui.activeConversation = thread.id;
      if (state.saved.indexOf(profileId) < 0) state.saved.push(profileId);
      var openingProfile = profileById(profileId);
      addNotification("Saved a private outreach draft" + (openingProfile ? " for " + openingProfile.name : "") + ".", "network");
      saveState();
      closeModal();
      renderAll();
      setView("connections");
      toast("Opening saved privately. Nothing was sent.");
      return;
    }

    if (kind === "reply") {
      var reply = String(data.get("message") || "").trim();
      var threadId = String(data.get("threadId") || "");
      var replyThread = state.conversations.find(function (item) { return item.id === threadId; });
      if (!reply || !replyThread) return;
      replyThread.messages.push({ id: uid(), text: reply.slice(0, 600), createdAt: Date.now() });
      saveState();
      renderConnectionList();
      renderConversationPanel();
      toast("Draft saved on this device.");
      return;
    }

    if (kind === "plan") {
      var title = String(data.get("title") || "").trim();
      var planId = String(data.get("planId") || "");
      if (!title) return;
      var pageValues = {
        title: title.slice(0, 200),
        profileId: String(data.get("profileId") || ""),
        when: String(data.get("when") || "").trim().slice(0, 80),
        note: String(data.get("note") || "").trim().slice(0, 1200)
      };
      var existingPage = state.plans.find(function (plan) { return plan.id === planId; });
      if (existingPage) Object.assign(existingPage, pageValues, { updatedAt: Date.now() });
      else state.plans.unshift(Object.assign({ id: uid(), createdAt: Date.now() }, pageValues));
      addNotification((existingPage ? "Updated workspace page: " : "Created workspace page: ") + pageValues.title, "workspace");
      saveState();
      closeModal();
      renderPlans();
      setView("plans");
      toast(existingPage ? "Workspace page updated." : "Workspace page created.");
      return;
    }

    if (kind === "new-circle") {
      var circleName = String(data.get("name") || "").trim();
      var circleDescription = String(data.get("description") || "").trim();
      var circlePrompt = String(data.get("prompt") || "").trim();
      if (!circleName || !circleDescription || !circlePrompt) return;
      var newCircle = {
        id: "custom-" + uid(),
        name: circleName.slice(0, 80),
        label: "YOUR PRIVATE CIRCLE",
        description: circleDescription.slice(0, 360),
        prompt: circlePrompt.slice(0, 200)
      };
      state.customCircles.unshift(newCircle);
      state.circles.push(newCircle.id);
      addNotification("Created your private circle: " + newCircle.name, "circle");
      saveState();
      closeModal();
      renderCircles();
      setView("circles");
      toast("Private preview circle created.");
      return;
    }

    if (kind === "circle-message") {
      var circleId = String(data.get("circleId") || "");
      var circleMessage = String(data.get("message") || "").trim();
      if (!circleMessage || !circleById(circleId)) return;
      if (!Array.isArray(state.circleDrafts[circleId])) state.circleDrafts[circleId] = [];
      state.circleDrafts[circleId].push({ id: uid(), text: circleMessage.slice(0, 700), createdAt: Date.now() });
      addNotification("Saved a draft in " + circleById(circleId).name + ".", "circle");
      saveState();
      var draftCircle = circleById(circleId);
      closeModal();
      renderCircles();
      showCircle(draftCircle);
      toast("Channel contribution saved privately.");
      return;
    }

    if (form.id === "profile-form") {
      state.profile.name = String(data.get("name") || "").trim().slice(0, 40);
      state.profile.username = String(data.get("username") || "").trim().replace(/^@+/, "").slice(0, 32);
      state.profile.city = String(data.get("city") || "").trim().slice(0, 60);
      state.profile.headline = String(data.get("headline") || "").trim().slice(0, 100);
      state.profile.bio = String(data.get("bio") || "").trim().slice(0, 500);
      state.profile.website = String(data.get("website") || "").trim().slice(0, 200);
      state.profile.intent = String(data.get("intent") || "collaborators");
      state.profile.prompt = String(data.get("prompt") || "").trim().slice(0, 280);
      state.onboarded = true;
      addNotification("Your Connect profile was updated.", "profile");
      saveState();
      var syncedToLyfe = syncProfileToLyfe();
      renderNotificationCount();
      renderProfilePreview();
      document.getElementById("profile-save-note").textContent = syncedToLyfe ? "Saved just now · approved fields synced to Lyfe." : "Saved just now · only on this device.";
      toast("Profile saved privately.");
    }
  });

  document.addEventListener("input", function (event) {
    if (event.target.id === "connect-search-input") renderConnectSearch(event.target.value);
  });

  document.addEventListener("change", function (event) {
    if (event.target.id === "connect-import-file") importConnectData(event.target);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && document.querySelector(".modal-overlay")) closeModal();
  });

  window.addEventListener("storage", function (event) {
    if (event.key === "lyfe.v1") {
      applyLyfeTheme();
      syncProfileFromLyfe(state);
      saveState();
      renderAll();
    }
  });

  var requestedView = location.hash.replace("#", "");
  if (document.querySelector("[data-screen='" + requestedView + "']")) ui.view = requestedView;
  setView(ui.view, false);
  renderAll();
  if (requestedView === "notifications") setTimeout(showNotifications, 180);
  else if (!state.onboarded) setTimeout(showOnboarding, 350);
})();
