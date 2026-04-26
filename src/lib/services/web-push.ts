import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  tag?: string;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a payload to one subscription. Returns:
 *  - "sent" on success
 *  - "expired" on 410 Gone / 404 (caller should delete the row)
 *  - "error" on transient failure
 */
export async function sendPush(
  sub: PushSubscriptionRow,
  payload: PushPayload
): Promise<"sent" | "expired" | "error"> {
  if (!ensureConfigured()) return "error";
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
    return "sent";
  } catch (err: unknown) {
    const status =
      typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode: number }).statusCode
        : 0;
    if (status === 404 || status === 410) return "expired";
    return "error";
  }
}
