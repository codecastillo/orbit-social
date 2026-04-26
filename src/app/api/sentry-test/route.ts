export async function GET() {
  throw new Error("Sentry server-side test " + Date.now());
}
