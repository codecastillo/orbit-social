import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { createReport } from "@/lib/queries/moderation";
import { reportEntityLabel } from "@/lib/report-entities";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
const FADE_MS = 160;
const SLIDE_MS = 200;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;
const MAX_DETAILS_LENGTH = 500;

// Same values and labels as the web ReportDialog
// (src/components/shared/report-dialog.tsx) so reports from both clients
// group identically in admin tooling.
const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "hate_speech", label: "Hate Speech" },
  { value: "violence", label: "Violence" },
  { value: "nudity", label: "Nudity" },
  { value: "other", label: "Other" },
];

/**
 * Bottom-sheet report form shared by posts, profiles, and DM messages.
 * Same backdrop-fade plus RAF-kicked slide as ClipCommentsSheet; see that
 * component for why the two layers animate independently.
 */
export function ReportSheet({
  visible,
  onClose,
  entityType,
  entityId,
  reportedUserId,
}: {
  visible: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  reportedUserId?: string;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [fade] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(height));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [reason, setReason] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvt, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const onHide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      slide.setValue(height);
      return;
    }
    slide.setValue(height);
    const raf = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: FADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: SLIDE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, height, fade, slide]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("Not authenticated");
      return createReport(
        user.id,
        entityType,
        entityId,
        reason!,
        description.trim() || undefined,
        reportedUserId,
      );
    },
    onSuccess: () => setSubmitted(true),
  });

  const canSubmit = !!reason && !submitMutation.isPending;

  // Clear the form on the way out (instead of an effect on !visible) so a
  // persistent mount reopens fresh rather than on the old success state.
  const handleClose = () => {
    setReason(null);
    setDescription("");
    setSubmitted(false);
    submitMutation.reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable
          style={styles.flex}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close report"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            bottom: keyboardHeight,
            paddingBottom:
              keyboardHeight > 0 ? spacing(3) : insets.bottom + spacing(3),
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Report this {reportEntityLabel(entityType)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close report"
            onPress={handleClose}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {submitted ? (
          <View style={styles.successWrap}>
            <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            <Text style={styles.successTitle}>Report submitted</Text>
            <Text style={styles.successText}>
              Thanks for flagging this. We&apos;ll review it and take action if
              needed.
            </Text>
            <Button label="Done" onPress={handleClose} />
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formContent}
          >
            <Text style={styles.helperText}>
              Help us understand what&apos;s wrong. We&apos;ll review this
              report and take action if needed.
            </Text>

            <View style={styles.reasonList}>
              {REPORT_REASONS.map((r) => {
                const active = reason === r.value;
                return (
                  <Pressable
                    key={r.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setReason(r.value)}
                    style={({ pressed }) => [
                      styles.reasonRow,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={active ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[styles.reasonLabel, active && styles.reasonLabelActive]}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Additional details (optional)"
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={MAX_DETAILS_LENGTH}
              style={styles.detailsInput}
            />

            {submitMutation.isError ? (
              <Text style={styles.errorText}>
                Failed to submit report. Please try again.
              </Text>
            ) : null}

            <Button
              label={submitMutation.isPending ? "Submitting..." : "Submit report"}
              disabled={!canSubmit}
              onPress={() => submitMutation.mutate()}
            />
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  handleWrap: {
    alignItems: "center",
    paddingBottom: spacing(2),
  },
  handle: {
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: HANDLE_HEIGHT / 2,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  formContent: {
    paddingTop: spacing(3),
    gap: spacing(3),
  },
  helperText: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  reasonList: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reasonLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  reasonLabelActive: {
    color: colors.foreground,
    fontWeight: "600",
  },
  detailsInput: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 19,
    minHeight: 72,
    maxHeight: 120,
    textAlignVertical: "top",
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 13,
  },
  successWrap: {
    alignItems: "center",
    gap: spacing(2.5),
    paddingVertical: spacing(6),
    paddingHorizontal: spacing(4),
  },
  successTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  successText: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
