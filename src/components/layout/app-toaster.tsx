"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        },
      }}
    />
  );
}
