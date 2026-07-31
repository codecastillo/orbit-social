import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUnreadCounts } from "@/lib/hooks/use-unread";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  const router = useRouter();
  const { unreadMessages, unreadNotifications } = useUnreadCounts();

  return (
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unreadNotifications > 0
                  ? "Notifications, unread activity"
                  : "Notifications"
              }
              onPress={() => router.push("/notifications")}
              style={{ paddingHorizontal: 16 }}
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
        name="messages"
        options={{
          title: "Messages",
          tabBarBadge:
            unreadMessages > 0
              ? unreadMessages > 99
                ? "99+"
                : unreadMessages
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: colors.primaryForeground,
            fontSize: 11,
            fontWeight: "700",
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
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
  );
}

const styles = StyleSheet.create({
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
});
