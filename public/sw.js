// Drifty service worker: shows push notifications and opens the right room on tap.
// Notifications carry no message contents (see lib/push/rules.ts).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/app";
  event.waitUntil(
    self.registration.showNotification(data.title || "Drifty", {
      body: data.body || "Something changed in your client room.",
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      tag: data.tag || undefined,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/app", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url === url && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
