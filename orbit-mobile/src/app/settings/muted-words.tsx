import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState } from "@/components/ui";
import { addMutedWord, removeMutedWord } from "@/lib/queries/content-safety";
import { useMutedWords } from "@/lib/hooks/use-content-safety";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

function WordRow({ word, onRemove }: { word: string; onRemove: () => void }) {
  return (
    <View style={styles.wordRow}>
      <Text style={styles.wordText} numberOfLines={1}>
        {word}
      </Text>
      <Button
        label="Remove"
        variant="outline"
        onPress={onRemove}
        style={styles.wordAction}
      />
    </View>
  );
}

export default function MutedWordsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const wordsKey = ["muted-words", user?.id];

  const [input, setInput] = useState("");

  const wordsQuery = useMutedWords();

  const addMutation = useMutation({
    mutationFn: (word: string) => addMutedWord(user!.id, word),
    onMutate: async (word) => {
      await queryClient.cancelQueries({ queryKey: wordsKey });
      const previous = queryClient.getQueryData<string[]>(wordsKey);
      queryClient.setQueryData<string[]>(wordsKey, (list) => [
        ...(list ?? []),
        word,
      ]);
      return { previous };
    },
    onError: (_error, word, context) => {
      queryClient.setQueryData(wordsKey, context?.previous);
      Alert.alert(`Couldn't mute "${word}"`);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (word: string) => removeMutedWord(user!.id, word),
    onMutate: async (word) => {
      await queryClient.cancelQueries({ queryKey: wordsKey });
      const previous = queryClient.getQueryData<string[]>(wordsKey);
      queryClient.setQueryData<string[]>(wordsKey, (list) =>
        list?.filter((w) => w !== word),
      );
      return { previous };
    },
    onError: (_error, word, context) => {
      queryClient.setQueryData(wordsKey, context?.previous);
      Alert.alert(`Couldn't unmute "${word}"`);
    },
  });

  if (!user) return null;

  const words = wordsQuery.data ?? [];

  const handleAdd = () => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;
    setInput("");
    if (words.includes(trimmed)) {
      Alert.alert(`"${trimmed}" is already muted`);
      return;
    }
    addMutation.mutate(trimmed);
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Muted words" }} />

      <Text style={styles.explainer}>
        Posts and comments containing these words are hidden from your feeds.
        The list syncs across all your devices.
      </Text>

      <Text style={styles.sectionTitle}>Add a word</Text>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a word to mute"
          placeholderTextColor={colors.textFaint}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Word to mute"
        />
        <Button
          label="Add"
          onPress={handleAdd}
          disabled={!input.trim()}
          style={styles.addButton}
        />
      </View>

      <Text style={styles.sectionTitle}>
        Muted words{wordsQuery.data ? ` (${words.length})` : ""}
      </Text>
      {wordsQuery.isPending ? (
        <View style={styles.sectionPending}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : wordsQuery.isError ? (
        <EmptyState
          title="Muted words did not load"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => wordsQuery.refetch()}
            />
          }
        />
      ) : words.length === 0 ? (
        <Text style={styles.sectionEmpty}>
          Nothing muted yet. Add a word above to filter it from your feed.
        </Text>
      ) : (
        words.map((word) => (
          <WordRow
            key={word}
            word={word}
            onRemove={() => removeMutation.mutate(word)}
          />
        ))
      )}
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
  },
  explainer: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
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
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(2),
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
    paddingHorizontal: spacing(3.5),
    fontSize: 14.5,
  },
  addButton: {
    minHeight: 42,
    paddingHorizontal: spacing(4),
  },
  sectionPending: {
    paddingVertical: spacing(4),
  },
  sectionEmpty: {
    color: colors.mutedForeground,
    fontSize: 13,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  wordText: {
    flex: 1,
    minWidth: 0,
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  wordAction: {
    minHeight: 34,
    paddingHorizontal: spacing(3.5),
  },
});
