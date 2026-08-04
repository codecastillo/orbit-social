// Public, logged-out-accessible page. Static server component: no "use
// client", no data fetching, so it prerenders at build time.
import type { Metadata } from "next";
import Link from "next/link";

const title = "Ten promises";
const description =
  "Orbit's ten product promises: a chronological Following feed, no paid reach, no silent punishment, no AI training on your content, and seven more commitments you can hold us to.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/promises" },
  openGraph: { title, description },
  twitter: { title, description },
};

const promises: { title: string; body: string }[] = [
  {
    title: "Your Following feed is chronological and complete.",
    body: "Every post from every account you follow, newest first, with nothing injected and nothing hidden. When you pick Following, the choice sticks.",
  },
  {
    title: "Distribution is never for sale.",
    body: "Nobody can pay to be seen more, and nobody gets buried for not paying. If Orbit ever sells a subscription, it buys features, not reach.",
  },
  {
    title: "No silent punishment.",
    body: "Every enforcement action against your account is visible in your account status, with the reason stated. Appeals are answered by a human.",
  },
  {
    title: "No AI training on your content.",
    body: "Your posts, photos, clips, and voice are not training data, ours or anyone else's. And no tool on Orbit will generatively edit a real person's likeness.",
  },
  {
    title: "No manufactured obligation.",
    body: "No streaks, no guilt mechanics. Read receipts and activity status are reciprocal, always yours to switch off, and never used to pull you back in.",
  },
  {
    title: "One encode ladder for everyone.",
    body: "A creator with ten followers gets the same video quality as one with ten million. Nothing you upload gets retroactively cropped or degraded.",
  },
  {
    title: "Navigation is your property.",
    body: "Tabs and buttons stay where you left them. If a layout ever has to change, the change is announced and comes with a revert.",
  },
  {
    title: "Commerce stays in Marketplace.",
    body: "Buying and selling live in Marketplace, on its own tab. The feed carries none of it.",
  },
  {
    title: "Search that actually works.",
    body: "Search exists to find what you asked for, and we treat a search that stops working as a bug, not a redesign opportunity.",
  },
  {
    title: "Your identity is protected by default.",
    body: "Location stays off unless you turn it on. Changes to your settings are auditable, so nothing about your account shifts without a trace.",
  },
];

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

/* Numbered marker in the satellite-dot motif: a ringed circle with the small
   filled satellite at 1-2 o'clock, same shape as the stories ring. */
function PromiseMarker({ index }: { index: number }) {
  return (
    <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-primary">
      <span className="font-mono text-[14px] font-bold text-primary">
        {String(index).padStart(2, "0")}
      </span>
      <span className="absolute -right-px -top-px h-2.5 w-2.5 rounded-full bg-primary" />
    </div>
  );
}

export default function PromisesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[720px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <LogoMark />
            <span className="text-[16px] font-bold tracking-tight text-foreground">
              Orbit
            </span>
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground no-underline"
          >
            Get started
          </Link>
        </div>
      </nav>

      <main id="main-content" className="mx-auto max-w-[720px] px-6 pb-24">
        <header className="landing-fade-in pt-16 sm:pt-20">
          <p className="mb-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Orbit · The contract
          </p>
          <h1 className="text-[clamp(2.25rem,7vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.035em] text-foreground">
            Ten <span className="text-primary">promises</span>.
          </h1>
          <p className="mt-5 max-w-[560px] text-[15.5px] leading-relaxed text-text-secondary">
            These are commitments, not marketing. They describe how Orbit
            works and how it will keep working, written so you can hold us to
            them. If we ever break one, we expect to hear about it.
          </p>
        </header>

        <ol className="landing-reveal m-0 mt-14 flex list-none flex-col p-0 sm:mt-16">
          {promises.map((promise, i) => (
            <li
              key={promise.title}
              className={`flex gap-5 py-8 sm:gap-7 sm:py-9 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <PromiseMarker index={i + 1} />
              <div className="min-w-0 pt-1.5">
                <h2 className="text-[17px] font-bold leading-snug tracking-tight text-foreground sm:text-[19px]">
                  {promise.title}
                </h2>
                <p className="mt-2.5 max-w-[520px] text-[14px] leading-relaxed text-text-secondary">
                  {promise.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <footer className="mt-4 border-t border-border pt-8">
          <p className="max-w-[560px] text-[13.5px] leading-relaxed text-text-secondary">
            Promise three is checkable today: any action on your account shows
            up in{" "}
            <Link
              href="/settings/account-status"
              className="font-medium text-primary no-underline hover:underline"
            >
              your account status
            </Link>
            , with the reason and the appeal path.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 text-[13.5px]">
            <Link
              href="/terms"
              className="text-text-secondary no-underline hover:text-foreground"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-text-secondary no-underline hover:text-foreground"
            >
              Privacy Policy
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 font-mono text-[11px] tracking-wider text-text-faint">
            <span>© 2026 ORBIT LABS</span>
            <Link
              href="/"
              className="text-text-faint no-underline hover:text-foreground"
            >
              ORBIT.HOME
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
