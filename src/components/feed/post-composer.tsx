"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, X, Loader2, BarChart3, Smile } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/lib/hooks/use-auth";
import { useCurrentProfile as useCurrentProfileHook } from "@/lib/hooks/use-profile";
import { useUIStore } from "@/lib/stores/ui-store";
import { createPost, uploadPostMedia } from "@/lib/queries/posts";
import { MAX_POST_LENGTH } from "@/lib/utils/constants";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_IMAGES = 4;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface MediaPreview {
  file: File;
  preview: string;
  type: "image" | "video" | "gif";
}

export function PostComposer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const composeOpen = useUIStore((s) => s.composeOpen);
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  return (
    <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 bg-zinc-900 border-white/[0.1] rounded-xl overflow-hidden shadow-2xl">
        <div className="text-center py-3 border-b border-white/[0.06]">
          <span className="text-sm font-semibold text-zinc-100">Create new post</span>
        </div>
        {user && (
          <ComposerForm
            user={user}
            onSuccess={() => {
              setComposeOpen(false);
              queryClient.invalidateQueries({ queryKey: ["feed"] });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InlineComposer({
  replyToId,
  onSuccess,
}: {
  replyToId?: string;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  const { data: profile } = useCurrentProfileHook();

  if (!user) return null;

  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setComposeOpen(true)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <UserAvatar
          src={profile?.avatar_url}
          fallback={profile?.display_name || "U"}
          size="sm"
        />
        <span className="text-sm text-zinc-500">Share something...</span>
      </button>
    </div>
  );
}

function ComposerForm({
  user,
  replyToId,
  onSuccess,
  inline = false,
}: {
  user: { id: string; user_metadata: Record<string, string> };
  replyToId?: string;
  onSuccess?: () => void;
  inline?: boolean;
}) {
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaPreview[]>([]);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charCount = content.length;
  const isOverLimit = charCount > MAX_POST_LENGTH;
  const canPost = (content.trim().length > 0 || media.length > 0) && !isOverLimit;

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !file.type.startsWith("video/")) {
        toast.error("Unsupported file type");
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File must be under 10MB");
        continue;
      }
      if (media.length >= MAX_IMAGES) {
        toast.error(`Maximum ${MAX_IMAGES} images`);
        break;
      }

      const preview = URL.createObjectURL(file);
      const type = file.type.startsWith("video/")
        ? "video"
        : file.type === "image/gif"
          ? "gif"
          : "image";

      setMedia((prev) => [...prev, { file, preview, type }]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    if (!canPost || posting) return;
    setPosting(true);

    try {
      // Upload media files
      const uploadedMedia = await Promise.all(
        media.map((m) => uploadPostMedia(user.id, m.file))
      );

      await createPost(
        user.id,
        { content: content.trim() },
        uploadedMedia,
        { replyToId }
      );

      setContent("");
      media.forEach((m) => URL.revokeObjectURL(m.preview));
      setMedia([]);
      toast.success(replyToId ? "Reply posted" : "Post created");
      onSuccess?.();
    } catch {
      toast.error("Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      <div className="flex gap-3 p-4">
        <UserAvatar
          src={user.user_metadata?.avatar_url}
          fallback={user.user_metadata?.display_name || user.user_metadata?.email || "U"}
          size="sm"
        />

        <div className="flex-1 min-w-0">
          <Textarea
            placeholder={replyToId ? "Write a reply..." : "Write a caption..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="border-none bg-transparent resize-none p-0 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-none min-h-[60px]"
            rows={inline ? 2 : 3}
          />

          {/* Media Previews */}
          <AnimatePresence>
            {media.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className={`grid gap-1 mt-3 ${
                  media.length === 1
                    ? "grid-cols-1"
                    : "grid-cols-2"
                }`}
              >
                {media.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className={`relative group/media overflow-hidden ${
                      media.length === 3 && i === 0 ? "row-span-2" : ""
                    }`}
                  >
                    <img
                      src={m.preview}
                      alt=""
                      className="w-full h-full object-cover max-h-[300px]"
                    />
                    <button
                      onClick={() => removeMedia(i)}
                      className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center bg-black/60 backdrop-blur-sm hover:bg-black/80 rounded-full opacity-0 group-hover/media:opacity-100 transition-all"
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleMediaSelect}
            className="hidden"
          />
          <button
            className="h-9 w-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            onClick={() => fileInputRef.current?.click()}
            disabled={media.length >= MAX_IMAGES}
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <button
            className="h-9 w-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            disabled
            title="Polls coming soon"
          >
            <BarChart3 className="h-5 w-5" />
          </button>
          <button
            className="h-9 w-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            disabled
            title="Emoji"
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {content.length > 0 && (
            <span
              className={`text-xs font-medium ${
                isOverLimit
                  ? "text-rose-400"
                  : charCount > MAX_POST_LENGTH * 0.8
                    ? "text-amber-400"
                    : "text-zinc-600"
              }`}
            >
              {charCount}/{MAX_POST_LENGTH}
            </span>
          )}
          <Button
            size="sm"
            className="rounded-lg px-6 font-semibold bg-blue-500 hover:bg-blue-600 text-white border-0 transition-colors"
            onClick={handleSubmit}
            disabled={!canPost || posting}
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : replyToId ? (
              "Reply"
            ) : (
              "Share"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
