// Temporary route to verify the server-side Sentry SDK. Delete after the
// test event shows up in Sentry.
export async function GET() {
  throw new Error("Sentry server-side test error");
}
