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
import { motion, AnimatePresence } from "framer-motion";
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
import { O, aurora, panel, orbitBg } from "@/lib/design/orbit";
import {
  Display,
  Acc,
  Eyebrow,
  PillBtn,
} from "@/components/orbit/primitives";
import { Field } from "@/components/orbit/forms";

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
    <div
      style={{
        ...orbitBg,
        minHeight: "100vh",
        color: O.ink,
        fontFamily: O.sans,
      }}
    >
      <div
        style={{
          maxWidth: 460,
          margin: "0 auto",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          paddingTop: 32,
          paddingBottom: 24,
        }}
      >
        {/* Header — back + progress + step indicator */}
        <header
          style={{
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as Step)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: O.ink2,
                display: "flex",
              }}
            >
              <ArrowLeft style={{ width: 22, height: 22 }} strokeWidth={1.8} />
            </button>
          ) : (
            <div style={{ width: 22 }} />
          )}
          <div
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              background: O.glass,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                borderRadius: 99,
                background: aurora,
                boxShadow: `0 0 10px ${O.a2}80`,
              }}
            />
          </div>
          <span
            style={{
              fontSize: 11,
              color: O.ink3,
              fontFamily: O.mono,
            }}
          >
            {step} / 3
          </span>
        </header>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="1"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
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
              </motion.div>
            )}
            {step === 2 && (
              <motion.div
                key="2"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                <Step2Interests
                  selected={selectedInterests}
                  toggle={toggleInterest}
                  onNext={() => setStep(3)}
                />
              </motion.div>
            )}
            {step === 3 && (
              <motion.div
                key="3"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                <Step3Follows
                  followed={followed}
                  toggle={toggleFollow}
                  finishing={finishing}
                  onFinish={finish}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1 — Welcome + profile setup ────────────────────────── */

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
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "20px 24px 0",
      }}
    >
      <Eyebrow accent>◇&nbsp;&nbsp;WELCOME TO ORBIT</Eyebrow>
      <Display size={42} style={{ marginTop: 12 }}>
        The internet, <Acc>but smaller</Acc>.
      </Display>
      <p
        style={{
          fontSize: 15,
          color: O.ink2,
          lineHeight: 1.55,
          marginTop: 14,
        }}
      >
        A social app for the people you actually want to keep up with. No
        infinite feed. No engagement metrics. Just your orbit.
      </p>

      <form
        onSubmit={onSubmit}
        style={{
          marginTop: 28,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            onClick={onAvatarClick}
            disabled={uploading}
            style={{
              position: "relative",
              width: 96,
              height: 96,
              borderRadius: "50%",
              padding: 4,
              border: "none",
              background: aurora,
              boxShadow: `0 8px 24px ${O.a2}66, inset 0 1px 0 rgba(255,255,255,0.3)`,
              cursor: "pointer",
            }}
          >
            <UserAvatar
              src={avatarUrl}
              fallback={displayName || "?"}
              size="lg"
            />
            <span
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 32,
                height: 32,
                borderRadius: 10,
                background: O.bg,
                border: `2px solid ${O.bg}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {uploading ? (
                <Loader2
                  className="animate-spin"
                  style={{ width: 14, height: 14, color: "white" }}
                />
              ) : (
                <Camera
                  style={{ width: 14, height: 14, color: "white" }}
                  strokeWidth={1.8}
                />
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

        <Field label="Username" error={errors.username?.message}>
          <RawInput
            {...register("username")}
            placeholder="yourname"
            prefix="@"
          />
        </Field>
        <Field label="Display name" error={errors.displayName?.message}>
          <RawInput {...register("displayName")} placeholder="Your Name" />
        </Field>
        <Field label="Bio" error={errors.bio?.message}>
          <RawTextArea
            {...register("bio")}
            placeholder="A line about you…"
            rows={3}
          />
        </Field>

        <PillBtn
          primary
          size="lg"
          type="submit"
          disabled={saving}
          style={{
            width: "100%",
            justifyContent: "center",
            marginTop: 12,
          }}
        >
          {saving ? (
            <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
          ) : (
            <>
              Get started <ArrowRight style={{ width: 14, height: 14 }} />
            </>
          )}
        </PillBtn>
        <p
          style={{
            textAlign: "center",
            marginTop: 14,
            fontSize: 12,
            color: O.ink3,
          }}
        >
          You can update everything later in Settings.
        </p>
      </form>
    </div>
  );
}

/* ─── Step 2 — interests ─────────────────────────────────────── */

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
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "20px 24px 0" }}>
        <Eyebrow>◈&nbsp;&nbsp;PICK A FEW</Eyebrow>
        <Display size={32} style={{ marginTop: 10 }}>
          What pulls you <Acc>in</Acc>?
        </Display>
        <p
          style={{
            fontSize: 14,
            color: O.ink2,
            marginTop: 8,
            lineHeight: 1.55,
          }}
        >
          We&apos;ll seed your orbit with people and rooms around what you choose.
          Pick 3 or more.
        </p>
      </div>

      <div
        style={{
          flex: 1,
          padding: "20px 18px",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignContent: "flex-start",
        }}
      >
        {INTERESTS.map((it) => {
          const isOn = selected.has(it.label);
          return (
            <button
              key={it.label}
              type="button"
              onClick={() => toggle(it.label)}
              style={{
                padding: "11px 18px",
                borderRadius: 99,
                fontSize: 14,
                fontWeight: 500,
                background: isOn
                  ? `linear-gradient(135deg, oklch(0.55 0.18 ${it.hue})80, oklch(0.4 0.16 ${(it.hue + 60) % 360})80)`
                  : O.glass,
                border: `1px solid ${isOn ? "rgba(255,255,255,0.3)" : O.hair}`,
                color: O.ink,
                cursor: "pointer",
                boxShadow: isOn
                  ? `0 4px 16px oklch(0.55 0.18 ${it.hue} / 0.4), inset 0 1px 0 rgba(255,255,255,0.15)`
                  : "none",
                fontFamily: "inherit",
              }}
            >
              {isOn && (
                <Check
                  style={{
                    width: 12,
                    height: 12,
                    display: "inline",
                    marginRight: 6,
                    verticalAlign: "middle",
                  }}
                  strokeWidth={3}
                />
              )}
              {it.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          padding: "18px 22px 28px",
          borderTop: `1px solid ${O.hair}`,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: O.ink3,
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          {selected.size} of 3 selected
          {selected.size >= 3 ? " · nice taste" : ""}
        </div>
        <PillBtn
          primary
          size="lg"
          onClick={onNext}
          disabled={selected.size < 1}
          style={{ width: "100%", justifyContent: "center" }}
        >
          Continue <ArrowRight style={{ width: 14, height: 14 }} />
        </PillBtn>
      </div>
    </div>
  );
}

/* ─── Step 3 — follows ───────────────────────────────────────── */

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
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "20px 24px 0" }}>
        <Eyebrow>◇&nbsp;&nbsp;BUILD YOUR ORBIT</Eyebrow>
        <Display size={32} style={{ marginTop: 10 }}>
          Pick a few <Acc>orbits</Acc> to join.
        </Display>
        <p
          style={{
            fontSize: 14,
            color: O.ink2,
            marginTop: 8,
            lineHeight: 1.55,
          }}
        >
          Based on what you picked. You can always add more later — and unfollow
          without anyone knowing.
        </p>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "18px 16px 0",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...panel({ borderRadius: 18 }),
                    padding: 14,
                    height: 72,
                  }}
                />
              ))
            : suggestions && suggestions.length > 0
              ? suggestions.map((p) => {
                  const isOn = followed.has(p.id);
                  return (
                    <div
                      key={p.id}
                      style={{
                        ...panel({ borderRadius: 18 }),
                        padding: 14,
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <UserAvatar
                        src={p.avatar_url}
                        fallback={p.display_name}
                        size="md"
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {p.display_name}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: O.ink3,
                            marginTop: 2,
                          }}
                        >
                          @{p.username}
                        </div>
                      </div>
                      <PillBtn
                        primary={!isOn}
                        size="sm"
                        onClick={() => toggle(p.id)}
                      >
                        {isOn ? (
                          <>
                            <Check style={{ width: 11, height: 11 }} strokeWidth={3} />{" "}
                            Added
                          </>
                        ) : (
                          <>
                            <Plus style={{ width: 11, height: 11 }} strokeWidth={2.4} />{" "}
                            Add
                          </>
                        )}
                      </PillBtn>
                    </div>
                  );
                })
              : (
                <p
                  style={{
                    textAlign: "center",
                    fontSize: 13,
                    color: O.ink3,
                    padding: "40px 20px",
                  }}
                >
                  No suggestions yet — you can find people on Discover.
                </p>
              )}
        </div>
      </div>

      <div
        style={{
          padding: "18px 22px 28px",
          borderTop: `1px solid ${O.hair}`,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: O.ink3,
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          {followed.size} added · find more after setup
        </div>
        <PillBtn
          primary
          size="lg"
          onClick={onFinish}
          disabled={finishing}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {finishing ? (
            <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
          ) : (
            <>
              Enter Orbit <ArrowRight style={{ width: 14, height: 14 }} />
            </>
          )}
        </PillBtn>
      </div>
    </div>
  );
}

/* ─── styled inputs that work with react-hook-form register() ───── */

const RawInput = (function RawInputInner({ prefix, ...rest }: any) {
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
