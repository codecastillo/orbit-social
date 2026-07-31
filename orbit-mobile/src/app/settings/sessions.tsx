import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import { describeDevice, getLoginEvents } from "@/lib/queries/security";
import { formatTimeAgo } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

export default function SessionsScreen() {
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const eventsQuery = useQuery({
    queryKey: ["login-events", user?.id],
    queryFn: () => getLoginEvents(user!.id),
    enabled: !!user,
  });

  const handleSignOutOthers = () => {
    Alert.alert(
      "Sign out other sessions?",
      "Every device except this one will be signed out and will need to log in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out others",
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            const { error } = await supabase.auth.signOut({ scope: "others" });
            setSigningOut(false);
            if (error) {
              Alert.alert("Couldn't sign out other sessions");
              return;
            }
            Alert.alert("Signed out everywhere else");
          },
        },
      ],
    );
  };

  if (!user) return null;

  if (eventsQuery.isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Sessions" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  if (eventsQuery.isError) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Sessions" }} />
        <EmptyState
          title="Sessions did not load"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => eventsQuery.refetch()}
            />
          }
        />
      </View>
    );
  }

  const events = eventsQuery.data ?? [];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Sessions" }} />

      <View style={styles.actionSection}>
        <Text style={styles.actionHint}>
          Signing out other sessions keeps this device logged in.
        </Text>
        <Button
          label="Sign out other sessions"
          variant="outline"
          loading={signingOut}
          onPress={handleSignOutOthers}
        />
      </View>

      <Text style={styles.sectionTitle}>Recent sign-ins</Text>
      {events.length === 0 ? (
        <Text style={styles.sectionEmpty}>
          Your login history will appear here.
        </Text>
      ) : (
        events.map((event) => (
          <View key={event.id} style={styles.eventRow}>
            <View style={styles.eventBody}>
              <View style={styles.eventTitleRow}>
                <Text style={styles.eventDevice} numberOfLines={1}>
                  {describeDevice(event.user_agent)}
                </Text>
                {event.status === "failed" ? (
                  <View style={[styles.badge, { borderColor: colors.destructive }]}>
                    <Text style={[styles.badgeLabel, { color: colors.destructive }]}>
                      Failed
                    </Text>
                  </View>
                ) : event.flagged ? (
                  <View style={[styles.badge, { borderColor: colors.warning }]}>
                    <Text style={[styles.badgeLabel, { color: colors.warning }]}>
                      Flagged
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.eventMeta}>
                {formatTimeAgo(event.created_at)}
                {event.ip_address ? ` · ${event.ip_address}` : ""}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingVertical: spacing(2),
    paddingBottom: spacing(8),
  },
  actionSection: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  actionHint: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: spacing(2.5),
  },
  sectionTitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    paddingBottom: spacing(1),
  },
  sectionEmpty: {
    color: colors.mutedForeground,
    fontSize: 13,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  eventBody: {
    flex: 1,
    minWidth: 0,
  },
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  eventDevice: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  eventMeta: {
    marginTop: 2,
    color: colors.textFaint,
    fontSize: 11.5,
  },
  badge: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
