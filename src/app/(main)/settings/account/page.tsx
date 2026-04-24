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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: data.currentPassword,
    });

    if (signInError) {
      toast.error("Current password is incorrect");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: data.newPassword,
    });

    if (error) {
      toast.error("Failed to update password");
      return;
    }

    toast.success("Password updated successfully");
    reset();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") return;
    if (!user) return;

    setDeleting(true);

    // Sign out and let backend handle deletion
    // In production, this would call an API route that uses the service role key
    const { error } = await supabase.rpc("delete_user_account", {
      user_id: user.id,
    });

    if (error) {
      toast.error("Failed to delete account. Please contact support.");
      setDeleting(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login");
  };

  if (authLoading) {
    return (
      <div className="border-x border-border min-h-screen">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
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
        <h2 className="text-lg font-semibold">Account</h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Email Section */}
        <div className="glass rounded-xl p-4 space-y-2">
          <h3 className="font-medium">Email Address</h3>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        <Separator />

        {/* Change Password */}
        <div className="space-y-4">
          <h3 className="font-medium">Change Password</h3>

          <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Enter current password"
                {...register("currentPassword")}
                className="bg-background/50"
              />
              {errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                {...register("newPassword")}
                className="bg-background/50"
              />
              {errors.newPassword && (
                <p className="text-sm text-destructive">
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                {...register("confirmPassword")}
                className="bg-background/50"
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="h-10 rounded-xl font-semibold text-sm px-5 cursor-pointer">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        </div>

        <Separator />

        {/* Danger Zone */}
        <div className="space-y-4">
          <h3 className="font-medium text-destructive">Danger Zone</h3>
          <div className="glass rounded-xl p-4 border border-destructive/20 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data. This action
                  cannot be undone.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              className="h-10 rounded-xl font-semibold text-sm px-5 cursor-pointer"
            >
              Delete Account
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account, posts, and all data.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="deleteConfirmation">
              Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm
            </Label>
            <Input
              id="deleteConfirmation"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE"
              className="bg-background/50"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmation("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== "DELETE" || deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete Forever"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
