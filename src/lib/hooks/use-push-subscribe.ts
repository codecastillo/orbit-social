"use client";

import { useCallback, useEffect, useState } from "react";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type Status = "unsupported" | "default" | "denied" | "subscribed" | "loading";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const padded = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Manages the browser's Web Push subscription for the current user.
 *
 * - status === "unsupported" → browser/device doesn't support push (Safari iOS pre-16.4, etc.)
 * - status === "default"     → never asked; call subscribe() to prompt the user
 * - status === "denied"      → user said no (only changeable in browser settings)
 * - status === "subscribed"  → registered with the server
 *
 * Server registration goes to /api/push/subscribe.
 * The service worker at /sw.js must be deployed for this to work.
 */
export function usePushSubscribe() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC) {
      setStatus("unsupported");
      return;
    }
    const perm = Notification.permission;
    if (perm === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "subscribed" : "default"))
      .catch(() => setStatus("default"));
  }, []);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC) return false;
    try {
      const reg =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ||
        (await navigator.serviceWorker.register("/sw.js"));
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm as Status);
        return false;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("subscribed");
      return true;
    } catch {
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("default");
      return true;
    } catch {
      return false;
    }
  }, []);

  return { status, subscribe, unsubscribe };
}
