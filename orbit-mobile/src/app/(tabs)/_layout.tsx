import { useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CreateSheet } from "@/components/create-sheet";
import { useUnreadCounts } from "@/lib/hooks/use-unread";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, spacing, type as typeScale } from "@/lib/theme";

/**
 * Height of the tab row itself, above the home indicator inset. Tall enough
 * to center an icon and its label as one block rather than pinning the icon
 * to the top edge, which is what left the bar looking top-heavy.
 */
const TAB_BAR_HEIGHT = 50;

/** The create button, sized past the tab icons because it is the primary action. */
const CREATE_BUTTON_SIZE = 58;

/** Diameter of the notification badge, and the radius it is halved into. */
const BELL_BADGE_SIZE = 18;
/** Width of the background-colored gap separating the badge from the bell. */
const BELL_BADGE_RING = 2;

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // A tab press returns to that tab's own screen. Detail routes (a hashtag,
  // a post, a profile) stack above the tab bar at the root, so without this
  // tapping Discover from a hashtag page leaves you on the hashtag page.
  const popToTab = () => {
    if (router.canDismiss()) router.dismissAll();
  };
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
            height: TAB_BAR_HEIGHT + insets.bottom,
            // The inset is reserved as padding rather than absorbed into the
            // row, so the icons sit in the middle of the visible bar instead
            // of riding above the home indicator's empty space.
            paddingBottom: insets.bottom,
            paddingTop: 0,
          },
          tabBarItemStyle: {
            justifyContent: "center",
            paddingVertical: spacing(0.5),
          },
          tabBarLabelStyle: {
            fontSize: 10,
            marginTop: 1,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
        }}
      >
        <Tabs.Screen
          name="index"
          listeners={{ tabPress: popToTab }}
          options={{
            title: "Home",
            headerTitle: "Orbit",
            headerTitleStyle: {
              fontFamily: typeScale.title.fontFamily,
              fontSize: typeScale.title.fontSize,
            },
            headerRight: () => (
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    unreadNotifications > 0
                      ? `Notifications, ${unreadNotifications} unread`
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
                      <View style={styles.bellBadgeRing}>
                        <View
                          style={[
                            styles.bellBadge,
                            unreadNotifications > 9 && styles.bellBadgeWide,
                          ]}
                        >
                          <Text style={styles.bellBadgeText} numberOfLines={1}>
                            {unreadNotifications > 99
                              ? "99+"
                              : unreadNotifications}
                          </Text>
                        </View>
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
          listeners={{ tabPress: popToTab }}
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
                    size={32}
                    color={colors.primaryForeground}
                  />
                </View>
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          listeners={{ tabPress: popToTab }}
          options={{
            title: "Messages",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-outline" size={size} color={color} />
            ),
            tabBarBadge:
              unreadMessages > 0
                ? unreadMessages > 99
                  ? "99+"
                  : unreadMessages
                : undefined,
            tabBarBadgeStyle: {
              backgroundColor: colors.primary,
              color: colors.primaryForeground,
              fontFamily: fonts.displayHeavy,
              fontSize: 10,
            },
          }}
        />
        <Tabs.Screen
          name="clips"
          options={{
            // Hidden from the bar (Clips now lives as a Home lane) but the
            // route stays registered so /(tabs)/clips deep links keep working.
            href: null,
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="profile"
          listeners={{ tabPress: popToTab }}
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
  // The gap that separates the badge from the bell strokes underneath. A
  // border on the badge itself renders the fill out to the border's outer
  // edge, so the purple bleeds past the ring on a rounded corner. Padding on
  // a wrapper is a real gap and has nothing to bleed through.
  bellBadgeRing: {
    position: "absolute",
    top: -7,
    // Overhangs the bell so the count does not cover the icon, while staying
    // inside the header's 16pt padding so it cannot clip at the screen edge.
    right: -8,
    padding: BELL_BADGE_RING,
    borderRadius: BELL_BADGE_SIZE / 2 + BELL_BADGE_RING,
    backgroundColor: colors.background,
  },
  bellBadge: {
    // Square, so the radius renders a true circle for the common single-digit
    // count. Horizontal padding here would stretch it into an oval.
    width: BELL_BADGE_SIZE,
    height: BELL_BADGE_SIZE,
    borderRadius: BELL_BADGE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  // Two or more digits need the width, and a stadium shape is what every
  // other app does at that point.
  bellBadgeWide: {
    width: "auto",
    minWidth: BELL_BADGE_SIZE,
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: colors.primaryForeground,
    fontFamily: fonts.displayHeavy,
    fontSize: 10,
    textAlign: "center",
    // No lineHeight here on purpose: iOS lays the glyph on the baseline of
    // the line box, so stretching the box to the badge diameter pushes the
    // digit toward the bottom. The natural box centers via the flex parent.
    includeFontPadding: false,
  },
  createSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    width: CREATE_BUTTON_SIZE,
    height: CREATE_BUTTON_SIZE,
    borderRadius: CREATE_BUTTON_SIZE / 2,
    // Raised above the row so the primary action reads larger than the
    // flanking tab icons.
    marginTop: -16,
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
