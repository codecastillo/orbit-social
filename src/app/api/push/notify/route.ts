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
import { buildMutedWordMatcher } from "@/lib/utils/muted-words";

export const runtime = "nodejs";

interface NotificationRecord {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
}

// Types with a preference column honor it; everything else sends. Quote
// pushes ride the reposts toggle and both event types ride events: close
// enough that a separate column would just be noise.
const PREF_COLUMN: Record<string, string> = {
  like: "likes",
  comment: "comments",
  follow: "follows",
  // A follow request is the private-account form of a follow, so it rides
  // the same toggle rather than adding a column nobody would find.
  follow_request: "follows",
  mention: "mentions",
  message: "messages",
  repost: "reposts",
  quote: "reposts",
  story_reaction: "story_replies",
  live_started: "live_streams",
  community_invite: "communities",
  event_invite: "events",
  event_reminder: "events",
  new_post: "new_followers_posts",
  moment_prompt: "moment_prompts",
};

const MINUTES_PER_DAY = 24 * 60;

interface QuietHoursPrefs {
  quiet_hours_enabled: boolean | null;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  timezone_offset_minutes: number | null;
}

/**
 * True when the recipient's local wall-clock hour falls inside the
 * [start, end) quiet window. A window that wraps past midnight (start > end)
 * covers late evening through early morning; start === end is an empty
 * window and never suppresses.
 */
function inQuietHours(prefs: QuietHoursPrefs, now: Date): boolean {
  if (!prefs.quiet_hours_enabled) return false;
  const start = prefs.quiet_hours_start;
  const end = prefs.quiet_hours_end;
  if (start === null || end === null || start === end) return false;

  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const offset = prefs.timezone_offset_minutes ?? 0;
  const localMinutes =
    ((utcMinutes + offset) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const localHour = Math.floor(localMinutes / 60);

  return start < end
    ? localHour >= start && localHour < end
    : localHour >= start || localHour < end;
}

// Person-to-person types (message, mention, comment, follow) always push:
// someone deliberately reached out. Ambient activity is capped per recipient
// per ISO week so push notifications stay scarce and welcome instead of
// training people to disable them. moment_prompt stays out of the budget:
// the cron already fires it once a day and its own preference column is the
// off switch.
const AMBIENT_TYPES = new Set([
  "like",
  "repost",
  "quote",
  "live_started",
  "event_reminder",
  "community_invite",
  "event_invite",
  "story_reaction",
]);
const AMBIENT_WEEKLY_LIMIT = 3;

/** Monday of the current ISO week, as a YYYY-MM-DD date string (UTC). */
function isoWeekStart(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Checks and consumes one unit of the recipient's weekly ambient push
 * budget. Returns false once the cap is hit. Any read error (including the
 * push_budget table not being migrated yet) fails open and sends as before.
 */
async function consumeAmbientBudget(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<boolean> {
  const weekStart = isoWeekStart(new Date());
  const { data, error } = await admin
    .from("push_budget")
    .select("ambient_count")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) return true;

  const count = data?.ambient_count ?? 0;
  if (count >= AMBIENT_WEEKLY_LIMIT) return false;

  // Read-then-upsert can overshoot by one under concurrent webhook
  // deliveries; acceptable for a soft cap.
  const { error: writeError } = await admin
    .from("push_budget")
    .upsert(
      { user_id: userId, week_start: weekStart, ambient_count: count + 1 },
      { onConflict: "user_id,week_start" },
    );
  if (writeError) {
    console.error("[push/notify] budget increment failed:", writeError);
  }
  return true;
}

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
    case "follow_request":
      return {
        title: actorName,
        body: "requested to follow you",
        url: "/notifications/requests",
      };
    case "mention":
      return { title: actorName, body: "mentioned you", url: postUrl };
    case "repost":
      return { title: actorName, body: "reposted your post", url: postUrl };
    case "quote":
      return { title: actorName, body: "quoted your post", url: postUrl };
    case "new_post":
      return { title: actorName, body: "posted something new", url: postUrl };
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
    case "moment_prompt":
      return {
        title: "Time for today's moment",
        body: "Two minutes to post what you are doing right now",
        url: "/",
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
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select(
      `quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone_offset_minutes${prefColumn ? `, ${prefColumn}` : ""}`,
    )
    .eq("user_id", record.user_id)
    .maybeSingle();
  if (prefColumn) {
    const enabled = (prefs as Record<string, boolean | null> | null)?.[prefColumn];
    if (enabled === false) {
      return NextResponse.json({ ok: true, skipped: "preference" });
    }
  }

  // Message notifications carry the conversation id in entity_id (the
  // trigger in 20260501030000 inserts entity_type 'conversation'). The
  // trigger already skips muted members at insert time; this check also
  // covers rows created by older trigger versions and a member who muted
  // between insert and webhook delivery.
  if (record.type === "message" && record.entity_id) {
    const { data: membership } = await admin
      .from("conversation_members")
      .select("is_muted")
      .eq("conversation_id", record.entity_id)
      .eq("user_id", record.user_id)
      .maybeSingle();
    if (membership?.is_muted) {
      return NextResponse.json({ ok: true, skipped: "conversation muted" });
    }
  }

  // Muting someone stops their notifications, which is what the mute dialog
  // promises, and a block does the same for anything the actor slipped in
  // before it landed. mutes and blocks are own-rows RLS, so only the service
  // client can read them here. Checked before the budget so a suppressed
  // push does not burn the weekly ambient allowance.
  if (record.actor_id) {
    const [{ data: mute }, { data: block }] = await Promise.all([
      admin
        .from("mutes")
        .select("expires_at")
        .eq("user_id", record.user_id)
        .eq("muted_id", record.actor_id)
        .maybeSingle(),
      admin
        .from("blocks")
        .select("blocker_id")
        .eq("blocker_id", record.user_id)
        .eq("blocked_id", record.actor_id)
        .maybeSingle(),
    ]);
    const muteActive =
      mute !== null &&
      (mute.expires_at === null || new Date(mute.expires_at) > new Date());
    if (muteActive || block) {
      return NextResponse.json({
        ok: true,
        skipped: block ? "blocked actor" : "muted actor",
      });
    }
  }

  // Quiet hours suppress push delivery only; the in-app notification row
  // already exists. Checked before the budget so a suppressed push does not
  // burn the weekly ambient allowance.
  if (prefs && inQuietHours(prefs as unknown as QuietHoursPrefs, new Date())) {
    return NextResponse.json({ ok: true, skipped: "quiet hours" });
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

  // Muted words gate push the same way they hide content in-app: if the
  // preview we would show matches, stay silent. muted_words is own-rows RLS,
  // so only the service client can read them here. Checked before the budget
  // so a muted push does not burn the weekly ambient allowance.
  const { data: mutedRows } = await admin
    .from("muted_words")
    .select("word")
    .eq("user_id", record.user_id);
  const isMuted = buildMutedWordMatcher((mutedRows ?? []).map((r) => r.word));
  if (isMuted(`${title} ${text}`)) {
    return NextResponse.json({ ok: true, skipped: "muted words" });
  }

  // In-app notification rows are untouched by the budget; only push
  // delivery is skipped.
  if (AMBIENT_TYPES.has(record.type)) {
    const withinBudget = await consumeAmbientBudget(admin, record.user_id);
    if (!withinBudget) {
      return NextResponse.json({ ok: true, skipped: "budget" });
    }
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", record.user_id);
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no subscriptions" });
  }
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
