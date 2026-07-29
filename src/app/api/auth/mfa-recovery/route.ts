/**
 * Redeems an MFA recovery code for a user whose session passed the password
 * step but who lost access to their authenticator. A valid code is burned,
 * every TOTP factor is unenrolled, and the remaining codes are wiped, so the
 * account drops back to password-only auth and the user re-enrolls 2FA from
 * settings on a new device.
 */
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  // 16-char codes are current; 6-char accepted for pre-widening enrollments.
  if (!/^[A-Z0-9]{6,20}$/.test(code)) {
    return NextResponse.json({ error: "Invalid recovery code" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { success } = rateLimit(`mfa-recovery:${user.id}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!success) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const codeHash = createHash("sha256").update(code).digest("hex");
  const admin = createAdminClient();

  const { data: match, error: lookupError } = await admin
    .from("mfa_recovery_codes")
    .select("id")
    .eq("user_id", user.id)
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Could not verify code" }, { status: 500 });
  }
  if (!match) {
    return NextResponse.json({ error: "Invalid recovery code" }, { status: 400 });
  }

  const { data: factorData, error: factorsError } = await admin.auth.admin.mfa.listFactors({
    userId: user.id,
  });
  if (factorsError) {
    return NextResponse.json({ error: "Could not remove authenticator" }, { status: 500 });
  }

  // Unenroll first, wipe codes after: if a deleteFactor call fails midway,
  // the user keeps their codes and can simply retry.
  for (const factor of factorData?.factors ?? []) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: user.id,
    });
    if (deleteError) {
      return NextResponse.json({ error: "Could not remove authenticator" }, { status: 500 });
    }
  }

  // Every code was paired to the factors that no longer exist.
  await admin.from("mfa_recovery_codes").delete().eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
