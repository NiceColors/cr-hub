// Service worker mínimo do CR Tracker: torna o app instalável e abre o PR ao
// clicar numa notificação. Não faz cache offline: a fila depende do servidor local.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const app = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (app) await app.focus();
      if (url) await self.clients.openWindow(url);
    })(),
  );
});
