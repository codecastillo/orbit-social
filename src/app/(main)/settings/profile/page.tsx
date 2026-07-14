"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Loader2, ImageIcon, QrCode, Check, ArrowRight, Edit3, MapPin } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  usernameSchema,
  displayNameSchema,
  bioSchema,
  websiteSchema,
} from "@/lib/utils/validators";
import { useAuth } from "@/lib/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeDialog } from "@/components/profile/qr-code-dialog";
import { ImageCropper } from "@/components/shared/image-cropper";
import { UserAvatar, type AvatarBorderStyle } from "@/components/shared/user-avatar";
import { STORAGE_BUCKETS } from "@/lib/utils/constants";
import { PROFILE_ACCENTS } from "@/lib/design/accents";
import { Field, FormSection } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

const profileFormSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  bio: bioSchema,
  website: websiteSchema,
  location: z
    .string()
    .max(100, "Location must be 100 characters or less")
    .optional()
    .or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const ACCENTS = PROFILE_ACCENTS;

// animated-glow is no longer offered; existing users who chose it render a
// static accent ring (see UserAvatar).
const BORDER_OPTIONS: { value: AvatarBorderStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "diamond", label: "Diamond" },
];

export default function EditProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [profileLoading, setProfileLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [themeColor, setThemeColor] = useState<string | null>(null);
  const [avatarBorder, setAvatarBorder] = useState<AvatarBorderStyle>("none");
  const [qrOpen, setQrOpen] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("");
  // Local "dirty" tracker for image / appearance changes that RHF doesn't see.
  // The save bar visibility is derived from this OR rhf isDirty (see below).
  const [imageDirty, setImageDirty] = useState(false);
  // Cropper queue: holds the picked file + which slot it targets.
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [cropperKind, setCropperKind] = useState<"avatar" | "cover" | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
  });

  const displayName = watch("displayName", "");

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "username, display_name, bio, avatar_url, cover_url, website, location, theme_color, avatar_border",
        )
        .eq("id", user.id)
        .single();

      if (data) {
        reset({
          username: data.username || "",
          displayName: data.display_name || "",
          bio: data.bio || "",
          website: data.website || "",
          location: data.location || "",
        });
        setAvatarUrl(data.avatar_url);
        setCoverUrl(data.cover_url);
        setThemeColor(data.theme_color || null);
        setAvatarBorder((data.avatar_border as AvatarBorderStyle) || "none");
        setCurrentUsername(data.username || "");
      }
      setProfileLoading(false);
    };
    loadProfile();
  }, [user, supabase, reset]);

  // Save bar visibility: derived, not stored. This avoids the race where
  // an image upload sets dirty=true, the upload finishes, an effect re-runs
  // on uploadingAvatar=false and clobbers it back to RHF's clean state.
  const dirty = isDirty || imageDirty || uploadingAvatar || uploadingCover;

  // Pick file → open cropper. The actual upload happens after cropping.
  const onAvatarPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("File must be JPEG, PNG, WebP, or GIF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setCropperKind("avatar");
    setCropperFile(file);
    e.target.value = "";
  };

  const onCoverPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("File must be JPEG, PNG, WebP, or GIF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setCropperKind("cover");
    setCropperFile(file);
    e.target.value = "";
  };

  const uploadCroppedBlob = async (blob: Blob, kind: "avatar" | "cover") => {
    if (!user) return;
    const setBusy = kind === "avatar" ? setUploadingAvatar : setUploadingCover;
    setBusy(true);
    try {
      const bucket =
        kind === "avatar" ? STORAGE_BUCKETS.AVATARS : STORAGE_BUCKETS.COVERS;
      const path = `${user.id}/${kind}.jpg`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, blob, {
          upsert: true,
          contentType: "image/jpeg",
        });
      if (error) {
        console.error("Storage upload failed:", error);
        toast.error(`Failed to upload ${kind}: ${error.message}`);
        return;
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      if (kind === "avatar") setAvatarUrl(url);
      else setCoverUrl(url);
      setImageDirty(true);
      toast.success(`${kind === "avatar" ? "Photo" : "Banner"} ready. Hit save below`);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", data.username.toLowerCase())
      .neq("id", user.id)
      .single();
    if (existing) {
      toast.error("Username is already taken");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        username: data.username.toLowerCase(),
        display_name: data.displayName,
        bio: data.bio || null,
        website: data.website || null,
        location: data.location || null,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        theme_color: themeColor,
        avatar_border: avatarBorder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (error) {
      toast.error("Failed to save profile");
      return;
    }
    toast.success("Profile updated");
    setImageDirty(false);
    reset({
      username: data.username,
      displayName: data.displayName,
      bio: data.bio,
      website: data.website,
      location: data.location,
    });
    router.refresh();
  };

  if (authLoading || profileLoading) {
    return (
      <div className="text-foreground">
        <Skeleton className="h-12 w-72 rounded-xl mb-4" />
        <Skeleton className="h-[200px] w-full rounded-2xl mb-4" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[880px] pb-24 text-foreground">
      <SettingsHeader section="Profile" />

      <h1 className="mt-1 text-[42px] font-bold leading-none tracking-[-0.035em]">
        Edit your <span className="text-primary">orbit</span>.
      </h1>
      <p className="mt-2.5 max-w-[520px] text-[13.5px] leading-[1.55] text-muted-foreground">
        What people see when they land on your profile. Change anything, nothing saves until you hit the button at the bottom.
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Banner */}
        <div className="relative mt-7 overflow-hidden rounded-xl border border-border">
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
            className="relative block h-[220px] w-full cursor-pointer bg-primary p-0"
            style={
              coverUrl
                ? { background: `url(${coverUrl}) center/cover` }
                : undefined
            }
          >
            <span className="absolute right-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3.5 py-2 text-xs font-medium text-white">
              {uploadingCover ? (
                <Loader2 className="h-[13px] w-[13px] animate-spin" />
              ) : coverUrl ? (
                <Camera className="h-[13px] w-[13px]" />
              ) : (
                <ImageIcon className="h-[13px] w-[13px]" />
              )}{" "}
              {coverUrl ? "Change banner" : "Add banner"}
            </span>
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onCoverPicked}
            className="hidden"
          />
        </div>

        {/* Avatar row sits BELOW the banner, with avatar overlapping via negative margin */}
        <div className="-mt-14 flex items-end gap-4 px-1">
          {/* Avatar preview, matches the profile page exactly. The accent
              ring (theme color) and the decorative avatar_border are mutually
              exclusive. When a decorative border is set, the wrapper hugs
              the avatar so the dark panel can't show through as a gap. */}
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Change profile photo"
            className={`relative z-[1] inline-block shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 leading-none ${
              avatarBorder === "none" ? "" : "shadow-[0_14px_36px_rgba(0,0,0,0.5)]"
            }`}
            style={
              avatarBorder === "none"
                ? {
                    boxShadow: `0 14px 36px rgba(0,0,0,0.5), 0 0 0 2px ${themeColor || "var(--primary)"}`,
                  }
                : undefined
            }
          >
            {avatarBorder === "none" ? (
              avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  width={126}
                  height={126}
                  className="block h-[126px] w-[126px] rounded-full object-cover"
                />
              ) : (
                <div className="flex h-[126px] w-[126px] items-center justify-center rounded-full bg-primary text-[36px] font-bold text-white">
                  {(displayName || "?").slice(0, 2).toUpperCase()}
                </div>
              )
            ) : (
              <UserAvatar
                src={avatarUrl}
                fallback={displayName || "?"}
                size="xl"
                avatarBorder={avatarBorder}
              />
            )}
            <div
              className={`pointer-events-none absolute inset-0 flex items-end justify-center rounded-full pb-2.5 text-white ${
                uploadingAvatar ? "bg-black/45" : "bg-transparent"
              }`}
            >
              {uploadingAvatar ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
              ) : null}
            </div>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onAvatarPicked}
            className="hidden"
          />

          <div className="min-w-0 flex-1 pb-1.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              ◇&nbsp;&nbsp;Profile photo
            </div>
            <div className="mt-1 text-[12.5px] leading-[1.4] text-muted-foreground">
              JPG, PNG, WebP, or GIF · square works best
            </div>
          </div>

          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="mb-1.5 inline-flex shrink-0 cursor-pointer items-center gap-[7px] rounded-full border border-border bg-surface px-3.5 py-2 text-[12.5px] font-medium text-foreground"
          >
            {uploadingAvatar ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Edit3 className="h-3 w-3" strokeWidth={1.8} />
            )}{" "}
            Change photo
          </button>
        </div>

        {/* IDENTITY */}
        <FormSection title="Identity" hint="Public · shown on your profile">
          <div className="grid grid-cols-2 gap-3.5">
            <Field
              label="Display name"
              error={errors.displayName?.message}
            >
              <RawInput {...register("displayName")} placeholder="Your Name" />
            </Field>
            <Field
              label="Username"
              hint={`orbit/@${currentUsername || "you"}`}
              error={errors.username?.message}
            >
              <RawInput {...register("username")} placeholder="username" prefix="@" />
            </Field>
          </div>
          <Field label="Bio" error={errors.bio?.message}>
            <RawTextArea {...register("bio")} placeholder="Tell the world about yourself..." rows={3} />
          </Field>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Website" error={errors.website?.message}>
              <RawInput {...register("website")} placeholder="https://yoursite.com" />
            </Field>
            <Field label="Location" error={errors.location?.message}>
              <RawInput
                {...register("location")}
                placeholder="City, State"
                prefix={<MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />}
              />
            </Field>
          </div>
        </FormSection>

        {/* APPEARANCE */}
        <FormSection title="Appearance" hint="Small personality tokens. Free.">
          <Field label="Accent color" hint="shows on your name, links, progress rings">
            <div className="flex flex-wrap gap-2.5">
              {ACCENTS.map((a, i) => {
                const active = themeColor === a.value;
                const swatch = a.value || "var(--primary)";
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`${a.label} accent`}
                    onClick={() => {
                      setThemeColor(a.value);
                      setImageDirty(true);
                    }}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 p-0"
                    style={{
                      background: swatch,
                      boxShadow: active
                        ? `0 0 0 2px var(--background), 0 0 0 4px ${swatch}`
                        : "none",
                    }}
                  >
                    {active && (
                      <Check className="h-4 w-4 text-white" strokeWidth={3} />
                    )}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Avatar border" hint="decorative · some require orbit+">
            <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
              {BORDER_OPTIONS.map((b) => {
                const active = avatarBorder === b.value;
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => {
                      setAvatarBorder(b.value);
                      setImageDirty(true);
                    }}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 ${
                      active
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-surface"
                    }`}
                  >
                    <UserAvatar
                      src={avatarUrl}
                      fallback={displayName || "?"}
                      size="md"
                      avatarBorder={b.value}
                    />
                    <span
                      className={`font-mono text-[10.5px] font-medium tracking-[0.04em] ${
                        active ? "text-foreground" : "text-text-secondary"
                      }`}
                    >
                      {b.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
        </FormSection>

        {/* SHARE */}
        <FormSection title="Share" hint="Ways to send people to you">
          <div className="flex items-center gap-3.5 rounded-xl border border-border bg-surface p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary p-[5px]">
              <QrCode className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-foreground">
                Your QR code
              </div>
              <div className="mt-[3px] font-mono text-[11.5px] tracking-[0.02em] text-muted-foreground">
                orbit/@{currentUsername || "you"} · tap to expand
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="cursor-pointer rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-medium text-foreground"
            >
              View QR
            </button>
          </div>
        </FormSection>

        {/* Save bar */}
        {dirty && (
          <div className="sticky bottom-[18px] mt-[30px] flex items-center gap-2.5 rounded-xl border border-primary/20 bg-surface-elevated p-4 shadow-lg">
            <div className="flex-1 text-[12.5px] text-text-secondary">
              <b className="text-foreground">Unsaved changes.</b> Don&apos;t forget to
              save before you leave this page.
            </div>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="cursor-pointer rounded-full border border-border bg-transparent px-4 py-[9px] text-[12.5px] font-medium text-text-secondary"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploadingAvatar || uploadingCover}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-primary px-[22px] py-[11px] text-[13.5px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <Loader2 className="h-[13px] w-[13px] animate-spin" />
              ) : null}
              Save changes <ArrowRight className="h-[13px] w-[13px]" />
            </button>
          </div>
        )}
      </form>

      <QRCodeDialog
        username={currentUsername}
        displayName={displayName || "User"}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />

      <ImageCropper
        open={cropperFile !== null}
        file={cropperFile}
        aspectRatio={cropperKind === "cover" ? 5 : 1}
        circular={cropperKind === "avatar"}
        outputWidth={cropperKind === "cover" ? 1600 : 800}
        title={cropperKind === "cover" ? "Crop banner" : "Crop profile photo"}
        onClose={() => {
          setCropperFile(null);
          setCropperKind(null);
        }}
        onComplete={(blob) => {
          const kind = cropperKind;
          if (kind) void uploadCroppedBlob(blob, kind);
        }}
      />
    </div>
  );
}

/* Inputs that work with react-hook-form's register(): must accept ref + use plain <input>/<textarea> */
const RawInput = (() => {
  // forwardRef wrapper around a styled native input that mirrors orbit Input look
  return (function RawInputInner({ prefix, ...rest }: any) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-[11px] transition-all">
        {prefix && (
          <span className="font-mono text-[13.5px] font-medium text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          {...rest}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium tracking-[-0.005em] text-foreground outline-none"
        />
      </div>
    );
  });
})();

const RawTextArea = (function RawTextAreaInner({ rows = 3, ...rest }: any) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3.5 py-[11px]">
      <textarea
        {...rest}
        rows={rows}
        className="w-full resize-y border-0 bg-transparent text-sm leading-[1.55] tracking-[-0.005em] text-foreground outline-none"
        style={{ minHeight: rows * 20 }}
      />
    </div>
  );
});
