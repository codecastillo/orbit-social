import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Field } from "@/components/ui";
import {
  getCreatorMonetization,
  getMonetizationConfig,
  saveCreatorMonetization,
} from "@/lib/queries/monetization";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

/**
 * A creator's monetization settings, which exist before payments do.
 *
 * The screen says plainly that nothing can be charged yet rather than
 * implying otherwise with a live-looking form. Saving here is a statement of
 * intent that the app honours the day the gateway is switched on.
 */
export default function MonetizationSettingsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["monetization-config"],
    queryFn: getMonetizationConfig,
    staleTime: 1000 * 60 * 10,
  });

  const settingsKey = ["creator-monetization", user?.id];
  const { data: settings } = useQuery({
    queryKey: settingsKey,
    queryFn: () => getCreatorMonetization(user!.id),
    enabled: !!user,
  });

  const [tipsEnabled, setTipsEnabled] = useState<boolean | null>(null);
  const [price, setPrice] = useState<string | null>(null);

  const tipsValue = tipsEnabled ?? settings?.tips_enabled ?? false;
  const priceValue =
    price ??
    (settings?.subscription_price_cents != null
      ? (settings.subscription_price_cents / 100).toFixed(2)
      : "");

  const save = useMutation({
    mutationFn: () => {
      const parsed = Number.parseFloat(priceValue);
      const cents =
        priceValue.trim() === "" || Number.isNaN(parsed)
          ? null
          : Math.round(parsed * 100);
      return saveCreatorMonetization(user!.id, {
        tipsEnabled: tipsValue,
        subscriptionPriceCents: cents,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKey });
      Alert.alert("Saved", "These apply the moment payments are switched on.");
    },
    onError: () => Alert.alert("Couldn't save these settings"),
  });

  const paymentsOn = config?.payments_enabled ?? false;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Monetization" }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!paymentsOn ? (
          <View style={styles.notice}>
            <Ionicons name="time-outline" size={18} color={colors.warning} />
            <Text style={styles.noticeText}>
              Payments are not switched on yet, so nobody can be charged and
              no money can move. You can set this up now and it will be
              waiting.
            </Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.label}>Accept tips</Text>
              <Text style={styles.hint}>
                Puts a tip button on your profile once payments are on.
              </Text>
            </View>
            <Switch
              value={tipsValue}
              onValueChange={setTipsEnabled}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
              thumbColor={colors.foreground}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Monthly subscription</Text>
          <Field
            value={priceValue}
            onChangeText={setPrice}
            placeholder="Leave blank to not offer one"
            keyboardType="decimal-pad"
          />
          <Text style={styles.hint}>
            What a subscriber would pay each month, in dollars.
          </Text>
        </View>

        <Button
          label={save.isPending ? "Saving" : "Save"}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Payouts</Text>
          <Text style={styles.hint}>
            {settings?.payout_status === "ready"
              ? "Ready to receive."
              : "Not set up. There is nowhere to pay out to until payments are switched on, so this stays off rather than claiming to be ready."}
          </Text>
        </View>

        <View style={styles.promise}>
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={colors.mutedForeground}
          />
          <Text style={styles.promiseText}>
            Whatever happens here, distribution is never for sale. Paying
            changes nothing about who sees your posts.
          </Text>
        </View>
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
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(4),
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  promise: {
    flexDirection: "row",
    gap: spacing(2.5),
    paddingTop: spacing(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  promiseText: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 18,
  },
});
