/* public/firebase-messaging-sw.js */

importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCtm-vD0drZ2Ym78TYRiwfEvbLbGf4AoWU",
  authDomain: "ai-companion-mvp-f01e4.firebaseapp.com",
  projectId: "ai-companion-mvp-f01e4",
  storageBucket: "ai-companion-mvp-f01e4.firebasestorage.app",
  messagingSenderId: "927725018231",
  appId: "1:927725018231:web:54f227ba1f7c5b11aaba72",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle =
    payload.notification?.title || payload.data?.title || "Close Too You";

  const notificationOptions = {
    body:
      payload.notification?.body ||
      payload.data?.body ||
      "You have a new message.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: {
      url: payload.data?.url || "/",
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      }
    )
  );
});