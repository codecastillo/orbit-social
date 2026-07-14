"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, FormSection, ModalShell } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

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
      <div className="flex flex-col gap-[18px]">
        <Skeleton className="h-16 w-1/2 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <SettingsHeader section="Account" />

      <div>
        <h1 className="mt-1 text-[48px] font-bold leading-none tracking-[-0.035em]">
          Your <span className="text-primary">account</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Email, password, and how to leave.
        </p>
      </div>

      <FormSection title="Email">
        <Field label="Signed in as">
          <Input type="email" value={user?.email || ""} readOnly />
        </Field>
        <p className="-mt-1.5 font-mono text-xs tracking-[0.04em] text-text-faint">
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
          <Button size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update password"}
          </Button>
        </form>
      </FormSection>

      <div className="mt-7">
        <h3 className="m-0 text-base font-semibold tracking-[-0.01em] text-destructive">
          Danger zone
        </h3>
        <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="m-0 text-sm font-semibold text-foreground">
                Delete account
              </p>
              <p className="mb-3.5 mt-1.5 text-[13px] leading-normal text-muted-foreground">
                Permanent. Your orbit, posts, messages, and reactions all go with you.
              </p>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                Delete account
              </Button>
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
            <p className="mt-0 text-[13.5px] leading-[1.55] text-muted-foreground">
              Every post, repost, and reaction will be wiped. This cannot be undone.
            </p>
            <div className="mt-4">
              <Field label={<>Type <span className="font-mono text-foreground">DELETE</span> to confirm</>}>
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
