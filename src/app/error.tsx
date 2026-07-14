"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Root boundary: catches crashes outside the (main) group (landing, auth,
// public profile/post shells).
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root error]", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Error
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Something went <span className="text-primary">sideways</span>.
        </h1>
        <p className="text-sm text-text-secondary">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
          >
            Go home
          </Button>
        </div>
      </div>
    </main>
  );
}
