/* Aero service worker - offline app shell for the installed Android/PWA app.
   HTML is network-first (always fresh when online); versioned assets cache-first. */
"use strict";

const CACHE = "altpsi-aero-core-36-connect-22";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=aero-core-29",
  "./supabase-config.js?v=aero-core-16",
  "./cloud.js?v=aero-core-18",
  "./aero-core.js?v=aero-core-15",
  "./aero-harness.js?v=aero-core-27",
  "./aero-eval.js?v=aero-core-2",
  "./aero-knowledge.js?v=aero-core-10",
  "./app.js?v=aero-core-34",
  "./connect.html",
  "./connect.css?v=connect22",
  "./connect-suite.css?v=connect22",
  "./connect.js?v=connect18",
  "./connect-suite.js?v=connect22",
  "./connect.webmanifest",
  "./privacy.html",
  "./legal.css?v=2",
  "../assets/connect_logo.png",
  "../assets/connect_logo.svg",
  "../assets/aero_logo.png",
  "../assets/aero_logo.svg",
  "../assets/altpsi_logo.svg",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => /^(?:lyfe|altpsi)-/.test(k) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // never touch the user's data or third-party APIs (Ollama, Wikipedia, fonts, photos)
  if (url.origin !== location.origin) return;

  const isDoc = req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isDoc) {
    // network-first so the app shell updates the moment you're online
    e.respondWith(
      fetch(req, { cache: "no-store" }).then((res) => {
        const copy = res.clone();
        const pageKey = url.pathname.endsWith("/connect.html") ? "./connect.html" : "./index.html";
        caches.open(CACHE).then((c) => c.put(pageKey, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((h) => h || caches.match("./index.html")))
    );
    return;
  }

  // the cloud config must never be served stale: filling in the Supabase keys
  // later has to take effect without bumping a version. Network-first, with the
  // cache only as an offline fallback.
  if (url.pathname.endsWith("supabase-config.js")) {
    e.respondWith(
      fetch(req, { cache: "no-store" }).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // versioned static assets: cache-first, then fill the cache
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => Response.error()))
  );
});
