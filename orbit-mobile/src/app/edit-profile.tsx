import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import {
  getOwnProfile,
  updateOwnProfile,
  uploadAvatar,
  type AvatarBorderStyle,
  type Profile,
  type ProfileUpdates,
} from "@/lib/queries/profiles";
import { colors, radii, spacing } from "@/lib/theme";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const UNIQUE_VIOLATION = "23505";
const BIO_MAX_LENGTH = 160;

// Same curated palette the web settings profile page offers
// (src/lib/design/accents.ts); null is the default violet brand accent.
const PROFILE_ACCENTS: { value: string | null; label: string }[] = [
  { value: null, label: "Default" },
  { value: "#e5484d", label: "Red" },
  { value: "#ffb224", label: "Amber" },
  { value: "#30a46c", label: "Green" },
  { value: "#0091ff", label: "Blue" },
  { value: "#f76b15", label: "Orange" },
  { value: "#d6409f", label: "Pink" },
];

const BORDER_OPTIONS: { value: AvatarBorderStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "diamond", label: "Diamond" },
];

// Same normalization as the web websiteSchema: prepend https:// when the
// user typed a bare domain, empty means no website. Returns null when the
// result is not a valid http(s) URL.
function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return url;
}

export default function EditProfileScreen() {
  const { user } = useAuth();

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

  if (!user || isPending) {
    return (
      <>
        <Stack.Screen options={{ title: "Edit profile" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </>
    );
  }

  if (isError || !profile) {
    return (
      <>
        <Stack.Screen options={{ title: "Edit profile" }} />
        <EmptyState
          title="Could not load your profile"
          description="Check your connection and try again."
          action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
        />
      </>
    );
  }

  return <EditProfileForm profile={profile} />;
}

function FormRow({
  label,
  multiline,
  ...rest
}: TextInputProps & { label: string }) {
  return (
    <View style={[styles.row, multiline && styles.rowMultiline]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        multiline={multiline}
        style={[styles.rowInput, multiline && styles.rowInputMultiline]}
        {...rest}
      />
    </View>
  );
}

function EditProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [themeColor, setThemeColor] = useState(profile.theme_color);
  // Legacy stored values (animated-glow, gradient-rainbow) stay untouched
  // until the user picks one of the current options, matching the web form.
  const [avatarBorder, setAvatarBorder] = useState<AvatarBorderStyle>(
    (profile.avatar_border as AvatarBorderStyle) || "none",
  );
  const [pickedAvatar, setPickedAvatar] = useState<{
    uri: string;
    mimeType?: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty =
    displayName.trim() !== profile.display_name ||
    username.trim().toLowerCase() !== profile.username ||
    bio.trim() !== (profile.bio ?? "") ||
    location.trim() !== (profile.location ?? "") ||
    website.trim() !== (profile.website ?? "") ||
    themeColor !== profile.theme_color ||
    avatarBorder !== (profile.avatar_border ?? "none") ||
    pickedAvatar !== null;

  async function handlePickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPickedAvatar({ uri: asset.uri, mimeType: asset.mimeType ?? undefined });
    setSaved(false);
  }

  const save = useMutation({
    mutationFn: async () => {
      const updates: ProfileUpdates = {
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        location: location.trim() || null,
        // handleSave already rejected invalid values, so the fallback here
        // never fires; it only satisfies the null return type.
        website: normalizeWebsite(website) || null,
        theme_color: themeColor,
        avatar_border: avatarBorder,
      };
      if (pickedAvatar) {
        updates.avatar_url = await uploadAvatar(
          profile.id,
          pickedAvatar.uri,
          pickedAvatar.mimeType,
        );
      }
      return updateOwnProfile(profile.id, updates);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile", profile.id], updated);
      // The public profile screen and search results cache by username.
      queryClient.invalidateQueries({ queryKey: ["profile", "username"] });
      // Sync the form to the normalized server values (trimmed, lowercased)
      // so the dirty check goes clean and the save button disables again.
      setDisplayName(updated.display_name);
      setUsername(updated.username);
      setBio(updated.bio ?? "");
      setLocation(updated.location ?? "");
      setWebsite(updated.website ?? "");
      setThemeColor(updated.theme_color);
      setAvatarBorder((updated.avatar_border as AvatarBorderStyle) || "none");
      setPickedAvatar(null);
      setSaved(true);
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
    if (normalizeWebsite(website) === null) {
      setFormError("Must be a valid URL");
      return;
    }
    setFormError(null);
    setSaved(false);
    save.mutate();
  }

  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setSaved(false);
    };
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "Edit profile",
          headerTitleStyle: { fontSize: 17, fontWeight: "700" },
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Text style={styles.barCancel}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () =>
            save.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={!isDirty}
                onPress={handleSave}
                hitSlop={8}
              >
                <Text style={[styles.barSave, !isDirty && styles.barSaveDisabled]}>
                  Save
                </Text>
              </Pressable>
            ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            onPress={handlePickAvatar}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Avatar
              url={pickedAvatar?.uri ?? profile.avatar_url}
              name={profile.display_name}
              size={96}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handlePickAvatar}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.changePhoto}>Change photo</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <FormRow
            label="Name"
            value={displayName}
            onChangeText={edit(setDisplayName)}
            placeholder="How your name appears"
            maxLength={50}
          />
          <FormRow
            label="Username"
            value={username}
            onChangeText={edit(setUsername)}
            placeholder="yourhandle"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <FormRow
            label="Bio"
            value={bio}
            onChangeText={edit(setBio)}
            placeholder="A line or two about you"
            maxLength={BIO_MAX_LENGTH}
            multiline
          />
          <Text style={styles.bioCounter}>
            {bio.length}/{BIO_MAX_LENGTH}
          </Text>
          <FormRow
            label="Website"
            value={website}
            onChangeText={edit(setWebsite)}
            placeholder="yoursite.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <FormRow
            label="Location"
            value={location}
            onChangeText={edit(setLocation)}
            placeholder="Where you are based"
            maxLength={60}
          />
        </View>

        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.appearanceSection}>
          <Text style={styles.appearanceLabel}>Accent color</Text>
          <View style={styles.swatchRow}>
            {PROFILE_ACCENTS.map((accent) => {
              const active = themeColor === accent.value;
              return (
                <Pressable
                  key={accent.label}
                  accessibilityRole="radio"
                  accessibilityLabel={`${accent.label} accent`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setThemeColor(accent.value);
                    setSaved(false);
                  }}
                  style={[
                    styles.swatch,
                    { backgroundColor: accent.value ?? colors.primary },
                    active && styles.swatchActive,
                  ]}
                >
                  {active ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.appearanceLabel}>Avatar border</Text>
          <View style={styles.borderRow}>
            {BORDER_OPTIONS.map((option) => {
              const active = avatarBorder === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label} border`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setAvatarBorder(option.value);
                    setSaved(false);
                  }}
                  style={[styles.borderChip, active && styles.borderChipActive]}
                >
                  <Text
                    style={[
                      styles.borderChipLabel,
                      active && styles.borderChipLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        {saved && !isDirty ? (
          <Text style={styles.success}>Profile saved.</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing(10),
  },
  barCancel: {
    color: colors.foreground,
    fontSize: 15,
  },
  barSave: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  barSaveDisabled: {
    color: colors.textFaint,
  },
  avatarSection: {
    alignItems: "center",
    gap: spacing(2.5),
    paddingVertical: spacing(5),
  },
  changePhoto: {
    color: colors.primary,
    fontSize: 13.5,
    fontWeight: "600",
  },
  form: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingHorizontal: spacing(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowMultiline: {
    alignItems: "flex-start",
  },
  rowLabel: {
    width: 88,
    color: colors.foreground,
    fontSize: 14,
    paddingVertical: spacing(3.5),
  },
  rowInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    paddingVertical: spacing(3.5),
  },
  rowInputMultiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  sectionTitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing(4),
    marginTop: spacing(6),
    marginBottom: spacing(2),
  },
  appearanceSection: {
    paddingHorizontal: spacing(4),
    gap: spacing(2.5),
  },
  appearanceLabel: {
    color: colors.foreground,
    fontSize: 14,
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2.5),
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: colors.foreground,
  },
  borderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
  },
  borderChip: {
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  borderChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  borderChipLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  borderChipLabelActive: {
    color: colors.primary,
  },
  bioCounter: {
    color: colors.textFaint,
    fontSize: 11.5,
    textAlign: "right",
    paddingHorizontal: spacing(4),
    paddingTop: spacing(1.5),
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
    paddingHorizontal: spacing(4),
    marginTop: spacing(3),
  },
  success: {
    color: colors.success,
    fontSize: 13,
    paddingHorizontal: spacing(4),
    marginTop: spacing(3),
  },
});
