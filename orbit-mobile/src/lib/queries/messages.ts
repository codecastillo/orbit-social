import { supabase } from "@/lib/supabase";

export interface ConversationWithPreview {
  id: string;
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  last_message_at: string;
  created_at: string;
  last_message: {
    content: string | null;
    sender_id: string;
    is_deleted: boolean;
    created_at: string;
  } | null;
  other_member: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  last_read_at: string | null;
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

export const MESSAGE_PAGE_SIZE = 30;

const MESSAGE_SELECT = `
  *,
  sender:profiles!messages_sender_id_fkey (
    id, username, display_name, avatar_url
  )
`;

export async function getConversations(
  userId: string,
): Promise<ConversationWithPreview[]> {
  const { data: memberships, error: memberError } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);

  if (memberError) throw memberError;
  if (!memberships || memberships.length === 0) return [];

  const conversationIds = memberships.map((m) => m.conversation_id);
  const membershipByConv = new Map(
    memberships.map((m) => [m.conversation_id, m]),
  );

  // One query for conversations with their latest message embedded; the
  // per-referenced-table limit applies per parent row, so this replaces a
  // per-conversation round trip.
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select(
      "*, last_messages:messages(content, sender_id, is_deleted, created_at)",
    )
    .in("id", conversationIds)
    .order("last_message_at", { ascending: false })
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });

  if (convError) throw convError;
  if (!conversations) return [];

  // Batch the DM counterpart lookups: all other members in one query,
  // their profiles in a second.
  const dmIds = conversations.filter((c) => !c.is_group).map((c) => c.id);
  const otherMemberByConv = new Map<string, string>();
  const profileById = new Map<
    string,
    NonNullable<ConversationWithPreview["other_member"]>
  >();

  if (dmIds.length > 0) {
    const { data: otherMembers } = await supabase
      .from("conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", dmIds)
      .neq("user_id", userId);

    for (const m of otherMembers ?? []) {
      if (!otherMemberByConv.has(m.conversation_id)) {
        otherMemberByConv.set(m.conversation_id, m.user_id);
      }
    }

    const otherIds = Array.from(new Set(otherMemberByConv.values()));
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", otherIds);
      for (const p of profiles ?? []) profileById.set(p.id, p);
    }
  }

  return conversations.map((conv) => {
    const { last_messages, ...rest } = conv;
    const membership = membershipByConv.get(conv.id);
    const lastMessage = last_messages?.[0] ?? null;
    const otherId = otherMemberByConv.get(conv.id);

    const unread = lastMessage
      ? !membership?.last_read_at ||
        new Date(lastMessage.created_at) > new Date(membership.last_read_at)
      : false;

    return {
      ...rest,
      last_message: lastMessage,
      other_member: otherId ? (profileById.get(otherId) ?? null) : null,
      last_read_at: membership?.last_read_at ?? null,
      unread,
    };
  });
}

export async function getMessages(
  conversationId: string,
  cursor?: string,
  limit = MESSAGE_PAGE_SIZE,
): Promise<Message[]> {
  let query = supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Message[];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
): Promise<Message> {
  const { data: message, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
    })
    .select(MESSAGE_SELECT)
    .single();

  if (msgError) throw msgError;

  const { error: convError } = await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (convError) throw convError;

  return message as unknown as Message;
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
) {
  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
}
