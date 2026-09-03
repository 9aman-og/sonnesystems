(function () {
  "use strict";

  var store = window.AeroStore;
  var aero = window.AeroService;
  var views = window.AeroViews;
  var shell = document.querySelector(".app-shell");
  var surface = document.getElementById("surface");
  var overlay = document.getElementById("overlay-root");
  var input = document.getElementById("aero-input");
  var composer = document.querySelector('[data-form="composer"]');
  var send = composer.querySelector(".send-button");
  var sourceCount = document.querySelector("[data-source-count]");
  var attachmentInput = document.getElementById("attachment-input");
  var attachmentStrip = document.querySelector("[data-attachments]");
  var attentionButton = document.querySelector('[data-action="attention"]');
  var attentionCount = document.querySelector("[data-attention-count]");
  var toast = document.getElementById("toast");
  var toastTimer = 0;
  var returnFocus = null;
  var recognition = null;

  var vm = {
    route: "now",
    projectId: "",
    archiveTab: "objects",
    account: null,
    authStatus: "loading",
    context: { sources: [], count: 0, items: 0 },
    attachments: [],
    busy: false,
    ready: false,
  };

  function showToast(message, tone) {
    window.clearTimeout(toastTimer);
    toast.textContent = String(message || "");
    toast.dataset.tone = tone || "neutral";
    toast.hidden = false;
    toastTimer = window.setTimeout(function () { toast.hidden = true; }, 2600);
  }

  function updateAttentionBadge() {
    if (!(attentionButton && attentionCount && window.AeroAttention && store.get())) return;
    var summary = window.AeroAttention.summary(store.get().aeroAttention);
    attentionCount.textContent = summary.unread > 9 ? "9+" : String(summary.unread);
    attentionCount.hidden = summary.unread === 0;
    attentionButton.setAttribute("aria-label", summary.unread ? "Open " + summary.unread + " unread update" + (summary.unread === 1 ? "" : "s") : "Open updates");
  }

  function refreshAttention(allowInterrupt) {
    if (!(window.AeroAttention && store.get())) return null;
    var data = store.get();
    var result = window.AeroAttention.refresh(
      data.aeroAttention,
      window.AeroAttention.deriveCandidates(data),
      {
        mode: data.settings.aeroProactiveMode || "brief",
        focused: document.body.classList.contains("overlay-open") || document.activeElement === input,
        quietHours: { start: 22, end: 8 },
      }
    );
    if (result.changed) {
      data.aeroAttention = result.state;
      store.save("attention-governor");
    }
    updateAttentionBadge();
    if (allowInterrupt && result.interrupt && document.visibilityState !== "hidden") {
      showToast(result.interrupt.title + (result.interrupt.detail ? " · " + result.interrupt.detail : ""), "attention");
    }
    return result;
  }

  function currentRoute() {
    var value = location.hash.replace(/^#\/?/, "").split("?")[0];
    var parts = value.split("/").filter(Boolean);
    if (["now", "work", "archive", "settings"].indexOf(parts[0]) < 0) return { name: "now", projectId: "" };
    return { name: parts[0], projectId: parts[0] === "work" ? parts[1] || "" : "" };
  }

  function navigate(name, projectId) {
    var next = "#/" + name + (projectId ? "/" + encodeURIComponent(projectId) : "");
    if (location.hash === next) {
      applyRoute();
      return;
    }
    location.hash = next;
  }

  function updateNav() {
    document.querySelectorAll("[data-route]").forEach(function (button) {
      var route = button.getAttribute("data-route");
      var active = route === vm.route && route !== "settings";
      button.classList.toggle("is-active", active);
      if (button.classList.contains("nav-item")) {
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
    var initials = (store.get().settings.name || vm.account && vm.account.name || "A").trim().split(/\s+/).map(function (part) { return part[0] || ""; }).join("").slice(0, 2).toUpperCase() || "A";
    document.querySelector(".profile-button").textContent = initials;
  }

  function render() {
    if (!vm.ready) return;
    var data = store.get();
    vm.context = aero.contextSummary();
    sourceCount.textContent = vm.context.count;
    shell.dataset.appState = "ready";
    updateAttentionBadge();
    document.body.classList.toggle("settings-route", vm.route === "settings");
    if (vm.route === "work" && vm.projectId) surface.innerHTML = views.project(data, vm.projectId);
    else if (vm.route === "work") surface.innerHTML = views.work(data, vm);
    else if (vm.route === "archive") surface.innerHTML = views.archive(data, vm);
    else if (vm.route === "settings") surface.innerHTML = views.settings(data, vm);
    else surface.innerHTML = views.now(data, vm);
    surface.classList.remove("is-entering");
    void surface.offsetWidth;
    surface.classList.add("is-entering");
    updateNav();
  }

  function applyRoute() {
    var route = currentRoute();
    vm.route = route.name;
    vm.projectId = route.projectId ? decodeURIComponent(route.projectId) : "";
    closeOverlay(false);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusFirst(root) {
    window.setTimeout(function () {
      var autofocus = root.querySelector("[autofocus]");
      var target = autofocus || root.querySelector('input:not([type="hidden"]), textarea, button:not([disabled]), [href]');
      if (target) target.focus();
    }, 20);
  }

  function openOverlay(html, type) {
    returnFocus = document.activeElement;
    overlay.className = "overlay is-open " + (type || "sheet-overlay");
    overlay.innerHTML = '<div class="overlay-scrim" data-action="close-sheet"></div>' + html;
    document.body.classList.add("overlay-open");
    focusFirst(overlay);
  }

  function closeOverlay(restore) {
    if (!overlay.classList.contains("is-open")) return;
    overlay.className = "";
    overlay.innerHTML = "";
    document.body.classList.remove("overlay-open");
    if (restore !== false && returnFocus && returnFocus.isConnected) returnFocus.focus();
    returnFocus = null;
  }

  function resizeInput() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
    send.disabled = vm.busy || !input.value.trim();
  }

  function setBusy(value) {
    vm.busy = !!value;
    composer.classList.toggle("is-busy", vm.busy);
    input.disabled = vm.busy;
    resizeInput();
  }

  function renderAttachments() {
    attachmentStrip.hidden = !vm.attachments.length;
    attachmentStrip.innerHTML = vm.attachments.map(function (item) {
      return '<span><b>' + views.esc(item.name) + '</b><button type="button" data-action="remove-attachment" data-id="' + views.esc(item.id) + '" aria-label="Remove ' + views.esc(item.name) + '">' + views.icon('close') + '</button></span>';
    }).join("");
  }

  async function submitAero(request) {
    setBusy(true);
    try {
      var result = await aero.propose(request, vm.attachments);
      vm.attachments = [];
      renderAttachments();
      render();
      if (result.kind === "proposal") {
        var prepared = await aero.prepare(result.run.id);
        openOverlay(views.reviewPanel(result.run, prepared.authority), "sheet-overlay");
      }
      else openOverlay(views.assistantPanel(result), "sheet-overlay");
      if (result.notice) showToast(result.notice, "neutral");
    } catch (error) {
      showToast(error && error.message || "Aero could not complete that request.", "error");
    } finally {
      setBusy(false);
    }
  }

  function taskPanel(task) {
    var data = store.get();
    var project = task.projectId && data.projects.find(function (item) { return item.id === task.projectId; });
    var done = task.status === "done" || task.status === "completed";
    return '<section class="modal-card detail-card" role="dialog" aria-modal="true" aria-labelledby="task-title"><header><span class="detail-type">Open loop</span><button type="button" data-action="close-sheet" aria-label="Close">' + views.icon('close') + '</button></header><h2 id="task-title">' + views.esc(task.title) + '</h2><div class="detail-meta"><span>' + views.esc(project ? project.name || project.title : task.area || 'Unsorted') + '</span><span>' + views.esc(task.due || 'No date') + '</span><span>' + views.esc(task.priority || 'Medium') + '</span></div>' + (task.notes ? '<p>' + views.esc(task.notes) + '</p>' : '') + '<footer><button type="button" data-action="close-sheet">Close</button>' + (done ? '<button class="is-done" type="button" disabled>Complete</button>' : '<button type="button" data-action="complete-task" data-id="' + views.esc(task.id) + '">Mark complete</button>') + '</footer></section>';
  }

  function objectPanel(item, type) {
    return '<section class="modal-card detail-card object-detail" role="dialog" aria-modal="true" aria-labelledby="object-title"><header><span class="detail-type">' + views.esc(type || 'Object') + '</span><button type="button" data-action="close-sheet" aria-label="Close">' + views.icon('close') + '</button></header><h2 id="object-title">' + views.esc(item.title || item.name || 'Untitled') + '</h2><div class="object-body">' + views.esc(item.body || item.description || item.notes || item.url || 'Nothing else here.').replace(/\n/g, '<br>') + '</div><footer><button type="button" data-action="close-sheet">Done</button></footer></section>';
  }

  function modelPanel() {
    var settings = store.get().settings || {};
    var automatic = settings.aeroCloudEnabled === true && settings.provider !== "offline";
    return '<section class="modal-card policy-card" role="dialog" aria-modal="true" aria-labelledby="policy-title"><header><h2 id="policy-title">Model policy</h2><button type="button" data-action="close-sheet" aria-label="Close">' + views.icon('close') + '</button></header><div class="policy-list"><button type="button" data-action="set-model-policy" data-policy="auto" class="' + (automatic ? 'is-selected' : '') + '"><span>Automatic</span><b>Protected routing</b><small>Only the current clean prompt may use the specialist. Your workspace stays local.</small></button><button type="button" data-action="set-model-policy" data-policy="offline" class="' + (!automatic ? 'is-selected' : '') + '"><span>On-device</span><b>Local only</b><small>No model request leaves this device.</small></button></div><footer><button type="button" data-action="close-sheet">Done</button></footer></section>';
  }

  async function proposeDirect(intent, actions) {
    closeOverlay(false);
    try {
      var result = aero.proposeActions(intent, actions);
      render();
      var prepared = await aero.prepare(result.run.id);
      openOverlay(views.reviewPanel(result.run, prepared.authority), "sheet-overlay");
    } catch (error) {
      showToast(error && error.message || "The change could not be prepared.", "error");
    }
  }

  function downloadExport() {
    var blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "aero-export-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast("Export ready.");
  }

  function beginVoice() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Voice input is not available in this browser.");
      return;
    }
    if (recognition) {
      recognition.stop();
      recognition = null;
      composer.classList.remove("is-listening");
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = document.documentElement.lang || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = function () { composer.classList.add("is-listening"); showToast("Listening…"); };
    recognition.onresult = function (event) {
      var transcript = Array.from(event.results).map(function (result) { return result[0].transcript; }).join(" ");
      input.value = transcript;
      resizeInput();
    };
    recognition.onerror = function () { showToast("Voice input stopped."); };
    recognition.onend = function () { composer.classList.remove("is-listening"); recognition = null; input.focus(); };
    recognition.start();
  }

  function handleRoute(target) {
    var name = target.getAttribute("data-route");
    if (!name) return;
    if (target.dataset.tab) vm.archiveTab = target.dataset.tab;
    navigate(name);
  }

  async function handleAction(target) {
    var action = target.getAttribute("data-action");
    if (!action) return;
    var data = store.get();
    if (action === "close-sheet") { closeOverlay(); return; }
    if (action === "search") { openOverlay(views.searchPanel(data, ""), "search-overlay"); return; }
    if (action === "attention") {
      if (window.AeroAttention) {
        data.aeroAttention = window.AeroAttention.markAllRead(data.aeroAttention);
        store.save("attention-read");
        updateAttentionBadge();
      }
      openOverlay(views.attentionPanel(data), "sheet-overlay");
      return;
    }
    if (action === "open-context" || action === "focus-menu") { openOverlay(views.contextPanel(aero.contextSummary()), "sheet-overlay"); return; }
    if (action === "attach") { attachmentInput.click(); return; }
    if (action === "voice") { beginVoice(); return; }
    if (action === "remove-attachment") { vm.attachments = vm.attachments.filter(function (item) { return item.id !== target.dataset.id; }); renderAttachments(); return; }
    if (action === "quick-task") { openOverlay(views.quickForm("task", target.dataset.project || ""), "modal-overlay"); return; }
    if (action === "quick-project") { openOverlay(views.quickForm("project"), "modal-overlay"); return; }
    if (action === "quick-note") { openOverlay(views.quickForm("note", target.dataset.project || ""), "modal-overlay"); return; }
    if (action === "open-project") { navigate("work", target.dataset.id); return; }
    if (action === "continue-focus") {
      if (target.dataset.type === "project") navigate("work", target.dataset.id);
      else if (target.dataset.type === "task") {
        var currentTask = data.tasks.find(function (task) { return task.id === target.dataset.id; });
        if (currentTask) openOverlay(taskPanel(currentTask), "modal-overlay");
      } else openOverlay(views.quickForm("task"), "modal-overlay");
      return;
    }
    if (action === "open-task") {
      var task = data.tasks.find(function (item) { return item.id === target.dataset.id; });
      if (task) openOverlay(taskPanel(task), "modal-overlay");
      return;
    }
    if (action === "complete-task") {
      var item = data.tasks.find(function (task) { return task.id === target.dataset.id; });
      if (item) proposeDirect("Complete task: " + item.title, [{ type: "complete_task", title: item.title }]);
      return;
    }
    if (action === "open-object") {
      var object = data.notes.concat(data.docs, data.saved).find(function (item) { return item.id === target.dataset.id; });
      var objectType = object ? (data.notes.indexOf(object) >= 0 ? "Note" : data.docs.indexOf(object) >= 0 ? "Document" : "Saved") : "Imported";
      if (!object && window.AeroKnowledge) {
        var imported = window.AeroKnowledge.context('', 100).find(function (item) { return item.id === target.dataset.id; });
        if (imported) object = { title: imported.title, body: imported.detail };
      }
      if (object) openOverlay(objectPanel(object, objectType), "modal-overlay");
      return;
    }
    if (action === "open-activity") {
      if (target.dataset.kind === "file") {
        var activityNote = data.notes.find(function (item) { return item.id === target.dataset.id; });
        if (activityNote) openOverlay(objectPanel(activityNote, "Note"), "modal-overlay");
      } else if (target.dataset.kind === "work") {
        var activityWork = data.worklog.find(function (item) { return item.id === target.dataset.id; });
        if (activityWork) openOverlay(objectPanel({ title: activityWork.text || "Work logged", body: (activityWork.hours || 0) + " hours · " + (activityWork.date || "") }, "Work"), "modal-overlay");
      } else {
        var activityRun = data.aeroRuns.find(function (item) { return item.id === target.dataset.id; });
        if (activityRun) openOverlay(views.runPanel(activityRun), "modal-overlay");
      }
      return;
    }
    if (action === "approve-run") {
      var button = target;
      button.disabled = true;
      button.textContent = "Applying…";
      try {
        var result = await aero.execute(target.dataset.run);
        render();
        openOverlay(views.receiptPanel(result), "sheet-overlay");
      } catch (error) {
        showToast(error && error.message || "The plan stopped safely.", "error");
        button.disabled = false;
        button.textContent = "Try again";
      }
      return;
    }
    if (action === "cancel-run") { await aero.cancel(target.dataset.run); closeOverlay(); render(); showToast("No changes applied."); return; }
    if (action === "archive-tab") { vm.archiveTab = target.dataset.tab || "objects"; render(); return; }
    if (action === "forget-memory") {
      var memory = data.aero.memories.find(function (item) { return item.id === target.dataset.id; });
      if (memory) proposeDirect("Forget memory: " + memory.claim, [{ type: "memory_forget", query: memory.claim }]);
      return;
    }
    if (action === "toggle-source") {
      var key = target.dataset.source;
      store.update(function (next) { next.settings.aeroSources[key] = !(next.settings.aeroSources[key] !== false); }, "source-policy", true);
      render();
      return;
    }
    if (action === "toggle-setting") {
      var setting = target.dataset.setting;
      store.update(function (next) { next.settings[setting] = !next.settings[setting]; }, "setting", true);
      render();
      return;
    }
    if (action === "toggle-attention") {
      store.update(function (next) { next.settings.aeroProactiveMode = next.settings.aeroProactiveMode === "off" ? "brief" : "off"; }, "attention-policy", true);
      render();
      return;
    }
    if (action === "set-model-policy") {
      var policy = target.dataset.policy === "auto" ? "auto" : "offline";
      store.update(function (next) {
        next.settings.provider = policy;
        next.settings.aeroCloudEnabled = policy === "auto";
      }, "model-policy", true);
      openOverlay(modelPanel(), "modal-overlay");
      render();
      return;
    }
    if (action === "attention-read-all") {
      if (window.AeroAttention) {
        data.aeroAttention = window.AeroAttention.markAllRead(data.aeroAttention);
        store.save("attention-read");
        updateAttentionBadge();
      }
      return;
    }
    if (action === "attention-dismiss") {
      if (window.AeroAttention) {
        data.aeroAttention = window.AeroAttention.feedback(data.aeroAttention, target.dataset.id, "dismissed");
        data.aeroAttention.notifications = data.aeroAttention.notifications.filter(function (item) { return item.id !== target.dataset.id; });
        store.save("attention-feedback");
        openOverlay(views.attentionPanel(data), "sheet-overlay");
        updateAttentionBadge();
      }
      return;
    }
    if (action === "attention-open") {
      if (window.AeroAttention) {
        data.aeroAttention = window.AeroAttention.feedback(data.aeroAttention, target.dataset.id, "opened");
        store.save("attention-feedback");
      }
      var refs = String(target.dataset.ref || "").split(",");
      if (target.dataset.source === "task") {
        var attentionTask = data.tasks.find(function (item) { return refs.indexOf(String(item.id)) >= 0; });
        if (attentionTask) openOverlay(taskPanel(attentionTask), "modal-overlay");
      } else if (target.dataset.source === "run") {
        var attentionRun = data.aeroRuns.find(function (item) { return String(item.id) === String(target.dataset.ref); });
        if (attentionRun) openOverlay(views.runPanel(attentionRun), "modal-overlay");
      }
      updateAttentionBadge();
      return;
    }
    if (action === "connect-source") {
      if (target.dataset.source === "gmail" && window.LyfeCloud && typeof window.LyfeCloud.connectGmail === "function") {
        target.disabled = true;
        try { await window.LyfeCloud.connectGmail(); } catch (error) { showToast(error && error.message || "Mail could not connect.", "error"); target.disabled = false; }
      }
      return;
    }
    if (action === "settings-jump") {
      var section = document.getElementById(target.dataset.target || "");
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "account") { openOverlay(views.accountPanel(vm), "modal-overlay"); return; }
    if (action === "model-policy") { openOverlay(modelPanel(), "modal-overlay"); return; }
    if (action === "privacy") { openOverlay(views.contextPanel(aero.contextSummary()), "sheet-overlay"); return; }
    if (action === "export-data") { downloadExport(); return; }
    if (action === "sign-in-google") {
      target.disabled = true;
      try { await store.signInGoogle(); } catch (error) { showToast(error && error.message || "Sign-in could not start.", "error"); target.disabled = false; }
      return;
    }
    if (action === "sign-out") { await store.signOut(); return; }
    if (action === "composer-fill") { input.value = target.dataset.value || ""; closeOverlay(false); input.focus(); resizeInput(); return; }
    if (action === "search-result") {
      if (target.dataset.type === "Workspace") { closeOverlay(false); navigate("work", target.dataset.id); }
      else if (target.dataset.type === "Loop") {
        var foundTask = data.tasks.find(function (task) { return task.id === target.dataset.id; });
        if (foundTask) openOverlay(taskPanel(foundTask), "modal-overlay");
      } else {
        var foundObject = data.notes.concat(data.docs, data.saved).find(function (item) { return item.id === target.dataset.id; });
        if (!foundObject && target.dataset.type === "Mail" && store.getGmail) {
          var message = store.getGmail().find(function (item) { return item.id === target.dataset.id; });
          if (message) foundObject = { title: message.subject || '(no subject)', body: (message.sender || '') + (message.snippet ? '\n\n' + message.snippet : '') };
        }
        if (!foundObject && target.dataset.type === "Imported" && window.AeroKnowledge) {
          var foundImport = window.AeroKnowledge.context('', 100).find(function (item) { return item.id === target.dataset.id; });
          if (foundImport) foundObject = { title: foundImport.title, body: foundImport.detail };
        }
        if (foundObject) openOverlay(objectPanel(foundObject, target.dataset.type), "modal-overlay");
      }
      return;
    }
  }

  input.addEventListener("input", resizeInput);
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!send.disabled) composer.requestSubmit();
    }
  });

  composer.addEventListener("submit", function (event) {
    event.preventDefault();
    var request = input.value.trim();
    if (!request || vm.busy) return;
    input.value = "";
    resizeInput();
    submitAero(request);
  });

  attachmentInput.addEventListener("change", function () {
    var files = Array.from(attachmentInput.files || []).slice(0, Math.max(0, 12 - vm.attachments.length));
    if (!files.length) return;
    if (!window.AeroKnowledge) { showToast("Local file context is unavailable.", "error"); return; }
    window.AeroKnowledge.importFiles(files).then(function (result) {
      files.forEach(function (file) { vm.attachments.push({ id: store.id("attachment"), name: file.name, type: file.type, size: file.size, localOnly: true }); });
      renderAttachments();
      showToast(result.imported + " local passage" + (result.imported === 1 ? "" : "s") + " ready.");
    }).catch(function (error) {
      showToast(error && error.message || "The file could not be read locally.", "error");
    });
    attachmentInput.value = "";
  });

  document.addEventListener("click", function (event) {
    var route = event.target.closest("[data-route]");
    if (route) { event.preventDefault(); handleRoute(route); return; }
    var action = event.target.closest("[data-action]");
    if (action) { event.preventDefault(); handleAction(action); }
  });

  document.addEventListener("submit", function (event) {
    var quick = event.target.closest('[data-form="quick"]');
    if (quick) {
      event.preventDefault();
      var fd = new FormData(quick);
      var title = String(fd.get("title") || "").trim();
      if (!title) return;
      var kind = quick.dataset.kind;
      if (kind === "project") proposeDirect("Create a project: " + title, [{ type: "add_project", name: title, description: String(fd.get("description") || "").trim() }]);
      else if (kind === "note") proposeDirect("Save a note: " + title, [{ type: "add_note", title: title, body: String(fd.get("body") || "").trim() }]);
      else proposeDirect("Create a task: " + title, [{ type: "add_task", title: title, due: String(fd.get("due") || "") || null, priority: String(fd.get("priority") || "Medium") }]);
      return;
    }
    var signIn = event.target.closest('[data-form="sign-in-email"]');
    if (signIn) {
      event.preventDefault();
      var email = String(new FormData(signIn).get("email") || "").trim();
      store.signInEmail(email).then(function () { openOverlay(views.otpPanel(email), "modal-overlay"); }).catch(function (error) { showToast(error && error.message || "Email sign-in could not start.", "error"); });
      return;
    }
    var otp = event.target.closest('[data-form="auth-otp"]');
    if (otp) {
      event.preventDefault();
      var authData = new FormData(otp);
      var authEmail = String(authData.get("email") || "").trim();
      var token = String(authData.get("token") || "").trim();
      store.verifyEmail(authEmail, token).then(function () { location.reload(); }).catch(function (error) { showToast(error && error.message || "That code could not be verified.", "error"); });
      return;
    }
    var profile = event.target.closest('[data-form="profile-name"]');
    if (profile) {
      event.preventDefault();
      var name = String(new FormData(profile).get("name") || "").trim();
      if (!name) return;
      store.update(function (next) { next.settings.name = name; next.settings.nameSet = true; }, "profile", true);
      closeOverlay();
      render();
      showToast("Profile updated.");
    }
  });

  document.addEventListener("input", function (event) {
    if (!event.target.matches("[data-search-input]")) return;
    var value = event.target.value;
    overlay.innerHTML = '<div class="overlay-scrim" data-action="close-sheet"></div>' + views.searchPanel(store.get(), value);
    var next = overlay.querySelector("[data-search-input]");
    next.focus();
    next.setSelectionRange(value.length, value.length);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && overlay.classList.contains("is-open")) { closeOverlay(); return; }
    if (event.key === "/" && !overlay.classList.contains("is-open") && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      event.preventDefault();
      openOverlay(views.searchPanel(store.get(), ""), "search-overlay");
      return;
    }
    if (event.key !== "Tab" || !overlay.classList.contains("is-open")) return;
    var focusable = Array.from(overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]')).filter(function (element) { return element.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  window.addEventListener("hashchange", applyRoute);
  store.subscribe(function () { if (vm.ready) render(); });

  (async function init() {
    try {
      await store.boot();
      vm.account = store.state.user;
      vm.authStatus = store.state.authStatus;
      vm.ready = true;
      var route = currentRoute();
      if (!location.hash) history.replaceState(null, "", location.pathname + "#/now");
      vm.route = route.name;
      vm.projectId = route.projectId ? decodeURIComponent(route.projectId) : "";
      render();
      resizeInput();
      refreshAttention(true);
      window.setInterval(function () { refreshAttention(true); }, 15 * 60 * 1000);
    } catch (error) {
      surface.innerHTML = '<div class="fatal-state"><img src="' + views.esc(String(window.AERO_SHELL_BASE || "") + 'brand-mark.svg') + '" alt=""><h1>Aero could not open.</h1><button type="button" onclick="location.reload()">Try again</button></div>';
    }
  })();

  document.addEventListener("visibilitychange", function () {
    if (vm.ready && document.visibilityState === "visible") refreshAttention(true);
  });
})();
