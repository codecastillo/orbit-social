"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/hooks/use-auth";
import { createCommunity } from "@/lib/queries/communities";

interface CreateCommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateCommunityDialog({
  open,
  onOpenChange,
}: CreateCommunityDialogProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const slugError =
    slug.length > 0 && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
      ? "Slug can only contain lowercase letters, numbers, and hyphens"
      : null;

  const canSubmit =
    name.trim().length > 0 &&
    slug.trim().length > 0 &&
    !slugError &&
    !creating;

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canSubmit) return;

    setCreating(true);
    try {
      const community = await createCommunity(
        user.id,
        name.trim(),
        slug.trim(),
        description.trim()
      );
      toast.success(`Created ${community.name}`);
      onOpenChange(false);
      setName("");
      setSlug("");
      setSlugManuallyEdited(false);
      setDescription("");
      router.push(`/communities/${community.slug}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create community";
      if (message.includes("duplicate") || message.includes("unique")) {
        toast.error("A community with that slug already exists");
      } else {
        toast.error(message);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Community</DialogTitle>
            <DialogDescription>
              Start a new community and invite others to join.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label
                htmlFor="community-name"
                className="text-sm font-medium"
              >
                Name
              </label>
              <Input
                id="community-name"
                placeholder="My Community"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="community-slug"
                className="text-sm font-medium"
              >
                URL Slug
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  /communities/
                </span>
                <Input
                  id="community-slug"
                  placeholder="my-community"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  maxLength={100}
                  className="flex-1"
                />
              </div>
              {slugError && (
                <p className="text-xs text-destructive">{slugError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="community-description"
                className="text-sm font-medium"
              >
                Description
              </label>
              <Textarea
                id="community-description"
                placeholder="What is this community about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Community
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
