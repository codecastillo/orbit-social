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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Centered, Field } from "@/components/ui";
import {
  deleteCommunity,
  getCommunityBySlug,
  updateCommunity,
  type JoinPolicy,
} from "@/lib/queries/communities";
import { colors, radii, spacing } from "@/lib/theme";

const NAME_MAX_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 300;

const JOIN_POLICIES: { value: JoinPolicy; title: string; hint: string }[] = [
  {
    value: "public",
    title: "Anyone",
    hint: "Anyone can find this room and join it straight away.",
  },
  {
    value: "approval",
    title: "By request",
    hint: "People ask to join and you approve them from the Requests screen.",
  },
  {
    value: "invite",
    title: "Invite only",
    hint: "The room is hidden and people can only join with an invite.",
  },
];

/**
 * Owner-only room settings. Until now a room's name, description, and privacy
 * were fixed at creation on this client, so closing a room after the fact
 * meant deleting it and starting again.
 */
export default function RoomSettingsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const communityQuery = useQuery({
    queryKey: ["community", slug],
    queryFn: () => getCommunityBySlug(slug),
    enabled: !!slug,
  });
  const community = communityQuery.data;

  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy | null>(null);

  // Seeded lazily from the loaded room so an in-progress edit is never
  // clobbered by a refetch.
  const nameValue = name ?? community?.name ?? "";
  const descriptionValue = description ?? community?.description ?? "";
  const policyValue = joinPolicy ?? community?.join_policy ?? "public";

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCommunity(community!.id, {
        name: nameValue.trim(),
        description: descriptionValue.trim(),
        joinPolicy: policyValue,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["my-communities"] });
      router.back();
    },
    onError: () => Alert.alert("Couldn't save these settings"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCommunity(community!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["my-communities"] });
      // Back twice: the room screen behind this one no longer exists.
      router.dismissAll();
      router.replace("/communities");
    },
    onError: () => Alert.alert("Couldn't delete this room"),
  });

  const confirmDelete = () =>
    Alert.alert(
      `Delete ${community?.name}?`,
      "The room and its membership are removed for everyone. Posts made in it stay on their authors' profiles.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );

  if (communityQuery.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: "Room settings" }} />
        <Centered>
          <Text style={styles.muted}>Loading</Text>
        </Centered>
      </>
    );
  }

  if (!community) {
    return (
      <>
        <Stack.Screen options={{ title: "Room settings" }} />
        <Centered>
          <Text style={styles.muted}>This room could not be loaded.</Text>
        </Centered>
      </>
    );
  }

  const canSave = nameValue.trim().length > 0 && !saveMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "Room settings",
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save room settings"
              disabled={!canSave}
              onPress={() => saveMutation.mutate()}
              hitSlop={8}
              style={({ pressed }) => [
                pressed && { opacity: 0.7 },
                !canSave && { opacity: 0.4 },
              ]}
            >
              <Text style={styles.save}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <Field
            value={nameValue}
            onChangeText={setName}
            placeholder="Room name"
            maxLength={NAME_MAX_LENGTH}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <Field
            value={descriptionValue}
            onChangeText={setDescription}
            placeholder="What is this room for?"
            maxLength={DESCRIPTION_MAX_LENGTH}
            multiline
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Who can join</Text>
          {JOIN_POLICIES.map((option) => {
            const active = policyValue === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.title}
                onPress={() => setJoinPolicy(option.value)}
                style={({ pressed }) => [
                  styles.policyRow,
                  active && styles.policyRowActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons
                  name={active ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={active ? colors.primary : colors.textFaint}
                />
                <View style={styles.policyCopy}>
                  <Text style={styles.policyTitle}>{option.title}</Text>
                  <Text style={styles.policyHint}>{option.hint}</Text>
                </View>
              </Pressable>
            );
          })}
          {policyValue === "public" && community.join_policy === "approval" ? (
            <Text style={styles.policyWarning}>
              Opening this room clears anyone currently waiting to be approved.
            </Text>
          ) : null}
        </View>

        <View style={styles.dangerZone}>
          <Text style={styles.label}>Delete this room</Text>
          <Text style={styles.dangerHint}>
            The room and its membership are removed for everyone. Posts made in
            it stay on their authors&apos; profiles.
          </Text>
          <Button
            label={deleteMutation.isPending ? "Deleting" : "Delete room"}
            variant="destructive"
            loading={deleteMutation.isPending}
            onPress={confirmDelete}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing(4),
    gap: spacing(5),
    paddingBottom: spacing(10),
  },
  save: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: spacing(4),
  },
  field: {
    gap: spacing(2),
  },
  label: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700",
  },
  muted: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(3),
    padding: spacing(3),
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  policyRowActive: {
    borderColor: colors.primary,
  },
  policyCopy: {
    flex: 1,
    gap: 2,
  },
  policyTitle: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  policyHint: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 17,
  },
  policyWarning: {
    color: colors.warning,
    fontSize: 12.5,
    lineHeight: 17,
  },
  dangerZone: {
    gap: spacing(2),
    paddingTop: spacing(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dangerHint: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: spacing(1),
  },
});
