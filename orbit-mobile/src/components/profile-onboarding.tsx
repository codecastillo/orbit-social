import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Field } from "@/components/ui";
import {
  updateOwnProfile,
  type Profile,
} from "@/lib/queries/profiles";
import { colors, spacing } from "@/lib/theme";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const UNIQUE_VIOLATION = "23505";

/**
 * Shown when the profile row still carries the auto-generated signup
 * username, meaning web onboarding never ran for this account. Collects a
 * real handle and display name before the profile is usable.
 */
export function ProfileOnboarding({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(
    profile.display_name === "New User" ? "" : profile.display_name,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      updateOwnProfile(profile.id, {
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile", profile.id], updated);
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

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
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
});
