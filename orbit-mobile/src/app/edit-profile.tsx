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
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import {
  getOwnProfile,
  updateOwnProfile,
  uploadAvatar,
  type Profile,
  type ProfileUpdates,
} from "@/lib/queries/profiles";
import { colors, spacing } from "@/lib/theme";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const UNIQUE_VIOLATION = "23505";
const BIO_MAX_LENGTH = 160;

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
            label="Location"
            value={location}
            onChangeText={edit(setLocation)}
            placeholder="Where you are based"
            maxLength={60}
          />
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
