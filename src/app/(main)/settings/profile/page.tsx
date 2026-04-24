"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Loader2, ArrowLeft, ImageIcon, QrCode, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  usernameSchema,
  displayNameSchema,
  bioSchema,
  websiteSchema,
} from "@/lib/utils/validators";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeDialog } from "@/components/profile/qr-code-dialog";
import { UserAvatar, type AvatarBorderStyle } from "@/components/shared/user-avatar";
import { STORAGE_BUCKETS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils";

const profileFormSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  bio: bioSchema,
  website: websiteSchema,
  location: z.string().max(100, "Location must be 100 characters or less").optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const PRESET_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Green", value: "#22c55e" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
];

const BORDER_OPTIONS: { value: AvatarBorderStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "gradient-rainbow", label: "Rainbow" },
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

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
  });

  const displayName = watch("displayName", "");

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, bio, avatar_url, cover_url, website, location, theme_color, avatar_border")
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

  const handleImageUpload = async (
    file: File,
    bucket: string,
    path: string
  ): Promise<string | null> => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("File must be JPEG, PNG, WebP, or GIF");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return null;
    }

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (error) {
      toast.error("Failed to upload image");
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    const fileExt = file.name.split(".").pop();
    const url = await handleImageUpload(
      file,
      STORAGE_BUCKETS.AVATARS,
      `${user.id}/avatar.${fileExt}`
    );
    if (url) setAvatarUrl(url);
    setUploadingAvatar(false);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingCover(true);
    const fileExt = file.name.split(".").pop();
    const url = await handleImageUpload(
      file,
      STORAGE_BUCKETS.COVERS,
      `${user.id}/cover.${fileExt}`
    );
    if (url) setCoverUrl(url);
    setUploadingCover(false);
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    // Check username availability
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
    router.refresh();
  };

  if (authLoading || profileLoading) {
    return (
      <div className="border-x border-border min-h-screen">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-6 space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-x border-border min-h-screen">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold">Edit Profile</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Cover Photo */}
        <div className="relative">
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="w-full h-40 bg-muted relative group overflow-hidden"
            disabled={uploadingCover}
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingCover ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </div>
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverUpload}
            className="hidden"
          />
        </div>

        {/* Avatar */}
        <div className="px-4 -mt-12">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="relative group"
            disabled={uploadingAvatar}
          >
            <UserAvatar
              src={avatarUrl}
              fallback={displayName || "?"}
              size="xl"
              avatarBorder={avatarBorder}
              className="border-4 border-background"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </div>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>

        {/* Form Fields */}
        <div className="px-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="Your Name"
              {...register("displayName")}
              className="bg-background/50"
            />
            {errors.displayName && (
              <p className="text-sm text-destructive">{errors.displayName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                id="username"
                placeholder="username"
                {...register("username")}
                className="bg-background/50 pl-8"
              />
            </div>
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell the world about yourself..."
              {...register("bio")}
              className="bg-background/50 resize-none"
              rows={3}
            />
            {errors.bio && (
              <p className="text-sm text-destructive">{errors.bio.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              placeholder="https://yoursite.com"
              {...register("website")}
              className="bg-background/50"
            />
            {errors.website && (
              <p className="text-sm text-destructive">{errors.website.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="San Francisco, CA"
              {...register("location")}
              className="bg-background/50"
            />
            {errors.location && (
              <p className="text-sm text-destructive">{errors.location.message}</p>
            )}
          </div>

          {/* Theme Color Picker */}
          <div className="space-y-2 pt-2">
            <Label>Accent Color</Label>
            <p className="text-xs text-muted-foreground">
              Choose a color that represents your profile
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {/* No color / default option */}
              <button
                type="button"
                onClick={() => setThemeColor(null)}
                className={cn(
                  "h-9 w-9 rounded-full border-2 transition-all flex items-center justify-center",
                  themeColor === null
                    ? "border-white ring-2 ring-white/30"
                    : "border-white/20 hover:border-white/40"
                )}
                style={{ background: "linear-gradient(135deg, #334155, #475569)" }}
                title="Default"
              >
                {themeColor === null && (
                  <Check className="h-4 w-4 text-white" />
                )}
              </button>
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setThemeColor(color.value)}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition-all flex items-center justify-center",
                    themeColor === color.value
                      ? "border-white ring-2 ring-white/30"
                      : "border-white/20 hover:border-white/40"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {themeColor === color.value && (
                    <Check className="h-4 w-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Avatar Border */}
          <div className="space-y-2 pt-2">
            <Label>Avatar Border</Label>
            <p className="text-xs text-muted-foreground">
              Add a decorative border around your avatar
            </p>
            <div className="flex flex-wrap gap-3 mt-2">
              {BORDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAvatarBorder(option.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all",
                    avatarBorder === option.value
                      ? "border-white/40 bg-white/[0.06]"
                      : "border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]"
                  )}
                >
                  <UserAvatar
                    src={avatarUrl}
                    fallback={displayName || "?"}
                    size="sm"
                    avatarBorder={option.value}
                  />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* QR Code Section */}
          <div className="space-y-2 pt-2">
            <Label>QR Code</Label>
            <p className="text-xs text-muted-foreground">
              Share your profile via QR code
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-2 rounded-xl h-10"
              onClick={() => setQrOpen(true)}
            >
              <QrCode className="h-4 w-4 mr-2" />
              View QR Code
            </Button>
          </div>

          <div className="pt-2 pb-6">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || uploadingAvatar || uploadingCover}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </form>

      <QRCodeDialog
        username={currentUsername}
        displayName={displayName || "User"}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />
    </div>
  );
}
