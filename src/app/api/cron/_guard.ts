/**
 * Cron route guard.
 *
 * Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` to every
 * registered cron path WHEN the env var `CRON_SECRET` is set on the project.
 * Reject any request without that header so cron URLs aren't open endpoints.
 *
 * For manual debugging from a developer machine:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://orbit.app/api/cron/...
 */

import { NextResponse } from "next/server";

export function assertCronAuthorized(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on server" },
      { status: 500 }
    );
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
