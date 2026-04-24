"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Camera,
  Loader2,
  User,
  ArrowRight,
  Check,
  Sparkles,
  Music2,
  Camera as CameraIcon,
  Gamepad2,
  Palette,
  Code2,
  Dumbbell,
  Plane,
  Utensils,
  BookOpen,
  Film,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
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
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { getSuggestedUsers } from "@/lib/queries/social";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

const interests = [
  { id: "music", label: "Music", icon: Music2, color: "from-violet-500/20 to-fuchsia-500/20" },
  { id: "photo", label: "Photography", icon: CameraIcon, color: "from-amber-500/20 to-orange-500/20" },
  { id: "gaming", label: "Gaming", icon: Gamepad2, color: "from-emerald-500/20 to-teal-500/20" },
  { id: "art", label: "Art & Design", icon: Palette, color: "from-pink-500/20 to-rose-500/20" },
  { id: "tech", label: "Tech", icon: Code2, color: "from-sky-500/20 to-cyan-500/20" },
  { id: "fitness", label: "Fitness", icon: Dumbbell, color: "from-red-500/20 to-rose-500/20" },
  { id: "travel", label: "Travel", icon: Plane, color: "from-indigo-500/20 to-violet-500/20" },
  { id: "food", label: "Food", icon: Utensils, color: "from-yellow-500/20 to-amber-500/20" },
  { id: "books", label: "Books", icon: BookOpen, color: "from-stone-500/20 to-zinc-500/20" },
  { id: "film", label: "Film & TV", icon: Film, color: "from-purple-500/20 to-violet-500/20" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
  const [step, setStep] = useState<Step>(1);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [savingStep1, setSavingStep1] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
  });

  const displayName = watch("displayName", "");
  const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      toast.error("File must be JPEG, PNG, WebP, or GIF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploading(true);
    if (!user) {
      setUploading(false);
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Failed to upload avatar");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
  };

  const onStep1Submit = async (data: OnboardingFormData) => {
    if (!user) {
      toast.error("Not authenticated");
      return;
    }
    setSavingStep1(true);
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", data.username.toLowerCase())
      .neq("id", user.id)
      .single();
    if (existing) {
      toast.error("Username is already taken");
      setSavingStep1(false);
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
      setSavingStep1(false);
      return;
    }
    setSavingStep1(false);
    setStep(2);
  };

  const finish = async () => {
    if (!user) return;
    setFinishing(true);
    try {
      // Persist interests as a JSON column if available; fall back silently
      await supabase
        .from("profiles")
        .update({ interests: Array.from(selectedInterests) })
        .eq("id", user.id);
    } catch {}
    // Bulk-follow
    if (followed.size > 0) {
      const inserts = Array.from(followed).map((id) => ({
        follower_id: user.id,
        following_id: id,
      }));
      await supabase.from("follows").insert(inserts);
    }
    setFinishing(false);
    router.push("/feed");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden bg-background">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/[0.06] rounded-full blur-[200px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-500/[0.05] rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-[520px] relative z-10 space-y-6">
        {/* Brand + step indicator */}
        <div className="flex items-center justify-between">
          <span
            className="text-3xl font-extrabold tracking-tighter inline-block"
            style={{
              fontFamily: "var(--font-syne), sans-serif",
              background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.5) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Orbit
          </span>
          <StepDots step={step} total={3} />
        </div>

        {/* Card */}
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/40"
        >
          {step === 1 && (
            <Step1
              avatarUrl={avatarUrl}
              uploading={uploading}
              onAvatarClick={() => fileInputRef.current?.click()}
              onAvatarChange={handleAvatarUpload}
              register={register}
              errors={errors}
              displayName={displayName}
              fileInputRef={fileInputRef}
              onSubmit={handleSubmit(onStep1Submit)}
              saving={savingStep1}
            />
          )}

          {step === 2 && (
            <Step2
              selected={selectedInterests}
              setSelected={setSelectedInterests}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <Step3
              followed={followed}
              setFollowed={setFollowed}
              onBack={() => setStep(2)}
              onFinish={finish}
              finishing={finishing}
            />
          )}
        </motion.div>

        <p className="text-center text-[12px] text-muted-foreground/60">
          You can update everything later in Settings.
        </p>
      </div>
    </div>
  );
}

function StepDots({ step, total }: { step: Step; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const idx = (i + 1) as Step;
        const active = idx === step;
        const done = idx < step;
        return (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              active ? "w-8 bg-primary shadow-[0_0_10px_oklch(0.623_0.214_259_/_0.6)]" :
              done ? "w-1.5 bg-primary/60" : "w-1.5 bg-white/15"
            )}
          />
        );
      })}
    </div>
  );
}

/* ───────── Step 1: profile ───────── */
function Step1(props: any) {
  const { avatarUrl, uploading, onAvatarClick, onAvatarChange, register, errors, displayName, fileInputRef, onSubmit, saving } = props;
  return (
    <div className="space-y-7">
      <div className="text-center">
        <h1
          className="text-2xl font-extrabold tracking-tight"
          style={{ fontFamily: "var(--font-syne), sans-serif" }}
        >
          Welcome to Orbit
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Set up your profile to get started
        </p>
      </div>

      {/* Avatar */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onAvatarClick}
          className="relative group"
          disabled={uploading}
        >
          <Avatar className="h-28 w-28 rounded-3xl border-[3px] border-white/10 shadow-2xl shadow-black/40">
            <AvatarImage src={avatarUrl || undefined} className="rounded-3xl object-cover" />
            <AvatarFallback className="rounded-3xl text-3xl bg-white/[0.04]">
              {displayName?.[0]?.toUpperCase() || (
                <User className="h-10 w-10 text-muted-foreground/40" />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <Loader2 className="h-7 w-7 animate-spin text-white" />
            ) : (
              <Camera className="h-7 w-7 text-white" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-2xl bg-primary flex items-center justify-center shadow-[0_4px_14px_oklch(0.623_0.214_259_/_0.5)] border-2 border-background">
            <Camera className="h-4 w-4 text-primary-foreground" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onAvatarChange}
            className="hidden"
          />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Username" error={errors.username?.message}>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-[15px] font-medium">@</span>
            <Input
              placeholder="yourname"
              {...register("username")}
              className="h-12 pl-9 pr-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-base placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-white/[0.06] transition-all"
            />
          </div>
        </Field>

        <Field label="Display name" error={errors.displayName?.message}>
          <Input
            placeholder="Your Name"
            {...register("displayName")}
            className="h-12 px-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-base placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-white/[0.06] transition-all"
          />
        </Field>

        <Field label="Bio" error={errors.bio?.message}>
          <Textarea
            placeholder="A line about you…"
            {...register("bio")}
            rows={3}
            className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-base resize-none placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-white/[0.06] transition-all"
          />
        </Field>

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-12 rounded-2xl text-[15px] font-bold bg-primary text-primary-foreground shadow-[0_8px_24px_oklch(0.623_0.214_259_/_0.4)] hover:brightness-110"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] uppercase tracking-wider font-bold text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/* ───────── Step 2: interests ───────── */
function Step2({
  selected,
  setSelected,
  onBack,
  onNext,
}: {
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-violet-500/10 border border-violet-500/20 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300">
            Personalise your feed
          </span>
        </div>
        <h1
          className="text-2xl font-extrabold tracking-tight"
          style={{ fontFamily: "var(--font-syne), sans-serif" }}
        >
          What are you into?
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Pick a few — we'll surface posts you'll love
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {interests.map((it) => {
          const isOn = selected.has(it.id);
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => toggle(it.id)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200 active:scale-[0.97]",
                isOn
                  ? "bg-primary/10 border-primary/40 shadow-[0_0_20px_oklch(0.623_0.214_259_/_0.2)]"
                  : "bg-white/[0.03] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.05]"
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-2xl bg-gradient-to-br flex items-center justify-center transition-all",
                  it.color
                )}
              >
                <Icon className={cn("h-5 w-5", isOn ? "text-primary" : "text-foreground/80")} />
              </div>
              <span className={cn("text-[13px] font-bold", isOn ? "text-primary" : "text-foreground")}>
                {it.label}
              </span>
              {isOn && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5 pt-2">
        <button
          onClick={onBack}
          className="h-12 px-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm font-semibold text-foreground hover:bg-white/[0.08] transition-colors"
        >
          Back
        </button>
        <Button
          onClick={onNext}
          disabled={selected.size === 0}
          className="flex-1 h-12 rounded-2xl text-[15px] font-bold bg-primary text-primary-foreground shadow-[0_8px_24px_oklch(0.623_0.214_259_/_0.4)] hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/* ───────── Step 3: follows ───────── */
function Step3({
  followed,
  setFollowed,
  onBack,
  onFinish,
  finishing,
}: {
  followed: Set<string>;
  setFollowed: (s: Set<string>) => void;
  onBack: () => void;
  onFinish: () => void;
  finishing: boolean;
}) {
  const { user } = useAuth();
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["onboarding-suggestions", user?.id],
    queryFn: () => getSuggestedUsers(user!.id, 12),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const toggle = (id: string) => {
    const next = new Set(followed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFollowed(next);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
            Build your feed
          </span>
        </div>
        <h1
          className="text-2xl font-extrabold tracking-tight"
          style={{ fontFamily: "var(--font-syne), sans-serif" }}
        >
          Follow some people
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Pick a few to fill your feed instantly
        </p>
      </div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-hide">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
            >
              <div className="h-11 w-11 rounded-2xl bg-white/[0.04] animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-28 bg-white/[0.04] rounded animate-pulse" />
                <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
              </div>
              <div className="h-9 w-20 bg-white/[0.04] rounded-2xl animate-pulse" />
            </div>
          ))
        ) : suggestions && suggestions.length > 0 ? (
          suggestions.map((p: any) => {
            const isOn = followed.has(p.id);
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
              >
                <UserAvatar src={p.avatar_url} fallback={p.display_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{p.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                </div>
                <button
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "h-9 px-4 rounded-2xl text-[12px] font-bold transition-all active:scale-95",
                    isOn
                      ? "bg-white/[0.08] text-foreground border border-white/15"
                      : "bg-primary text-primary-foreground shadow-[0_4px_12px_oklch(0.623_0.214_259_/_0.4)]"
                  )}
                >
                  {isOn ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1 inline" />
                      Following
                    </>
                  ) : (
                    "Follow"
                  )}
                </button>
              </div>
            );
          })
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">
            No suggestions yet — you can find people on Discover.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onBack}
          className="h-12 px-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm font-semibold text-foreground hover:bg-white/[0.08] transition-colors"
        >
          Back
        </button>
        <Button
          onClick={onFinish}
          disabled={finishing}
          className="flex-1 h-12 rounded-2xl text-[15px] font-bold bg-primary text-primary-foreground shadow-[0_8px_24px_oklch(0.623_0.214_259_/_0.4)] hover:brightness-110"
        >
          {finishing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {followed.size > 0 ? `Follow ${followed.size} & Finish` : "Skip for now"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
