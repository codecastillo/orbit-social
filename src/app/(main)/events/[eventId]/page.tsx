"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeftIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  GlobeIcon,
  LinkIcon,
  UsersIcon,
  CheckCircle2Icon,
  StarIcon,
  XCircleIcon,
  SendHorizonalIcon,
  Trash2Icon,
  Reply as ReplyIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatNumber, formatTimeAgo } from "@/lib/utils/format";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useCurrentProfile } from "@/lib/hooks/use-profile";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AttendeesDialog } from "@/components/events/attendees-dialog";
import {
  getEventById,
  getEventAttendees,
  getUserRsvpStatus,
  rsvpEvent,
  removeRsvp,
  getEventComments,
  postEventComment,
  deleteEventComment,
  deleteEvent,
  type EventWithCreator,
  type EventAttendee,
  type EventComment,
} from "@/lib/queries/events";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/orbit/confirm-dialog";
import { MoreHorizontal } from "lucide-react";

type RsvpStatus = "going" | "interested" | "not_going" | null;

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const { data: currentProfile } = useCurrentProfile();
  const supabase = createClient();

  const [event, setEvent] = useState<EventWithCreator | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const [comments, setComments] = useState<EventComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [replyTo, setReplyTo] = useState<EventComment | null>(null);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  const refetchAttendees = useCallback(async () => {
    try {
      const data = await getEventAttendees(eventId, 30);
      setAttendees(data);
    } catch (err) {
      console.error("Failed to refresh attendees:", err);
    }
  }, [eventId]);

  useEffect(() => {
    async function load() {
      try {
        const [eventData, attendeeData, commentData] = await Promise.all([
          getEventById(eventId),
          getEventAttendees(eventId, 30),
          getEventComments(eventId, 50),
        ]);
        setEvent(eventData);
        setAttendees(attendeeData);
        setComments(commentData);

        if (user) {
          const status = await getUserRsvpStatus(eventId, user.id);
          setRsvpStatus(status);
        }
      } catch (err) {
        console.error("Failed to load event:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [eventId, user]);

  // Realtime: events row updates (attendee_count) + rsvps + comments
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`event-${eventId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<EventWithCreator>;
          setEvent((prev) => (prev ? { ...prev, ...updated } : prev));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_rsvps",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          refetchAttendees();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_comments",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const row = payload.new as EventComment;
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, is_verified")
            .eq("id", row.user_id)
            .single();
          setComments((prev) => {
            if (prev.some((c) => c.id === row.id)) return prev;
            const tempIdx = prev.findIndex(
              (c) =>
                c.id.startsWith("temp-") &&
                c.user_id === row.user_id &&
                c.content === row.content
            );
            if (tempIdx >= 0) {
              const next = [...prev];
              next[tempIdx] = { ...row, profiles: profile as EventComment["profiles"] };
              return next;
            }
            return [...prev, { ...row, profiles: profile as EventComment["profiles"] }];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "event_comments",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const old = payload.old as { id: string };
          setComments((prev) => prev.filter((c) => c.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase, refetchAttendees]);

  async function handleRsvp(status: "going" | "interested" | "not_going") {
    if (!event) return;
    if (!requireAuth() || !user) return;
    const prev = rsvpStatus;
    const isToggleOff = prev === status;
    const next: RsvpStatus = isToggleOff ? null : status;

    // Optimistic UI: toggle status + adjust attendee_count locally for "going".
    setRsvpStatus(next);
    const wasGoing = prev === "going";
    const willBeGoing = next === "going";
    if (wasGoing !== willBeGoing) {
      const delta = willBeGoing ? 1 : -1;
      setEvent((e) =>
        e ? { ...e, attendee_count: Math.max(0, (e.attendee_count ?? 0) + delta) } : e
      );
    }

    setRsvpLoading(true);
    try {
      if (isToggleOff) {
        await removeRsvp(event.id, user.id);
      } else {
        await rsvpEvent(event.id, user.id, status);
      }
    } catch (err) {
      console.error("Failed to RSVP:", err);
      toast.error("Couldn't update RSVP");
      // Rollback
      setRsvpStatus(prev);
      if (wasGoing !== willBeGoing) {
        const delta = willBeGoing ? -1 : 1;
        setEvent((e) =>
          e ? { ...e, attendee_count: Math.max(0, (e.attendee_count ?? 0) + delta) } : e
        );
      }
    } finally {
      setRsvpLoading(false);
    }
  }

  async function handlePostComment() {
    if (!user || !event) return;
    const content = commentInput.trim();
    if (!content) return;

    const tempId = `temp-${Date.now()}`;
    const parentId = replyTo?.id ?? null;
    const optimistic: EventComment = {
      id: tempId,
      event_id: event.id,
      user_id: user.id,
      content,
      created_at: new Date().toISOString(),
      parent_id: parentId,
      profiles: {
        id: user.id,
        username: currentProfile?.username || "you",
        display_name: currentProfile?.display_name || "You",
        avatar_url: currentProfile?.avatar_url || null,
        is_verified: currentProfile?.is_verified || false,
      },
    };
    setComments((prev) => [...prev, optimistic]);
    setCommentInput("");
    setReplyTo(null);
    setCommentSending(true);

    try {
      const real = await postEventComment(event.id, user.id, content, parentId);
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? real : c))
      );
      requestAnimationFrame(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    } catch (err) {
      console.error("Failed to post comment:", err);
      toast.error("Couldn't post comment");
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentInput(content);
      setReplyTo(replyTo);
    } finally {
      setCommentSending(false);
    }
  }

  function startReply(comment: EventComment) {
    // Always thread under the top-level ancestor so we don't get nested chains.
    let target = comment;
    if (comment.parent_id) {
      const root = comments.find((c) => c.id === comment.parent_id);
      if (root) target = root;
    }
    setReplyTo(target);
    requestAnimationFrame(() => commentInputRef.current?.focus());
  }

  async function handleDeleteComment(commentId: string) {
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== commentId));
    try {
      await deleteEventComment(commentId);
    } catch (err) {
      console.error("Failed to delete comment:", err);
      toast.error("Couldn't delete comment");
      setComments(prev);
    }
  }

  if (loading) {
    return (
      <div className="border-x border-border min-h-screen">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-6" />
        </div>
        <Skeleton className="aspect-[2/1] w-full" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="border-x border-border min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  const startDate = new Date(event.start_at);
  const endDate = event.end_at ? new Date(event.end_at) : null;
  const goingAttendees = attendees.filter((a) => a.status === "going");
  const isHost = !!user && event.creator_id === user.id;

  const handleDelete = async () => {
    if (!isHost || !user) return;
    try {
      await deleteEvent(event.id, user.id);
      toast.success("Event deleted");
      router.push("/events");
    } catch (err) {
      console.error("Failed to delete event:", err);
      toast.error("Couldn't delete event");
    }
  };

  return (
    <div className="border-x border-border min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b border-border bg-background/80 backdrop-blur-xl">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold truncate flex-1">Event</h1>
        {isHost && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Event actions"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
            >
              <MoreHorizontal className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl">
              <DropdownMenuItem
                onClick={() => setConfirmDeleteOpen(true)}
                className="text-destructive cursor-pointer rounded-lg"
              >
                <Trash2Icon className="mr-2 h-4 w-4" />
                Delete event
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Cover, capped so it never towers on wide screens */}
      <div className="relative w-full bg-muted/20 max-h-[320px] aspect-[2/1] overflow-hidden">
        {event.cover_url ? (
          <Image
            src={event.cover_url}
            alt={event.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 600px"
            priority
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-purple-600/20 to-pink-600/20 flex items-center justify-center">
            <CalendarIcon className="h-16 w-16 text-primary/40" />
          </div>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Date/time prominent display */}
        <div className="flex items-start gap-4">
          <div className="shrink-0 h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center">
            <span className="text-xs font-medium uppercase text-primary">
              {format(startDate, "MMM")}
            </span>
            <span className="text-lg font-bold text-foreground leading-tight">
              {format(startDate, "d")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{event.title}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <ClockIcon className="h-3.5 w-3.5" />
              <span>
                {format(startDate, "EEEE, MMMM d 'at' h:mm a")}
                {endDate && ` - ${format(endDate, "h:mm a")}`}
              </span>
            </div>
          </div>
        </div>

        {/* Location */}
        {(event.location || event.is_online) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {event.is_online ? (
              <>
                <GlobeIcon className="h-4 w-4 shrink-0" />
                <span>Online event</span>
                {event.online_url && (
                  <a
                    href={event.online_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline ml-1"
                  >
                    <LinkIcon className="h-3 w-3" />
                    Join link
                  </a>
                )}
              </>
            ) : (
              <>
                <MapPinIcon className="h-4 w-4 shrink-0" />
                <span>{event.location}</span>
              </>
            )}
          </div>
        )}

        {/* Attendees, avatars only, click to open full list */}
        <button
          type="button"
          onClick={() => setAttendeesOpen(true)}
          className="flex items-center gap-3 group hover:opacity-90 transition-opacity"
          aria-label="See all attendees"
        >
          <div className="flex -space-x-2">
            {goingAttendees.slice(0, 4).map((attendee) => (
              <div
                key={attendee.user_id}
                className="ring-2 ring-background rounded-full"
                title={
                  attendee.profiles.display_name || attendee.profiles.username
                }
              >
                <UserAvatar
                  src={attendee.profiles.avatar_url}
                  fallback={
                    attendee.profiles.display_name ||
                    attendee.profiles.username
                  }
                  size="sm"
                />
              </div>
            ))}
            {goingAttendees.length === 0 && (
              <div className="h-8 w-8 rounded-full bg-muted/40 ring-2 ring-background flex items-center justify-center">
                <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
            {goingAttendees.length > 4 && (
              <div className="h-8 w-8 rounded-full bg-muted/60 ring-2 ring-background flex items-center justify-center text-[10px] font-mono font-semibold text-foreground">
                +{goingAttendees.length - 4}
              </div>
            )}
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            <UsersIcon className="h-3.5 w-3.5 inline mr-1" />
            {formatNumber(event.attendee_count)} attending
          </span>
        </button>

        {/* RSVP buttons */}
        <div className="flex gap-2">
          <Button
            variant={rsvpStatus === "going" ? "default" : "outline"}
            size="sm"
            className={cn("flex-1", rsvpStatus === "going" && "shadow-lg")}
            onClick={() => handleRsvp("going")}
            disabled={rsvpLoading}
          >
            <CheckCircle2Icon className="h-4 w-4" />
            Going
          </Button>
          <Button
            variant={rsvpStatus === "interested" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => handleRsvp("interested")}
            disabled={rsvpLoading}
          >
            <StarIcon className="h-4 w-4" />
            Interested
          </Button>
          <Button
            variant={rsvpStatus === "not_going" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => handleRsvp("not_going")}
            disabled={rsvpLoading}
          >
            <XCircleIcon className="h-4 w-4" />
            Can&apos;t Go
          </Button>
        </div>

        {/* Description */}
        {event.description && (
          <div className="pt-4 border-t border-white/5">
            <h3 className="text-sm font-medium mb-2">About</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        )}

        {/* Creator */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          <UserAvatar
            src={event.profiles.avatar_url}
            fallback={event.profiles.display_name || event.profiles.username}
            size="md"
          />
          <div>
            <p className="text-xs text-muted-foreground">Hosted by</p>
            <Link
              href={`/${event.profiles.username}`}
              className="font-medium text-sm hover:underline"
            >
              {event.profiles.display_name || event.profiles.username}
            </Link>
          </div>
        </div>

        {/* Comments */}
        <div className="pt-4 border-t border-white/5">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            Discussion
            <span className="text-xs text-muted-foreground">
              {comments.length}
            </span>
          </h3>

          <div className="space-y-3 mb-3 max-h-[420px] overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Be the first to say something.
              </p>
            ) : (
              (() => {
                const roots = comments.filter((c) => !c.parent_id);
                const childMap = new Map<string, EventComment[]>();
                for (const c of comments) {
                  if (c.parent_id) {
                    const arr = childMap.get(c.parent_id) ?? [];
                    arr.push(c);
                    childMap.set(c.parent_id, arr);
                  }
                }
                return roots.map((c) => (
                  <div key={c.id}>
                    <CommentRow
                      comment={c}
                      currentUserId={user?.id}
                      onReply={() => startReply(c)}
                      onDelete={() => handleDeleteComment(c.id)}
                    />
                    {(childMap.get(c.id) ?? []).map((reply) => (
                      <div key={reply.id} className="ml-9 mt-2">
                        <CommentRow
                          comment={reply}
                          currentUserId={user?.id}
                          onReply={() => startReply(reply)}
                          onDelete={() => handleDeleteComment(reply.id)}
                        />
                      </div>
                    ))}
                  </div>
                ));
              })()
            )}
            <div ref={commentsEndRef} />
          </div>

          {user ? (
            currentProfile ? (
              <>
                {replyTo && (
                  <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-lg bg-muted/40 border border-border text-xs">
                    <span className="text-muted-foreground truncate">
                      Replying to{" "}
                      <span className="text-foreground font-medium">
                        @{replyTo.profiles?.username}
                      </span>
                    </span>
                    <button
                      onClick={() => setReplyTo(null)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Cancel reply"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <UserAvatar
                    src={currentProfile.avatar_url}
                    fallback={
                      currentProfile.display_name ||
                      currentProfile.username ||
                      "You"
                    }
                    size="sm"
                  />
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handlePostComment();
                      } else if (e.key === "Escape" && replyTo) {
                        setReplyTo(null);
                      }
                    }}
                    placeholder={
                      replyTo
                        ? `Reply to @${replyTo.profiles?.username}…`
                        : "Say something…"
                    }
                    disabled={commentSending}
                    className="flex-1 bg-muted/30 border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <Button
                    size="icon"
                    onClick={handlePostComment}
                    disabled={commentSending || !commentInput.trim()}
                    aria-label="Post comment"
                  >
                    <SendHorizonalIcon className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="flex-1 h-9 rounded-full" />
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              Sign in to comment.
            </p>
          )}
        </div>
      </div>

      <AttendeesDialog
        open={attendeesOpen}
        onOpenChange={setAttendeesOpen}
        eventId={event.id}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this event?"
        description="RSVPs and comments will be removed too. This can't be undone."
        confirmLabel="Delete event"
        danger
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CommentRow({
  comment,
  currentUserId,
  onReply,
  onDelete,
}: {
  comment: EventComment;
  currentUserId?: string;
  onReply: () => void;
  onDelete: () => void;
}) {
  const isMine = currentUserId === comment.user_id;
  const isPending = comment.id.startsWith("temp-");
  return (
    <div className="flex items-start gap-2.5 group">
      <UserAvatar
        src={comment.profiles?.avatar_url}
        fallback={
          comment.profiles?.display_name || comment.profiles?.username || "?"
        }
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={`/${comment.profiles?.username}`}
            className="font-medium text-foreground hover:underline truncate"
          >
            {comment.profiles?.display_name || comment.profiles?.username}
          </Link>
          <span className="text-muted-foreground">
            {formatTimeAgo(comment.created_at)}
          </span>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isPending && (
              <button
                onClick={onReply}
                className="text-muted-foreground/70 hover:text-foreground p-0.5"
                aria-label="Reply"
                title="Reply"
              >
                <ReplyIcon className="h-3.5 w-3.5" />
              </button>
            )}
            {isMine && !isPending && (
              <button
                onClick={onDelete}
                className="text-muted-foreground/60 hover:text-destructive p-0.5"
                aria-label="Delete comment"
                title="Delete"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words mt-0.5">
          {comment.content}
        </p>
      </div>
    </div>
  );
}
