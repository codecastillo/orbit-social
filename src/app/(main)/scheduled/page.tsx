"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Pencil, Trash2, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getScheduledPosts,
  publishScheduledPost,
  updateScheduledTime,
  deletePost,
  type PostWithAuthor,
} from "@/lib/queries/posts";
import { Button } from "@/components/ui/button";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { cn } from "@/lib/utils";

function formatScheduledDate(dateStr: string): { abs: string; relative: string; overdue: boolean } {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const overdue = diffMs < 0;
  let relative = "";
  if (overdue) relative = "Overdue";
  else if (diffMins < 60) relative = `in ${diffMins}m`;
  else if (diffHours < 24) relative = `in ${diffHours}h`;
  else relative = `in ${diffDays}d`;

  const abs = `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })} at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;

  return { abs, relative, overdue };
}

export default function ScheduledPostsPage() {
  const { user } = useAuth();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["scheduled-posts", user?.id],
    queryFn: () => getScheduledPosts(user!.id),
    enabled: !!user?.id,
  });

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <div>
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          ◆&nbsp;&nbsp;COMPOSE · SCHEDULED · {posts?.length ?? 0}
        </p>
        <h1 className="mt-2 text-[48px] font-bold leading-none tracking-[-0.035em] text-foreground">
          Waiting in the <span className="text-primary">wings</span>.
        </h1>
        <p className="mt-2.5 max-w-[540px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Posts cued up to publish on their own. Edit, push now, or cancel.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <OrbitEmptyState
          icon={CalendarClock}
          accent="var(--warning)"
          headline="Nothing"
          accentWord="in the queue"
          sub="Use the composer's schedule option to have posts publish automatically at a time you pick."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <ScheduledPostCard key={post.id} post={post} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ScheduledPostCard({ post }: { post: PostWithAuthor }) {
  const queryClient = useQueryClient();
  const [editingTime, setEditingTime] = useState(false);
  const [newTime, setNewTime] = useState(
    post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : ""
  );

  const publishMutation = useMutation({
    mutationFn: () => publishScheduledPost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success("Published");
    },
    onError: () => toast.error("Failed to publish"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      toast.success("Deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const reschedMutation = useMutation({
    mutationFn: (scheduledAt: string) => updateScheduledTime(post.id, scheduledAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      setEditingTime(false);
      toast.success("Rescheduled");
    },
    onError: () => toast.error("Failed to update schedule"),
  });

  const handleReschedule = () => {
    if (!newTime) return;
    const date = new Date(newTime);
    if (date <= new Date()) {
      toast.error("Pick a future date and time");
      return;
    }
    reschedMutation.mutate(date.toISOString());
  };

  const preview =
    post.content && post.content.length > 140
      ? post.content.slice(0, 140) + "…"
      : post.content;

  const sched = post.scheduled_at ? formatScheduledDate(post.scheduled_at) : null;
  const overdue = !!sched?.overdue;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden rounded-xl border border-border bg-surface p-[18px]"
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          overdue ? "bg-warning" : "bg-muted-foreground"
        )}
      />

      <div
        className={cn(
          "mb-2.5 font-mono text-[10.5px] tracking-[0.12em]",
          overdue ? "text-warning" : "text-muted-foreground"
        )}
      >
        ◈&nbsp;&nbsp;{sched ? `${sched.abs.toUpperCase()} · ${sched.relative.toUpperCase()}` : "NO TIME SET"}
      </div>

      <p className="line-clamp-3 whitespace-pre-wrap text-[14.5px] leading-[1.55] text-foreground">
        {preview || <span className="italic text-text-faint">Media only, no text.</span>}
      </p>

      {post.post_media && post.post_media.length > 0 && (
        <div className="mt-2 font-mono text-[11px] tracking-[0.04em] text-text-faint">
          {post.post_media.length} ATTACHMENT{post.post_media.length > 1 ? "S" : ""}
        </div>
      )}

      <AnimatePresence>
        {editingTime && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 flex items-center gap-2 overflow-hidden"
          >
            <input
              type="datetime-local"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="h-9 flex-1 rounded-lg border border-border bg-surface-elevated px-3 text-[13px] text-foreground outline-none"
            />
            <Button
              size="sm"
              onClick={handleReschedule}
              disabled={reschedMutation.isPending}
              aria-label="Save schedule"
            >
              {reschedMutation.isPending ? <Loader2 className="animate-spin" /> : "Save"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditingTime(false)}>
              Cancel
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3.5 flex items-center gap-2 border-t border-border pt-3">
        <button
          onClick={() => setEditingTime(!editingTime)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-semibold text-text-secondary"
        >
          <Pencil className="size-3" />
          Reschedule
        </button>

        <Button
          size="sm"
          onClick={() => publishMutation.mutate()}
          disabled={publishMutation.isPending}
        >
          {publishMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          Publish now
        </Button>

        <div className="flex-1" />

        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-destructive/30 bg-transparent px-3 py-1.5 text-xs font-semibold text-destructive"
        >
          {deleteMutation.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
          Delete
        </button>
      </div>
    </motion.div>
  );
}
