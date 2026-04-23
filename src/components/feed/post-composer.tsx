"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, X, Loader2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/lib/hooks/use-auth";
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
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 bg-card border-border">
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
  if (!user) return null;

  return (
    <ComposerForm
      user={user}
      replyToId={replyToId}
      onSuccess={onSuccess}
      inline
    />
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
    <div className={inline ? "border-b border-border" : ""}>
      <div className="flex gap-3 p-4">
        <UserAvatar
          src={user.user_metadata?.avatar_url}
          fallback={user.user_metadata?.display_name || user.user_metadata?.email || "U"}
          size="md"
        />

        <div className="flex-1 min-w-0">
          <Textarea
            placeholder={replyToId ? "Post your reply..." : "What's happening?"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="border-none bg-transparent resize-none p-0 text-base placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:border-none min-h-[60px]"
            rows={inline ? 2 : 3}
          />

          {/* Media Previews */}
          {media.length > 0 && (
            <div
              className={`grid gap-2 mt-3 rounded-xl overflow-hidden ${
                media.length === 1
                  ? "grid-cols-1"
                  : media.length === 2
                    ? "grid-cols-2"
                    : media.length === 3
                      ? "grid-cols-2"
                      : "grid-cols-2"
              }`}
            >
              {media.map((m, i) => (
                <div
                  key={i}
                  className={`relative group ${
                    media.length === 3 && i === 0 ? "row-span-2" : ""
                  }`}
                >
                  <img
                    src={m.preview}
                    alt=""
                    className="w-full h-full object-cover rounded-lg max-h-[300px]"
                  />
                  <button
                    onClick={() => removeMedia(i)}
                    className="absolute top-2 right-2 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handleMediaSelect}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={media.length >= MAX_IMAGES}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                disabled
                title="Polls coming soon"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {content.length > 0 && (
                <span
                  className={`text-xs ${
                    isOverLimit
                      ? "text-destructive"
                      : charCount > MAX_POST_LENGTH * 0.8
                        ? "text-yellow-500"
                        : "text-muted-foreground"
                  }`}
                >
                  {charCount}/{MAX_POST_LENGTH}
                </span>
              )}
              <Button
                size="sm"
                className="rounded-full px-4"
                onClick={handleSubmit}
                disabled={!canPost || posting}
              >
                {posting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : replyToId ? (
                  "Reply"
                ) : (
                  "Post"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
