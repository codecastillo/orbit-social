"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2, User } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  onboardingSchema,
  type OnboardingFormData,
} from "@/lib/utils/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function OnboardingPage() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
  });

  const displayName = watch("displayName", "");

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Failed to upload avatar");
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    setAvatarUrl(publicUrl);
    setUploading(false);
  };

  const onSubmit = async (data: OnboardingFormData) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to save profile");
      return;
    }

    router.push("/feed");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden page-gradient">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-blue-500/[0.04] rounded-full blur-[200px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[480px] space-y-6 relative z-10"
      >
        {/* Logo */}
        <div className="text-center space-y-2">
          <span
            className="text-5xl font-extrabold tracking-tighter inline-block"
            style={{
              fontFamily: "var(--font-syne), sans-serif",
              background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.5) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Orbit
          </span>
        </div>

        {/* Main card */}
        <div className="card-elevated p-8 sm:p-10 space-y-8">
          <div className="text-center">
            <h1
              className="text-xl font-bold"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Set up your profile
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tell the world who you are
            </p>
          </div>

          {/* Avatar Upload */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group"
              disabled={uploading}
            >
              <div className="relative">
                <Avatar className="h-28 w-28 border-[3px] border-white/10 shadow-xl shadow-black/30">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="text-3xl bg-white/[0.04]">
                    {displayName?.[0]?.toUpperCase() || <User className="h-10 w-10 text-muted-foreground/40" />}
                  </AvatarFallback>
                </Avatar>
                {/* Camera overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {uploading ? (
                    <Loader2 className="h-7 w-7 animate-spin text-white" />
                  ) : (
                    <Camera className="h-7 w-7 text-white" />
                  )}
                </div>
                {/* Camera badge */}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 border-2 border-background">
                  <Camera className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[13px] text-muted-foreground font-medium">
                Username
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-[15px] font-medium">
                  @
                </span>
                <Input
                  id="username"
                  placeholder="username"
                  {...register("username")}
                  className="input-premium pl-9"
                />
              </div>
              {errors.username && (
                <p className="text-xs text-destructive mt-1">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-[13px] text-muted-foreground font-medium">
                Display name
              </Label>
              <Input
                id="displayName"
                placeholder="Your Name"
                {...register("displayName")}
                className="input-premium"
              />
              {errors.displayName && (
                <p className="text-xs text-destructive mt-1">
                  {errors.displayName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-[13px] text-muted-foreground font-medium">
                Bio
              </Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself..."
                {...register("bio")}
                className="input-premium resize-none min-h-[100px] py-3"
                rows={3}
              />
              {errors.bio && (
                <p className="text-xs text-destructive mt-1">
                  {errors.bio.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-full text-[15px] font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Complete Setup"
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[13px] text-muted-foreground/50">
          You can always update your profile later
        </p>
      </motion.div>
    </div>
  );
}
