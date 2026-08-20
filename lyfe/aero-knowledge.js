/* ============================================================
   Aero Knowledge Vault v0.1

   Local-only import and retrieval for user-owned AI exports. Records live in
   IndexedDB, outside Lyfe's synced payload, and never leave the browser unless
   a later model call receives an explicitly permitted context pack.
   ============================================================ */
(function () {
  "use strict";

  var DB_NAME = "lyfe-aero-knowledge";
  var STORE = "records";
  var VERSION = 1;
  var activeOwner = "guest";
  var cache = [];
  var readyPromise = null;

  function clean(value, max) {
    return String(value == null ? "" : value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max || 12000);
  }

  function hash(value) {
    var h = 2166136261;
    value = String(value || "");
    for (var i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("This browser cannot open the local vault."));
      var request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("owner", "owner", { unique: false });
          store.createIndex("ownerSource", ["owner", "source"], { unique: false });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("The local vault could not open.")); };
    });
  }

  async function loadOwner() {
    var db = await openDb();
    cache = await new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readonly");
      var request = tx.objectStore(STORE).index("owner").getAll(activeOwner);
      request.onsuccess = function () { resolve(Array.isArray(request.result) ? request.result : []); };
      request.onerror = function () { reject(request.error); };
    });
    db.close();
    cache.sort(function (a, b) { return (b.createdAt || b.importedAt || 0) - (a.createdAt || a.importedAt || 0); });
    return cache;
  }

  function setOwner(owner) {
    activeOwner = clean(owner, 120) || "guest";
    readyPromise = loadOwner().catch(function () { cache = []; return cache; });
    return readyPromise;
  }

  function ready() {
    if (!readyPromise) readyPromise = loadOwner().catch(function () { cache = []; return cache; });
    return readyPromise;
  }

  function textParts(value, output, depth) {
    if (output.length >= 80 || depth > 8 || value == null) return;
    if (typeof value === "string" || typeof value === "number") {
      var part = clean(value, 5000);
      if (part) output.push(part);
      return;
    }
    if (Array.isArray(value)) {
      value.slice(0, 120).forEach(function (item) { textParts(item, output, depth + 1); });
      return;
    }
    if (typeof value === "object") {
      Object.keys(value).slice(0, 80).forEach(function (key) {
        if (/^(?:id|uuid|hash|account|device|client|session)$/i.test(key)) return;
        textParts(value[key], output, depth + 1);
      });
    }
  }

  function chatGptRecords(data, fileName) {
    if (!Array.isArray(data) || !data.some(function (item) { return item && item.mapping; })) return [];
    return data.slice(0, 4000).map(function (conversation, index) {
      var messages = Object.keys(conversation.mapping || {}).map(function (key) {
        var node = conversation.mapping[key] || {};
        var message = node.message;
        if (!message || !message.author || !message.content) return null;
        var parts = [];
        textParts(message.content.parts || message.content.text || message.content, parts, 0);
        if (!parts.length) return null;
        return {
          role: clean(message.author.role || "message", 24),
          text: parts.join("\n"),
          at: Number(message.create_time) || 0,
        };
      }).filter(Boolean).sort(function (a, b) { return a.at - b.at; });
      if (!messages.length) return null;
      var title = clean(conversation.title || "ChatGPT conversation " + (index + 1), 220);
      var body = messages.map(function (message) { return message.role + ": " + message.text; }).join("\n\n");
      return makeRecord("chatgpt", "ChatGPT", title, body, Number(conversation.create_time) * 1000 || 0, fileName);
    }).filter(Boolean);
  }

  function genericJsonRecords(data, source, sourceLabel, fileName) {
    var items = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : [data]);
    var records = [];
    items.slice(0, 4000).forEach(function (item, index) {
      if (item == null) return;
      var parts = [];
      textParts(item, parts, 0);
      var body = clean(parts.join("\n"), 30000);
      if (!body) return;
      var title = clean(item && (item.title || item.name || item.prompt), 220) || sourceLabel + " item " + (index + 1);
      var when = Date.parse(item && (item.time || item.timestamp || item.create_time || item.created_at || item.date)) || 0;
      records.push(makeRecord(source, sourceLabel, title, body, when, fileName));
    });
    return records;
  }

  function makeRecord(source, sourceLabel, title, body, createdAt, fileName) {
    body = clean(body, 30000);
    if (!body) return null;
    title = clean(title, 220) || "Imported context";
    var fingerprint = hash(source + "|" + title + "|" + body.slice(0, 6000));
    return {
      id: activeOwner + ":" + source + ":" + fingerprint,
      owner: activeOwner,
      source: source,
      sourceLabel: sourceLabel,
      title: title,
      body: body,
      createdAt: Number(createdAt) || 0,
      importedAt: Date.now(),
      fileName: clean(fileName, 240),
    };
  }

  function chunkText(source, sourceLabel, title, body, fileName) {
    body = clean(body, 2000000);
    var records = [];
    for (var at = 0; at < body.length && records.length < 500; at += 16000) {
      var chunk = body.slice(at, at + 18000);
      records.push(makeRecord(source, sourceLabel, title + (body.length > 18000 ? " · part " + (records.length + 1) : ""), chunk, 0, fileName));
    }
    return records.filter(Boolean);
  }

  async function parseFile(file) {
    if (!file || file.size > 30 * 1024 * 1024) throw new Error("Keep each import under 30 MB.");
    var name = clean(file.name || "import", 240);
    var lower = name.toLowerCase();
    var raw = await file.text();
    var looksGemini = /gemini|myactivity|my activity/.test(lower);
    var looksChatGpt = /chatgpt|conversations/.test(lower);
    if (/\.json$/i.test(lower) || /^[\s]*[\[{]/.test(raw)) {
      var data;
      try { data = JSON.parse(raw); }
      catch (error) { throw new Error(name + " is not valid JSON."); }
      var chatRecords = chatGptRecords(data, name);
      if (chatRecords.length) return chatRecords;
      return genericJsonRecords(data, looksGemini ? "gemini" : (looksChatGpt ? "chatgpt" : "import"), looksGemini ? "Gemini" : (looksChatGpt ? "ChatGPT" : "Imported file"), name);
    }
    if (/\.html?$/i.test(lower) || /<html|<!doctype/i.test(raw.slice(0, 1000))) {
      var doc = new DOMParser().parseFromString(raw, "text/html");
      doc.querySelectorAll("script,style,noscript,svg").forEach(function (node) { node.remove(); });
      return chunkText(looksGemini ? "gemini" : (looksChatGpt ? "chatgpt" : "import"), looksGemini ? "Gemini" : (looksChatGpt ? "ChatGPT" : "Imported file"), name.replace(/\.[^.]+$/, ""), doc.body ? doc.body.textContent : raw, name);
    }
    return chunkText(looksGemini ? "gemini" : (looksChatGpt ? "chatgpt" : "import"), looksGemini ? "Gemini" : (looksChatGpt ? "ChatGPT" : "Imported file"), name.replace(/\.[^.]+$/, ""), raw, name);
  }

  async function put(records) {
    records = records.filter(Boolean).slice(0, 5000);
    if (!records.length) return 0;
    var db = await openDb();
    await new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readwrite");
      var store = tx.objectStore(STORE);
      records.forEach(function (record) { store.put(record); });
      tx.oncomplete = resolve;
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
    });
    db.close();
    await loadOwner();
    return records.length;
  }

  async function importFiles(files) {
    await ready();
    var all = [];
    var list = Array.from(files || []).slice(0, 12);
    for (var i = 0; i < list.length; i += 1) all = all.concat(await parseFile(list[i]));
    var count = await put(all);
    return { imported: count, files: list.length, stats: stats() };
  }

  function tokens(value) {
    var stop = { the:1, and:1, for:1, that:1, this:1, with:1, what:1, when:1, where:1, from:1, have:1, about:1, into:1, your:1, you:1, did:1, say:1, said:1, know:1 };
    return Array.from(new Set(clean(value, 1000).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])).filter(function (word) { return !stop[word]; }).slice(0, 18);
  }

  function snippet(body, terms) {
    var lower = body.toLowerCase();
    var at = -1;
    terms.some(function (term) { at = lower.indexOf(term); return at >= 0; });
    at = Math.max(0, at < 0 ? 0 : at - 180);
    return clean((at ? "…" : "") + body.slice(at, at + 700) + (at + 700 < body.length ? "…" : ""), 760);
  }

  function context(query, limit) {
    var terms = tokens(query);
    var ranked = cache.map(function (record) {
      var title = record.title.toLowerCase();
      var body = record.body.toLowerCase();
      var score = terms.reduce(function (total, term) {
        return total + (title.indexOf(term) >= 0 ? 8 : 0) + (body.indexOf(term) >= 0 ? 2 : 0);
      }, 0);
      return { record: record, score: score };
    }).filter(function (item) { return !terms.length || item.score > 0; })
      .sort(function (a, b) { return b.score - a.score || (b.record.createdAt || b.record.importedAt || 0) - (a.record.createdAt || a.record.importedAt || 0); })
      .slice(0, Math.max(1, limit || 6));
    return ranked.map(function (item) {
      return {
        id: item.record.id,
        title: item.record.title,
        detail: snippet(item.record.body, terms),
        source: item.record.source,
        sourceLabel: item.record.sourceLabel,
        createdAt: item.record.createdAt,
      };
    });
  }

  function stats() {
    var bySource = {};
    cache.forEach(function (record) { bySource[record.source] = (bySource[record.source] || 0) + 1; });
    return { records: cache.length, sources: bySource, owner: activeOwner };
  }

  async function clear(source) {
    await ready();
    var db = await openDb();
    await new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readwrite");
      var store = tx.objectStore(STORE);
      cache.filter(function (record) { return !source || record.source === source; }).forEach(function (record) { store.delete(record.id); });
      tx.oncomplete = resolve;
      tx.onerror = function () { reject(tx.error); };
    });
    db.close();
    await loadOwner();
    return stats();
  }

  window.AeroKnowledge = {
    version: "aero-knowledge-v0.1",
    setOwner: setOwner,
    ready: ready,
    importFiles: importFiles,
    context: context,
    stats: stats,
    clear: clear,
  };
  setOwner("guest");
})();
