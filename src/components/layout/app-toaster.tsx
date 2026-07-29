"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="bottom-right"
      // Keep toasts clear of the fixed mobile bottom nav.
      mobileOffset={{ bottom: 96 }}
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
