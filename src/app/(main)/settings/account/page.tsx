"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { Field, Input, FormSection, ModalShell } from "@/components/orbit/forms";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(
        /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
        "Must contain at least one special character"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ChangePasswordData = z.infer<typeof changePasswordSchema>;

export default function AccountSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onChangePassword = async (data: ChangePasswordData) => {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: data.currentPassword,
    });
    if (signInError) {
      toast.error("Current password is incorrect");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: data.newPassword });
    if (error) {
      toast.error("Failed to update password");
      return;
    }
    toast.success("Password updated");
    reset();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") return;
    if (!user) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-account", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete account.");
        setDeleting(false);
        return;
      }
      await supabase.auth.signOut();
      toast.success("Account deleted.");
      router.push("/login");
    } catch {
      toast.error("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Skeleton className="h-16 w-1/2 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 18 }}>
      <Link
        href="/settings"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: O.ink3,
          fontFamily: O.mono,
          fontSize: 11,
          letterSpacing: "0.12em",
          textDecoration: "none",
          width: "fit-content",
        }}
      >
        <ArrowLeft style={{ width: 12, height: 12 }} />
        BACK · SETTINGS
      </Link>

      <div>
        <Eyebrow accent>◇&nbsp;&nbsp;SETTINGS · ACCOUNT</Eyebrow>
        <Display size={48} style={{ marginTop: 8 }}>
          Your <Acc>account</Acc>.
        </Display>
        <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
          Email, password, and how to leave.
        </p>
      </div>

      <FormSection title="Email">
        <Field label="Signed in as">
          <Input type="email" value={user?.email || ""} readOnly />
        </Field>
        <p style={{ fontSize: 12, color: O.ink4, fontFamily: O.mono, letterSpacing: "0.04em", marginTop: -6 }}>
          Email changes will be available soon.
        </p>
      </FormSection>

      <FormSection title="Change password">
        <form onSubmit={handleSubmit(onChangePassword)}>
          <Field label="Current password" error={errors.currentPassword?.message}>
            <Input type="password" placeholder="Enter current password" {...register("currentPassword")} />
          </Field>
          <Field label="New password" error={errors.newPassword?.message}>
            <Input type="password" placeholder="Min 10 chars, mixed case, number, symbol" {...register("newPassword")} />
          </Field>
          <Field label="Confirm new password" error={errors.confirmPassword?.message}>
            <Input type="password" placeholder="Repeat new password" {...register("confirmPassword")} />
          </Field>
          <PillBtn primary size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : "Update password"}
          </PillBtn>
        </form>
      </FormSection>

      <div style={{ marginTop: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "#ff9aa3", letterSpacing: "-0.01em" }}>
          Danger zone
        </h3>
        <div
          style={{
            ...panel({ borderRadius: 18 }),
            padding: 20,
            marginTop: 16,
            border: "1px solid rgba(255,122,133,0.25)",
            background: "rgba(255,122,133,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AlertTriangle style={{ width: 18, height: 18, color: "#ff7a85", flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: O.ink, margin: 0 }}>
                Delete account
              </p>
              <p style={{ fontSize: 13, color: O.ink3, margin: "6px 0 14px", lineHeight: 1.5 }}>
                Permanent. Your orbit, posts, messages, and reactions all go with you.
              </p>
              <button
                onClick={() => setDeleteDialogOpen(true)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 99,
                  background: "rgba(255,122,133,0.1)",
                  border: "1px solid rgba(255,122,133,0.4)",
                  color: "#ff9aa3",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: O.sans,
                }}
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="p-0 gap-0 border-0 bg-transparent shadow-none !max-w-[520px]"
        >
          <ModalShell
            title="Delete your account"
            subtitle="This action cannot be undone."
            danger
            primaryLabel={deleting ? "Deleting…" : "Delete forever"}
            onPrimary={handleDeleteAccount}
            secondaryLabel="Cancel"
            onSecondary={() => {
              setDeleteDialogOpen(false);
              setDeleteConfirmation("");
            }}
            canSubmit={deleteConfirmation === "DELETE" && !deleting}
            loading={deleting}
            onClose={() => setDeleteDialogOpen(false)}
          >
            <p style={{ fontSize: 13.5, color: O.ink3, lineHeight: 1.55, marginTop: 0 }}>
              Every post, repost, and reaction will be wiped. This cannot be undone.
            </p>
            <div style={{ marginTop: 16 }}>
              <Field label={<>Type <span style={{ fontFamily: O.mono, color: O.ink }}>DELETE</span> to confirm</>}>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                />
              </Field>
            </div>
          </ModalShell>
        </DialogContent>
      </Dialog>
    </div>
  );
}
