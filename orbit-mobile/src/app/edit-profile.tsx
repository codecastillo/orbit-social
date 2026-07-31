import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Button, Centered, EmptyState, Field } from "@/components/ui";
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

  return (
    <>
      <Stack.Screen options={{ title: "Edit profile" }} />
      <EditProfileForm profile={profile} />
    </>
  );
}

function EditProfileForm({ profile }: { profile: Profile }) {
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

        <Field
          label="Display name"
          value={displayName}
          onChangeText={edit(setDisplayName)}
          placeholder="How your name appears"
          maxLength={50}
        />
        <Field
          label="Username"
          value={username}
          onChangeText={edit(setUsername)}
          placeholder="yourhandle"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label={`Bio (${bio.length}/${BIO_MAX_LENGTH})`}
          value={bio}
          onChangeText={edit(setBio)}
          placeholder="A line or two about you"
          maxLength={BIO_MAX_LENGTH}
          multiline
          numberOfLines={3}
        />
        <Field
          label="Location"
          value={location}
          onChangeText={edit(setLocation)}
          placeholder="Where you are based"
          maxLength={60}
        />

        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        {saved && !isDirty ? (
          <Text style={styles.success}>Profile saved.</Text>
        ) : null}

        <Button
          label="Save changes"
          loading={save.isPending}
          disabled={!isDirty}
          onPress={handleSave}
        />
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
    padding: spacing(4),
    paddingBottom: spacing(10),
  },
  avatarSection: {
    alignItems: "center",
    gap: spacing(2),
    marginBottom: spacing(6),
  },
  changePhoto: {
    color: colors.primary,
    fontSize: 13.5,
    fontWeight: "600",
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
    marginBottom: spacing(3),
  },
  success: {
    color: colors.success,
    fontSize: 13,
    marginBottom: spacing(3),
  },
});
