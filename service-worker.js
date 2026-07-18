const CACHE_NAME = "jesters-grid-pwa-v37";
const APP_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/assets/skins/default/skin.css",
  "/assets/ui/luna-jax-character-reference.png",
  "/assets/ui/generated/home-jesters-layer.png",
  "/assets/ui/generated/menu-card-frame.png",
  "/assets/ui/generated/play-emblem.png",
  "/assets/ui/generated/solo-emblem.png",
  "/assets/ui/generated/ranked-emblem.png",
  "/assets/ui/generated/profile-frame.png",
  "/assets/ui/generated/round-button-frame.png",
  "/assets/ui/gameplay-generated/board-frame.png",
  "/assets/ui/gameplay-generated/tile-face.png",
  "/assets/ui/gameplay-generated/duelist-panel.png",
  "/assets/ui/gameplay-generated/message-scroll.png",
  "/assets/ui/gameplay-generated/game-card-frame.png",
  "/assets/ui/gameplay-generated/action-red.png",
  "/assets/ui/gameplay-generated/action-blue.png",
  "/assets/ui/gameplay-generated/token-medallion.png",
  "/assets/ui/gameplay-generated/jax-companion.png",
  "/assets/ui/gameplay-generated/card-art-1.png",
  "/assets/ui/gameplay-generated/card-art-2.png",
  "/assets/ui/gameplay-generated/card-art-3.png",
  "/assets/ui/gameplay-generated/card-art-4.png",
  "/assets/ui/gameplay-generated/card-art-5.png",
  "/assets/ui/gameplay-generated/card-art-6.png",
  "/assets/ui/gameplay-generated/card-art-7.png",
  "/assets/ui/gameplay-generated/card-art-8.png",
  "/assets/ui/gameplay-generated/card-art-9.png",
  "/assets/ui/gameplay-generated/card-art-10.png",
  "/assets/ui/gameplay-generated/card-art-11.png",
  "/assets/ui/gameplay-generated/card-art-12.png",
  "/assets/ui/gameplay-generated/card-art-13.png",
  "/assets/ui/gameplay-generated/card-art-14.png",
  "/client.js",
  "/manifest.webmanifest",
  "/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/healthz") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached || caches.match("/index.html")))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const roomCode = data.code || "";
  event.waitUntil(self.registration.showNotification(data.title || "Jester's Grid", {
    body: data.body || "A duelist is waiting in your room.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: roomCode ? `jg-room-${roomCode}` : "jg-room",
    requireInteraction: true,
    data: { url: data.url || "/" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
    })
  );
});
