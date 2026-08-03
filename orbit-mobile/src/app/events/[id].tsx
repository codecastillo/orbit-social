import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import {
  deleteEventComment,
  getEventAttendees,
  getEventById,
  getEventCohosts,
  getEventComments,
  getFriendsGoing,
  getUserRsvpStatus,
  postEventComment,
  removeRsvp,
  rsvpEvent,
  type EventComment,
  type EventWithCreator,
  type RsvpStatus,
} from "@/lib/queries/events";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

const MAX_ATTENDEE_AVATARS = 6;
const MAX_COMMENT_LENGTH = 500;
const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;

function formatEventTime(startAt: string): string {
  const date = new Date(startAt);
  const day = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} at ${time}`;
}

// ICS TEXT values escape backslash, semicolon, comma, and newlines (RFC 5545).
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildEventIcs(event: EventWithCreator): string {
  const start = new Date(event.start_at);
  // Calendar apps want a real end; fall back to one hour for open-ended events.
  const end = event.end_at
    ? new Date(event.end_at)
    : new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
  const location = event.is_online
    ? event.online_url || "Online"
    : event.location || "";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Orbit//Events//EN",
    "BEGIN:VEVENT",
    `UID:orbit-event-${event.id}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : null,
    event.description ? `DESCRIPTION:${escapeIcsText(event.description)}` : null,
    `URL:https://orbitsocial.net/events/${event.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line): line is string => line !== null);
  return lines.join("\r\n");
}

function CommentRow({
  comment,
  isMine,
  onReply,
  onDelete,
}: {
  comment: EventComment;
  isMine: boolean;
  onReply: () => void;
  onDelete: () => void;
}) {
  const authorName =
    comment.profiles.display_name || comment.profiles.username;
  return (
    <View style={styles.commentRow}>
      <Avatar url={comment.profiles.avatar_url} name={authorName} size={32} />
      <View style={styles.commentBody}>
        <View style={styles.commentMeta}>
          <Text style={styles.commentAuthor} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={styles.commentTime}>
            {formatTimeAgo(comment.created_at)}
          </Text>
        </View>
        <Text style={styles.commentText}>{comment.content}</Text>
      </View>
      <View style={styles.commentActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reply to comment"
          onPress={onReply}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Ionicons
            name="arrow-undo-outline"
            size={15}
            color={colors.mutedForeground}
          />
        </Pressable>
        {isMine ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete comment"
            onPress={onDelete}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name="trash-outline"
              size={15}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<EventComment | null>(null);
  const commentInputRef = useRef<TextInput>(null);

  const eventQuery = useQuery({
    queryKey: ["event", id],
    queryFn: () => getEventById(id),
    enabled: !!id,
  });
  const event = eventQuery.data;

  const attendeesQuery = useQuery({
    queryKey: ["event-attendees", id],
    queryFn: () => getEventAttendees(id),
    enabled: !!id,
  });

  const cohostsQuery = useQuery({
    queryKey: ["event-cohosts", id],
    queryFn: () => getEventCohosts(id),
    enabled: !!id,
  });
  const cohosts = cohostsQuery.data ?? [];

  const rsvpKey = ["event-rsvp", id, user?.id];
  const rsvpQuery = useQuery({
    queryKey: rsvpKey,
    queryFn: () => getUserRsvpStatus(id, user!.id),
    enabled: !!id && !!user,
  });
  const rsvpStatus = rsvpQuery.data ?? null;

  const friendsQuery = useQuery({
    queryKey: ["event-friends-going", id, user?.id],
    queryFn: () => getFriendsGoing(id, user!.id),
    enabled: !!id && !!user,
  });
  const friendsGoing = friendsQuery.data;

  const commentsKey = ["event-comments", id];
  const commentsQuery = useQuery({
    queryKey: commentsKey,
    queryFn: () => getEventComments(id),
    enabled: !!id,
  });
  const comments = commentsQuery.data ?? [];

  // Mirrors the web: tapping the active status removes the RSVP, anything
  // else upserts it. The DB trigger recomputes attendee_count.
  const rsvp = useMutation({
    mutationFn: (status: RsvpStatus) =>
      rsvpStatus === status
        ? removeRsvp(id, user!.id)
        : rsvpEvent(id, user!.id, status),
    onSuccess: (_data, status) => {
      queryClient.setQueryData(rsvpKey, rsvpStatus === status ? null : status);
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      queryClient.invalidateQueries({ queryKey: ["event-attendees", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const sendComment = useMutation({
    mutationFn: () =>
      postEventComment(id, user!.id, draft.trim(), replyTo?.id ?? null),
    onSuccess: (created) => {
      queryClient.setQueryData<EventComment[]>(commentsKey, (prev) => [
        ...(prev ?? []),
        created,
      ]);
      setDraft("");
      setReplyTo(null);
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => deleteEventComment(commentId),
    onMutate: (commentId) => {
      const prev = queryClient.getQueryData<EventComment[]>(commentsKey);
      queryClient.setQueryData<EventComment[]>(commentsKey, (list) =>
        (list ?? []).filter((c) => c.id !== commentId),
      );
      return { prev };
    },
    onError: (_err, _commentId, context) => {
      if (context?.prev) queryClient.setQueryData(commentsKey, context.prev);
    },
  });

  const handleAddToCalendar = async () => {
    if (!event) return;
    try {
      if (Platform.OS === "ios") {
        // The iOS share sheet takes a file url, so the ICS opens straight
        // into Calendar-capable apps.
        const file = new File(Paths.cache, `orbit-event-${event.id}.ics`);
        file.write(buildEventIcs(event));
        await Share.share({ url: file.uri });
      } else {
        // Android's Share.share has no file attachment path; share the
        // event details as text instead.
        const parts = [
          event.title,
          formatEventTime(event.start_at),
          event.is_online
            ? (event.online_url ?? "Online event")
            : (event.location ?? ""),
          `https://orbitsocial.net/events/${event.id}`,
        ].filter(Boolean);
        await Share.share({ message: parts.join("\n") });
      }
    } catch {
      // User dismissed the sheet or the write failed; nothing to surface.
    }
  };

  const startReply = (comment: EventComment) => {
    // Always thread under the top-level ancestor so we don't get nested chains.
    let target = comment;
    if (comment.parent_id) {
      const root = comments.find((c) => c.id === comment.parent_id);
      if (root) target = root;
    }
    setReplyTo(target);
    commentInputRef.current?.focus();
  };

  if (eventQuery.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: "Event" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </>
    );
  }

  if (eventQuery.isError || !event) {
    return (
      <>
        <Stack.Screen options={{ title: "Event" }} />
        <EmptyState
          title="Could not load this event"
          description="It may have been removed, or your connection dropped."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => eventQuery.refetch()}
            />
          }
        />
      </>
    );
  }

  const goingAttendees = (attendeesQuery.data ?? []).filter(
    (attendee) => attendee.status === "going",
  );

  const rootComments = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, EventComment[]>();
  for (const comment of comments) {
    if (comment.parent_id) {
      const siblings = repliesByParent.get(comment.parent_id) ?? [];
      siblings.push(comment);
      repliesByParent.set(comment.parent_id, siblings);
    }
  }

  const canSend =
    !!user && draft.trim().length > 0 && !sendComment.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: event.title }} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={eventQuery.isRefetching || attendeesQuery.isRefetching}
            onRefresh={() => {
              eventQuery.refetch();
              attendeesQuery.refetch();
              rsvpQuery.refetch();
              friendsQuery.refetch();
              commentsQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {event.cover_url ? (
          <Image
            source={{ uri: event.cover_url }}
            alt=""
            style={styles.cover}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.cover, styles.coverFallback]} />
        )}

        <View style={styles.body}>
          <Text style={styles.time}>{formatEventTime(event.start_at)}</Text>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.location}>
            {event.is_online ? "Online event" : (event.location ?? "Location TBA")}
          </Text>

          <View style={styles.hostRow}>
            <Avatar
              url={event.profiles.avatar_url}
              name={event.profiles.display_name}
              size={36}
            />
            <View style={styles.hostInfo}>
              <Text style={styles.hostLabel}>Hosted by</Text>
              <Text style={styles.hostName}>{event.profiles.display_name}</Text>
            </View>
            {user?.id === event.creator_id ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage co-hosts"
                onPress={() =>
                  router.push({
                    pathname: "/events/cohosts",
                    params: { eventId: event.id },
                  })
                }
                hitSlop={8}
                style={({ pressed }) => [
                  styles.manageCohostsButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.manageCohostsLabel}>Manage co-hosts</Text>
              </Pressable>
            ) : null}
          </View>

          {cohosts.length > 0 ? (
            <>
              <Text style={styles.cohostsLabel}>Co-hosted with</Text>
              <View style={styles.cohostsRow}>
                {cohosts.map((cohost) => (
                  <Pressable
                    key={cohost.user_id}
                    accessibilityRole="button"
                    accessibilityLabel={`View co-host @${cohost.profiles.username}`}
                    onPress={() =>
                      router.push(`/user/${cohost.profiles.username}`)
                    }
                    style={({ pressed }) => [
                      styles.cohostChip,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Avatar
                      url={cohost.profiles.avatar_url}
                      name={
                        cohost.profiles.display_name || cohost.profiles.username
                      }
                      size={24}
                    />
                    <Text style={styles.cohostName} numberOfLines={1}>
                      {cohost.profiles.display_name || cohost.profiles.username}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {event.description ? (
            <Text style={styles.description}>{event.description}</Text>
          ) : null}

          {friendsGoing && friendsGoing.count > 0 ? (
            <View style={styles.friendsRow}>
              <View style={styles.friendsAvatars}>
                {friendsGoing.profiles.map((profile) => (
                  <View key={profile.id} style={styles.friendAvatar}>
                    <Avatar
                      url={profile.avatar_url}
                      name={profile.display_name || profile.username}
                      size={28}
                    />
                  </View>
                ))}
              </View>
              <Text style={styles.friendsLabel}>
                {friendsGoing.count === 1
                  ? "1 person you follow is going"
                  : `${formatNumber(friendsGoing.count)} people you follow are going`}
              </Text>
            </View>
          ) : null}

          {user ? (
            <View style={styles.rsvpRow}>
              <View style={styles.rsvpButton}>
                <Button
                  label="Going"
                  variant={rsvpStatus === "going" ? "primary" : "outline"}
                  disabled={rsvp.isPending || rsvpQuery.isPending}
                  onPress={() => rsvp.mutate("going")}
                  style={[
                    styles.pairButton,
                    rsvpStatus !== "going" && styles.pairButtonSecondary,
                  ]}
                />
              </View>
              <View style={styles.rsvpButton}>
                <Button
                  label="Interested"
                  variant={rsvpStatus === "interested" ? "primary" : "outline"}
                  disabled={rsvp.isPending || rsvpQuery.isPending}
                  onPress={() => rsvp.mutate("interested")}
                  style={[
                    styles.pairButton,
                    rsvpStatus !== "interested" && styles.pairButtonSecondary,
                  ]}
                />
              </View>
              <View style={styles.rsvpButton}>
                <Button
                  label="Can't go"
                  variant={rsvpStatus === "not_going" ? "primary" : "outline"}
                  disabled={rsvp.isPending || rsvpQuery.isPending}
                  onPress={() => rsvp.mutate("not_going")}
                  style={[
                    styles.pairButton,
                    rsvpStatus !== "not_going" && styles.pairButtonSecondary,
                  ]}
                />
              </View>
            </View>
          ) : null}

          <Button
            label="Add to calendar"
            variant="outline"
            onPress={handleAddToCalendar}
            style={styles.calendarButton}
          />

          <View style={styles.attendeesCard}>
            <Text style={styles.attendeesTitle}>
              {formatNumber(event.attendee_count)} going
            </Text>
            {attendeesQuery.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : goingAttendees.length > 0 ? (
              <View style={styles.attendeesRow}>
                {goingAttendees.slice(0, MAX_ATTENDEE_AVATARS).map((attendee) => (
                  <View key={attendee.user_id} style={styles.attendeeAvatar}>
                    <Avatar
                      url={attendee.profiles.avatar_url}
                      name={attendee.profiles.display_name}
                      size={36}
                    />
                  </View>
                ))}
                {goingAttendees.length > MAX_ATTENDEE_AVATARS ? (
                  <Text style={styles.attendeesMore}>
                    +{goingAttendees.length - MAX_ATTENDEE_AVATARS}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.attendeesEmpty}>No RSVPs yet.</Text>
            )}
          </View>

          <View style={styles.commentsSection}>
            <Text style={styles.commentsTitle}>
              Discussion{comments.length > 0 ? ` (${comments.length})` : ""}
            </Text>
            {commentsQuery.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : rootComments.length === 0 ? (
              <Text style={styles.commentsEmpty}>
                Be the first to say something.
              </Text>
            ) : (
              rootComments.map((comment) => (
                <View key={comment.id}>
                  <CommentRow
                    comment={comment}
                    isMine={user?.id === comment.user_id}
                    onReply={() => startReply(comment)}
                    onDelete={() => deleteComment.mutate(comment.id)}
                  />
                  {(repliesByParent.get(comment.id) ?? []).map((reply) => (
                    <View key={reply.id} style={styles.commentReply}>
                      <CommentRow
                        comment={reply}
                        isMine={user?.id === reply.user_id}
                        onReply={() => startReply(reply)}
                        onDelete={() => deleteComment.mutate(reply.id)}
                      />
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {user ? (
        <View style={styles.composer}>
          {replyTo ? (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                Replying to @{replyTo.profiles.username}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                onPress={() => setReplyTo(null)}
                hitSlop={8}
              >
                <Ionicons name="close" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composerRow}>
            <TextInput
              ref={commentInputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder={
                replyTo
                  ? `Reply to @${replyTo.profiles.username}`
                  : "Say something"
              }
              placeholderTextColor={colors.textFaint}
              maxLength={MAX_COMMENT_LENGTH}
              style={styles.composerInput}
              editable={!sendComment.isPending}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              disabled={!canSend}
              onPress={() => sendComment.mutate()}
              style={({ pressed }) => [
                styles.sendButton,
                pressed && { opacity: 0.85 },
                !canSend && { opacity: 0.4 },
              ]}
            >
              <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing(10),
  },
  cover: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  coverFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  body: {
    padding: spacing(4),
  },
  time: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  title: {
    color: colors.foreground,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 4,
  },
  location: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    marginTop: 6,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing(4),
  },
  hostInfo: {
    marginLeft: spacing(2.5),
  },
  hostLabel: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  hostName: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
  },
  manageCohostsButton: {
    marginLeft: "auto",
  },
  manageCohostsLabel: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: "600",
  },
  cohostsLabel: {
    color: colors.textFaint,
    fontSize: 11.5,
    marginTop: spacing(3),
  },
  cohostsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
    marginTop: spacing(1.5),
  },
  cohostChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingLeft: spacing(1),
    paddingRight: spacing(2.5),
    paddingVertical: spacing(1),
    maxWidth: 200,
  },
  cohostName: {
    color: colors.foreground,
    fontSize: 12.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing(4),
  },
  friendsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing(4),
  },
  friendsAvatars: {
    flexDirection: "row",
    marginRight: spacing(3),
  },
  friendAvatar: {
    marginRight: -spacing(2),
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.background,
  },
  friendsLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginLeft: spacing(2),
    flexShrink: 1,
  },
  rsvpRow: {
    flexDirection: "row",
    gap: spacing(2.5),
    marginTop: spacing(5),
  },
  rsvpButton: {
    flex: 1,
  },
  pairButton: {
    minHeight: 36,
    borderRadius: 10,
  },
  pairButtonSecondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 0,
  },
  calendarButton: {
    minHeight: 36,
    borderRadius: 10,
    marginTop: spacing(3),
  },
  attendeesCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(3.5),
    marginTop: spacing(5),
  },
  attendeesTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: spacing(3),
  },
  attendeesRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  attendeeAvatar: {
    marginRight: -spacing(2),
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  attendeesMore: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontWeight: "600",
    marginLeft: spacing(4),
  },
  attendeesEmpty: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  commentsSection: {
    marginTop: spacing(5),
  },
  commentsTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: spacing(3),
  },
  commentsEmpty: {
    color: colors.mutedForeground,
    fontSize: 13,
    paddingVertical: spacing(2),
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing(3),
  },
  commentReply: {
    marginLeft: spacing(9),
  },
  commentBody: {
    flex: 1,
    marginLeft: spacing(2.5),
  },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  commentAuthor: {
    color: colors.foreground,
    fontSize: 12.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  commentTime: {
    color: colors.textFaint,
    fontSize: 11.5,
    marginLeft: spacing(2),
  },
  commentText: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 2,
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    marginLeft: spacing(2),
    paddingTop: 2,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    marginBottom: spacing(2),
  },
  replyBannerText: {
    color: colors.mutedForeground,
    fontSize: 12,
    flexShrink: 1,
    marginRight: spacing(2),
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    color: colors.foreground,
    fontSize: 14,
  },
  sendButton: {
    marginLeft: spacing(2.5),
    height: 36,
    width: 36,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
