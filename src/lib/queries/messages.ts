import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface ConversationWithPreview {
  id: string;
  is_group: boolean;
  is_encrypted: boolean;
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  last_message_at: string;
  created_at: string;
  last_message?: {
    content: string | null;
    sender_id: string;
    is_deleted: boolean;
    created_at: string;
  } | null;
  other_member?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  last_read_at?: string | null;
  unread: boolean;
  is_pinned: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  reply_to_id: string | null;
  is_deleted: boolean;
  is_pinned: boolean;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export async function getConversations(
  userId: string
): Promise<ConversationWithPreview[]> {
  // Get all conversations the user is a member of
  const { data: memberships, error: memberError } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at, is_muted, is_pinned")
    .eq("user_id", userId);

  if (memberError) throw memberError;
  if (!memberships || memberships.length === 0) return [];

  const conversationIds = memberships.map((m) => m.conversation_id);

  // Get conversation details
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .in("id", conversationIds)
    .order("last_message_at", { ascending: false });

  if (convError) throw convError;
  if (!conversations) return [];

  // Get last message for each conversation
  const results: ConversationWithPreview[] = [];

  for (const conv of conversations) {
    const membership = memberships.find(
      (m) => m.conversation_id === conv.id
    );

    // Get last message
    const { data: lastMessages } = await supabase
      .from("messages")
      .select("content, sender_id, is_deleted, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastMessage = lastMessages?.[0] || null;

    // Get other member info for DMs
    let otherMember = null;
    if (!conv.is_group) {
      const { data: otherMembers } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conv.id)
        .neq("user_id", userId)
        .limit(1);

      if (otherMembers?.[0]) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", otherMembers[0].user_id)
          .single();

        otherMember = profile;
      }
    }

    const unread = lastMessage
      ? !membership?.last_read_at ||
        new Date(lastMessage.created_at) > new Date(membership.last_read_at)
      : false;

    results.push({
      ...conv,
      last_message: lastMessage,
      other_member: otherMember,
      last_read_at: membership?.last_read_at || null,
      unread,
      is_pinned: membership?.is_pinned ?? false,
    });
  }

  return results;
}

export async function getOrCreateDMConversation(
  _userId: string,
  otherUserId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("start_dm_conversation", {
    p_other_id: otherUserId,
  });
  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("start_dm_conversation returned no conversation id");
  }
  return data;
}

export async function getMessages(
  conversationId: string,
  cursor?: string,
  limit = 30
): Promise<Message[]> {
  let query = supabase
    .from("messages")
    .select(
      `
      *,
      sender:profiles!messages_sender_id_fkey (
        id, username, display_name, avatar_url
      )
    `
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as Message[]) || [];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: "image" | "video" | "gif"
) {
  // Determine media type - audio files are stored as 'video' type
  // since the enum only supports image/video/gif
  let resolvedMediaType: "image" | "video" | "gif" | null = mediaType || null;
  if (mediaUrl && !resolvedMediaType) {
    const lower = mediaUrl.toLowerCase();
    if (
      lower.endsWith(".webm") ||
      lower.endsWith(".mp3") ||
      lower.endsWith(".ogg") ||
      lower.endsWith(".m4a") ||
      lower.endsWith(".wav")
    ) {
      resolvedMediaType = "video"; // Store audio as 'video' type since enum is limited
    } else {
      resolvedMediaType = "image";
    }
  }

  const { data: message, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      media_url: mediaUrl || null,
      media_type: resolvedMediaType,
    })
    .select(
      `
      *,
      sender:profiles!messages_sender_id_fkey (
        id, username, display_name, avatar_url
      )
    `
    )
    .single();

  if (msgError) throw msgError;

  // Update conversation's last_message_at
  const { error: convError } = await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (convError) throw convError;

  return message as Message;
}

export async function markConversationRead(
  conversationId: string,
  userId: string
) {
  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deleteMessage(messageId: string) {
  const { error } = await supabase
    .from("messages")
    .update({ is_deleted: true })
    .eq("id", messageId);

  if (error) throw error;
}

// Message reactions

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export async function addMessageReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  const { error } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, user_id: userId, emoji });

  if (error) throw error;
}

export async function removeMessageReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  const { error } = await supabase
    .from("message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji);

  if (error) throw error;
}

export async function getMessageReactions(
  messageId: string
): Promise<{ emoji: string; count: number; userIds: string[] }[]> {
  const { data, error } = await supabase
    .from("message_reactions")
    .select("emoji, user_id")
    .eq("message_id", messageId);

  if (error) throw error;

  const grouped = new Map<string, string[]>();
  for (const row of data || []) {
    if (!grouped.has(row.emoji)) {
      grouped.set(row.emoji, []);
    }
    grouped.get(row.emoji)!.push(row.user_id);
  }

  return Array.from(grouped.entries()).map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    userIds,
  }));
}

export async function getMessagesReactions(
  messageIds: string[]
): Promise<Map<string, { emoji: string; count: number; userIds: string[] }[]>> {
  if (messageIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("message_reactions")
    .select("message_id, emoji, user_id")
    .in("message_id", messageIds);

  if (error) throw error;

  const byMessage = new Map<string, Map<string, string[]>>();
  for (const row of data || []) {
    if (!byMessage.has(row.message_id)) {
      byMessage.set(row.message_id, new Map());
    }
    const emojiMap = byMessage.get(row.message_id)!;
    if (!emojiMap.has(row.emoji)) {
      emojiMap.set(row.emoji, []);
    }
    emojiMap.get(row.emoji)!.push(row.user_id);
  }

  const result = new Map<string, { emoji: string; count: number; userIds: string[] }[]>();
  for (const [msgId, emojiMap] of byMessage) {
    result.set(
      msgId,
      Array.from(emojiMap.entries()).map(([emoji, userIds]) => ({
        emoji,
        count: userIds.length,
        userIds,
      }))
    );
  }

  return result;
}

// ── Group Chat Functions ────────────────────────────────────────────

export async function createGroupConversation(
  creatorId: string,
  name: string,
  memberIds: string[]
): Promise<string> {
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .insert({
      is_group: true,
      name,
      created_by: creatorId,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (convError) throw convError;

  const allMembers = [
    { conversation_id: conv.id, user_id: creatorId, role: "admin" },
    ...memberIds.map((id) => ({
      conversation_id: conv.id,
      user_id: id,
      role: "member" as const,
    })),
  ];

  const { error: memberError } = await supabase
    .from("conversation_members")
    .insert(allMembers);

  if (memberError) throw memberError;

  return conv.id;
}

export async function addGroupMember(
  conversationId: string,
  userId: string
) {
  const { error } = await supabase
    .from("conversation_members")
    .insert({ conversation_id: conversationId, user_id: userId, role: "member" });

  if (error) throw error;
}

export async function removeGroupMember(
  conversationId: string,
  userId: string
) {
  const { error } = await supabase
    .from("conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function updateGroupName(
  conversationId: string,
  name: string
) {
  const { error } = await supabase
    .from("conversations")
    .update({ name })
    .eq("id", conversationId);

  if (error) throw error;
}

export async function getGroupMembers(conversationId: string) {
  const { data, error } = await supabase
    .from("conversation_members")
    .select(
      `
      user_id,
      role,
      joined_at,
      profiles:profiles!conversation_members_user_id_fkey (
        id, username, display_name, avatar_url
      )
    `
    )
    .eq("conversation_id", conversationId);

  if (error) throw error;
  return data ?? [];
}

// ── Message Pinning ─────────────────────────────────────────────────

export async function pinMessage(messageId: string) {
  const { error } = await supabase
    .from("messages")
    .update({ is_pinned: true })
    .eq("id", messageId);

  if (error) throw error;
}

export async function unpinMessage(messageId: string) {
  const { error } = await supabase
    .from("messages")
    .update({ is_pinned: false })
    .eq("id", messageId);

  if (error) throw error;
}

export async function getPinnedMessages(
  conversationId: string
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      *,
      sender:profiles!messages_sender_id_fkey (
        id, username, display_name, avatar_url
      )
    `
    )
    .eq("conversation_id", conversationId)
    .eq("is_pinned", true)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as Message[]) || [];
}
