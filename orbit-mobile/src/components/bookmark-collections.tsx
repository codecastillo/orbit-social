import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { Button, Field } from "@/components/ui";
import {
  createBookmarkCollection,
  updateBookmark,
  type BookmarkCollection,
  type SavedPost,
} from "@/lib/queries/bookmarks";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const NOTE_MAX_LENGTH = 280;
const NAME_MAX_LENGTH = 50;
const BACKDROP = "rgba(0, 0, 0, 0.55)";

/** Chips across the top of the saved list: All, then one per collection. */
export function CollectionFilter({
  collections,
  active,
  onChange,
}: {
  collections: BookmarkCollection[];
  active: string | null;
  onChange: (id: string | null) => void;
}) {
  if (collections.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {[{ id: null as string | null, name: "All" }, ...collections].map(
        (collection) => {
          const selected = active === collection.id;
          return (
            <Pressable
              key={collection.id ?? "all"}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(collection.id)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={[styles.chipLabel, selected && styles.chipLabelActive]}
              >
                {collection.name}
              </Text>
            </Pressable>
          );
        },
      )}
    </ScrollView>
  );
}

/**
 * Files one save into a collection and holds its note.
 *
 * The note is the reason this exists. A folder tells you a save is about
 * cooking; the note tells you it was the only carbonara recipe without cream,
 * which is what makes a save from a year ago worth having kept.
 *
 * Note and collection are written together in one update, so choosing a
 * collection is also what commits whatever was typed above it.
 */
export function FileSaveSheet({
  visible,
  saved,
  collections,
  onClose,
  onDone,
}: {
  visible: boolean;
  saved: SavedPost;
  collections: BookmarkCollection[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState(saved.note ?? "");
  const [newName, setNewName] = useState("");
  const [naming, setNaming] = useState(false);

  const file = useMutation({
    mutationFn: (collectionId: string | null) =>
      updateBookmark(user!.id, saved.post.id, { collectionId, note }),
    onSuccess: onDone,
    onError: () => Alert.alert("Couldn't file this save"),
  });

  const createAndFile = useMutation({
    mutationFn: async () => {
      const collection = await createBookmarkCollection(user!.id, newName);
      await updateBookmark(user!.id, saved.post.id, {
        collectionId: collection.id,
        note,
      });
    },
    onSuccess: onDone,
    onError: (err: unknown) =>
      Alert.alert(
        err instanceof Error && /duplicate|unique/i.test(err.message)
          ? "You already have a collection with that name"
          : "Couldn't create this collection",
      ),
  });

  const busy = file.isPending || createAndFile.isPending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(4) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {naming ? "New collection" : "Save to"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {naming ? (
            <>
              <Field
                value={newName}
                onChangeText={setNewName}
                placeholder="Recipes, references, things to read"
                maxLength={NAME_MAX_LENGTH}
                autoFocus
              />
              <Button
                label="Create and save here"
                loading={createAndFile.isPending}
                disabled={newName.trim().length === 0}
                onPress={() => createAndFile.mutate()}
              />
              <Button
                label="Back"
                variant="outline"
                onPress={() => setNaming(false)}
              />
            </>
          ) : (
            <>
              <Text style={styles.noteLabel}>Note to yourself</Text>
              <Field
                value={note}
                onChangeText={setNote}
                placeholder="Why you kept this"
                maxLength={NOTE_MAX_LENGTH}
                multiline
              />

              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {collections.map((collection) => {
                  const current = saved.collection_id === collection.id;
                  return (
                    <Pressable
                      key={collection.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: current }}
                      disabled={busy}
                      onPress={() => file.mutate(collection.id)}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Ionicons
                        name={current ? "checkmark-circle" : "folder-outline"}
                        size={20}
                        color={current ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={styles.rowLabel}>{collection.name}</Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setNaming(true)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={[styles.rowLabel, { color: colors.primary }]}>
                    New collection
                  </Text>
                </Pressable>

                {saved.collection_id ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => file.mutate(null)}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={20}
                      color={colors.mutedForeground}
                    />
                    <Text style={styles.rowLabel}>Remove from collection</Text>
                  </Pressable>
                ) : null}
              </ScrollView>

              {/* Saves the note without changing where the post is filed,
                  which is the only way to edit a note on an unfiled save. */}
              <Button
                label="Save note"
                variant="outline"
                loading={file.isPending}
                onPress={() => file.mutate(saved.collection_id)}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  chip: {
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP,
  },
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    gap: spacing(3),
    padding: spacing(4),
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  noteLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700",
  },
  // Capped so a long list of collections cannot push the note field and the
  // buttons off the top of the sheet.
  list: {
    maxHeight: 220,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(3),
  },
  rowLabel: {
    color: colors.foreground,
    fontSize: 15,
  },
});
