import { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, EmptyState } from "@/components/ui";
import { ActivityDot } from "@/components/activity-status";
import { usePresenceMap } from "@/lib/hooks/use-presence";
import {
  closeConversation,
  getConversations,
  markConversationRead,
  type ConversationWithPreview,
} from "@/lib/queries/messages";
import type { Presence } from "@/lib/queries/presence";
import { formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const SKELETON_ROWS = 8;

type Tab = "inbox" | "requests";

interface RequestActions {
  onAccept: (conversation: ConversationWithPreview) => void;
  onDecline: (conversation: ConversationWithPreview) => void;
  pendingId: string | null;
}

function conversationName(conversation: ConversationWithPreview): string {
  if (conversation.is_group) return conversation.name ?? "Group chat";
  return (
    conversation.other_member?.display_name ||
    conversation.other_member?.username ||
    "Conversation"
  );
}

function previewText(
  conversation: ConversationWithPreview,
  userId: string,
): string {
  const last = conversation.last_message;
  if (!last) return "No messages yet";
  if (last.is_deleted) return "Message deleted";
  const prefix = last.sender_id === userId ? "You: " : "";
  // Voice clips store their URL as "[audio] url" content (matching the web
  // client); the raw URL makes a useless preview.
  if (last.content?.startsWith("[audio]")) return `${prefix}Voice message`;
  return `${prefix}${last.content ?? "Sent an attachment"}`;
}

function ConversationRow({
  conversation,
  userId,
  presence,
  requestActions,
}: {
  conversation: ConversationWithPreview;
  userId: string;
  presence: Presence | null;
  requestActions?: RequestActions;
}) {
  const router = useRouter();
  const name = conversationName(conversation);
  const busy = requestActions?.pendingId === conversation.id;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${name}`}
      onPress={() => router.push(`/conversation/${conversation.id}`)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <View>
        <Avatar
          url={
            conversation.is_group
              ? conversation.avatar_url
              : conversation.other_member?.avatar_url
          }
          name={name}
          size={56}
        />
        {conversation.is_group ? null : <ActivityDot presence={presence} />}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <Text
          style={[styles.rowPreview, conversation.unread && styles.rowPreviewUnread]}
          numberOfLines={1}
        >
          {previewText(conversation, userId)}
        </Text>
        {requestActions ? (
          <View style={styles.requestActions}>
            <Button
              label="Accept"
              disabled={busy}
              onPress={() => requestActions.onAccept(conversation)}
              style={styles.requestButton}
            />
            <Button
              label="Decline"
              variant="outline"
              disabled={busy}
              onPress={() => requestActions.onDecline(conversation)}
              style={styles.requestButton}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        {conversation.last_message ? (
          <Text style={styles.rowTime}>
            {formatTimeAgo(conversation.last_message.created_at)}
          </Text>
        ) : null}
        {conversation.unread && !requestActions ? (
          <View style={styles.unreadDot} />
        ) : null}
      </View>
    </Pressable>
  );
}

function ConversationSkeleton() {
  return (
    <View>
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.rowBody}>
            <View style={[styles.skeletonBar, { width: "45%" }]} />
            <View style={[styles.skeletonBar, styles.skeletonBarThin]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("inbox");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const {
    data: conversations,
    isPending,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => getConversations(user!.id),
    enabled: !!user,
  });

  const trimmed = search.trim().toLowerCase();
  const matching = trimmed
    ? (conversations ?? []).filter((c) =>
        conversationName(c).toLowerCase().includes(trimmed),
      )
    : (conversations ?? []);

  const inbox = matching.filter((c) => !c.is_request);
  const requests = matching.filter((c) => c.is_request);
  // The tab bar only exists while there are requests, so never strand the
  // viewer on an empty Requests tab after they clear the last one.
  const activeTab: Tab = requests.length > 0 ? tab : "inbox";
  const visible = activeTab === "requests" ? requests : inbox;

  const presenceFor = usePresenceMap(
    visible
      .filter((c) => !c.is_group && c.other_member)
      .map((c) => c.other_member!.id),
  );

  const conversationsKey = ["conversations", user?.id];

  const patchConversations = (
    apply: (list: ConversationWithPreview[]) => ConversationWithPreview[],
  ) =>
    queryClient.setQueryData<ConversationWithPreview[]>(
      conversationsKey,
      (list) => (list ? apply(list) : list),
    );

  const refreshBadges = () => {
    queryClient.invalidateQueries({ queryKey: conversationsKey });
    queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
  };

  // Accepting is a read: request-ness is derived partly from "never read", so
  // marking it read is what moves the thread into the inbox. Opening it does
  // the same thing, which is why there is no separate accept write.
  const acceptRequest = async (conversation: ConversationWithPreview) => {
    if (!user || pendingRequestId) return;
    setPendingRequestId(conversation.id);
    patchConversations((list) =>
      list.map((c) =>
        c.id === conversation.id
          ? { ...c, is_request: false, unread: false }
          : c,
      ),
    );
    try {
      await markConversationRead(conversation.id, user.id);
      refreshBadges();
    } catch {
      patchConversations((list) =>
        list.map((c) => (c.id === conversation.id ? conversation : c)),
      );
      Alert.alert("Couldn't accept this request");
    } finally {
      setPendingRequestId(null);
    }
  };

  // Declining reuses the close-conversation mechanism: hidden_at hides the
  // thread until something newer arrives, so nothing is deleted and a new
  // message from them comes back as a fresh request.
  const declineRequest = async (conversation: ConversationWithPreview) => {
    if (!user || pendingRequestId) return;
    setPendingRequestId(conversation.id);
    patchConversations((list) =>
      list.filter((c) => c.id !== conversation.id),
    );
    try {
      await closeConversation(conversation.id, user.id);
      refreshBadges();
    } catch {
      patchConversations((list) => [conversation, ...list]);
      Alert.alert("Couldn't decline this request");
    } finally {
      setPendingRequestId(null);
    }
  };

  const requestActions: RequestActions = {
    onAccept: acceptRequest,
    onDecline: declineRequest,
    pendingId: pendingRequestId,
  };

  if (!user) return null;

  const searchField = (
    <View style={styles.searchWrap}>
      <View style={styles.searchPill}>
        <Ionicons name="search" size={15} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
          accessibilityLabel="Search conversations"
        />
        {search.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setSearch("")}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close-circle" size={15} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New group"
        onPress={() => router.push("/new-group" as Href)}
        hitSlop={8}
        style={({ pressed }) => [pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="people-outline" size={22} color={colors.foreground} />
      </Pressable>
    </View>
  );

  const tabBar =
    requests.length > 0 ? (
      <View style={styles.tabs}>
        {(
          [
            ["inbox", "Inbox"],
            ["requests", `Requests · ${requests.length}`],
          ] as const
        ).map(([key, label]) => {
          const active = activeTab === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ) : null;

  if (isPending) {
    return (
      <View style={styles.list}>
        {searchField}
        <ConversationSkeleton />
      </View>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Messages did not load"
        description="Check your connection and try again."
        action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
      />
    );
  }

  return (
    <View style={styles.list}>
      {searchField}
      {tabBar}
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            userId={user.id}
            presence={presenceFor(item.other_member?.id)}
            requestActions={
              activeTab === "requests" ? requestActions : undefined
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.mutedForeground}
          />
        }
        ListEmptyComponent={
          trimmed ? (
            <EmptyState
              title="No matches"
              description={`No conversation named "${search.trim()}".`}
            />
          ) : activeTab === "requests" ? (
            <EmptyState
              title="No message requests"
              description="Messages from people you don't follow land here first."
            />
          ) : (
            <EmptyState
              title="No conversations yet"
              description="Start a chat from someone's profile on the web app and it will appear here."
            />
          )
        }
        contentContainerStyle={visible.length === 0 ? { flex: 1 } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2.5),
    paddingBottom: spacing(2),
  },
  searchPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    minHeight: 38,
    paddingHorizontal: spacing(3),
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    paddingVertical: spacing(2),
  },
  tabs: {
    flexDirection: "row",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(2),
  },
  tab: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: colors.foreground,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  requestActions: {
    flexDirection: "row",
    gap: spacing(2),
    marginTop: spacing(2),
  },
  requestButton: {
    minHeight: 32,
    paddingHorizontal: spacing(3.5),
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  rowPreview: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 2,
  },
  rowPreviewUnread: {
    color: colors.foreground,
    fontWeight: "600",
  },
  rowRight: {
    alignItems: "flex-end",
    gap: spacing(1.5),
  },
  rowTime: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing(4) + 56 + spacing(3),
  },
  skeletonAvatar: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonBarThin: {
    width: "70%",
    height: 10,
    marginTop: 8,
  },
});
