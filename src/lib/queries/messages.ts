import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface ConversationWithPreview {
  id: string;
  is_group: boolean;
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
    .select("conversation_id, last_read_at, is_muted")
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
    });
  }

  return results;
}

export async function getOrCreateDMConversation(
  userId: string,
  otherUserId: string
): Promise<string> {
  // Find existing 1:1 conversation between these two users
  const { data: userConvs } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  const { data: otherConvs } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", otherUserId);

  if (userConvs && otherConvs) {
    const userConvIds = new Set(userConvs.map((c) => c.conversation_id));
    const commonConvIds = otherConvs
      .map((c) => c.conversation_id)
      .filter((id) => userConvIds.has(id));

    if (commonConvIds.length > 0) {
      // Check if any of these are 1:1 (not group)
      const { data: dmConvs } = await supabase
        .from("conversations")
        .select("id")
        .in("id", commonConvIds)
        .eq("is_group", false)
        .limit(1);

      if (dmConvs?.[0]) {
        return dmConvs[0].id;
      }
    }
  }

  // Create new conversation
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .insert({
      is_group: false,
      created_by: userId,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (convError) throw convError;

  // Add both members
  const { error: memberError } = await supabase
    .from("conversation_members")
    .insert([
      { conversation_id: conv.id, user_id: userId, role: "member" },
      { conversation_id: conv.id, user_id: otherUserId, role: "member" },
    ]);

  if (memberError) throw memberError;

  return conv.id;
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
