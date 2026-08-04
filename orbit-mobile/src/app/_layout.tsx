import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
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

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, mfaPending } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useNotificationTaps();
  // Mounted here so last_seen_at stays fresh wherever the user is, not only
  // while the messages tab is open.
  usePresenceHeartbeat();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    // A session that still owes its TOTP code is not signed in as far as the
    // app is concerned; the login screen hosts the challenge.
    if ((!user || mfaPending) && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && !mfaPending && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, mfaPending, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* Inside the query provider so the recovery screen can clear the
          cache when someone signs out of a broken session. */}
      <RootErrorBoundary>
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
            </Stack>
            {/* Above the navigator so undo countdowns survive screen changes. */}
            <UndoSnackbarHost />
            <OfflineBanner />
            <TimeReminderBanner />
            <PushPriming />
          </AuthGate>
        </AuthProvider>
      </RootErrorBoundary>
    </QueryClientProvider>
  );
}
