import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getPinnedMessages, type Message } from "@/lib/queries/messages";
import { colors, radii, spacing } from "@/lib/theme";

// Same fallback the web pinned panel uses for media-only messages.
function pinSnippet(message: Message): string {
  return message.content || "Media";
}

/**
 * Compact strip under the conversation header showing the latest pinned
 * message; tapping it opens a sheet listing every pin, mirroring the web
 * info panel's primary-tinted rows.
 */
export function PinnedStrip({ conversationId }: { conversationId: string }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const { data: pinned } = useQuery({
    queryKey: ["pinned-messages", conversationId],
    queryFn: () => getPinnedMessages(conversationId),
    enabled: !!conversationId,
  });

  if (!pinned || pinned.length === 0) return null;
  const latest = pinned[0];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${pinned.length} pinned ${pinned.length === 1 ? "message" : "messages"}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.strip, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="pin" size={13} color={colors.primary} />
        <Text style={styles.stripText} numberOfLines={1}>
          {pinSnippet(latest)}
        </Text>
        {pinned.length > 1 ? (
          <Text style={styles.stripCount}>{pinned.length}</Text>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Dismiss pinned messages"
        />
        <View
          style={[styles.panel, { paddingBottom: insets.bottom + spacing(3) }]}
        >
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>
              Pinned · {pinned.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close pinned messages"
              onPress={() => setOpen(false)}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {pinned.map((message) => (
              <View key={message.id} style={styles.pinRow}>
                <Text style={styles.pinSender} numberOfLines={1}>
                  {message.sender?.display_name ||
                    message.sender?.username ||
                    "Message"}
                </Text>
                <Text style={styles.pinContent} numberOfLines={3}>
                  {pinSnippet(message)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    marginHorizontal: spacing(3),
    marginTop: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(172, 119, 250, 0.2)",
    backgroundColor: "rgba(172, 119, 250, 0.05)",
  },
  stripText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12.5,
  },
  stripCount: {
    color: colors.primary,
    fontSize: 11.5,
    fontWeight: "600",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "60%",
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  panelTitle: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  list: {
    paddingTop: spacing(3),
    gap: spacing(2),
  },
  pinRow: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "rgba(172, 119, 250, 0.2)",
    backgroundColor: "rgba(172, 119, 250, 0.05)",
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  pinSender: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  pinContent: {
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
});
