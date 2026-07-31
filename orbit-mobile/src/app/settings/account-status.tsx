import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Centered, EmptyState, Field } from "@/components/ui";
import {
  getAppeals,
  getContentFlags,
  getFiledReports,
  getViolationHistory,
  submitAppeal,
  type Appeal,
  type Violation,
} from "@/lib/queries/moderation";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const APPEAL_MAX_LENGTH = 2000;

const APPEAL_STATUS_LABELS: Record<Appeal["status"], string> = {
  pending: "Pending review",
  upheld: "Upheld",
  reversed: "Reversed",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <View style={[styles.badge, { borderColor: tone }]}>
      <Text style={[styles.badgeLabel, { color: tone }]}>{label}</Text>
    </View>
  );
}

function ViolationCard({
  violation,
  appeal,
}: {
  violation: Violation;
  appeal: Appeal | undefined;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");

  const appealMutation = useMutation({
    mutationFn: () => submitAppeal(violation.id, user!.id, message.trim()),
    onSuccess: () => {
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["appeals", user?.id] });
    },
    onError: () => Alert.alert("Couldn't submit appeal"),
  });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{violation.reason}</Text>
      {violation.action_taken ? (
        <Text style={styles.cardBody}>
          Action taken: {violation.action_taken}
        </Text>
      ) : null}
      <Text style={styles.cardDate}>
        {formatDate(violation.reviewed_at ?? violation.created_at)}
      </Text>

      {appeal ? (
        <View style={styles.appealStatusRow}>
          <Text style={styles.appealSubmitted}>Appeal submitted</Text>
          <StatusBadge
            label={APPEAL_STATUS_LABELS[appeal.status]}
            tone={
              appeal.status === "reversed"
                ? colors.success
                : appeal.status === "pending"
                  ? colors.warning
                  : colors.mutedForeground
            }
          />
        </View>
      ) : formOpen ? (
        <View style={styles.appealForm}>
          <Field
            label="Why was this a mistake?"
            placeholder="Explain your side"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            maxLength={APPEAL_MAX_LENGTH}
          />
          <View style={styles.appealActions}>
            <Button
              label="Submit appeal"
              loading={appealMutation.isPending}
              disabled={!message.trim()}
              onPress={() => appealMutation.mutate()}
              style={styles.appealButton}
            />
            <Button
              label="Cancel"
              variant="outline"
              disabled={appealMutation.isPending}
              onPress={() => setFormOpen(false)}
              style={styles.appealButton}
            />
          </View>
        </View>
      ) : (
        <Button
          label="Appeal"
          variant="outline"
          onPress={() => setFormOpen(true)}
          style={styles.appealOpenButton}
        />
      )}
    </View>
  );
}

export default function AccountStatusScreen() {
  const { user } = useAuth();

  const violationsQuery = useQuery({
    queryKey: ["violations", user?.id],
    queryFn: () => getViolationHistory(user!.id),
    enabled: !!user,
  });
  const flagsQuery = useQuery({
    queryKey: ["content-flags", user?.id],
    queryFn: () => getContentFlags(user!.id),
    enabled: !!user,
  });
  const filedQuery = useQuery({
    queryKey: ["filed-reports", user?.id],
    queryFn: () => getFiledReports(user!.id),
    enabled: !!user,
  });
  const appealsQuery = useQuery({
    queryKey: ["appeals", user?.id],
    queryFn: () => getAppeals(user!.id),
    enabled: !!user,
  });

  if (!user) return null;

  const pending =
    violationsQuery.isPending || flagsQuery.isPending || appealsQuery.isPending;
  const failed = violationsQuery.isError && flagsQuery.isError;

  if (pending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Account status" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Account status" }} />
        <EmptyState
          title="Account status did not load"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => {
                violationsQuery.refetch();
                flagsQuery.refetch();
                filedQuery.refetch();
                appealsQuery.refetch();
              }}
            />
          }
        />
      </View>
    );
  }

  const violations = violationsQuery.data ?? [];
  const flags = flagsQuery.data ?? [];
  const filed = filedQuery.data ?? [];
  const appeals = appealsQuery.data ?? [];
  const allClear = violations.length === 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Account status" }} />

      <Text style={styles.sectionTitle}>Current standing</Text>
      <View style={styles.sectionBody}>
        <View
          style={[
            styles.standingCard,
            { borderColor: allClear ? colors.success : colors.warning },
          ]}
        >
          <Text
            style={[
              styles.standingTitle,
              { color: allClear ? colors.success : colors.warning },
            ]}
          >
            {allClear
              ? "In good standing"
              : violations.length === 1
                ? "1 action on your account"
                : `${violations.length} actions on your account`}
          </Text>
          <Text style={styles.standingBody}>
            {allClear
              ? "No actions have been taken on your account."
              : "Details are listed below. You can appeal any of them."}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Violation history</Text>
      <View style={styles.sectionBody}>
        {violations.length === 0 && flags.length === 0 ? (
          <Text style={styles.sectionEmpty}>
            Nothing on record. Violations and flagged content would appear
            here.
          </Text>
        ) : (
          <>
            {violations.map((violation) => (
              <ViolationCard
                key={violation.id}
                violation={violation}
                appeal={appeals.find((a) => a.report_id === violation.id)}
              />
            ))}
            {flags.map((flag) => (
              <View key={flag.id} style={styles.card}>
                <Text style={styles.cardTitle}>Content flagged</Text>
                <Text style={styles.cardBody}>
                  {flag.reason}
                  {flag.auto_flagged ? " (automatic filter)" : ""}
                </Text>
                <Text style={styles.cardDate}>
                  {flag.severity} · {formatDate(flag.created_at)}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>Your reports</Text>
      <View style={styles.sectionBody}>
        {filedQuery.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : filed.length === 0 ? (
          <Text style={styles.sectionEmpty}>
            Reports you file and their outcomes will appear here.
          </Text>
        ) : (
          filed.map((report) => (
            <View key={report.id} style={styles.card}>
              <View style={styles.reportRow}>
                <Text style={styles.cardTitle}>{report.reason}</Text>
                <StatusBadge
                  label={report.status}
                  tone={
                    report.status === "actioned"
                      ? colors.success
                      : report.status === "pending"
                        ? colors.warning
                        : colors.mutedForeground
                  }
                />
              </View>
              <Text style={styles.cardDate}>
                {report.entity_type} · {formatDate(report.created_at)}
              </Text>
            </View>
          ))
        )}
      </View>
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
  sectionBody: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(1),
  },
  sectionEmpty: {
    color: colors.mutedForeground,
    fontSize: 13,
    paddingVertical: spacing(2),
  },
  standingCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing(4),
  },
  standingTitle: {
    fontSize: 14.5,
    fontWeight: "600",
  },
  standingBody: {
    marginTop: 4,
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 17,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing(3.5),
    marginBottom: spacing(2.5),
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  cardBody: {
    marginTop: 3,
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 17,
  },
  cardDate: {
    marginTop: 4,
    color: colors.textFaint,
    fontSize: 11.5,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(2),
  },
  badge: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  appealStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    marginTop: spacing(2.5),
  },
  appealSubmitted: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontWeight: "600",
  },
  appealForm: {
    marginTop: spacing(3),
  },
  appealActions: {
    flexDirection: "row",
    gap: spacing(2),
  },
  appealButton: {
    flex: 1,
    minHeight: 38,
  },
  appealOpenButton: {
    marginTop: spacing(2.5),
    minHeight: 38,
    alignSelf: "flex-start",
    paddingHorizontal: spacing(4),
  },
});
