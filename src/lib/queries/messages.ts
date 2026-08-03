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
  /** Set on edit; absent until the updated_at column ships (see editMessage). */
  updated_at?: string | null;
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
  const membershipByConv = new Map(
    memberships.map((m) => [m.conversation_id, m]),
  );

  // One query for conversations with their latest message embedded (the
  // per-referenced-table limit applies per parent row), replacing the old
  // serial per-conversation loop that cost up to 3 round trips each.
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

  // Batch the DM counterpart lookups: all other members in one query, their
  // profiles in a second.
  const dmIds = conversations.filter((c) => !c.is_group).map((c) => c.id);
  const otherMemberByConv = new Map<string, string>();
  const profileById = new Map<
    string,
    { id: string; username: string; display_name: string; avatar_url: string | null }
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
    const otherMember = otherId ? (profileById.get(otherId) ?? null) : null;

    const unread = lastMessage
      ? !membership?.last_read_at ||
        new Date(lastMessage.created_at) > new Date(membership.last_read_at)
      : false;

    return {
      ...rest,
      last_message: lastMessage,
      other_member: otherMember,
      last_read_at: membership?.last_read_at || null,
      unread,
      is_pinned: membership?.is_pinned ?? false,
    };
  });
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

export async function getMessageById(
  messageId: string
): Promise<Message | null> {
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
    .eq("id", messageId)
    .maybeSingle();

  if (error) throw error;
  return (data as Message) ?? null;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: "image" | "video" | "gif",
  replyToId?: string
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
      reply_to_id: replyToId || null,
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

// ── Read receipts ───────────────────────────────────────────────────

// The read_receipts_enabled column ships in a later migration; until it
// lands, every profile read degrades to "enabled" and writes are no-ops.
const MISSING_COLUMN_CODE = "42703";

function isMissingReadReceiptsColumn(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === MISSING_COLUMN_CODE ||
    (error.message ?? "").includes("read_receipts_enabled")
  );
}

/**
 * Whether the user shares (and therefore also sees) DM read receipts.
 * Reciprocal by design: this single flag gates both directions.
 */
export async function getReadReceiptsEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("read_receipts_enabled")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return true;
  return data.read_receipts_enabled ?? true;
}

export async function setReadReceiptsEnabled(
  userId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ read_receipts_enabled: enabled })
    .eq("id", userId);

  if (error && !isMissingReadReceiptsColumn(error)) throw error;
}

/**
 * The other member's last_read_at for a 1:1 conversation, already gated by
 * the reciprocity rule: null when the conversation is a group, when either
 * side has read receipts off, when the viewer has restricted the
 * counterpart, or when there is no single counterpart.
 */
export async function getDmSeenAt(
  conversationId: string,
  viewerId: string
): Promise<string | null> {
  if (!(await getReadReceiptsEnabled(viewerId))) return null;

  const { data: conv } = await supabase
    .from("conversations")
    .select("is_group")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || conv.is_group) return null;

  const { data: others, error } = await supabase
    .from("conversation_members")
    .select("user_id, last_read_at")
    .eq("conversation_id", conversationId)
    .neq("user_id", viewerId);

  if (error || !others || others.length !== 1) return null;
  const other = others[0];
  if (!other.last_read_at) return null;
  if (!(await getReadReceiptsEnabled(other.user_id))) return null;

  // Restrict is viewer-side only (RLS keeps the list private), so seen
  // state from a restricted counterpart is suppressed at display time.
  const { data: restriction } = await supabase
    .from("restricted_users")
    .select("restricted_id")
    .eq("user_id", viewerId)
    .eq("restricted_id", other.user_id)
    .maybeSingle();
  if (restriction) return null;

  return other.last_read_at;
}

/**
 * Sender-only content edit. Tries to stamp updated_at so bubbles can show
 * the "(edited)" marker; the column ships in a later migration, so until it
 * lands the edit degrades to content-only (same pattern as read receipts).
 */
export async function editMessage(messageId: string, content: string) {
  const { error } = await supabase
    .from("messages")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", messageId);

  if (!error) return;
  const missingColumn =
    error.code === MISSING_COLUMN_CODE ||
    (error.message ?? "").includes("updated_at");
  if (!missingColumn) throw error;

  const { error: retryError } = await supabase
    .from("messages")
    .update({ content })
    .eq("id", messageId);
  if (retryError) throw retryError;
}

/**
 * Media messages for the conversation gallery, newest first. Voice notes
 * also live in media_url, so callers filter those out at display time.
 */
export async function getConversationMedia(
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
    .not("media_url", "is", null)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Message[]) || [];
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

// ── Group Membership: roles, mute, leave, avatar ────────────────────

export interface ConversationMembership {
  role: "member" | "admin";
  is_muted: boolean;
}

export async function getConversationMembership(
  conversationId: string,
  userId: string
): Promise<ConversationMembership | null> {
  const { data, error } = await supabase
    .from("conversation_members")
    .select("role, is_muted")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    role: data.role === "admin" ? "admin" : "member",
    is_muted: data.is_muted ?? false,
  };
}

export async function setConversationMuted(
  conversationId: string,
  userId: string,
  muted: boolean
) {
  const { error } = await supabase
    .from("conversation_members")
    .update({ is_muted: muted })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
}

/** Delete the caller's own membership row. RLS allows deleting your own row. */
export async function leaveConversation(
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

/**
 * Promote or demote a member. RLS only lets a user UPDATE their own
 * membership row, while admins may DELETE and INSERT rows, so a role change
 * is a re-insert of the member with the new role, carrying over their read,
 * mute, pin, and join state. On insert failure the original row is restored
 * so the member is never dropped.
 */
export async function setGroupMemberRole(
  conversationId: string,
  userId: string,
  role: "member" | "admin"
) {
  const { data: existing, error: readError } = await supabase
    .from("conversation_members")
    .select("role, last_read_at, is_muted, is_pinned, joined_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .single();

  if (readError) throw readError;
  if (existing.role === role) return;

  const { error: deleteError } = await supabase
    .from("conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from("conversation_members")
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      ...existing,
      role,
    });

  if (insertError) {
    await supabase
      .from("conversation_members")
      .insert({ conversation_id: conversationId, user_id: userId, ...existing });
    throw insertError;
  }
}

const GROUP_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const GROUP_AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload a group avatar and point the conversation at it. Uses the avatars
 * bucket with the uploader's id as the first path segment, matching the
 * storage RLS that gates writes by uid folder (same shape as community
 * avatars).
 */
export async function uploadGroupAvatar(
  userId: string,
  conversationId: string,
  file: File
): Promise<string> {
  if (!GROUP_AVATAR_TYPES.includes(file.type)) {
    throw new Error("File must be JPEG, PNG, WebP, or GIF");
  }
  if (file.size > GROUP_AVATAR_MAX_BYTES) {
    throw new Error("Image must be under 5MB");
  }
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/groups/${conversationId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;

  const { error: convError } = await supabase
    .from("conversations")
    .update({ avatar_url: url })
    .eq("id", conversationId);
  if (convError) throw convError;

  return url;
}
