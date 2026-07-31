"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/providers/auth-provider";

// Never persisted: private message content stays out of localStorage, and
// auth state is owned by the Supabase session, not the query cache.
const UNPERSISTED_KEYS = new Set(["conversations", "messages", "unread-count"]);

// Bump to invalidate every persisted cache after a breaking shape change.
const CACHE_BUSTER = "v1";

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

  // Restoring the last known data from localStorage means revisits and
  // reloads paint content instantly and refresh in the background, instead
  // of showing a skeleton for data the user was just looking at.
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: "orbit-query-cache",
      throttleTime: 2000,
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
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 24 * 60 * 60 * 1000,
          buster: CACHE_BUSTER,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) =>
              query.state.status === "success" &&
              !UNPERSISTED_KEYS.has(String(query.queryKey[0])),
          },
        }}
      >
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
