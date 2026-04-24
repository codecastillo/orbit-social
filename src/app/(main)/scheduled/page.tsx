"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Send, Pencil, Trash2, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getScheduledPosts,
  publishScheduledPost,
  updateScheduledTime,
  deletePost,
  type PostWithAuthor,
} from "@/lib/queries/posts";

function formatScheduledDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let relative = "";
  if (diffMs < 0) {
    relative = "Overdue";
  } else if (diffMins < 60) {
    relative = `in ${diffMins}m`;
  } else if (diffHours < 24) {
    relative = `in ${diffHours}h`;
  } else {
    relative = `in ${diffDays}d`;
  }

  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })} at ${date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })} (${relative})`;
}

export default function ScheduledPostsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["scheduled-posts", user?.id],
    queryFn: () => getScheduledPosts(user!.id),
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-background/80 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <Clock className="h-4.5 w-4.5 text-violet-400" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">Scheduled</h1>
          </div>
          {posts && posts.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({posts.length})
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white/[0.03] animate-pulse"
            />
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-16 w-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-5">
            <CalendarClock className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-base font-semibold text-muted-foreground">
            No scheduled posts
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1.5 max-w-xs text-center">
            Schedule posts from the composer to have them published
            automatically at a specific time.
          </p>
        </div>
      ) : (
        <div className="p-5 space-y-3">
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
    post.scheduled_at
      ? new Date(post.scheduled_at).toISOString().slice(0, 16)
      : ""
  );

  const publishMutation = useMutation({
    mutationFn: () => publishScheduledPost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success("Post published");
    },
    onError: () => toast.error("Failed to publish post"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      toast.success("Scheduled post deleted");
    },
    onError: () => toast.error("Failed to delete post"),
  });

  const reschedMutation = useMutation({
    mutationFn: (scheduledAt: string) =>
      updateScheduledTime(post.id, scheduledAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      setEditingTime(false);
      toast.success("Schedule updated");
    },
    onError: () => toast.error("Failed to update schedule"),
  });

  const handleReschedule = () => {
    if (!newTime) return;
    const date = new Date(newTime);
    if (date <= new Date()) {
      toast.error("Please pick a future date and time");
      return;
    }
    reschedMutation.mutate(date.toISOString());
  };

  const contentPreview =
    post.content && post.content.length > 140
      ? post.content.slice(0, 140) + "..."
      : post.content;

  const isOverdue =
    post.scheduled_at && new Date(post.scheduled_at) < new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
    >
      {/* Content preview */}
      <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
        {contentPreview || (
          <span className="text-zinc-500 italic">No text content</span>
        )}
      </p>

      {/* Media indicator */}
      {post.post_media && post.post_media.length > 0 && (
        <p className="mt-1.5 text-xs text-zinc-500">
          {post.post_media.length} media attachment
          {post.post_media.length > 1 ? "s" : ""}
        </p>
      )}

      {/* Scheduled time */}
      <div className="mt-3 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-zinc-500" />
        <span
          className={`text-xs font-medium ${isOverdue ? "text-amber-400" : "text-zinc-400"}`}
        >
          {post.scheduled_at
            ? formatScheduledDate(post.scheduled_at)
            : "No time set"}
        </span>
      </div>

      {/* Edit time */}
      <AnimatePresence>
        {editingTime && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-3 flex items-center gap-2"
          >
            <input
              type="datetime-local"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.1] text-zinc-200 focus:outline-none focus:border-primary/50 transition-colors"
            />
            <Button
              size="sm"
              className="rounded-xl px-3 bg-primary hover:bg-primary/90 text-primary-foreground border-0"
              onClick={handleReschedule}
              disabled={reschedMutation.isPending}
            >
              {reschedMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl px-3"
              onClick={() => setEditingTime(false)}
            >
              Cancel
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl text-xs gap-1.5 text-zinc-400 hover:text-white"
          onClick={() => setEditingTime(!editingTime)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit Time
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl text-xs gap-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
          onClick={() => publishMutation.mutate()}
          disabled={publishMutation.isPending}
        >
          {publishMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Publish Now
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl text-xs gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Delete
        </Button>
      </div>
    </motion.div>
  );
}
