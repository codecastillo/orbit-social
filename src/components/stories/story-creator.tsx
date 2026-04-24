"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createStory, uploadStoryMedia } from "@/lib/queries/stories";

interface StoryCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoryCreator({ open, onOpenChange }: StoryCreatorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedFile) throw new Error("Missing data");

      const { url, type } = await uploadStoryMedia(user.id, selectedFile);
      return createStory(user.id, url, type);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      handleClose();
    },
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only accept images for now
    if (!file.type.startsWith("image/")) return;

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  }

  function handleClose() {
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Moment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {preview ? (
            <div className="relative aspect-[9/16] max-h-[60vh] w-full overflow-hidden rounded-lg bg-black">
              <img
                src={preview}
                alt="Story preview"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-3",
                "w-full aspect-[9/16] max-h-[60vh] rounded-lg",
                "border-2 border-dashed border-muted-foreground/30",
                "bg-muted/30 hover:bg-muted/50 transition-colors",
                "text-muted-foreground"
              )}
            >
              <ImagePlus className="h-10 w-10" />
              <span className="text-sm font-medium">
                Choose a photo
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex gap-2">
            {preview && (
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null);
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="flex-1"
              >
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

          {mutation.isError && (
            <p className="text-sm text-destructive text-center">
              Failed to create moment. Please try again.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
