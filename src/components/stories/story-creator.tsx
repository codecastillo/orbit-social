"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Globe, ImagePlus, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createStory,
  uploadStoryMedia,
  type StoryOverlayPosition,
  type StorySticker,
  type StoryTextOverlay,
} from "@/lib/queries/stories";
import { StoryOverlayLayer } from "./story-overlays";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_DURATION_SECONDS = 30;

const POSITIONS: { value: StoryOverlayPosition; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

interface StoryCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function readVideoDuration(objectUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => resolve(probe.duration);
    probe.onerror = () => reject(new Error("Could not read video metadata"));
    probe.src = objectUrl;
  });
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition",
            value === option.value
              ? "border-primary text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function StoryCreator({ open, onOpenChange }: StoryCreatorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<"public" | "close_friends">(
    "public"
  );
  const [captionText, setCaptionText] = useState("");
  const [captionPosition, setCaptionPosition] =
    useState<StoryOverlayPosition>("bottom");
  const [captionSize, setCaptionSize] = useState<"small" | "large">("small");
  const [mentionValue, setMentionValue] = useState("");
  const [mentionPosition, setMentionPosition] =
    useState<StoryOverlayPosition>("center");
  const [linkValue, setLinkValue] = useState("");
  const [linkPosition, setLinkPosition] =
    useState<StoryOverlayPosition>("bottom");

  const isVideo = !!selectedFile?.type.startsWith("video/");

  const textOverlay: StoryTextOverlay | null = captionText.trim()
    ? {
        text: captionText.trim(),
        position: captionPosition,
        size: captionSize,
      }
    : null;

  const stickers: StorySticker[] = [];
  if (mentionValue.trim()) {
    stickers.push({
      type: "mention",
      value: mentionValue.trim().replace(/^@/, ""),
      position: mentionPosition,
    });
  }
  if (linkValue.trim()) {
    const raw = linkValue.trim();
    stickers.push({
      type: "link",
      value: /^https?:\/\//i.test(raw) ? raw : `https://${raw}`,
      position: linkPosition,
    });
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedFile) throw new Error("Missing data");

      const { url, type } = await uploadStoryMedia(user.id, selectedFile);
      return createStory(user.id, url, type, {
        visibility,
        durationSeconds:
          type === "video" && videoDuration
            ? Math.ceil(videoDuration)
            : undefined,
        textOverlay: textOverlay ?? undefined,
        interactiveData: stickers.length > 0 ? { stickers } : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      handleClose();
      toast.success("Moment posted");
    },
    onError: () => {
      toast.error("Couldn't post your moment. Please try again.");
    },
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const video = file.type.startsWith("video/");
    if (!video && !file.type.startsWith("image/")) {
      toast.error("Moments support photos and videos.");
      return;
    }

    if (file.size > (video ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE)) {
      toast.error(video ? "Video must be under 50MB." : "Photo must be under 10MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    if (video) {
      try {
        const duration = await readVideoDuration(objectUrl);
        if (duration > MAX_VIDEO_DURATION_SECONDS) {
          URL.revokeObjectURL(objectUrl);
          toast.error(
            `Videos can be up to ${MAX_VIDEO_DURATION_SECONDS} seconds.`
          );
          return;
        }
        setVideoDuration(duration);
      } catch {
        URL.revokeObjectURL(objectUrl);
        toast.error("Couldn't read that video. Try another file.");
        return;
      }
    } else {
      setVideoDuration(null);
    }

    setSelectedFile(file);
    setPreview(objectUrl);
  }

  function clearMedia() {
    setPreview(null);
    setSelectedFile(null);
    setVideoDuration(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    clearMedia();
    setVisibility("public");
    setCaptionText("");
    setCaptionPosition("bottom");
    setCaptionSize("small");
    setMentionValue("");
    setMentionPosition("center");
    setLinkValue("");
    setLinkPosition("bottom");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Moment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {preview ? (
            <div className="relative aspect-[9/16] max-h-[45vh] w-full overflow-hidden rounded-lg bg-black">
              {isVideo ? (
                <video
                  src={preview}
                  className="w-full h-full object-contain"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  src={preview}
                  alt="Moment preview"
                  className="w-full h-full object-contain"
                />
              )}
              <StoryOverlayLayer textOverlay={textOverlay} stickers={stickers} />
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-3",
                "w-full aspect-[9/16] max-h-[45vh] rounded-lg",
                "border-2 border-dashed border-muted-foreground/30",
                "bg-muted/30 hover:bg-muted/50 transition-colors",
                "text-muted-foreground"
              )}
            >
              <ImagePlus className="h-10 w-10" />
              <span className="text-sm font-medium">
                Choose a photo or video
              </span>
              <span className="text-xs">
                Videos up to {MAX_VIDEO_DURATION_SECONDS} seconds
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {preview && (
            <div className="space-y-4">
              {/* Text overlay */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  maxLength={120}
                  placeholder="Add a caption"
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
                />
                {captionText.trim() && (
                  <div className="flex items-center justify-between gap-2">
                    <ChipRow
                      options={POSITIONS}
                      value={captionPosition}
                      onChange={setCaptionPosition}
                    />
                    <ChipRow
                      options={[
                        { value: "small" as const, label: "Small" },
                        { value: "large" as const, label: "Large" },
                      ]}
                      value={captionSize}
                      onChange={setCaptionSize}
                    />
                  </div>
                )}
              </div>

              {/* Mention sticker */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={mentionValue}
                  onChange={(e) => setMentionValue(e.target.value)}
                  maxLength={30}
                  placeholder="Mention someone (@username)"
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
                />
                {mentionValue.trim() && (
                  <ChipRow
                    options={POSITIONS}
                    value={mentionPosition}
                    onChange={setMentionPosition}
                  />
                )}
              </div>

              {/* Link sticker */}
              <div className="space-y-2">
                <input
                  type="url"
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  maxLength={200}
                  placeholder="Add a link (https://...)"
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
                />
                {linkValue.trim() && (
                  <ChipRow
                    options={POSITIONS}
                    value={linkPosition}
                    onChange={setLinkPosition}
                  />
                )}
              </div>
            </div>
          )}

          {/* Visibility toggle */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setVisibility("public")}
              className={cn(
                "flex-1",
                visibility === "public" && "border-primary text-primary"
              )}
            >
              <Globe className="h-4 w-4" />
              Public
            </Button>
            <Button
              variant="outline"
              onClick={() => setVisibility("close_friends")}
              className={cn(
                "flex-1",
                visibility === "close_friends" && "border-primary text-primary"
              )}
            >
              <Users className="h-4 w-4" />
              Close friends
            </Button>
          </div>

          <div className="flex gap-2">
            {preview && (
              <Button variant="outline" onClick={clearMedia} className="flex-1">
                Change
              </Button>
            )}
            <Button
              onClick={() => mutation.mutate()}
              disabled={!selectedFile || mutation.isPending}
              className="flex-1"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                "Post Moment"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
