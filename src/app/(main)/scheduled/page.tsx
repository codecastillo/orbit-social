"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Send, Pencil, Trash2, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getScheduledPosts,
  publishScheduledPost,
  updateScheduledTime,
  deletePost,
  type PostWithAuthor,
} from "@/lib/queries/posts";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { OrbitEmptyState } from "@/components/orbit/empty-state";

const SCHED_ACCENT = "#ffd76a";

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
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <Eyebrow accent>◆&nbsp;&nbsp;COMPOSE · SCHEDULED · {posts?.length ?? 0}</Eyebrow>
        <Display size={48} style={{ marginTop: 8 }}>
          Waiting in the <Acc>wings</Acc>.
        </Display>
        <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 540 }}>
          Posts cued up to publish on their own. Edit, push now, or cancel.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ height: 120, borderRadius: 18, background: "rgba(255,255,255,0.03)" }}
              className="animate-pulse"
            />
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <OrbitEmptyState
          icon={CalendarClock}
          accent={SCHED_ACCENT}
          headline="Nothing"
          accentWord="in the queue"
          sub="Use the composer's schedule option to have posts publish automatically at a time you pick."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
  const accent = sched?.overdue ? "#ff9a3d" : SCHED_ACCENT;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      style={{
        ...panel({ borderRadius: 18 }),
        padding: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 3,
          background: accent,
          boxShadow: `0 0 14px ${accent}80`,
        }}
      />

      <div
        style={{
          fontFamily: O.mono,
          fontSize: 10.5,
          letterSpacing: "0.12em",
          color: accent,
          marginBottom: 10,
        }}
      >
        ◈&nbsp;&nbsp;{sched ? `${sched.abs.toUpperCase()} · ${sched.relative.toUpperCase()}` : "NO TIME SET"}
      </div>

      <p
        style={{
          fontSize: 14.5,
          color: O.ink,
          margin: 0,
          whiteSpace: "pre-wrap",
          lineHeight: 1.55,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {preview || <span style={{ color: O.ink4, fontStyle: "italic" }}>Media only, no text.</span>}
      </p>

      {post.post_media && post.post_media.length > 0 && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: O.ink4,
            fontFamily: O.mono,
            letterSpacing: "0.04em",
          }}
        >
          {post.post_media.length} ATTACHMENT{post.post_media.length > 1 ? "S" : ""}
        </div>
      )}

      <AnimatePresence>
        {editingTime && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, overflow: "hidden" }}
          >
            <input
              type="datetime-local"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              style={{
                flex: 1,
                height: 36,
                padding: "0 12px",
                borderRadius: 10,
                fontFamily: O.sans,
                fontSize: 13,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${O.hair2}`,
                color: O.ink,
                outline: "none",
              }}
            />
            <PillBtn
              primary
              size="sm"
              onClick={handleReschedule}
              disabled={reschedMutation.isPending}
            >
              {reschedMutation.isPending ? (
                <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
              ) : (
                "Save"
              )}
            </PillBtn>
            <PillBtn size="sm" onClick={() => setEditingTime(false)}>
              Cancel
            </PillBtn>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px solid ${O.hair}`,
        }}
      >
        <button
          onClick={() => setEditingTime(!editingTime)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 99,
            background: "transparent",
            border: `1px solid ${O.hair2}`,
            color: O.ink2,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: O.sans,
          }}
        >
          <Pencil style={{ width: 12, height: 12 }} />
          Reschedule
        </button>

        <PillBtn
          primary
          size="sm"
          onClick={() => publishMutation.mutate()}
          disabled={publishMutation.isPending}
        >
          {publishMutation.isPending ? (
            <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
          ) : (
            <Send style={{ width: 12, height: 12 }} />
          )}
          Publish now
        </PillBtn>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 99,
            background: "transparent",
            border: "1px solid rgba(255,122,133,0.3)",
            color: "#ff9aa3",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: O.sans,
          }}
        >
          {deleteMutation.isPending ? (
            <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
          ) : (
            <Trash2 style={{ width: 12, height: 12 }} />
          )}
          Delete
        </button>
      </div>
    </motion.div>
  );
}
