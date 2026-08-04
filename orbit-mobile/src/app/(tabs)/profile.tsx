import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { AccountSwitcherSheet } from "@/components/account-switcher";
import { Button, EmptyState } from "@/components/ui";
import {
  ProfileActionButton,
  ProfileHeader,
  ProfileHeaderSkeleton,
} from "@/components/profile-header";
import {
  ProfileContent,
  type ProfileGridShortcut,
} from "@/components/profile-tabs";
import { ProfileOnboarding } from "@/components/profile-onboarding";
import { HighlightsRow } from "@/components/highlights-row";
import { ProfileQrModal } from "@/components/profile-qr-modal";
import {
  getOwnProfile,
  getUserRecentPosts,
  hasPlaceholderUsername,
} from "@/lib/queries/profiles";
import { listDrafts } from "@/lib/queries/drafts";
import { getScheduledPosts } from "@/lib/queries/posts";
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
  const { user, accounts, signOutActiveAccount, signOutAllAccounts } =
    useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

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

  // Counts for the Drafts/Scheduled grid shortcuts. Same keys as the drafts
  // and scheduled screens so their mutations keep these tiles fresh.
  const draftsQuery = useQuery({
    queryKey: ["post-drafts", user?.id],
    queryFn: () => listDrafts(user!.id),
    enabled: !!user && !!profile,
    staleTime: 1000 * 60 * 3,
  });
  const scheduledQuery = useQuery({
    queryKey: ["scheduled-posts", user?.id],
    queryFn: () => getScheduledPosts(user!.id),
    enabled: !!user && !!profile,
    staleTime: 1000 * 60 * 3,
  });

  const draftCount = draftsQuery.data?.length ?? 0;
  const scheduledCount = scheduledQuery.data?.length ?? 0;
  const gridShortcuts: ProfileGridShortcut[] = [
    ...(draftCount > 0
      ? [
          {
            id: "shortcut-drafts",
            icon: "document-text-outline" as const,
            label: "Drafts",
            count: draftCount,
            onPress: () => router.push("/drafts" as Href),
          },
        ]
      : []),
    ...(scheduledCount > 0
      ? [
          {
            id: "shortcut-scheduled",
            icon: "time-outline" as const,
            label: "Scheduled",
            count: scheduledCount,
            onPress: () => router.push("/scheduled" as Href),
          },
        ]
      : []),
  ];

  // No nav header: the identity block already carries the @username and the
  // settings gear moved inline, so the bar only added a redundant black strip
  // above the banner. The screen pads itself below the status bar instead.
  const insets = useSafeAreaInsets();
  const screenOptions = <Tabs.Screen options={{ headerShown: false }} />;

  function openEditProfile() {
    // Route file exists but typed routes only regenerate on the next
    // `expo start`, hence the cast.
    router.push("/edit-profile" as Href);
  }

  function handleShare() {
    if (!profile) return;
    setQrOpen(true);
  }

  function openFollowList(tab: "followers" | "following") {
    if (!profile) return;
    router.push(
      `/user/follows?userId=${profile.id}&username=${profile.username}&tab=${tab}`,
    );
  }

  // With a second account on the device, "Sign out" needs to say which one it
  // means, and signing out of everything becomes its own action.
  const hasOtherAccounts = accounts.length > 1;

  if (!user || isPending) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        {screenOptions}
        <ProfileHeaderSkeleton />
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
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
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {screenOptions}
      <ProfileContent
        header={
          <>
            <ProfileHeader
              profile={profile}
              topAction={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Profile options"
                  onPress={() => setMenuOpen(true)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.gearButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name="settings-outline"
                    size={20}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              }
              onPressFollowers={() => openFollowList("followers")}
              onPressFollowing={() => openFollowList("following")}
              onPressUsername={() => setSwitcherOpen(true)}
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
            <HighlightsRow userId={profile.id} isOwner />
          </>
        }
        posts={postsQuery.data}
        isPending={postsQuery.isPending}
        isError={postsQuery.isError}
        onRetry={() => postsQuery.refetch()}
        userId={profile.id}
        username={profile.username}
        onPressPost={(postId) => router.push(`/post/${postId}`)}
        onRefresh={() =>
          Promise.all([refetch(), draftsQuery.refetch(), scheduledQuery.refetch()])
        }
        shortcuts={gridShortcuts}
      />

      <AccountSwitcherSheet
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
      />

      <ProfileQrModal
        visible={qrOpen}
        onClose={() => setQrOpen(false)}
        username={profile.username}
        profileUrl={`${PROFILE_URL_BASE}/${profile.username}`}
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
              icon="time-outline"
              label="Scheduled"
              onPress={() => {
                setMenuOpen(false);
                router.push("/scheduled" as Href);
              }}
            />
            <SheetRow
              icon="albums-outline"
              label="Moments archive"
              onPress={() => {
                setMenuOpen(false);
                router.push("/moments-archive" as Href);
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
              icon="swap-horizontal-outline"
              label="Switch account"
              onPress={() => {
                setMenuOpen(false);
                setSwitcherOpen(true);
              }}
            />
            <SheetRow
              icon="log-out-outline"
              label={hasOtherAccounts ? `Sign out @${profile.username}` : "Sign out"}
              destructive
              onPress={() => {
                setMenuOpen(false);
                signOutActiveAccount();
              }}
            />
            {hasOtherAccounts ? (
              <SheetRow
                icon="log-out-outline"
                label="Sign out of all accounts"
                destructive
                onPress={() => {
                  setMenuOpen(false);
                  signOutAllAccounts();
                }}
              />
            ) : null}
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
  gearButton: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
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
