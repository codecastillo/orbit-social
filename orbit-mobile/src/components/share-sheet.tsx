import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui";
import {
  getConversations,
  sendMessage,
  type ConversationWithPreview,
} from "@/lib/queries/messages";
import { useAuth } from "@/providers/auth-provider";
import { recordAction, type ImpressionSurface } from "@/lib/impressions";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
const FADE_MS = 160;
const SLIDE_MS = 200;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;
const NOTE_MAX_LENGTH = 500;
// Long enough to read the "Sent" confirmation before the sheet closes.
const CLOSE_DELAY_MS = 700;
// Long enough for the "Copied" state to register as feedback.
const COPIED_RESET_MS = 2000;

function conversationTitle(conv: ConversationWithPreview): string {
  if (conv.is_group) return conv.name ?? "Group chat";
  return (
    conv.other_member?.display_name ||
    conv.other_member?.username ||
    "Conversation"
  );
}

/**
 * Bottom-sheet share menu for a post, matching the web ShareDialog
 * (src/components/shared/share-dialog.tsx): send the link to a chat with an
 * optional note, copy it, or hand it to the OS share sheet. The picker step
 * mirrors ForwardSheet, which forwards an existing message instead of a link.
 */
export function ShareSheet({
  visible,
  onClose,
  url,
  postId,
  surface,
}: {
  visible: boolean;
  onClose: () => void;
  url: string;
  postId: string;
  surface: ImpressionSurface;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [fade] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(height));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const { data: conversations } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => getConversations(user!.id),
    enabled: !!user && visible && picking,
  });

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

  // Clear on the way out (instead of an effect on !visible) so a persistent
  // mount reopens fresh rather than on the last send's state.
  const handleClose = () => {
    setPicking(false);
    setNote("");
    setCopied(false);
    setSendingId(null);
    setSentId(null);
    setFailed(false);
    onClose();
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(url);
    // Copying the link and handing it to the OS sheet both send the post out
    // of Orbit; only the conversation picker below is a share_dm.
    recordAction(postId, "share_external", surface);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_RESET_MS);
  };

  const handleNativeShare = () => {
    recordAction(postId, "share_external", surface);
    Share.share(Platform.OS === "ios" ? { url } : { message: url }).catch(() => {});
    handleClose();
  };

  const sendTo = async (conv: ConversationWithPreview) => {
    if (!user || sendingId || sentId) return;
    setFailed(false);
    setSendingId(conv.id);
    try {
      // The note leads and the link follows on its own line, so the receiver
      // gets context plus a tappable link in one message (same as the web).
      const trimmed = note.trim();
      // shared_post_id rides along with the link text so the share is a
      // structured reference rather than a URL to parse out of the body.
      await sendMessage(
        conv.id,
        user.id,
        trimmed ? `${trimmed}\n${url}` : url,
        undefined,
        undefined,
        undefined,
        postId,
      );
      recordAction(postId, "share_dm", surface);
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
          accessibilityLabel="Close share"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            maxHeight: height * 0.7,
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
          {picking ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to share options"
              onPress={() => setPicking(false)}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
          <Text style={styles.headerTitle}>
            {picking ? "Send to" : "Share post"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close share"
            onPress={handleClose}
            hitSlop={8}
            style={({ pressed }) => [styles.headerClose, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {picking ? (
          <>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={NOTE_MAX_LENGTH}
              style={styles.noteInput}
              accessibilityLabel="Note to send with the link"
            />

            {failed ? (
              <Text style={styles.errorText}>
                Message not sent. Check your connection and try again.
              </Text>
            ) : null}

            <FlatList
              data={conversations ?? []}
              keyExtractor={(conv) => conv.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyText}>No conversations yet.</Text>
              }
              renderItem={({ item }) => {
                const title = conversationTitle(item);
                const isSent = sentId === item.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Send to ${title}`}
                    onPress={() => sendTo(item)}
                    disabled={!!sendingId || !!sentId}
                    style={({ pressed }) => [
                      styles.conversationRow,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Avatar
                      url={item.is_group ? item.avatar_url : item.other_member?.avatar_url}
                      name={title}
                      size={36}
                    />
                    <Text style={styles.conversationTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    {isSent ? (
                      <View style={styles.sentBadge}>
                        <Ionicons name="checkmark" size={13} color={colors.success} />
                        <Text style={styles.sentLabel}>Sent</Text>
                      </View>
                    ) : sendingId === item.id ? (
                      <Text style={styles.sendingLabel}>Sending...</Text>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </>
        ) : (
          <View style={styles.optionList}>
            <ShareOption
              icon="paper-plane-outline"
              label="Send to..."
              hint="Share in a conversation"
              onPress={() => setPicking(true)}
            />
            <ShareOption
              icon={copied ? "checkmark" : "link-outline"}
              label={copied ? "Link copied" : "Copy link"}
              hint="Copy the post link to your clipboard"
              tint={copied ? colors.success : undefined}
              onPress={handleCopy}
            />
            <ShareOption
              icon="share-outline"
              label="Share via..."
              hint="Open your device's share sheet"
              onPress={handleNativeShare}
            />
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

function ShareOption({
  icon,
  label,
  hint,
  tint,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  hint: string;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={18} color={tint ?? colors.foreground} />
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, tint ? { color: tint } : null]}>
          {label}
        </Text>
        <Text style={styles.optionHint}>{hint}</Text>
      </View>
    </Pressable>
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
    gap: spacing(2),
    paddingBottom: spacing(2.5),
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  headerClose: {
    marginLeft: "auto",
  },
  optionList: {
    paddingBottom: spacing(1),
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(2.5),
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  optionHint: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 1,
  },
  noteInput: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 19,
    minHeight: 44,
    maxHeight: 96,
    textAlignVertical: "top",
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    marginBottom: spacing(2),
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(2.5),
  },
  conversationTitle: {
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
