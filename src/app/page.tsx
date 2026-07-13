// Landing page is a Server Component: no "use client", no motion runtime in
// the bundle. Entrance animations are the CSS keyframes in globals.css
// (.landing-reveal / .landing-fade-in / .landing-scale-in).
import type { Metadata } from "next";
import Link from "next/link";
import {
  AudioLines,
  Calendar,
  Film,
  Globe,
  Heart,
  MessageCircle,
  Play,
  Repeat2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Orbit: The internet, but smaller",
  description:
    "A social platform built for people who are tired of shouting into the void. Feed, clips, rooms, live, and messages in one place. Start with one room, one post, one voice note.",
};

// Static reveal wrapper: each section fades and rises in on load with a
// staggered delay. The page is short enough that scroll-triggering added
// complexity for no payoff.
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`landing-reveal ${className ?? ""}`.trim()}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <div
      className="relative rounded-lg bg-primary"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-[3px] rounded-[5px] border-[1.5px] border-primary-foreground/50" />
    </div>
  );
}

function TopNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-7">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <LogoMark />
          <span className="text-[17px] font-bold tracking-tight text-foreground">
            Orbit
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-text-secondary no-underline hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground no-underline"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* Hero product mock: a feed card, a DM thread, and a live tile built from
   the real token system. Doubles as proof of the design language. */
function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-[440px]">
      {/* Feed card */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
            M
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight text-foreground">
              Maya Chen
            </p>
            <p className="font-mono text-[11px] leading-tight text-muted-foreground">
              @mayabuilds · 2h
            </p>
          </div>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-foreground">
          Shipped the new pottery batch. Kiln cam replay is up, thanks for
          watching the whole eight hours, you maniacs.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-1.5 overflow-hidden rounded-lg">
          <div className="aspect-square bg-surface-elevated" />
          <div className="aspect-square bg-primary/20" />
          <div className="aspect-square bg-surface-elevated" />
        </div>
        <div className="mt-3 flex items-center gap-5 text-muted-foreground">
          <span className="flex items-center gap-1.5 text-[12px]">
            <Heart className="h-3.5 w-3.5" /> 214
          </span>
          <span className="flex items-center gap-1.5 text-[12px]">
            <MessageCircle className="h-3.5 w-3.5" /> 18
          </span>
          <span className="flex items-center gap-1.5 text-[12px]">
            <Repeat2 className="h-3.5 w-3.5" /> 6
          </span>
        </div>
      </div>

      {/* DM thread */}
      <div className="relative z-10 -mt-3 ml-8 rounded-xl border border-border bg-surface-elevated p-3.5 shadow-lg">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Messages
        </p>
        <div className="mt-2.5 flex flex-col gap-2">
          <div className="max-w-[85%] self-start rounded-lg rounded-bl-sm bg-surface px-3 py-2 text-[12.5px] text-foreground">
            are you streaming the glaze pull tonight?
          </div>
          <div className="max-w-[85%] self-end rounded-lg rounded-br-sm bg-primary px-3 py-2 text-[12.5px] font-medium text-primary-foreground">
            8pm. bringing the good clay
          </div>
        </div>
      </div>

      {/* Live tile */}
      <div className="relative z-20 -mt-2 mr-6 flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-surface-elevated">
          <span className="absolute left-1 top-1 rounded-sm bg-destructive px-1 py-px font-mono text-[8px] font-bold tracking-wider text-white">
            LIVE
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold text-foreground">
            Night studio session
          </p>
          <p className="font-mono text-[10.5px] text-muted-foreground">
            342 watching
          </p>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center pb-16 pt-24">
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-center gap-12 px-7 md:grid-cols-2">
        <div className="landing-fade-in">
          <p className="mb-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Orbit · Everyone&apos;s radius
          </p>
          <h1 className="text-[clamp(2.75rem,6.5vw,4.75rem)] font-bold leading-[0.98] tracking-[-0.035em] text-foreground">
            The internet,
            <br />
            but <span className="text-primary">smaller</span>.
          </h1>
          <p className="mt-5 max-w-[460px] text-base leading-relaxed text-text-secondary">
            A social platform built for people who are tired of shouting into
            the void. Start with one room, one post, one voice note. Strangers
            find your orbit, or don&apos;t.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground no-underline"
            >
              Get started
            </Link>
            <Link
              href="/feed"
              className="rounded-lg border border-border bg-surface px-6 py-3 text-[15px] font-medium text-foreground no-underline"
            >
              Explore first
            </Link>
          </div>
        </div>

        <div className="landing-scale-in" style={{ animationDelay: "0.25s" }}>
          <HeroMock />
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Globe,
    title: "Feed & Moments",
    body: "A personalized feed with ephemeral Moments that vanish in 24 hours. Share what matters, not what performs.",
  },
  {
    icon: Film,
    title: "Clips",
    body: "Short video, long attention. Vertical, snap-scroll, tuned for making, not doomscrolling.",
  },
  {
    icon: Play,
    title: "Live",
    body: "Go on air in one tap. Broadcast from your studio, your desk, your kitchen. Replays land on your profile.",
  },
  {
    icon: MessageCircle,
    title: "Messages & calls",
    body: "One-to-one and group chats with voice notes, reactions, and built-in video calls. No second app.",
  },
  {
    icon: Calendar,
    title: "Rooms & events",
    body: "Small places, loud enough. Set the radius, set the rules, and take it offline with RSVPs and reminders.",
  },
  {
    icon: AudioLines,
    title: "Audio posts",
    body: "Record voice notes with waveforms. Speak instead of typing, when it matters.",
  },
];

function FeaturesSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-[1240px] px-7">
        <Reveal>
          <div className="max-w-[640px]">
            <p className="mb-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              The surfaces
            </p>
            <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.03em] text-foreground">
              One <span className="text-primary">platform</span>. All the
              surface.
            </h2>
            <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-text-secondary">
              Feed, clips, audio, rooms, live, events. The core surfaces every
              social network needs, built into one cohesive system. No siloed
              apps, no cross-posting.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 border-t border-border pt-12 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={0.05 * i}>
              <div>
                <f.icon
                  className="h-5 w-5 text-primary"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <h3 className="mt-4 text-[17px] font-bold tracking-tight text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 max-w-[340px] text-[13.5px] leading-relaxed text-text-secondary">
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Framed app mock: the feed in place, flat, with rail and trending column. */
function ProductFrameSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-[1100px] px-7">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
              </div>
              <span className="ml-3 rounded-md border border-border bg-background px-3 py-1 font-mono text-[11px] tracking-wide text-muted-foreground">
                orbit / feed
              </span>
            </div>

            <div className="grid min-h-[420px] grid-cols-1 md:grid-cols-[180px_1fr_240px]">
              <div className="hidden border-r border-border p-4 md:block">
                {["Home", "Discover", "Rooms", "Live", "Events", "Messages"].map(
                  (label, i) => (
                    <div
                      key={label}
                      className={`mb-0.5 rounded-lg px-3 py-2 text-[12.5px] ${
                        i === 0
                          ? "bg-primary/10 font-semibold text-foreground"
                          : "font-medium text-muted-foreground"
                      }`}
                    >
                      {label}
                    </div>
                  )
                )}
              </div>

              <div className="p-5">
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-surface-elevated">
                  <span className="absolute bottom-3.5 left-4 font-mono text-[11px] tracking-wider text-muted-foreground">
                    [ photo · harbour, 17:42 ]
                  </span>
                </div>
                <div className="mt-3.5 flex items-center gap-5 text-muted-foreground">
                  <Heart className="h-4 w-4" aria-hidden />
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  <Repeat2 className="h-4 w-4" aria-hidden />
                </div>
              </div>

              <div className="hidden border-l border-border p-4 md:block">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Trending
                </p>
                {["softlaunch", "sundaybest", "analoglife"].map((tag, i) => (
                  <div
                    key={tag}
                    className={`flex items-center gap-2.5 py-2 ${i ? "border-t border-border" : ""}`}
                  >
                    <span
                      className={`w-4 font-mono text-[13px] font-bold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[12px] font-semibold text-foreground">
                      #{tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const pillars = [
  {
    no: "01",
    title: "Fast",
    desc: "Interactions land in under 50ms. Scrolling is the point; friction is the enemy.",
  },
  {
    no: "02",
    title: "Private",
    desc: "Your data is yours. E2E where it matters. Visibility you control, not inferred.",
  },
  {
    no: "03",
    title: "For makers",
    desc: "Analytics, monetization, and audience tools, built in, not bolted on.",
  },
  {
    no: "04",
    title: "Discovery",
    desc: "An algorithm that works for you. Trending without trending toward outrage.",
  },
];

function PillarsSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-[1240px] px-7">
        <Reveal>
          <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold tracking-[-0.03em] text-foreground">
            Built <span className="text-primary">different</span>.
          </h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-7 sm:grid-cols-2 md:grid-cols-4">
          {pillars.map((p, i) => (
            <Reveal key={p.no} delay={i * 0.08}>
              <div className="border-t border-border pt-5">
                <p className="font-mono text-[28px] font-bold leading-none text-primary">
                  {p.no}
                </p>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                  {p.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const audiences = [
  {
    title: "Creators",
    body: "Clips, audio posts, and live streaming in one feed. Your work surfaces because of what it is, not what you paid for.",
  },
  {
    title: "Communities",
    body: "Rooms keep small groups loud enough. Set the radius, set the rules, keep the algorithm out of the room.",
  },
  {
    title: "Hosts",
    body: "Events, listening sessions, drop-ins. RSVPs and reminders that show up where people already are: the feed.",
  },
];

function MadeForSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-[1240px] px-7">
        <Reveal>
          <div className="text-center">
            <h2 className="text-[clamp(1.9rem,4vw,3.25rem)] font-bold tracking-[-0.03em] text-foreground">
              Made for <span className="text-primary">makers</span>, not
              advertisers.
            </h2>
            <p className="mx-auto mt-4 max-w-[540px] text-[15px] leading-relaxed text-text-secondary">
              Whatever shape your work takes, there&apos;s a surface for it.
              One platform, all the formats.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {audiences.map((row, i) => (
            <Reveal key={row.title} delay={i * 0.08}>
              <div className="relative h-full overflow-hidden rounded-xl border border-border bg-surface p-6">
                <div className="absolute left-0 top-0 h-0.5 w-12 bg-primary" />
                <h3 className="text-[20px] font-bold tracking-tight text-foreground">
                  {row.title}
                </h3>
                <p className="mt-3 text-[13.5px] leading-relaxed text-text-secondary">
                  {row.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-[960px] px-7">
        <Reveal>
          <div className="rounded-2xl border border-border bg-surface px-10 py-20 text-center">
            <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.03em] text-foreground">
              Ready to join
              <br />
              the <span className="text-primary">orbit</span>?
            </h2>
            <p className="mx-auto mt-5 max-w-[420px] text-[14.5px] leading-relaxed text-text-secondary">
              Your community is waiting. Start with one room, one post, one
              voice note.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              <Link
                href="/signup"
                className="rounded-lg bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground no-underline"
              >
                Get started
              </Link>
              <Link
                href="/feed"
                className="rounded-lg border border-border bg-background px-6 py-3 text-[15px] font-medium text-foreground no-underline"
              >
                Explore first
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const footerCols: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Feed", href: "/feed" },
      { label: "Clips", href: "/clips" },
      { label: "Rooms", href: "/communities" },
      { label: "Live", href: "/live" },
      { label: "Events", href: "/events" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign up", href: "/signup" },
      { label: "Sign in", href: "/login" },
      { label: "Explore", href: "/explore" },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-border pb-7 pt-14">
      <div className="mx-auto max-w-[1240px] px-7">
        <div className="grid grid-cols-2 items-start gap-12 md:grid-cols-3">
          <div className="flex items-center gap-2.5">
            <LogoMark size={24} />
            <span className="text-[15px] font-bold tracking-tight text-foreground">
              Orbit
            </span>
          </div>
          {footerCols.map((col) => (
            <div key={col.title}>
              <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
                {col.title}
              </p>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-text-secondary no-underline hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 font-mono text-[11px] tracking-wider text-text-faint">
          <span>© 2026 ORBIT LABS</span>
          <span>EVERYONE&apos;S RADIUS</span>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <HeroSection />
      <FeaturesSection />
      <ProductFrameSection />
      <PillarsSection />
      <MadeForSection />
      <CtaSection />
      <Footer />
    </div>
  );
}
