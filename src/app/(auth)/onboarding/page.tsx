"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Camera,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  onboardingSchema,
  type OnboardingFormData,
} from "@/lib/utils/validators";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { getSuggestedUsers } from "@/lib/queries/social";
import { consumePendingRedirect } from "@/lib/utils/post-auth-redirect";
import { Button } from "@/components/ui/button";
import { AuthField, AuthInput } from "@/components/auth/auth-shell";

type Step = 1 | 2 | 3;

const INTERESTS: { label: string; hue: number }[] = [
  { label: "photography", hue: 18 },
  { label: "making", hue: 290 },
  { label: "cooking", hue: 50 },
  { label: "running", hue: 145 },
  { label: "reading", hue: 220 },
  { label: "music", hue: 340 },
  { label: "design", hue: 180 },
  { label: "writing", hue: 80 },
  { label: "travel", hue: 200 },
  { label: "climbing", hue: 25 },
  { label: "cycling", hue: 130 },
  { label: "art", hue: 310 },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
  const [step, setStep] = useState<Step>(1);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(
    new Set(),
  );
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

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
    if (!user) return;
    setUploading(true);
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
      await supabase
        .from("profiles")
        .update({ interests: Array.from(selectedInterests) })
        .eq("id", user.id);
    } catch {}
    if (followed.size > 0) {
      const inserts = Array.from(followed).map((id) => ({
        follower_id: user.id,
        following_id: id,
      }));
      await supabase.from("follows").insert(inserts);
    }
    setFinishing(false);
    router.push(consumePendingRedirect("/feed"));
    router.refresh();
  };

  const toggleInterest = (label: string) => {
    const next = new Set(selectedInterests);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    setSelectedInterests(next);
  };

  const toggleFollow = (id: string) => {
    const next = new Set(followed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFollowed(next);
  };

  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="landing-fade-in mx-auto flex min-h-screen w-full max-w-[460px] flex-col pb-6 pt-8">
        {/* Header: back + progress + step indicator */}
        <header className="flex items-center gap-3 px-[18px] py-3.5">
          {step > 1 ? (
            <button
              type="button"
              aria-label="Back to previous step"
              onClick={() => setStep((step - 1) as Step)}
              className="flex cursor-pointer border-none bg-transparent p-0 text-text-secondary hover:text-foreground"
            >
              <ArrowLeft className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </button>
          ) : (
            <div className="w-[22px]" />
          )}
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {step} / 3
          </span>
        </header>

        <div className="flex flex-1 flex-col">
          {step === 1 && (
            <div className="flex flex-1 flex-col">
              <Step1Welcome
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
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-1 flex-col">
              <Step2Interests
                selected={selectedInterests}
                toggle={toggleInterest}
                onNext={() => setStep(3)}
              />
            </div>
          )}
          {step === 3 && (
            <div className="flex flex-1 flex-col">
              <Step3Follows
                followed={followed}
                toggle={toggleFollow}
                finishing={finishing}
                onFinish={finish}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* Step 1: welcome + profile setup */

function Step1Welcome(props: any) {
  const {
    avatarUrl,
    uploading,
    onAvatarClick,
    onAvatarChange,
    register,
    errors,
    displayName,
    fileInputRef,
    onSubmit,
    saving,
  } = props;

  return (
    <div className="flex flex-1 flex-col px-6 pt-5">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
        Welcome to Orbit
      </p>
      <h1 className="mt-3 text-[42px] font-bold leading-tight tracking-[-0.03em] text-foreground">
        The internet, <span className="text-primary">but smaller</span>.
      </h1>
      <p className="mt-3.5 text-[15px] leading-relaxed text-text-secondary">
        A social app for the people you actually want to keep up with. No
        infinite feed. No engagement metrics. Just your orbit.
      </p>

      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-1">
        {/* Avatar */}
        <div className="mb-3.5 flex justify-center">
          <button
            type="button"
            aria-label="Upload avatar"
            onClick={onAvatarClick}
            disabled={uploading}
            className="relative cursor-pointer rounded-full border border-border bg-surface p-1"
          >
            <UserAvatar
              src={avatarUrl}
              fallback={displayName || "?"}
              size="lg"
            />
            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" strokeWidth={1.8} />
              )}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onAvatarChange}
            className="hidden"
          />
        </div>

        <AuthField label="Username" error={errors.username?.message}>
          <AuthInput
            {...register("username")}
            placeholder="yourname"
            prefix="@"
          />
        </AuthField>
        <AuthField label="Display name" error={errors.displayName?.message}>
          <AuthInput {...register("displayName")} placeholder="Your Name" />
        </AuthField>
        <AuthField label="Bio" error={errors.bio?.message}>
          <textarea
            {...register("bio")}
            placeholder="A line about you"
            rows={3}
            className="min-h-[60px] w-full resize-y rounded-lg border border-input bg-background px-3.5 py-[11px] text-sm font-medium leading-relaxed text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary/40 focus:ring-[3px] focus:ring-primary/10"
          />
        </AuthField>

        <Button
          type="submit"
          className="mt-3 h-11 w-full text-sm"
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
        <p className="mt-3.5 text-center text-xs text-muted-foreground">
          You can update everything later in Settings.
        </p>
      </form>
    </div>
  );
}

/* Step 2: interests */

function Step2Interests({
  selected,
  toggle,
  onNext,
}: {
  selected: Set<string>;
  toggle: (label: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 pt-5">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          Pick a few
        </p>
        <h1 className="mt-2.5 text-[32px] font-bold leading-tight tracking-[-0.03em] text-foreground">
          What pulls you <span className="text-primary">in</span>?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          We&apos;ll seed your orbit with people and rooms around what you choose.
          Pick 3 or more.
        </p>
      </div>

      <div className="flex flex-1 flex-wrap content-start gap-2 px-[18px] py-5">
        {INTERESTS.map((it) => {
          const isOn = selected.has(it.label);
          return (
            <button
              key={it.label}
              type="button"
              onClick={() => toggle(it.label)}
              className={
                isOn
                  ? "cursor-pointer rounded-full border border-transparent bg-primary px-[18px] py-[11px] text-sm font-medium text-primary-foreground"
                  : "cursor-pointer rounded-full border border-border bg-surface px-[18px] py-[11px] text-sm font-medium text-text-secondary hover:text-foreground"
              }
            >
              {isOn && (
                <Check
                  className="mr-1.5 inline h-3 w-3 align-middle"
                  strokeWidth={3}
                />
              )}
              {it.label}
            </button>
          );
        })}
      </div>

      <div className="border-t border-border px-[22px] pb-7 pt-[18px]">
        <div className="mb-3 text-center text-xs text-muted-foreground">
          {selected.size} of 3 selected
          {selected.size >= 3 ? " · nice taste" : ""}
        </div>
        <Button
          className="h-11 w-full text-sm"
          onClick={onNext}
          disabled={selected.size < 1}
        >
          Continue <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* Step 3: suggested follows */

function Step3Follows({
  followed,
  toggle,
  finishing,
  onFinish,
}: {
  followed: Set<string>;
  toggle: (id: string) => void;
  finishing: boolean;
  onFinish: () => void;
}) {
  const { user } = useAuth();
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["onboarding-suggestions", user?.id],
    queryFn: () => getSuggestedUsers(user!.id, 12),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 pt-5">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          Build your orbit
        </p>
        <h1 className="mt-2.5 text-[32px] font-bold leading-tight tracking-[-0.03em] text-foreground">
          Pick a few <span className="text-primary">orbits</span> to join.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Based on what you picked. You can always add more later, and unfollow
          without anyone knowing.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-4 pt-[18px]">
        <div className="flex flex-col">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[72px] animate-pulse border-b border-border"
                />
              ))
            : suggestions && suggestions.length > 0
              ? suggestions.map((p) => {
                  const isOn = followed.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 border-b border-border py-3.5"
                    >
                      <UserAvatar
                        src={p.avatar_url}
                        fallback={p.display_name}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground">
                          {p.display_name}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          @{p.username}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isOn ? "outline" : "default"}
                        onClick={() => toggle(p.id)}
                      >
                        {isOn ? (
                          <>
                            <Check className="h-3 w-3" strokeWidth={3} /> Added
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3" strokeWidth={2.4} /> Add
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              : (
                <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                  No suggestions yet. You can find people on Discover.
                </p>
              )}
        </div>
      </div>

      <div className="border-t border-border px-[22px] pb-7 pt-[18px]">
        <div className="mb-3 text-center text-xs text-muted-foreground">
          {followed.size} added · find more after setup
        </div>
        <Button
          className="h-11 w-full text-sm"
          onClick={onFinish}
          disabled={finishing}
        >
          {finishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Enter Orbit <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
