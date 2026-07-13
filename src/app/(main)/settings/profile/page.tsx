"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Loader2, ImageIcon, QrCode, Check, ArrowRight, Edit3 } from "lucide-react";
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
import { O, aurora, auroraSoft } from "@/lib/design/orbit";
import { Display, Acc } from "@/components/orbit/primitives";
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

const ACCENTS: { value: string | null; hue: number }[] = [
  { value: null, hue: 220 },
  { value: "#ffffff", hue: 0 },
  { value: "#ff6a7a", hue: 10 },
  { value: "#ff9a3d", hue: 30 },
  { value: "#ffd76a", hue: 50 },
  { value: "#7dffa3", hue: 145 },
  { value: O.a3, hue: 190 },
  { value: O.a1, hue: 265 },
  { value: O.a2, hue: 330 },
  { value: "#ff8fd1", hue: 340 },
];

const BORDER_OPTIONS: { value: AvatarBorderStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "gradient-rainbow", label: "Aurora" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "diamond", label: "Diamond" },
  { value: "animated-glow", label: "Glow" },
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
      <div style={{ color: O.ink, fontFamily: O.sans }}>
        <Skeleton className="h-12 w-72 rounded-xl mb-4" />
        <Skeleton className="h-[200px] w-full rounded-2xl mb-4" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        width: "100%",
        maxWidth: 880,
        paddingBottom: 96,
      }}
    >
      <SettingsHeader section="Profile" />

      <Display size={42} style={{ marginTop: 4 }}>
        Edit your <Acc>orbit</Acc>.
      </Display>
      <p
        style={{
          fontSize: 13.5,
          color: O.ink3,
          marginTop: 10,
          lineHeight: 1.55,
          maxWidth: 520,
        }}
      >
        What people see when they land on your profile. Change anything, nothing saves until you hit the button at the bottom.
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Banner */}
        <div
          style={{
            marginTop: 28,
            borderRadius: 20,
            overflow: "hidden",
            border: `1px solid ${O.hair2}`,
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
            style={{
              height: 220,
              width: "100%",
              position: "relative",
              background: coverUrl ? `url(${coverUrl}) center/cover` : aurora,
              backgroundSize: coverUrl ? "cover" : "200% 200%",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "block",
            }}
          >
            {!coverUrl && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 6px)",
                }}
              />
            )}
            <span
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                padding: "8px 14px",
                borderRadius: 99,
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "white",
                fontSize: 12,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {uploadingCover ? (
                <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
              ) : coverUrl ? (
                <Camera style={{ width: 13, height: 13 }} />
              ) : (
                <ImageIcon style={{ width: 13, height: 13 }} />
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
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 16,
            padding: "0 4px",
            marginTop: -56,
          }}
        >
          {/* Avatar preview, matches the profile page exactly. The accent
              ring (theme color) and the decorative avatar_border are mutually
              exclusive. When a decorative border is set, the wrapper hugs
              the avatar so the dark panel can't show through as a gap. */}
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Change profile photo"
            style={
              avatarBorder === "none"
                ? {
                    borderRadius: "50%",
                    padding: 0,
                    background: "transparent",
                    boxShadow: `0 14px 36px rgba(0,0,0,0.5), 0 0 0 2px ${themeColor || O.a2}`,
                    border: "none",
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "inline-block",
                    position: "relative",
                    zIndex: 1,
                    lineHeight: 0,
                  }
                : {
                    borderRadius: "50%",
                    boxShadow: "0 14px 36px rgba(0,0,0,0.5)",
                    border: "none",
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "inline-block",
                    position: "relative",
                    zIndex: 1,
                    padding: 0,
                    background: "transparent",
                    lineHeight: 0,
                  }
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
                  style={{
                    width: 126,
                    height: 126,
                    borderRadius: "50%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 126,
                    height: 126,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #67e8f9 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: 36,
                    fontWeight: 700,
                  }}
                >
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
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                pointerEvents: "none",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: 10,
                color: "white",
                background: uploadingAvatar
                  ? "rgba(0,0,0,0.45)"
                  : "transparent",
              }}
            >
              {uploadingAvatar ? (
                <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
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

          <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
            <div
              style={{
                fontFamily: O.mono,
                fontSize: 10.5,
                letterSpacing: "0.14em",
                color: O.ink3,
                textTransform: "uppercase",
              }}
            >
              ◇&nbsp;&nbsp;Profile photo
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: O.ink3,
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              JPG, PNG, WebP, or GIF · square works best
            </div>
          </div>

          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            style={{
              padding: "8px 14px",
              borderRadius: 99,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${O.hair2}`,
              color: O.ink,
              fontSize: 12.5,
              fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontFamily: "inherit",
              flexShrink: 0,
              marginBottom: 6,
            }}
          >
            {uploadingAvatar ? (
              <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
            ) : (
              <Edit3 style={{ width: 12, height: 12 }} strokeWidth={1.8} />
            )}{" "}
            Change photo
          </button>
        </div>

        {/* IDENTITY */}
        <FormSection title="Identity" hint="Public · shown on your profile">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Website" error={errors.website?.message}>
              <RawInput {...register("website")} placeholder="https://yoursite.com" />
            </Field>
            <Field label="Location" error={errors.location?.message}>
              <RawInput {...register("location")} placeholder="City, State" prefix="📍" />
            </Field>
          </div>
        </FormSection>

        {/* APPEARANCE */}
        <FormSection title="Appearance" hint="Small personality tokens. Free.">
          <Field label="Accent color" hint="shows on your name, links, progress rings">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ACCENTS.map((a, i) => {
                const active = themeColor === a.value;
                const ringColor = a.value || "#6a7280";
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setThemeColor(a.value);
                      setImageDirty(true);
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background:
                        a.value === "#ffffff"
                          ? "#ffffff"
                          : `linear-gradient(135deg, oklch(0.72 0.16 ${a.hue}), oklch(0.5 0.17 ${(a.hue + 40) % 360}))`,
                      boxShadow: active
                        ? `0 0 0 2px ${O.bg}, 0 0 0 4px ${ringColor}, 0 0 20px color-mix(in oklab, ${ringColor} 40%, transparent)`
                        : "inset 0 1px 0 rgba(255,255,255,0.2)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "none",
                      padding: 0,
                    }}
                  >
                    {active && (
                      <Check
                        style={{
                          width: 16,
                          height: 16,
                          color: a.value === "#ffffff" ? "#0c0a17" : "white",
                        }}
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Avatar border" hint="decorative · some require orbit+">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 10,
              }}
              className="md:grid-cols-6 grid-cols-3"
            >
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
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background: active ? auroraSoft : "rgba(255,255,255,0.025)",
                      border: `1px solid ${active ? `color-mix(in oklab, ${O.a2} 40%, transparent)` : O.hair2}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <UserAvatar
                      src={avatarUrl}
                      fallback={displayName || "?"}
                      size="md"
                      avatarBorder={b.value}
                    />
                    <span
                      style={{
                        fontSize: 10.5,
                        color: active ? O.ink : O.ink2,
                        fontWeight: 500,
                        fontFamily: O.mono,
                        letterSpacing: "0.04em",
                      }}
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: 16,
              borderRadius: 14,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${O.hair2}`,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 10,
                background: aurora,
                padding: 5,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <QrCode style={{ width: 24, height: 24, color: "white" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: O.ink }}>
                Your QR code
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: O.ink3,
                  marginTop: 3,
                  fontFamily: O.mono,
                  letterSpacing: "0.02em",
                }}
              >
                orbit/@{currentUsername || "you"} · tap to expand
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              style={{
                padding: "8px 14px",
                borderRadius: 99,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${O.hair2}`,
                color: O.ink,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              View QR
            </button>
          </div>
        </FormSection>

        {/* Save bar */}
        {dirty && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 30,
              padding: 16,
              borderRadius: 16,
              background: `linear-gradient(135deg, color-mix(in oklab, ${O.a2} 8%, transparent), color-mix(in oklab, ${O.a3} 6%, transparent))`,
              border: `1px solid color-mix(in oklab, ${O.a2} 20%, transparent)`,
              boxShadow: `0 8px 30px color-mix(in oklab, ${O.a2} 13%, transparent)`,
              position: "sticky",
              bottom: 18,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div style={{ flex: 1, fontSize: 12.5, color: O.ink2 }}>
              <b style={{ color: O.ink }}>Unsaved changes.</b> Don&apos;t forget to
              save before you leave this page.
            </div>
            <button
              type="button"
              onClick={() => router.refresh()}
              style={{
                padding: "9px 16px",
                borderRadius: 99,
                background: "transparent",
                border: `1px solid ${O.hair2}`,
                color: O.ink2,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploadingAvatar || uploadingCover}
              style={{
                padding: "11px 22px",
                borderRadius: 99,
                background: aurora,
                color: "white",
                border: "none",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                boxShadow: `0 8px 24px color-mix(in oklab, ${O.a2} 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.3)`,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "inherit",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} />
              ) : null}
              Save changes <ArrowRight style={{ width: 13, height: 13 }} />
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 14px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${O.hair2}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
          transition: "all 0.15s",
        }}
      >
        {prefix && (
          <span
            style={{
              fontSize: 13.5,
              color: O.ink3,
              fontFamily: O.mono,
              fontWeight: 500,
            }}
          >
            {prefix}
          </span>
        )}
        <input
          {...rest}
          style={{
            flex: 1,
            fontSize: 14,
            color: O.ink,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "inherit",
            minWidth: 0,
          }}
        />
      </div>
    );
  });
})();

const RawTextArea = (function RawTextAreaInner({ rows = 3, ...rest }: any) {
  return (
    <div
      style={{
        padding: "11px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${O.hair2}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <textarea
        {...rest}
        rows={rows}
        style={{
          width: "100%",
          fontSize: 14,
          color: O.ink,
          lineHeight: 1.55,
          letterSpacing: "-0.005em",
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily: "inherit",
          resize: "vertical",
          minHeight: rows * 20,
        }}
      />
    </div>
  );
});
