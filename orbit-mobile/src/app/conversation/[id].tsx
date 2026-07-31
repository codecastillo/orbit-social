import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  MessageReactionBar,
  MessageReactionPills,
  type ReactionBarAnchor,
  type ReactionPill,
} from "@/components/message-reactions";
import { VoiceBubble } from "@/components/voice-bubble";
import {
  VOICE_MIN_MS,
  VoiceRecordingBar,
} from "@/components/voice-recording-bar";
import { prefetchVoice } from "@/lib/audio-cache";
import { safeBack } from "@/lib/nav";
import {
  MESSAGE_PAGE_SIZE,
  addMessageReaction,
  getConversations,
  getMessages,
  getMessagesReactions,
  markConversationRead,
  removeMessageReaction,
  sendMessage,
  sendVoiceMessage,
  voiceMessageUrl,
  type Message,
  type MessageReactionGroup,
} from "@/lib/queries/messages";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

// A run of consecutive messages from one sender breaks after this much
// silence, and a centered time chip marks the gap.
const TIME_GAP_MS = 20 * 60 * 1000;
const RUN_AVATAR_SIZE = 28;
const BUBBLE_RADIUS = 18;
const BUBBLE_RADIUS_TIGHT = 4;

function timeChipLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (date.toDateString() === now.toDateString()) return time;
  if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
    return `${date.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
  }
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
  return `${day}, ${time}`;
}

function MessageBubble({
  message,
  isMine,
  firstOfRun,
  lastOfRun,
  showTimeChip,
  avatarUrl,
  senderName,
  reactions,
  onLongPress,
  onToggleReaction,
}: {
  message: Message;
  isMine: boolean;
  firstOfRun: boolean;
  lastOfRun: boolean;
  showTimeChip: boolean;
  avatarUrl: string | null;
  senderName: string;
  reactions: ReactionPill[];
  onLongPress: (message: Message, anchor: ReactionBarAnchor) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
}) {
  const bubbleRef = useRef<View>(null);
  const handleLongPress = () => {
    if (message.is_deleted) return;
    bubbleRef.current?.measureInWindow((x, y, width) => {
      onLongPress(message, { x, y, width });
    });
  };
  const voiceUrl = message.is_deleted ? null : voiceMessageUrl(message);
  // Square the corner nearest the sender; the run's oldest message keeps the
  // full radius on top so runs read as one grouped block.
  const cornerStyle = isMine
    ? {
        borderTopRightRadius: firstOfRun ? BUBBLE_RADIUS : BUBBLE_RADIUS_TIGHT,
        borderBottomRightRadius: BUBBLE_RADIUS_TIGHT,
      }
    : {
        borderTopLeftRadius: firstOfRun ? BUBBLE_RADIUS : BUBBLE_RADIUS_TIGHT,
        borderBottomLeftRadius: BUBBLE_RADIUS_TIGHT,
      };

  return (
    <View
      style={[
        // In the inverted list a marginTop renders toward the older message,
        // so it carries the between-runs spacing.
        { marginTop: showTimeChip ? 0 : firstOfRun ? 10 : 2 },
      ]}
    >
      {showTimeChip ? (
        <Text style={styles.timeChip}>{timeChipLabel(message.created_at)}</Text>
      ) : null}
      <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
        {!isMine ? (
          <View style={styles.runAvatar}>
            {lastOfRun ? (
              <Avatar url={avatarUrl} name={senderName} size={RUN_AVATAR_SIZE} />
            ) : null}
          </View>
        ) : null}
        {voiceUrl ? (
          <Pressable
            ref={bubbleRef}
            onLongPress={handleLongPress}
            style={[
              styles.voiceWrap,
              cornerStyle,
              { backgroundColor: isMine ? colors.primary : colors.surfaceElevated },
            ]}
          >
            <VoiceBubble url={voiceUrl} isMine={isMine} />
          </Pressable>
        ) : (
          <Pressable
            ref={bubbleRef}
            onLongPress={handleLongPress}
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleTheirs,
              cornerStyle,
            ]}
          >
            {message.is_deleted ? (
              <Text style={[styles.bubbleText, styles.deletedText]}>
                Message deleted
              </Text>
            ) : (
              <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                {message.content}
              </Text>
            )}
          </Pressable>
        )}
      </View>
      {reactions.length > 0 ? (
        <View style={!isMine ? styles.pillGutter : null}>
          <MessageReactionPills
            reactions={reactions}
            isMine={isMine}
            onToggle={(emoji) => onToggleReaction(message.id, emoji)}
          />
        </View>
      ) : null}
    </View>
  );
}

function ThreadSkeleton() {
  const rows = [
    { mine: false, width: 180 },
    { mine: false, width: 120 },
    { mine: true, width: 200 },
    { mine: true, width: 96 },
    { mine: false, width: 150 },
    { mine: true, width: 170 },
  ];
  return (
    <View style={styles.skeletonWrap}>
      {rows.map((row, i) => (
        <View
          key={i}
          style={[
            styles.skeletonBubble,
            { width: row.width },
            row.mine && styles.skeletonBubbleMine,
          ]}
        />
      ))}
    </View>
  );
}

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = typeof params.id === "string" ? params.id : "";
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  // The conversations list is already cached from the Messages tab; reuse
  // it for the header name and avatar instead of a dedicated query.
  const { data: conversations } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => getConversations(user!.id),
    enabled: !!user,
  });
  const conversation = conversations?.find((c) => c.id === conversationId);
  const title = conversation
    ? conversation.is_group
      ? (conversation.name ?? "Group chat")
      : conversation.other_member?.display_name ||
        conversation.other_member?.username ||
        "Conversation"
    : "Conversation";

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) => getMessages(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < MESSAGE_PAGE_SIZE
        ? undefined
        : lastPage[lastPage.length - 1]?.created_at,
    enabled: !!user && !!conversationId,
  });

  const messageIds = (data?.pages.flat() ?? []).map((m) => m.id);

  // One batched query for every loaded message's reactions. The ids live in
  // the key, so realtime inserts and new pages refetch it automatically; the
  // web fetches per message on mount and has no reaction broadcast to mirror.
  const reactionsQuery = useQuery({
    queryKey: ["message-reactions", conversationId, messageIds],
    queryFn: () => getMessagesReactions(messageIds),
    enabled: !!user && messageIds.length > 0,
  });

  const [picker, setPicker] = useState<{
    messageId: string;
    anchor: ReactionBarAnchor;
  } | null>(null);

  // Same toggle semantics as the web message-bubble: insert to add, delete
  // by (message, user, emoji) to remove, optimistic patch, and a refetch as
  // the rollback when the write fails.
  const reactionMutation = useMutation({
    mutationFn: ({
      messageId,
      emoji,
      hasReacted,
    }: {
      messageId: string;
      emoji: string;
      hasReacted: boolean;
    }) =>
      hasReacted
        ? removeMessageReaction(messageId, user!.id, emoji)
        : addMessageReaction(messageId, user!.id, emoji),
    onMutate: async ({ messageId, emoji, hasReacted }) => {
      const key = ["message-reactions", conversationId, messageIds];
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Map<string, MessageReactionGroup[]>>(
        key,
        (old) => {
          const next = new Map(old);
          const groups = next.get(messageId) ?? [];
          const updated = hasReacted
            ? groups
                .map((g) =>
                  g.emoji === emoji
                    ? {
                        ...g,
                        count: g.count - 1,
                        userIds: g.userIds.filter((id) => id !== user!.id),
                      }
                    : g,
                )
                .filter((g) => g.count > 0)
            : groups.some((g) => g.emoji === emoji)
              ? groups.map((g) =>
                  g.emoji === emoji
                    ? { ...g, count: g.count + 1, userIds: [...g.userIds, user!.id] }
                    : g,
                )
              : [...groups, { emoji, count: 1, userIds: [user!.id] }];
          if (updated.length > 0) next.set(messageId, updated);
          else next.delete(messageId);
          return next;
        },
      );
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: ["message-reactions", conversationId],
      });
    },
  });

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!user) return;
      const hasReacted =
        reactionsQuery.data
          ?.get(messageId)
          ?.some((g) => g.emoji === emoji && g.userIds.includes(user.id)) ??
        false;
      reactionMutation.mutate({ messageId, emoji, hasReacted });
    },
    [user, reactionsQuery.data, reactionMutation],
  );

  const appendMessage = useCallback(
    (incoming: Message) => {
      queryClient.setQueryData<InfiniteData<Message[]>>(
        ["messages", conversationId],
        (old) => {
          if (!old) return old;
          // The sender's own insert arrives both from the mutation and the
          // realtime channel; keep whichever lands first.
          if (old.pages.some((page) => page.some((m) => m.id === incoming.id))) {
            return old;
          }
          return {
            ...old,
            pages: [
              [incoming, ...(old.pages[0] ?? [])],
              ...old.pages.slice(1),
            ],
          };
        },
      );
    },
    [queryClient, conversationId],
  );

  // Opening the thread clears its unread state; refresh the list badge on
  // the way out.
  useEffect(() => {
    if (!user || !conversationId) return;
    markConversationRead(conversationId, user.id).catch(() => {});
    return () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
    };
  }, [user, conversationId, queryClient]);

  useEffect(() => {
    if (!user || !conversationId) return;
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          appendMessage(payload.new as Message);
          markConversationRead(conversationId, user.id).catch(() => {});
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, conversationId, appendMessage]);

  // Realtime drops silently while backgrounded and never replays, so catch
  // up whenever the app returns to the foreground. Reactions have no
  // realtime channel at all (matching the web), so they ride along here.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        void refetch();
        queryClient.invalidateQueries({
          queryKey: ["message-reactions", conversationId],
        });
      }
    });
    return () => subscription.remove();
  }, [refetch, queryClient, conversationId]);

  // Warm the local voice cache so the first tap on a clip plays instantly
  // instead of streaming.
  useEffect(() => {
    const urls = (data?.pages.flat() ?? [])
      .map((m) => (m.is_deleted ? null : voiceMessageUrl(m)))
      .filter((url): url is string => url !== null);
    if (urls.length > 0) void prefetchVoice(urls);
  }, [data]);

  // Drive a bottom spacer on the keyboard's own animation curve so the
  // composer rises in lockstep with the keyboard. KeyboardAvoidingView lags
  // behind it. Android never emits keyboardWill* events and handles the
  // inset itself, so the spacer simply rests there.
  const kbRest = Math.max(insets.bottom - 8, 0);
  const [kbSpace] = useState(() => new Animated.Value(kbRest));
  useEffect(() => {
    // Match iOS's keyboard animation curve so the spacer tracks the keyboard
    // for the whole rise, not just the start and end.
    const keyboardEasing = Easing.bezier(0.17, 0.59, 0.25, 1);
    const show = Keyboard.addListener("keyboardWillShow", (e) => {
      Animated.timing(kbSpace, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        easing: keyboardEasing,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener("keyboardWillHide", (e) => {
      Animated.timing(kbSpace, {
        toValue: kbRest,
        duration: e.duration || 250,
        easing: keyboardEasing,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [kbSpace, kbRest]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(conversationId, user!.id, content),
    onSuccess: (message) => {
      appendMessage(message);
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
  });

  const voiceMutation = useMutation({
    mutationFn: (uri: string) => sendVoiceMessage(conversationId, user!.id, uri),
    onSuccess: (message) => {
      appendMessage(message);
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
    onError: () => {
      Alert.alert(
        "Voice message not sent",
        "Check your connection and try again.",
      );
    },
  });

  // The live meter and timer live in VoiceRecordingBar so the recorder's
  // frequent metering updates only re-render that bar, never this screen.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const [recording, setRecording] = useState(false);

  const startRecording = async () => {
    if (recording || voiceMutation.isPending) return;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Microphone needed",
        "Turn on microphone access in Settings to send a voice message.",
      );
      return;
    }
    // Recording fails unless the session allows it before prepare/record.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  const finishRecording = async (shouldSend: boolean) => {
    if (!recording) return;
    // durationMillis resets once stop() lands, so read it first.
    const durationMs = recorder.getStatus().durationMillis;
    setRecording(false);
    try {
      await recorder.stop();
    } catch {
      // Nothing to send if the recorder never got going.
    }
    // Playback stays quiet until the session leaves recording mode.
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    // Ignore accidental taps that record almost nothing.
    if (shouldSend && uri && durationMs >= VOICE_MIN_MS) {
      voiceMutation.mutate(uri);
    }
  };

  const handleSend = () => {
    const content = draft.trim();
    if (!content || sendMutation.isPending) return;
    setDraft("");
    sendMutation.mutate(content);
  };

  if (!user) return null;

  const messages = data?.pages.flat() ?? [];
  const hasText = draft.trim().length > 0;

  // Messages arrive newest-first: index + 1 is the older neighbor, index - 1
  // the newer one. A run breaks on a sender change or a long silence.
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const older = messages[index + 1];
    const newer = messages[index - 1];
    const showTimeChip =
      !older ||
      new Date(item.created_at).getTime() - new Date(older.created_at).getTime() >
        TIME_GAP_MS;
    const firstOfRun =
      showTimeChip || !older || older.sender_id !== item.sender_id;
    const lastOfRun =
      !newer ||
      newer.sender_id !== item.sender_id ||
      new Date(newer.created_at).getTime() - new Date(item.created_at).getTime() >
        TIME_GAP_MS;
    const reactions: ReactionPill[] = (
      reactionsQuery.data?.get(item.id) ?? []
    ).map((g) => ({
      emoji: g.emoji,
      count: g.count,
      hasReacted: g.userIds.includes(user.id),
    }));
    return (
      <MessageBubble
        message={item}
        isMine={item.sender_id === user.id}
        firstOfRun={firstOfRun}
        lastOfRun={lastOfRun}
        showTimeChip={showTimeChip}
        avatarUrl={
          item.sender?.avatar_url ??
          conversation?.other_member?.avatar_url ??
          null
        }
        senderName={item.sender?.display_name ?? title}
        reactions={reactions}
        onLongPress={(message, anchor) =>
          setPicker({ messageId: message.id, anchor })
        }
        onToggleReaction={toggleReaction}
      />
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => safeBack(router)}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        {conversation && !conversation.is_group ? (
          <Avatar
            url={conversation.other_member?.avatar_url}
            name={title}
            size={32}
          />
        ) : null}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.body}>
        {isPending ? (
          <ThreadSkeleton />
        ) : isError ? (
          <EmptyState
            title="Messages did not load"
            description="Check your connection and try again."
            action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
          />
        ) : messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Say hello to start the conversation."
          />
        ) : (
          <FlatList
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            extraData={reactionsQuery.data}
            contentContainerStyle={styles.messageList}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <ActivityIndicator
                  color={colors.mutedForeground}
                  style={{ paddingVertical: spacing(3) }}
                />
              ) : null
            }
          />
        )}

        <View style={styles.composer}>
          {recording ? (
            <VoiceRecordingBar
              recorder={recorder}
              onCancel={() => void finishRecording(false)}
              onSend={() => void finishRecording(true)}
              onAutoStop={() => void finishRecording(true)}
            />
          ) : (
            <>
              <TextInput
                style={styles.composerInput}
                placeholder="Message"
                placeholderTextColor={colors.textFaint}
                value={draft}
                onChangeText={setDraft}
                multiline
                accessibilityLabel="Message text"
              />
              {hasText ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  onPress={handleSend}
                  disabled={sendMutation.isPending}
                  style={({ pressed }) => [
                    styles.sendButton,
                    sendMutation.isPending && { opacity: 0.4 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {sendMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Ionicons name="arrow-up" size={20} color={colors.primaryForeground} />
                  )}
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Record a voice message"
                  onPress={() => void startRecording()}
                  disabled={voiceMutation.isPending}
                  style={({ pressed }) => [
                    styles.micButton,
                    voiceMutation.isPending && { opacity: 0.4 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {voiceMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="mic" size={20} color={colors.primary} />
                  )}
                </Pressable>
              )}
            </>
          )}
        </View>
        <Animated.View style={{ height: kbSpace }} />
      </View>

      <MessageReactionBar
        visible={picker !== null}
        anchor={picker?.anchor ?? null}
        existingEmojis={
          picker
            ? (reactionsQuery.data?.get(picker.messageId) ?? [])
                .filter((g) => g.userIds.includes(user.id))
                .map((g) => g.emoji)
            : []
        }
        onSelect={(emoji) => {
          if (picker) toggleReaction(picker.messageId, emoji);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  body: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
  },
  timeChip: {
    alignSelf: "center",
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: spacing(4),
    marginBottom: spacing(2),
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  runAvatar: {
    width: RUN_AVATAR_SIZE,
    marginRight: spacing(1.5),
  },
  // Keeps their pills aligned with the bubble, past the avatar column.
  pillGutter: {
    paddingLeft: RUN_AVATAR_SIZE + spacing(1.5),
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: BUBBLE_RADIUS,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
  },
  bubbleMine: {
    backgroundColor: colors.primary,
  },
  bubbleTheirs: {
    backgroundColor: colors.surfaceElevated,
  },
  bubbleText: {
    color: colors.foreground,
    fontSize: 14.5,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: colors.primaryForeground,
  },
  deletedText: {
    color: colors.mutedForeground,
    fontStyle: "italic",
  },
  // The voice bubble owns its own padding and radius; the wrapper only
  // supplies the run-aware silhouette in the matching bubble color so the
  // squared corner reads through.
  voiceWrap: {
    maxWidth: "75%",
    borderRadius: BUBBLE_RADIUS,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2),
    paddingBottom: spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    color: colors.foreground,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    fontSize: 14.5,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonWrap: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing(3),
    gap: spacing(2),
  },
  skeletonBubble: {
    height: 36,
    borderRadius: BUBBLE_RADIUS,
    backgroundColor: colors.surfaceElevated,
    alignSelf: "flex-start",
  },
  skeletonBubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.surface,
  },
});
