const STORAGE_KEY = "lyfe.aero.v0.state";
const LEGACY_STORAGE_KEY = "lyfe.aero.v0.frutiger-state";

const surfaceData = {
  Aero: {
    icon: "◉",
    title: "Across your workspace",
    subtitle: "Aero can see the connected picture",
    hint: "Context from Today, Tracking, Library, Connect, and Gmail is available.",
    welcome: "Good morning. I’m carrying the context.",
    briefing: "What deserves your attention",
    items: [
      ["Tracking", "Aero launch · 3 open decisions", "now", "#28b6e2"],
      ["Library", "Memory research · 6 notes", "18m", "#68c83d"],
      ["Connect", "Collaborator · waiting on direction", "42m", "#f2b92c"],
      ["Gmail", "2 drafts · none sent", "1h", "#2388df"],
      ["Today", "Build block · 11:20-12:50", "today", "#55b94c"],
      ["Pattern", "You decide faster after comparison", "7×", "#9b79d0"]
    ]
  },
  Today: {
    icon: "☀",
    title: "Today",
    subtitle: "Schedule, focus, and current commitments",
    hint: "Aero is weighting your calendar, active tasks, energy pattern, and recent promises.",
    welcome: "Your day has one clean build window.",
    briefing: "Protect today’s highest-leverage work",
    items: [
      ["Focus", "Build Aero context contract", "11:20", "#62c93f"],
      ["Decision", "Launch memo scope", "before 2", "#25b4e2"],
      ["Meeting", "Team weekly check-in", "3:30", "#f0b72a"],
      ["Energy", "Deep-work peak", "90m", "#8b79d1"]
    ]
  },
  Connect: {
    icon: "●",
    title: "Connect",
    subtitle: "People, conversations, and commitments",
    hint: "Aero is grounding replies in the open conversation and relevant shared work.",
    welcome: "I can carry the relationship context.",
    briefing: "Conversations that need a useful next move",
    items: [
      ["Collaborator", "Waiting on narrower launch framing", "42m", "#f0b42a"],
      ["Maya", "Shared launch checklist", "1d", "#2db6df"],
      ["Promise", "Send architecture summary", "today", "#69c63d"]
    ]
  },
  Tracking: {
    icon: "✓",
    title: "Tracking",
    subtitle: "Tasks, projects, goals, and work history",
    hint: "Aero is reading the active project, dependencies, and your work cadence.",
    welcome: "The project state is already in view.",
    briefing: "Move the Aero launch project forward",
    items: [
      ["Project", "Aero launch · active", "now", "#26b6e1"],
      ["Blocked", "Context contract needs decision", "2d", "#efb429"],
      ["Goal", "Prove less-said / same-intent", "v0", "#67c93d"],
      ["History", "3 focused sessions this week", "4.8h", "#8c78d2"]
    ]
  },
  Library: {
    icon: "◆",
    title: "Library",
    subtitle: "Notes, documents, and saved evidence",
    hint: "Aero is using the open note set and preserving source-level provenance.",
    welcome: "Your source material is organized around the decision.",
    briefing: "Turn research into a build decision",
    items: [
      ["Note", "Memory promotion rules", "18m", "#62c73c"],
      ["Note", "Clarification under uncertainty", "1d", "#2db4df"],
      ["Doc", "Aero architecture v0", "2d", "#287fdb"],
      ["Conflict", "Two notes disagree", "open", "#efb52b"]
    ]
  },
  Gmail: {
    icon: "✉",
    title: "Gmail",
    subtitle: "Threads and drafts, never silent sends",
    hint: "Aero can read relevant threads and prepare drafts. Sending always remains explicit.",
    welcome: "I know the thread, but you keep the send button.",
    briefing: "Clear the inbox without losing intent",
    items: [
      ["Thread", "Collaborator · launch memo", "42m", "#efb52b"],
      ["Draft", "Architecture summary", "saved", "#2ab5df"],
      ["Follow-up", "Maya · launch checklist", "tomorrow", "#65c73d"]
    ]
  }
};

const defaultState = {
  activeSurface: "Aero",
  memoryFilter: "active",
  metrics: { commands: 8, words: 46, clarifications: 1, corrections: 0, accepted: 7, undone: 0 },
  memories: [
    { id: "project-aero", type: "project", title: "Aero v0 proves communication compression", detail: "The test is fewer explicit words without lower intent accuracy.", evidence: 6, status: "active", icon: "↗", color: "#29b8df" },
    { id: "procedure-draft", type: "procedural", title: "Prepare before acting externally", detail: "For messages and email, show a grounded draft and wait for approval.", evidence: 11, status: "active", icon: "✓", color: "#61c83e" },
    { id: "semantic-compare", type: "semantic", title: "Comparison helps you decide", detail: "When evidence conflicts, surface the disagreement before recommending.", evidence: 7, status: "active", icon: "≋", color: "#8e78cf" },
    { id: "candidate-build", type: "procedural", title: "Move shallow tasks before a build block", detail: "Observed three times; not yet allowed to reschedule automatically.", evidence: 3, status: "candidate", icon: "+", color: "#efb82e" }
  ],
  episodes: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY));
    if (!saved) return structuredClone(defaultState);
    return {
      ...structuredClone(defaultState),
      ...saved,
      metrics: { ...defaultState.metrics, ...(saved.metrics || {}) },
      memories: Array.isArray(saved.memories) ? saved.memories : structuredClone(defaultState.memories),
      episodes: Array.isArray(saved.episodes) ? saved.episodes : []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

let state = loadState();
let toastTimer;
let recognition = null;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function openLiveAero() {
  const prompt = $("#commandInput").value.trim();
  const source = String(state.activeSurface || "Today").toLowerCase();
  try {
    sessionStorage.setItem("lyfe.aero.launch", JSON.stringify({ prompt, source, ts: Date.now() }));
  } catch { /* the Aero route still opens without the handoff */ }
  const allowed = ["today", "tracking", "library", "connect", "gmail", "profile"];
  const aeroFrom = allowed.includes(source) ? source : "today";
  location.href = `../app/?aeroFrom=${encodeURIComponent(aeroFrom)}#/aero`;
}

function toggleVoice() {
  if (recognition) {
    try { recognition.stop(); } catch { /* already ending */ }
    recognition = null;
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    showToast("Voice input is not available in this browser. You can type instead.");
    return;
  }
  recognition = new Recognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = true;
  recognition.onresult = event => {
    let text = "";
    for (let i = event.resultIndex; i < event.results.length; i++) text += event.results[i][0].transcript;
    $("#commandInput").value = text.trim();
    resizeTextarea();
  };
  recognition.onerror = () => { recognition = null; showToast("Voice input stopped."); };
  recognition.onend = () => { recognition = null; };
  recognition.start();
  showToast("Listening...");
}

function renderSurface(surface, announce = false) {
  const config = surfaceData[surface] || surfaceData.Aero;
  state.activeSurface = surface;
  $$(".surface-nav button").forEach(button => {
    const active = button.dataset.surface === surface;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("#surfaceIcon").textContent = config.icon;
  $("#surfaceTitle").textContent = config.title;
  $("#surfaceSubtitle").textContent = config.subtitle;
  $("#commandHint").textContent = config.hint;
  $("#welcomeTitle").textContent = config.welcome;
  $("#briefingTitle").textContent = config.briefing;
  $("#contextStack").innerHTML = config.items.map(([source, label, time, color]) => `
    <div class="context-item" style="--source:${color}">
      <span class="source-dot"></span>
      <div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(source)}</small></div>
      <time>${escapeHtml(time)}</time>
    </div>`).join("");
  if (announce) showToast(`${surface} context is now in view.`);
  saveState();
}

function renderMemories() {
  const visible = state.memories.filter(memory => memory.status === state.memoryFilter);
  $("#candidateCount").textContent = state.memories.filter(memory => memory.status === "candidate").length;
  $$("[data-memory-filter]").forEach(button => button.classList.toggle("is-active", button.dataset.memoryFilter === state.memoryFilter));
  $("#memoryList").innerHTML = visible.length ? visible.map(memory => `
    <article class="memory-card">
      <span class="memory-seed" style="--memory-color:${memory.color}">${memory.icon}</span>
      <div>
        <strong>${escapeHtml(memory.title)}</strong>
        <p>${escapeHtml(memory.detail)}</p>
        <div class="memory-meta"><span class="memory-type">${escapeHtml(memory.type)}</span><span>${memory.evidence} evidence points</span></div>
        <div class="memory-buttons">
          ${memory.status === "candidate" ? `<button data-memory-action="confirm" data-memory-id="${memory.id}">Let this grow</button>` : `<button data-memory-action="inspect" data-memory-id="${memory.id}">Why?</button>`}
          <button data-memory-action="forget" data-memory-id="${memory.id}">Forget</button>
        </div>
      </div>
    </article>`).join("") : `<div class="empty-memory">Nothing is waiting here. Aero only proposes a memory after repeated, useful evidence.</div>`;
}

function updateMetrics() {
  const firstPass = Math.max(70, Math.min(99, Math.round(94 - state.metrics.corrections * 2 + Math.min(3, state.metrics.accepted / 8))));
  const compression = Math.max(0, Math.min(48, Math.round(18 + state.metrics.accepted * .7 - state.metrics.corrections * 2)));
  $("#intentMetric").textContent = `${firstPass}%`;
  $("#clarificationMetric").textContent = `${state.metrics.clarifications} / ${state.metrics.commands}`;
  $("#correctionMetric").textContent = state.metrics.corrections;
  $("#compressionValue").textContent = `${compression}%`;
  $("#compressionCopy").textContent = `Aero resolved ${state.metrics.accepted} familiar requests without making you restate the background.`;
}

function responseShell(query, intent, confidence, risk, sources, body) {
  const riskClass = risk === "read-only" ? "risk-read" : "risk-draft";
  return `
    <div class="response-topline">
      <span class="query">${escapeHtml(query)}</span>
      <button class="text-button" data-response-action="reset">Back to briefing</button>
    </div>
    <div class="intent-strip">
      <span class="intent-chip"><strong>Intent</strong> ${escapeHtml(intent)}</span>
      <span class="intent-chip"><strong>Confidence</strong> ${Math.round(confidence * 100)}%</span>
      <span class="intent-chip ${riskClass}"><strong>Risk</strong> ${escapeHtml(risk)}</span>
      ${sources.map(source => `<span class="intent-chip">${escapeHtml(source)}</span>`).join("")}
    </div>
    <div class="aero-answer">${body}</div>`;
}

function showResponse(html) {
  $("#priorityGrid").hidden = true;
  const zone = $("#responseZone");
  zone.hidden = false;
  zone.innerHTML = html;
  zone.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function resetBriefing() {
  $("#responseZone").hidden = true;
  $("#responseZone").innerHTML = "";
  $("#priorityGrid").hidden = false;
}

function logEpisode(command, intent, outcome, clarification = false) {
  state.episodes.unshift({ at: new Date().toISOString(), command, intent, outcome, surface: state.activeSurface, clarification });
  state.episodes = state.episodes.slice(0, 30);
  saveState();
}

function recordCommand(command) {
  const words = command.trim().split(/\s+/).filter(Boolean).length;
  state.metrics.commands += 1;
  state.metrics.words += words;
  saveState();
  updateMetrics();
}

function draftFollowUp(query) {
  const body = `
    <div class="action-proposal">
      <span class="eyebrow">Safe action proposal · Gmail draft</span>
      <h3>Follow up on the launch memo</h3>
      <p>I used the latest Connect thread, the Aero launch decision, and your draft-first preference. This creates a draft only.</p>
      <div class="proposal-preview"><strong>Subject: Narrower Aero launch direction</strong>\n\nI’ve narrowed v0 to one proof: whether Aero lets one person say less over time without lowering intent accuracy. External actions stay draft-first, with clarification, correction, and undo rates visible.</div>
      <div class="proposal-actions">
        <button class="proposal-action primary" data-action="approve" data-kind="gmail-draft">Create Gmail draft</button>
        <button class="proposal-action" data-action="edit">Adjust tone</button>
        <button class="proposal-action" data-response-action="reset">Cancel</button>
      </div>
    </div>`;
  showResponse(responseShell(query, "prepare a grounded follow-up", .96, "draft-only", ["Connect", "Tracking", "Gmail"], body));
  logEpisode(query, "follow-up", "proposed");
}

function askFollowUpClarification(query) {
  state.metrics.clarifications += 1;
  updateMetrics();
  const body = `
    <div class="clarification-card">
      <span class="eyebrow">One detail changes the outcome</span>
      <h3>Which open follow-up?</h3>
      <p>I found two plausible threads. I won’t guess because they involve different people and projects.</p>
      <div class="choice-row">
        <button class="choice-button" data-choice="follow up about the launch memo">Collaborator · launch memo</button>
        <button class="choice-button" data-choice="follow up with Maya about the launch checklist">Maya · launch checklist</button>
      </div>
    </div>`;
  showResponse(responseShell(query, "follow up", .61, "clarification needed", ["Connect", "Gmail"], body));
  logEpisode(query, "follow-up", "clarified", true);
}

function compareResearch(query) {
  const body = `
    <p><strong>The disagreement is about promotion, not storage.</strong> Both notes support retaining low-cost evidence. They differ on when a recurring observation becomes an active rule.</p>
    <div class="answer-list">
      <div class="answer-item"><span>Note A · permissive</span><p>Promote after repeated co-occurrence so the agent becomes useful quickly.</p></div>
      <div class="answer-item"><span>Note B · governed</span><p>Keep the pattern quarantined until reuse improves outcomes and the user has a visible correction path.</p></div>
      <div class="answer-item"><span>Aero decision</span><p>Store the evidence episodically, but promote to procedural memory only after repeated benefit, low contradiction, and an explicit user-visible candidate stage.</p></div>
    </div>
    <div class="action-proposal">
      <h3>Turn this into the v0 memory rule?</h3>
      <p>I can prepare a Library note and link it to the Aero launch project. Both actions are reversible.</p>
      <div class="proposal-actions"><button class="proposal-action safe" data-action="approve" data-kind="library-note">Save linked note</button><button class="proposal-action" data-response-action="reset">Not now</button></div>
    </div>`;
  showResponse(responseShell(query, "compare evidence and decide", .93, "read-only", ["Library", "Aero project"], body));
  logEpisode(query, "compare research", "answered");
}

function protectBuildBlock(query) {
  const body = `
    <div class="action-proposal">
      <span class="eyebrow">Reversible plan · preview only</span>
      <h3>Protect 11:20-12:50 for Aero</h3>
      <p>Move three shallow tasks after 4 PM, mute non-urgent reminders, and keep the launch decision at 1:40 PM. No task change occurs until you approve.</p>
      <div class="answer-list">
        <div class="answer-item"><span>Move</span><p>Inbox cleanup · asset naming · saved-item triage</p></div>
        <div class="answer-item"><span>Keep</span><p>Aero context contract · launch decision · team check-in</p></div>
      </div>
      <div class="proposal-actions"><button class="proposal-action safe" data-action="approve" data-kind="task-plan">Apply reversible task plan</button><button class="proposal-action" data-action="edit">Change the window</button></div>
    </div>`;
  showResponse(responseShell(query, "protect focused work", .91, "reversible", ["Today", "Tracking", "work pattern"], body));
  logEpisode(query, "protect build block", "proposed");
}

function whatMatters(query) {
  const body = `
    <p><strong>One decision, one build block, one relationship move.</strong> Everything else can wait.</p>
    <div class="answer-list">
      <div class="answer-item"><span>Decide</span><p>Use governed memory promotion for v0: evidence can accumulate silently; active behavioral rules cannot.</p></div>
      <div class="answer-item"><span>Build</span><p>Implement the context contract and event trace during the 11:20 focus window.</p></div>
      <div class="answer-item"><span>Communicate</span><p>Prepare the follow-up after the decision so the message carries the actual scope.</p></div>
    </div>`;
  showResponse(responseShell(query, "prioritize current work", .95, "read-only", ["Today", "Tracking", "Connect"], body));
  logEpisode(query, "prioritize", "answered");
}

function sameAsLastTime(query) {
  const body = `
    <div class="action-proposal">
      <span class="eyebrow">Reused procedure · evidence 5×</span>
      <h3>Weekly project reset</h3>
      <p>I matched this to your last five Thursday resets: review changes, name the blocking decision, protect one build block, then draft the stakeholder update.</p>
      <div class="proposal-actions"><button class="proposal-action safe" data-action="approve" data-kind="weekly-reset">Open the reusable workflow</button><button class="proposal-action" data-action="correct">That’s not what I meant</button></div>
    </div>`;
  showResponse(responseShell(query, "reuse a familiar workflow", .88, "reversible", ["procedural memory", "Tracking", "Today"], body));
  logEpisode(query, "reuse procedure", "proposed");
}

function mayaFollowUp(query) {
  const body = `
    <div class="action-proposal">
      <span class="eyebrow">Safe action proposal · Connect draft</span>
      <h3>Follow up with Maya on the launch checklist</h3>
      <p>I found the shared checklist and your last promise. This prepares a draft in Connect; it does not send.</p>
      <div class="proposal-preview">I reviewed the launch checklist. The identity and interaction shell are ready; backend wiring and account migration are still open. I’ll mark owners on those two next.</div>
      <div class="proposal-actions"><button class="proposal-action primary" data-action="approve" data-kind="connect-draft">Create Connect draft</button><button class="proposal-action" data-action="edit">Adjust</button></div>
    </div>`;
  showResponse(responseShell(query, "prepare a grounded follow-up", .92, "draft-only", ["Connect", "Tracking"], body));
  logEpisode(query, "follow-up", "proposed");
}

function genericAnswer(query) {
  const surface = surfaceData[state.activeSurface];
  const body = `
    <p>I treated this as a request about <strong>${escapeHtml(surface.title)}</strong> and used the current surface plus linked project context. The intent is still broad, so I’m showing the assumption instead of acting.</p>
    <div class="clarification-card">
      <h3>What outcome should I optimize?</h3>
      <div class="choice-row"><button class="choice-button" data-choice="what matters now">Choose priorities</button><button class="choice-button" data-choice="compare my memory research notes">Resolve evidence</button><button class="choice-button" data-choice="protect my build block">Protect time</button></div>
    </div>`;
  showResponse(responseShell(query, "understand an open request", .57, "clarification needed", [surface.title], body));
  state.metrics.clarifications += 1;
  updateMetrics();
  logEpisode(query, "open request", "clarified", true);
}

function executeCommand(raw) {
  const query = raw.trim();
  if (!query) return;
  recordCommand(query);
  const command = query.toLowerCase();

  if (command === "follow up" || command === "follow-up" || command === "followup") askFollowUpClarification(query);
  else if (command.includes("follow") && command.includes("maya")) mayaFollowUp(query);
  else if (command.includes("follow") || command.includes("arjun") || command.includes("email")) draftFollowUp(query);
  else if (command.includes("compare") || command.includes("research note") || command.includes("disagree")) compareResearch(query);
  else if (command.includes("protect") || command.includes("build block") || command.includes("focus")) protectBuildBlock(query);
  else if (command.includes("same as") || command.includes("last time") || command.includes("weekly reset")) sameAsLastTime(query);
  else if (command.includes("matter") || command.includes("priority") || command.includes("what now")) whatMatters(query);
  else genericAnswer(query);

  $("#commandInput").value = "";
  resizeTextarea();
}

function approveAction(kind) {
  state.metrics.accepted += 1;
  updateMetrics();
  const labels = {
    "gmail-draft": "Gmail draft created, not sent.",
    "connect-draft": "Connect draft created, not sent.",
    "library-note": "Library note saved and linked to the Aero project.",
    "task-plan": "Task plan applied. Every move can be undone.",
    "weekly-reset": "Reusable weekly reset opened in Tracking."
  };
  const label = labels[kind] || "Action completed.";
  logEpisode(kind, "approved action", label);
  showResponse(responseShell(label, "confirmed safe action", 1, "completed", ["human approved"], `
    <div class="action-proposal">
      <span class="eyebrow">Done · with an audit trail</span>
      <h3>${escapeHtml(label)}</h3>
      <p>Aero recorded the context, inference, proposed action, and your confirmation. This outcome may strengthen the related procedure; it will not silently create a new rule.</p>
      <div class="proposal-actions"><button class="proposal-action" data-action="undo" data-kind="${escapeHtml(kind)}">Undo</button><button class="proposal-action safe" data-response-action="reset">Back to briefing</button></div>
    </div>`));
  showToast(label);
  saveState();
}

function showLearningTrace() {
  const latest = state.episodes.slice(0, 6);
  const lines = latest.length ? latest.map((episode, index) => `${index + 1}. ${episode.surface} · ${episode.intent} → ${episode.outcome}${episode.clarification ? " · clarified" : ""}`).join("\n") : "No local interactions recorded yet.";
  showResponse(responseShell("Learning trace", "inspect adaptation", 1, "read-only", ["local v0 telemetry"], `
    <p>This v0 records only the minimum evidence needed to test communication compression. It separates what Aero observed from what it inferred and what you approved.</p>
    <div class="trace-panel">commands: ${state.metrics.commands}\nwords supplied: ${state.metrics.words}\nclarifications: ${state.metrics.clarifications}\ncorrections: ${state.metrics.corrections}\napproved proposals: ${state.metrics.accepted}\nundos: ${state.metrics.undone}\n\n${escapeHtml(lines)}</div>`));
}

function resizeTextarea() {
  const input = $("#commandInput");
  input.style.height = "auto";
  input.style.height = `${Math.min(110, Math.max(40, input.scrollHeight))}px`;
}

$("#commandForm").addEventListener("submit", event => {
  event.preventDefault();
  executeCommand($("#commandInput").value);
});

$("#commandInput").addEventListener("input", resizeTextarea);
$("#commandInput").addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("#commandForm").requestSubmit();
  }
});

document.addEventListener("click", event => {
  const surfaceButton = event.target.closest("[data-surface]");
  if (surfaceButton) {
    renderSurface(surfaceButton.dataset.surface, true);
    resetBriefing();
    return;
  }

  const commandButton = event.target.closest("[data-command]");
  if (commandButton) {
    executeCommand(commandButton.dataset.command);
    return;
  }

  const choiceButton = event.target.closest("[data-choice]");
  if (choiceButton) {
    executeCommand(choiceButton.dataset.choice);
    return;
  }

  const filterButton = event.target.closest("[data-memory-filter]");
  if (filterButton) {
    state.memoryFilter = filterButton.dataset.memoryFilter;
    renderMemories();
    saveState();
    return;
  }

  const memoryButton = event.target.closest("[data-memory-action]");
  if (memoryButton) {
    const memory = state.memories.find(item => item.id === memoryButton.dataset.memoryId);
    if (!memory) return;
    const action = memoryButton.dataset.memoryAction;
    if (action === "confirm") {
      memory.status = "active";
      state.memoryFilter = "active";
      showToast("Memory promoted with your approval.");
    } else if (action === "forget") {
      state.memories = state.memories.filter(item => item.id !== memory.id);
      showToast("Memory removed from Aero v0.");
    } else {
      showToast(`${memory.evidence} evidence points support this memory; open the trace for details.`);
    }
    renderMemories();
    saveState();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "approve") approveAction(actionButton.dataset.kind);
    else if (action === "undo") {
      state.metrics.undone += 1;
      showToast("Undone. The reversal is recorded, not treated as a failure.");
      logEpisode(actionButton.dataset.kind, "undo", "reversed");
      updateMetrics();
      resetBriefing();
    } else if (action === "correct") {
      state.metrics.corrections += 1;
      state.metrics.clarifications += 1;
      updateMetrics();
      showToast("Correction recorded. Aero will not promote that match.");
      genericAnswer("That’s not what I meant");
    } else {
      showToast("In the live build, Aero would open an editable preview here.");
    }
    saveState();
    return;
  }

  if (event.target.closest("[data-response-action='reset']")) resetBriefing();
});

$("#provenanceButton").addEventListener("click", () => {
  const panel = $("#provenance");
  panel.hidden = !panel.hidden;
  $("#provenanceButton").textContent = panel.hidden ? "See why this context was chosen" : "Hide context explanation";
});

$("#collapseContext").addEventListener("click", () => {
  const collapsed = $("#contextRail").classList.toggle("is-collapsed");
  $("#collapseContext").textContent = collapsed ? "+" : "−";
  $("#collapseContext").setAttribute("aria-label", collapsed ? "Expand context" : "Collapse context");
});

$("#healthButton").addEventListener("click", () => {
  const expanded = $("#healthButton").getAttribute("aria-expanded") === "true";
  $("#healthButton").setAttribute("aria-expanded", String(!expanded));
  $("#provenance").hidden = expanded;
  if (!expanded) $("#contextRail").scrollIntoView({ behavior: "smooth", block: "nearest" });
});

$("#voiceButton").addEventListener("click", toggleVoice);
$("#openLyfeButton").addEventListener("click", openLiveAero);
$("#topOpenLyfe").addEventListener("click", event => { event.preventDefault(); openLiveAero(); });
$("#memoryControl").addEventListener("click", () => {
  state.memoryFilter = "candidate";
  renderMemories();
  showToast("Candidate memories stay quarantined until you approve them.");
});
$("#telemetryButton").addEventListener("click", showLearningTrace);

renderSurface(state.activeSurface);
renderMemories();
updateMetrics();
