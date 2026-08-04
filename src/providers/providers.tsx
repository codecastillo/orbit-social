"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { persistOptions } from "@/lib/query-persist";
import { AuthProvider } from "@/providers/auth-provider";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    // disableTransitionOnChange is required: globals.css applies a universal
    // transition, so a theme swap would otherwise animate every element.
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* Restoring the last known data from localStorage means revisits and
          reloads paint content instantly and refresh in the background,
          instead of showing a skeleton for data the user was just looking at.
          What may be stored, and what is dropped on sign-out, lives in
          @/lib/query-persist. */}
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
      >
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
