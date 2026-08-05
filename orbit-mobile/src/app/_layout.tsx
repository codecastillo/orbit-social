import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { QueryClient, useIsRestoring } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { LIST_HINT_KEY } from "@/lib/list-hints";
import { persistOptions } from "@/lib/query-persist";
import { UndoSnackbarHost } from "@/lib/undo-send";
import { RootErrorBoundary } from "@/components/error-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { PushPriming } from "@/components/push-priming";
import { TimeReminderBanner } from "@/components/time-reminder-banner";
import { useNotificationTaps } from "@/lib/use-notification-taps";
import { usePresenceHeartbeat } from "@/lib/hooks/use-presence";
import { colors } from "@/lib/theme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const FULLSCREEN_CAPTURE_ROUTES = [
  "moment-camera",
  "clip-camera",
  "clip-upload",
];

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, mfaPending, switching, addingAccount } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useNotificationTaps();
  // Mounted here so last_seen_at stays fresh wherever the user is, not only
  // while the messages tab is open.
  usePresenceHeartbeat();

  useEffect(() => {
    // A switch passes through a signed-out moment on its way to the next
    // account; routing on that would flash the login screen.
    if (loading || switching) return;
    const inAuthGroup = segments[0] === "(auth)";
    // A session that still owes its TOTP code is not signed in as far as the
    // app is concerned; the login screen hosts the challenge.
    if ((!user || mfaPending) && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && !mfaPending && inAuthGroup && !addingAccount) {
      // While adding an account the signed-in user is deliberately sitting on
      // the login screen, so the usual bounce back to the tabs would trap it.
      router.replace("/(tabs)");
    }
  }, [
    user,
    loading,
    mfaPending,
    switching,
    addingAccount,
    segments,
    router,
  ]);

  return <>{children}</>;
}

/**
 * Holds the tree back until the stored cache is in the client. Restoring
 * takes one AsyncStorage read, and mounting before it finishes would paint
 * the skeletons this persistence exists to remove. Queries do not fetch
 * while restoring either way, so nothing is delayed by waiting.
 */
function CacheGate({ children }: { children: React.ReactNode }) {
  return useIsRestoring() ? null : <>{children}</>;
}

export default function RootLayout() {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          retry: 1,
        },
      },
    });
    // Skeleton row counts are written by hand and never fetched, so without
    // this they would be collected as unused queries before the next launch
    // could read them back.
    client.setQueryDefaults([LIST_HINT_KEY], {
      gcTime: Infinity,
      staleTime: Infinity,
    });
    return client;
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      {/* Inside the query provider so the recovery screen can clear the
          cache when someone signs out of a broken session. */}
      <RootErrorBoundary>
        <CacheGate>
          <AuthProvider>
            <AuthGate>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.foreground,
                  headerTitleStyle: { fontWeight: "600" },
                  contentStyle: { backgroundColor: colors.background },
                  // Chevron only; the default label leaks route group names
                  // like "(tabs)" on iOS.
                  headerBackButtonDisplayMode: "minimal",
                }}
              >
                {/* The title feeds the iOS back long-press menu, which would
                    otherwise display the raw group name "(tabs)". */}
                <Stack.Screen
                  name="(tabs)"
                  options={{ headerShown: false, title: "Home" }}
                />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="notifications" options={{ title: "Activity" }} />
                <Stack.Screen name="create-story" options={{ title: "New moment" }} />
                {/* Full-screen capture surfaces own their whole viewport. These
                    belong here rather than on the screens themselves: React
                    Navigation remounts a modal whose header visibility changes
                    after mount, and a screen that hides its own header on every
                    mount remounts itself forever. */}
                {FULLSCREEN_CAPTURE_ROUTES.map((name) => (
                  <Stack.Screen
                    key={name}
                    name={name}
                    options={{
                      headerShown: false,
                      presentation: "fullScreenModal",
                    }}
                  />
                ))}
              </Stack>
              {/* Above the navigator so undo countdowns survive screen changes. */}
              <UndoSnackbarHost />
              <OfflineBanner />
              <TimeReminderBanner />
              <PushPriming />
            </AuthGate>
          </AuthProvider>
        </CacheGate>
      </RootErrorBoundary>
    </PersistQueryClientProvider>
  );
}
