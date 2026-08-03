import { useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CreateSheet } from "@/components/create-sheet";
import { useUnreadCounts } from "@/lib/hooks/use-unread";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  const router = useRouter();
  const { unreadMessages, unreadNotifications } = useUnreadCounts();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            headerTitle: "Orbit",
            headerTitleStyle: { fontWeight: "800", fontSize: 20 },
            headerRight: () => (
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    unreadNotifications > 0
                      ? "Notifications, unread activity"
                      : "Notifications"
                  }
                  onPress={() => router.push("/notifications")}
                  hitSlop={8}
                >
                  <View>
                    <Ionicons
                      name="notifications-outline"
                      size={22}
                      color={colors.foreground}
                    />
                    {unreadNotifications > 0 ? (
                      <View style={styles.bellDot} />
                    ) : null}
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    unreadMessages > 0
                      ? `Messages, ${unreadMessages} unread`
                      : "Messages"
                  }
                  onPress={() => router.push("/messages")}
                  hitSlop={8}
                >
                  <View>
                    <Ionicons
                      name="paper-plane-outline"
                      size={22}
                      color={colors.foreground}
                    />
                    {unreadMessages > 0 ? (
                      <View style={styles.inboxBadge}>
                        <Text style={styles.inboxBadgeText}>
                          {unreadMessages > 99 ? "99+" : unreadMessages}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              </View>
            ),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: "Discover",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="compass-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: "Create",
            // The center slot is an action, not a destination: the custom
            // button opens the Create sheet and never navigates.
            tabBarButton: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create"
                onPress={() => setCreateOpen(true)}
                style={styles.createSlot}
                hitSlop={8}
              >
                <View style={styles.createButton}>
                  <Ionicons
                    name="add"
                    size={28}
                    color={colors.primaryForeground}
                  />
                </View>
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="clips"
          options={{
            title: "Clips",
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="film-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "You",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      <CreateSheet visible={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 16,
  },
  bellDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  inboxBadge: {
    position: "absolute",
    top: -5,
    right: -7,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  inboxBadgeText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: "700",
  },
  createSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    // Raised above the row so the primary action reads larger than the
    // flanking tab icons.
    marginTop: -14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
});
