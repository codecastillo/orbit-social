import AsyncStorage from "@react-native-async-storage/async-storage";
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

export type MessageMediaType = "image" | "video" | "gif";

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
  // Ships in a later migration; absent rows simply never show "(edited)".
  updated_at?: string | null;
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
  // hidden_at ships in a later migration (see closeConversation); until it
  // lands, the select degrades and close timestamps come from AsyncStorage.
  const hiddenByConv = new Map<string, string>();
  let memberships: { conversation_id: string; last_read_at: string | null }[];

  const withHidden = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at, hidden_at")
    .eq("user_id", userId);

  if (!withHidden.error) {
    memberships = withHidden.data ?? [];
    for (const m of withHidden.data ?? []) {
      if (m.hidden_at) hiddenByConv.set(m.conversation_id, m.hidden_at);
    }
  } else if (isMissingHiddenAtColumn(withHidden.error)) {
    const { data, error: memberError } = await supabase
      .from("conversation_members")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId);
    if (memberError) throw memberError;
    memberships = data ?? [];
    if (memberships.length > 0) {
      const entries = await AsyncStorage.multiGet(
        memberships.map((m) => hiddenConversationKey(userId, m.conversation_id)),
      );
      // multiGet returns values in request order, so index i maps back to
      // memberships[i].
      entries.forEach(([, hiddenAt], i) => {
        if (hiddenAt) hiddenByConv.set(memberships[i].conversation_id, hiddenAt);
      });
    }
  } else {
    throw withHidden.error;
  }

  if (memberships.length === 0) return [];

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

  // A closed conversation stays hidden until something newer than the close
  // arrives: last_message_at moving past hidden_at resurfaces it.
  const visible = conversations.filter((conv) => {
    const hiddenAt = hiddenByConv.get(conv.id);
    return (
      !hiddenAt ||
      new Date(conv.last_message_at).getTime() > new Date(hiddenAt).getTime()
    );
  });

  // Batch the DM counterpart lookups: all other members in one query,
  // their profiles in a second.
  const dmIds = visible.filter((c) => !c.is_group).map((c) => c.id);
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

  return visible.map((conv) => {
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

export async function getMessageById(
  messageId: string,
): Promise<Message | null> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("id", messageId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as Message) ?? null;
}

// The extensions the web client recognizes as audio in message-bubble.tsx.
const AUDIO_EXTENSIONS = [".webm", ".mp3", ".ogg", ".m4a", ".wav"];

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: MessageMediaType,
  replyToId?: string,
): Promise<Message> {
  // Same fallback as the web sendMessage: audio extensions store as "video"
  // because the media_type enum only knows image/video/gif.
  let resolvedMediaType: MessageMediaType | null = mediaType ?? null;
  if (mediaUrl && !resolvedMediaType) {
    const lower = mediaUrl.toLowerCase();
    resolvedMediaType = AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))
      ? "video"
      : "image";
  }

  const { data: message, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      media_url: mediaUrl ?? null,
      media_type: resolvedMediaType,
      reply_to_id: replyToId ?? null,
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

/**
 * The playable URL when a message is a voice clip, else null. Mirrors the web
 * client's getAudioSrc: an audio-extension media_url, or the "[audio] url"
 * content marker the web voice recorder sends.
 */
export function voiceMessageUrl(
  message: Pick<Message, "content" | "media_url">,
): string | null {
  if (message.media_url) {
    const lower = message.media_url.toLowerCase();
    if (AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return message.media_url;
    }
  }
  if (message.content?.startsWith("[audio]")) {
    const url = message.content.slice("[audio]".length).trim();
    if (url) return url;
  }
  return null;
}

/**
 * Upload a recorded clip and post it, mirroring the web voice recorder's
 * shape exactly (message-media bucket, `${userId}/${timestamp}_voice.ext`
 * path, "[audio] url" content) so clips are interchangeable across clients.
 */
export async function sendVoiceMessage(
  conversationId: string,
  senderId: string,
  localUri: string,
): Promise<Message> {
  const path = `${senderId}/${Date.now()}_voice.m4a`;
  const body = await fetch(localUri).then((response) => response.arrayBuffer());
  // Direct storage upload works in Expo Go; release builds can drop the
  // authenticated role on storage requests and may need an edge-function
  // upload instead (mello hit this in production). Revisit before a store
  // build.
  const { error } = await supabase.storage
    .from("message-media")
    .upload(path, body, { contentType: "audio/mp4" });
  if (error) throw error;

  const { publicUrl } = supabase.storage
    .from("message-media")
    .getPublicUrl(path).data;
  return sendMessage(conversationId, senderId, `[audio] ${publicUrl}`);
}

/**
 * Upload a picked image or video into the message-media bucket, using the
 * same {userId}/{timestamp}.{ext} path convention as the voice upload above.
 * Returns the public URL to store on the message row.
 */
export async function uploadMessageMedia(
  userId: string,
  localUri: string,
  mimeType: string,
): Promise<string> {
  const ext = mimeType.split("/")[1] ?? "jpg";
  const path = `${userId}/${Date.now()}_media.${ext}`;
  const body = await fetch(localUri).then((response) => response.arrayBuffer());
  const { error } = await supabase.storage
    .from("message-media")
    .upload(path, body, { contentType: mimeType });
  if (error) throw error;

  return supabase.storage.from("message-media").getPublicUrl(path).data
    .publicUrl;
}

/** Soft delete, same as the web deleteMessage: the row stays for both sides. */
export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ is_deleted: true })
    .eq("id", messageId);

  if (error) throw error;
}

/**
 * Rewrite a message's content. updated_at ships in a later migration; until
 * it lands the edit still applies, it just cannot carry the edited marker.
 */
export async function editMessage(
  messageId: string,
  content: string,
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", messageId);

  if (!error) return;
  if (
    error.code !== MISSING_COLUMN_CODE &&
    !(error.message ?? "").includes("updated_at")
  ) {
    throw error;
  }

  const { error: retryError } = await supabase
    .from("messages")
    .update({ content })
    .eq("id", messageId);
  if (retryError) throw retryError;
}

// ── Message pinning ─────────────────────────────────────────────────

export async function pinMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ is_pinned: true })
    .eq("id", messageId);

  if (error) throw error;
}

export async function unpinMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ is_pinned: false })
    .eq("id", messageId);

  if (error) throw error;
}

export async function getPinnedMessages(
  conversationId: string,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .eq("is_pinned", true)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Message[];
}

/**
 * Page of this conversation's media messages, newest first, for the gallery.
 * Voice clips share the bucket but not the gallery; callers skip anything
 * voiceMessageUrl recognizes.
 */
export async function getMediaMessages(
  conversationId: string,
  cursor?: string,
  limit = MESSAGE_PAGE_SIZE,
): Promise<Message[]> {
  let query = supabase
    .from("messages")
    .select(MESSAGE_SELECT)
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
  return (data ?? []) as unknown as Message[];
}

// The web's MESSAGE_REACTIONS set (message-reaction-picker.tsx), copied
// verbatim so reaction rows are interchangeable across clients.
export const MESSAGE_REACTION_GLYPHS = [
  { emoji: "\u2764\uFE0F", label: "Love" },
  { emoji: "\uD83D\uDC4D", label: "Thumbs Up" },
  { emoji: "\uD83D\uDE02", label: "Laugh" },
  { emoji: "\uD83D\uDE2E", label: "Wow" },
  { emoji: "\uD83D\uDE22", label: "Sad" },
  { emoji: "\uD83D\uDD25", label: "Fire" },
] as const;

export interface MessageReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
}

export async function addMessageReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const { error } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, user_id: userId, emoji });

  if (error) throw error;
}

export async function removeMessageReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const { error } = await supabase
    .from("message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji);

  if (error) throw error;
}

// Batched mirror of the web's getMessagesReactions: one query for a page of
// messages, grouped per message and emoji.
export async function getMessagesReactions(
  messageIds: string[],
): Promise<Map<string, MessageReactionGroup[]>> {
  if (messageIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("message_reactions")
    .select("message_id, emoji, user_id")
    .in("message_id", messageIds);

  if (error) throw error;

  const byMessage = new Map<string, Map<string, string[]>>();
  for (const row of data ?? []) {
    let emojiMap = byMessage.get(row.message_id);
    if (!emojiMap) {
      emojiMap = new Map();
      byMessage.set(row.message_id, emojiMap);
    }
    const userIds = emojiMap.get(row.emoji);
    if (userIds) userIds.push(row.user_id);
    else emojiMap.set(row.emoji, [row.user_id]);
  }

  const grouped = new Map<string, MessageReactionGroup[]>();
  for (const [messageId, emojiMap] of byMessage) {
    grouped.set(
      messageId,
      Array.from(emojiMap.entries()).map(([emoji, userIds]) => ({
        emoji,
        count: userIds.length,
        userIds,
      })),
    );
  }

  return grouped;
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

// ── Closing conversations ───────────────────────────────────────────

// conversation_members.hidden_at ships in a later migration; until it
// lands, the close timestamp lives in AsyncStorage under this key and
// getConversations filters against it client-side.
function hiddenConversationKey(userId: string, conversationId: string) {
  return `conversation-hidden:${userId}:${conversationId}`;
}

function isMissingHiddenAtColumn(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === MISSING_COLUMN_CODE ||
    (error.message ?? "").includes("hidden_at")
  );
}

/**
 * Hide a conversation from the viewer's list until a new message arrives.
 * Archive semantics: the membership row stays, only the list filters it.
 */
export async function closeConversation(
  conversationId: string,
  userId: string,
): Promise<void> {
  const hiddenAt = new Date().toISOString();
  const { error } = await supabase
    .from("conversation_members")
    .update({ hidden_at: hiddenAt })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (!error) {
    // The column is authoritative once it exists; drop any shim entry so a
    // stale local timestamp can't re-hide a resurfaced conversation.
    await AsyncStorage.removeItem(
      hiddenConversationKey(userId, conversationId),
    ).catch(() => {});
    return;
  }
  if (!isMissingHiddenAtColumn(error)) throw error;
  await AsyncStorage.setItem(
    hiddenConversationKey(userId, conversationId),
    hiddenAt,
  );
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
  return (
    (data as { read_receipts_enabled?: boolean }).read_receipts_enabled ?? true
  );
}

export async function setReadReceiptsEnabled(
  userId: string,
  enabled: boolean,
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
  viewerId: string,
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

// ── Group conversations ─────────────────────────────────────────────
// Mirrors the web's group functions in src/lib/queries/messages.ts so group
// rows are interchangeable across clients.

export interface ConversationInfo {
  id: string;
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  created_by: string;
}

export interface GroupMember {
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export interface ConversationMembership {
  role: "member" | "admin";
  is_muted: boolean;
}

export async function createGroupConversation(
  creatorId: string,
  name: string,
  memberIds: string[],
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

export async function getConversationInfo(
  conversationId: string,
): Promise<ConversationInfo | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, is_group, name, avatar_url, created_by")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  return (data as ConversationInfo) ?? null;
}

export async function getGroupMembers(
  conversationId: string,
): Promise<GroupMember[]> {
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
    `,
    )
    .eq("conversation_id", conversationId)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as GroupMember[];
}

export async function getConversationMembership(
  conversationId: string,
  userId: string,
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

export async function addGroupMember(conversationId: string, userId: string) {
  const { error } = await supabase
    .from("conversation_members")
    .insert({ conversation_id: conversationId, user_id: userId, role: "member" });

  if (error) throw error;
}

export async function removeGroupMember(
  conversationId: string,
  userId: string,
) {
  const { error } = await supabase
    .from("conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function updateGroupName(conversationId: string, name: string) {
  const { error } = await supabase
    .from("conversations")
    .update({ name })
    .eq("id", conversationId);

  if (error) throw error;
}

export async function setConversationMuted(
  conversationId: string,
  userId: string,
  muted: boolean,
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
  userId: string,
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
 * so the member is never dropped. Same mechanics as the web client.
 */
export async function setGroupMemberRole(
  conversationId: string,
  userId: string,
  role: "member" | "admin",
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
