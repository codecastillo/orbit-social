"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/hooks/use-auth";
import { uploadClipVideo, createClip } from "@/lib/queries/clips";

interface ClipCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_CAPTION_LENGTH = 500;

export function ClipCreator({ open, onOpenChange }: ClipCreatorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("video/")) {
      setError("Please select a video file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Video must be under 50MB.");
      return;
    }

    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const clearVideo = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoFile(null);
    setVideoPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    clearVideo();
    setCaption("");
    setError(null);
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user || !videoFile) throw new Error("Missing data");

      const videoUrl = await uploadClipVideo(user.id, videoFile);
      return createClip(user.id, caption, videoUrl);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clips"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      resetForm();
      onOpenChange(false);
      toast.success("Clip posted");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to post clip.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Clip</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Video upload / preview */}
          {!videoPreviewUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
            >
              <Upload className="size-8" />
              <span className="text-sm font-medium">Upload Video</span>
              <span className="text-xs">MP4, WebM, MOV (max 50MB)</span>
            </button>
          ) : (
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video
                src={videoPreviewUrl}
                className="w-full max-h-64 object-contain"
                controls
                muted
                playsInline
              />
              <button
                type="button"
                onClick={clearVideo}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Caption */}
          <div className="relative">
            <Textarea
              placeholder="Write a caption..."
              value={caption}
              onChange={(e) =>
                setCaption(e.target.value.slice(0, MAX_CAPTION_LENGTH))
              }
              className="min-h-20 resize-none"
            />
            <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {caption.length}/{MAX_CAPTION_LENGTH}
            </span>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Post button */}
          <Button
            onClick={() => postMutation.mutate()}
            disabled={!videoFile || postMutation.isPending}
          >
            {postMutation.isPending ? "Uploading..." : "Post Clip"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
