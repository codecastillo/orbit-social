import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import {
  getConversations,
  type ConversationWithPreview,
} from "@/lib/queries/messages";
import { formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

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
}: {
  conversation: ConversationWithPreview;
  userId: string;
}) {
  const router = useRouter();
  const name = conversationName(conversation);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${name}`}
      onPress={() => router.push(`/conversation/${conversation.id}`)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <Avatar
        url={
          conversation.is_group
            ? conversation.avatar_url
            : conversation.other_member?.avatar_url
        }
        name={name}
        size={48}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.rowName, conversation.unread && styles.rowNameUnread]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {conversation.last_message ? (
            <Text style={styles.rowTime}>
              {formatTimeAgo(conversation.last_message.created_at)}
            </Text>
          ) : null}
        </View>
        <Text
          style={[styles.rowPreview, conversation.unread && styles.rowPreviewUnread]}
          numberOfLines={1}
        >
          {previewText(conversation, userId)}
        </Text>
      </View>
      {conversation.unread ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

export default function MessagesScreen() {
  const { user } = useAuth();

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

  if (!user) return null;

  if (isPending) {
    return (
      <Centered>
        <ActivityIndicator color={colors.primary} />
      </Centered>
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
    <FlatList
      style={styles.list}
      data={conversations}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => (
        <ConversationRow conversation={item} userId={user.id} />
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
        <EmptyState
          title="No conversations yet"
          description="Start a chat from someone's profile on the web app and it will appear here."
        />
      }
      contentContainerStyle={conversations.length === 0 ? { flex: 1 } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  rowBody: {
    flex: 1,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(2),
  },
  rowName: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "500",
    flexShrink: 1,
  },
  rowNameUnread: {
    fontWeight: "700",
  },
  rowTime: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  rowPreview: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 2,
  },
  rowPreviewUnread: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing(4),
  },
});
