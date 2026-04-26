// Orbit service worker — handles incoming Web Push notifications.
// Registered by src/lib/hooks/use-push-subscribe.ts on first user opt-in.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Orbit", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Orbit";
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    tag: data.tag || undefined, // collapse same-tag notifications
    data: { url: data.url || "/" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          // If a tab is already open on the target URL, focus it.
          if (client.url.endsWith(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
