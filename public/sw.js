// =========================================================================
// Service Worker for Lab AP PWA & Background Push Notifications
// Allows native OS notifications & standalone app installation
// =========================================================================

const CACHE_NAME = "lab-ap-v1";

// Service Worker Install
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Service Worker Activate
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle Background Push Event
self.addEventListener("push", (event) => {
  let payload = {
    title: "🔔 Notifikasi Lab AP",
    body: "Ada pembaruan jadwal jaga!",
    url: "/jadwal-jaga",
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: "/logo.png",
    badge: "/logo.png",
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || "/jadwal-jaga",
    },
    actions: [
      { action: "open", title: "Buka Aplikasi" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Handle Notification Click (Open or Focus Window)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : "/jadwal-jaga";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
