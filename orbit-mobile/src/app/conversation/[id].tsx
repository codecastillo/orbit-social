import { useCallback, useEffect, useState } from "react";
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
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { VoiceBubble } from "@/components/voice-bubble";
import {
  VOICE_MIN_MS,
  VoiceRecordingBar,
} from "@/components/voice-recording-bar";
import { prefetchVoice } from "@/lib/audio-cache";
import { safeBack } from "@/lib/nav";
import {
  MESSAGE_PAGE_SIZE,
  getConversations,
  getMessages,
  markConversationRead,
  sendMessage,
  sendVoiceMessage,
  voiceMessageUrl,
  type Message,
} from "@/lib/queries/messages";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const voiceUrl = message.is_deleted ? null : voiceMessageUrl(message);
  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : null]}>
      {voiceUrl ? (
        <VoiceBubble url={voiceUrl} isMine={isMine} />
      ) : (
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {message.is_deleted ? (
            <Text style={[styles.bubbleText, styles.deletedText]}>
              Message deleted
            </Text>
          ) : (
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
              {message.content}
            </Text>
          )}
        </View>
      )}
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
  // up whenever the app returns to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

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
          <Centered>
            <ActivityIndicator color={colors.primary} />
          </Centered>
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
            renderItem={({ item }) => (
              <MessageBubble message={item} isMine={item.sender_id === user.id} />
            )}
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
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  body: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    gap: spacing(1.5),
  },
  bubbleRow: {
    flexDirection: "row",
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: radii.lg,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
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
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.foreground,
    paddingHorizontal: spacing(3.5),
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
});
