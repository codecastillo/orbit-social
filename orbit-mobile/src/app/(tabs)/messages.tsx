import { useState } from "react";
import {
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
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  getConversations,
  type ConversationWithPreview,
} from "@/lib/queries/messages";
import { formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const SKELETON_ROWS = 8;

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
        size={56}
      />
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
      </View>
      <View style={styles.rowRight}>
        {conversation.last_message ? (
          <Text style={styles.rowTime}>
            {formatTimeAgo(conversation.last_message.created_at)}
          </Text>
        ) : null}
        {conversation.unread ? <View style={styles.unreadDot} /> : null}
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
  const [search, setSearch] = useState("");

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

  const trimmed = search.trim().toLowerCase();
  const visible = trimmed
    ? (conversations ?? []).filter((c) =>
        conversationName(c).toLowerCase().includes(trimmed),
      )
    : (conversations ?? []);

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
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
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
          trimmed ? (
            <EmptyState
              title="No matches"
              description={`No conversation named "${search.trim()}".`}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
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
