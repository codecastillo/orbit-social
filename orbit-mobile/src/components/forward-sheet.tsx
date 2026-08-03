import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui";
import {
  getConversations,
  sendMessage,
  type ConversationWithPreview,
  type Message,
  type MessageMediaType,
} from "@/lib/queries/messages";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
const FADE_MS = 160;
const SLIDE_MS = 200;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;
// Long enough to read the "Sent" confirmation before the sheet closes.
const CLOSE_DELAY_MS = 700;

function conversationTitle(conv: ConversationWithPreview): string {
  if (conv.is_group) return conv.name ?? "Group chat";
  return (
    conv.other_member?.display_name ||
    conv.other_member?.username ||
    "Conversation"
  );
}

/**
 * Bottom-sheet picker for forwarding a message: recent conversations with a
 * search filter. Picking one sends a copy (content and media) immediately,
 * no undo window. Same backdrop-fade plus slide as ReportSheet.
 */
export function ForwardSheet({
  visible,
  onClose,
  message,
}: {
  visible: boolean;
  onClose: () => void;
  message: Message | null;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [fade] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(height));
  const [filter, setFilter] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const { data: conversations } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => getConversations(user!.id),
    enabled: !!user && visible,
  });

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

  const handleClose = () => {
    setFilter("");
    setSendingId(null);
    setSentId(null);
    setFailed(false);
    onClose();
  };

  const query = filter.trim().toLowerCase();
  const rows = (conversations ?? []).filter((conv) => {
    if (!query) return true;
    const haystack = [
      conversationTitle(conv),
      conv.other_member?.username ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  const forwardTo = async (conv: ConversationWithPreview) => {
    if (!user || !message || sendingId || sentId) return;
    setFailed(false);
    setSendingId(conv.id);
    try {
      await sendMessage(
        conv.id,
        user.id,
        message.content ?? "",
        message.media_url ?? undefined,
        (message.media_type as MessageMediaType | null) ?? undefined,
      );
      setSentId(conv.id);
      queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      queryClient.invalidateQueries({ queryKey: ["messages", conv.id] });
      setTimeout(handleClose, CLOSE_DELAY_MS);
    } catch {
      setFailed(true);
    } finally {
      setSendingId(null);
    }
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
          accessibilityLabel="Close forward"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            maxHeight: height * 0.7,
            paddingBottom: insets.bottom + spacing(3),
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Forward to</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close forward"
            onPress={handleClose}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder="Search conversations"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search conversations"
          />
        </View>

        {failed ? (
          <Text style={styles.errorText}>
            Message not forwarded. Check your connection and try again.
          </Text>
        ) : null}

        <FlatList
          data={rows}
          keyExtractor={(conv) => conv.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>No conversations found.</Text>
          }
          renderItem={({ item }) => {
            const title = conversationTitle(item);
            const isSent = sentId === item.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Forward to ${title}`}
                onPress={() => forwardTo(item)}
                disabled={!!sendingId || !!sentId}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Avatar
                  url={item.is_group ? item.avatar_url : item.other_member?.avatar_url}
                  name={title}
                  size={36}
                />
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {title}
                </Text>
                {isSent ? (
                  <View style={styles.sentBadge}>
                    <Ionicons
                      name="checkmark"
                      size={13}
                      color={colors.success}
                    />
                    <Text style={styles.sentLabel}>Sent</Text>
                  </View>
                ) : sendingId === item.id ? (
                  <Text style={styles.sendingLabel}>Sending...</Text>
                ) : null}
              </Pressable>
            );
          }}
        />
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
    bottom: 0,
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
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    marginBottom: spacing(2),
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    paddingVertical: spacing(2.5),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(2.5),
  },
  rowTitle: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "500",
  },
  sentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  sentLabel: {
    color: colors.success,
    fontSize: 12.5,
    fontWeight: "600",
  },
  sendingLabel: {
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 12.5,
    paddingBottom: spacing(2),
  },
  emptyText: {
    color: colors.mutedForeground,
    fontSize: 13,
    paddingVertical: spacing(4),
    textAlign: "center",
  },
});
