import * as Sentry from "@sentry/nextjs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("check") === "1") {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    const client = Sentry.getClient();
    return Response.json({
      dsn_set: !!dsn,
      dsn_prefix: dsn ? dsn.substring(0, 35) : null,
      sentry_client_initialized: !!client,
      sentry_options: client?.getOptions() ? {
        dsn_in_options: !!client.getOptions().dsn,
        environment: client.getOptions().environment,
      } : null,
    });
  }

  if (searchParams.get("manual") === "1") {
    Sentry.captureException(new Error("Manual capture test " + Date.now()));
    await Sentry.flush(2000);
    return Response.json({ ok: true, sent: true });
  }

  throw new Error("Sentry server-side test " + Date.now());
}
