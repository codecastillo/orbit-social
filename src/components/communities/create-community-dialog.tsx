"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalShell, Field, Input, TextArea, RadioRow } from "@/components/orbit/forms";
import { O } from "@/lib/design/orbit";
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

type Visibility = "public" | "approval" | "invite";

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
  const [visibility, setVisibility] = useState<Visibility>("public");
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

  const reset = () => {
    setName("");
    setSlug("");
    setSlugManuallyEdited(false);
    setDescription("");
    setVisibility("public");
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setCreating(true);
    try {
      // Map dialog "approval" / "invite" to the Postgres join_policy enum.
      // 'public' is also the default if the user didn't pick.
      const policy: "public" | "approval" | "invite" =
        visibility === "approval"
          ? "approval"
          : visibility === "invite"
            ? "invite"
            : "public";
      const community = await createCommunity(
        user.id,
        name.trim(),
        slug.trim(),
        description.trim(),
        policy,
      );
      toast.success(`Created ${community.name}`);
      onOpenChange(false);
      reset();
      router.push(`/communities/${community.slug}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create community";
      console.error("Failed to create community:", err);
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
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto ring-0"
        style={{ boxShadow: "none" }}
      >
        <ModalShell
          title="Start a space"
          subtitle="Small community. Invite the people who actually care."
          icon={<Globe style={{ width: 18, height: 18 }} strokeWidth={1.8} />}
          accent={O.a2}
          primaryLabel={creating ? "Creating…" : "Create space"}
          secondaryLabel="Cancel"
          canSubmit={canSubmit}
          loading={creating}
          onPrimary={handleSubmit}
          onSecondary={() => onOpenChange(false)}
          onClose={() => onOpenChange(false)}
        >
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Film photographers"
              maxLength={100}
              autoFocus
            />
          </Field>
          <Field label="URL" hint="lowercase, no spaces" error={slugError ?? undefined}>
            <Input
              prefix="orbit/s/"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="film-photographers"
              maxLength={100}
            />
          </Field>
          <Field label="Description" hint="optional">
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this space about?"
              rows={3}
              maxLength={500}
            />
          </Field>
          <Field label="Who can join?">
            <RadioRow<Visibility>
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: "public", label: "Anyone", hint: "public", accent: O.a2 },
                { value: "approval", label: "Approval", hint: "you review", accent: "#ffd76a" },
                { value: "invite", label: "Invite only", hint: "private", accent: O.a3 },
              ]}
            />
          </Field>
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}
