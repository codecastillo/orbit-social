// Shared chrome for /terms and /privacy. Server-only by design: no "use
// client" and no data fetching, so both documents prerender at build time
// the way /promises does.
import Link from "next/link";

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

export interface LegalSectionRef {
  id: string;
  title: string;
}

export function LegalShell({
  eyebrow,
  titleLead,
  titleAccent,
  intro,
  effectiveDate,
  lastUpdated,
  sections,
  children,
}: {
  eyebrow: string;
  titleLead: string;
  titleAccent: string;
  intro: string;
  effectiveDate: string;
  lastUpdated: string;
  sections: LegalSectionRef[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[760px] items-center justify-between px-6">
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

      <main id="main-content" className="mx-auto max-w-[760px] px-6 pb-24">
        <header className="landing-fade-in pt-16 sm:pt-20">
          <p className="mb-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="text-[clamp(2.25rem,7vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.035em] text-foreground">
            {titleLead} <span className="text-primary">{titleAccent}</span>.
          </h1>
          <p className="mt-5 max-w-[600px] text-[15.5px] leading-relaxed text-text-secondary">
            {intro}
          </p>
          <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-3 border-t border-border pt-5 font-mono text-[11px] uppercase tracking-[0.12em]">
            <div>
              <dt className="text-text-faint">Effective</dt>
              <dd className="mt-1 text-foreground">{effectiveDate}</dd>
            </div>
            <div>
              <dt className="text-text-faint">Last updated</dt>
              <dd className="mt-1 text-foreground">{lastUpdated}</dd>
            </div>
          </dl>
        </header>

        <nav aria-labelledby="contents-heading" className="mt-12">
          <h2
            id="contents-heading"
            className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
          >
            Contents
          </h2>
          <ol className="m-0 mt-4 grid list-none grid-cols-1 gap-x-8 gap-y-2 p-0 sm:grid-cols-2">
            {sections.map((section, i) => (
              <li key={section.id} className="flex gap-3">
                <span className="font-mono text-[12px] tabular-nums text-text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Link
                  href={`#${section.id}`}
                  className="text-[13.5px] leading-snug text-text-secondary no-underline hover:text-foreground"
                >
                  {section.title}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-4">{children}</div>

        <footer className="mt-14 border-t border-border pt-8">
          <div className="flex flex-wrap gap-x-7 gap-y-2 text-[13.5px]">
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
            <Link
              href="/promises"
              className="text-text-secondary no-underline hover:text-foreground"
            >
              Ten promises
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

// Prose styling lives on the section wrapper rather than on every element,
// so the document bodies below stay readable as plain markup.
const PROSE = [
  "[&_p]:mt-4 [&_p]:max-w-[640px] [&_p]:text-[14.5px] [&_p]:leading-[1.65] [&_p]:text-text-secondary",
  "[&_ul]:mt-4 [&_ul]:flex [&_ul]:max-w-[640px] [&_ul]:list-none [&_ul]:flex-col [&_ul]:gap-2.5 [&_ul]:p-0",
  "[&_li]:relative [&_li]:pl-5 [&_li]:text-[14.5px] [&_li]:leading-[1.6] [&_li]:text-text-secondary",
  "[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.62em] [&_li]:before:h-1 [&_li]:before:w-1 [&_li]:before:rounded-full [&_li]:before:bg-primary",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline",
  "[&_h3]:mt-7 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-foreground",
].join(" ");

export function LegalSection({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-border py-9">
      <div className="flex gap-5 sm:gap-7">
        <span className="mt-1 shrink-0 font-mono text-[13px] font-bold tabular-nums text-primary">
          {String(index).padStart(2, "0")}
        </span>
        <div className={`min-w-0 ${PROSE}`}>
          <h2 className="text-[19px] font-bold leading-snug tracking-tight text-foreground sm:text-[21px]">
            {title}
          </h2>
          {children}
        </div>
      </div>
    </section>
  );
}
