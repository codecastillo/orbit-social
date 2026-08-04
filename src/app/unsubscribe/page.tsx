/**
 * Human-facing unsubscribe landing. Reached from the link in the body of the
 * daily digest; the mailbox-provider one-click button hits
 * /api/unsubscribe instead.
 *
 * Deliberately session-free: the recipient is in their mail client, not
 * signed in, and an opt-out that demands a login is not a working opt-out.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Turn off the Orbit daily digest email.",
  robots: { index: false, follow: false },
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function unsubscribe(token: string | undefined): Promise<boolean> {
  if (!token || !UUID_PATTERN.test(token)) return false;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("unsubscribe_by_token", {
    p_token: token,
  });
  return !error && data === true;
}

function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <div
      className="relative rounded-lg bg-primary"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-[3px] rounded-[5px] border-[1.5px] border-primary-foreground/50" />
    </div>
  );
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const done = await unsubscribe(token);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[560px] items-center px-6">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <LogoMark />
            <span className="text-[16px] font-bold tracking-tight text-foreground">
              Orbit
            </span>
          </Link>
        </div>
      </nav>

      <main id="main-content" className="mx-auto max-w-[560px] px-6 pb-24 pt-20">
        <p className="mb-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Orbit · Email
        </p>
        {done ? (
          <>
            <h1 className="text-[clamp(2rem,6vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-foreground">
              You&apos;re <span className="text-primary">unsubscribed</span>.
            </h1>
            <p className="mt-5 text-[15.5px] leading-relaxed text-text-secondary">
              The Orbit daily digest is off for your account. Nothing else
              changed: your notifications still arrive in the app, and Orbit
              will still send you account email like password resets and
              security alerts.
            </p>
            <p className="mt-4 text-[15.5px] leading-relaxed text-text-secondary">
              Changed your mind? Turn the digest back on any time under{" "}
              <Link
                href="/settings/notifications"
                className="font-medium text-primary no-underline hover:underline"
              >
                notification settings
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[clamp(2rem,6vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-foreground">
              This link is <span className="text-primary">expired</span>.
            </h1>
            <p className="mt-5 text-[15.5px] leading-relaxed text-text-secondary">
              We couldn&apos;t match this unsubscribe link to an account. It
              may have been rewritten by your mail client, or the account it
              belonged to was deleted.
            </p>
            <p className="mt-4 text-[15.5px] leading-relaxed text-text-secondary">
              You can turn the digest off directly under{" "}
              <Link
                href="/settings/notifications"
                className="font-medium text-primary no-underline hover:underline"
              >
                notification settings
              </Link>
              .
            </p>
          </>
        )}

        <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 font-mono text-[11px] tracking-wider text-text-faint">
          <span>© 2026 ORBIT LABS</span>
          <Link
            href="/"
            className="text-text-faint no-underline hover:text-foreground"
          >
            ORBIT.HOME
          </Link>
        </div>
      </main>
    </div>
  );
}
