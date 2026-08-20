(function () {
  "use strict";

  var SUITE_KEY = "lyfe.connect.suite.v1";
  var CORE_KEY = "lyfe.connect.preview.v1";
  var LYFE_KEY = "lyfe.v1";
  var suite;
  var authMode = "checking";
  var sessionReels = [];

  var PEOPLE = [
    { id: "mira", initials: "MI", name: "Mira Raman", handle: "@mira.designs", role: "Product designer for public services", place: "Bengaluru · UTC+5:30", skills: ["Product design", "Research", "Civic tech"], mutual: 12, open: "Open to research collaborations", color: "#3fc6d6" },
    { id: "noor", initials: "NO", name: "Noor Fatima", handle: "@noor.maps", role: "Climate data researcher", place: "Pune · UTC+5:30", skills: ["Data", "Climate", "Open source"], mutual: 8, open: "Looking for visualization peers", color: "#6f8cff" },
    { id: "arjun", initials: "AR", name: "Arjun Mehta", handle: "@arjun.builds", role: "Independent product engineer", place: "Mumbai · UTC+5:30", skills: ["Frontend", "Creative tools", "Prototyping"], mutual: 5, open: "Available for small experimental builds", color: "#8d72eb" },
    { id: "leena", initials: "LE", name: "Leena Kapoor", handle: "@leena.explains", role: "Neuroscience educator", place: "Delhi · UTC+5:30", skills: ["Learning", "Writing", "Science"], mutual: 17, open: "Seeking visual collaborators", color: "#ff7f75" },
    { id: "kabir", initials: "KA", name: "Kabir Shah", handle: "@kabir.cities", role: "Urban systems researcher", place: "Ahmedabad · UTC+5:30", skills: ["Mapping", "Archives", "Field research"], mutual: 4, open: "Can share community research methods", color: "#42b88b" },
    { id: "isha", initials: "IS", name: "Isha Nair", handle: "@isha.ocean", role: "Ocean science communicator", place: "Chennai · UTC+5:30", skills: ["Community", "Editing", "Science"], mutual: 10, open: "Starting a coastal learning circle", color: "#2d9bd6" }
  ];

  var STORIES = [
    { id: "you", name: "Your story", initials: "+", note: "Share a moment", color: "#2b5cf0" },
    { id: "mira", name: "Mira", initials: "MI", note: "Prototype walk-through", color: "#3fc6d6" },
    { id: "noor", name: "Noor", initials: "NO", note: "Field notes", color: "#6f8cff" },
    { id: "arjun", name: "Arjun", initials: "AR", note: "Build diary", color: "#8d72eb" },
    { id: "leena", name: "Leena", initials: "LE", note: "60-second explainer", color: "#ff7f75" },
    { id: "isha", name: "Isha", initials: "IS", note: "Reading circle", color: "#2d9bd6" }
  ];

  var REELS = [
    { id: "r-prototype", profileId: "mira", creator: "Mira", handle: "@mira.designs", initials: "MI", title: "One question replaced three onboarding screens", caption: "The prototype now begins with what a person is trying to do, not the name of a department.", tags: ["design", "research"], likes: 248, comments: 31, duration: "0:38", palette: "aqua" },
    { id: "r-map", profileId: "noor", creator: "Noor", handle: "@noor.maps", initials: "NO", title: "What uncertainty looks like on a public map", caption: "Observation density sits beside every estimate so confidence is visible before a decision is made.", tags: ["climate", "data"], likes: 421, comments: 54, duration: "0:52", palette: "sky" },
    { id: "r-branch", profileId: "arjun", creator: "Arjun", handle: "@arjun.builds", initials: "AR", title: "A writing tool where edits do not erase each other", caption: "Every revision leaves a branch. The next person can continue, compare, or return without losing the earlier thought.", tags: ["buildinpublic", "creativetech"], likes: 189, comments: 22, duration: "0:44", palette: "violet" },
    { id: "r-memory", profileId: "leena", creator: "Leena", handle: "@leena.explains", initials: "LE", title: "The useful limit of a memory metaphor", caption: "A metaphor should say what it explains, what it leaves out, and what observation could prove it wrong.", tags: ["science", "learning"], likes: 612, comments: 73, duration: "1:04", palette: "coral" }
  ];

  var OPPORTUNITIES = [
    { id: "o-civic", type: "PART-TIME ROLE", title: "Frontend engineer for a civic access prototype", org: "Common Route Lab", place: "Remote · India", detail: "Build an accessible route-planning pilot with a product designer and two city researchers.", skills: ["JavaScript", "Accessibility", "Maps"], posted: "2d", color: "#2b5cf0" },
    { id: "o-climate", type: "COLLABORATION", title: "Visualization partner for a heat-risk dataset", org: "Open Climate Desk", place: "Remote · 6 weeks", detail: "Turn a carefully documented local dataset into a public map that communicates uncertainty honestly.", skills: ["Data viz", "Research", "Public interest"], posted: "4d", color: "#32a67b" },
    { id: "o-stories", type: "PROJECT", title: "Writers to test a branching story tool", org: "Threadline", place: "Mumbai or remote", detail: "Two short testing sessions. Break the collaboration flow and document where it becomes confusing.", skills: ["Writing", "UX feedback", "Creative tools"], posted: "1d", color: "#8d72eb" },
    { id: "o-fellow", type: "FELLOWSHIP", title: "Open knowledge community fellow", org: "Public Memory Foundation", place: "Hybrid · Bengaluru", detail: "Support community archives, open documentation, and small tools that keep contributors in control.", skills: ["Community", "Archives", "Open source"], posted: "6d", color: "#ff7f75" }
  ];

  var EVENTS = [
    { id: "e-crit", day: "14", month: "AUG", title: "Critique without theatre", host: "Design for humans", time: "18:30 IST · 45 min" },
    { id: "e-data", day: "16", month: "AUG", title: "Showing uncertainty clearly", host: "Open research lab", time: "16:00 IST · 60 min" },
    { id: "e-build", day: "19", month: "AUG", title: "Tiny prototypes, real questions", host: "Indie builders", time: "20:00 IST · 45 min" }
  ];

  var CHANNELS = [
    { id: "general", name: "general", purpose: "Announcements, introductions, and decisions everyone should see.", unread: 2, members: 48 },
    { id: "design-critique", name: "design-critique", purpose: "Share work early enough that feedback can still change it.", unread: 5, members: 21 },
    { id: "research", name: "research", purpose: "Papers, methods, negative results, and questions worth testing.", unread: 0, members: 34 },
    { id: "build-logs", name: "build-logs", purpose: "Short progress notes, blockers, demos, and decisions.", unread: 1, members: 29 },
    { id: "random", name: "random", purpose: "Small joys, good links, and the human parts of working together.", unread: 0, members: 46 }
  ];

  var SEED_MESSAGES = {
    general: [
      { id: "g1", author: "Mira", initials: "MI", text: "I added the revised onboarding brief to the channel canvas. The open question is now right at the top.", time: "09:42", reactions: { "✓": 6, "💡": 3 } },
      { id: "g2", author: "Noor", initials: "NO", text: "Nice. I left one comment on the evidence note and pinned the decision so it does not disappear in the thread.", time: "09:55", reactions: { "✓": 4 } },
      { id: "g3", author: "Arjun", initials: "AR", text: "I can turn that into a clickable flow this afternoon. I will share a screen recording here before we make it polished.", time: "10:08", reactions: { "🚀": 5, "👀": 2 } }
    ],
    "design-critique": [
      { id: "d1", author: "Leena", initials: "LE", text: "The new card is clearer, but the secondary action still looks equally important. Could we make the next step unmistakable?", time: "Yesterday", reactions: { "💡": 4 } }
    ],
    research: [
      { id: "rs1", author: "Noor", initials: "NO", text: "Shared: three ways to label low-confidence estimates without suggesting that the map is useless.", time: "Mon", reactions: { "📌": 2 } }
    ],
    "build-logs": [], random: []
  };

  function defaults() {
    return {
      version: 2,
      rev: 0,
      homeFeed: "for-you",
      networkTab: "people",
      workspaceTab: "pages",
      profileTab: "work",
      selectedChannel: "general",
      following: ["mira", "noor"],
      connected: ["mira"],
      likedPosts: [],
      postComments: {},
      savedReels: [],
      likedReels: [],
      reelComments: {},
      savedOpportunities: [],
      appliedOpportunities: [],
      attendingEvents: [],
      joinedChannels: ["general", "design-critique", "research", "build-logs", "random"],
      customChannels: [],
      channelMessages: {},
      pinnedMessages: [],
      huddleChannel: "",
      myReels: [],
      board: {
        idea: ["Map the first-use journey", "Collect five honest questions"],
        doing: ["Prototype the profile handoff"],
        review: ["Write privacy language"],
        done: ["Choose the shared Lyfe palette"]
      },
      settings: {
        density: "comfortable",
        autoplay: true,
        showActivity: true,
        allowMessages: "connections",
        emailDigest: "weekly",
        pushMentions: true,
        profileDiscoverable: true,
        syncToLyfe: true
      }
    };
  }

  function arr(value, limit) {
    return Array.isArray(value) ? value.map(String).slice(0, limit || 200) : [];
  }

  function normalize(raw) {
    var base = defaults();
    if (!raw || typeof raw !== "object") return base;
    ["homeFeed", "networkTab", "workspaceTab", "profileTab", "selectedChannel", "huddleChannel"].forEach(function (key) {
      if (typeof raw[key] === "string") base[key] = raw[key].slice(0, 60);
    });
    ["following", "connected", "likedPosts", "savedReels", "likedReels", "savedOpportunities", "appliedOpportunities", "attendingEvents", "joinedChannels", "pinnedMessages"].forEach(function (key) {
      base[key] = arr(raw[key]);
    });
    ["postComments", "reelComments", "channelMessages"].forEach(function (key) {
      if (raw[key] && typeof raw[key] === "object") base[key] = raw[key];
    });
    if (raw.board && typeof raw.board === "object") {
      ["idea", "doing", "review", "done"].forEach(function (key) { base.board[key] = arr(raw.board[key], 80); });
    }
    base.customChannels = Array.isArray(raw.customChannels) ? raw.customChannels.slice(0, 30) : [];
    base.myReels = Array.isArray(raw.myReels) ? raw.myReels.slice(0, 20) : [];
    if (raw.settings && typeof raw.settings === "object") base.settings = Object.assign(base.settings, raw.settings);
    base.rev = Number(raw.rev || 0);
    return base;
  }

  function loadSuite() {
    try { return normalize(JSON.parse(localStorage.getItem(SUITE_KEY) || "null")); }
    catch (error) { return defaults(); }
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function has(list, id) { return list.indexOf(id) >= 0; }
  function toggle(list, id) { var at = list.indexOf(id); if (at >= 0) list.splice(at, 1); else list.push(id); }

  function coreState() {
    try { return JSON.parse(localStorage.getItem(CORE_KEY) || "null"); }
    catch (error) { return null; }
  }

  function saveSuite(message) {
    suite.rev += 1;
    try { localStorage.setItem(SUITE_KEY, JSON.stringify(suite)); } catch (error) { notify("This browser could not save that change."); }
    if (authMode === "cloud" && window.LyfeCloud && LyfeCloud.user) {
      LyfeCloud.pushConnectDebounced({ suite: suite, core: coreState() }, suite.rev);
    }
    if (message) notify(message);
  }

  function notify(message) {
    var root = document.getElementById("toast-root");
    if (!root) return;
    root.innerHTML = '<div class="toast suite-toast">' + esc(message) + '</div>';
    clearTimeout(notify.timer);
    notify.timer = setTimeout(function () { root.innerHTML = ""; }, 2600);
  }

  function modal(title, copy, body, wide) {
    var root = document.getElementById("modal-root");
    root.innerHTML = '<div class="modal-overlay suite-modal-overlay" data-suite-action="modal-backdrop">' +
      '<section class="modal-card suite-modal-card ' + (wide ? "modal-wide" : "") + '" role="dialog" aria-modal="true" aria-labelledby="suite-modal-title">' +
      '<header class="modal-head"><div><h2 id="suite-modal-title">' + esc(title) + '</h2>' + (copy ? '<p>' + esc(copy) + '</p>' : "") + '</div>' +
      '<button class="modal-close" type="button" data-suite-action="modal-close" aria-label="Close">×</button></header>' + body + '</section></div>';
    document.body.classList.add("modal-open");
    setTimeout(function () { var focus = root.querySelector("input, textarea, button"); if (focus) focus.focus(); }, 20);
  }

  function closeModal() {
    document.getElementById("modal-root").innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  function renderStories() {
    var root = document.getElementById("connect-stories");
    if (!root) return;
    root.innerHTML = '<div class="story-heading"><span>Stories</span><small>24-hour updates from people you follow</small></div><div class="story-row">' + STORIES.map(function (story) {
      return '<button class="story-card" type="button" data-suite-action="story" data-id="' + esc(story.id) + '" style="--story-color:' + esc(story.color) + '">' +
        '<span class="story-orbit"><i>' + esc(story.initials) + '</i></span><strong>' + esc(story.name) + '</strong><small>' + esc(story.note) + '</small></button>';
    }).join("") + '</div>';
  }

  function renderHomeTabs() {
    var root = document.getElementById("home-feed-tabs");
    if (!root) return;
    var tabs = [["for-you", "For you"], ["following", "Following"], ["projects", "Projects"], ["opportunities", "Opportunities"]];
    root.innerHTML = tabs.map(function (tab) {
      return '<button type="button" data-suite-action="home-feed" data-value="' + tab[0] + '" class="' + (suite.homeFeed === tab[0] ? "active" : "") + '">' + tab[1] + '</button>';
    }).join("") + '<button class="feed-tune" type="button" data-suite-action="settings">Tune feed</button>';
    document.body.dataset.homeFeed = suite.homeFeed;
  }

  function augmentFeed() {
    var cards = document.querySelectorAll("#feed-list .feed-card");
    Array.prototype.forEach.call(cards, function (card, index) {
      if (card.dataset.suiteReady) return;
      card.dataset.suiteReady = "true";
      var id = card.dataset.postId || ["route-notes", "heat-map", "branch-tool"][index] || "post-" + index;
      card.dataset.postId = id;
      var footer = card.querySelector(".feed-actions");
      if (!footer) return;
      var comments = Array.isArray(suite.postComments[id]) ? suite.postComments[id].length : 0;
      footer.insertAdjacentHTML("beforeend", '<button type="button" data-suite-action="post-comment" data-id="' + esc(id) + '">Comment' + (comments ? ' · ' + comments : '') + '</button>' +
        '<button type="button" data-suite-action="post-share" data-id="' + esc(id) + '">Share</button>');
    });
  }

  function renderReels() {
    var root = document.getElementById("reels-app");
    if (!root) return;
    var reels = sessionReels.concat(suite.myReels).concat(REELS);
    root.innerHTML = '<div class="reels-layout"><aside class="reels-note"><span class="eyebrow">YOUR CONTROL</span><h2>Instant stops when you do.</h2><p>No infinite autoplay trap. Move deliberately, turn sound on for each Instant, or save the useful part to Workspace.</p><div class="reel-key"><span>↑ ↓</span> move between Instants</div></aside>' +
      '<div class="reel-stack">' + reels.map(function (reel, index) {
        var liked = has(suite.likedReels, reel.id);
        var saved = has(suite.savedReels, reel.id);
        var commentCount = Array.isArray(suite.reelComments[reel.id]) ? suite.reelComments[reel.id].length : 0;
        var visual = reel.videoUrl ? '<video src="' + esc(reel.videoUrl) + '" muted loop playsinline controls></video>' : '<div class="reel-motion"><i></i><i></i><i></i><b>' + esc(reel.duration || "NEW") + '</b></div>';
        return '<article class="reel-card palette-' + esc(reel.palette || "aqua") + '" id="reel-' + esc(reel.id) + '"><div class="reel-media">' + visual +
          '<div class="reel-copy"><span class="reel-creator"><i>' + esc(reel.initials || "YOU") + '</i><strong>' + esc(reel.creator || "You") + '</strong><small>' + esc(reel.handle || "@you") + '</small><button type="button" data-suite-action="follow" data-id="' + esc(reel.profileId || "") + '">' + (reel.profileId && has(suite.following, reel.profileId) ? "Following" : "Follow") + '</button></span><h2>' + esc(reel.title) + '</h2><p>' + esc(reel.caption) + '</p><div class="reel-tags">' + (reel.tags || []).map(function (tag) { return '<span>#' + esc(tag) + '</span>'; }).join("") + '</div></div>' +
          '<div class="reel-actions"><button class="' + (liked ? "active" : "") + '" type="button" data-suite-action="reel-like" data-id="' + esc(reel.id) + '"><span>♥</span><small>' + ((reel.likes || 0) + (liked ? 1 : 0)) + '</small></button><button type="button" data-suite-action="reel-comment" data-id="' + esc(reel.id) + '"><span>◯</span><small>' + ((reel.comments || 0) + commentCount) + '</small></button><button class="' + (saved ? "active" : "") + '" type="button" data-suite-action="reel-save" data-id="' + esc(reel.id) + '"><span>▱</span><small>' + (saved ? "Saved" : "Save") + '</small></button><button type="button" data-suite-action="reel-share" data-id="' + esc(reel.id) + '"><span>↗</span><small>Share</small></button></div></div></article>';
      }).join("") + '</div><aside class="reels-context"><div><span class="eyebrow">AFTER WATCHING</span><h3>Keep the useful next step.</h3><p>Saved Instants appear in Workspace. You can also create a private action in Lyfe without copying the public conversation.</p><a href="./">Open Lyfe ↗</a></div></aside></div>';
  }

  function renderNetwork() {
    var root = document.getElementById("network-app");
    if (!root) return;
    var tabs = [["people", "People"], ["opportunities", "Opportunities"], ["events", "Events"], ["services", "Services"]];
    var html = '<nav class="suite-tabs network-tabs" aria-label="Network sections">' + tabs.map(function (tab) {
      return '<button class="' + (suite.networkTab === tab[0] ? "active" : "") + '" type="button" data-suite-action="network-tab" data-value="' + tab[0] + '">' + tab[1] + '</button>';
    }).join("") + '</nav>';
    if (suite.networkTab === "people") {
      html += '<div class="network-summary"><span><b>6</b> relevant people</span><span><b>' + suite.connected.length + '</b> connections</span><span><b>' + suite.following.length + '</b> following</span><button type="button" data-suite-action="edit-profile">Improve recommendations</button></div><div class="people-grid">' + PEOPLE.map(function (person) {
        var following = has(suite.following, person.id);
        var connected = has(suite.connected, person.id);
        return '<article class="network-person" style="--person-color:' + esc(person.color) + '"><header><span class="network-avatar">' + esc(person.initials) + '</span><button type="button" data-suite-action="person-menu" data-id="' + esc(person.id) + '" aria-label="More options for ' + esc(person.name) + '">···</button></header><h2>' + esc(person.name) + '</h2><span class="person-handle">' + esc(person.handle) + '</span><p class="person-role">' + esc(person.role) + '</p><small>' + esc(person.place) + '</small><div class="skill-row">' + person.skills.map(function (skill) { return '<span>' + esc(skill) + '</span>'; }).join("") + '</div><p class="person-open">' + esc(person.open) + '</p><span class="mutual">' + person.mutual + ' mutual connections</span><footer><button class="quiet-button ' + (following ? "active" : "") + '" type="button" data-suite-action="follow" data-id="' + esc(person.id) + '">' + (following ? "Following" : "Follow") + '</button><button class="primary-button" type="button" data-suite-action="connect-person" data-id="' + esc(person.id) + '">' + (connected ? "Message" : "Connect") + '</button></footer></article>';
      }).join("") + '</div>';
    } else if (suite.networkTab === "opportunities") {
      html += '<div class="opportunity-layout"><aside class="opportunity-filter"><span class="eyebrow">FILTER</span><button class="active">For you</button><button>Remote</button><button>Collaborations</button><button>Part-time</button><button>Fellowships</button><p>Recommendations use only the interests and work preferences in your Connect profile.</p></aside><div class="opportunity-list">' + OPPORTUNITIES.map(function (item) {
        var saved = has(suite.savedOpportunities, item.id);
        var applied = has(suite.appliedOpportunities, item.id);
        return '<article class="opportunity-card" style="--opportunity-color:' + esc(item.color) + '"><span class="opportunity-type">' + esc(item.type) + ' · ' + esc(item.posted) + '</span><h2>' + esc(item.title) + '</h2><strong>' + esc(item.org) + '</strong><small>' + esc(item.place) + '</small><p>' + esc(item.detail) + '</p><div class="skill-row">' + item.skills.map(function (skill) { return '<span>' + esc(skill) + '</span>'; }).join("") + '</div><footer><button class="quiet-button ' + (saved ? "active" : "") + '" type="button" data-suite-action="opportunity-save" data-id="' + esc(item.id) + '">' + (saved ? "Saved" : "Save") + '</button><button class="primary-button" type="button" data-suite-action="opportunity-apply" data-id="' + esc(item.id) + '">' + (applied ? "Application saved" : "View and apply") + '</button></footer></article>';
      }).join("") + '</div></div>';
    } else if (suite.networkTab === "events") {
      html += '<div class="event-grid">' + EVENTS.map(function (event) {
        var attending = has(suite.attendingEvents, event.id);
        return '<article class="event-card"><time><b>' + esc(event.day) + '</b><span>' + esc(event.month) + '</span></time><div><span class="eyebrow">LIVE SESSION</span><h2>' + esc(event.title) + '</h2><p>' + esc(event.host) + '</p><small>' + esc(event.time) + '</small></div><button class="' + (attending ? "active" : "") + '" type="button" data-suite-action="event-attend" data-id="' + esc(event.id) + '">' + (attending ? "Going" : "Attend") + '</button></article>';
      }).join("") + '</div>';
    } else {
      html += '<div class="service-grid"><article><span>PRODUCT</span><h2>Thoughtful product critique</h2><p>Two focused reviews for an early flow, brief, or prototype. You leave with decisions, not a performance score.</p><strong>Mira · 45 minutes</strong><button type="button" data-suite-action="service-contact">Ask about availability</button></article><article><span>RESEARCH</span><h2>Evidence and methods review</h2><p>A plain-language review of assumptions, uncertainty, and what your current evidence can actually support.</p><strong>Noor · async or call</strong><button type="button" data-suite-action="service-contact">Ask about availability</button></article><article><span>ENGINEERING</span><h2>Small browser prototype</h2><p>Turn one real interaction question into something people can use and respond to this week.</p><strong>Arjun · scoped project</strong><button type="button" data-suite-action="service-contact">Ask about availability</button></article></div>';
    }
    root.innerHTML = html;
  }

  function allChannels() { return CHANNELS.concat(suite.customChannels); }
  function selectedChannel() { return allChannels().filter(function (channel) { return channel.id === suite.selectedChannel; })[0] || allChannels()[0]; }
  function messagesFor(id) { return (SEED_MESSAGES[id] || []).concat(Array.isArray(suite.channelMessages[id]) ? suite.channelMessages[id] : []); }

  function renderChannels() {
    var root = document.getElementById("channels-app");
    if (!root) return;
    var channel = selectedChannel();
    var messages = messagesFor(channel.id);
    var huddle = suite.huddleChannel === channel.id;
    root.innerHTML = '<div class="channels-shell"><aside class="channel-rail"><div class="channel-workspace"><img src="../assets/lyfe_connect_logo.svg" alt=""><div><strong>Lyfe studio</strong><small>' + allChannels().length + ' channels · ' + (huddle ? "huddle live" : "all quiet") + '</small></div></div><div class="channel-section-title"><span>Channels</span><button type="button" data-suite-action="new-channel">+</button></div><nav>' + allChannels().map(function (item) {
      return '<button class="' + (item.id === channel.id ? "active" : "") + '" type="button" data-suite-action="channel-select" data-id="' + esc(item.id) + '"><span>#</span><strong>' + esc(item.name) + '</strong>' + (item.unread ? '<i>' + item.unread + '</i>' : '') + '</button>';
    }).join("") + '</nav><div class="channel-direct"><span>Direct messages</span>' + PEOPLE.slice(0, 4).map(function (person) { return '<button type="button" data-suite-action="connect-person" data-id="' + person.id + '"><i style="--dm:' + person.color + '">' + person.initials + '</i><strong>' + person.name.split(" ")[0] + '</strong><small>•</small></button>'; }).join("") + '</div></aside><section class="channel-main"><header><div><h2># ' + esc(channel.name) + '</h2><p>' + esc(channel.purpose) + '</p></div><div><button type="button" data-suite-action="channel-search">Search</button><button type="button" data-suite-action="channel-canvas">Canvas</button><button class="huddle-button ' + (huddle ? "live" : "") + '" type="button" data-suite-action="huddle" data-id="' + esc(channel.id) + '">' + (huddle ? "Leave huddle" : "Start huddle") + '</button><span class="member-count">' + esc(channel.members || 1) + ' people</span></div></header><div class="channel-pins"><button type="button" data-suite-action="channel-pins"><b>2</b> pinned</button><button type="button" data-suite-action="channel-files"><b>6</b> files</button><span>Canvas updated today</span></div><div class="channel-messages">' + (messages.length ? messages.map(function (message) {
      var pinned = has(suite.pinnedMessages, message.id);
      return '<article class="channel-message"><span class="message-avatar">' + esc(message.initials || "YO") + '</span><div><header><strong>' + esc(message.author) + '</strong><time>' + esc(message.time) + '</time><button type="button" data-suite-action="pin-message" data-id="' + esc(message.id) + '">' + (pinned ? "Pinned" : "Pin") + '</button></header><p>' + esc(message.text) + '</p><div class="message-reactions">' + Object.keys(message.reactions || {}).map(function (emoji) { return '<button type="button" data-suite-action="message-react" data-id="' + esc(message.id) + '" data-emoji="' + esc(emoji) + '">' + esc(emoji) + ' ' + message.reactions[emoji] + '</button>'; }).join("") + '<button type="button" data-suite-action="message-thread" data-id="' + esc(message.id) + '">Reply in thread</button></div></div></article>';
    }).join("") : '<div class="channel-empty"><h3>Start with something useful.</h3><p>Ask a question, share an update, or record a decision for the people joining later.</p></div>') + '</div><form class="channel-composer" data-suite-form="channel-message"><input type="hidden" name="channelId" value="' + esc(channel.id) + '"><div><button type="button" data-suite-action="channel-attach" aria-label="Attach a file">+</button><textarea name="message" rows="2" maxlength="1000" placeholder="Message #' + esc(channel.name) + '"></textarea><button type="button" data-suite-action="channel-emoji" aria-label="Add emoji">☺</button></div><footer><span><kbd>Enter</kbd> to send · <kbd>Shift Enter</kbd> for a new line</span><button class="primary-button" type="submit">Send</button></footer></form></section><aside class="channel-context"><span class="eyebrow">CHANNEL CANVAS</span><h2>What this room is doing</h2><p>' + esc(channel.purpose) + '</p><div class="canvas-block"><small>CURRENT DECISION</small><strong>Keep public profiles useful and private Lyfe context separate.</strong></div><div class="canvas-block"><small>NEXT REVIEW</small><strong>Friday · 16:00 IST</strong></div><button type="button" data-suite-action="channel-canvas">Open canvas</button></aside></div>';
  }

  function renderWorkspace() {
    var root = document.getElementById("workspace-suite");
    if (!root) return;
    var tabs = [["pages", "Pages"], ["projects", "Projects"], ["calendar", "Calendar"], ["saved", "Saved"]];
    var html = '<nav class="suite-tabs workspace-tabs">' + tabs.map(function (tab) { return '<button class="' + (suite.workspaceTab === tab[0] ? "active" : "") + '" type="button" data-suite-action="workspace-tab" data-value="' + tab[0] + '">' + tab[1] + '</button>'; }).join("") + '</nav>';
    if (suite.workspaceTab === "pages") {
      html += '<div class="workspace-overview"><article class="workspace-feature"><span>TEAM WIKI</span><h2>Start here</h2><p>Purpose, people, links, vocabulary, and the decisions a new collaborator needs before opening chat.</p><button type="button" data-action="new-plan">Open as a page</button></article><article><span>MEETING NOTES</span><h3>Weekly product review</h3><p>Agenda, notes, decisions, and owners in one reusable page.</p><button type="button" data-action="new-plan">Use template</button></article><article><span>RESEARCH HUB</span><h3>Evidence library</h3><p>Papers, interviews, open questions, and negative results organized by claim.</p><button type="button" data-action="new-plan">Use template</button></article></div>';
    } else if (suite.workspaceTab === "projects") {
      html += '<div class="board">' + [["idea", "Ideas"], ["doing", "In progress"], ["review", "Review"], ["done", "Done"]].map(function (column) { return '<section class="board-column"><header><strong>' + column[1] + '</strong><span>' + suite.board[column[0]].length + '</span></header><div>' + suite.board[column[0]].map(function (card) { return '<article><p>' + esc(card) + '</p><footer><span>Connect</span><button type="button" data-suite-action="board-move" data-column="' + column[0] + '" data-title="' + esc(card) + '">Move →</button></footer></article>'; }).join("") + '</div><button type="button" data-suite-action="board-add" data-column="' + column[0] + '">+ Add item</button></section>'; }).join("") + '</div>';
    } else if (suite.workspaceTab === "calendar") {
      html += '<div class="workspace-calendar"><div class="calendar-days">' + ["MON 10", "TUE 11", "WED 12", "THU 13", "FRI 14"].map(function (day, index) { return '<section><strong>' + day + '</strong>' + (index === 1 ? '<article class="cal-blue"><span>10:00</span><b>Prototype review</b><small>#design-critique</small></article>' : '') + (index === 3 ? '<article class="cal-green"><span>16:00</span><b>Research huddle</b><small>#research</small></article>' : '') + (index === 4 ? '<article class="cal-coral"><span>18:30</span><b>Critique without theatre</b><small>Connect event</small></article>' : '') + '</section>'; }).join("") + '</div><a class="lyfe-calendar-link" href="./">Open your private schedule in Lyfe ↗</a></div>';
    } else {
      var savedReels = REELS.filter(function (reel) { return has(suite.savedReels, reel.id); });
      var savedOpps = OPPORTUNITIES.filter(function (item) { return has(suite.savedOpportunities, item.id); });
      html += '<div class="workspace-saved"><div class="saved-summary"><span><b>' + suite.savedReels.length + '</b> Instants</span><span><b>' + suite.savedOpportunities.length + '</b> opportunities</span><span><b>' + suite.pinnedMessages.length + '</b> pinned messages</span><a href="./#library">Open private Library in Lyfe ↗</a></div><div class="saved-grid">' + savedReels.map(function (reel) { return '<article><span>INSTANT</span><h3>' + esc(reel.title) + '</h3><p>' + esc(reel.creator) + '</p><button type="button" data-suite-action="save-to-lyfe" data-kind="reel" data-id="' + esc(reel.id) + '">Save to Lyfe Library</button></article>'; }).join("") + savedOpps.map(function (item) { return '<article><span>OPPORTUNITY</span><h3>' + esc(item.title) + '</h3><p>' + esc(item.org) + '</p><button type="button" data-suite-action="save-to-lyfe" data-kind="opportunity" data-id="' + esc(item.id) + '">Save to Lyfe Library</button></article>'; }).join("") + (!savedReels.length && !savedOpps.length ? '<div class="saved-empty"><h3>Useful things can wait here.</h3><p>Save an Instant, opportunity, post, file, or message without turning it into a task.</p></div>' : '') + '</div></div>';
    }
    root.innerHTML = html;
    var plans = document.getElementById("plan-list");
    if (plans) plans.hidden = suite.workspaceTab !== "pages";
  }

  function renderProfessionalProfile() {
    var root = document.getElementById("profile-professional-suite");
    if (!root) return;
    var core = coreState() || {};
    var profile = core.profile || {};
    var tabs = [["work", "Work"], ["about", "About"], ["experience", "Experience"], ["skills", "Skills"], ["activity", "Activity"]];
    var content = "";
    if (suite.profileTab === "work") content = '<div class="profile-showcase"><article class="showcase-large"><span>FEATURED PROJECT</span><h3>' + esc(profile.prompt || "Share one concrete project so the right people know where to begin.") + '</h3><p>Pin a project, paper, Instant, portfolio link, or open question here.</p><button type="button" data-action="new-post">Add featured work</button></article><article><span>OPEN TO</span><h3>' + esc(profile.intent || "Collaborators and useful conversations") + '</h3><p>Your availability is visible without exposing your private Lyfe plans.</p></article></div>';
    else if (suite.profileTab === "about") content = '<div class="profile-detail-copy"><h3>About</h3><p>' + esc(profile.bio || "Write a few genuine lines about what you care about, what you are learning, and where another person could help.") + '</p><div class="profile-facts"><span>' + esc(profile.city || "Add your city or time zone") + '</span><span>' + esc(profile.website || "Add a portfolio or website") + '</span></div></div>';
    else if (suite.profileTab === "experience") content = '<div class="timeline"><article><i></i><div><span>CURRENT</span><h3>Add your current work</h3><p>Role, independent practice, research, study, caregiving, or a project can all belong here.</p></div><button type="button" data-suite-action="profile-edit-section">Add</button></article><article><i></i><div><span>EARLIER</span><h3>Show the path, not just titles</h3><p>Explain what changed in how you think or work.</p></div><button type="button" data-suite-action="profile-edit-section">Add</button></article></div>';
    else if (suite.profileTab === "skills") content = '<div class="profile-skills">' + (profile.sparks || ["Design", "Research", "Engineering"]).map(function (skill, index) { return '<article><strong>' + esc(skill) + '</strong><span>' + (index * 3 + 4) + ' people can speak to this</span><button type="button" data-suite-action="endorse-skill">Ask for context</button></article>'; }).join("") + '</div>';
    else content = '<div class="activity-grid"><article><span>POSTS</span><b>' + ((core.myPosts || []).length) + '</b><p>Build logs, questions, and work shared with context.</p></article><article><span>CONNECTIONS</span><b>' + suite.connected.length + '</b><p>People you chose to keep in your working network.</p></article><article><span>CONTRIBUTIONS</span><b>' + suite.pinnedMessages.length + '</b><p>Useful channel messages and decisions you pinned.</p></article></div>';
    root.innerHTML = '<nav class="profile-section-tabs">' + tabs.map(function (tab) { return '<button class="' + (suite.profileTab === tab[0] ? "active" : "") + '" type="button" data-suite-action="profile-tab" data-value="' + tab[0] + '">' + tab[1] + '</button>'; }).join("") + '</nav><div class="profile-section-body">' + content + '</div>';
  }

  function showStory(id) {
    if (id === "you") {
      modal("Share a story", "A story is visible for 24 hours in a real connected account.", '<form data-suite-form="story"><label><span>What is happening?</span><textarea name="story" rows="5" maxlength="400" required placeholder="A quick update, question, photo note, or invitation…"></textarea></label><div class="suite-form-actions"><button class="quiet-button" type="button" data-suite-action="modal-close">Cancel</button><button class="primary-button" type="submit">Share story</button></div></form>');
      return;
    }
    var story = STORIES.filter(function (item) { return item.id === id; })[0];
    var person = PEOPLE.filter(function (item) { return item.id === id; })[0];
    if (!story) return;
    modal(story.name + " · story", story.note, '<div class="story-view" data-id="' + esc(id) + '" style="--story-color:' + esc(story.color) + '"><span class="story-view-avatar">' + esc(story.initials) + '</span><p>' + esc(person ? person.open : "A small update shared with your network.") + '</p><div><button class="quiet-button" type="button" data-suite-action="story-reply" data-id="' + esc(id) + '">Reply privately</button><button class="primary-button" type="button" data-suite-action="story-next">Next story</button></div></div>');
  }

  function showComment(kind, id) {
    var store = kind === "reel" ? suite.reelComments : suite.postComments;
    var comments = Array.isArray(store[id]) ? store[id] : [];
    modal("Conversation", "Respond to the work, not the audience.", '<div class="suite-comments">' + (comments.length ? comments.map(function (comment) { return '<article><span>YOU</span><p>' + esc(comment.text) + '</p><small>' + esc(comment.time) + '</small></article>'; }).join("") : '<p class="comment-empty">No comments saved on this account yet.</p>') + '</div><form data-suite-form="comment"><input type="hidden" name="kind" value="' + esc(kind) + '"><input type="hidden" name="itemId" value="' + esc(id) + '"><label><span>Add a thoughtful response</span><textarea name="comment" rows="4" maxlength="600" required placeholder="What did you notice, learn, or want to ask?"></textarea></label><div class="suite-form-actions"><button class="quiet-button" type="button" data-suite-action="modal-close">Cancel</button><button class="primary-button" type="submit">Comment</button></div></form>');
  }

  function showNewReel() {
    modal("Create an Instant", "Upload a short video and keep enough text for someone to understand why it matters.", '<form data-suite-form="reel"><label><span>Video</span><input type="file" name="video" accept="video/*" required></label><label><span>Title</span><input name="title" maxlength="120" required placeholder="What should someone understand before watching?"></label><label><span>Context</span><textarea name="caption" rows="4" maxlength="600" required placeholder="What are we seeing, and what kind of response would help?"></textarea></label><label><span>Topics</span><input name="tags" maxlength="100" placeholder="design, research, build log"></label><div class="upload-note">The video stays in this open session until media storage is enabled. Its text and save state can sync to your account.</div><div class="suite-form-actions"><button class="quiet-button" type="button" data-suite-action="modal-close">Cancel</button><button class="primary-button" type="submit">Preview Instant</button></div></form>', true);
  }

  function showAuth() {
    if (authMode === "cloud" && window.LyfeCloud && LyfeCloud.user) {
      var user = LyfeCloud.user;
      modal("Your Lyfe account", "One identity for the ecosystem. Lyfe and Connect keep separate data spaces.", '<div class="account-panel"><span class="account-avatar">' + esc((user.name || user.email || "Y").slice(0, 2).toUpperCase()) + '</span><div><strong>' + esc(user.name || "Your account") + '</strong><small>' + esc(user.email || "Signed in with Google") + '</small></div></div><div class="account-separation"><article><span>LYFE</span><p>Private tasks, notes, goals, tracking, library, Gmail saves, and Aero context.</p></article><article><span>CONNECT</span><p>Profile, posts, Instants, network, messages, channels, and shared workspace.</p></article></div><div class="suite-form-actions"><button class="quiet-button" type="button" data-suite-action="sign-out">Sign out</button><button class="primary-button" type="button" data-suite-action="modal-close">Done</button></div>');
      return;
    }
    var unavailable = authMode === "unconfigured" ? '<p class="auth-unavailable">Cloud sign-in is not connected on this deployment yet. Guest mode remains available without losing the interface.</p>' : "";
    var googleChoice = '<button class="google-signin" type="button" data-suite-action="google-sign-in"><span class="google-g">G</span>Continue with Google / Gmail</button><div class="auth-divider"><span>or use email</span></div>';
    var callbackError = window.LyfeCloud && LyfeCloud.lastError ? LyfeCloud.lastError : "";
    modal("Sign in to Lyfe Connect", "Use the same account as Lyfe, while keeping the two products separate.", '<div class="suite-auth">' + unavailable + '<p class="auth-unavailable" data-suite-auth-error role="alert" ' + (callbackError ? "" : "hidden") + '>' + esc(callbackError) + '</p>' + googleChoice + '<form data-suite-form="email-auth"><label><span>Email address</span><input type="email" name="email" autocomplete="email" required placeholder="you@example.com" ' + (authMode === "unconfigured" ? "disabled" : "") + '></label><button class="primary-button" type="submit" ' + (authMode === "unconfigured" ? "disabled" : "") + '>Send sign-in code</button></form><button class="guest-signin" type="button" data-suite-action="guest-sign-in">Continue on this device</button><p>Your account syncs private state through row-level protected storage. Connect never reads your Lyfe tasks, notes, Gmail, or Aero conversations.</p></div>');
  }

  function showAuthError(message) {
    var error = document.querySelector("[data-suite-auth-error]");
    if (error) { error.textContent = String(message || ""); error.hidden = !message; }
    if (message) notify(message);
  }

  function showEmailOtp(email) {
    modal("Enter your sign-in code", "We sent a six-digit code to " + email + ".", '<form data-suite-form="email-otp-verify"><input type="hidden" name="email" value="' + esc(email) + '"><label><span>Six-digit code</span><input type="text" name="token" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus placeholder="000000"></label><div class="suite-form-actions"><button class="quiet-button" type="button" data-suite-action="auth">Use another email</button><button class="primary-button" type="submit">Verify code</button></div></form>');
  }

  function showSettings() {
    var s = suite.settings;
    modal("Connect settings", "Control identity, attention, privacy, notifications, integrations, and your data.", '<form data-suite-form="settings" class="suite-settings"><nav><button class="active" type="button">Account</button><button type="button">Appearance</button><button type="button">Privacy</button><button type="button">Notifications</button><button type="button">Integrations</button><button type="button">Data</button></nav><div><section><span class="settings-number">01 · ACCOUNT</span><h3>Identity across the ecosystem</h3><p>Lyfe and Connect share sign-in and only the profile fields you approve.</p><button class="settings-account-row" type="button" data-suite-action="auth"><strong>' + (authMode === "cloud" ? "Signed in" : "Sign in or create an account") + '</strong><small>' + (authMode === "cloud" && LyfeCloud.user ? esc(LyfeCloud.user.email) : "Google / Gmail or secure email link") + '</small></button></section><section><span class="settings-number">02 · EXPERIENCE</span><h3>Make the interface work for you</h3><div class="settings-grid"><label><span>Feed density</span><select name="density"><option value="comfortable" ' + (s.density === "comfortable" ? "selected" : "") + '>Comfortable</option><option value="compact" ' + (s.density === "compact" ? "selected" : "") + '>Compact</option></select></label><label class="settings-toggle"><input type="checkbox" name="autoplay" ' + (s.autoplay ? "checked" : "") + '><span><strong>Autoplay reels</strong><small>Reels still stop when you leave the view.</small></span></label></div></section><section><span class="settings-number">03 · PRIVACY</span><h3>Choose what other people can do</h3><div class="settings-grid"><label><span>Who can message you?</span><select name="allowMessages"><option value="connections" ' + (s.allowMessages === "connections" ? "selected" : "") + '>Connections</option><option value="everyone" ' + (s.allowMessages === "everyone" ? "selected" : "") + '>Everyone</option><option value="nobody" ' + (s.allowMessages === "nobody" ? "selected" : "") + '>Nobody</option></select></label><label class="settings-toggle"><input type="checkbox" name="discoverable" ' + (s.profileDiscoverable ? "checked" : "") + '><span><strong>Discoverable profile</strong><small>Let relevant people find you through shared work.</small></span></label><label class="settings-toggle"><input type="checkbox" name="activity" ' + (s.showActivity ? "checked" : "") + '><span><strong>Show active status</strong><small>Never includes your private Lyfe activity.</small></span></label></div></section><section><span class="settings-number">04 · NOTIFICATIONS</span><h3>Fewer, more useful interruptions</h3><div class="settings-grid"><label><span>Email digest</span><select name="emailDigest"><option value="off" ' + (s.emailDigest === "off" ? "selected" : "") + '>Off</option><option value="weekly" ' + (s.emailDigest === "weekly" ? "selected" : "") + '>Weekly</option><option value="daily" ' + (s.emailDigest === "daily" ? "selected" : "") + '>Daily</option></select></label><label class="settings-toggle"><input type="checkbox" name="pushMentions" ' + (s.pushMentions ? "checked" : "") + '><span><strong>Mentions and direct replies</strong><small>High-signal notifications only.</small></span></label></div></section><section><span class="settings-number">05 · INTEGRATIONS</span><h3>Pass only what you approve</h3><label class="settings-toggle"><input type="checkbox" name="syncToLyfe" ' + (s.syncToLyfe ? "checked" : "") + '><span><strong>Lyfe handoffs</strong><small>Allow explicit saves and actions to move into your private Lyfe space.</small></span></label><a class="settings-link" href="./">Manage Gmail, imports, exports, and Lyfe integrations ↗</a></section><div class="suite-form-actions"><button class="quiet-button" type="button" data-suite-action="export-data">Export Connect data</button><button class="primary-button" type="submit">Save settings</button></div></div></form>', true);
    document.querySelectorAll(".suite-settings strong, .suite-settings small").forEach(function (node) {
      node.textContent = node.textContent
        .replace("Autoplay reels", "Autoplay Instants")
        .replace("Reels still", "Instants still")
        .replace("Google / Gmail or secure email link", "Google or email sign-in code");
    });
  }

  function renderAccountButton() {
    var button = document.getElementById("connect-account-button");
    if (!button) return;
    if (authMode === "cloud" && window.LyfeCloud && LyfeCloud.user) {
      var name = LyfeCloud.user.name || LyfeCloud.user.email || "You";
      button.innerHTML = '<i>' + esc(name.slice(0, 2).toUpperCase()) + '</i><span>' + esc(name.split(" ")[0]) + '</span>';
      button.setAttribute("aria-label", "Open account for " + name);
    } else {
      button.innerHTML = '<span>Sign in</span>';
      button.setAttribute("aria-label", "Sign in to Lyfe Connect");
    }
  }

  async function addToLyfe(kind, id) {
    if (!suite.settings.syncToLyfe) { notify("Enable Lyfe handoffs in Connect settings first."); return; }
    var item = kind === "reel" ? REELS.filter(function (reel) { return reel.id === id; })[0] : OPPORTUNITIES.filter(function (opportunity) { return opportunity.id === id; })[0];
    if (!item) return;
    try {
      var signedIn = authMode === "cloud" && window.LyfeCloud && LyfeCloud.user;
      var localKey = signedIn ? "lyfe.cloud." + LyfeCloud.user.id : LYFE_KEY;
      var lyfe = null;
      if (signedIn) {
        try {
          var remote = await LyfeCloud.pull();
          if (remote && remote.data) lyfe = remote.data;
        } catch (cloudError) { /* fall back to the signed-in device cache */ }
      }
      if (!lyfe) lyfe = JSON.parse(localStorage.getItem(localKey) || "null");
      if (!lyfe || typeof lyfe !== "object") { notify("Open Lyfe once before saving to its Library."); return; }
      if (!Array.isArray(lyfe.saved)) lyfe.saved = [];
      if (!lyfe.saved.some(function (entry) { return entry.sourceId === id; })) {
        lyfe.saved.unshift({ id: uid(), source: "Lyfe Connect", sourceId: id, kind: kind, title: item.title, body: item.caption || item.detail || "", savedAt: Date.now() });
      }
      lyfe.rev = Number(lyfe.rev || 0) + 1;
      lyfe.savedAt = Date.now();
      localStorage.setItem(localKey, JSON.stringify(lyfe));
      if (signedIn) await LyfeCloud.push(lyfe, lyfe.rev);
      notify("Saved to Lyfe Library.");
    } catch (error) { notify("Lyfe could not save that item on this device."); }
  }

  function exportData() {
    var blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), suite: suite, core: coreState() }, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url; link.download = "lyfe-connect-backup.json"; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function shareItem(label) {
    var data = { title: "Lyfe Connect", text: label || "Shared from Lyfe Connect", url: location.href };
    if (navigator.share) navigator.share(data).catch(function () {});
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(function () { notify("Link copied."); }).catch(function () { notify("Use your browser's address bar to copy the link."); });
    else notify("Use your browser's address bar to copy the link.");
  }

  function findPerson(id) { return PEOPLE.filter(function (person) { return person.id === id; })[0]; }
  function findReel(id) { return sessionReels.concat(suite.myReels).concat(REELS).filter(function (reel) { return reel.id === id; })[0]; }

  function renderAllSuite() {
    renderStories(); renderHomeTabs(); renderReels(); renderNetwork(); renderChannels(); renderWorkspace(); renderProfessionalProfile(); renderAccountButton();
    setTimeout(augmentFeed, 0);
  }

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-suite-action]");
    if (!target) return;
    var action = target.dataset.suiteAction;
    if (action === "modal-close") { closeModal(); return; }
    if (action === "modal-backdrop" && event.target === target) { closeModal(); return; }
    if (action === "auth") { showAuth(); return; }
    if (action === "settings") { showSettings(); return; }
    if (action === "guest-sign-in") { closeModal(); notify("Continuing on this device. Sign in anytime to sync."); return; }
    if (action === "google-sign-in") {
      if (!window.LyfeCloud || !LyfeCloud.configured) { notify("Cloud sign-in is not connected yet."); return; }
      target.disabled = true;
      var originalGoogle = target.innerHTML;
      target.textContent = "Opening Google...";
      showAuthError("");
      LyfeCloud.signInGoogle().catch(function (error) {
        target.disabled = false;
        target.innerHTML = originalGoogle;
        showAuthError(error && error.message ? error.message : "Google sign-in could not start. Try the email code instead.");
      });
      return;
    }
    if (action === "sign-out") {
      if (window.LyfeCloud) LyfeCloud.signOut().finally(function () { authMode = "gate"; closeModal(); renderAccountButton(); notify("Signed out of Lyfe and Connect."); });
      return;
    }
    if (action === "home-feed") {
      suite.homeFeed = target.dataset.value;
      saveSuite(); renderHomeTabs();
      if (suite.homeFeed === "opportunities") { document.querySelector('[data-action="view"][data-view="network"]').click(); suite.networkTab = "opportunities"; saveSuite(); renderNetwork(); }
      return;
    }
    if (action === "story") { showStory(target.dataset.id); return; }
    if (action === "story-reply") { closeModal(); document.querySelector('[data-action="view"][data-view="connections"]').click(); notify("Opened Messages. Choose the person to continue privately."); return; }
    if (action === "story-next") { var current = STORIES.findIndex(function (story) { return story.id === target.closest(".story-view").dataset.id; }); closeModal(); showStory(STORIES[(current + 1) % STORIES.length].id); return; }
    if (action === "post-comment") { showComment("post", target.dataset.id); return; }
    if (action === "post-share") { shareItem("A post from Lyfe Connect"); return; }
    if (action === "new-reel") { showNewReel(); return; }
    if (action === "reel-like") { toggle(suite.likedReels, target.dataset.id); saveSuite(); renderReels(); return; }
    if (action === "reel-save") { toggle(suite.savedReels, target.dataset.id); saveSuite(has(suite.savedReels, target.dataset.id) ? "Saved to Workspace." : "Removed from saved."); renderReels(); renderWorkspace(); return; }
    if (action === "reel-comment") { showComment("reel", target.dataset.id); return; }
    if (action === "reel-share") { var reel = findReel(target.dataset.id); shareItem(reel ? reel.title : "An Instant from Lyfe Connect"); return; }
    if (action === "network-tab") { suite.networkTab = target.dataset.value; saveSuite(); renderNetwork(); return; }
    if (action === "open-network-search") { modal("Find people", "Search by name, work, skill, place, or what someone is open to.", '<form data-suite-form="network-search"><label><span>Search the network</span><input name="query" required autofocus placeholder="Try research, Bengaluru, accessibility…"></label><div class="suite-form-actions"><button class="quiet-button" type="button" data-suite-action="modal-close">Cancel</button><button class="primary-button" type="submit">Search</button></div></form>'); return; }
    if (action === "follow") { var followId = target.dataset.id; if (!followId) { notify("That profile is not available."); return; } toggle(suite.following, followId); saveSuite(has(suite.following, followId) ? "Following." : "Unfollowed."); renderNetwork(); renderReels(); document.dispatchEvent(new CustomEvent("lyfeconnect:relationships")); return; }
    if (action === "connect-person") {
      var person = findPerson(target.dataset.id); if (!person) return;
      if (has(suite.connected, person.id)) { document.querySelector('[data-action="view"][data-view="connections"]').click(); notify("Opened your private message drafts."); }
      else { toggle(suite.connected, person.id); saveSuite("Added to your network. You can add a personal note before sending."); renderNetwork(); document.dispatchEvent(new CustomEvent("lyfeconnect:relationships")); }
      return;
    }
    if (action === "opportunity-save") { toggle(suite.savedOpportunities, target.dataset.id); saveSuite(has(suite.savedOpportunities, target.dataset.id) ? "Saved to Workspace." : "Removed from saved."); renderNetwork(); renderWorkspace(); return; }
    if (action === "opportunity-apply") { var opportunity = OPPORTUNITIES.filter(function (item) { return item.id === target.dataset.id; })[0]; if (!opportunity) return; modal(opportunity.title, opportunity.org + " · " + opportunity.place, '<div class="opportunity-detail"><p>' + esc(opportunity.detail) + '</p><div class="skill-row">' + opportunity.skills.map(function (skill) { return '<span>' + esc(skill) + '</span>'; }).join("") + '</div><h3>Before you apply</h3><p>Connect will use only your public profile and anything you explicitly add. Your private Lyfe data is never attached.</p><button class="primary-button" type="button" data-suite-action="application-save" data-id="' + esc(opportunity.id) + '">' + (has(suite.appliedOpportunities, opportunity.id) ? "Application saved" : "Save an application draft") + '</button></div>'); return; }
    if (action === "application-save") { if (!has(suite.appliedOpportunities, target.dataset.id)) suite.appliedOpportunities.push(target.dataset.id); saveSuite("Application draft saved privately."); closeModal(); renderNetwork(); return; }
    if (action === "event-attend") { toggle(suite.attendingEvents, target.dataset.id); saveSuite(has(suite.attendingEvents, target.dataset.id) ? "Added to your Connect calendar." : "Removed from your calendar."); renderNetwork(); return; }
    if (action === "service-contact") { notify("Availability request saved as a private draft."); return; }
    if (action === "edit-profile") { document.querySelector('[data-action="view"][data-view="profile"]').click(); return; }
    if (action === "channel-select") { suite.selectedChannel = target.dataset.id; saveSuite(); renderChannels(); return; }
    if (action === "new-channel") { modal("Create a channel", "Give the room one clear purpose so people know what belongs there.", '<form data-suite-form="new-channel"><label><span>Channel name</span><input name="name" maxlength="50" pattern="[A-Za-z0-9-]+" required placeholder="research-notes"></label><label><span>Purpose</span><textarea name="purpose" maxlength="240" rows="4" required placeholder="What should people use this room for?"></textarea></label><div class="suite-form-actions"><button class="quiet-button" type="button" data-suite-action="modal-close">Cancel</button><button class="primary-button" type="submit">Create channel</button></div></form>'); return; }
    if (action === "huddle") { suite.huddleChannel = suite.huddleChannel === target.dataset.id ? "" : target.dataset.id; saveSuite(suite.huddleChannel ? "Huddle started." : "Huddle ended."); renderChannels(); return; }
    if (action === "pin-message") { toggle(suite.pinnedMessages, target.dataset.id); saveSuite(has(suite.pinnedMessages, target.dataset.id) ? "Message pinned." : "Message unpinned."); renderChannels(); renderWorkspace(); return; }
    if (action === "message-react") { notify("Reaction added."); return; }
    if (action === "message-thread") { modal("Thread", "Keep a side conversation attached to the message it belongs to.", '<form data-suite-form="thread"><input type="hidden" name="messageId" value="' + esc(target.dataset.id) + '"><label><span>Your reply</span><textarea name="reply" rows="4" maxlength="700" required placeholder="Add context without interrupting the channel…"></textarea></label><div class="suite-form-actions"><button class="quiet-button" type="button" data-suite-action="modal-close">Cancel</button><button class="primary-button" type="submit">Reply in thread</button></div></form>'); return; }
    if (action === "channel-search") { modal("Search this channel", "Find messages, decisions, links, files, and people.", '<form data-suite-form="channel-search"><label><span>Search #' + esc(selectedChannel().name) + '</span><input name="query" required placeholder="Decision, person, link, or phrase…"></label><div class="suite-form-actions"><button class="primary-button" type="submit">Search</button></div></form>'); return; }
    if (action === "channel-canvas") { modal("#" + selectedChannel().name + " canvas", "The durable context beside the conversation.", '<div class="canvas-modal"><h3>Purpose</h3><p>' + esc(selectedChannel().purpose) + '</p><h3>Current decision</h3><p>Keep public Connect identity and private Lyfe context separate. Move only explicit saves and actions.</p><h3>Open questions</h3><ul><li>What belongs on a public profile?</li><li>Which notifications deserve to cross into Lyfe?</li><li>What evidence should accompany recommendations?</li></ul><button class="primary-button" type="button" data-suite-action="modal-close">Done</button></div>', true); return; }
    if (action === "channel-pins" || action === "channel-files" || action === "channel-attach" || action === "channel-emoji") { notify(action === "channel-files" || action === "channel-attach" ? "Files are ready for connected media storage." : "Channel tools opened."); return; }
    if (action === "workspace-tab") { suite.workspaceTab = target.dataset.value; saveSuite(); renderWorkspace(); return; }
    if (action === "board-move") { var from = target.dataset.column; var title = target.dataset.title; var order = ["idea", "doing", "review", "done"]; var at = order.indexOf(from); suite.board[from] = suite.board[from].filter(function (item) { return item !== title; }); suite.board[order[Math.min(at + 1, order.length - 1)]].push(title); saveSuite(); renderWorkspace(); return; }
    if (action === "board-add") { modal("Add a project item", "Keep it small enough to move.", '<form data-suite-form="board-add"><input type="hidden" name="column" value="' + esc(target.dataset.column) + '"><label><span>Item</span><input name="title" maxlength="120" required placeholder="What needs to happen?"></label><div class="suite-form-actions"><button class="primary-button" type="submit">Add item</button></div></form>'); return; }
    if (action === "save-to-lyfe") { addToLyfe(target.dataset.kind, target.dataset.id); return; }
    if (action === "profile-tab") { suite.profileTab = target.dataset.value; saveSuite(); renderProfessionalProfile(); return; }
    if (action === "profile-edit-section" || action === "endorse-skill" || action === "person-menu") { notify("Profile control opened."); return; }
    if (action === "export-data") { exportData(); return; }
  });

  document.addEventListener("submit", function (event) {
    var form = event.target.closest("[data-suite-form]");
    if (!form) return;
    event.preventDefault();
    var data = new FormData(form);
    var kind = form.dataset.suiteForm;
    if (kind === "email-auth") {
      var email = String(data.get("email") || "").trim();
      var submit = form.querySelector('button[type="submit"]'); submit.disabled = true;
      showAuthError("");
      LyfeCloud.signInEmail(email).then(function () { showEmailOtp(email); }).catch(function (error) { submit.disabled = false; showAuthError(error.message || "The sign-in code could not be sent."); });
    } else if (kind === "email-otp-verify") {
      var otpEmail = String(data.get("email") || "").trim();
      var otpToken = String(data.get("token") || "").trim();
      var otpSubmit = form.querySelector('button[type="submit"]'); otpSubmit.disabled = true;
      LyfeCloud.verifyEmailOtp(otpEmail, otpToken).then(function () { location.reload(); }).catch(function (error) { otpSubmit.disabled = false; notify(error.message || "That code could not be verified."); });
    } else if (kind === "comment") {
      var commentKind = String(data.get("kind")); var itemId = String(data.get("itemId")); var store = commentKind === "reel" ? suite.reelComments : suite.postComments;
      if (!Array.isArray(store[itemId])) store[itemId] = [];
      store[itemId].push({ id: uid(), text: String(data.get("comment") || "").trim().slice(0, 600), time: "just now" });
      saveSuite("Comment saved."); closeModal(); renderReels(); augmentFeed();
    } else if (kind === "reel") {
      var file = data.get("video");
      if (!file || !file.name) return;
      var videoUrl = URL.createObjectURL(file);
      sessionReels.unshift({ id: "session-" + uid(), creator: "You", handle: "@you", initials: "YO", title: String(data.get("title") || "").trim().slice(0, 120), caption: String(data.get("caption") || "").trim().slice(0, 600), tags: String(data.get("tags") || "").split(",").map(function (tag) { return tag.trim(); }).filter(Boolean).slice(0, 6), likes: 0, comments: 0, palette: "aqua", videoUrl: videoUrl });
      closeModal(); renderReels(); notify("Instant added for this session.");
    } else if (kind === "story") { closeModal(); notify("Story saved for this session.");
    } else if (kind === "network-search") { closeModal(); suite.networkTab = "people"; saveSuite(); renderNetwork(); notify("Showing people related to “" + String(data.get("query") || "").trim().slice(0, 50) + "”.");
    } else if (kind === "new-channel") {
      var name = String(data.get("name") || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      var channel = { id: "custom-" + uid(), name: name, purpose: String(data.get("purpose") || "").trim().slice(0, 240), unread: 0, members: 1 };
      suite.customChannels.push(channel); suite.joinedChannels.push(channel.id); suite.selectedChannel = channel.id; saveSuite(); closeModal(); renderChannels(); notify("Channel created.");
    } else if (kind === "channel-message") {
      var channelId = String(data.get("channelId")); var message = String(data.get("message") || "").trim(); if (!message) return;
      if (!Array.isArray(suite.channelMessages[channelId])) suite.channelMessages[channelId] = [];
      suite.channelMessages[channelId].push({ id: uid(), author: "You", initials: "YO", text: message.slice(0, 1000), time: "now", reactions: {} });
      saveSuite(); renderChannels();
    } else if (kind === "thread") { closeModal(); notify("Thread reply saved.");
    } else if (kind === "channel-search") { closeModal(); notify("Channel search is ready for synced messages.");
    } else if (kind === "board-add") { var column = String(data.get("column")); var title = String(data.get("title") || "").trim(); if (suite.board[column] && title) suite.board[column].push(title.slice(0, 120)); saveSuite(); closeModal(); renderWorkspace();
    } else if (kind === "settings") {
      suite.settings.density = String(data.get("density") || "comfortable"); suite.settings.autoplay = data.get("autoplay") === "on"; suite.settings.allowMessages = String(data.get("allowMessages") || "connections"); suite.settings.profileDiscoverable = data.get("discoverable") === "on"; suite.settings.showActivity = data.get("activity") === "on"; suite.settings.emailDigest = String(data.get("emailDigest") || "weekly"); suite.settings.pushMentions = data.get("pushMentions") === "on"; suite.settings.syncToLyfe = data.get("syncToLyfe") === "on"; document.documentElement.dataset.connectDensity = suite.settings.density; saveSuite("Settings saved."); closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && document.querySelector(".suite-modal-overlay")) closeModal();
  });

  async function initAuth() {
    if (!window.LyfeCloud || !LyfeCloud.configured) { authMode = "unconfigured"; renderAccountButton(); return; }
    authMode = await LyfeCloud.init();
    if (authMode === "cloud") {
      try {
        var remote = await LyfeCloud.pullConnect();
        if (remote && remote.data && Number(remote.rev || 0) > Number(suite.rev || 0)) {
          if (remote.data.suite) suite = normalize(remote.data.suite);
          if (remote.data.core) localStorage.setItem(CORE_KEY, JSON.stringify(remote.data.core));
          localStorage.setItem(SUITE_KEY, JSON.stringify(suite));
          renderAllSuite();
        } else {
          LyfeCloud.pushConnectDebounced({ suite: suite, core: coreState() }, suite.rev);
        }
        LyfeCloud.subscribeConnect(function (next) {
          if (next && next.data && Number(next.rev || 0) > Number(suite.rev || 0)) {
            suite = normalize(next.data.suite || next.data);
            localStorage.setItem(SUITE_KEY, JSON.stringify(suite));
            renderAllSuite();
          }
        });
      } catch (error) { notify("Cloud sync is temporarily offline; this device copy is safe."); }
    }
    renderAccountButton();
    window.dispatchEvent(new CustomEvent("lyfe-connect-auth-ready"));
  }

  function boot() {
    suite = loadSuite();
    document.documentElement.dataset.connectDensity = suite.settings.density;
    var discover = document.querySelector('[data-screen="discover"]');
    var feed = discover && discover.querySelector(".feed-section");
    var pulse = discover && discover.querySelector(".network-pulse");
    if (discover && feed && pulse) discover.insertBefore(feed, pulse);
    renderAllSuite();
    var feedRoot = document.getElementById("feed-list");
    if (feedRoot && window.MutationObserver) new MutationObserver(function () { augmentFeed(); }).observe(feedRoot, { childList: true });
    initAuth();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
