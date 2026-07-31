/**
 * Delivery endpoint for Web Push. Notification rows are created by database
 * triggers, so a Supabase Database Webhook on INSERT INTO notifications posts
 * each new row here and this route fans it out to the recipient's push
 * subscriptions.
 *
 * Configure in Supabase: Database -> Webhooks -> notifications INSERT ->
 * https://<site>/api/push/notify with header x-webhook-secret set to the
 * PUSH_WEBHOOK_SECRET env var.
 */
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush, type PushPayload } from "@/lib/services/web-push";
import { Email } from "@/lib/services/email";

export const runtime = "nodejs";

interface NotificationRecord {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
}

// Types with a preference column honor it; everything else sends.
const PREF_COLUMN: Record<string, "likes" | "comments" | "follows" | "mentions" | "messages"> = {
  like: "likes",
  comment: "comments",
  follow: "follows",
  mention: "mentions",
  message: "messages",
};

function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function describe(
  record: NotificationRecord,
  actorName: string,
): { title: string; body: string; url: string } {
  const { type, entity_id } = record;
  const postUrl = entity_id ? `/post/${entity_id}` : "/notifications";
  switch (type) {
    case "like":
      return { title: actorName, body: "liked your post", url: postUrl };
    case "comment":
      return { title: actorName, body: "commented on your post", url: postUrl };
    case "follow":
      return { title: actorName, body: "followed you", url: "/notifications" };
    case "mention":
      return { title: actorName, body: "mentioned you", url: postUrl };
    case "repost":
      return { title: actorName, body: "reposted your post", url: postUrl };
    case "quote":
      return { title: actorName, body: "quoted your post", url: postUrl };
    case "message":
      return {
        title: actorName,
        body: "sent you a message",
        url: entity_id ? `/messages/${entity_id}` : "/messages",
      };
    case "live_started":
      return {
        title: actorName,
        body: "is live now",
        url: entity_id ? `/live/${entity_id}` : "/live",
      };
    case "community_invite":
      return {
        title: actorName,
        body: "invited you to a room",
        url: entity_id ? `/communities/${entity_id}` : "/communities",
      };
    case "event_invite":
      return {
        title: actorName,
        body: "invited you to an event",
        url: entity_id ? `/events/${entity_id}` : "/events",
      };
    case "event_reminder":
      return {
        title: "Event starting soon",
        body: "One of your events starts within 15 minutes",
        url: entity_id ? `/events/${entity_id}` : "/events",
      };
    default:
      return { title: actorName, body: "sent you a notification", url: "/notifications" };
  }
}

async function sendEventReminderEmail(
  admin: ReturnType<typeof createAdminClient>,
  record: NotificationRecord,
) {
  const [{ data: event }, { data: authUser }] = await Promise.all([
    admin
      .from("events")
      .select("title, start_at, location")
      .eq("id", record.entity_id!)
      .maybeSingle(),
    admin.auth.admin.getUserById(record.user_id),
  ]);
  const email = authUser?.user?.email;
  if (!event || !email) return;

  const startsAt = new Date(event.start_at).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  await Email.eventReminder(email, {
    eventTitle: event.title,
    eventStartsAt: startsAt,
    eventUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/events/${record.entity_id}`,
    venueLine: event.location ?? undefined,
  });
}

export async function POST(req: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (!secretsMatch(req.headers.get("x-webhook-secret"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const record: NotificationRecord | undefined = body?.record;
  if (body?.type !== "INSERT" || body?.table !== "notifications" || !record?.user_id) {
    return NextResponse.json({ error: "ignored" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Event reminders also go out by email; the reminder notification insert is
  // the one moment we know the event is imminent. Best effort, never blocks
  // the push path.
  if (record.type === "event_reminder" && record.entity_id) {
    sendEventReminderEmail(admin, record).catch((err) => {
      console.error("[push/notify] event reminder email failed:", err);
    });
  }

  const prefColumn = PREF_COLUMN[record.type];
  if (prefColumn) {
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select(prefColumn)
      .eq("user_id", record.user_id)
      .maybeSingle();
    const enabled = (prefs as Record<string, boolean | null> | null)?.[prefColumn];
    if (enabled === false) {
      return NextResponse.json({ ok: true, skipped: "preference" });
    }
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", record.user_id);
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no subscriptions" });
  }

  let actorName = "Orbit";
  if (record.actor_id) {
    const { data: actor } = await admin
      .from("profiles")
      .select("display_name, username")
      .eq("id", record.actor_id)
      .maybeSingle();
    if (actor) actorName = actor.display_name || `@${actor.username}`;
  }

  const { title, body: text, url } = describe(record, actorName);
  const payload: PushPayload = {
    title,
    body: text,
    url,
    icon: "/icons/icon-192.png",
    // Collapse repeat pushes of the same kind from the same actor.
    tag: `${record.type}:${record.actor_id ?? "system"}`,
  };

  const results = await Promise.all(subs.map((sub) => sendPush(sub, payload)));
  const expired = subs.filter((_, i) => results[i] === "expired").map((s) => s.id);
  if (expired.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expired);
  }

  const expoSent = await sendExpoPushes(admin, record.user_id, payload);

  return NextResponse.json({
    ok: true,
    sent: results.filter((r) => r === "sent").length,
    expoSent,
    pruned: expired.length,
  });
}

// Native devices register Expo push tokens (a different transport from the
// browser's Web Push subscriptions). Fan the same payload out to them via
// Expo's push API and prune tokens the service reports as dead.
async function sendExpoPushes(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  const { data: tokens } = await admin
    .from("expo_push_tokens")
    .select("token")
    .eq("user_id", userId);
  if (!tokens || tokens.length === 0) return 0;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    sound: "default" as const,
    data: { url: payload.url },
  }));

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    const result = (await res.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };

    const dead = (result.data ?? [])
      .map((ticket, i) =>
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered"
          ? tokens[i].token
          : null,
      )
      .filter((t): t is string => t !== null);
    if (dead.length > 0) {
      await admin.from("expo_push_tokens").delete().in("token", dead);
    }

    return (result.data ?? []).filter((t) => t.status === "ok").length;
  } catch (err) {
    console.error("[push/notify] expo push send failed:", err);
    return 0;
  }
}
