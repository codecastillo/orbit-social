import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
  Keyboard,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
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
  type ReactionBarAction,
  type ReactionBarAnchor,
  type ReactionPill,
} from "@/components/message-reactions";
import { LinkPreviewCard } from "@/components/link-preview-card";
import { ForwardSheet } from "@/components/forward-sheet";
import { MessageMedia } from "@/components/message-media";
import { PinnedStrip } from "@/components/pinned-messages";
import { ReportSheet } from "@/components/report-sheet";
import { VoiceBubble } from "@/components/voice-bubble";
import {
  VOICE_MIN_MS,
  VoiceRecordingBar,
} from "@/components/voice-recording-bar";
import { prefetchVoice } from "@/lib/audio-cache";
import { consumeConversationSearch } from "@/lib/conversation-search";
import { extractFirstUrl } from "@/lib/queries/link-previews";
import { safeBack } from "@/lib/nav";
import {
  MESSAGE_PAGE_SIZE,
  addMessageReaction,
  deleteMessage,
  editMessage,
  getConversations,
  getDmSeenAt,
  getMessageById,
  getMessages,
  getMessagesReactions,
  markConversationRead,
  pinMessage,
  removeMessageReaction,
  sendMessage,
  sendVoiceMessage,
  unpinMessage,
  uploadMessageMedia,
  voiceMessageUrl,
  type Message,
  type MessageMediaType,
  type MessageReactionGroup,
} from "@/lib/queries/messages";
import { unblockUser } from "@/lib/queries/settings";
import { useBlockedIds } from "@/lib/hooks/use-content-safety";
import { usePresence } from "@/lib/hooks/use-presence";
import { ActivityStatus } from "@/components/activity-status";
import {
  BLOCKED_DM_MESSAGE,
  MESSAGE_NOT_ALLOWED_MESSAGE,
  isBlockedDmError,
  isMessageNotAllowedError,
} from "@/lib/blocked-error";
import { supabase } from "@/lib/supabase";
import { flushUndoableSends, scheduleUndoableSend } from "@/lib/undo-send";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

// A run of consecutive messages from one sender breaks after this much
// silence, and a centered time chip marks the gap.
const TIME_GAP_MS = 20 * 60 * 1000;
const RUN_AVATAR_SIZE = 28;
const BUBBLE_RADIUS = 18;
const BUBBLE_RADIUS_TIGHT = 4;

// Typing broadcast pacing, mirrored on the web (typing-indicator.tsx): fire
// at most every 2s while the input changes, stop after 3s idle, and expire
// remote typers a beat later so a dropped stop event can't stick the row.
const TYPING_THROTTLE_MS = 2000;
const TYPING_IDLE_MS = 3000;
const TYPING_EXPIRE_MS = 4500;

// Own text messages can be edited this long after sending, and a message
// only shows "(edited)" when updated_at trails created_at by more than the
// grace period (so the insert itself never reads as an edit).
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const EDITED_GRACE_MS = 5000;

// How far the thread slides left to reveal per-message timestamps,
// iMessage-style: enough for a worst-case "12:59 PM" plus a comfortable gap
// so an outgoing bubble fully clears its time.
const TIMESTAMP_REVEAL = 96;

interface TypingPayload {
  userId: string;
  name: string;
  typing: boolean;
}

interface PickedDmMedia {
  uri: string;
  kind: MessageMediaType;
  mimeType: string;
}

interface QuotedReply {
  name: string;
  snippet: string;
}

/** One-line description of a message for the quoted-reply block. */
function replySnippet(message: Message): string {
  if (message.is_deleted) return "Message deleted";
  if (voiceMessageUrl(message)) return "Voice message";
  if (message.media_url) return message.content || "Media";
  if (message.content) return message.content.slice(0, 80);
  return "Message";
}

/** Wraps case-insensitive matches of the search query in a highlight. */
function highlightMatches(content: string, query: string): ReactNode {
  const q = query.trim().toLowerCase();
  if (!q) return content;
  const lower = content.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  while (true) {
    const idx = lower.indexOf(q, cursor);
    if (idx === -1) break;
    if (idx > cursor) parts.push(content.slice(cursor, idx));
    parts.push(
      <Text key={idx} style={styles.searchHit}>
        {content.slice(idx, idx + q.length)}
      </Text>,
    );
    cursor = idx + q.length;
  }
  if (parts.length === 0) return content;
  parts.push(content.slice(cursor));
  return parts;
}

/** Per-message time for the drag-reveal rail, h:mm a. */
function dragTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

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
  replyPreview,
  showSeen,
  searchQuery,
  revealX,
  timestampOpacity,
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
  replyPreview: QuotedReply | null;
  showSeen: boolean;
  searchQuery: string;
  revealX: Animated.Value;
  timestampOpacity: Animated.AnimatedInterpolation<number>;
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
  const isEdited =
    !!message.updated_at &&
    new Date(message.updated_at).getTime() >
      new Date(message.created_at).getTime() + EDITED_GRACE_MS;
  const quote = replyPreview ? (
    <View style={[styles.quote, isMine ? styles.quoteMine : styles.quoteTheirs]}>
      <Text
        style={[styles.quoteName, isMine && styles.quoteNameMine]}
        numberOfLines={1}
      >
        {replyPreview.name}
      </Text>
      <Text
        style={[styles.quoteSnippet, isMine && styles.quoteSnippetMine]}
        numberOfLines={1}
      >
        {replyPreview.snippet}
      </Text>
    </View>
  ) : null;
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
      {/* Sits under the sliding content at the right edge; the drag fades it
          in while revealX shifts the bubbles off it. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.dragTimestamp, { opacity: timestampOpacity }]}
      >
        <Text style={styles.dragTimestampText}>
          {dragTimeLabel(message.created_at)}
        </Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: revealX }] }}>
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
              {quote ? <View style={styles.voiceQuoteInset}>{quote}</View> : null}
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
                  This message was deleted
                </Text>
              ) : (
                <>
                  {quote}
                  {message.media_url ? (
                    <View style={message.content ? styles.mediaWrap : null}>
                      <MessageMedia
                        url={message.media_url}
                        mediaType={message.media_type}
                        onLongPress={handleLongPress}
                      />
                    </View>
                  ) : null}
                  {message.content ? (
                    <Text
                      style={[styles.bubbleText, isMine && styles.bubbleTextMine]}
                    >
                      {searchQuery
                        ? highlightMatches(message.content, searchQuery)
                        : message.content}
                      {isEdited ? (
                        <Text
                          style={[
                            styles.editedTag,
                            isMine && styles.editedTagMine,
                          ]}
                        >
                          {" (edited)"}
                        </Text>
                      ) : null}
                    </Text>
                  ) : null}
                  {(() => {
                    const previewUrl = message.content
                      ? extractFirstUrl(message.content)
                      : null;
                    return previewUrl ? (
                      <View style={styles.linkPreviewWrap}>
                        <LinkPreviewCard url={previewUrl} />
                      </View>
                    ) : null;
                  })()}
                </>
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
        {showSeen ? <Text style={styles.seenText}>Seen</Text> : null}
      </Animated.View>
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
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pickedMedia, setPickedMedia] = useState<PickedDmMedia | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  // The draft in progress when Edit swapped the composer, restored on exit.
  const [stashedDraft, setStashedDraft] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [forwardTarget, setForwardTarget] = useState<Message | null>(null);

  // Settings' "Search in conversation" row stages a module-level flag (the
  // draft-restore pattern) and pops back; consume it on focus to open the
  // search bar.
  useFocusEffect(
    useCallback(() => {
      if (consumeConversationSearch(conversationId)) setSearchOpen(true);
    }, [conversationId]),
  );

  // Swipe the thread left to reveal per-message timestamps, iMessage-style
  // (ported from mello's thread screen). The responder only claims clearly
  // horizontal leftward drags, so vertical scrolling and bubble long-presses
  // keep working. Lazy useState for the same stable-identity reason as
  // kbSpace below.
  const [revealX] = useState(() => new Animated.Value(0));
  const timestampOpacity = revealX.interpolate({
    inputRange: [-TIMESTAMP_REVEAL, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const [timestampPan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) =>
        revealX.setValue(Math.max(g.dx, -TIMESTAMP_REVEAL)),
      onPanResponderRelease: () =>
        Animated.spring(revealX, {
          toValue: 0,
          // JS-driven: the value is set imperatively on move and read by a
          // JS opacity interpolation; mixing in the native driver detaches
          // it and leaves timestamps stuck on screen (seen in mello).
          useNativeDriver: false,
          bounciness: 0,
        }).start(),
      onPanResponderTerminate: () =>
        Animated.spring(revealX, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 0,
        }).start(),
    }),
  );

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
  const isGroup = conversation?.is_group ?? false;

  // Only the viewer's own blocks are readable. If the other side blocked
  // them the composer stays put and the send surfaces the server's refusal.
  const { data: blockedIds } = useBlockedIds();
  const otherMemberId = conversation?.other_member?.id ?? null;
  const blockedCounterpart =
    !isGroup && !!otherMemberId && (blockedIds?.has(otherMemberId) ?? false);

  // DM-only: other_member stays null for groups, so this resolves to nothing
  // there.
  const presence = usePresence(isGroup ? null : otherMemberId);

  // Other member's read state for the "Seen" marker, gated inside
  // getDmSeenAt by the reciprocity rule. The newest message id keys the
  // query so it refreshes as messages land.
  const seenQuery = useQuery({
    queryKey: ["dm-seen", conversationId, messageIds[0] ?? null],
    queryFn: () => getDmSeenAt(conversationId),
    enabled: !!user && !!conversationId && !isGroup,
  });

  // Quoted replies resolve against loaded pages; anything older gets a
  // one-shot fetch cached here (null = deleted or unavailable).
  const [fetchedReplies, setFetchedReplies] = useState<
    Map<string, Message | null>
  >(new Map());

  useEffect(() => {
    const loaded = data?.pages.flat() ?? [];
    const loadedIds = new Set(loaded.map((m) => m.id));
    const missing = Array.from(
      new Set(
        loaded
          .map((m) => m.reply_to_id)
          .filter(
            (id): id is string =>
              !!id && !loadedIds.has(id) && !fetchedReplies.has(id),
          ),
      ),
    );
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.all(
      missing.map(
        async (id) => [id, await getMessageById(id).catch(() => null)] as const,
      ),
    ).then((entries) => {
      if (cancelled) return;
      setFetchedReplies((prev) => new Map([...prev, ...entries]));
    });
    return () => {
      cancelled = true;
    };
  }, [data, fetchedReplies]);

  // Ephemeral typing state over the shared `typing-{conversationId}`
  // broadcast topic, matching the web's typing-indicator hook so events
  // cross platforms.
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const typingLastSentRef = useRef(0);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingExpireRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const [typers, setTypers] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user || !conversationId) return;
    const expireTimers = typingExpireRef.current;
    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { userId, name, typing } = payload as TypingPayload;
        if (userId === user.id) return;

        setTypers((prev) => {
          const next = new Map(prev);
          if (typing) next.set(userId, name);
          else next.delete(userId);
          return next;
        });

        const existing = expireTimers.get(userId);
        if (existing) clearTimeout(existing);
        if (typing) {
          expireTimers.set(
            userId,
            setTimeout(() => {
              expireTimers.delete(userId);
              setTypers((prev) => {
                const next = new Map(prev);
                next.delete(userId);
                return next;
              });
            }, TYPING_EXPIRE_MS),
          );
        } else {
          expireTimers.delete(userId);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;

    return () => {
      typingChannelRef.current = null;
      for (const timer of expireTimers.values()) clearTimeout(timer);
      expireTimers.clear();
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
      setTypers(new Map());
      supabase.removeChannel(channel);
    };
  }, [user, conversationId]);

  const sendTyping = useCallback(
    (typing: boolean) => {
      if (!user) return;
      const name =
        (user.user_metadata?.display_name as string | undefined) ||
        (user.user_metadata?.username as string | undefined) ||
        "Someone";
      typingChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: user.id, name, typing },
      });
    },
    [user],
  );

  const notifyTyping = useCallback(
    (hasText: boolean) => {
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
      if (!hasText) {
        typingLastSentRef.current = 0;
        sendTyping(false);
        return;
      }
      const now = Date.now();
      if (now - typingLastSentRef.current >= TYPING_THROTTLE_MS) {
        typingLastSentRef.current = now;
        sendTyping(true);
      }
      typingIdleRef.current = setTimeout(() => {
        typingLastSentRef.current = 0;
        sendTyping(false);
      }, TYPING_IDLE_MS);
    },
    [sendTyping],
  );

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
    // Resolved when the bar opens: render-time Date.now is off-limits under
    // the compiler purity rule, and the window barely moves while it's up.
    canEdit: boolean;
  } | null>(null);

  // Message picked for reporting; there is no thread-level header menu, so
  // reporting rides the same long-press bar as reactions and Reply.
  const [reportTarget, setReportTarget] = useState<Message | null>(null);

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

  // Merge a realtime UPDATE into the cache, keeping the joined sender the
  // payload lacks. Pin flips also refresh the strip.
  const applyMessageUpdate = useCallback(
    (incoming: Message) => {
      queryClient.setQueryData<InfiniteData<Message[]>>(
        ["messages", conversationId],
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) =>
                m.id === incoming.id ? { ...m, ...incoming, sender: m.sender } : m,
              ),
            ),
          },
      );
      queryClient.invalidateQueries({
        queryKey: ["pinned-messages", conversationId],
      });
    },
    [queryClient, conversationId],
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Unsends, edits, and pin flips land here for both members.
          applyMessageUpdate(payload.new as Message);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // The other member's last_read_at moved; refresh the Seen marker.
          queryClient.invalidateQueries({
            queryKey: ["dm-seen", conversationId],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, conversationId, appendMessage, applyMessageUpdate, queryClient]);

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

  // Ids of this screen's undoable sends still inside their window. Flushed
  // on unmount so navigating away commits them instead of losing them.
  const pendingSendIdsRef = useRef<number[]>([]);
  useEffect(() => {
    const pendingIds = pendingSendIdsRef.current;
    return () => flushUndoableSends(pendingIds);
  }, []);

  const unblock = useMutation({
    mutationFn: () => unblockUser(user!.id, otherMemberId!),
    onError: () => Alert.alert("Couldn't unblock this account"),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-ids", user?.id] });
    },
  });

  const voiceMutation = useMutation({
    mutationFn: (uri: string) => sendVoiceMessage(conversationId, user!.id, uri),
    onSuccess: (message) => {
      appendMessage(message);
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
    onError: (error) => {
      if (isBlockedDmError(error)) {
        Alert.alert(BLOCKED_DM_MESSAGE);
        return;
      }
      if (isMessageNotAllowedError(error)) {
        Alert.alert(MESSAGE_NOT_ALLOWED_MESSAGE);
        return;
      }
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

  // Same picker caps as the compose screen; DMs attach one item per message.
  const pickDmMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 1,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    const mimeType = asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg");
    setPickedMedia({
      uri: asset.uri,
      kind: isVideo ? "video" : mimeType === "image/gif" ? "gif" : "image",
      mimeType,
    });
  };

  // Soft delete, immediately visible on both sides: the optimistic patch
  // here and the realtime UPDATE for the counterpart.
  const unsendMutation = useMutation({
    mutationFn: (messageId: string) => deleteMessage(messageId),
    onMutate: (messageId) => {
      queryClient.setQueryData<InfiniteData<Message[]>>(
        ["messages", conversationId],
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) =>
                m.id === messageId ? { ...m, is_deleted: true } : m,
              ),
            ),
          },
      );
    },
    onError: () => {
      void refetch();
      Alert.alert("Message not unsent", "Check your connection and try again.");
    },
  });

  const confirmUnsend = (message: Message) => {
    Alert.alert("Unsend message?", "This removes it for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unsend",
        style: "destructive",
        onPress: () => unsendMutation.mutate(message.id),
      },
    ]);
  };

  const pinMutation = useMutation({
    mutationFn: ({
      messageId,
      pinned,
    }: {
      messageId: string;
      pinned: boolean;
    }) => (pinned ? unpinMessage(messageId) : pinMessage(messageId)),
    onMutate: ({ messageId, pinned }) => {
      queryClient.setQueryData<InfiniteData<Message[]>>(
        ["messages", conversationId],
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) =>
                m.id === messageId ? { ...m, is_pinned: !pinned } : m,
              ),
            ),
          },
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["pinned-messages", conversationId],
      });
    },
    onError: () => {
      void refetch();
    },
  });

  const startEdit = (message: Message) => {
    setStashedDraft(draft);
    setEditing(message);
    setReplyTo(null);
    setPickedMedia(null);
    setDraft(message.content ?? "");
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft(stashedDraft);
    setStashedDraft("");
  };

  const editMutation = useMutation({
    mutationFn: ({
      messageId,
      content,
    }: {
      messageId: string;
      content: string;
    }) => editMessage(messageId, content),
    onError: () => {
      void refetch();
      Alert.alert("Edit not saved", "Check your connection and try again.");
    },
  });

  const handleSaveEdit = () => {
    const content = draft.trim();
    const target = editing;
    if (!target || !content) return;
    if (content !== target.content) {
      // Optimistic patch; the realtime UPDATE confirms with the server row.
      applyMessageUpdate({
        ...target,
        content,
        updated_at: new Date().toISOString(),
      });
      editMutation.mutate({ messageId: target.id, content });
    }
    cancelEdit();
  };

  const handleSend = () => {
    const content = draft.trim();
    const media = pickedMedia;
    if ((!content && !media) || !user) return;
    setDraft("");
    setPickedMedia(null);
    notifyTyping(false);
    const replyMessage = replyTo;
    const replyToId = replyMessage?.id;
    setReplyTo(null);

    // Same temp-id pattern as the web chat page: an optimistic bubble holds
    // the spot during the undo window and the commit swaps in the server row.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    appendMessage({
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      // The optimistic bubble shows the local file while the undo window
      // runs; the upload only happens at commit time.
      media_url: media?.uri ?? null,
      media_type: media?.kind ?? null,
      reply_to_id: replyToId ?? null,
      shared_post_id: null,
      is_deleted: false,
      is_pinned: false,
      updated_at: null,
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        username: (user.user_metadata?.username as string | undefined) ?? "",
        display_name:
          (user.user_metadata?.display_name as string | undefined) ?? "",
        avatar_url:
          (user.user_metadata?.avatar_url as string | undefined) ?? null,
      },
    });

    const removeOptimistic = () => {
      queryClient.setQueryData<InfiniteData<Message[]>>(
        ["messages", conversationId],
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => page.filter((m) => m.id !== tempId)),
          },
      );
    };

    const restoreDraft = () => {
      if (content) setDraft((prev) => (prev ? `${content} ${prev}` : content));
      if (media) setPickedMedia(media);
    };

    // A plain closure instead of useMutation: the commit may fire from the
    // unmount flush, after mutation observers are gone, and setQueryData on
    // the shared client still works then. The media upload also waits until
    // here so an undone send never costs an upload.
    const commit = async () => {
      try {
        const mediaUrl = media
          ? await uploadMessageMedia(user.id, media.uri, media.mimeType)
          : undefined;
        const message = await sendMessage(
          conversationId,
          user.id,
          content,
          mediaUrl,
          media?.kind,
          replyToId,
        );
        queryClient.setQueryData<InfiniteData<Message[]>>(
          ["messages", conversationId],
          (old) => {
            if (!old) return old;
            // The realtime insert may have landed the server row already;
            // in that case just drop the temp bubble.
            const exists = old.pages.some((page) =>
              page.some((m) => m.id === message.id),
            );
            return {
              ...old,
              pages: old.pages.map((page) =>
                exists
                  ? page.filter((m) => m.id !== tempId)
                  : page.map((m) => (m.id === tempId ? message : m)),
              ),
            };
          },
        );
        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      } catch (error) {
        removeOptimistic();
        restoreDraft();
        // The commit can fire from the unmount flush, after this screen is
        // gone, so the alert is the only surface left to report on.
        if (isBlockedDmError(error)) {
          Alert.alert(BLOCKED_DM_MESSAGE);
        } else if (isMessageNotAllowedError(error)) {
          Alert.alert(MESSAGE_NOT_ALLOWED_MESSAGE);
        } else {
          Alert.alert("Message not sent", "Check your connection and try again.");
        }
      }
    };

    pendingSendIdsRef.current.push(
      scheduleUndoableSend({
        message: "Sent",
        commit: () => void commit(),
        onUndo: () => {
          removeOptimistic();
          setReplyTo(replyMessage);
          restoreDraft();
        },
      }),
    );
  };

  if (!user) return null;

  const messages = data?.pages.flat() ?? [];
  const hasText = draft.trim().length > 0;

  // Client-side filter over loaded pages; no server FTS. The run grouping
  // recomputes over the filtered list, which is fine for a results view.
  const activeSearch = searchOpen ? searchQuery.trim() : "";
  const listMessages = activeSearch
    ? messages.filter(
        (m) =>
          !m.is_deleted &&
          (m.content ?? "").toLowerCase().includes(activeSearch.toLowerCase()),
      )
    : messages;

  const messageById = new Map(messages.map((m) => [m.id, m]));
  const resolveReply = (message: Message): QuotedReply | null => {
    if (!message.reply_to_id) return null;
    const source =
      messageById.get(message.reply_to_id) ??
      fetchedReplies.get(message.reply_to_id);
    if (!source) return null;
    return {
      name: source.sender?.display_name || "Message",
      snippet: replySnippet(source),
    };
  };

  // "Seen" sits under the newest own message the other member has read.
  // Messages arrive newest-first, so the first own message is the latest.
  let seenMessageId: string | null = null;
  const seenAt = seenQuery.data ?? null;
  if (seenAt && !isGroup) {
    const seenTime = new Date(seenAt).getTime();
    const lastOwn = messages.find((m) => m.sender_id === user.id);
    if (lastOwn && new Date(lastOwn.created_at).getTime() <= seenTime) {
      seenMessageId = lastOwn.id;
    }
  }

  const typingNames = Array.from(typers.values());
  const typingLabel =
    typingNames.length === 0
      ? null
      : isGroup
        ? typingNames.length === 1
          ? `${typingNames[0]} is typing...`
          : `${typingNames.slice(0, 2).join(" and ")} are typing...`
        : "Typing...";

  // Messages arrive newest-first: index + 1 is the older neighbor, index - 1
  // the newer one. A run breaks on a sender change or a long silence.
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const older = listMessages[index + 1];
    const newer = listMessages[index - 1];
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
        replyPreview={resolveReply(item)}
        showSeen={item.id === seenMessageId}
        searchQuery={activeSearch}
        revealX={revealX}
        timestampOpacity={timestampOpacity}
        onLongPress={(message, anchor) =>
          setPicker({
            messageId: message.id,
            anchor,
            canEdit:
              message.sender_id === user.id &&
              !!message.content &&
              !message.media_url &&
              !voiceMessageUrl(message) &&
              Date.now() - new Date(message.created_at).getTime() <=
                EDIT_WINDOW_MS,
          })
        }
        onToggleReaction={toggleReaction}
      />
    );
  };

  // Long-press bar rows for the picked message. Optimistic temp bubbles only
  // offer Reply; everything else needs the server row to exist.
  const pickerTarget = picker
    ? (messageById.get(picker.messageId) ?? null)
    : null;
  const barActions: ReactionBarAction[] = [];
  if (pickerTarget && !pickerTarget.is_deleted) {
    const isOwn = pickerTarget.sender_id === user.id;
    const isTemp = pickerTarget.id.startsWith("temp-");
    const closePicker = () => setPicker(null);
    barActions.push({
      label: "Reply",
      onPress: () => {
        setReplyTo(pickerTarget);
        closePicker();
      },
    });
    if (!isTemp) {
      if (picker?.canEdit) {
        barActions.push({
          label: "Edit",
          onPress: () => {
            startEdit(pickerTarget);
            closePicker();
          },
        });
      }
      barActions.push({
        label: "Forward",
        onPress: () => {
          setForwardTarget(pickerTarget);
          closePicker();
        },
      });
      barActions.push({
        label: pickerTarget.is_pinned ? "Unpin" : "Pin",
        onPress: () => {
          pinMutation.mutate({
            messageId: pickerTarget.id,
            pinned: pickerTarget.is_pinned,
          });
          closePicker();
        },
      });
      if (isOwn) {
        barActions.push({
          label: "Unsend",
          destructive: true,
          onPress: () => {
            confirmUnsend(pickerTarget);
            closePicker();
          },
        });
      } else {
        barActions.push({
          label: "Report",
          destructive: true,
          onPress: () => {
            setReportTarget(pickerTarget);
            closePicker();
          },
        });
      }
    }
  }

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
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {isGroup ? null : <ActivityStatus presence={presence} />}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Conversation settings"
            onPress={() =>
              router.push(`/conversation-settings/${conversationId}` as Href)
            }
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={colors.foreground}
            />
          </Pressable>
        </View>
      </View>

      {searchOpen ? (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search in conversation"
            placeholderTextColor={colors.textFaint}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search in conversation"
          />
          {searchQuery ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearchQuery("")}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Ionicons
                name="close-circle"
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close conversation search"
            onPress={() => {
              setSearchQuery("");
              setSearchOpen(false);
            }}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.searchCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      <PinnedStrip conversationId={conversationId} />

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
        ) : listMessages.length === 0 ? (
          <EmptyState
            title="No matches"
            description="No loaded messages match your search."
          />
        ) : (
          <View style={styles.listArea} {...timestampPan.panHandlers}>
            <FlatList
              data={listMessages}
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
          </View>
        )}

        {typingLabel ? (
          <Text style={styles.typingRow}>{typingLabel}</Text>
        ) : null}

        {editing ? (
          <View style={styles.replyBar}>
            <View style={styles.replyBarBody}>
              <Text style={styles.replyBarName} numberOfLines={1}>
                Editing message
              </Text>
              <Text style={styles.replyBarSnippet} numberOfLines={1}>
                {editing.content}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel edit"
              onPress={cancelEdit}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : replyTo ? (
          <View style={styles.replyBar}>
            <View style={styles.replyBarBody}>
              <Text style={styles.replyBarName} numberOfLines={1}>
                Replying to{" "}
                {replyTo.sender_id === user.id
                  ? "yourself"
                  : replyTo.sender?.display_name || "message"}
              </Text>
              <Text style={styles.replyBarSnippet} numberOfLines={1}>
                {replySnippet(replyTo)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
              onPress={() => setReplyTo(null)}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        {pickedMedia && !editing ? (
          <View style={styles.mediaChipRow}>
            <View style={styles.mediaChip}>
              {pickedMedia.kind === "video" ? (
                <View style={styles.mediaChipVideo}>
                  <Ionicons
                    name="videocam"
                    size={18}
                    color={colors.textSecondary}
                  />
                </View>
              ) : (
                <Image
                  source={{ uri: pickedMedia.uri }}
                  style={styles.mediaChipImage}
                  contentFit="cover"
                  alt="Attached image"
                />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove attachment"
                onPress={() => setPickedMedia(null)}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.mediaChipRemove,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="close" size={12} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {blockedCounterpart ? (
          <View style={styles.blockedComposer}>
            <Text style={styles.blockedComposerText}>
              You blocked this account. Unblock to send messages.
            </Text>
            <Button
              label="Unblock"
              variant="outline"
              loading={unblock.isPending}
              onPress={() => unblock.mutate()}
            />
          </View>
        ) : (
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
                {!editing ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Attach a photo or video"
                    onPress={() => void pickDmMedia()}
                    style={({ pressed }) => [
                      styles.attachButton,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons
                      name="image-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </Pressable>
                ) : null}
                <TextInput
                  style={styles.composerInput}
                  placeholder={editing ? "Edit message" : "Message"}
                  placeholderTextColor={colors.textFaint}
                  value={draft}
                  onChangeText={(text) => {
                    setDraft(text);
                    if (!editing) notifyTyping(text.trim().length > 0);
                  }}
                  multiline
                  accessibilityLabel="Message text"
                />
                {editing ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Save edit"
                    onPress={handleSaveEdit}
                    disabled={!hasText || editMutation.isPending}
                    style={({ pressed }) => [
                      styles.sendButton,
                      !hasText && { opacity: 0.4 },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.primaryForeground}
                    />
                  </Pressable>
                ) : hasText || pickedMedia ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                    onPress={handleSend}
                    style={({ pressed }) => [
                      styles.sendButton,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name="arrow-up" size={20} color={colors.primaryForeground} />
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
        )}
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
        actions={barActions}
        onClose={() => setPicker(null)}
      />

      {reportTarget ? (
        <ReportSheet
          visible
          onClose={() => setReportTarget(null)}
          entityType="message"
          entityId={reportTarget.id}
          reportedUserId={reportTarget.sender_id}
        />
      ) : null}

      <ForwardSheet
        visible={forwardTarget !== null}
        message={forwardTarget}
        onClose={() => setForwardTarget(null)}
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
  headerText: {
    flexShrink: 1,
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(4),
    marginLeft: "auto",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    marginHorizontal: spacing(3),
    marginTop: spacing(2),
    paddingHorizontal: spacing(3),
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 13.5,
    paddingVertical: spacing(2),
  },
  searchCancel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  body: {
    flex: 1,
  },
  listArea: {
    flex: 1,
  },
  // Right-edge rail behind the sliding bubbles, revealed by the drag.
  dragTimestamp: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  dragTimestampText: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "600",
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
  editedTag: {
    color: colors.mutedForeground,
    fontSize: 11.5,
  },
  editedTagMine: {
    color: "rgba(23, 17, 31, 0.6)",
  },
  searchHit: {
    backgroundColor: "rgba(255, 178, 36, 0.35)",
  },
  mediaWrap: {
    marginBottom: spacing(1.5),
  },
  linkPreviewWrap: {
    marginTop: spacing(1.5),
    minWidth: 220,
  },
  quote: {
    borderLeftWidth: 2,
    borderRadius: radii.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    marginBottom: spacing(1),
  },
  quoteMine: {
    borderLeftColor: "rgba(23, 17, 31, 0.4)",
    backgroundColor: "rgba(23, 17, 31, 0.12)",
  },
  quoteTheirs: {
    borderLeftColor: colors.primary,
    backgroundColor: colors.surface,
  },
  quoteName: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  quoteNameMine: {
    color: colors.primaryForeground,
  },
  quoteSnippet: {
    color: colors.mutedForeground,
    fontSize: 11,
  },
  quoteSnippetMine: {
    color: "rgba(23, 17, 31, 0.7)",
  },
  // The voice bubble owns its padding; give an attached quote its own inset.
  voiceQuoteInset: {
    paddingHorizontal: spacing(2),
    paddingTop: spacing(2),
  },
  seenText: {
    alignSelf: "flex-end",
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 2,
    marginRight: spacing(1),
  },
  typingRow: {
    color: colors.mutedForeground,
    fontSize: 12,
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(1),
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    marginHorizontal: spacing(3),
    marginBottom: spacing(1),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  replyBarBody: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: spacing(2),
  },
  replyBarName: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  replyBarSnippet: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 1,
  },
  // The voice bubble owns its own padding and radius; the wrapper only
  // supplies the run-aware silhouette in the matching bubble color so the
  // squared corner reads through.
  voiceWrap: {
    maxWidth: "75%",
    borderRadius: BUBBLE_RADIUS,
  },
  blockedComposer: {
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  blockedComposerText: {
    color: colors.mutedForeground,
    fontSize: 13,
    textAlign: "center",
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
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaChipRow: {
    flexDirection: "row",
    marginHorizontal: spacing(3),
    marginBottom: spacing(1),
  },
  mediaChip: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "visible",
  },
  mediaChipImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.sm,
  },
  mediaChipVideo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaChipRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
