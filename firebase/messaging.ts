// firebase/messaging.ts

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { firebaseApp } from "./config";

export type PushPermissionResult = {
  ok: boolean;
  token?: string;
  error?: string;
  permission?: NotificationPermission;
};

function getVapidKey() {
  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() || "";
}

async function registerFirebaseMessagingServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser.");
  }

  return navigator.serviceWorker.register("/firebase-messaging-sw.js");
}

export async function requestPushNotificationPermission(): Promise<PushPermissionResult> {
  try {
    if (typeof window === "undefined") {
      return {
        ok: false,
        error: "Push notifications are only available in the browser.",
      };
    }

    if (!("Notification" in window)) {
      return {
        ok: false,
        error: "Notifications are not supported in this browser.",
      };
    }

    const supported = await isSupported();

    if (!supported) {
      return {
        ok: false,
        error: "Firebase messaging is not supported in this browser.",
      };
    }

    const vapidKey = getVapidKey();

    if (!vapidKey) {
      return {
        ok: false,
        error: "Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY.",
      };
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      return {
        ok: false,
        permission,
        error: "Notification permission was not granted.",
      };
    }

    const serviceWorkerRegistration =
      await registerFirebaseMessagingServiceWorker();

    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });

    if (!token) {
      return {
        ok: false,
        permission,
        error: "Firebase did not return a push token.",
      };
    }

    return {
      ok: true,
      token,
      permission,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not enable push notifications.",
    };
  }
}
