import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Field } from "@/components/ui";
import {
  updateOwnProfile,
  type Profile,
} from "@/lib/queries/profiles";
import {
  followPackMembers,
  getActiveStarterPacks,
  type StarterPack,
} from "@/lib/queries/starter-packs";
import { colors, radii, spacing } from "@/lib/theme";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const UNIQUE_VIOLATION = "23505";

/**
 * Shown when the profile row still carries the auto-generated signup
 * username, meaning web onboarding never ran for this account. Collects a
 * real handle and display name, then offers curated starter packs once
 * before handing over to the normal profile screen.
 */
export function ProfileOnboarding({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(
    profile.display_name === "New User" ? "" : profile.display_name,
  );
  const [formError, setFormError] = useState<string | null>(null);
  // Held back until the packs step is dismissed: writing it to the query
  // cache is what swaps this screen for the real profile.
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);

  // getActiveStarterPacks returns [] on any error, so a missing table just
  // means the packs step never shows.
  const packsQuery = useQuery({
    queryKey: ["starter-packs-active"],
    queryFn: getActiveStarterPacks,
    staleTime: 1000 * 60 * 5,
  });

  function commit(updated: Profile) {
    queryClient.setQueryData(["profile", profile.id], updated);
  }

  const save = useMutation({
    mutationFn: () =>
      updateOwnProfile(profile.id, {
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
      }),
    onSuccess: (updated) => {
      if ((packsQuery.data?.length ?? 0) > 0) {
        setPendingProfile(updated);
      } else {
        commit(updated);
      }
    },
    onError: (error: { code?: string; message: string }) => {
      setFormError(
        error.code === UNIQUE_VIOLATION
          ? "That username is taken. Try another."
          : error.message,
      );
    },
  });

  function handleSave() {
    const handle = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(handle)) {
      setFormError(
        "Usernames are 3 to 20 characters: lowercase letters, numbers, and underscores.",
      );
      return;
    }
    if (!displayName.trim()) {
      setFormError("Enter a display name.");
      return;
    }
    setFormError(null);
    save.mutate();
  }

  if (pendingProfile && (packsQuery.data?.length ?? 0) > 0) {
    return (
      <StarterPacksStep
        packs={packsQuery.data!}
        userId={profile.id}
        onDone={() => commit(pendingProfile)}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Finish setting up</Text>
        <Text style={styles.subtitle}>
          Pick a username and display name so people can find you.
        </Text>

        <Field
          label="Username"
          value={username}
          onChangeText={setUsername}
          placeholder="yourhandle"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="How your name appears"
        />

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <Button label="Save and continue" loading={save.isPending} onPress={handleSave} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * One-time curated follow bundles shown right after the username step.
 * One-click graph bootstrap drove up to 43% of follows on Bluesky; a fresh
 * account with an empty feed is the moment it pays off most.
 */
function StarterPacksStep({
  packs,
  userId,
  onDone,
}: {
  packs: StarterPack[];
  userId: string;
  onDone: () => void;
}) {
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [packError, setPackError] = useState<string | null>(null);

  async function followMembers(ids: string[]) {
    const missing = ids.filter((id) => id !== userId && !followed.has(id));
    if (missing.length === 0) return;
    // Optimistic: flip the buttons now, roll back if the insert fails.
    setPackError(null);
    setFollowed((prev) => new Set([...prev, ...missing]));
    try {
      await followPackMembers(userId, missing);
    } catch {
      setFollowed((prev) => {
        const next = new Set(prev);
        missing.forEach((id) => next.delete(id));
        return next;
      });
      setPackError("Couldn't follow right now. Try again.");
    }
  }

  function toggleExpanded(packId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.packsContent}>
        <Text style={styles.title}>Fill your feed instantly</Text>
        <Text style={styles.subtitle}>
          Hand-picked groups of people worth following. Grab a whole pack, or
          open one and pick individually.
        </Text>

        {packError ? <Text style={styles.error}>{packError}</Text> : null}

        {packs.map((pack) => {
          const ids = pack.members
            .map((m) => m.id)
            .filter((id) => id !== userId);
          const allFollowed =
            ids.length > 0 && ids.every((id) => followed.has(id));
          const isOpen = expanded.has(pack.id);
          return (
            <View key={pack.id} style={styles.packCard}>
              <View style={styles.packHeader}>
                <View style={styles.flexOne}>
                  <Text style={styles.packTitle}>{pack.title}</Text>
                  {pack.description ? (
                    <Text style={styles.packDescription}>
                      {pack.description}
                    </Text>
                  ) : null}
                </View>
                <Button
                  label={allFollowed ? "Following" : "Follow all"}
                  variant={allFollowed ? "outline" : "primary"}
                  disabled={ids.length === 0}
                  onPress={() => followMembers(ids)}
                  style={styles.followAllButton}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => toggleExpanded(pack.id)}
                style={styles.packMeta}
              >
                <View style={styles.avatarRow}>
                  {pack.members.slice(0, 3).map((m, i) => (
                    <View
                      key={m.id}
                      style={[styles.avatarWrap, i > 0 && styles.avatarOverlap]}
                    >
                      <Avatar url={m.avatar_url} name={m.display_name} size={28} />
                    </View>
                  ))}
                </View>
                <Text style={styles.packCount}>
                  {pack.members.length}{" "}
                  {pack.members.length === 1 ? "person" : "people"}
                </Text>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={colors.mutedForeground}
                />
              </Pressable>

              {isOpen
                ? pack.members.map((m) => {
                    const isSelf = m.id === userId;
                    const isOn = followed.has(m.id);
                    return (
                      <View key={m.id} style={styles.memberRow}>
                        <Avatar
                          url={m.avatar_url}
                          name={m.display_name}
                          size={36}
                        />
                        <View style={styles.flexOne}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {m.display_name}
                          </Text>
                          <Text style={styles.memberHandle} numberOfLines={1}>
                            @{m.username}
                          </Text>
                        </View>
                        {!isSelf ? (
                          <Button
                            label={isOn ? "Added" : "Add"}
                            variant={isOn ? "outline" : "primary"}
                            onPress={() => followMembers([m.id])}
                            style={styles.memberButton}
                          />
                        ) : null}
                      </View>
                    );
                  })
                : null}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerHint}>
          {followed.size > 0
            ? `${followed.size} followed from packs`
            : "Optional. You can skip this."}
        </Text>
        <Button label={followed.size > 0 ? "Continue" : "Skip for now"} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing(6),
  },
  title: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: spacing(1),
    marginBottom: spacing(6),
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
    marginBottom: spacing(3),
  },
  packsContent: {
    padding: spacing(6),
    paddingBottom: spacing(4),
  },
  packCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing(4),
    marginBottom: spacing(3),
  },
  packHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(3),
  },
  packTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  packDescription: {
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  followAllButton: {
    minHeight: 36,
    paddingHorizontal: spacing(3.5),
  },
  packMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    marginTop: spacing(3),
  },
  avatarRow: {
    flexDirection: "row",
  },
  avatarWrap: {
    borderWidth: 2,
    borderColor: colors.surface,
    borderRadius: radii.full,
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  packCount: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing(2.5),
    marginTop: spacing(2.5),
  },
  memberName: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  memberHandle: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 1,
  },
  memberButton: {
    minHeight: 32,
    paddingHorizontal: spacing(3),
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing(5),
    paddingBottom: spacing(8),
  },
  footerHint: {
    color: colors.mutedForeground,
    fontSize: 12,
    textAlign: "center",
    marginBottom: spacing(2.5),
  },
});
