"use client";

// Temporary page to verify Sentry capture on both runtimes. Delete this page
// and /api/sentry-test once events show up in Sentry.
export default function SentryTestPage() {
  return (
    <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 16, maxWidth: 360 }}>
      <h1>Sentry test</h1>
      <button
        onClick={() => {
          throw new Error("Sentry client-side test error");
        }}
      >
        Throw client error
      </button>
      <button
        onClick={() => {
          fetch("/api/sentry-test");
        }}
      >
        Trigger server error
      </button>
    </div>
  );
}
