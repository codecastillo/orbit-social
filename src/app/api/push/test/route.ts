import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/services/web-push";

export const runtime = "nodejs";

/**
 * Send a test push to every subscription owned by the calling user.
 * Useful for verifying the pipeline end-to-end after VAPID + service-worker setup.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: "no subscriptions" });
  }

  const results = await Promise.all(
    subs.map((s) =>
      sendPush(s, {
        title: "Orbit",
        body: "Push notifications are working.",
        url: "/feed",
        tag: "orbit-test",
      })
    )
  );

  // Garbage-collect dead subscriptions (browser revoked / app uninstalled).
  const expiredIds = subs
    .map((s, i) => ({ id: s.id, status: results[i] }))
    .filter((r) => r.status === "expired")
    .map((r) => r.id);
  if (expiredIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", expiredIds);
  }

  return NextResponse.json({
    ok: true,
    sent: results.filter((r) => r === "sent").length,
    expired: expiredIds.length,
    error: results.filter((r) => r === "error").length,
  });
}
