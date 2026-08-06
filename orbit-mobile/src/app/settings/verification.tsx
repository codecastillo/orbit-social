import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Field } from "@/components/ui";
import {
  getMyVerificationRequest,
  submitVerificationRequest,
  withdrawVerificationRequest,
  VERIFICATION_CATEGORIES,
  type VerificationCategory,
} from "@/lib/queries/verification";
import { useAuth } from "@/providers/auth-provider";
import { formatTimeAgo } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

const STATEMENT_MIN = 20;
const STATEMENT_MAX = 1000;
const MAX_EVIDENCE = 5;

/**
 * Asking to be verified.
 *
 * Verification is free and cannot be bought, which the screen says out loud
 * because every other platform has trained people to assume otherwise.
 */
export default function VerificationScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const requestKey = ["verification-request", user?.id];

  const { data: request, isPending } = useQuery({
    queryKey: requestKey,
    queryFn: () => getMyVerificationRequest(user!.id),
    enabled: !!user,
  });

  const [category, setCategory] = useState<VerificationCategory>("creator");
  const [statement, setStatement] = useState("");
  const [evidence, setEvidence] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      submitVerificationRequest(user!.id, {
        category,
        statement,
        evidence: evidence.split("\n"),
      }),
    onSuccess: () => {
      setStatement("");
      setEvidence("");
      queryClient.invalidateQueries({ queryKey: requestKey });
    },
    onError: (err: unknown) =>
      Alert.alert(
        err instanceof Error && /duplicate|unique/i.test(err.message)
          ? "You already have a request waiting"
          : "Couldn't send this request",
      ),
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawVerificationRequest(request!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: requestKey }),
    onError: () => Alert.alert("Couldn't withdraw this request"),
  });

  const canSubmit =
    statement.trim().length >= STATEMENT_MIN && !submit.isPending;

  const pending = request?.status === "pending";

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Verification" }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.notice}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <Text style={styles.noticeText}>
            Verification is free and cannot be bought. It says an account is
            who it claims to be, and nothing else: it buys no extra reach.
          </Text>
        </View>

        {isPending ? null : request ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>
              {request.status === "pending"
                ? "Waiting for review"
                : request.status === "approved"
                  ? "Approved"
                  : "Not approved"}
            </Text>
            <Text style={styles.statusMeta}>
              Sent {formatTimeAgo(request.created_at)}
              {request.reviewed_at
                ? `, decided ${formatTimeAgo(request.reviewed_at)}`
                : ""}
            </Text>
            {request.decision_note ? (
              <Text style={styles.statusNote}>{request.decision_note}</Text>
            ) : null}
            {pending ? (
              <Button
                label={withdraw.isPending ? "Withdrawing" : "Withdraw request"}
                variant="outline"
                loading={withdraw.isPending}
                onPress={() => withdraw.mutate()}
              />
            ) : null}
          </View>
        ) : null}

        {!pending ? (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>What kind of account is this?</Text>
              <View style={styles.categoryRow}>
                {VERIFICATION_CATEGORIES.map((option) => {
                  const active = category === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() => setCategory(option.value)}
                      style={({ pressed }) => [
                        styles.chip,
                        active && styles.chipActive,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text
                        style={[styles.chipLabel, active && styles.chipLabelActive]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Who are you?</Text>
              <Field
                value={statement}
                onChangeText={setStatement}
                placeholder="A few sentences a stranger could check."
                maxLength={STATEMENT_MAX}
                multiline
              />
              <Text style={styles.hint}>
                {statement.trim().length < STATEMENT_MIN
                  ? `At least ${STATEMENT_MIN} characters.`
                  : `${statement.length}/${STATEMENT_MAX}`}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Links a reviewer can check</Text>
              <Field
                value={evidence}
                onChangeText={setEvidence}
                placeholder={"One per line, up to " + MAX_EVIDENCE}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
              <Text style={styles.hint}>
                A press page, your site, or another account already verified
                somewhere that links back here.
              </Text>
            </View>

            <Button
              label={submit.isPending ? "Sending" : "Send request"}
              loading={submit.isPending}
              disabled={!canSubmit}
              onPress={() => submit.mutate()}
            />
            <Text style={styles.hint}>
              A person reads every request. If it is turned down you will be
              told why, and you can ask again.
            </Text>
          </>
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
    padding: spacing(4),
    gap: spacing(5),
    paddingBottom: spacing(10),
  },
  notice: {
    flexDirection: "row",
    gap: spacing(3),
    padding: spacing(3.5),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  noticeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  statusCard: {
    gap: spacing(2),
    padding: spacing(3.5),
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  statusMeta: {
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  statusNote: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  field: {
    gap: spacing(2),
  },
  label: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700",
  },
  hint: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 17,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
  },
  chip: {
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
  },
  chipLabelActive: {
    color: colors.primaryForeground,
  },
});
