import { useState } from "react";
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Tabs, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { Button, EmptyState } from "@/components/ui";
import {
  ProfileActionButton,
  ProfileHeader,
  ProfileHeaderSkeleton,
} from "@/components/profile-header";
import { ProfileContent } from "@/components/profile-tabs";
import { ProfileOnboarding } from "@/components/profile-onboarding";
import {
  getOwnProfile,
  getUserRecentPosts,
  hasPlaceholderUsername,
} from "@/lib/queries/profiles";
import { colors, radii, spacing } from "@/lib/theme";

const PROFILE_URL_BASE = "https://orbitsocial.net";

function SheetRow({
  icon,
  label,
  destructive = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.7 }]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={destructive ? colors.destructive : colors.foreground}
      />
      <Text
        style={[styles.sheetRowLabel, destructive && styles.sheetRowDestructive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function OwnProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    data: profile,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getOwnProfile(user!.id),
    enabled: !!user,
  });

  const postsQuery = useQuery({
    queryKey: ["profile-posts", user?.id],
    queryFn: () => getUserRecentPosts(user!.id),
    enabled: !!user && !!profile,
  });

  const screenOptions = (
    <Tabs.Screen
      options={{
        headerTitle: () => (
          <Text style={styles.barTitle}>
            {profile ? `@${profile.username}` : "Profile"}
          </Text>
        ),
        headerTitleAlign: "left",
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile options"
            onPress={() => setMenuOpen(true)}
            style={styles.barAction}
            hitSlop={8}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={colors.foreground}
            />
          </Pressable>
        ),
      }}
    />
  );

  function openEditProfile() {
    // Route file exists but typed routes only regenerate on the next
    // `expo start`, hence the cast.
    router.push("/edit-profile" as Href);
  }

  async function handleShare() {
    if (!profile) return;
    await Share.share({
      message: `${PROFILE_URL_BASE}/${profile.username}`,
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Drop every cached query so the next account starts clean.
    queryClient.clear();
    // The AuthGate redirects to the login screen once the session clears.
  }

  if (!user || isPending) {
    return (
      <View style={styles.flex}>
        {screenOptions}
        <ProfileHeaderSkeleton />
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View style={styles.flex}>
        {screenOptions}
        <EmptyState
          title="Could not load your profile"
          description="Check your connection and try again."
          action={
            <Button label="Retry" variant="outline" onPress={() => refetch()} />
          }
        />
      </View>
    );
  }

  if (hasPlaceholderUsername(profile)) {
    return <ProfileOnboarding profile={profile} />;
  }

  return (
    <View style={styles.flex}>
      {screenOptions}
      <ProfileContent
        header={
          <ProfileHeader
            profile={profile}
            actions={
              <>
                <ProfileActionButton
                  label="Edit profile"
                  onPress={openEditProfile}
                />
                <ProfileActionButton
                  label="Share profile"
                  onPress={handleShare}
                />
              </>
            }
          />
        }
        posts={postsQuery.data}
        isPending={postsQuery.isPending}
        isError={postsQuery.isError}
        onRetry={() => postsQuery.refetch()}
        userId={profile.id}
        username={profile.username}
        onPressPost={(postId) => router.push(`/post/${postId}`)}
      />

      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.sheetContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            style={styles.sheetBackdrop}
            onPress={() => setMenuOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <SheetRow
              icon="person-outline"
              label="Edit profile"
              onPress={() => {
                setMenuOpen(false);
                openEditProfile();
              }}
            />
            <SheetRow
              icon="share-outline"
              label="Share profile"
              onPress={() => {
                setMenuOpen(false);
                handleShare();
              }}
            />
            <SheetRow
              icon="bookmark-outline"
              label="Saved"
              onPress={() => {
                setMenuOpen(false);
                router.push("/bookmarks" as Href);
              }}
            />
            <SheetRow
              icon="document-text-outline"
              label="Drafts"
              onPress={() => {
                setMenuOpen(false);
                router.push("/drafts" as Href);
              }}
            />
            <SheetRow
              icon="settings-outline"
              label="Settings"
              onPress={() => {
                setMenuOpen(false);
                router.push("/settings" as Href);
              }}
            />
            <SheetRow
              icon="log-out-outline"
              label="Sign out"
              destructive
              onPress={() => {
                setMenuOpen(false);
                handleSignOut();
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  barTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  barAction: {
    paddingHorizontal: spacing(4),
  },
  sheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing(2),
    paddingBottom: spacing(9),
    paddingHorizontal: spacing(2),
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginBottom: spacing(2),
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(3),
    height: 52,
  },
  sheetRowLabel: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "500",
  },
  sheetRowDestructive: {
    color: colors.destructive,
  },
});
