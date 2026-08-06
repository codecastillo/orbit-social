import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Button, Field } from "@/components/ui";
import { deactivateAccount, deleteAccount } from "@/lib/queries/account";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

// Same password policy as the web account page's zod schema.
const PASSWORD_MIN_LENGTH = 10;
// Export builds a zip on the server and hands back a download, which only
// the browser can take delivery of, so the app links out for it.
const EXPORT_URL = "https://orbitsocial.net/api/export";
const DELETE_CONFIRMATION = "DELETE";
const BACKDROP = "rgba(0, 0, 0, 0.55)";

function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(password)) return "Must contain at least one number";
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return "Must contain at least one special character";
  }
  return null;
}

/**
 * Typed-confirmation gate for deletion, mirroring the web ModalShell dialog.
 * The copy states exactly what the API route removes so nobody taps through
 * expecting a recoverable action.
 */
function DeleteAccountModal({
  visible,
  onClose,
  onConfirm,
  deleting,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
  error: string | null;
}) {
  const [confirmation, setConfirmation] = useState("");

  const close = () => {
    setConfirmation("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={styles.modalContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.backdrop}
          onPress={deleting ? undefined : close}
        />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Delete your account</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              disabled={deleting}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={styles.modalBody}>
            This permanently deletes your profile, posts, clips, stories,
            comments, likes, follows, and messages on every device. It cannot
            be undone.
          </Text>
          <Text style={styles.modalBody}>
            Sounds you added to the shared audio library stay up, with no
            creator attached. Download your data first if you want a copy.
          </Text>

          <Field
            label={`Type ${DELETE_CONFIRMATION} to confirm`}
            placeholder={DELETE_CONFIRMATION}
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
          />

          {error ? <Text style={styles.submitError}>{error}</Text> : null}

          <Button
            label="Delete forever"
            variant="destructive"
            loading={deleting}
            disabled={confirmation !== DELETE_CONFIRMATION}
            onPress={onConfirm}
          />
          <Button
            label="Cancel"
            variant="outline"
            disabled={deleting}
            onPress={close}
            style={styles.modalCancel}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function AccountSettingsScreen() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /**
   * Builds the archive through the same web route the browser uses, so the
   * two clients cannot disagree about what an export contains, then hands the
   * file to the OS share sheet. Mobile has no cookies, so the session token
   * goes in an Authorization header.
   */
  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in again to export.");

      const res = await fetch(EXPORT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 429) {
        throw new Error("You can request one export every 10 minutes.");
      }
      if (!res.ok) throw new Error("The export could not be built.");

      const body = await res.text();
      const date = new Date().toISOString().slice(0, 10);
      // Cache rather than documents: the archive is handed straight to the
      // share sheet, and keeping a copy the user never asked for is the
      // opposite of what a data export is for.
      const file = new File(Paths.cache, `orbit-export-${date}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(body);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/json",
          dialogTitle: "Your Orbit data",
        });
      } else {
        // No share sheet on this device, so say where the file went rather
        // than failing silently after the work is already done.
        Alert.alert("Export saved", `Written to ${file.uri}`);
      }
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "The export could not be built.",
      );
    } finally {
      setExporting(false);
    }
  }

  const { user, signOutActiveAccount } = useAuth();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleChangePassword = async () => {
    const invalid = passwordError(newPassword);
    const mismatch =
      newPassword === confirmPassword ? null : "Passwords don't match";
    setNewError(invalid);
    setConfirmError(mismatch);
    setSubmitError(null);
    setSaved(false);
    if (invalid || mismatch) return;

    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setSaving(false);
    if (error) {
      // Supabase can demand a recent login here; its message says so, so
      // surface it verbatim instead of a generic failure.
      setSubmitError(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setSaved(true);
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await deactivateAccount(user.id);
    } catch {
      setDeactivating(false);
      setDeactivateError("Couldn't deactivate your account. Please try again.");
      return;
    }
    // Same exit as deletion: drop the session, its cached queries and its
    // switcher entry, so a paused account does not linger in the switcher.
    await signOutActiveAccount();
  };

  const confirmDeactivate = () => {
    Alert.alert(
      "Deactivate your account?",
      "Your profile and posts stop showing up for other people, and you will be signed out on this device. Nothing is deleted: sign back in whenever you want and everything comes back.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Deactivate", onPress: () => void handleDeactivate() },
      ],
    );
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
    } catch (error) {
      setDeleting(false);
      setDeleteError(
        error instanceof Error ? error.message : "Couldn't delete account",
      );
      return;
    }
    setDeleteOpen(false);
    // The account is gone: drop its session, its cached queries and its entry
    // in the switcher, then continue on whichever account is left.
    await signOutActiveAccount();
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Account" }} />

      <Text style={styles.sectionTitle}>Email</Text>
      <View style={styles.emailRow}>
        <Text style={styles.emailValue}>{user.email ?? "No email on file"}</Text>
      </View>

      <Text style={styles.sectionTitle}>Change password</Text>
      <View style={styles.formSection}>
        <Field
          label="New password"
          placeholder="Min 10 chars, mixed case, number, symbol"
          value={newPassword}
          onChangeText={(value) => {
            setNewPassword(value);
            setSaved(false);
          }}
          secureTextEntry
          autoCapitalize="none"
          error={newError}
        />
        <Field
          label="Confirm new password"
          placeholder="Repeat new password"
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            setSaved(false);
          }}
          secureTextEntry
          autoCapitalize="none"
          error={confirmError}
        />
        {submitError ? (
          <Text style={styles.submitError}>{submitError}</Text>
        ) : null}
        {saved ? <Text style={styles.submitSuccess}>Password updated.</Text> : null}
        <Button
          label="Update password"
          loading={saving}
          disabled={!newPassword || !confirmPassword}
          onPress={() => void handleChangePassword()}
        />
      </View>

      <Text style={styles.sectionTitle}>Your data</Text>
      <View style={styles.formSection}>
        <Text style={styles.deleteExplainer}>
          Export your profile, posts, comments, likes, follows, and saved
          items as a file you can keep. Direct messages are not included:
          a conversation belongs to everyone in it, not only to you.
        </Text>
        {exportError ? (
          <Text style={styles.submitError}>{exportError}</Text>
        ) : null}
        <Button
          label={exporting ? "Preparing your export" : "Export your data"}
          variant="outline"
          loading={exporting}
          onPress={() => void handleExport()}
        />
      </View>

      <Text style={styles.sectionTitle}>Take a break</Text>
      <View style={styles.formSection}>
        <Text style={styles.deleteExplainer}>
          Deactivating hides your profile and posts from everyone else and
          signs you out here. Nothing is deleted, and signing back in restores
          everything.
        </Text>
        {deactivateError ? (
          <Text style={styles.submitError}>{deactivateError}</Text>
        ) : null}
        <Button
          label="Deactivate account"
          variant="outline"
          loading={deactivating}
          onPress={confirmDeactivate}
        />
      </View>

      <Text style={styles.sectionTitle}>Delete account</Text>
      <View style={styles.formSection}>
        <Text style={styles.deleteExplainer}>
          Permanent. Your profile, posts, messages, and reactions all go with
          you.
        </Text>
        <Button
          label="Delete account"
          variant="destructive"
          onPress={() => {
            setDeleteError(null);
            setDeleteOpen(true);
          }}
        />
      </View>

      <DeleteAccountModal
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDeleteAccount()}
        deleting={deleting}
        error={deleteError}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingVertical: spacing(2),
    paddingBottom: spacing(8),
  },
  sectionTitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    paddingBottom: spacing(1),
  },
  emailRow: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  emailValue: {
    color: colors.foreground,
    fontSize: 14.5,
  },
  formSection: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  submitError: {
    color: colors.destructive,
    fontSize: 12.5,
    marginBottom: spacing(3),
  },
  submitSuccess: {
    color: colors.success,
    fontSize: 12.5,
    marginBottom: spacing(3),
  },
  deleteExplainer: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing(3),
  },
  modalContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(6),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP,
  },
  modalCard: {
    alignSelf: "stretch",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.destructive,
    padding: spacing(5),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing(3),
  },
  modalTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  modalBody: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing(3),
  },
  modalCancel: {
    marginTop: spacing(2),
  },
});
