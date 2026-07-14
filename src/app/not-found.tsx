import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          404
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Out of <span className="text-primary">orbit</span>.
        </h1>
        <p className="text-sm text-text-secondary">
          This page does not exist, or it drifted somewhere we cannot reach.
        </p>
        <div className="flex justify-center gap-2">
          <Link
            href="/"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline"
          >
            Go home
          </Link>
          <Link
            href="/explore"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground no-underline"
          >
            Explore
          </Link>
        </div>
      </div>
    </main>
  );
}
