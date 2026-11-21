(function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function shellAsset(path) {
    return String(window.AERO_SHELL_BASE || "") + path;
  }

  function icon(name, className) {
    var paths = {
      arrow: '<path d="m6 12 6-6 6 6M12 6v12"></path>',
      chevron: '<path d="m9 5 7 7-7 7"></path>',
      back: '<path d="m15 5-7 7 7 7"></path>',
      search: '<circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path>',
      check: '<path d="m6.5 12.5 3.4 3.4 7.7-8"></path>',
      file: '<path d="M7 4.5h8l3 3V20H7z"></path><path d="M15 4.5V8h3M10 12h5M10 15.5h5"></path>',
      mail: '<path d="M5 8.5h14v9H5z"></path><path d="m5 9 7 5 7-5"></path>',
      plus: '<path d="M12 5v14M5 12h14"></path>',
      close: '<path d="m7 7 10 10M17 7 7 17"></path>',
      more: '<circle cx="6" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="18" cy="12" r="1"></circle>',
      paperclip: '<path d="m8.5 12.5 5.7-5.7a3 3 0 0 1 4.2 4.2l-7.7 7.7a4.5 4.5 0 0 1-6.4-6.4l7.4-7.4"></path>',
      mic: '<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"></path>',
      shield: '<path d="M12 3.5 19 6v5c0 4.5-2.8 7.8-7 9.5C7.8 18.8 5 15.5 5 11V6z"></path><path d="m9 12 2 2 4-4"></path>',
      clock: '<circle cx="12" cy="12" r="8"></circle><path d="M12 7.5V12l3 2"></path>',
      layers: '<path d="m12 4 8 4-8 4-8-4z"></path><path d="m4 12 8 4 8-4M4 16l8 4 8-4"></path>',
      memory: '<path d="M8 5.5h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Z"></path><path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h2.5M19 9h2.5M2.5 15h2.5M19 15h2.5"></path>',
      sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"></path><circle cx="16" cy="7" r="2"></circle><circle cx="8" cy="17" r="2"></circle>',
      bell: '<path d="M7 10a5 5 0 0 1 10 0v4l2 3H5l2-3z"></path><path d="M10 20h4"></path>',
      user: '<circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"></path>',
      link: '<path d="M10 13.5 13.5 10"></path><path d="M8.5 16.5 7 18a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M15.5 7.5 17 6a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0"></path>',
      trash: '<path d="M5 7h14M9 7V4h6v3M7.5 7l.7 13h7.6l.7-13M10 11v5M14 11v5"></path>',
    };
    return '<svg class="' + esc(className || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.file) + '</svg>';
  }

  function dateLabel(value) {
    if (!value) return "No date";
    var date = new Date(value.length === 10 ? value + "T12:00:00" : value);
    if (Number.isNaN(date.getTime())) return value;
    var today = new Date(); today.setHours(12, 0, 0, 0);
    var target = new Date(date); target.setHours(12, 0, 0, 0);
    var diff = Math.round((target - today) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function relative(value) {
    var time = Number(value || 0);
    if (!time) return "Recently";
    var minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
    if (minutes < 1) return "Now";
    if (minutes < 60) return minutes + " min";
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + " hr";
    var days = Math.round(hours / 24);
    return days + " d";
  }

  function openTasks(data) {
    return data.tasks.filter(function (task) { return task.status !== "done" && task.status !== "completed"; });
  }

  function topTasks(data) {
    return window.AeroService.topTasks(data, 5);
  }

  function displayName(data, account) {
    var raw = data.settings && data.settings.name || account && account.name || "";
    return String(raw).trim().split(/\s+/)[0] || "there";
  }

  function greeting() {
    var hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }

  function focusObject(data) {
    var tasks = topTasks(data);
    var task = tasks[0] || null;
    var project = task && task.projectId ? data.projects.find(function (item) { return item.id === task.projectId; }) : data.projects.filter(function (item) { return item.status === "active"; }).sort(function (a, b) { return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0); })[0];
    if (task) return {
      type: "task", id: task.id, title: task.title,
      copy: task.notes || (project ? "Next open loop in " + (project.name || project.title) + "." : "The strongest open commitment in view."),
      project: project,
      due: task.due,
    };
    if (project) return { type: "project", id: project.id, title: project.name || project.title, copy: project.description || "Choose the next concrete move.", project: project, due: project.end };
    return { type: "empty", id: "", title: "Choose the next outcome", copy: "Aero will keep the work, context, and proof together.", project: null, due: null };
  }

  function recentEvents(data) {
    var events = [];
    var unresolved = new Map(window.AeroService.pendingRuns().map(function (run) { return [run.id, run]; }));
    var runs = data.aeroRuns.filter(function (run) { return !unresolved.has(run.id); }).concat(Array.from(unresolved.values()));
    runs.forEach(function (run) {
      var checking = unresolved.has(run.id);
      var title = checking ? "Outcome unconfirmed" : run.status === "completed"
        ? (run.remote && run.remote.recovered ? "Verified after reconnect" : "Change applied")
        : run.status === "cancelled" ? "Change cancelled"
        : run.status === "failed" ? "Change stopped"
        : run.status === "running" ? "Applying change" : "Change prepared";
      events.push({ id: run.id, kind: !checking && run.status === "completed" ? "success" : "run", title: title, detail: run.intent || "Aero action", at: run.updatedAt || run.createdAt, checking: checking });
    });
    data.notes.slice(-6).forEach(function (note) { events.push({ id: note.id, kind: "file", title: "Note updated", detail: note.title || "Untitled", at: note.updatedAt || note.createdAt }); });
    data.worklog.slice(-6).forEach(function (item) { events.push({ id: item.id, kind: "work", title: "Work logged", detail: item.text || "Work", at: item.createdAt || Date.parse(item.date) }); });
    return events.sort(function (a, b) { return Number(!!b.checking) - Number(!!a.checking) || Number(b.at || 0) - Number(a.at || 0); }).slice(0, 6);
  }

  function emptyInline(title, action, label) {
    return '<div class="inline-empty"><span>' + esc(title) + '</span><button type="button" data-action="' + esc(action) + '">' + esc(label) + '</button></div>';
  }

  function now(data, vm) {
    var tasks = topTasks(data);
    var focus = focusObject(data);
    var completed = data.tasks.filter(function (task) { return task.status === "done" || task.status === "completed"; }).length;
    var activeProjects = data.projects.filter(function (project) { return project.status !== "completed"; }).length;
    var verified = data.aeroRuns.filter(function (run) { return run.status === "completed" && (run.serverCertificate || window.AeroHarness.verifyCertificate(run).valid); }).length;
    var events = recentEvents(data).slice(0, 3);
    var queue = tasks.slice(focus.type === "task" ? 1 : 0, focus.type === "task" ? 4 : 3);
    var day = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    return '<section class="page-head" aria-labelledby="page-title">' +
      '<div><p class="eyebrow">' + esc(day) + ' · ' + openTasks(data).length + ' open loop' + (openTasks(data).length === 1 ? '' : 's') + '</p><h1 id="page-title">' + esc(greeting()) + ', ' + esc(displayName(data, vm.account)) + '.</h1></div>' +
      '<button class="quiet-button" type="button" data-action="open-context"><span class="status-dot"></span>' + vm.context.count + ' sources ready</button>' +
      '</section>' +
      '<div class="now-grid"><section class="main-column" aria-label="Current work">' +
      '<article class="focus-card" data-focus-type="' + esc(focus.type) + '">' +
      '<div class="focus-card-head"><span class="section-label">Current</span><button class="more-button" type="button" aria-label="More options" data-action="focus-menu">' + icon('more') + '</button></div>' +
      '<h2>' + esc(focus.title) + '</h2><p>' + esc(focus.copy) + '</p>' +
      '<div class="focus-meta"><span><b>' + openTasks(data).length + '</b> open</span><span><b>' + completed + '</b> complete</span><span><b>' + verified + '</b> verified</span></div>' +
      '<div class="focus-actions"><button class="primary-button" type="button" data-action="continue-focus" data-id="' + esc(focus.id) + '" data-type="' + esc(focus.type) + '">' + (focus.type === 'empty' ? 'Start' : 'Continue') + '</button><button class="secondary-button" type="button" data-route="archive" data-tab="activity">Activity</button></div>' +
      '</article>' +
      '<section class="queue-section" aria-labelledby="queue-title"><div class="section-heading"><h2 id="queue-title">Up next</h2><button type="button" data-route="work">View work</button></div>' +
      (queue.length ? '<div class="queue-list">' + queue.map(function (task, index) {
        var project = task.projectId && data.projects.find(function (item) { return item.id === task.projectId; });
        return '<button class="queue-row" type="button" data-action="open-task" data-id="' + esc(task.id) + '"><span class="queue-index">0' + (index + 1) + '</span><span class="queue-copy"><b>' + esc(task.title) + '</b><small>' + esc(project ? project.name || project.title : task.area || 'Open loop') + ' · ' + esc(dateLabel(task.due)) + '</small></span><span class="queue-state' + (task.priority === 'High' ? '' : ' is-muted') + '">' + esc(task.priority || 'Open') + '</span>' + icon('chevron') + '</button>';
      }).join('') + '</div>' : emptyInline('No other loops in the queue.', 'quick-task', 'Add one')) + '</section></section>' +
      '<aside class="activity-panel" aria-labelledby="activity-title"><div class="section-heading"><h2 id="activity-title">Recent</h2><button type="button" data-route="archive" data-tab="activity">History</button></div>' +
      (events.length ? '<ol class="activity-list">' + events.map(function (event) {
        var kindIcon = event.kind === 'success' ? 'check' : event.kind === 'file' ? 'file' : 'clock';
        return '<li><span class="activity-mark' + (event.kind === 'success' ? ' is-success' : '') + '">' + icon(kindIcon) + '</span><div><b>' + esc(event.title) + '</b><small>' + esc(event.detail) + ' · ' + esc(relative(event.at)) + '</small></div></li>';
      }).join('') + '</ol>' : '<div class="activity-empty">No activity yet.</div>') +
      '<button class="day-card" type="button" data-route="work"><span>Workspaces</span><b>' + activeProjects + ' active</b><small>' + data.projects.length + ' total</small></button></aside></div>';
  }

  function projectCard(project, data) {
    var tasks = data.tasks.filter(function (task) { return task.projectId === project.id; });
    var open = tasks.filter(function (task) { return task.status !== "done" && task.status !== "completed"; }).length;
    var done = tasks.length - open;
    var percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    return '<button class="workspace-card" type="button" data-action="open-project" data-id="' + esc(project.id) + '">' +
      '<div class="workspace-card-top"><span class="workspace-glyph">' + esc((project.name || project.title || 'W').slice(0, 1).toUpperCase()) + '</span><span class="workspace-state">' + esc(project.status || 'active') + '</span></div>' +
      '<div><h3>' + esc(project.name || project.title || 'Untitled workspace') + '</h3><p>' + esc(project.description || (open ? open + ' open loop' + (open === 1 ? '' : 's') : 'No open loops')) + '</p></div>' +
      '<div class="workspace-progress"><span><i style="width:' + percent + '%"></i></span><small>' + done + '/' + tasks.length + '</small></div></button>';
  }

  function work(data) {
    var projects = data.projects.slice().sort(function (a, b) { return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0); });
    var loose = openTasks(data).filter(function (task) { return !task.projectId; });
    return '<section class="route-head"><div><p class="eyebrow">Work</p><h1>Everything in motion.</h1></div><button class="route-action" type="button" data-action="quick-project">' + icon('plus') + 'New workspace</button></section>' +
      '<div class="work-summary"><div><span>Active</span><b>' + projects.filter(function (item) { return item.status !== 'completed'; }).length + '</b></div><div><span>Open loops</span><b>' + openTasks(data).length + '</b></div><div><span>Unsorted</span><b>' + loose.length + '</b></div></div>' +
      '<section class="workspace-section"><div class="section-heading"><h2>Workspaces</h2><span class="sort-label">Recent first</span></div>' +
      (projects.length ? '<div class="workspace-grid">' + projects.map(function (project) { return projectCard(project, data); }).join('') + '</div>' : '<div class="route-empty"><span class="empty-mark">' + icon('layers') + '</span><h2>No workspaces yet</h2><button type="button" data-action="quick-project">Create one</button></div>') + '</section>' +
      '<section class="loose-section"><div class="section-heading"><h2>Unsorted loops</h2><button type="button" data-action="quick-task">Add loop</button></div>' +
      (loose.length ? '<div class="compact-list">' + loose.slice(0, 8).map(function (task) { return '<button type="button" data-action="open-task" data-id="' + esc(task.id) + '"><span class="task-check" data-action="complete-task" data-id="' + esc(task.id) + '"></span><b>' + esc(task.title) + '</b><small>' + esc(dateLabel(task.due)) + '</small>' + icon('chevron') + '</button>'; }).join('') + '</div>' : emptyInline('Everything is placed.', 'quick-task', 'Add loop')) + '</section>';
  }

  function project(data, projectId) {
    var project = data.projects.find(function (item) { return item.id === projectId; });
    if (!project) return work(data);
    var tasks = data.tasks.filter(function (task) { return task.projectId === project.id; });
    var files = data.notes.concat(data.docs).filter(function (item) { return item.projectId === project.id; });
    return '<button class="back-button" type="button" data-route="work">' + icon('back') + 'Work</button>' +
      '<section class="project-head"><div class="project-symbol">' + esc((project.name || project.title || 'W').slice(0, 1).toUpperCase()) + '</div><div><p class="eyebrow">' + esc(project.area || 'Workspace') + '</p><h1>' + esc(project.name || project.title) + '</h1><p>' + esc(project.description || 'No description') + '</p></div></section>' +
      '<div class="project-grid"><section><div class="section-heading"><h2>Open loops</h2><button type="button" data-action="quick-task" data-project="' + esc(project.id) + '">Add</button></div>' +
      (tasks.length ? '<div class="compact-list">' + tasks.map(function (task) { return '<button type="button" data-action="open-task" data-id="' + esc(task.id) + '"><span class="task-check' + ((task.status === 'done' || task.status === 'completed') ? ' is-done' : '') + '" data-action="complete-task" data-id="' + esc(task.id) + '">' + ((task.status === 'done' || task.status === 'completed') ? icon('check') : '') + '</span><b>' + esc(task.title) + '</b><small>' + esc(dateLabel(task.due)) + '</small>' + icon('chevron') + '</button>'; }).join('') + '</div>' : emptyInline('No loops in this workspace.', 'quick-task', 'Add one')) + '</section>' +
      '<aside><div class="section-heading"><h2>Objects</h2><button type="button" data-action="quick-note">Add</button></div>' +
      (files.length ? '<div class="object-list">' + files.map(function (file) { return '<button type="button" data-action="open-object" data-id="' + esc(file.id) + '">' + icon('file') + '<span><b>' + esc(file.title || 'Untitled') + '</b><small>' + esc(relative(file.updatedAt || file.createdAt)) + '</small></span></button>'; }).join('') + '</div>' : '<div class="side-empty">No objects yet.</div>') + '</aside></div>';
  }

  function allObjects(data) {
    var values = [];
    data.notes.forEach(function (item) { values.push({ id: item.id, type: 'Note', title: item.title || 'Untitled note', detail: item.body || '', at: item.updatedAt || item.createdAt }); });
    data.docs.forEach(function (item) { values.push({ id: item.id, type: 'Document', title: item.title || 'Untitled document', detail: item.body || '', at: item.updatedAt || item.createdAt }); });
    data.saved.forEach(function (item) { values.push({ id: item.id, type: 'Saved', title: item.title || item.url || 'Saved item', detail: item.body || item.url || '', at: item.updatedAt || item.createdAt }); });
    data.tasks.filter(function (task) { return task.status === 'done' || task.status === 'completed'; }).forEach(function (item) { values.push({ id: item.id, type: 'Completed', title: item.title, detail: item.notes || '', at: item.completedAt || item.createdAt }); });
    if (window.AeroKnowledge) window.AeroKnowledge.context('', 100).forEach(function (item) { values.push({ id: item.id, type: 'Imported', title: item.title || 'Imported context', detail: item.detail || '', at: item.createdAt || 0 }); });
    return values.sort(function (a, b) { return Number(b.at || 0) - Number(a.at || 0); });
  }

  function archive(data, vm) {
    var tab = vm.archiveTab || 'objects';
    var memories = data.aero && data.aero.memories ? data.aero.memories.slice().sort(function (a, b) { return Number(b.updatedAt || 0) - Number(a.updatedAt || 0); }) : [];
    var events = recentEvents(data);
    var objects = allObjects(data);
    var body = '';
    if (tab === 'activity') {
      body = events.length ? '<div class="archive-list">' + events.map(function (event) { return '<button type="button" data-action="open-activity" data-id="' + esc(event.id || '') + '" data-kind="' + esc(event.kind) + '"><span class="archive-icon' + (event.kind === 'success' ? ' is-success' : '') + '">' + icon(event.kind === 'success' ? 'check' : event.kind === 'file' ? 'file' : 'clock') + '</span><span><b>' + esc(event.title) + '</b><small>' + esc(event.detail) + '</small></span><time>' + esc(relative(event.at)) + '</time></button>'; }).join('') + '</div>' : '<div class="route-empty compact"><h2>No activity yet</h2></div>';
    } else if (tab === 'memory') {
      body = memories.length ? '<div class="memory-grid">' + memories.map(function (memory) { return '<article class="memory-card"><div><span>' + esc(memory.type || 'semantic') + '</span><span class="memory-status is-' + esc(memory.status || 'active') + '">' + esc(memory.status || 'active') + '</span></div><p>' + esc(memory.claim) + '</p><footer><small>' + Math.round(Number(memory.confidence || 0) * 100) + '% confidence</small><button type="button" data-action="forget-memory" data-id="' + esc(memory.id) + '" aria-label="Forget this memory">' + icon('trash') + '</button></footer></article>'; }).join('') + '</div>' : '<div class="route-empty compact"><span class="empty-mark">' + icon('memory') + '</span><h2>No active memory</h2></div>';
    } else {
      body = objects.length ? '<div class="archive-list">' + objects.map(function (item) { return '<button type="button" data-action="open-object" data-id="' + esc(item.id) + '"><span class="archive-icon">' + icon('file') + '</span><span><b>' + esc(item.title) + '</b><small>' + esc(item.type) + (item.detail ? ' · ' + esc(item.detail.slice(0, 70)) : '') + '</small></span><time>' + esc(relative(item.at)) + '</time></button>'; }).join('') + '</div>' : '<div class="route-empty compact"><h2>No objects yet</h2><button type="button" data-action="quick-note">Add a note</button></div>';
    }
    return '<section class="route-head archive-head"><div><p class="eyebrow">Archive</p><h1>Find anything.</h1></div><button class="route-action ghost" type="button" data-action="search">' + icon('search') + 'Search</button></section>' +
      '<div class="archive-tabs" role="tablist" aria-label="Archive views"><button type="button" role="tab" data-action="archive-tab" data-tab="objects" aria-selected="' + (tab === 'objects') + '" class="' + (tab === 'objects' ? 'is-active' : '') + '">Objects <span>' + objects.length + '</span></button><button type="button" role="tab" data-action="archive-tab" data-tab="activity" aria-selected="' + (tab === 'activity') + '" class="' + (tab === 'activity' ? 'is-active' : '') + '">Activity <span>' + events.length + '</span></button><button type="button" role="tab" data-action="archive-tab" data-tab="memory" aria-selected="' + (tab === 'memory') + '" class="' + (tab === 'memory' ? 'is-active' : '') + '">Memory <span>' + memories.length + '</span></button></div>' + body;
  }

  function sourceRow(key, label, detail, enabled, connected) {
    var control = connected === false
      ? '<button class="source-connect" type="button" data-action="connect-source" data-source="' + esc(key) + '">Connect</button>'
      : '<button class="switch' + (enabled ? ' is-on' : '') + '" type="button" role="switch" aria-label="Use ' + esc(label) + ' in context" aria-checked="' + enabled + '" data-action="toggle-source" data-source="' + esc(key) + '"><span></span></button>';
    return '<div class="setting-row"><span class="setting-icon">' + icon(key === 'gmail' ? 'mail' : key === 'knowledge' ? 'memory' : key === 'connect' ? 'user' : key === 'library' ? 'file' : 'layers') + '</span><span class="setting-copy"><b>' + esc(label) + '</b><small>' + esc(detail) + '</small></span><span class="setting-state">' + (connected === false ? 'Off' : '') + '</span>' + control + '</div>';
  }

  function settings(data, vm) {
    var settings = data.settings || {};
    var sources = settings.aeroSources || {};
    var account = vm.account;
    var memories = data.aero && data.aero.memories ? data.aero.memories.filter(function (item) { return item.status === 'active' || item.status === 'provisional'; }).length : 0;
    var connect = window.AeroStore.getConnect && window.AeroStore.getConnect();
    var peopleCount = connect && typeof connect === 'object' ? [connect.conversations, connect.contacts, connect.profiles, connect.notifications].reduce(function (sum, items) { return sum + (Array.isArray(items) ? items.length : 0); }, 0) : 0;
    var mailConnected = !!(window.LyfeCloud && window.LyfeCloud.gmailToken);
    var mailCount = window.AeroStore.getGmail ? window.AeroStore.getGmail().length : 0;
    var importedCount = window.AeroKnowledge ? Number(window.AeroKnowledge.stats().records || 0) : 0;
    var cloudOn = settings.aeroCloudEnabled === true && settings.provider !== 'offline';
    var attentionOn = settings.aeroProactiveMode !== 'off';
    return '<section class="route-head settings-head"><div><p class="eyebrow">Settings</p><h1>Your Aero.</h1></div></section>' +
      '<div class="settings-layout"><nav class="settings-nav" aria-label="Settings sections"><button type="button" data-action="settings-jump" data-target="account">Account</button><button type="button" data-action="settings-jump" data-target="sources">Sources</button><button type="button" data-action="settings-jump" data-target="intelligence">Intelligence</button><button type="button" data-action="settings-jump" data-target="privacy">Privacy</button></nav><div class="settings-content">' +
      '<section class="settings-section" id="account"><div class="settings-title"><h2>Account</h2></div><div class="settings-card profile-setting"><span class="profile-large">' + esc((displayName(data, account).slice(0, 2)).toUpperCase()) + '</span><span><b>' + esc(settings.name || account && account.name || 'Local profile') + '</b><small>' + esc(account && account.email || (vm.authStatus === 'cloud' ? 'Private account' : 'This device')) + '</small></span><button type="button" data-action="account">' + (vm.authStatus === 'cloud' ? 'Manage' : 'Sign in') + '</button></div></section>' +
      '<section class="settings-section" id="sources"><div class="settings-title"><h2>Sources</h2><small>' + vm.context.count + ' available</small></div><div class="settings-card rows">' +
      sourceRow('tracking', 'Work', data.tasks.length + ' loops · ' + data.projects.length + ' workspaces', sources.tracking !== false, true) +
      sourceRow('library', 'Files', (data.notes.length + data.docs.length + data.saved.length + importedCount) + ' objects', sources.library !== false, true) +
      sourceRow('gmail', 'Mail', mailConnected ? mailCount + ' recent messages in view' : 'Connect only when you want mail in context', sources.gmail !== false, mailConnected) +
      sourceRow('connect', 'People', peopleCount + ' conversations and collaborators', sources.connect !== false, true) +
      sourceRow('knowledge', 'Memory', memories + ' active memories', sources.knowledge !== false, true) + '</div></section>' +
      '<section class="settings-section" id="intelligence"><div class="settings-title"><h2>Intelligence</h2></div><div class="settings-card rows"><button class="setting-row is-button" type="button" data-action="model-policy"><span class="setting-icon">' + icon('sliders') + '</span><span class="setting-copy"><b>Model policy</b><small>' + (cloudOn ? 'Local context · protected specialist for clean prompts' : 'On-device only') + '</small></span><span class="setting-state">' + (cloudOn ? 'Automatic' : 'Local') + '</span>' + icon('chevron') + '</button><div class="setting-row"><span class="setting-icon">' + icon('memory') + '</span><span class="setting-copy"><b>Adaptive memory</b><small>Learn only from outcomes you confirm</small></span><span></span><button class="switch' + (settings.aeroLocalLearning !== false ? ' is-on' : '') + '" type="button" role="switch" aria-label="Adaptive memory" aria-checked="' + (settings.aeroLocalLearning !== false) + '" data-action="toggle-setting" data-setting="aeroLocalLearning"><span></span></button></div><div class="setting-row"><span class="setting-icon">' + icon('bell') + '</span><span class="setting-copy"><b>Brief updates</b><small>One normally · a second only when critical</small></span><span></span><button class="switch' + (attentionOn ? ' is-on' : '') + '" type="button" role="switch" aria-label="Brief updates" aria-checked="' + attentionOn + '" data-action="toggle-attention"><span></span></button></div></div></section>' +
      '<section class="settings-section" id="privacy"><div class="settings-title"><h2>Privacy</h2></div><div class="settings-card rows"><button class="setting-row is-button" type="button" data-action="export-data"><span class="setting-icon">' + icon('file') + '</span><span class="setting-copy"><b>Export your data</b><small>One readable JSON file</small></span>' + icon('chevron') + '</button><button class="setting-row is-button" type="button" data-action="privacy"><span class="setting-icon">' + icon('shield') + '</span><span class="setting-copy"><b>Action controls</b><small>Every write is previewed and bound to approval</small></span>' + icon('chevron') + '</button></div></section>' +
      '</div></div>';
  }

  function assistantPanel(result) {
    var meta = result.plan && result.plan.engine === 'groq' ? 'Protected specialist' : 'On-device';
    return '<section class="side-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><header><span class="sheet-brand"><img src="' + esc(shellAsset('brand-mark.svg')) + '" alt="">Aero</span><button type="button" data-action="close-sheet" aria-label="Close">' + icon('close') + '</button></header><div class="sheet-body response-body"><p class="sheet-kicker">' + esc(meta) + '</p><h2 id="sheet-title">' + esc(result.answer) + '</h2>' + (result.decision && result.decision.mode === 'clarify' ? '<div class="response-chips"><button type="button" data-action="composer-fill" data-value="Create a task">Create a task</button><button type="button" data-action="composer-fill" data-value="Save a note">Save a note</button></div>' : '') + '</div><footer class="sheet-footer"><button class="sheet-secondary" type="button" data-action="close-sheet">Done</button></footer></section>';
  }

  function actionValue(action) {
    return action.title || action.name || action.claim || action.query || action.text || action.body || 'Item';
  }

  var actionLabels = {
    add_task: "Create task", complete_task: "Complete task", add_note: "Save note",
    add_doc: "Create document", add_project: "Create workspace", add_goal: "Set goal",
    add_education: "Track learning", log_work: "Log work", memory_upsert: "Remember",
    memory_forget: "Forget memory",
  };

  function actionDetails(action) {
    var details = [];
    if (action.due) details.push("Due " + dateLabel(action.due));
    if (action.priority) details.push(action.priority + " priority");
    if (action.hours != null) details.push(action.hours + (Number(action.hours) === 1 ? " hour" : " hours"));
    if (action.date) details.push(dateLabel(action.date));
    if (action.scope && action.scope !== "global") details.push("Scope " + action.scope);
    return details.join(" · ");
  }

  function stepList(run, review, history) {
    return '<ol class="review-list">' + run.steps.map(function (step, index) {
      var action = step.action;
      var item = review && review[index];
      var subject = item && item.subject || actionValue(action);
      var detail = actionDetails(action);
      var body = action.body || action.description || "";
      var status = step.status === "succeeded" ? "Applied" : step.status === "proposed" ? "Awaiting review" : step.status.replace(/-/g, " ");
      return '<li><article><b>' + esc(actionLabels[action.type] || "Change") + '</b>'
        + (subject !== "Item" ? '<p>' + esc(subject) + '</p>' : '')
        + (body && body !== subject && !history ? '<p class="review-preview">' + esc(body) + '</p>' : '')
        + (detail ? '<small>' + esc(detail) + '</small>' : '')
        + (history ? '<small class="step-status">' + esc(status) + '</small>' : '')
        + '</article></li>';
    }).join('') + '</ol>';
  }

  function reviewPanel(prepared) {
    var run = prepared.run;
    var safe = run.flowDecision && run.flowDecision.ok;
    var count = run.steps.length;
    var summary = count + (count === 1 ? " change" : " changes");
    var boundary = prepared.presenceRequired ? "Device verification required" : "Applies as one change set";
    if (!safe) boundary = run.flowDecision && run.flowDecision.violations[0]
      ? run.flowDecision.violations[0].message : "Plan blocked";
    return '<section class="side-sheet review-sheet" role="dialog" aria-modal="true" aria-labelledby="review-title">'
      + '<header><span class="sheet-brand">Review</span><button type="button" data-action="close-sheet" aria-label="Close">' + icon('close') + '</button></header>'
      + '<div class="sheet-body"><h2 id="review-title">' + esc(summary) + '</h2>' + stepList(run, prepared.authority === "server" ? prepared.review : null, false)
      + '<div class="approval-boundary ' + (safe ? 'is-safe' : 'is-blocked') + '">' + icon(safe ? 'shield' : 'close') + '<b>' + esc(boundary) + '</b></div></div>'
      + '<footer class="sheet-footer"><button class="sheet-secondary" type="button" data-action="cancel-run" data-run="' + esc(run.id) + '">Cancel</button>'
      + '<button class="sheet-primary" type="button" data-action="approve-run" data-run="' + esc(run.id) + '"' + (safe ? '' : ' disabled') + '>'
      + (prepared.presenceRequired ? 'Verify and apply' : 'Apply ' + summary) + '</button></footer></section>';
  }

  function receiptPanel(result) {
    var run = result.run;
    var unknown = result.status === "uncertain";
    var receipt = result.receipt || window.AeroHarness.receipt(run);
    var verified = run.status === "completed" && !!(receipt && receipt.certified);
    var rolledBack = !result.authoritative && run.transaction.state === "rolled-back";
    var stopped = !!(receipt && receipt.stopped) || rolledBack;
    var failure = (result.failures || [])[0];
    var iconName = unknown ? "clock" : verified || stopped || result.noop ? "check" : "close";
    var tone = unknown ? "is-pending" : verified || stopped || result.noop ? "is-success" : "is-failed";
    var title = "Review the outcome";
    var detail = failure || "Aero couldn’t verify completion.";
    var action = '<button class="sheet-primary wide" type="button" data-action="close-sheet">Done</button>';
    if (unknown) {
      title = "Outcome unconfirmed";
      detail = "Check the account record before applying this change again.";
      action = '<button class="sheet-secondary" type="button" data-action="close-sheet">Close</button>'
        + '<button class="sheet-primary" type="button" data-action="reconcile-run" data-run="' + esc(run.id) + '">Check status</button>';
    } else if (verified) {
      title = receipt.completed + (receipt.completed === 1 ? " change applied" : " changes applied");
      detail = result.recovered ? "Verified after reconnect." : "Verified.";
    } else if (stopped) {
      title = "No changes applied";
      detail = failure || (rolledBack ? "Aero restored the original state." : "The account record confirms the plan stopped.");
      if (run.remote && (run.remote.phase === "stale" || run.remote.phase === "expired")) {
        action = '<button class="sheet-secondary" type="button" data-action="close-sheet">Close</button>'
          + '<button class="sheet-primary" type="button" data-action="edit-run" data-run="' + esc(run.id) + '">Edit request</button>';
      }
    } else if (result.noop) {
      title = "Memory is up to date";
      detail = "This request didn’t require any changes.";
    }
    return '<section class="side-sheet receipt-sheet" role="dialog" aria-modal="true" aria-labelledby="receipt-title">'
      + '<header><span class="sheet-brand">Aero</span><button type="button" data-action="close-sheet" aria-label="Close">' + icon('close') + '</button></header>'
      + '<div class="sheet-body"><span class="receipt-mark ' + tone + '">' + icon(iconName) + '</span>'
      + '<h2 id="receipt-title">' + esc(title) + '</h2><p class="receipt-detail">' + esc(detail) + '</p></div>'
      + '<footer class="sheet-footer">' + action + '</footer></section>';
  }

  function runPanel(run) {
    var recovery = window.AeroService.recoveryState(run.id);
    var checking = recovery && (recovery.phase === "committing" || recovery.phase === "uncertain");
    var resumable = run.status === "awaiting-approval" && run.flowDecision && run.flowDecision.ok;
    var stopped = run.remote && (run.remote.phase === "stale" || run.remote.phase === "expired");
    var status = checking ? "Outcome unconfirmed" : run.status === "completed" ? (run.remote && run.remote.recovered ? "Verified after reconnect" : "Completed")
      : run.status === "cancelled" ? "Cancelled" : run.status === "failed" ? "Stopped" : run.status === "running" ? "Applying" : "Awaiting review";
    var primary = '<button type="button" data-action="close-sheet">Done</button>';
    if (checking) primary = '<button type="button" data-action="reconcile-run" data-run="' + esc(run.id) + '">Check status</button>';
    else if (resumable) primary = '<button type="button" data-action="reprepare-run" data-run="' + esc(run.id) + '">' + (recovery ? 'Review again' : 'Review plan') + '</button>';
    else if (stopped) primary = '<button type="button" data-action="edit-run" data-run="' + esc(run.id) + '">Edit request</button>';
    return '<section class="modal-card detail-card run-detail-card" role="dialog" aria-modal="true" aria-labelledby="run-title">'
      + '<header><span class="detail-type">' + esc(status) + '</span><button type="button" data-action="close-sheet" aria-label="Close">' + icon('close') + '</button></header>'
      + '<div class="run-detail-scroll"><h2 id="run-title">' + esc(run.intent || 'Aero change') + '</h2>'
      + (stopped && run.failure ? '<p>' + esc(run.failure.message) + '</p>' : '') + stepList(run, null, true) + '</div>'
      + '<footer>' + primary + '</footer></section>';
  }

  function contextPanel(summary) {
    return '<section class="side-sheet" role="dialog" aria-modal="true" aria-labelledby="context-title"><header><span class="sheet-brand"><img src="' + esc(shellAsset('brand-mark.svg')) + '" alt="">Context</span><button type="button" data-action="close-sheet" aria-label="Close">' + icon('close') + '</button></header><div class="sheet-body"><p class="sheet-kicker">In view</p><h2 id="context-title">' + summary.count + ' trusted sources</h2><div class="source-list">' + summary.sources.map(function (source) { return '<div><span class="source-dot"></span><b>' + esc(source.label) + '</b><small>' + source.count + ' item' + (source.count === 1 ? '' : 's') + '</small></div>'; }).join('') + '</div></div><footer class="sheet-footer"><button class="sheet-secondary" type="button" data-route="settings">Manage sources</button><button class="sheet-primary" type="button" data-action="close-sheet">Done</button></footer></section>';
  }

  function attentionPanel(data) {
    var state = window.AeroAttention ? window.AeroAttention.normalize(data.aeroAttention) : data.aeroAttention || { notifications: [] };
    var items = state.notifications || [];
    var body = items.length ? '<div class="attention-list">' + items.map(function (item) {
      return '<article class="attention-item urgency-' + esc(item.urgency) + (item.read ? ' is-read' : '') + '"><button type="button" data-action="attention-open" data-id="' + esc(item.id) + '" data-source="' + esc(item.sourceType) + '" data-ref="' + esc(item.sourceRef) + '"><span>' + esc(item.urgency === 'critical' ? 'Critical' : item.urgency === 'urgent' ? 'Now' : 'Update') + '</span><b>' + esc(item.title) + '</b><small>' + esc(item.detail) + '</small></button><button class="attention-dismiss" type="button" data-action="attention-dismiss" data-id="' + esc(item.id) + '" aria-label="Dismiss ' + esc(item.title) + '">' + icon('close') + '</button></article>';
    }).join('') + '</div>' : '<div class="attention-empty"><span>' + icon('check') + '</span><h2>All clear.</h2></div>';
    return '<section class="side-sheet attention-sheet" role="dialog" aria-modal="true" aria-labelledby="attention-title"><header><span class="sheet-brand"><img src="' + esc(shellAsset('brand-mark.svg')) + '" alt="">Updates</span><button type="button" data-action="close-sheet" aria-label="Close">' + icon('close') + '</button></header><div class="sheet-body"><p class="sheet-kicker">Quiet by default</p><h2 id="attention-title">What needs you.</h2>' + body + '</div><footer class="sheet-footer"><button class="sheet-secondary" type="button" data-action="attention-read-all">Mark all read</button><button class="sheet-primary" type="button" data-action="close-sheet">Done</button></footer></section>';
  }

  function quickForm(kind, projectId) {
    var projectField = projectId ? '<input type="hidden" name="projectId" value="' + esc(projectId) + '">' : '';
    var labels = { task: ['New loop', 'What needs to move?', 'Add loop'], project: ['New workspace', 'Name this workspace', 'Create'], note: ['New note', 'What should be kept?', 'Save note'] };
    var copy = labels[kind] || labels.task;
    return '<section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="quick-title"><header><h2 id="quick-title">' + copy[0] + '</h2><button type="button" data-action="close-sheet" aria-label="Close">' + icon('close') + '</button></header><form data-form="quick" data-kind="' + esc(kind) + '">' + projectField + '<label><span>' + copy[1] + '</span><input name="title" maxlength="240" autofocus autocomplete="off" required></label>' + (kind === 'task' ? '<div class="form-split"><label><span>Due</span><input name="due" type="date"></label><label><span>Priority</span><select name="priority"><option>Medium</option><option>High</option><option>Low</option></select></label></div>' : kind === 'note' ? '<label><span>Details</span><textarea name="body" rows="5"></textarea></label>' : '<label><span>Description</span><textarea name="description" rows="4"></textarea></label>') + '<footer><button type="button" data-action="close-sheet">Cancel</button><button type="submit">' + copy[2] + '</button></footer></form></section>';
  }

  function accountPanel(vm) {
    if (vm.authStatus === 'cloud') return '<section class="modal-card account-card" role="dialog" aria-modal="true" aria-labelledby="account-title"><header><h2 id="account-title">Account</h2><button type="button" data-action="close-sheet" aria-label="Close">' + icon('close') + '</button></header><div class="account-profile"><span>' + esc((vm.account && vm.account.name || 'AA').slice(0, 2).toUpperCase()) + '</span><div><b>' + esc(vm.account && vm.account.name || 'Aero account') + '</b><small>' + esc(vm.account && vm.account.email || '') + '</small></div></div><form data-form="profile-name"><label><span>Display name</span><input type="text" name="name" maxlength="60" required value="' + esc(window.AeroStore.get().settings.name || vm.account && vm.account.name || '') + '"></label><button type="submit">Save</button></form><button class="danger-button" type="button" data-action="sign-out">Sign out</button></section>';
    return '<section class="modal-card account-card" role="dialog" aria-modal="true" aria-labelledby="account-title"><header><h2 id="account-title">Sign in</h2><button type="button" data-action="close-sheet" aria-label="Close">' + icon('close') + '</button></header><p>Sync this private workspace across your devices.</p><button class="google-button" type="button" data-action="sign-in-google">Continue with Google</button><div class="account-divider"><span>or</span></div><form data-form="sign-in-email"><label><span>Email</span><input type="email" name="email" autocomplete="email" required placeholder="you@example.com"></label><button type="submit">Send code</button></form></section>';
  }

  function otpPanel(email) {
    return '<section class="modal-card account-card" role="dialog" aria-modal="true" aria-labelledby="otp-title"><header><h2 id="otp-title">Enter the code</h2><button type="button" data-action="close-sheet" aria-label="Close">' + icon('close') + '</button></header><p>Sent to ' + esc(email) + '.</p><form data-form="auth-otp"><input type="hidden" name="email" value="' + esc(email) + '"><label><span>Six-digit code</span><input type="text" name="token" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" autofocus required placeholder="000000"></label><button type="submit">Verify</button></form></section>';
  }

  function searchPanel(data, query) {
    var mail = window.AeroStore.getGmail ? window.AeroStore.getGmail() : [];
    var all = allObjects(data).concat(data.projects.map(function (item) { return { id: item.id, type: 'Workspace', title: item.name || item.title, detail: item.description || '', at: item.updatedAt || item.createdAt }; })).concat(data.tasks.map(function (item) { return { id: item.id, type: 'Loop', title: item.title, detail: item.notes || '', at: item.completedAt || item.createdAt }; })).concat(mail.map(function (item) { return { id: item.id, type: 'Mail', title: item.subject || '(no subject)', detail: (item.sender || '') + (item.snippet ? ' · ' + item.snippet : ''), at: item.date ? Date.parse(item.date) : 0 }; }));
    var needle = String(query || '').toLowerCase().trim();
    var results = needle ? all.filter(function (item) { return (item.title + ' ' + item.detail + ' ' + item.type).toLowerCase().indexOf(needle) >= 0; }).slice(0, 12) : all.slice(0, 8);
    return '<section class="search-dialog" role="dialog" aria-modal="true" aria-label="Search Aero"><div class="search-input">' + icon('search') + '<input type="search" data-search-input value="' + esc(query || '') + '" placeholder="Search anything" autocomplete="off"><button type="button" data-action="close-sheet" aria-label="Close search">' + icon('close') + '</button></div><div class="search-results">' + (results.length ? results.map(function (item) { return '<button type="button" data-action="search-result" data-id="' + esc(item.id) + '" data-type="' + esc(item.type) + '"><span>' + esc(item.type) + '</span><b>' + esc(item.title) + '</b><small>' + esc(item.detail.slice(0, 90)) + '</small></button>'; }).join('') : '<div class="search-empty">No match.</div>') + '</div></section>';
  }

  window.AeroViews = {
    now: now,
    work: work,
    project: project,
    archive: archive,
    settings: settings,
    assistantPanel: assistantPanel,
    reviewPanel: reviewPanel,
    receiptPanel: receiptPanel,
    runPanel: runPanel,
    contextPanel: contextPanel,
    attentionPanel: attentionPanel,
    quickForm: quickForm,
    accountPanel: accountPanel,
    otpPanel: otpPanel,
    searchPanel: searchPanel,
    esc: esc,
    icon: icon,
    allObjects: allObjects,
  };
})();
