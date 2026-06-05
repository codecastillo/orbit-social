"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Camera, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalShell, Field, Input, TextArea, RadioRow } from "@/components/orbit/forms";
import { O, aurora } from "@/lib/design/orbit";
import { useAuth } from "@/lib/hooks/use-auth";
import { createCommunity, uploadCommunityImage } from "@/lib/queries/communities";
import { ImageCropper } from "@/components/shared/image-cropper";

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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pendingCrop, setPendingCrop] = useState<{
    kind: "avatar" | "cover";
    file: File;
  } | null>(null);
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);

  const onPickFile =
    (kind: "avatar" | "cover") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB");
        return;
      }
      setPendingCrop({ kind, file });
      // Reset the input so picking the same file again still triggers change
      if (e.target) e.target.value = "";
    };

  const handleCropComplete = (blob: Blob) => {
    if (!pendingCrop) return;
    const { kind } = pendingCrop;
    const cropped = new File([blob], `${kind}.jpg`, { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    if (kind === "avatar") {
      setAvatarFile(cropped);
      setAvatarPreview(url);
    } else {
      setCoverFile(cropped);
      setCoverPreview(url);
    }
  };

  const clearImage = (kind: "avatar" | "cover") => {
    if (kind === "avatar") {
      setAvatarFile(null);
      setAvatarPreview(null);
      if (avatarInput.current) avatarInput.current.value = "";
    } else {
      setCoverFile(null);
      setCoverPreview(null);
      if (coverInput.current) coverInput.current.value = "";
    }
  };

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
    setAvatarFile(null);
    setCoverFile(null);
    setAvatarPreview(null);
    setCoverPreview(null);
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

      // Upload images post-create (we need the community.id for the path).
      // Failures here don't block the create, we surface a toast and the
      // user can edit the room from inside it.
      if (avatarFile || coverFile) {
        try {
          const [avatarUrl, coverUrl] = await Promise.all([
            avatarFile
              ? uploadCommunityImage(user.id, community.id, "avatar", avatarFile)
              : Promise.resolve(null),
            coverFile
              ? uploadCommunityImage(user.id, community.id, "cover", coverFile)
              : Promise.resolve(null),
          ]);
          // Patch the community row with the resolved URLs.
          const { updateCommunity } = await import("@/lib/queries/communities");
          await updateCommunity(community.id, {
            avatarUrl: avatarUrl ?? undefined,
            coverUrl: coverUrl ?? undefined,
          });
        } catch (uploadErr) {
          console.error("Image upload failed:", uploadErr);
          toast.error("Room created, but image upload failed");
        }
      }

      toast.success(`Created ${community.name}`);
      onOpenChange(false);
      reset();
      router.push(`/communities/${community.slug}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create community";
      console.error("Failed to create community:", err);
      // Distinguish a name-collision from a slug-collision so the user
      // knows which field to change. The DB raises a unique_violation
      // and Postgres includes the index name in the message.
      if (
        message.includes("communities_name_lower_unique") ||
        /name.*already exists/i.test(message)
      ) {
        toast.error(
          "A room with that name already exists. Try a more specific name (e.g. add a focus or audience).",
        );
      } else if (message.includes("duplicate") || message.includes("unique")) {
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
          title="Start a room"
          subtitle="Small community. Invite the people who actually care."
          icon={<Globe style={{ width: 18, height: 18 }} strokeWidth={1.8} />}
          accent={O.a2}
          primaryLabel={creating ? "Creating…" : "Create room"}
          secondaryLabel="Cancel"
          canSubmit={canSubmit}
          loading={creating}
          onPrimary={handleSubmit}
          onSecondary={() => onOpenChange(false)}
          onClose={() => onOpenChange(false)}
        >
          {/* Cover + avatar pickers (optional) */}
          <Field label="Look" hint="optional">
            <div style={{ position: "relative", paddingBottom: 56 }}>
              <div
                style={{
                  position: "relative",
                  borderRadius: 14,
                  overflow: "hidden",
                  border: `1px solid ${O.hair2}`,
                  background: coverPreview
                    ? "transparent"
                    : "linear-gradient(135deg, oklch(0.6 0.18 280), oklch(0.4 0.14 320))",
                  width: "100%",
                  aspectRatio: "4 / 1",
                }}
              >
                {coverPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverPreview}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.45), transparent 60%)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  ref={coverInput}
                  type="file"
                  accept="image/*"
                  onChange={onPickFile("cover")}
                  style={{ display: "none" }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    display: "flex",
                    gap: 6,
                  }}
                >
                  {coverPreview && (
                    <button
                      type="button"
                      onClick={() => clearImage("cover")}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 99,
                        background: "rgba(0,0,0,0.55)",
                        color: "white",
                        border: `1px solid ${O.hair2}`,
                        fontSize: 11,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <X style={{ width: 11, height: 11 }} /> Remove
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => coverInput.current?.click()}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 99,
                      background: "rgba(0,0,0,0.55)",
                      color: "white",
                      border: `1px solid ${O.hair2}`,
                      fontSize: 11,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <ImagePlus style={{ width: 12, height: 12 }} />
                    {coverPreview ? "Replace cover" : "Add cover"}
                  </button>
                </div>
              </div>

              {/* Avatar overlaps the cover via negative bottom, lives outside the
                  cover's overflow:hidden so it doesn't get clipped. */}
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  bottom: 0,
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: `3px solid ${O.bg}`,
                  background: avatarPreview ? "transparent" : aurora,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: "0 6px 20px -6px rgba(0,0,0,0.5)",
                }}
                onClick={() => avatarInput.current?.click()}
                role="button"
                aria-label="Add avatar"
              >
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Camera style={{ width: 18, height: 18, color: "white" }} />
                )}
              </div>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                onChange={onPickFile("avatar")}
                style={{ display: "none" }}
              />

              <div
                style={{
                  position: "absolute",
                  left: 90,
                  bottom: 12,
                  display: "flex",
                  gap: 6,
                }}
              >
                <button
                  type="button"
                  onClick={() => avatarInput.current?.click()}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 99,
                    background: "transparent",
                    border: `1px solid ${O.hair2}`,
                    color: O.ink2,
                    fontSize: 11,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Camera style={{ width: 11, height: 11 }} />
                  {avatarPreview ? "Replace avatar" : "Add avatar"}
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={() => clearImage("avatar")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 99,
                      background: "transparent",
                      border: `1px solid ${O.hair2}`,
                      color: O.ink2,
                      fontSize: 11,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <X style={{ width: 11, height: 11 }} /> Remove
                  </button>
                )}
              </div>
            </div>
          </Field>

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
              placeholder="What is this room about?"
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
      <ImageCropper
        open={!!pendingCrop}
        file={pendingCrop?.file ?? null}
        aspectRatio={pendingCrop?.kind === "cover" ? 4 : 1}
        circular={pendingCrop?.kind === "avatar"}
        outputWidth={pendingCrop?.kind === "cover" ? 1600 : 512}
        title={pendingCrop?.kind === "cover" ? "Crop cover" : "Crop avatar"}
        onClose={() => setPendingCrop(null)}
        onComplete={handleCropComplete}
      />
    </Dialog>
  );
}
