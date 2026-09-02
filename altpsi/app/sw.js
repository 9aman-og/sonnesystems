"use strict";

const CACHE = "altpsi-aero-clean-room-1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./supabase-config.js?v=aero-clean-1",
  "./cloud.js?v=aero-clean-1",
  "./aero-eval.js?v=aero-clean-1",
  "./aero-core.js?v=aero-clean-1",
  "./aero-harness.js?v=aero-clean-1",
  "./aero-knowledge.js?v=aero-clean-1",
  "../app-next/brand-mark.svg",
  "../app-next/brand-maskable.svg",
  "../app-next/styles.css?v=clean-room-1",
  "../app-next/core/store.js?v=aero-clean-1",
  "../app-next/core/aero.js?v=aero-clean-1",
  "../app-next/ui/views.js?v=aero-clean-1",
  "../app-next/app.js?v=aero-clean-1",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url)))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => /^(?:lyfe|altpsi)-/.test(key) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  const isDocument = request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
  if (isDocument) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).then((response) => {
        if (url.pathname.endsWith("/app/") || url.pathname.endsWith("/app/index.html")) {
          caches.open(CACHE).then((cache) => cache.put("./index.html", response.clone())).catch(() => {});
        }
        return response;
      }).catch(() => caches.match(request).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  if (url.pathname.endsWith("supabase-config.js")) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).then((response) => {
        caches.open(CACHE).then((cache) => cache.put(request, response.clone())).catch(() => {});
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        caches.open(CACHE).then((cache) => cache.put(request, response.clone())).catch(() => {});
      }
      return response;
    }))
  );
});
